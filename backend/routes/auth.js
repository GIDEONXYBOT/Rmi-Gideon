import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import User from "../models/User.js";

const router = express.Router();

// ==================== LOGIN ====================
router.post("/login", async (req, res) => {
  const startTime = Date.now();
  let timeoutId;

  try {
    const { username, password } = req.body;
    console.log(`🔐 Login attempt: username="${username}" from IP: ${req.ip}`);

    if (!username || !password)
      return res.status(400).json({ message: "Username and password required" });

    // Check if database is connected
    if (mongoose.connection.readyState !== 1) {
      console.warn(`⚠️ Database not ready for login attempt (state: ${mongoose.connection.readyState})`);
      return res.status(503).json({ message: "Server temporarily unavailable. Please try again in a moment." });
    }

    // Set timeout for the request (30 seconds max)
    timeoutId = setTimeout(() => {
      console.log(`⏰ Login timeout for ${username}`);
      if (!res.headersSent) {
        res.status(408).json({ message: "Login request timed out. Please try again." });
      }
    }, 30000);

    // Optimized: Single query with only needed fields
    const user = await User.findOne({ username }).select('_id username name role status password').lean();

    if (!user) {
      console.log(`❌ User not found: ${username}`);
      clearTimeout(timeoutId);
      return res.status(401).json({ message: "Invalid username or password" });
    }

    console.log(`👤 Found user: ${username}, role: ${user.role}, status: ${user.status}`);

    // Password validation - ONLY use bcrypt (secure)
    let isMatch = false;

    if (!user.password) {
      console.log(`❌ User has no password hash: ${username}`);
      clearTimeout(timeoutId);
      return res.status(401).json({ message: "Invalid username or password" });
    }

    // Always use bcrypt for password comparison
    try {
      isMatch = await bcrypt.compare(password, user.password);
    } catch (bcryptErr) {
      console.error(`❌ Bcrypt error for ${username}:`, bcryptErr);
      clearTimeout(timeoutId);
      return res.status(401).json({ message: "Invalid username or password" });
    }

    if (!isMatch) {
      console.log(`❌ Password mismatch for ${username}`);
      clearTimeout(timeoutId);
      return res.status(401).json({ message: "Invalid username or password" });
    }

    // Check approval status
    if (user.status === "pending" && user.role !== "admin" && user.role !== "super_admin") {
      console.log(`⏳ User ${username} is pending approval`);
      clearTimeout(timeoutId);
      return res.status(403).json({ message: "Your account is pending admin approval." });
    }

    // ⚡ Generate JWT token (7 days expiration)
    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET || "secretkey",
      { expiresIn: "7d" }
    );

    clearTimeout(timeoutId);
    const processingTime = Date.now() - startTime;
    console.log(`✅ Login successful for ${username} (${processingTime}ms)`);

    // Send response immediately
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
    clearTimeout(timeoutId);
    console.error("❌ Login Error:", err.message);
    if (!res.headersSent) {
      // Return 503 for connection errors, 500 for other errors
      const statusCode = err.message.includes('connect') || err.name === 'MongoNetworkError' ? 503 : 500;
      res.status(statusCode).json({ 
        message: statusCode === 503 
          ? "Database connection error. Please try again in a moment."
          : "Server error during login. Please try again." 
      });
    }
  }
});

// ==================== REGISTER ====================
router.post("/register", async (req, res) => {
  try {
    const { username, password, role, name } = req.body;
    if (!username || !password)
      return res.status(400).json({ message: "Username and password required" });

    // Validate password strength (minimum 6 characters)
    if (password.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters" });
    }

    const existing = await User.findOne({ username });
    if (existing)
      return res.status(400).json({ message: "Username already exists" });

    // Hash password with bcrypt (salt rounds: 10)
    const hashedPassword = await bcrypt.hash(password, 10);
    const userCount = await User.countDocuments();

    const newUser = new User({
      username,
      password: hashedPassword,
      // DO NOT store plaintext passwords - removed plainTextPassword field
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
