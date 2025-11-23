import dotenv from "dotenv";
dotenv.config();

import mongoose from "mongoose";
import User from "./models/User.js";

async function seedAdmin() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected to MongoDB");

    const existing = await User.findOne({ username: "admin" });
    if (existing) {
      console.log("Admin user already exists:", existing.username);
      process.exit(0);
    }

    const admin = new User({
      username: "admin",
      fullName: "Administrator",
      role: "admin",
      active: true,
      verified: true,
    });

    await admin.setPassword("admin123");
    await admin.save();
    console.log("✅ Admin created. Username: admin Password: admin123");
    process.exit(0);
  } catch (err) {
    console.error("❌ Error seeding admin:", err);
    process.exit(1);
  }
}

seedAdmin();
