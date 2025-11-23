// backend/routes/schedule.js
import express from "express";
import { DateTime } from "luxon";
import DailyTellerAssignment from "../models/DailyTellerAssignment.js";
import TellerReport from "../models/TellerReport.js";
import User from "../models/User.js";
import DailyAttendance from "../models/DailyAttendance.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = express.Router();

/**
 * 🧭 Utility: Format date as yyyy-MM-dd (Asia/Manila timezone)
 */
const formatDate = (offsetDays = 0) => {
  return DateTime.now().setZone("Asia/Manila").plus({ days: offsetDays }).toFormat("yyyy-MM-dd");
};

/**
 * ✅ GET /api/schedule/today
 * Fetch today's teller schedule
 */
router.get("/today", requireAuth, async (req, res) => {
  try {
    const today = formatDate(0);
    console.log("📅 Fetching schedule for today:", today);

    const sched = await DailyTellerAssignment.find({ dayKey: today }).lean();

    res.json({ success: true, date: today, schedule: sched || [] });
  } catch (err) {
    console.error("❌ Failed to fetch today’s schedule:", err);
    res.status(500).json({ message: "Failed to fetch today’s schedule" });
  }
});

/**
 * ✅ GET /api/schedule/tomorrow
 * Fetch or auto-generate tomorrow's schedule
 */
router.get("/tomorrow", requireAuth, async (req, res) => {
  try {
    const tomorrow = formatDate(1);
    console.log("📅 Fetching or generating schedule for:", tomorrow);

    if (!DailyTellerAssignment || !User) {
      console.error("❌ Missing model import in schedule.js");
      return res.status(500).json({ message: "Model import error" });
    }

    let assignments = await DailyTellerAssignment.find({ dayKey: tomorrow }).lean();

    // Auto-generate schedule if none found
    if (!assignments.length) {
      console.log("ℹ️ No assignments found. Generating new schedule for:", tomorrow);

      // Fetch approved tellers (include supervisor_teller acting as teller) 
      // Exclude those with active penalties (skipUntil >= tomorrow)
      const tellers = await User.find({ 
        role: { $in: ["teller", "supervisor_teller"] }, 
        status: "approved",
        $or: [
          { skipUntil: null },
          { skipUntil: { $lt: tomorrow } }
        ]
      })
        .populate("supervisorId", "name role")
        .sort({ lastWorked: 1, totalWorkDays: 1 }) // Prioritize least worked
        .lean();

      if (!tellers.length) {
        console.warn("⚠️ No approved tellers found — cannot generate schedule");
        return res.json({
          success: true,
          date: tomorrow,
          schedule: [],
          message: "No tellers available",
        });
      }

      // Fetch all approved supervisors - REMOVED SUPERVISOR ASSIGNMENT
      // Supervisor assignment should not be part of schedule rotation
      // let supervisors = await User.find({ role: { $in: ["supervisor", "supervisor_teller"] }, status: "approved" })
      //   .select("_id name username role")
      //   .lean();

      // if (!supervisors.length) {
      //   // Fallback to any admin if no supervisors
      //   const admin = await User.findOne({ role: "admin" }).select("_id name username role").lean();
      //   if (admin) supervisors = [admin];
      // }

      // if (!supervisors.length) {
      //   console.warn("⚠️ No supervisors/admin available — assignments will be created without supervisor linkage");
      // }

      // Fair rotation scheduling - prioritize least worked tellers
      let supIndex = 0;
      const MAX_TELLERS = 3; // adjustable limit for daily active tellers
      const selected = tellers.slice(0, MAX_TELLERS);

      const newDocs = [];
      for (const teller of selected) {
        try {
          // Create assignment for selected teller (removed restrictive activeCapital/supervisorId requirement)
          let supervisorName = "";
          // Try to get supervisor name if supervisorId exists
          if (teller.supervisorId) {
            const supervisor = await User.findById(teller.supervisorId).select("name username");
            if (supervisor) {
              supervisorName = supervisor.name || supervisor.username || "";
            }
          }
          
          const doc = {
            dayKey: tomorrow,
            tellerId: teller._id,
            tellerName: teller.name || teller.username,
            supervisorId: teller.supervisorId || null,
            supervisorName,
            status: "scheduled",
          };
          newDocs.push(doc);
          
          // Update teller's work history (only increment when actually assigned, not when scheduled)
          // We'll increment totalWorkDays when they mark present, not when scheduled
          await User.findByIdAndUpdate(teller._id, { 
            lastWorked: tomorrow
            // Removed: $inc: { totalWorkDays: 1 } - this should only happen on completion
          });
        } catch (err) {
          console.error("⚠️ Failed to prepare assignment for teller:", teller.name || teller.username, err.message);
        }
      }

      if (newDocs.length) {
        await DailyTellerAssignment.insertMany(newDocs);
      }

      assignments = await DailyTellerAssignment.find({ dayKey: tomorrow }).lean();
    }

    // Populate teller information including total work days
    const populatedAssignments = await Promise.all(
      assignments.map(async (assignment) => {
        const teller = await User.findById(assignment.tellerId).select('totalWorkDays name username').lean();
        return {
          ...assignment,
          totalWorkDays: teller?.totalWorkDays || 0
        };
      })
    );

    res.json({ success: true, date: tomorrow, schedule: populatedAssignments });
  } catch (err) {
    console.error("❌ Error fetching/generating tomorrow schedule:", err);
    res.status(500).json({
      message: "Failed to fetch or generate tomorrow schedule",
      error: err.message,
    });
  }
});

