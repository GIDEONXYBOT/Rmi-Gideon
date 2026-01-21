import mongoose from "mongoose";
import dotenv from "dotenv";
import User from "./models/User.js";

dotenv.config({ path: ".env.production" });

async function checkTellerStatus() {
  try {
    console.log("🔌 Connecting to production database...");
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected to MongoDB");

    // Check all tellers
    const tellers = await User.find({ role: "teller" }).select("_id username name role status");
    console.log(`\n📊 Found ${tellers.length} tellers:\n`);
    tellers.forEach((teller) => {
      console.log(
        `ID: ${teller._id.toString().substring(0, 8)}... | Username: ${teller.username} | Status: ${teller.status}`
      );
    });

    // Check supervisors
    const supervisors = await User.find({ role: "supervisor" }).select("_id username name role status");
    console.log(`\n📊 Found ${supervisors.length} supervisors:\n`);
    supervisors.forEach((supervisor) => {
      console.log(
        `ID: ${supervisor._id.toString().substring(0, 8)}... | Username: ${supervisor.username} | Status: ${supervisor.status}`
      );
    });

    // Approve all pending tellers
    const pendingTellers = await User.find({ role: "teller", status: "pending" });
    if (pendingTellers.length > 0) {
      console.log(`\n⏳ Found ${pendingTellers.length} pending tellers. Approving them...`);
      for (const teller of pendingTellers) {
        teller.status = "approved";
        await teller.save();
        console.log(`✅ Approved: ${teller.username}`);
      }
    } else {
      console.log(`\n✅ All tellers are already approved!`);
    }

    await mongoose.connection.close();
    console.log("\n✅ Done!");
  } catch (error) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  }
}

checkTellerStatus();
