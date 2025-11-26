import express from "express";
import Payroll from "../models/Payroll.js";
import Withdrawal from "../models/Withdrawal.js";
import User from "../models/User.js";
import TellerReport from "../models/TellerReport.js";
import Capital from "../models/Capital.js";
import SystemSettings from "../models/SystemSettings.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = express.Router();

/* ========================================================
   🧠 ADMIN: Get all payrolls for all users
======================================================== */
router.get("/all", async (req, res) => {
  try {
    const payrolls = await Payroll.find()
      .populate("user", "username name role active status")
      .sort({ createdAt: -1 })
      .lean();

    res.json({ success: true, payrolls });
  } catch (err) {
    console.error("❌ Error fetching all payrolls:", err);
    res.status(500).json({ message: "Failed to fetch all payrolls" });
  }
});

/* ========================================================
   💰 NEW: Get latest payroll by USER ID (for SidebarLayout)
======================================================== */
router.get("/user/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    console.log("📥 Fetching payroll by USER ID:", userId);

    const payrolls = await Payroll.find({ user: userId })
      .sort({ createdAt: -1 })
      .populate("user", "username name role")
      .lean();

    if (!payrolls || payrolls.length === 0) {
      console.warn("⚠️ No payroll found for user:", userId);
      return res.json({ success: true, payrolls: [] });
    }

    res.json({ success: true, payrolls });
  } catch (err) {
    console.error("❌ Error fetching payroll by user:", err);
    res.status(500).json({ message: "Failed to fetch payroll by user" });
  }
});

/* ========================================================
   💰 WITHDRAWAL ROUTES (with approval workflow)
======================================================== */
router.post("/:id/withdraw", async (req, res) => {
  try {
    const { id } = req.params;
    const { amount = null, initiatedBy = null, weekRange = null } = req.body;

    const payroll = await Payroll.findById(id);
    if (!payroll) return res.status(404).json({ message: "Payroll not found" });
    if (payroll.withdrawn)
      return res.status(400).json({ message: "Already withdrawn" });

    const withdrawAmount =
      amount != null ? Number(amount) : payroll.totalSalary || 0;

    const remainingUnwithdrawn = await Payroll.aggregate([
      { $match: { user: payroll.user, withdrawn: false } },
      { $group: { _id: null, total: { $sum: "$totalSalary" } } },
    ]);
    const remaining =
      (remainingUnwithdrawn[0] && remainingUnwithdrawn[0].total) || 0;

    // Create withdrawal request (pending approval)
    const withdrawal = new Withdrawal({
      userId: payroll.user,
      payrollIds: [payroll._id],
      amount: withdrawAmount,
      remaining,
      weekRange,
      createdBy: initiatedBy,
      status: "pending", // Requires admin approval
    });
    await withdrawal.save();

    // 🔄 Notify all admins of new withdrawal request
    if (global.io) global.io.emit("withdrawalRequested", { 
      withdrawalId: withdrawal._id,
      userId: payroll.user,
      amount: withdrawAmount
    });

    res.json({
      success: true,
      message: "✅ Withdrawal request submitted. Awaiting admin approval.",
      withdrawal,
    });
  } catch (err) {
    console.error("❌ Error in withdraw:", err);
    res.status(500).json({ message: "Failed to process withdrawal" });
  }
});

