import mongoose from "mongoose";

// 🧾 Adjustment sub-schema (for admin manual add/deduct logs)
const AdjustmentSchema = new mongoose.Schema({
  delta: { type: Number, required: true }, // positive = add, negative = deduct
  reason: { type: String },
  adminId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  createdAt: { type: Date, default: Date.now },
});

/**
 * Payroll Schema
 * 
 * Each payroll entry represents a unique transaction for a user on a specific date.
 * 
 * Key Design Decisions:
 * - `transactionId`: Unique identifier for each payroll entry to prevent unwanted merging
 *   Format: ${userId}_${date}_${timestamp}_${randomId}
 *   This ensures multiple payroll entries can exist for the same user on the same day
 * 
 * - `date`: YYYY-MM-DD format string for easy querying and filtering by date ranges
 *   Used for grouping and aggregations without the time component
 * 
 * - Sparse Index on `transactionId`: Allows existing records without transactionId (null)
 *   while enforcing uniqueness for new records that have it
 * 
 * Migration Note:
 * - Old payroll entries without transactionId are handled gracefully
 * - Run migrate-payroll-transaction-ids.js to add transactionId to existing entries
 */
const PayrollSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    role: {
      type: String,
      enum: ["super_admin", "admin", "supervisor", "supervisor_teller", "teller", "head_watcher", "sub_watcher", "declarator"],
      required: true,
    },
    baseSalary: { type: Number, default: 0 },
    totalSalary: { type: Number, default: 0 },
    deduction: { type: Number, default: 0 },
    over: { type: Number, default: 0 },
    short: { type: Number, default: 0 },
    shortPaymentTerms: { type: Number, default: 1 }, // number of weeks to deduct short
    daysPresent: { type: Number, default: 0 },

    // 🟢 Existing approvals
    approved: { type: Boolean, default: false },
    locked: { type: Boolean, default: false },
    approvedAt: { type: Date },
    lockedAt: { type: Date },
    note: { type: String, default: "" },

    // 💰 Withdrawal-related
    withdrawn: { type: Boolean, default: false },
    withdrawnAt: { type: Date },
    withdrawal: { type: Number, default: 0 }, // total withdrawn amount (for reference)

    // 🧾 Admin adjustments (manual add/deduct)
    adjustments: { type: [AdjustmentSchema], default: [] },

    // 📅 Date field for easier daily payroll queries
    date: { type: String }, // YYYY-MM-DD format

    // 🆔 Unique transaction ID to prevent merging of separate payroll entries
    // Format: ${userId}_${date}_${timestamp}_${randomId}
    // Each payroll transaction has a unique ID to ensure multiple entries can exist
    // for the same user on the same day (e.g., multiple capital transactions)
    transactionId: { 
      type: String, 
      sparse: true, // Allows null for old records while enforcing uniqueness for non-null values
      index: true 
    },
  },
  { timestamps: true }
);

// Add unique index on transactionId (sparse allows null values for old records)
PayrollSchema.index({ transactionId: 1 }, { unique: true, sparse: true });

export default mongoose.models.Payroll ||
  mongoose.model("Payroll", PayrollSchema);
