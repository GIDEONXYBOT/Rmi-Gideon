// backend/routes/draws.js - Manage draw results
import express from 'express';
import mongoose from 'mongoose';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

// Apply auth middleware to all routes
router.use(requireAuth);

/**
 * GET /api/draws
 * Get all draw results sorted by fight number
 */
router.get('/', async (req, res) => {
  try {
    // Query the draws collection directly using mongoose
    const draws = await mongoose.connection.db.collection('draws')
      .find({})
      .sort({ id: 1 }) // Sort by numeric id field (1, 2, 3...)
      .limit(360) // Limit to reasonable amount for display
      .toArray();

    console.log(`✅ Fetched ${draws.length} draws from database`);

    res.json({
      success: true,
      data: draws,
      totalDraws: draws.length
    });

  } catch (err) {
    console.error('❌ Error fetching draws:', err);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

/**
 * GET /api/draws/current
 * Get the current/latest draw
 */
router.get('/current', async (req, res) => {
  try {
    const currentDraw = await mongoose.connection.db.collection('draws')
      .find({})
      .sort({ id: -1 }) // Sort by numeric id descending (newest first)
      .limit(1)
      .toArray();

    res.json({
      success: true,
      data: currentDraw[0] || null
    });

  } catch (err) {
    console.error('❌ Error fetching current draw:', err);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

export default router;