router.post("/bulk-withdraw", async (req, res) => {
  try {
    const { payrollIds = [], initiatedBy = null, weekRange = null } = req.body;
    if (!Array.isArray(payrollIds) || payrollIds.length === 0)
      return res.status(400).json({ message: "No payroll IDs provided" });

    const payrolls = await Payroll.find({ _id: { $in: payrollIds } });
    if (!payrolls.length)
      return res.status(404).json({ message: "Payrolls not found" });

    // Do NOT mark payrolls withdrawn here. Create a pending withdrawal request.
    // Actual marking happens upon admin approval.
    const total = payrolls.reduce((sum, p) => sum + (p.withdrawn ? 0 : (p.totalSalary || 0)), 0);
    const updatedIds = payrolls.filter((p) => !p.withdrawn).map((p) => p._id);

    const remaining = await Payroll.aggregate([
      { $match: { user: payrolls[0].user, withdrawn: false } },
      { $group: { _id: null, total: { $sum: "$totalSalary" } } },
    ]);

    const withdrawal = new Withdrawal({
      userId: payrolls[0].user,
      payrollIds: updatedIds,
      amount: total,
      remaining: (remaining[0] && remaining[0].total) || 0,
      weekRange,
      createdBy: initiatedBy,
      status: "pending",
    });
    await withdrawal.save();

    if (global.io) {
      global.io.emit("withdrawalRequested", { withdrawalId: withdrawal._id, userId: withdrawal.userId, amount: withdrawal.amount });
    }

    res.json({
      success: true,
      message: `✅ Withdrawal request submitted for ₱${total.toFixed(2)}. Awaiting admin approval.`,
      withdrawal,
    });
  } catch (err) {
    console.error("❌ Bulk withdraw error:", err);
    res.status(500).json({ message: "Failed to bulk withdraw" });
  }
});

router.get("/withdrawals/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const withdrawals = await Withdrawal.find({ userId })
      .populate("userId", "username name role")
      .sort({ createdAt: -1 })
      .lean();

    res.json({ success: true, withdrawals });
  } catch (err) {
    console.error("❌ Error fetching withdrawals:", err);
    res.status(500).json({ message: "Failed to fetch withdrawals" });
  }
});

router.get("/withdrawals", async (req, res) => {
  try {
    const withdrawals = await Withdrawal.find()
      .populate("userId", "username name role")
      .populate("approvedBy", "username name")
      .sort({ createdAt: -1 })
      .lean();

    res.json({ success: true, withdrawals });
  } catch (err) {
    console.error("❌ Error fetching all withdrawals:", err);
    res.status(500).json({ message: "Failed to fetch withdrawals" });
  }
});

/* ========================================================
   ✅ ADMIN: Approve Withdrawal Request
======================================================== */
router.put("/withdrawals/:id/approve", async (req, res) => {
  try {
    const { id } = req.params;
    const { adminId } = req.body;

    const withdrawal = await Withdrawal.findById(id).populate("userId");
    if (!withdrawal) return res.status(404).json({ message: "Withdrawal not found" });
    
    if (withdrawal.status !== "pending") {
      return res.status(400).json({ message: `Withdrawal already ${withdrawal.status}` });
    }

    // Update withdrawal status
    withdrawal.status = "approved";
    withdrawal.approvedBy = adminId;
    withdrawal.approvedAt = new Date();
    await withdrawal.save();

    // Mark payrolls as withdrawn
    const payrolls = await Payroll.find({ _id: { $in: withdrawal.payrollIds } });
    for (const payroll of payrolls) {
      payroll.withdrawn = true;
      payroll.withdrawnAt = new Date();
      payroll.withdrawal = withdrawal.amount;
      await payroll.save();
    }

    // 🔄 Notify user
    if (global.io) {
      global.io.emit("withdrawalApproved", { 
        withdrawalId: withdrawal._id,
        userId: withdrawal.userId._id,
        amount: withdrawal.amount
      });
    }

    res.json({
      success: true,
      message: "✅ Withdrawal approved successfully",
      withdrawal,
    });
  } catch (err) {
    console.error("❌ Error approving withdrawal:", err);
    res.status(500).json({ message: "Failed to approve withdrawal" });
  }
});

