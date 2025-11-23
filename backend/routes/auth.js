import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User.js";

const router = express.Router();

// ==================== LOGIN ====================
router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    console.log(`🔐 Login attempt: username="${username}"`);
    
    if (!username || !password)
      return res.status(400).json({ message: "Username and password required" });

    const user = await User.findOne({ username });
    if (!user) {
      console.log(`❌ User not found: ${username}`);
      return res.status(404).json({ message: "User not found" });
    }

    console.log(`👤 Found user: ${username}, role: ${user.role}, status: ${user.status}`);
    console.log(`🔑 Stored password hash: ${user.password?.substring(0, 20)}...`);
    console.log(`📝 Plain text password: ${user.plainTextPassword || "(none)"}`);

    // If no password hash exists at all, hash the provided password and save
    if (!user.password) {
      const newHash = await bcrypt.hash(password, 10);
      user.password = newHash;
      user.plainTextPassword = password;
      await user.save();
      console.log(`🔄 Auto-hashed new password for ${username}`);
    }

    const isHashed =
      user.password.startsWith("$2a$") || user.password.startsWith("$2b$");
    
    console.log(`🔍 Password is hashed: ${isHashed}`);
    
    let isMatch = false;

    // Try bcrypt comparison if hashed
    if (isHashed) {
      isMatch = await bcrypt.compare(password, user.password);
      console.log(`🔐 Bcrypt compare result: ${isMatch}`);
    } else {
      // Direct string comparison if not hashed
      isMatch = user.password === password;
      console.log(`🔐 Direct compare result: ${isMatch}`);
    }

    // ✅ Fallback: allow login using stored plainTextPassword
    if (!isMatch && user.plainTextPassword) {
      const plainMatch = password === user.plainTextPassword;
      console.log(`🔐 PlainText compare result: ${plainMatch}`);
      if (plainMatch) {
        isMatch = true;
        // Re-hash and store to ensure bcrypt path going forward
        user.password = await bcrypt.hash(password, 10);
        await user.save();
        console.log(`🔄 Password re-hashed from plainTextPassword for ${username}`);
      }
    }

    // ✅ If password wasn't hashed yet, store plain text and hash it
    if (!isHashed && isMatch) {
      user.plainTextPassword = password;
      user.password = await bcrypt.hash(password, 10);
      await user.save();
      console.log(`🔄 Auto-migrated password for ${username}`);
    }

    if (!isMatch) {
      console.log(`❌ Password mismatch for ${username}`);
      return res.status(400).json({ message: "Invalid username or password" });
    }

    if (user.status === "pending" && user.role !== "admin") {
      console.log(`⏳ User ${username} is pending approval`);
      return res
        .status(403)
        .json({ message: "Your account is pending admin approval." });
    }

    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET || "secretkey",
      { expiresIn: "7d" }
    );

    console.log(`✅ Login successful for ${username}`);
    res.json({
      token,
      user: {
        _id: user._id,
        username: user.username,
        name: user.name || user.username,
        role: user.role,
        status: user.status,
      },
    });
  } catch (err) {
    console.error("❌ Login Error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ==================== REGISTER ====================
router.post("/register", async (req, res) => {
  try {
    const { username, password, role, name } = req.body;
    if (!username || !password)
      return res.status(400).json({ message: "Username and password required" });

    const existing = await User.findOne({ username });
    if (existing)
      return res.status(400).json({ message: "Username already exists" });

    const hashedPassword = await bcrypt.hash(password, 10);
    const userCount = await User.countDocuments();

    const newUser = new User({
      username,
      password: hashedPassword,
      plainTextPassword: password, // ✅ Store plain text before hashing
      name: name || username,
      role: userCount === 0 ? "admin" : role || "teller",
      status: userCount === 0 ? "approved" : "pending",
    });

    await newUser.save();
    console.log(
      userCount === 0
        ? `✅ First user ${username} set as Admin`
        : `🕒 ${username} registered pending approval`
    );

    // Only emit socket event if io exists and it's not the first user
    const io = req.app?.get("io");
    if (io && userCount > 0) {
      io.emit("newUserRegistered", {
        _id: newUser._id,
        username: newUser.username,
        name: newUser.name,
        role: newUser.role,
        status: newUser.status,
      });
    }

    res.json({
      message:
        userCount === 0
          ? "🎉 First user registered as Admin automatically!"
          : "✅ Registration successful! Waiting for admin approval.",
      user: newUser,
    });
  } catch (err) {
    console.error("❌ Registration Error:", err);
    res
      .status(500)
      .json({ message: "Server error during registration", error: err.message });
  }
});

// ==================== VERIFY TOKEN ====================
router.get("/verify", async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ message: "No token provided" });

    const decoded = jwt.verify(token, process.env.JWT_SECRET || "secretkey");
    const user = await User.findById(decoded.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    res.json({
      valid: true,
      user: {
        _id: user._id,
        username: user.username,
        role: user.role,
        name: user.name,
        status: user.status,
      },
    });
  } catch (err) {
    console.error("❌ Token Verification Error:", err);
    res.status(401).json({ message: "Invalid token" });
  }
});

export default router;
