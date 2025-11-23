// server.js (final, complete and safe)
import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import cors from "cors";
import bodyParser from "body-parser";
import http from "http";
// import { Server } from "socket.io";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";
// import securityMiddleware from './middleware/security.js';

// Utility function to get local IP
function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      const { address, family, internal } = iface;
      if (family === 'IPv4' && !internal) {
        return address;
      }
    }
  }
  return 'localhost';
}

// Initialize app and env
dotenv.config();
const app = express();

// Production Security Middleware (must be first)
// if (process.env.NODE_ENV === 'production') {
//   securityMiddleware(app);
// } else {
  // Development CORS (mobile-optimized)
  app.use(cors({ 
    origin: true, // Allow all origins
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "Accept", "Cache-Control", "Pragma"],
    optionsSuccessStatus: 200 // For legacy browser support
  }));
  
  // Handle preflight requests explicitly
  app.options('*', (req, res) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Cache-Control, Pragma');
    res.sendStatus(200);
  });
// }

app.use(express.json());
app.use(bodyParser.urlencoded({ extended: true }));

// ✅ Request logging middleware with mobile detection
app.use((req, res, next) => {
  try {
    const userAgent = req.headers['user-agent'] || '';
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
    console.log(`📥 ${req.method} ${req.path} from ${req.ip}${isMobile ? ' (Mobile)' : ''}`);
  } catch (error) {
    console.log(`📥 ${req.method} ${req.path} from ${req.ip || 'unknown'}`);
  }
  next();
});

// 🔧 Health check and connectivity test endpoint
app.get('/api/health', (req, res) => {
  const clientInfo = {
    timestamp: new Date().toISOString(),
    clientIP: req.ip || req.connection.remoteAddress,
    userAgent: req.headers['user-agent'],
    origin: req.headers.origin,
    host: req.headers.host,
    serverIP: getLocalIP(),
    message: 'Backend server is running'
  };
  console.log('🏥 Health check requested:', clientInfo);
  res.json(clientInfo);
});

// Database Connection
const MONGO_URI =
  process.env.MONGO_URI || "mongodb://localhost:27017/rmi_teller_report";

console.log("🔄 Connecting to MongoDB...");
mongoose
  .connect(MONGO_URI, {
    serverSelectionTimeoutMS: 10000, // 10 second timeout
    socketTimeoutMS: 45000
  })
  .then(async () => {
    console.log("✅ MongoDB connected successfully");

    // Initialize supervisor assignment reset scheduler after DB connection
    try {
      const { initSupervisorResetScheduler } = await import("./scheduler/supervisorReset.js");
      await initSupervisorResetScheduler();
      console.log("✅ Supervisor reset scheduler initialized");
    } catch (schedulerError) {
      console.error("❌ Failed to initialize scheduler:", schedulerError);
      // Don't exit, just log the error
    }
  })
  .catch((err) => {
    console.error("❌ MongoDB connection error:", err);
    process.exit(1); // Exit if database connection fails
  });