/* ========================================================
   ❌ ADMIN: Reject Withdrawal Request
======================================================== */
router.put("/withdrawals/:id/reject", async (req, res) => {
  try {
    const { id } = req.params;
    const { adminId, reason } = req.body;

    const withdrawal = await Withdrawal.findById(id).populate("userId");
    if (!withdrawal) return res.status(404).json({ message: "Withdrawal not found" });
    
    if (withdrawal.status !== "pending") {
      return res.status(400).json({ message: `Withdrawal already ${withdrawal.status}` });
    }

    // Update withdrawal status
    withdrawal.status = "rejected";
    withdrawal.approvedBy = adminId;
    withdrawal.approvedAt = new Date();
    withdrawal.rejectionReason = reason || "No reason provided";
    await withdrawal.save();

    // Ensure any payrolls linked remain available (revert flags if any were set previously)
    try {
      const payrolls = await Payroll.find({ _id: { $in: withdrawal.payrollIds } });
      for (const p of payrolls) {
        if (p.withdrawn) {
          p.withdrawn = false;
          p.withdrawnAt = undefined;
          p.withdrawal = 0;
          await p.save();
        }
      }
    } catch (e) {
      console.warn("⚠️ Failed to revert payroll withdrawn flags on rejection:", e.message);
    }

    // 🔄 Notify user
    if (global.io) {
      global.io.emit("withdrawalRejected", { 
        withdrawalId: withdrawal._id,
        userId: withdrawal.userId._id,
        reason: withdrawal.rejectionReason
      });
    }

    res.json({
      success: true,
      message: "❌ Withdrawal rejected",
      withdrawal,
    });
  } catch (err) {
    console.error("❌ Error rejecting withdrawal:", err);
    res.status(500).json({ message: "Failed to reject withdrawal" });
  }
});

/* ========================================================
   📋 ADMIN: Get Pending Withdrawal Requests
======================================================== */
router.get("/withdrawals/pending", async (req, res) => {
  try {
    const pending = await Withdrawal.find({ status: "pending" })
      .populate("userId", "username name role")
      .sort({ createdAt: -1 })
      .lean();

    res.json({ success: true, withdrawals: pending, count: pending.length });
  } catch (err) {
    console.error("❌ Error fetching pending withdrawals:", err);
    res.status(500).json({ message: "Failed to fetch pending withdrawals" });
  }
});

/* ========================================================
   💰 SYNC TELLER REPORTS TO PAYROLL (accumulate over/short)
======================================================== */
router.post("/sync-teller-reports", async (req, res) => {
  try {
    const { userId, startDate, endDate } = req.body;

    if (!userId) {
      return res.status(400).json({ message: "userId is required" });
    }

    // Default to current month if no dates provided
    const start = startDate ? new Date(startDate) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const end = endDate ? new Date(endDate) : new Date();

    // Find all teller reports for this user in the date range
    const reports = await TellerReport.find({
      tellerId: userId,
      date: { $gte: start, $lte: end }
    }).lean();

    // Calculate totals
    const totalOver = reports.reduce((sum, r) => sum + (Number(r.over) || 0), 0);
    const totalShort = reports.reduce((sum, r) => sum + (Number(r.short) || 0), 0);

    // Find or create payroll for this user for this period
    let payroll = await Payroll.findOne({
      user: userId,
      createdAt: { $gte: start, $lte: end }
    });

    // Always read current user to keep baseSalary in sync
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Calculate accumulated base salary (daily base × days worked)
    const daysWorked = reports.length;
    const accumulatedBase = daysWorked * (user.baseSalary || 0);

    if (!payroll) {
      // Create new payroll entry
      payroll = new Payroll({
        user: userId,
        role: user.role,
        baseSalary: accumulatedBase,
        over: totalOver,
        short: totalShort,
        deduction: 0,
        withdrawal: 0,
        daysPresent: daysWorked,
      });
    } else {
      // Update existing payroll (keep baseSalary up-to-date)
      payroll.over = totalOver;
      payroll.short = totalShort;
      payroll.baseSalary = accumulatedBase;
      payroll.daysPresent = daysWorked;
      if (!payroll.role && user.role) payroll.role = user.role;
    }

    // Calculate total salary: base - deduction - withdrawal
    // Short/Over amounts are tracked separately for financial reporting only
    payroll.totalSalary = (payroll.baseSalary || 0) -
                          (payroll.deduction || 0) -
                          (payroll.withdrawal || 0);

    await payroll.save();

    // Emit real-time update
    if (global.io) {
      global.io.emit("payrollUpdated", { userId, payrollId: payroll._id });
    }

    res.json({
      success: true,
      message: "✅ Payroll synced with teller reports",
      payroll,
      reportsProcessed: reports.length,
      totalOver,
      totalShort
    });

  } catch (err) {
    console.error("❌ Error syncing teller reports to payroll:", err);
    res.status(500).json({ message: "Failed to sync teller reports" });
  }
});

