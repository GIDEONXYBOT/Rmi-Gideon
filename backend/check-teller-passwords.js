import mongoose from "mongoose";
import dotenv from "dotenv";
import User from "./models/User.js";
import bcrypt from "bcryptjs";

dotenv.config({ path: ".env.production" });

async function checkTellerPasswords() {
  try {
    console.log("🔌 Connecting to production database...");
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected to MongoDB\n");

    // Check a few teller passwords
    const tellernames = ["002.mary", "024.Marygold", "018.honey"];
    
    for (const username of tellernames) {
      const teller = await User.findOne({ username });
      if (teller) {
        console.log(`👤 ${username}:`);
        console.log(`   Role: ${teller.role}`);
        console.log(`   Status: ${teller.status}`);
        console.log(`   Has password: ${!!teller.password}`);
        
        if (teller.password) {
          // Try common passwords
          const commonPasses = [username, "123456", "password", "admin123"];
          for (const pass of commonPasses) {
            try {
              const match = await bcrypt.compare(pass, teller.password);
              if (match) {
                console.log(`   ✅ Password matches: "${pass}"`);
                break;
              }
            } catch (e) {
              // continue
            }
          }
        }
        console.log();
      }
    }

    await mongoose.connection.close();
  } catch (error) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  }
}

checkTellerPasswords();