/**
 * 🧹 DELETE /api/schedule/tomorrow
 * Clears tomorrow's assignments so they can be regenerated
 */
router.delete("/tomorrow", async (req, res) => {
  try {
    const tomorrow = formatDate(1);
    const result = await DailyTellerAssignment.deleteMany({ dayKey: tomorrow });
    res.json({ success: true, message: "Tomorrow's schedule cleared", deleted: result.deletedCount, day: tomorrow });
  } catch (err) {
    console.error("❌ Failed to clear tomorrow schedule:", err);
    res.status(500).json({ message: "Failed to clear tomorrow schedule" });
  }
});

/**
 * 🔄 POST /api/schedule/recalculate-work-days-reports
 * Recalculates totalWorkDays for all tellers based on submitted reports
 */
router.post("/recalculate-work-days-reports", requireAuth, requireRole(['admin', 'super_admin']), async (req, res) => {
  try {
    console.log("🔄 Recalculating total work days for all tellers based on submitted reports...");

    // Get all tellers and supervisor_tellers
    const tellers = await User.find({
      role: { $in: ['teller', 'supervisor_teller'] }
    });

    let updatedCount = 0;
    for (const teller of tellers) {
      // Count unique days with submitted reports
      const reportDays = await TellerReport.distinct('createdAt', {
        tellerId: teller._id,
        // Only count reports from this year to avoid old data
        createdAt: { $gte: new Date('2025-01-01') }
      });

      const totalWorkDays = reportDays.length;

      if (teller.totalWorkDays !== totalWorkDays) {
        await User.findByIdAndUpdate(teller._id, { totalWorkDays });
        updatedCount++;
      }
    }

    res.json({
      success: true,
      message: `Recalculated work days for ${updatedCount} tellers based on submitted reports`,
      updatedCount
    });

  } catch (err) {
    console.error("❌ Failed to recalculate work days from reports:", err);
    res.status(500).json({ message: "Failed to recalculate work days from reports" });
  }
});

/**
 * 🤖 POST /api/schedule/ai-generate
 * Generate AI-powered schedule based on attendance data
 */