/* ========================================================
   � ADMIN: SYNC ALL TELLERS THIS MONTH (refresh base + totals)
   Useful if some payrolls were created with baseSalary=0 earlier.
======================================================== */
router.post("/sync-month-all", async (req, res) => {
  try {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const users = await User.find({ role: { $in: ["teller", "supervisor", "supervisor_teller"] } }).lean();
    let processed = 0;
    let errors = 0;

    for (const u of users) {
      try {
        // Sum reports for tellers and supervisor_tellers; supervisors don't accumulate over/short
        let totalOver = 0;
        let totalShort = 0;
        let daysWorked = 0;
        
        if (u.role === "teller" || u.role === "supervisor_teller") {
          const reports = await TellerReport.find({
            tellerId: u._id,
            date: { $gte: start, $lte: end },
          }).lean();
          totalOver = reports.reduce((sum, r) => sum + (Number(r.over) || 0), 0);
          totalShort = reports.reduce((sum, r) => sum + (Number(r.short) || 0), 0);
          daysWorked = reports.length;
        }

        // Calculate accumulated base salary (daily base × days worked)
        // For supervisor_teller with reports: use teller base salary
        let dailyBase = Number(u.baseSalary || 0);
        if (u.role === "supervisor_teller" && daysWorked > 0) {
          // When supervisor_teller has teller reports, they should earn teller base
          const settings = await SystemSettings.findOne().lean();
          dailyBase = settings?.baseSalary?.teller || 450;
        }
        const accumulatedBase = daysWorked * dailyBase;

        let payroll = await Payroll.findOne({ user: u._id, createdAt: { $gte: start, $lte: end } });
        if (!payroll) {
          payroll = new Payroll({
            user: u._id,
            role: u.role,
            baseSalary: accumulatedBase,
            over: totalOver,
            short: totalShort,
            deduction: 0,
            withdrawal: 0,
            daysPresent: daysWorked,
          });
        } else {
          payroll.over = totalOver;
          payroll.short = totalShort;
          payroll.baseSalary = accumulatedBase;
          payroll.daysPresent = daysWorked;
          if (!payroll.role && u.role) payroll.role = u.role;
        }

        // Calculate total salary: base - deduction - withdrawal
        // Short/Over amounts are tracked separately for financial reporting only
        payroll.totalSalary = (payroll.baseSalary || 0) -
                              (payroll.deduction || 0) -
                              (payroll.withdrawal || 0);
        await payroll.save();
        processed += 1;

        if (global.io) {
          global.io.emit("payrollUpdated", { userId: u._id, payrollId: payroll._id });
        }
      } catch (e) {
        console.warn("⚠️ Sync failed for user", u._id, e?.message);
        errors += 1;
      }
    }

    res.json({ success: true, processed, errors });
  } catch (err) {
    console.error("❌ sync-month-all error:", err);
    res.status(500).json({ message: "Failed to sync all payrolls" });
  }
});

