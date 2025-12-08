import express from 'express';
import ChickenFightEntry from '../models/ChickenFightEntry.js';
import ChickenFightBet from '../models/ChickenFightBet.js';
import ChickenFightGame from '../models/ChickenFightGame.js';

const router = express.Router();

// Middleware to check if user is supervisor or superadmin
const checkAdminRole = (req, res, next) => {
  if (!req.user || (req.user.role !== 'supervisor' && req.user.role !== 'super_admin' && req.user.role !== 'admin')) {
    return res.status(403).json({ success: false, message: 'Unauthorized' });
  }
  next();
};

// ============ ENTRY ENDPOINTS ============

// Create new entry
router.post('/entries', checkAdminRole, async (req, res) => {
  try {
    const { entryName, gameType, legBandNumbers } = req.body;

    // Validate input
    if (!entryName || !gameType || !legBandNumbers) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    if (!['2wins', '3wins'].includes(gameType)) {
      return res.status(400).json({ success: false, message: 'Invalid game type' });
    }

    const expectedLegCount = gameType === '2wins' ? 2 : 3;
    if (legBandNumbers.length !== expectedLegCount) {
      return res.status(400).json({
        success: false,
        message: `${gameType} requires ${expectedLegCount} leg band numbers`
      });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const entry = new ChickenFightEntry({
      entryName,
      gameType,
      legBandNumbers,
      createdBy: req.user._id,
      createdByName: req.user.name,
      gameDate: today
    });

    await entry.save();

    res.json({
      success: true,
      message: 'Entry created successfully',
      entry
    });
  } catch (error) {
    console.error('Error creating entry:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get all entries for today
router.get('/entries', async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const entries = await ChickenFightEntry.find({
      gameDate: { $gte: today, $lt: tomorrow },
      isActive: true
    }).sort({ gameType: 1, createdAt: -1 });

    res.json({
      success: true,
      entries
    });
  } catch (error) {
    console.error('Error fetching entries:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============ BET ENDPOINTS ============

// Place a bet
router.post('/bets', checkAdminRole, async (req, res) => {
  try {
    const { gameDate, gameType, entryId, side, amount } = req.body;

    if (!gameDate || !gameType || !entryId || !side || amount === undefined) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    if (!['meron', 'wala'].includes(side)) {
      return res.status(400).json({ success: false, message: 'Invalid side' });
    }

    // Verify entry exists
    const entry = await ChickenFightEntry.findById(entryId);
    if (!entry) {
      return res.status(404).json({ success: false, message: 'Entry not found' });
    }

    const bet = new ChickenFightBet({
      gameDate: new Date(gameDate),
      gameType,
      entryId,
      entryName: entry.entryName,
      side,
      amount,
      createdBy: req.user._id,
      createdByName: req.user.name
    });

    await bet.save();

    res.json({
      success: true,
      message: 'Bet placed successfully',
      bet
    });
  } catch (error) {
    console.error('Error placing bet:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get bets for a specific date and game type
router.get('/bets', async (req, res) => {
  try {
    const { gameDate, gameType } = req.query;

    if (!gameDate) {
      return res.status(400).json({ success: false, message: 'gameDate is required' });
    }

    const startDate = new Date(gameDate);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 1);

    const query = {
      gameDate: { $gte: startDate, $lt: endDate }
    };

    if (gameType && gameType !== 'all') {
      query.gameType = gameType;
    }

    const bets = await ChickenFightBet.find(query).sort({ createdAt: -1 });

    res.json({
      success: true,
      bets
    });
  } catch (error) {
    console.error('Error fetching bets:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============ GAME RESULTS ENDPOINTS ============

// Set game selection for the day
router.post('/game/daily-selection', checkAdminRole, async (req, res) => {
  try {
    const { gameTypes } = req.body;

    if (!gameTypes || !Array.isArray(gameTypes) || gameTypes.length === 0) {
      return res.status(400).json({ success: false, message: 'gameTypes array is required' });
    }

    const validTypes = gameTypes.every(t => ['2wins', '3wins'].includes(t));
    if (!validTypes) {
      return res.status(400).json({ success: false, message: 'Invalid game types' });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let game = await ChickenFightGame.findOne({ gameDate: today });

    if (game) {
      game.gameTypes = gameTypes;
      await game.save();
    } else {
      game = new ChickenFightGame({
        gameDate: today,
        gameTypes,
        createdBy: req.user._id
      });
      await game.save();
    }

    res.json({
      success: true,
      message: 'Game selection updated',
      game
    });
  } catch (error) {
    console.error('Error setting game selection:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get today's game selection
router.get('/game/daily-selection', async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const game = await ChickenFightGame.findOne({ gameDate: today });

    res.json({
      success: true,
      game: game || { gameTypes: [] }
    });
  } catch (error) {
    console.error('Error fetching game selection:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Set results and determine winners (Champion/Insurance)
router.put('/game/results', checkAdminRole, async (req, res) => {
  try {
    const { gameDate, entryResults } = req.body;

    if (!gameDate || !entryResults) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    const gameDateObj = new Date(gameDate);
    gameDateObj.setHours(0, 0, 0, 0);

    let game = await ChickenFightGame.findOne({ gameDate: gameDateObj });

    if (!game) {
      game = new ChickenFightGame({
        gameDate: gameDateObj,
        gameTypes: [],
        createdBy: req.user._id
      });
    }

    // Process each entry result
    const processedResults = entryResults.map(result => {
      const { entryId, entryName, gameType, legResults } = result;

      // Determine status based on legResults
      let status = 'none';
      let prize = 0;

      if (gameType === '2wins') {
        const allWins = legResults.every(leg => leg.result === 'win');
        if (allWins) {
          status = 'champion';
          prize = 5000;
        }
      } else if (gameType === '3wins') {
        const allWins = legResults.every(leg => leg.result === 'win');
        const winCount = legResults.filter(leg => leg.result === 'win').length;
        const noRecordCount = legResults.filter(leg => leg.result === 'noRecord').length;

        if (allWins) {
          status = 'champion';
          prize = 20000;
        } else if (winCount === 2 && noRecordCount === 1) {
          status = 'insurance';
          prize = 5000;
        }
      }

      return {
        entryId,
        entryName,
        gameType,
        legResults,
        status,
        prize
      };
    });

    game.entryResults = processedResults;
    game.isFinalized = true;
    await game.save();

    // Update bets with payouts
    for (const result of processedResults) {
      if (result.status === 'champion' || result.status === 'insurance') {
        await ChickenFightBet.updateMany(
          {
            gameDate: gameDateObj,
            entryId: result.entryId,
            side: 'meron'
          },
          {
            result: 'win',
            payout: result.prize
          }
        );

        await ChickenFightBet.updateMany(
          {
            gameDate: gameDateObj,
            entryId: result.entryId,
            side: 'wala'
          },
          {
            result: 'loss',
            payout: 0
          }
        );
      }
    }

    res.json({
      success: true,
      message: 'Results finalized',
      game
    });
  } catch (error) {
    console.error('Error setting results:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get game results for a date
router.get('/game/results', async (req, res) => {
  try {
    const { gameDate } = req.query;

    if (!gameDate) {
      return res.status(400).json({ success: false, message: 'gameDate is required' });
    }

    const gameDateObj = new Date(gameDate);
    gameDateObj.setHours(0, 0, 0, 0);

    const game = await ChickenFightGame.findOne({ gameDate: gameDateObj });

    res.json({
      success: true,
      game: game || { entryResults: [], isFinalized: false }
    });
  } catch (error) {
    console.error('Error fetching results:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