router.post("/ai-generate", requireAuth, requireRole(['admin', 'super_admin']), async (req, res) => {
  try {
    const { date, requiredCount = 3, forceRegenerate = false } = req.body;
    const targetDate = date || formatDate(1); // Default to tomorrow
    
    console.log(`🤖 AI Schedule Generation requested for ${targetDate}, requiring ${requiredCount} tellers`);

    // Check if schedule already exists
    const existingSchedule = await DailyTellerAssignment.find({ dayKey: targetDate });
    if (existingSchedule.length && !forceRegenerate) {
      return res.json({
        success: false,
        message: `Schedule for ${targetDate} already exists. Use forceRegenerate=true to override.`,
        existingSchedule
      });
    }

    // Get today's attendance to see who's available
    const todayAttendance = await DailyAttendance.findOne({ 
      date: formatDate(0) 
    });

    if (!todayAttendance || !todayAttendance.presentTellers.length) {
      // Fallback to traditional scheduling if no attendance data
      console.log("⚠️ No attendance data found, falling back to traditional rotation");
      
      const tellers = await User.find({ 
        role: { $in: ["teller", "supervisor_teller"] }, 
        status: "approved",
        $or: [
          { skipUntil: null },
          { skipUntil: { $lt: targetDate } }
        ]
      }).sort({ lastWorked: 1, totalWorkDays: 1 }).limit(requiredCount);

      const assignments = tellers.map(teller => ({
        dayKey: targetDate,
        tellerId: teller._id,
        tellerName: teller.name || teller.username,
        status: "pending",
        assignmentMethod: "traditional_rotation",
        aiScore: 0
      }));

      // Clear existing and insert new
      if (forceRegenerate) {
        await DailyTellerAssignment.deleteMany({ dayKey: targetDate });
      }
      await DailyTellerAssignment.insertMany(assignments);

      return res.json({
        success: true,
        message: `Traditional schedule generated for ${targetDate}`,
        schedule: assignments,
        method: "traditional_rotation"
      });
    }

    // AI-powered scheduling using attendance data
    const presentTellerIds = todayAttendance.presentTellers.map(t => t.userId.toString());
    
    // Get assignment history for fairness calculation (last 30 days)
    const assignmentHistory = await DailyTellerAssignment.find({
      dayKey: { $gte: formatDate(-30) }
    }).sort({ dayKey: -1 });

    // Calculate AI scores for each present teller
    const tellerScores = {};
    
    for (const presentTeller of todayAttendance.presentTellers) {
      const tellerId = presentTeller.userId.toString();
      const tellerData = await User.findById(tellerId);
      
      if (!tellerData || tellerData.status !== 'approved') continue;

      // Base score starts at 100
      let aiScore = 100;
      
      // Factor 1: Recent assignment frequency (lower assignments = higher score)
      const recentAssignments = assignmentHistory.filter(a => a.tellerId.toString() === tellerId).length;
      aiScore += Math.max(0, (10 - recentAssignments) * 5); // Up to +50 for fewer assignments
      
      // Factor 2: Days since last assignment (longer = higher score)
      const lastAssignment = assignmentHistory.find(a => a.tellerId.toString() === tellerId);
      if (lastAssignment) {
        const daysSinceLastAssignment = DateTime.fromISO(targetDate).diff(
          DateTime.fromISO(lastAssignment.dayKey), 'days'
        ).days;
        aiScore += Math.min(daysSinceLastAssignment * 3, 30); // Up to +30 for 10+ days
      } else {
        aiScore += 50; // Never assigned before
      }
      
      // Factor 3: Total work history balance
      const totalAssignments = tellerData.totalWorkDays || 0;
      const avgAssignments = assignmentHistory.length / presentTellerIds.length;
      if (totalAssignments < avgAssignments) {
        aiScore += 20; // Boost for under-worked tellers
      }
      
      // Factor 4: Attendance consistency bonus
      // TODO: Could add attendance history analysis here
      
      tellerScores[tellerId] = {
        userId: tellerId,
        username: presentTeller.username,
        name: presentTeller.name,
        aiScore: Math.round(aiScore),
        recentAssignments,
        totalAssignments,
        lastAssigned: lastAssignment?.dayKey || 'never'
      };
    }

    // Sort by AI score (highest first) and select top candidates
    const rankedTellers = Object.values(tellerScores)
      .sort((a, b) => b.aiScore - a.aiScore)
      .slice(0, Math.min(requiredCount, presentTellerIds.length));

    // Create schedule assignments
    const aiAssignments = rankedTellers.map((teller, index) => ({
      dayKey: targetDate,
      tellerId: teller.userId,
      tellerName: teller.name,
      status: "pending",
      assignmentMethod: "ai_attendance_based",
      aiScore: teller.aiScore,
      rank: index + 1,
      reason: `Score: ${teller.aiScore} (Recent: ${teller.recentAssignments}, Last: ${teller.lastAssigned})`
    }));

    // Clear existing and insert new AI-generated schedule
    if (forceRegenerate) {
      await DailyTellerAssignment.deleteMany({ dayKey: targetDate });
    }
    await DailyTellerAssignment.insertMany(aiAssignments);

    // Update work history for selected tellers (only set lastWorked, don't increment totalWorkDays yet)
    for (const assignment of aiAssignments) {
      await User.findByIdAndUpdate(assignment.tellerId, {
        lastWorked: targetDate
        // Removed: $inc: { totalWorkDays: 1 } - this should only happen when they mark present
      });
    }

    console.log(`🤖 AI Schedule generated for ${targetDate}:`, {
      selected: aiAssignments.length,
      available: presentTellerIds.length,
      method: 'ai_attendance_based'
    });

    res.json({
      success: true,
      message: `AI-powered schedule generated for ${targetDate}`,
      schedule: aiAssignments,
      method: "ai_attendance_based",
      attendanceData: {
        totalPresent: presentTellerIds.length,
        attendanceDate: formatDate(0),
        attendanceRate: todayAttendance.attendanceRate
      },
      alternatives: Object.values(tellerScores).slice(requiredCount) // Show other candidates
    });
    
  } catch (err) {
    console.error("❌ AI schedule generation failed:", err);
    res.status(500).json({ 
      message: "Failed to generate AI schedule", 
      error: err.message 
    });
  }
});