/* ========================================================
   ⏪ SYNC YESTERDAY'S CAPITAL → PAYROLL BASES
   - Ensures tellers and their supervisors who had capital added yesterday
     have a payroll entry this month with correct baseSalary.
======================================================== */
router.post("/sync-yesterday-capital", async (req, res) => {
  try {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    // Compute yesterday (Asia/Manila friendly approximation using system tz)
    const yesterdayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 0, 0, 0);
    const yesterdayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 23, 59, 59);

    // Find capital records created yesterday
    const caps = await Capital.find({
      createdAt: { $gte: yesterdayStart, $lte: yesterdayEnd },
    }).lean();

    if (!caps || caps.length === 0) {
      return res.json({ success: true, processed: 0, message: "No capital records from yesterday" });
    }

    let processed = 0;
    let errors = 0;

    for (const c of caps) {
      try {
        // TELLER payroll ensure
        const teller = await User.findById(c.tellerId).lean();
        if (teller) {
          let p = await Payroll.findOne({ user: teller._id, createdAt: { $gte: monthStart, $lte: monthEnd } });
          if (!p) {
            p = new Payroll({
              user: teller._id,
              role: teller.role,
              baseSalary: teller.baseSalary || 0,
              over: 0,
              short: 0,
              deduction: 0,
              withdrawal: 0,
            });
          } else {
            // Keep base synchronized
            if ((p.baseSalary || 0) !== (teller.baseSalary || 0)) p.baseSalary = teller.baseSalary || 0;
            if (!p.role && teller.role) p.role = teller.role;
          }
          // Calculate total salary: base - deduction - withdrawal
          // Short/Over amounts are tracked separately for financial reporting only
          p.totalSalary = (p.baseSalary || 0) - (p.deduction || 0) - (p.withdrawal || 0);
          await p.save();
          processed++;
          if (global.io) global.io.emit("payrollUpdated", { userId: teller._id, payrollId: p._id });
        }

        // SUPERVISOR payroll ensure
        const supervisor = await User.findById(c.supervisorId).lean();
        if (supervisor && supervisor.role === "supervisor") {
          let sp = await Payroll.findOne({ user: supervisor._id, createdAt: { $gte: monthStart, $lte: monthEnd } });
          if (!sp) {
            sp = new Payroll({
              user: supervisor._id,
              role: supervisor.role,
              baseSalary: supervisor.baseSalary || 0,
              over: 0,
              short: 0,
              deduction: 0,
              withdrawal: 0,
            });
          } else {
            if ((sp.baseSalary || 0) !== (supervisor.baseSalary || 0)) sp.baseSalary = supervisor.baseSalary || 0;
            if (!sp.role) sp.role = supervisor.role;
            // supervisors: ensure no over/short counted here
            sp.over = 0;
            sp.short = 0;
          }
          sp.totalSalary = (sp.baseSalary || 0) - (sp.deduction || 0) - (sp.withdrawal || 0);
          await sp.save();
          processed++;
          if (global.io) global.io.emit("payrollUpdated", { userId: supervisor._id, payrollId: sp._id });
        }
      } catch (e) {
        console.warn("⚠️ sync-yesterday-capital error for cap", c?._id, e?.message || e);
        errors++;
      }
    }

    res.json({ success: true, processed, errors });
  } catch (err) {
    console.error("❌ sync-yesterday-capital failed:", err);
    res.status(500).json({ message: "Failed to sync yesterday capital" });
  }
});

/* ========================================================
   �🧾 PAYROLL ADMIN MANAGEMENT
======================================================== */
router.put("/:id/approve", async (req, res) => {
  try {
    const { id } = req.params;
    const { adminId } = req.body;

    const payroll = await Payroll.findById(id);
    if (!payroll) return res.status(404).json({ message: "Payroll not found" });

    payroll.approved = true;
    payroll.approvedAt = new Date();
    await payroll.save();

    if (global.io) global.io.emit("payrollApproved", { payrollId: id, adminId });

    res.json({ success: true, message: "✅ Payroll approved", payroll });
  } catch (err) {
    console.error("❌ Approve error:", err);
    res.status(500).json({ message: "Failed to approve payroll" });
  }
});

router.put("/:id/disapprove", async (req, res) => {
  try {
    const { id } = req.params;
    const { adminId } = req.body;

    const payroll = await Payroll.findById(id);
    if (!payroll) return res.status(404).json({ message: "Payroll not found" });

    // Check if payroll is locked
    if (payroll.locked) {
      return res.status(400).json({ message: "Cannot disapprove locked payroll. Unlock it first." });
    }

    payroll.approved = false;
    payroll.approvedAt = null;
    await payroll.save();

    if (global.io) global.io.emit("payrollDisapproved", { payrollId: id, adminId });

    res.json({ success: true, message: "✅ Payroll set to pending", payroll });
  } catch (err) {
    console.error("❌ Disapprove error:", err);
    res.status(500).json({ message: "Failed to disapprove payroll" });
  }
});

