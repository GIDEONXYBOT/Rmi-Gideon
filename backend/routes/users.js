import express from "express";
import User from "../models/User.js";

const router = express.Router();

// GET: list users (optionally filter by role: /api/users?role=supervisor)
router.get("/", async (req, res) => {
  try {
    const { role } = req.query;
    const filter = {};
    if (role) filter.role = role;
    const users = await User.find(filter).select("-passwordHash");
    res.json(users);
  } catch (err) {
    console.error("Error fetching users:", err);
    res.status(500).json({ message: "Failed to fetch users" });
  }
});

// GET pending users
router.get("/pending", async (req, res) => {
  try {
    const users = await User.find({ active: false });
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch pending users" });
  }
});

// Approve or deactivate a user
router.put("/:id/approve", async (req, res) => {
  try {
    const { active } = req.body;
    await User.findByIdAndUpdate(req.params.id, { active });
    res.json({ message: "User status updated" });
  } catch (err) {
    res.status(500).json({ message: "Failed to update user status" });
  }
});

// Get assistant admin
router.get("/assistant", async (req, res) => {
  try {
    const assistant = await User.findOne({ isAssistantAdmin: true }).select("-passwordHash");
    res.json(assistant || null);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch assistant admin" });
  }
});

export default router;
