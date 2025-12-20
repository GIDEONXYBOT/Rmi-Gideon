// backend/routes/draws.js - Manage draw results
import express from 'express';
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
    // Import mongoose and Draw model dynamically
    const mongoose = (await import('mongoose')).default;

    // Define Draw schema inline (matching the populated data structure)
    const drawSchema = new mongoose.Schema({
      id: Number,
      batch: {
        fightSequence: Number
      },
      result1: String,
      details: {
        redTotalBetAmount: Number,
        blueTotalBetAmount: Number,
        drawTotalBetAmount: Number
      },
      createdAt: Date
    }, { collection: 'draws' });

    const Draw = mongoose.model('Draw', drawSchema, 'draws');

    // Fetch all draws sorted by fight sequence (oldest first)
    const draws = await Draw.find()
      .sort({ 'batch.fightSequence': 1, id: 1 })
      .limit(360); // Limit to reasonable amount for display

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
    const mongoose = (await import('mongoose')).default;

    const drawSchema = new mongoose.Schema({
      id: Number,
      batch: {
        fightSequence: Number
      },
      result1: String,
      details: Object,
      createdAt: Date
    }, { collection: 'draws' });

    const Draw = mongoose.model('Draw', drawSchema, 'draws');

    const currentDraw = await Draw.findOne()
      .sort({ 'batch.fightSequence': -1, createdAt: -1 });

    res.json({
      success: true,
      data: currentDraw
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