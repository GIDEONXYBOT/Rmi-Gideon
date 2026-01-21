import mongoose from "mongoose";
import dotenv from "dotenv";
import User from "./models/User.js";

dotenv.config({ path: ".env.production" });

async function checkAdminStatus() {
  try {
    console.log("🔌 Connecting to production database...");
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected to MongoDB");

    // Check admin account
    const admin = await User.findOne({ username: "admin" });
    if (admin) {
      console.log(`\n👤 Admin Account Details:`);
      console.log(`ID: ${admin._id}`);
      console.log(`Username: ${admin.username}`);
      console.log(`Role: ${admin.role}`);
      console.log(`Status: ${admin.status}`);
      console.log(`Name: ${admin.name || "N/A"}`);
    } else {
      console.log(`\n❌ Admin account not found!`);
    }

    await mongoose.connection.close();
    console.log("\n✅ Done!");
  } catch (error) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  }
}

checkAdminStatus();
