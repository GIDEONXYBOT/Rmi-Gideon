const express = require('express');
const router = express.Router();
const Payroll = require('../models/payroll');
const Employee = require('../models/Employee');
const Teller = require('../models/Teller');
const auth = require('../middleware/auth');

/**
 * GET /api/teller-overtime-report
 * Fetch teller overtime and base salary for a given week
 * Only accessible to superadmin and supervisors
 */
router.get('/', auth, async (req, res) => {
  try {
    // Check user role
    const userRole = req.user?.role;
    const isSuperAdmin = userRole === 'super_admin' || userRole === 'superadmin' || req.user?.username === 'admin';
    const isSupervisor = userRole === 'supervisor';

    if (!isSuperAdmin && !isSupervisor) {
      return res.status(403).json({ message: 'Access denied. Only superadmin and supervisors can view this report.' });
    }

    const { weekStart, weekEnd, supervisorId } = req.query;

    if (!weekStart || !weekEnd) {
      return res.status(400).json({ message: 'weekStart and weekEnd are required' });
    }

    // Parse dates
    const start = new Date(weekStart);
    const end = new Date(weekEnd);
    end.setHours(23, 59, 59, 999);

    // Build filter
    let filter = {
      date: { $gte: start, $lte: end }
    };

    // If supervisor, filter by their tellers
    let supervisorFilter = {};
    if (isSupervisor) {
      supervisorFilter = { supervisor: req.user.id };
    } else if (supervisorId && isSuperAdmin) {
      supervisorFilter = { supervisor: supervisorId };
    }

    // Fetch tellers based on filter
    const tellers = await Teller.find(supervisorFilter).lean();
    const tellerIds = tellers.map(t => t._id);

    if (tellerIds.length === 0) {
      return res.json({ tellers: [], message: 'No tellers found' });
    }

    // Fetch payroll records for the week
    const payrollRecords = await Payroll.find({
      ...filter,
      tellerId: { $in: tellerIds }
    }).lean();

    // Group by teller and calculate overtime per day
    const tellerMap = {};

    tellers.forEach(teller => {
      tellerMap[teller._id.toString()] = {
        id: teller._id,
        name: teller.name || 'Unknown',
        baseSalary: teller.baseSalary || 0,
        overtime: {
          mon: 0,
          tue: 0,
          wed: 0,
          thu: 0,
          fri: 0
        }
      };
    });

    // Process payroll records
    payrollRecords.forEach(record => {
      const tellerIdStr = record.tellerId?.toString();
      if (tellerMap[tellerIdStr]) {
        const date = new Date(record.date);
        const dayOfWeek = date.getDay();
        
        // Map day of week to day name (1=Mon, 2=Tue, etc.)
        let dayKey = '';
        switch (dayOfWeek) {
          case 1: dayKey = 'mon'; break;
          case 2: dayKey = 'tue'; break;
          case 3: dayKey = 'wed'; break;
          case 4: dayKey = 'thu'; break;
          case 5: dayKey = 'fri'; break;
          default: break;
        }

        if (dayKey) {
          // Add overtime hours (assuming 'overtimeHours' field in payroll)
          tellerMap[tellerIdStr].overtime[dayKey] += (record.overtimeHours || 0);
        }
      }
    });

    const result = Object.values(tellerMap);

    res.json({
      tellers: result,
      weekStart,
      weekEnd,
      count: result.length
    });
  } catch (err) {
    console.error('Error fetching teller overtime report:', err);
    res.status(500).json({ message: 'Failed to fetch overtime report', error: err.message });
  }
});

module.exports = router;
