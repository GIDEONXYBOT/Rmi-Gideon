import mongoose from "mongoose";
import dotenv from "dotenv";
import User from "./models/User.js";
import bcrypt from "bcryptjs";

dotenv.config({ path: ".env.production" });

async function resetTellerPasswords() {
  try {
    console.log("🔌 Connecting to production database...");
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected to MongoDB\n");

    // Get all tellers
    const tellers = await User.find({ role: "teller" });
    console.log(`📋 Found ${tellers.length} tellers. Setting password to "password123" for all...\n`);

    const defaultPassword = await bcrypt.hash("password123", 10);

    for (const teller of tellers) {
      teller.password = defaultPassword;
      await teller.save();
      console.log(`✅ Password reset for: ${teller.username}`);
    }

    console.log(`\n✅ Done! All teller passwords set to "password123"`);

    await mongoose.connection.close();
  } catch (error) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  }
}

resetTellerPasswords();