router.put("/:id/adjust", async (req, res) => {
  try {
    const { id } = req.params;
    const { delta = 0, baseSalary = null, reason = "", adminId = null, overrideDate = null, shortPaymentTerms = null } = req.body;

    const payroll = await Payroll.findById(id);
    if (!payroll) return res.status(404).json({ message: "Payroll not found" });

    // If overrideDate is provided and different from current date, update the payroll date
    if (overrideDate) {
      const newDate = new Date(overrideDate);
      // Set time to match original payroll time to preserve timezone consistency
      const originalTime = new Date(payroll.createdAt);
      newDate.setHours(originalTime.getHours(), originalTime.getMinutes(), originalTime.getSeconds());
      payroll.createdAt = newDate;
      
      // Also update the date field if it exists
      if (payroll.date) {
        payroll.date = newDate;
      }
    }

    // If shortPaymentTerms is provided, update it
    if (shortPaymentTerms !== null && !isNaN(shortPaymentTerms)) {
      payroll.shortPaymentTerms = Number(shortPaymentTerms);
    }

    // If baseSalary is provided, update it and recalculate totalSalary
    if (baseSalary !== null && !isNaN(baseSalary)) {
      const oldBaseSalary = payroll.baseSalary || 0;
      const newBaseSalary = Number(baseSalary);
      payroll.baseSalary = newBaseSalary;
      
      // Recalculate totalSalary with shortPaymentTerms consideration
      const over = payroll.over || 0;
      const short = payroll.short || 0;
      const deduction = payroll.deduction || 0;
      const terms = payroll.shortPaymentTerms || 1;
      const weeklyShortDeduction = short / terms;
      // For adjustment with payment terms: include over and weekly short deduction
      payroll.totalSalary = newBaseSalary + over - weeklyShortDeduction - deduction;
      
      // Add adjustment note about base salary change
      if (oldBaseSalary !== newBaseSalary) {
        payroll.adjustments.push({
          delta: newBaseSalary - oldBaseSalary,
          reason: `Base salary changed from ₱${oldBaseSalary} to ₱${newBaseSalary}. ${reason}`,
          adminId,
        });
      }
    } else if (shortPaymentTerms !== null) {
      // If only shortPaymentTerms changed, recalculate totalSalary
      const baseSal = payroll.baseSalary || 0;
      const over = payroll.over || 0;
      const short = payroll.short || 0;
      const deduction = payroll.deduction || 0;
      const terms = payroll.shortPaymentTerms || 1;
      const weeklyShortDeduction = short / terms;
      const newTotal = baseSal + over - weeklyShortDeduction - deduction;
      
      console.log(`📊 Recalculating totalSalary for payroll ${id}:`);
      console.log(`   Base: ₱${baseSal}, Over: ₱${over}, Short: ₱${short}, Deduction: ₱${deduction}`);
      console.log(`   Terms: ${terms} weeks, Weekly Short: ₱${weeklyShortDeduction.toFixed(2)}`);
      console.log(`   Old Total: ₱${payroll.totalSalary}, New Total: ₱${newTotal.toFixed(2)}`);
      
      payroll.totalSalary = newTotal;
      
      // Add note about payment terms adjustment
      if (reason) {
        payroll.adjustments.push({
          delta: 0,
          reason: `Payment terms changed to ${terms} weeks. ${reason}`,
          adminId,
        });
      }
    }

    // Apply delta adjustment
    if (delta !== 0) {
      payroll.totalSalary = (payroll.totalSalary || 0) + Number(delta);
      payroll.adjustments.push({
        delta: Number(delta),
        reason,
        adminId,
      });
    }

    await payroll.save();

    if (global.io) global.io.emit("payrollAdjusted", { payrollId: id });

    res.json({ success: true, message: "✅ Payroll adjusted", payroll });
  } catch (err) {
    console.error("❌ Adjustment error:", err);
    res.status(500).json({ message: "Failed to adjust payroll" });
  }
});

