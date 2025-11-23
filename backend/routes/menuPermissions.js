import express from "express";
import MenuPermission from "../models/MenuPermission.js";

const router = express.Router();

/**
 * GET /api/menu-permissions
 * Get all menu permissions for all roles
 */
router.get("/", async (req, res) => {
  try {
    const permissions = await MenuPermission.find().lean();
    res.json(permissions);
  } catch (err) {
    console.error("Error fetching menu permissions:", err);
    res.status(500).json({ message: "Failed to load menu permissions" });
  }
});

/**
 * GET /api/menu-permissions/:role
 * Get menu permissions for a specific role
 */
router.get("/:role", async (req, res) => {
  try {
    const { role } = req.params;
    let permission = await MenuPermission.findOne({ role }).lean();
    
    // If no permission exists, return default empty array
    if (!permission) {
      permission = { role, menuItems: [] };
    }
    
    res.json(permission);
  } catch (err) {
    console.error("Error fetching menu permission:", err);
    res.status(500).json({ message: "Failed to load menu permission" });
  }
});

/**
 * PUT /api/menu-permissions/:role
 * Update menu permissions for a specific role (super_admin only)
 */
router.put("/:role", async (req, res) => {
  try {
    const { role } = req.params;
    const { menuItems, updatedBy } = req.body;

    if (!menuItems || !Array.isArray(menuItems)) {
      return res.status(400).json({ message: "menuItems must be an array" });
    }

    // Upsert the permission record
    const permission = await MenuPermission.findOneAndUpdate(
      { role },
      {
        role,
        menuItems,
        updatedBy: updatedBy || "super_admin",
      },
      { upsert: true, new: true }
    );

    // Emit socket event for real-time update
    if (req.app && req.app.io) {
      req.app.io.emit("menuPermissionsUpdated", { role });
    }

    res.json({
      message: "Menu permissions updated successfully",
      permission,
    });
  } catch (err) {
    console.error("Error updating menu permissions:", err);
    res.status(500).json({ message: "Failed to update menu permissions" });
  }
});

/**
 * POST /api/menu-permissions/initialize
 * Initialize default permissions for all roles (run once)
 */
router.post("/initialize", async (req, res) => {
  try {
    const defaultPermissions = [
      {
        role: "admin",
        menuItems: [
          "dashboard",
          "teller-management",
          "teller-reports",
          "supervisor-report",
          "teller-reports-viewer",
          "teller-overview",
          "report",
          "cashflow",
          "user-approval",
          "withdrawals",
          "employees",
          "salary",
          "suggested-schedule",
          "attendance-scheduler",
          "payroll",
          "settings"
        ],
      },
      {
        role: "supervisor",
        menuItems: [
          "dashboard",
          "teller-management",
          "supervisor-report",
          "teller-reports",
          "teller-reports-viewer",
          "staff-performance",
          "teller-month",
          "history",
          "payroll",
          "suggested-schedule",
          "attendance-scheduler",
          "settings"
        ],
      },
      {
        role: "teller",
        menuItems: [
          "dashboard",
          "teller-reports",
          "history",
          "payroll",
          "teller-month",
          "suggested-schedule",
          "deployments",
          "settings"
        ],
      },
      {
        role: "supervisor_teller",
        menuItems: [
          "dashboard",
          "teller-management",
          "supervisor-report",
          "teller-reports",
          "teller-reports-viewer",
          "staff-performance",
          "history",
          "payroll",
          "teller-month",
          "suggested-schedule",
          "settings"
        ],
      },
      {
        role: "declarator",
        menuItems: ["deployments", "settings"],
      },
      {
        role: "super_admin",
        menuItems: [
          "dashboard",
          "supervisor-report",
          "teller-reports",
          "teller-reports-viewer",
          "teller-management",
          "teller-overview",
          "report",
          "cashflow",
          "user-approval",
          "withdrawals",
          "employees",
          "salary",
          "suggested-schedule",
          "attendance-scheduler",
          "payroll",
          "payroll-management",
          "history",
          "teller-month",
          "assistant",
          "menu-config",
          "manage-sidebars",
          "settings"
        ],
      },
    ];

    for (const perm of defaultPermissions) {
      await MenuPermission.findOneAndUpdate(
        { role: perm.role },
        { ...perm, updatedBy: "system-init" },
        { upsert: true }
      );
    }

    res.json({
      message: "Default menu permissions initialized",
      count: defaultPermissions.length,
    });
  } catch (err) {
    console.error("Error initializing menu permissions:", err);
    res.status(500).json({ message: "Failed to initialize menu permissions" });
  }
});

export default router;
