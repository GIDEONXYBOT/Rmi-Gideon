// scheduler/chickenFightUpdate.js - Periodic chicken fight data fetching and real-time updates
import { emitChickenFightUpdate } from '../socket/chickenFightSocket.js';
import ChickenFightGame from '../models/ChickenFightGame.js';
import ChickenFightBet from '../models/ChickenFightBet.js';
import ChickenFightEntry from '../models/ChickenFightEntry.js';

let updateInterval = null;
let isRunning = false;

export function initChickenFightUpdateScheduler(io) {
  if (isRunning) {
    console.log('🐔 Chicken fight update scheduler already running');
    return;
  }

  isRunning = true;
  console.log('🐔 Starting chicken fight update scheduler...');

  // Function to fetch and emit chicken fight updates
  const fetchAndEmitUpdates = async () => {
    try {
      console.log('🔄 Fetching chicken fight data for live updates...');

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      // Fetch fights for today directly from database
      console.log('📥 Fetching fights data from database...');
      const game = await ChickenFightGame.findOne({ gameDate: today });
      const fightsData = {
        fights: game?.fights || [],
        fightNumber: game?.fightNumber || 0
      };

      // Fetch bets for today directly from database
      console.log('📥 Fetching bets data from database...');
      const bets = await ChickenFightBet.find({
        gameDate: { $gte: today, $lt: tomorrow }
      }).sort({ createdAt: -1 });

      // Fetch entries directly from database
      console.log('📥 Fetching entries data from database...');
      const entries = await ChickenFightEntry.find({
        createdAt: { $gte: today, $lt: tomorrow }
      }).sort({ createdAt: -1 });

      // Combine the data
      const updateData = {
        currentFight: fightsData.fightNumber || 0,
        fights: fightsData.fights || [],
        bets: bets || [],
        entries: entries || [],
        lastUpdate: new Date().toISOString()
      };

      console.log(`✅ Successfully fetched chicken fight data: ${updateData.fights.length} fights, ${updateData.bets.length} bets, ${updateData.entries.length} entries`);

      // Emit chicken fight update to connected clients
      emitChickenFightUpdate(io, updateData);

      console.log('📡 Live chicken fight update emitted to all connected clients');

    } catch (error) {
      console.error('❌ Chicken fight update scheduler error:', error.message);
      // Don't throw error, just log it to keep scheduler running
    }
  };

  // Initial fetch
  fetchAndEmitUpdates();

  // Set up periodic updates every 5 seconds (same as leaderboard)
  updateInterval = setInterval(fetchAndEmitUpdates, 5000);

  console.log('🐔 Chicken fight update scheduler started - updating every 5 seconds');

  return {
    stop: () => {
      if (updateInterval) {
        clearInterval(updateInterval);
        updateInterval = null;
        isRunning = false;
        console.log('🐔 Chicken fight update scheduler stopped');
      }
    }
  };
}

export default initChickenFightUpdateScheduler;