/**
 * POST /api/payroll/create-override
 * Super admin creates a new payroll entry with custom values
 */
router.post("/create-override", async (req, res) => {
  try {
    const { userId, date, baseSalary, over = 0, short = 0, shortPaymentTerms = 1, reason, role, adminId } = req.body;

    if (!userId || !date || !baseSalary || !reason) {
      return res.status(400).json({ message: "Missing required fields: userId, date, baseSalary, reason" });
    }

    // Check if payroll already exists for this user on this date
    const existingPayroll = await Payroll.findOne({
      user: userId,
      createdAt: {
        $gte: new Date(new Date(date).setHours(0, 0, 0, 0)),
        $lt: new Date(new Date(date).setHours(23, 59, 59, 999))
      }
    });

    if (existingPayroll) {
      return res.status(400).json({ 
        message: "A payroll entry already exists for this user on this date. Please use the adjust feature instead." 
      });
    }

    // For admin override: include over/short in calculation since admin explicitly sets these values
    const totalSalary = Number(baseSalary) + Number(over) - Number(short);

    const newPayroll = new Payroll({
      user: userId,
      role: role || 'teller',
      baseSalary: Number(baseSalary),
      over: Number(over),
      short: Number(short),
      shortPaymentTerms: Number(shortPaymentTerms) || 1,
      totalSalary: totalSalary,
      deduction: 0,
      daysPresent: 1,
      approved: false,
      createdAt: new Date(date),
      adjustments: [{
        delta: 0,
        reason: `[CREATED BY OVERRIDE] ${reason}`,
        adminId: adminId,
        createdAt: new Date()
      }]
    });

    await newPayroll.save();

    if (global.io) global.io.emit("payrollAdjusted", { payrollId: newPayroll._id });

    res.json({ success: true, message: "✅ Payroll override created", payroll: newPayroll });
  } catch (err) {
    console.error("❌ Create override error:", err);
    res.status(500).json({ message: "Failed to create payroll override" });
  }
});

/* ========================================================
   🔐 SUPER ADMIN: Withdraw ALL payroll overrides (one-shot)
   - If userId is provided: withdraw only overrides for that user.
   - Otherwise: find ALL payrolls that were created via override and are not withdrawn,
     create per-user withdrawal records and mark payrolls withdrawn (approved by super_admin).
   - Only role: super_admin
======================================================== */
router.post(
  "/withdraw-all-overrides",
  requireAuth,
  requireRole(["super_admin"]),
  async (req, res) => {
    try {
      const { userId = null, weekRange = null } = req.body;
      const matchBase = { withdrawn: false, "adjustments.reason": /CREATED BY OVERRIDE/i };
      if (userId) matchBase.user = userId;

      let payrolls = await Payroll.find(matchBase).lean();

      // Safety filters: skip admin/super_admin payrolls and payrolls with non-positive totals
      payrolls = payrolls.filter((p) => p.role !== "admin" && p.role !== "super_admin" && (p.totalSalary || 0) > 0);

      // Safety cap to avoid accidental mass operations
      const MAX_BATCH = Number(process.env.MAX_WITHDRAW_BATCH || 500);
      if (payrolls.length > MAX_BATCH) {
        return res.status(400).json({ success: false, message: `Too many payrolls to withdraw at once (${payrolls.length}). Use a smaller scope or set MAX_WITHDRAW_BATCH.` });
      }

      if (!payrolls || payrolls.length === 0)
        return res.json({ success: true, message: "No override payrolls found to withdraw", count: 0 });

      // Group payrolls by user to create per-user withdrawals
      const byUser = payrolls.reduce((acc, p) => {
        const uid = String(p.user);
        if (!acc[uid]) acc[uid] = [];
        acc[uid].push(p);
        return acc;
      }, {});

      const createdWithdrawals = [];

      for (const [uid, pList] of Object.entries(byUser)) {
        const payrollIds = pList.map((p) => p._id);
        const total = pList.reduce((s, pp) => s + (pp.totalSalary || 0), 0);

        // Build Withdrawal doc in APPROVED state since a super_admin is performing this
        const withdrawal = new Withdrawal({
          userId: uid,
          payrollIds,
          amount: total,
          remaining: 0,
          weekRange,
          createdBy: req.user ? req.user._id : null,
          status: "approved",
          approvedBy: req.user ? req.user._id : null,
          approvedAt: new Date(),
        });

        await withdrawal.save();

        // Mark payrolls as withdrawn and attach the withdrawal amount
        await Payroll.updateMany(
          { _id: { $in: payrollIds } },
          { $set: { withdrawn: true, withdrawnAt: new Date(), withdrawal: total } }
        );

        // Notify in real-time if socket exists
        if (global.io) global.io.emit("withdrawalApproved", { withdrawalId: withdrawal._id, userId: uid, amount: withdrawal.amount });

        createdWithdrawals.push({ withdrawalId: withdrawal._id, userId: uid, amount: total, payrollCount: payrollIds.length });
      }

      res.json({ success: true, message: `✅ Withdrawn ${payrolls.length} override payroll(s)`, withdrawals: createdWithdrawals });
    } catch (err) {
      console.error("❌ withdraw-all-overrides error:", err);
      res.status(500).json({ message: "Failed to withdraw override payrolls" });
    }
  }
);