/**
 * ✅ GET /api/schedule/history
 * Returns past 7 days of teller assignments
 */
router.get("/history", async (req, res) => {
  try {
    const start = DateTime.now().setZone("Asia/Manila").minus({ days: 7 });
    const sched = await DailyTellerAssignment.find({
      dayKey: { $gte: start.toFormat("yyyy-MM-dd") },
    })
      .sort({ dayKey: -1 })
      .lean();

    res.json({ success: true, history: sched || [] });
  } catch (err) {
    console.error("❌ Failed to get schedule history:", err);
    res.status(500).json({ message: "Failed to get schedule history" });
  }
});

/**
 * ✅ POST /api/schedule/mark-present
 * Marks a teller as present and updates work history
 */
router.post("/mark-present", requireAuth, requireRole(['supervisor', 'admin', 'super_admin']), async (req, res) => {
  try {
    const { tellerId, tellerName, dayKey } = req.body;

    await DailyTellerAssignment.updateOne(
      { tellerId, dayKey },
      { $set: { status: "present" } },
      { upsert: true }
    );

    // Update work history
    await User.findByIdAndUpdate(tellerId, {
      $set: { lastWorked: dayKey },
      $inc: { totalWorkDays: 1 }
    });

    // 🔄 Real-time update for all clients
    if (global.io) {
      global.io.emit("scheduleUpdated", {
        tellerId,
        tellerName,
        status: "present",
        dayKey,
      });
    }

    res.json({ success: true, message: `${tellerName} marked as present` });
  } catch (err) {
    console.error("❌ Mark Present error:", err);
    res.status(500).json({ message: "Failed to mark present" });
  }
});

/**
 * ✅ POST /api/schedule/mark-absent
 * Marks a teller as absent with reason and penalty
 */
router.post("/mark-absent", requireAuth, requireRole(['supervisor', 'admin', 'super_admin']), async (req, res) => {
  try {
    const { tellerId, tellerName, dayKey, reason, penaltyDays } = req.body;

    // Update assignment with absent status and reason
    await DailyTellerAssignment.updateOne(
      { tellerId, dayKey },
      { 
        $set: { 
          status: "absent",
          absentReason: reason || "No reason provided",
          penaltyDays: penaltyDays || 0
        } 
      },
      { upsert: true }
    );

    // Apply penalty: set skipUntil date on the teller
    if (penaltyDays && penaltyDays > 0) {
      const skipUntilDate = DateTime.now()
        .setZone("Asia/Manila")
        .plus({ days: penaltyDays })
        .toFormat("yyyy-MM-dd");
      
      await User.findByIdAndUpdate(tellerId, {
        $set: { 
          skipUntil: skipUntilDate,
          lastAbsentReason: reason || "No reason provided"
        }
      });
      
      console.log(`⏭️ Teller ${tellerName} will skip work until ${skipUntilDate} (penalty: ${penaltyDays} days)`);
    }

    if (global.io) {
      global.io.emit("scheduleUpdated", {
        tellerId,
        tellerName,
        status: "absent",
        dayKey,
        reason,
        penaltyDays
      });
    }

    res.json({ 
      success: true, 
      message: `Marked ${tellerName} as absent${penaltyDays > 0 ? ` with ${penaltyDays} day penalty` : ''}` 
    });
  } catch (err) {
    console.error("❌ Mark Absent error:", err);
    res.status(500).json({ message: "Failed to mark absent" });
  }
});