// ======================================================
// ROUTES
// ======================================================
// import payrollRoutes from "./routes/payroll.js";
// import adminRoutes from "./routes/admin.js";
// import adminTellerOverviewRoutes from "./routes/adminTellerOverview.js"; // ✅ new admin teller overview
// import userRoutes from "./routes/users.js";
import settingsRoutes from "./routes/settings.js";
import systemSettingsRoutes from "./routes/systemSettings.js";
import usersRoutes from "./routes/users.js";
import cashflowRoutes from "./routes/cashflow.js";
import payrollRoutes from "./routes/payroll.js";
import tellerReportsRoutes from "./routes/tellerReports.js";
import chatRoutes from "./routes/chat.js";
import adminRoutes from "./routes/admin.js";
import adminTellerOverviewRoutes from "./routes/adminTellerOverview.js"; // admin teller overview endpoints
import menuPermissionsRoutes from "./routes/menuPermissions.js";
// import cashflowRoutes from "./routes/cashflow.js";
// import reportRoutes from "./routes/reports.js";
// import schedulerRoutes from "./routes/schedulerRoutes.js";
import authRoutes from "./routes/auth.js"; // ✅ add this
// import chatRoutes from "./routes/chat.js"; // ✅ new chat route
// import scheduleRoutes from "./routes/schedule.js"; // ✅ add this
// import attendanceRoutes from "./routes/attendance.js"; // ✅ new attendance route
// import tellerReportsRoutes from "./routes/tellerReports.js";
// import tellerManagementRoutes from "./routes/teller-management.js";
// import tellersRoutes from "./routes/tellers.js";
// import supervisorRoutes from "./routes/supervisor.js";
// import debugRoutes from "./routes/debug.js";
// import deploymentsRoutes from "./routes/deployments.js";
// import staffRoutes from "./routes/staff.js"; // ✅ new staff/employee routes
// import menuPermissionsRoutes from "./routes/menuPermissions.js"; // ✅ menu permissions
// import mapConfigRoutes from "./routes/mapConfig.js"; // ✅ custom map config
// import externalBettingRoutes from "./routes/externalBetting.js"; // ✅ external betting data
// import bettingDataRoutes from "./routes/bettingData.js"; // ✅ manage betting data
import tellerZonesRoutes from "./routes/tellerZones.js"; // ✅ teller zones for assignments
import notificationsRoutes from "./routes/notifications.js"; // ✅ notifications & alerts
import shiftRoutes from "./routes/shift.js"; // ✅ shift management
import shortPaymentsRoutes from "./routes/shortPayments.js"; // ✅ short payment plans
import assetsRoutes from "./routes/assets.js"; // ✅ asset management

