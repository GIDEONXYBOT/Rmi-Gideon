import mongoose from "mongoose";

const assignmentSchema = new mongoose.Schema({
  dayKey: { type: String, required: true, index: true }, // YYYY-MM-DD
  tellerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  tellerName: { type: String, required: true },
  supervisorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: false }, // Made optional
  supervisorName: { type: String, required: false }, // Made optional
  status: { type: String, enum: ["scheduled", "present", "absent", "replaced"], default: "scheduled" },
  absentReason: { type: String, default: "" },
  penaltyDays: { type: Number, default: 0 },
  assignedAt: { type: Date, default: Date.now },
});

assignmentSchema.index({ dayKey: 1, tellerId: 1 }, { unique: true });

const DailyTellerAssignment = mongoose.model("DailyTellerAssignment", assignmentSchema);
export default DailyTellerAssignment;