/**
 * ✅ Debug route for quick testing
 */
router.get("/debug-test", async (req, res) => {
  try {
    const count = await User.countDocuments({ role: "teller" });
    res.json({ ok: true, tellers: count });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ✅ Mark a teller as present by ID
router.put("/mark-present/:assignmentId", requireAuth, requireRole(['supervisor', 'admin', 'super_admin']), async (req, res) => {
  try {
    const { assignmentId } = req.params;
    const assignment = await DailyTellerAssignment.findById(assignmentId);
    if (!assignment) {
      return res.status(404).json({ message: "Assignment not found" });
    }

    assignment.status = "present";
    await assignment.save();

    // ✅ Update work history - increment totalWorkDays when marked present
    await User.findByIdAndUpdate(assignment.tellerId, {
      $set: { lastWorked: assignment.dayKey },
      $inc: { totalWorkDays: 1 }
    });

    if (global.io) {
      global.io.emit("scheduleUpdated", {
        tellerId: assignment.tellerId,
        tellerName: assignment.tellerName,
        status: "present",
        dayKey: assignment.dayKey,
      });
    }

    res.json({ success: true, message: "Marked as present", assignment });
  } catch (err) {
    console.error("❌ Mark Present error:", err);
    res.status(500).json({ message: "Failed to mark present" });
  }
});

// ✅ Mark a teller as absent by ID
router.put("/mark-absent/:assignmentId", requireAuth, requireRole(['supervisor', 'admin', 'super_admin']), async (req, res) => {
  try {
    const { assignmentId } = req.params;
    const assignment = await DailyTellerAssignment.findById(assignmentId);
    if (!assignment) {
      return res.status(404).json({ message: "Assignment not found" });
    }

    assignment.status = "absent";
    await assignment.save();

    if (global.io) {
      global.io.emit("scheduleUpdated", {
        tellerId: assignment.tellerId,
        tellerName: assignment.tellerName,
        status: "absent",
        dayKey: assignment.dayKey,
      });
    }

    res.json({ success: true, message: "Marked as absent", assignment });
  } catch (err) {
    console.error("❌ Mark Absent error:", err);
    res.status(500).json({ message: "Failed to mark absent" });
  }
});

/**
 * ✅ SUGGESTED TELLERS (with work history based on weekly reports)
 */
router.get("/suggest/:dayKey", requireAuth, async (req, res) => {
  try {
    const { dayKey } = req.params;

    // Calculate date range for past 7 days
    const targetDate = DateTime.fromISO(dayKey);
    const weekStart = targetDate.minus({ days: 7 }).toFormat("yyyy-MM-dd");
    const weekEnd = targetDate.toFormat("yyyy-MM-dd");

    console.log(`📊 Calculating weekly worked days from ${weekStart} to ${weekEnd}`);

    const assigned = await DailyTellerAssignment.find({ dayKey }).distinct("tellerId");

    // Find available tellers, exclude those with active penalties
    const availableTellers = await User.find({
      _id: { $nin: assigned },
      role: { $in: ["teller", "supervisor_teller"] },
      status: "approved",
      $or: [
        { skipUntil: null },
        { skipUntil: { $lt: dayKey } }
      ]
    })
      .select("_id name username contact status lastWorked skipUntil lastAbsentReason")
      .lean();

    // Calculate weekly worked days for each teller based on their reports
    const suggestionsWithWeeklyData = await Promise.all(
      availableTellers.map(async (teller) => {
        // Count reports submitted by this teller in the past 7 days
        const weeklyReportsCount = await TellerReport.countDocuments({
          tellerId: teller._id,
          date: {
            $gte: weekStart,
            $lte: weekEnd
          }
        });

        // Get the most recent report date for lastWorked
        const latestReport = await TellerReport.findOne({
          tellerId: teller._id,
          date: {
            $gte: weekStart,
            $lte: weekEnd
          }
        })
          .sort({ date: -1 })
          .select("date")
          .lean();

        return {
          ...teller,
          weeklyWorkedDays: weeklyReportsCount,
          lastWorked: latestReport ? latestReport.date : teller.lastWorked || null
        };
      })
    );

    // Sort by weekly worked days (ascending - least worked first for fair rotation)
    const suggestions = suggestionsWithWeeklyData
      .sort((a, b) => a.weeklyWorkedDays - b.weeklyWorkedDays)
      .slice(0, 10); // Limit to 10 suggestions

    console.log(`📊 Found ${suggestions.length} suggested tellers with weekly data`);

    res.json({
      success: true,
      suggestions,
      message: suggestions.length
        ? "Suggested replacement tellers found (based on weekly reports)"
        : "No available tellers to suggest",
    });
  } catch (err) {
    console.error("❌ Suggest tellers error:", err);
    res.status(500).json({ message: "Failed to suggest tellers" });
  }
});

/**
 * ✅ PUT /api/schedule/set-teller-count
 * Updates the desired teller count for tomorrow's schedule
 */
router.put("/set-teller-count", requireAuth, requireRole(['supervisor', 'admin', 'super_admin']), async (req, res) => {
  try {
    const { tellerCount } = req.body;

    console.log("📊 Set teller count request:", { tellerCount, body: req.body });

    if (!tellerCount || tellerCount < 1) {
      console.log("❌ Invalid teller count:", tellerCount);
      return res.status(400).json({ message: "Invalid teller count" });
    }

    const tomorrow = formatDate(1);
    console.log(`📊 Setting teller count to ${tellerCount} for ${tomorrow}`);

    // Get current assignments
    const currentAssignments = await DailyTellerAssignment.find({ dayKey: tomorrow });
    const currentCount = currentAssignments.length;
    console.log(`📊 Current assignments: ${currentCount}`);

    if (tellerCount > currentCount) {
      // Need to add more tellers
      const needed = tellerCount - currentCount;
      console.log(`➕ Need to add ${needed} more tellers`);

      // Get already assigned teller IDs
      const assignedIds = currentAssignments.map(a => a.tellerId.toString());
      console.log(`📊 Already assigned IDs:`, assignedIds);

      // Find available tellers not already assigned
      const availableTellers = await User.find({
        role: { $in: ["teller", "supervisor_teller"] },
        status: "approved",
        _id: { $nin: assignedIds },
        $or: [
          { skipUntil: null },
          { skipUntil: { $lt: tomorrow } }
        ]
      })
        .sort({ totalWorkDays: 1, lastWorked: 1 }) // Fair rotation: least worked first
        .limit(needed)
        .lean();

      console.log(`📊 Found ${availableTellers.length} available tellers:`, availableTellers.map(t => ({ id: t._id, name: t.name, totalWorkDays: t.totalWorkDays })));

      // Remove supervisor assignment logic - just create schedule entries
      const newAssignments = availableTellers.map((teller) => ({
        dayKey: tomorrow,
        tellerId: teller._id,
        tellerName: teller.name || teller.username,
        status: "scheduled",
      }));

      console.log(`📊 New assignments to create:`, newAssignments);

      if (newAssignments.length > 0) {
        const inserted = await DailyTellerAssignment.insertMany(newAssignments);
        console.log(`✅ Added ${inserted.length} tellers`);

        // Update work history for newly assigned tellers (only set lastWorked, don't increment totalWorkDays)
        for (const teller of availableTellers) {
          console.log(`📊 Updating teller ${teller.name || teller.username} (${teller._id})`);
          const updateResult = await User.findByIdAndUpdate(teller._id, {
            lastWorked: tomorrow
            // Removed: $inc: { totalWorkDays: 1 } - this should only happen when marked present
          });
          console.log(`📊 Update result for ${teller.name}:`, updateResult ? 'success' : 'failed');
        }
      }

    } else if (tellerCount < currentCount) {
      // Need to remove tellers
      const toRemove = currentCount - tellerCount;
      console.log(`➖ Need to remove ${toRemove} tellers`);

      // Remove the last assigned tellers (most recently added)
      const toDelete = currentAssignments.slice(-toRemove);
      const deleteIds = toDelete.map(a => a._id);

      console.log(`📊 Deleting assignments:`, deleteIds);
      const deleteResult = await DailyTellerAssignment.deleteMany({ _id: { $in: deleteIds } });
      console.log(`✅ Removed ${deleteResult.deletedCount} tellers`);
    }

    // Get updated assignments
    const updatedAssignments = await DailyTellerAssignment.find({ dayKey: tomorrow });
    console.log(`📊 Final assignments count: ${updatedAssignments.length}`);

    res.json({
      success: true,
      message: `Teller count updated to ${tellerCount}`,
      count: updatedAssignments.length,
      schedule: updatedAssignments
    });

  } catch (err) {
    console.error("❌ Set teller count error:", err);
    console.error("❌ Error stack:", err.stack);
    res.status(500).json({
      message: "Failed to set teller count",
      error: err.message,
      stack: err.stack
    });
  }
});

/**
 * ✅ GET /api/schedule/today-working/:date
 * Get tellers who have submitted reports for the specified date
 */
router.get("/today-working/:date", requireAuth, async (req, res) => {
  try {
    const { date } = req.params;
    console.log("🔍 Backend: Fetching working tellers for date:", date);

    // Find all tellers who have submitted reports for this date
    const reports = await TellerReport.find({ date })
      .populate('tellerId', 'name username role status')
      .select('tellerId tellerName')
      .lean();

    console.log("📊 Backend: Found", reports.length, "reports for date", date);

    // Group by teller and remove duplicates
    const tellerMap = new Map();
    reports.forEach(report => {
      if (report.tellerId && !tellerMap.has(report.tellerId._id.toString())) {
        tellerMap.set(report.tellerId._id.toString(), {
          _id: report.tellerId._id,
          name: report.tellerName || report.tellerId.name,
          username: report.tellerId.username,
          role: report.tellerId.role,
          status: report.tellerId.status,
          hasReport: true
        });
      }
    });

    const tellers = Array.from(tellerMap.values());

    console.log("✅ Backend: Returning", tellers.length, "unique tellers for date", date);
    res.json({
      success: true,
      date,
      tellers,
      count: tellers.length
    });
  } catch (err) {
    console.error("❌ Today working tellers error:", err);
    res.status(500).json({ message: "Failed to get today's working tellers" });
  }
});
router.put("/replace/:assignmentId", requireAuth, requireRole(['supervisor', 'admin', 'super_admin']), async (req, res) => {
  try {
    const { assignmentId } = req.params;
    const { replacementId } = req.body;

    const assignment = await DailyTellerAssignment.findById(assignmentId);
    if (!assignment) return res.status(404).json({ message: "Assignment not found" });

    const replacement = await User.findById(replacementId).lean();
    if (!replacement) return res.status(404).json({ message: "Replacement teller not found" });

    assignment.tellerId = replacement._id;
    assignment.tellerName = replacement.name;
    assignment.status = "replaced";
    await assignment.save();

    replacement.lastWorked = formatDate(1); // update lastWorked to tomorrow
    await User.findByIdAndUpdate(replacementId, { lastWorked: replacement.lastWorked });

    if (global.io) {
      global.io.emit("scheduleUpdated", {
        tellerId: replacement._id,
        tellerName: replacement.name,
        status: "replaced",
        dayKey: assignment.dayKey,
      });
    }

    res.json({
      success: true,
      message: "Replacement teller assigned",
      assignment,
    });
  } catch (err) {
    console.error("❌ Replace teller error:", err);
    res.status(500).json({ message: "Failed to replace teller" });
  }
});

export default router;