/**
 * GET /api/payroll/unapproved
 */
router.get("/unapproved", async (req, res) => {
  try {
    const unapproved = await Payroll.find({ approved: false })
      .populate("user", "username name role")
      .sort({ createdAt: -1 })
      .lean();

    res.json({ success: true, unapproved });
  } catch (err) {
    console.error("❌ Fetch unapproved error:", err);
    res.status(500).json({ message: "Failed to fetch unapproved payrolls" });
  }
});

/* ========================================================
   ✅ STABLE: Get single payroll by ID (SidebarLayout.jsx)
======================================================== */
router.get("/:id", async (req, res) => {
  try {
    const payrollId = req.params.id;
    console.log("📥 Fetching payroll by ID:", payrollId);

    if (!payrollId || payrollId.length < 10) {
      return res.status(400).json({ message: "Invalid payroll ID format" });
    }

    const payroll = await Payroll.findById(payrollId)
      .populate("user", "username name role status")
      .lean();

    if (!payroll) {
      console.warn("⚠️ Payroll not found for ID:", payrollId);
      return res.status(404).json({ message: "Payroll not found" });
    }

    res.json({ success: true, payroll });
  } catch (err) {
    console.error("❌ Error fetching payroll by ID:", err);
    res.status(500).json({ message: "Failed to fetch payroll", error: err.message });
  }
});

/* ========================================================
   🗑️ DELETE: Delete a payroll record (Super Admin only)
======================================================== */
router.delete("/:id", async (req, res) => {
  try {
    const payrollId = req.params.id;
    console.log("🗑️ Deleting payroll ID:", payrollId);

    if (!payrollId || payrollId.length < 10) {
      return res.status(400).json({ message: "Invalid payroll ID format" });
    }

    const payroll = await Payroll.findById(payrollId);

    if (!payroll) {
      console.warn("⚠️ Payroll not found for deletion:", payrollId);
      return res.status(404).json({ message: "Payroll not found" });
    }

    // Optional: Check if payroll is locked
    if (payroll.locked) {
      return res.status(400).json({ message: "Cannot delete locked payroll. Unlock it first." });
    }

    await Payroll.findByIdAndDelete(payrollId);
    console.log("✅ Payroll deleted successfully:", payrollId);

    res.json({ success: true, message: "Payroll deleted successfully" });
  } catch (err) {
    console.error("❌ Error deleting payroll:", err);
    res.status(500).json({ message: "Failed to delete payroll", error: err.message });
  }
});

export default router;