// Temporarily disable all routes to test basic server startup
// app.use("/api/payroll", payrollRoutes);
// app.use("/api/admin", adminRoutes);
// app.use("/api/admin", adminTellerOverviewRoutes); // ✅ admin teller overview routes
// app.use("/api/external-betting", externalBettingRoutes); // ✅ external betting routes
// app.use("/api/betting-data", bettingDataRoutes); // ✅ manage betting data routes
// app.use("/api/teller-zones", tellerZonesRoutes); // ✅ teller zones routes
// app.use("/api/notifications", notificationsRoutes); // ✅ notifications & alerts routes
// app.use("/api/users", userRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/system-settings", systemSettingsRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/cashflow", cashflowRoutes);
app.use("/api/payroll", payrollRoutes);
app.use("/api/teller-reports", tellerReportsRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/admin", adminTellerOverviewRoutes); // add Teller Overview api
app.use("/api/menu-permissions", menuPermissionsRoutes); // used by frontend sidebar
// app.use("/api/cashflow", cashflowRoutes);
// app.use("/api/reports", reportRoutes); // Re-enabled
// app.use("/api/scheduler", schedulerRoutes);
app.use("/api/auth", authRoutes);
// app.use("/api/chat", chatRoutes);
// app.use("/api/schedule", scheduleRoutes);
// app.use("/api/attendance", attendanceRoutes);
// app.use("/api/teller-reports", tellerReportsRoutes);
// app.use("/api/teller-management", tellerManagementRoutes);
// app.use("/api/tellers", tellersRoutes);
// app.use("/api/supervisor", supervisorRoutes);
// app.use("/api/staff", staffRoutes); // ✅ staff/employee management
// app.use("/api/menu-permissions", menuPermissionsRoutes); // ✅ menu permissions
// app.use("/api/map-config", mapConfigRoutes); // ✅ custom map config
// app.use("/api/shift", shiftRoutes); // ✅ shift management
// app.use("/api/short-payments", shortPaymentsRoutes); // ✅ short payment plans
// app.use("/api/assets", assetsRoutes); // ✅ asset management
// app.use("/api/debug", debugRoutes);
// app.use("/api/deployments", deploymentsRoutes);

// ======================================================
// STATIC FRONTEND SERVE (Vite build in frontend/dist)
// ======================================================
try {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const distPath = path.resolve(__dirname, "../frontend/dist");
  app.use(express.static(distPath));
  // SPA fallback: send index.html for non-API routes
  app.get(/^(?!\/api\/).+/, (req, res) => {
    res.sendFile(path.join(distPath, "index.html"));
  });
  console.log("🗂️ Serving frontend dist from:", distPath);
} catch (e) {
  console.warn("⚠️ Failed to configure static frontend serving:", e.message);
}

// ======================================================
// SOCKET + SCHEDULER SETUP
// ======================================================
// import { scheduleDailyReset } from "./scheduler/midnightReset.js";

// Start HTTP + Socket.IO
const server = http.createServer(app);
/*
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE"],
  },
});

// Make io available globally
app.io = io;
global.io = io;
*/

// ======================================================
// ✅ SOCKET EVENT HANDLERS (DISABLED FOR DEBUGGING)
// ======================================================
/*
if (!global.onlineUsers) global.onlineUsers = new Map();

io.on("connection", (socket) => {
  console.log("🟢 Socket connected:", socket.id);

  // When user connects
  socket.on("userConnected", (user) => {
    if (user && user._id) {
      user.socketId = socket.id;
      global.onlineUsers.set(user._id, user);
      io.emit("onlineUsers", Array.from(global.onlineUsers.values()));
      console.log(`🟩 ${user.name} (${user.role}) connected`);
    }
  });

  // Typing indicator
  socket.on("typing", (data) => {
    if (data.receiverId && global.onlineUsers.has(data.receiverId)) {
      const receiver = global.onlineUsers.get(data.receiverId);
      io.to(receiver.socketId).emit("userTyping", data);
    } else {
      socket.broadcast.emit("userTyping", data);
    }
  });

  // ✅ Live message handling (private or group)
  socket.on("sendMessage", (msg) => {
    if (!msg || !msg.senderId) return;

    if (!global.sentMessages) global.sentMessages = new Set();
    const msgId = msg._id || Date.now().toString();
    if (global.sentMessages.has(msgId)) return;
    global.sentMessages.add(msgId);
    setTimeout(() => global.sentMessages.delete(msgId), 5000);

    // Private 1-on-1
    if (msg.receiverId && global.onlineUsers.has(msg.receiverId)) {
      const receiver = global.onlineUsers.get(msg.receiverId);
      io.to(receiver.socketId).emit("newMessage", msg);
      io.to(socket.id).emit("newMessage", msg); // also to sender
      console.log(`📩 Private message ${msgId} from ${msg.senderName} ➡️ ${receiver.name}`);
    } else {
      // Group message
      io.emit("newMessage", msg);
      console.log(`💬 Group message ${msgId} broadcast`);
    }
  });

  // ✅ Delete-all sync
  socket.on("messagesCleared", () => {
    io.emit("clearAllMessages");
  });

  // ✅ Handle user disconnect
  socket.on("disconnect", () => {
    for (let [id, u] of global.onlineUsers) {
      if (socket.id === u.socketId) {
        global.onlineUsers.delete(id);
        console.log(`🔴 ${u.name} disconnected`);
        break;
      }
    }
    io.emit("onlineUsers", Array.from(global.onlineUsers.values()));
  });
});
*/

// ======================================================
// 🩹 FIXED: Removed duplicate socket.on("sendMessage")
// (it existed outside io.on('connection'))
// ======================================================

// Handle socket.io requests (disabled)
app.get('/socket.io/*', (req, res) => {
  res.status(200).json({ message: 'Socket.IO disabled' });
});

// Scheduler setup
// import { initSupervisorResetScheduler } from "./scheduler/supervisorReset.js";

// const DEFAULT_RESET_TIME = process.env.RESET_TIME || "00:00";
// scheduleDailyReset(DEFAULT_RESET_TIME);
// console.log(`🕐 Scheduler set for ${DEFAULT_RESET_TIME} Asia/Manila`);

// Supervisor reset scheduler is now initialized after DB connection (see above)


// ======================================================
// AUTO-DETECT LOCAL IP ADDRESS
// ======================================================
function getLocalIPAddress() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      // Skip internal (loopback) and non-IPv4 addresses
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost'; // fallback
}

const LOCAL_IP = getLocalIPAddress();

// ======================================================
// START SERVER ON PORT 5000
// ======================================================
const PORT = process.env.PORT || 5000;

// Global error handlers
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught Exception:', err);
  process.exit(1);
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Backend Server Started`);
  console.log(`📡 Local: http://localhost:${PORT}`);
  console.log(`📡 Network: http://${LOCAL_IP}:${PORT}`);
  // console.log(`🔌 Socket.IO ready for real-time updates\n`);
});

server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error(`\n❌ Port ${PORT} is already in use!`);
    console.error(`Kill the process: Get-Process node | Stop-Process -Force\n`);
  } else {
    console.error("❌ Server error:", err);
  }
  process.exit(1);
});

export default app;
