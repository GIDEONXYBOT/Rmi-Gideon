// routes/externalBetting.js - Fetch betting data from database and external APIs
import express from 'express';
import axios from 'axios';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { emitLeaderboardUpdate } from '../socket/leaderboardSocket.js';

const router = express.Router();

// Store session data for credential management
let sessionData = {
  username: 'admin.jell',
  password: 'adminjell',
  cookies: '',
  lastFetch: null
};

// Store historical draws data
let historicalDraws = new Map(); // Use Map to store by draw ID for easy updates
let isHistoricalDataLoaded = false; // Flag to track if data has been loaded from DB

/**
 * Load historical draws data from database
 */
async function loadHistoricalDataFromDB() {
  if (isHistoricalDataLoaded) return; // Already loaded

  try {
    console.log('📊 Loading historical draws data from database...');

    // Import mongoose dynamically to avoid circular dependencies
    const mongoose = (await import('mongoose')).default;

    // Connect to database if not already connected
    if (mongoose.connection.readyState !== 1) {
      await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/rmi-teller-report');
    }

    const draws = await mongoose.connection.db.collection('draws').find({}).toArray();

    draws.forEach(draw => {
      if (draw.id) {
        historicalDraws.set(draw.id, draw);
      }
    });

    isHistoricalDataLoaded = true;
    console.log(`✅ Loaded ${historicalDraws.size} historical draws from database`);

  } catch (error) {
    console.error('❌ Error loading historical data from database:', error);
  }
}

/**
 * GET /api/external-betting/debug
 * Debug endpoint to test login and see raw HTML
 */
router.get('/debug', requireAuth, requireRole(['admin', 'super_admin']), async (req, res) => {
  try {
    const client = axios.create();
    
    // Step 1: Login to GTArena
    const loginUrl = 'https://rmi-gideon.gtarena.ph/login';
    console.log(`🔐 [DEBUG] Attempting login to ${loginUrl}`);
    const loginResponse = await client.post(loginUrl, 
      `username=${sessionData.username}&password=${sessionData.password}`,
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        validateStatus: () => true
      }
    );
    console.log(`📊 [DEBUG] Login response status: ${loginResponse.status}`);

    // Get cookies from login response
    const cookies = loginResponse.headers['set-cookie']?.join('; ') || '';
    console.log(`🍪 [DEBUG] Cookies: ${cookies.substring(0, 100)}...`);
    
    // Step 2: Fetch betting data page
    const bettingUrl = 'https://rmi-gideon.gtarena.ph/reports/event/page';
    console.log(`📥 [DEBUG] Fetching ${bettingUrl}`);
    const bettingResponse = await client.get(bettingUrl, {
      headers: {
        'Cookie': cookies,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      validateStatus: () => true
    });
    console.log(`📄 [DEBUG] Response status: ${bettingResponse.status}, length: ${bettingResponse.data.length}`);

    // Return debug info
    res.json({
      loginStatus: loginResponse.status,
      bettingPageStatus: bettingResponse.status,
      pageLength: bettingResponse.data.length,
      htmlPreview: bettingResponse.data.substring(0, 2000),
      tablesFound: (bettingResponse.data.match(/<table/g) || []).length,
      trFound: (bettingResponse.data.match(/<tr/g) || []).length,
      tdFound: (bettingResponse.data.match(/<td/g) || []).length
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/external-betting/import-historical
 * Import historical fight data (admin only)
 */
router.post('/import-historical', requireAuth, requireRole(['admin', 'super_admin']), async (req, res) => {
  try {
    const { fights } = req.body;

    if (!Array.isArray(fights)) {
      return res.status(400).json({ error: 'Fights must be an array' });
    }

    // Import mongoose dynamically to avoid circular dependencies
    const mongoose = (await import('mongoose')).default;

    // Connect to database if not already connected
    if (mongoose.connection.readyState !== 1) {
      await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/rmi-teller-report');
    }

    let importedCount = 0;
    for (const fight of fights) {
      if (!historicalDraws.has(fight.id)) {
        historicalDraws.set(fight.id, fight);
        importedCount++;

        // Save to database
        try {
          await mongoose.connection.db.collection('draws').updateOne(
            { id: fight.id },
            { $set: fight },
            { upsert: true }
          );
        } catch (dbError) {
          console.error(`❌ Error saving fight ${fight.id} to database:`, dbError);
        }
      }
    }

    console.log(`📊 Imported ${importedCount} historical fights. Total historical draws: ${historicalDraws.size}`);

    // Emit leaderboard update to connected clients
    const io = req.app.io;
    if (io) {
      const allDraws = Array.from(historicalDraws.values());
      allDraws.sort((a, b) => (a.batch?.fightSequence || 0) - (b.batch?.fightSequence || 0));

      emitLeaderboardUpdate(io, {
        draws: allDraws,
        currentDraw: allDraws[allDraws.length - 1] || null,
        totalDraws: allDraws.length
      });
    }

    res.json({
      success: true,
      imported: importedCount,
      total: historicalDraws.size,
      message: `Successfully imported ${importedCount} historical fights`
    });

  } catch (err) {
    console.error('❌ Error importing historical data:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/external-betting/teller-bets
 * Fetch teller betting data from database (admin/super_admin only)
 */
router.get('/teller-bets', requireAuth, requireRole(['admin', 'super_admin']), async (req, res) => {
  try {
    console.log('📡 Fetching teller betting data from database...');

    // Connect to database
    const mongoose = (await import('mongoose')).default;
    if (mongoose.connection.readyState !== 1) {
      await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/rmi-teller-report');
    }

    const now = new Date();
    const manilaTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Manila' }));
    const todayStart = new Date(manilaTime.getFullYear(), manilaTime.getMonth(), manilaTime.getDate(), 0, 0, 0);
    const todayEnd = new Date(manilaTime.getFullYear(), manilaTime.getMonth(), manilaTime.getDate(), 23, 59, 59);

    console.log(`📅 Looking for teller reports between ${todayStart.toISOString()} and ${todayEnd.toISOString()}`);

    // Query today's teller reports from database
    const todaysReports = await mongoose.connection.db.collection('tellerreports').find({
      createdAt: {
        $gte: todayStart,
        $lte: todayEnd
      }
    }).toArray();

    console.log(`📊 Found ${todaysReports.length} teller reports for today in database`);

    // Get user information for teller names
    const tellerIds = todaysReports.map(report => report.tellerId).filter(id => id);
    const users = await mongoose.connection.db.collection('users').find({
      _id: { $in: tellerIds.map(id => new mongoose.Types.ObjectId(id)) }
    }).toArray();

    // Create a map of tellerId to username
    const userMap = new Map();
    users.forEach(user => {
      userMap.set(user._id.toString(), user.username || user.name);
    });

    // Transform the data to match expected format
    const bettingData = todaysReports.map(report => {
      const username = userMap.get(report.tellerId) || `teller_${report.tellerId?.slice(-4) || 'unknown'}`;
      const totalBet = report.totalBet || 0;
      const systemBalance = report.systemBalance || 0;

      // Calculate MW bet percentage (mock calculation based on available data)
      const mwBetPercent = totalBet > 0 ? ((systemBalance / totalBet) * 100) : 0;

      return {
        username: username,
        name: username,
        totalBet: totalBet,
        mwBetPercent: Math.round(mwBetPercent * 10) / 10, // Round to 1 decimal
        systemBalance: systemBalance,
        cashOnHand: report.cashOnHand || 0,
        short: report.short || 0,
        over: report.over || 0,
        fetchedAt: new Date()
      };
    });

    // If no data found, return demo data
    if (bettingData.length === 0) {
      console.log('⚠️ No teller reports found for today, showing demo data');
      return res.json({
        success: true,
        data: [
          { username: 'teller_1', name: 'teller_1', totalBet: 15000, mwBetPercent: 45.5, systemBalance: 6750, cashOnHand: 15000, short: 0, over: 0, fetchedAt: new Date() },
          { username: 'teller_2', name: 'teller_2', totalBet: 12500, mwBetPercent: 38.2, systemBalance: 4775, cashOnHand: 12500, short: 0, over: 0, fetchedAt: new Date() },
          { username: 'teller_3', name: 'teller_3', totalBet: 8750, mwBetPercent: 52.1, systemBalance: 4560, cashOnHand: 8750, short: 0, over: 0, fetchedAt: new Date() },
          { username: 'teller_4', name: 'teller_4', totalBet: 6200, mwBetPercent: 41.7, systemBalance: 2585, cashOnHand: 6200, short: 0, over: 0, fetchedAt: new Date() },
          { username: 'teller_5', name: 'teller_5', totalBet: 4500, mwBetPercent: 35.9, systemBalance: 1616, cashOnHand: 4500, short: 0, over: 0, fetchedAt: new Date() }
        ],
        isDemo: true,
        message: 'No teller reports found for today. Showing demo data.',
        lastFetch: new Date(),
        source: "database",
        dateRange: {
          start: todayStart.toISOString(),
          end: todayEnd.toISOString()
        }
      });
    }

    console.log(`✅ Successfully processed ${bettingData.length} teller records from database`);
    res.json({
      success: true,
      data: bettingData,
      isDemo: false,
      lastFetch: new Date(),
      source: "database",
      dateRange: {
        start: todayStart.toISOString(),
        end: todayEnd.toISOString()
      },
      message: `Returning ${bettingData.length} teller reports from today (${manilaTime.getMonth() + 1}/${manilaTime.getDate()}/${manilaTime.getFullYear()})`
    });

  } catch (err) {
    console.error('❌ Error fetching teller betting data:', err.message);
    // Fall back to demo data on error
    res.json({
      success: true,
      data: [
        { username: 'teller_1', name: 'teller_1', totalBet: 15000, mwBetPercent: 45.5, systemBalance: 6750, cashOnHand: 15000, short: 0, over: 0, fetchedAt: new Date() },
        { username: 'teller_2', name: 'teller_2', totalBet: 12500, mwBetPercent: 38.2, systemBalance: 4775, cashOnHand: 12500, short: 0, over: 0, fetchedAt: new Date() },
        { username: 'teller_3', name: 'teller_3', totalBet: 8750, mwBetPercent: 52.1, systemBalance: 4560, cashOnHand: 8750, short: 0, over: 0, fetchedAt: new Date() },
        { username: 'teller_4', name: 'teller_4', totalBet: 6200, mwBetPercent: 41.7, systemBalance: 2585, cashOnHand: 6200, short: 0, over: 0, fetchedAt: new Date() },
        { username: 'teller_5', name: 'teller_5', totalBet: 4500, mwBetPercent: 35.9, systemBalance: 1616, cashOnHand: 4500, short: 0, over: 0, fetchedAt: new Date() }
      ],
      isDemo: true,
      message: `Error fetching data from database: ${err.message}. Showing demo data.`,
      lastFetch: new Date(),
      error: err.message
    });
  }
});

/**
 * GET /api/external-betting/status
 * Check if credentials are configured
 */
router.get('/status', async (req, res) => {
  res.json({
    configured: !!sessionData.username,
    lastFetch: sessionData.lastFetch
  });
});



/**
 * GET /api/external-betting/leaderboard
 * Fetch leaderboard data from API (no scraping)
 */
router.get('/leaderboard', async (req, res) => {
  try {
    console.log('📡 Fetching leaderboard data from API...');

    // Connect to database
    const mongoose = (await import('mongoose')).default;
    if (mongoose.connection.readyState !== 1) {
      await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/rmi-teller-report');
    }

    const now = new Date();
    const manilaTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Manila' }));
    const todayStart = new Date(manilaTime.getFullYear(), manilaTime.getMonth(), manilaTime.getDate(), 0, 0, 0);
    const todayEnd = new Date(manilaTime.getFullYear(), manilaTime.getMonth(), manilaTime.getDate(), 23, 59, 59);

    console.log(`📅 Looking for fights between ${todayStart.toISOString()} and ${todayEnd.toISOString()}`);

    // Query from database - try both date ranges
    // First try with Manila time
    let todaysDraws = await mongoose.connection.db.collection('draws').find({
      createdAt: {
        $gte: todayStart,
        $lte: todayEnd
      }
    }).sort({ 'batch.fightSequence': -1 }).toArray();

    console.log(`📊 Found ${todaysDraws.length} fights for today (Manila time) in database`);

    // If no fights found, try searching without date filter (last 50 fights)
    if (todaysDraws.length === 0) {
      console.log('⚠️ No fights found for today, searching for recent fights...');
      todaysDraws = await mongoose.connection.db.collection('draws').find({})
        .sort({ createdAt: -1 })
        .limit(50)
        .toArray();
      console.log(`📊 Found ${todaysDraws.length} recent fights (last 50)`);
    }

    // Remove duplicates by fight ID
    const seenFights = new Set();
    todaysDraws = todaysDraws.filter(draw => {
      const fightId = draw.id || draw.fightId;
      if (seenFights.has(fightId)) {
        return false;
      }
      seenFights.add(fightId);
      return true;
    });

    console.log(`📊 After deduplication: ${todaysDraws.length} unique fights`);

    // If still no fights found, provide demo data
    if (todaysDraws.length === 0) {
      console.log('⚠️ No fights found in database, providing demo data');
      todaysDraws = [
        {
          id: "demo-1",
          fightNumber: 1,
          status: "completed",
          result1: "meron",
          result2: "wala",
          totalBets: 1250,
          createdAt: new Date().toISOString(),
          batch: { fightSequence: 1 },
          fighters: {
            meron: { name: "Rooster A", odds: 1.85 },
            wala: { name: "Rooster B", odds: 1.95 }
          },
          winner: { name: "Rooster A", result: "meron" }
        },
        {
          id: "demo-2",
          fightNumber: 2,
          status: "completed",
          result1: "wala",
          result2: "meron",
          totalBets: 980,
          createdAt: new Date().toISOString(),
          batch: { fightSequence: 2 },
          fighters: {
            meron: { name: "Rooster C", odds: 2.10 },
            wala: { name: "Rooster D", odds: 1.75 }
          },
          winner: { name: "Rooster D", result: "wala" }
        },
        {
          id: "demo-3",
          fightNumber: 3,
          status: "active",
          result1: null,
          result2: null,
          totalBets: 1540,
          createdAt: new Date().toISOString(),
          batch: { fightSequence: 3 },
          fighters: {
            meron: { name: "Rooster E", odds: 1.65 },
            wala: { name: "Rooster F", odds: 2.25 }
          }
        },
        {
          id: "demo-4",
          fightNumber: 4,
          status: "pending",
          result1: null,
          result2: null,
          totalBets: 0,
          createdAt: new Date().toISOString(),
          batch: { fightSequence: 4 },
          fighters: {
            meron: { name: "Rooster G", odds: 1.90 },
            wala: { name: "Rooster H", odds: 1.85 }
          }
        },
        {
          id: "demo-5",
          fightNumber: 5,
          status: "pending",
          result1: null,
          result2: null,
          totalBets: 0,
          createdAt: new Date().toISOString(),
          batch: { fightSequence: 5 },
          fighters: {
            meron: { name: "Rooster I", odds: 2.05 },
            wala: { name: "Rooster J", odds: 1.80 }
          }
        }
      ];
    }

    res.json({
      success: true,
      data: todaysDraws,
      totalDraws: todaysDraws.length,
      fetchedAt: new Date().toISOString(),
      message: todaysDraws.length > 0 && todaysDraws[0].id?.startsWith('demo-')
        ? `Demo data: ${todaysDraws.length} sample fights`
        : `Returning ${todaysDraws.length} fights from today (${manilaTime.getMonth() + 1}/${manilaTime.getDate()}/${manilaTime.getFullYear()})`,
      source: todaysDraws.length > 0 && todaysDraws[0].id?.startsWith('demo-') ? "demo-data" : "database",
      dateRange: {
        start: todayStart.toISOString(),
        end: todayEnd.toISOString()
      }
    });

  } catch (err) {
    console.error('❌ Error fetching leaderboard data:', err.message);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch leaderboard data',
      error: err.message
    });
  }
});

/**
 * GET /api/external-betting/player-leaderboard
 * Fetch player leaderboard data from GTArena (public access for frontend)
 * Query params: external, internal, demo (booleans)
 */
router.get('/player-leaderboard', async (req, res) => {
  try {
    console.log('🎮 Fetching player leaderboard data...');

    const { external = 'true', internal = 'true', demo = 'true' } = req.query;
    const sources = {
      external: external === 'true',
      internal: internal === 'true',
      demo: demo === 'true'
    };

    console.log('📊 Requested sources:', sources);

    let combinedData = [];
    let sourceInfo = [];

    // Try external API if enabled
    if (sources.external) {
      try {
        console.log('🔗 Fetching from external GTA leaderboard page (HTML parsing)...');

        // Fetch the leaderboard HTML page
        const leaderboardResponse = await axios.get('http://122.3.203.8/leaderboard', {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Accept-Encoding': 'gzip, deflate',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1'
          },
          timeout: 15000,
          validateStatus: (status) => status < 500
        });

        if (leaderboardResponse.status === 200 && leaderboardResponse.data) {
          const html = leaderboardResponse.data;
          console.log(`📄 Received HTML page (${html.length} characters)`);

          // Extract leaderboard data from data-page attribute
          const dataPageMatch = html.match(/data-page="([^"]*)"/);
          if (dataPageMatch) {
            try {
              const encodedData = dataPageMatch[1];
              const decodedData = encodedData.replace(/&quot;/g, '"').replace(/&amp;/g, '&');
              const pageData = JSON.parse(decodedData);

              console.log('📊 Extracted page data keys:', Object.keys(pageData));

              // Extract leaderboard data from the page props
              let leaderboardData = [];

              // Check if there's leaderboard data in the props
              if (pageData.props && pageData.props.leaderboard) {
                leaderboardData = pageData.props.leaderboard;
              } else if (pageData.props && pageData.props.players) {
                leaderboardData = pageData.props.players;
              } else if (pageData.props && pageData.props.data && Array.isArray(pageData.props.data)) {
                leaderboardData = pageData.props.data;
              }

              // If no direct leaderboard data, try to extract from draws or other structures
              if (leaderboardData.length === 0 && pageData.props && pageData.props.draws) {
                const draws = pageData.props.draws;
                if (Array.isArray(draws)) {
                  // Extract player data from draws
                  const playerMap = new Map();

                  draws.forEach(draw => {
                    if (draw.bets && Array.isArray(draw.bets)) {
                      draw.bets.forEach(bet => {
                        const playerName = bet.playerName || bet.username || bet.name;
                        if (playerName) {
                          if (!playerMap.has(playerName)) {
                            playerMap.set(playerName, {
                              name: playerName,
                              username: playerName,
                              totalBets: 0,
                              totalAmount: 0,
                              wins: 0,
                              losses: 0
                            });
                          }
                          const player = playerMap.get(playerName);
                          player.totalBets += 1;
                          player.totalAmount += bet.amount || bet.betAmount || 0;

                          // Check if bet won
                          if (checkIfBetWon(bet, draw)) {
                            player.wins += 1;
                          } else {
                            player.losses += 1;
                          }
                        }
                      });
                    }
                  });

                  // Convert to leaderboard format
                  leaderboardData = Array.from(playerMap.values()).map((player, index) => ({
                    rank: index + 1,
                    name: player.name,
                    username: player.username,
                    score: player.totalAmount,
                    points: Math.floor(player.totalAmount / 100),
                    wins: player.wins,
                    losses: player.losses,
                    winRate: player.wins + player.losses > 0 ? ((player.wins / (player.wins + player.losses)) * 100).toFixed(1) : 0,
                    totalBets: player.totalBets,
                    totalAmount: player.totalAmount
                  })).sort((a, b) => b.points - a.points);
                }
              }

              // Filter and structure the data
              const validLeaderboardData = leaderboardData
                .filter(player => player && (player.name || player.username || player.playerName))
                .map((player, index) => ({
                  rank: player.rank || index + 1,
                  name: player.name || player.playerName || player.username,
                  username: player.username || player.name || player.playerName,
                  score: player.score || player.points || player.totalAmount || 0,
                  points: player.points || player.score || Math.floor((player.totalAmount || 0) / 100) || 0,
                  wins: player.wins || 0,
                  losses: player.losses || 0,
                  winRate: player.winRate || (player.wins && player.losses ? (player.wins / (player.wins + player.losses) * 100).toFixed(1) : 0),
                  totalBets: player.totalBets || 0,
                  totalAmount: player.totalAmount || 0
                }))
                .sort((a, b) => (b.points || 0) - (a.points || 0))
                .slice(0, 50); // Top 50 players

              if (validLeaderboardData.length > 0) {
                combinedData.push(...validLeaderboardData);
                sourceInfo.push('gta-leaderboard-html');
                console.log(`✅ Extracted ${validLeaderboardData.length} players from GTA leaderboard HTML`);
              } else {
                console.log('⚠️ No leaderboard data found in HTML page data');
              }

            } catch (parseError) {
              console.error('❌ Error parsing leaderboard HTML data:', parseError.message);
              sourceInfo.push('external-html-parse-failed');
            }
          } else {
            console.log('⚠️ No data-page attribute found in HTML');
            sourceInfo.push('external-no-data-page');
          }
        }

      } catch (err) {
        console.log('❌ External GTA leaderboard HTML fetch failed:', err.message);
        sourceInfo.push('external-html-failed');
      }
    }

    // Try internal data if enabled
    if (sources.internal) {
      try {
        console.log('🏠 Fetching internal leaderboard data from database...');

        // Connect to database
        const mongoose = (await import('mongoose')).default;
        if (mongoose.connection.readyState !== 1) {
          await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/rmi-teller-report');
        }

        // Get today's date range in Manila timezone
        const now = new Date();
        const manilaTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Manila' }));
        const todayStart = new Date(manilaTime.getFullYear(), manilaTime.getMonth(), manilaTime.getDate(), 0, 0, 0);
        const todayEnd = new Date(manilaTime.getFullYear(), manilaTime.getMonth(), manilaTime.getDate(), 23, 59, 59);

        // Query draws and bets data for leaderboard calculation
        const todaysDraws = await mongoose.connection.db.collection('draws').find({
          createdAt: { $gte: todayStart, $lte: todayEnd }
        }).toArray();

        const todaysBets = await mongoose.connection.db.collection('bets').find({
          createdAt: { $gte: todayStart, $lte: todayEnd }
        }).toArray();

        // Calculate player statistics from bets data
        const playerStats = new Map();

        todaysBets.forEach(bet => {
          const playerName = bet.playerName || bet.username || bet.name;
          if (!playerName) return;

          if (!playerStats.has(playerName)) {
            playerStats.set(playerName, {
              name: playerName,
              username: playerName,
              totalBets: 0,
              totalAmount: 0,
              wins: 0,
              losses: 0,
              winAmount: 0,
              lossAmount: 0
            });
          }

          const stats = playerStats.get(playerName);
          stats.totalBets += 1;
          stats.totalAmount += bet.amount || bet.betAmount || 0;

          // Check if this bet won based on draw results
          const relatedDraw = todaysDraws.find(draw => draw.id === bet.drawId || draw.fightId === bet.fightId);
          if (relatedDraw) {
            const betWon = checkIfBetWon(bet, relatedDraw);
            if (betWon) {
              stats.wins += 1;
              stats.winAmount += bet.amount || bet.betAmount || 0;
            } else {
              stats.losses += 1;
              stats.lossAmount += bet.amount || bet.betAmount || 0;
            }
          }
        });

        // Convert to leaderboard format
        const internalLeaderboardData = Array.from(playerStats.values())
          .map((stats, index) => ({
            rank: index + 1,
            name: stats.name,
            username: stats.username,
            score: stats.totalAmount,
            points: Math.floor(stats.totalAmount / 100), // Points based on total bet amount
            wins: stats.wins,
            losses: stats.losses,
            winRate: stats.wins + stats.losses > 0 ? ((stats.wins / (stats.wins + stats.losses)) * 100).toFixed(1) : 0,
            totalBets: stats.totalBets,
            totalAmount: stats.totalAmount
          }))
          .sort((a, b) => b.points - a.points) // Sort by points descending
          .slice(0, 50); // Top 50 players

        if (internalLeaderboardData.length > 0) {
          combinedData.push(...internalLeaderboardData);
          sourceInfo.push('internal-database');
          console.log(`✅ Fetched ${internalLeaderboardData.length} players from internal database`);
        } else {
          console.log('⚠️ No internal leaderboard data found for today');
        }

      } catch (err) {
        console.log('❌ Internal database query failed:', err.message);
      }
    }

    // Use demo data if enabled and no other data or if demo is specifically requested
    if (sources.demo && (combinedData.length === 0 || sources.demo)) {
      console.log('🎭 Using demo data...');
      const demoData = [
        {
          rank: 1,
          name: "Player One",
          username: "player1",
          score: 15420,
          points: 1250,
          wins: 45,
          losses: 12
        },
        {
          rank: 2,
          name: "Player Two",
          username: "player2",
          score: 14850,
          points: 1180,
          wins: 42,
          losses: 15
        },
        {
          rank: 3,
          name: "Player Three",
          username: "player3",
          score: 13990,
          points: 1120,
          wins: 38,
          losses: 18
        },
        {
          rank: 4,
          name: "Player Four",
          username: "player4",
          score: 13200,
          points: 1050,
          wins: 35,
          losses: 22
        },
        {
          rank: 5,
          name: "Player Five",
          username: "player5",
          score: 12800,
          points: 980,
          wins: 32,
          losses: 25
        }
      ];
      combinedData = demoData;
      sourceInfo.push('demo-data');
    }

    const isDemo = sourceInfo.includes('demo-data') && combinedData.length > 0;

    console.log(`✅ Returning leaderboard data from: ${sourceInfo.join(', ')}`);

    res.json({
      success: true,
      data: combinedData,
      count: combinedData.length,
      fetchedAt: new Date().toISOString(),
      source: sourceInfo.join(', '),
      message: `Data from: ${sourceInfo.join(', ')}`,
      isDemo: isDemo,
      sourcesUsed: sourceInfo
    });

  } catch (err) {
    console.error('❌ Error in player leaderboard endpoint:', err.message);

    // Fallback demo data
    const fallbackData = [
      {
        rank: 1,
        name: "Player One",
        username: "player1",
        score: 15420,
        points: 1250,
        wins: 45,
        losses: 12
      },
      {
        rank: 2,
        name: "Player Two",
        username: "player2",
        score: 14850,
        points: 1180,
        wins: 42,
        losses: 15
      },
      {
        rank: 3,
        name: "Player Three",
        username: "player3",
        score: 13990,
        points: 1120,
        wins: 38,
        losses: 18
      },
    ];

    res.json({
      success: true,
      data: fallbackData,
      count: fallbackData.length,
      fetchedAt: new Date().toISOString(),
      source: 'fallback-demo',
      message: 'Using fallback demo data due to error',
      isDemo: true,
      error: err.message
    });
  }
});

/**
 * GET /api/external-betting/chicken-fight-bets
 * Fetch chicken fight betting data from database
 */
router.get('/chicken-fight-bets', requireAuth, requireRole(['admin', 'super_admin']), async (req, res) => {
  try {
    console.log('🐔 Fetching chicken fight betting data from database...');

    // Connect to database
    const mongoose = (await import('mongoose')).default;
    if (mongoose.connection.readyState !== 1) {
      await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/rmi-teller-report');
    }

    const now = new Date();
    const manilaTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Manila' }));
    const todayStart = new Date(manilaTime.getFullYear(), manilaTime.getMonth(), manilaTime.getDate(), 0, 0, 0);
    const todayEnd = new Date(manilaTime.getFullYear(), manilaTime.getMonth(), manilaTime.getDate(), 23, 59, 59);

    // Fetch today's bets
    const todaysBets = await mongoose.connection.db.collection('bets').find({
      createdAt: {
        $gte: todayStart,
        $lte: todayEnd
      }
    }).toArray();

    // Fetch today's entries
    const todaysEntries = await mongoose.connection.db.collection('entries').find({
      createdAt: {
        $gte: todayStart,
        $lte: todayEnd
      }
    }).toArray();

    // Calculate totals
    const totalAmount = todaysBets.reduce((sum, bet) => sum + (bet.amount || 0), 0);
    const totalBets = todaysBets.length;

    // Check if betting is still open (no closed status in recent entries)
    const recentEntries = await mongoose.connection.db.collection('entries').find({
      createdAt: {
        $gte: new Date(Date.now() - 5 * 60 * 1000) // Last 5 minutes
      }
    }).toArray();

    const bettingStatus = recentEntries.some(entry => entry.status === 'closed') ? 'closed' : 'open';

    const bettingData = {
      totalBets: totalBets,
      totalAmount: totalAmount,
      bettingStatus: bettingStatus,
      currentFight: null,
      fights: todaysEntries,
      lastUpdated: new Date().toISOString()
    };

    console.log(`✅ Successfully fetched chicken fight betting: ${bettingData.totalBets} bets, ₱${bettingData.totalAmount.toLocaleString()}, status: ${bettingData.bettingStatus}`);

    res.json({
      success: true,
      data: bettingData
    });

  } catch (err) {
    console.error('❌ Error fetching chicken fight betting data:', err.message);
    res.status(500).json({
      success: false,
      error: err.message,
      message: 'Failed to fetch chicken fight betting data'
    });
  }
});

/**
 * Test login credentials to verify they work
 */
export async function testLoginCredentials() {
  try {
    console.log('🔍 Testing login credentials...');

    const client = axios.create();
    const loginUrl = 'https://rmi-gideon.gtarena.ph/login';

    const loginResponse = await client.post(loginUrl,
      `username=${sessionData.username}&password=${sessionData.password}`,
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        validateStatus: () => true,
        timeout: 10000,
        maxRedirects: 5
      }
    );

    if (loginResponse.status === 200 || loginResponse.status === 302) {
      console.log('✅ Login credentials are valid');
      return { success: true, status: loginResponse.status };
    } else {
      console.error('❌ Login credentials are invalid');
      console.error('Status:', loginResponse.status);
      console.error('Response:', loginResponse.data);
      return { success: false, status: loginResponse.status, error: loginResponse.data };
    }
  } catch (err) {
    console.error('❌ Error testing login credentials:', err.message);
    return { success: false, error: err.message };
  }
}
export async function fetchChickenFightBettingData() {
  try {
    console.log('🐔 [SCRAPER] Fetching chicken fight betting from GTArena...');

    const client = axios.create();

    // Login
    const loginUrl = 'https://rmi-gideon.gtarena.ph/login';
    console.log(`🔐 [SCRAPER] Attempting login to ${loginUrl} with user: ${sessionData.username}`);

    const loginResponse = await client.post(loginUrl,
      `username=${sessionData.username}&password=${sessionData.password}`,
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        validateStatus: () => true,
        timeout: 15000,
        maxRedirects: 5
      }
    );

    console.log(`🔐 [SCRAPER] Login response status: ${loginResponse.status}`);

    if (loginResponse.status !== 200 && loginResponse.status !== 302) {
      console.error(`❌ [SCRAPER] Login failed with status ${loginResponse.status}`);
      console.error(`❌ [SCRAPER] Response headers:`, loginResponse.headers);
      console.error(`❌ [SCRAPER] Response data:`, loginResponse.data);
      throw new Error(`Login failed with status ${loginResponse.status}`);
    }

    const cookies = loginResponse.headers['set-cookie']?.join('; ') || '';
    if (!cookies) {
      console.warn('⚠️ [SCRAPER] No cookies received from login');
    } else {
      console.log('✅ [SCRAPER] Login successful, cookies received');
    }

    // Fetch betting page - now using leaderboard for more accurate data
    const chickenFightUrl = 'https://rmi-gideon.gtarena.ph/leaderboard';
    const bettingResponse = await client.get(chickenFightUrl, {
      headers: {
        'Cookie': cookies,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
      },
      validateStatus: () => true,
      timeout: 15000
    });

    console.log(`📄 [SCRAPER] Leaderboard page status: ${bettingResponse.status}`);

    if (bettingResponse.status !== 200) {
      throw new Error(`Failed to fetch betting page: ${bettingResponse.status}`);
    }

    // Parse HTML using cheerio for accurate data extraction
    const $ = cheerio.load(bettingResponse.data);

    let totalAmount = 0;
    let totalBets = 0;
    let bettingStatus = 'open';

    // Parse leaderboard data similar to leaderboardUpdate.js
    $('.draw-container, .draw-item, [class*="draw"]').each((index, element) => {
      try {
        const $draw = $(element);

        // Extract betting amounts for each draw
        const redTotalBet = parseFloat(
          $draw.find('.red-total, .meron-total, [class*="red"], [class*="meron"]').text().replace(/[^0-9.-]/g, '') || '0'
        );
        const blueTotalBet = parseFloat(
          $draw.find('.blue-total, .wala-total, [class*="blue"], [class*="wala"]').text().replace(/[^0-9.-]/g, '') || '0'
        );
        const drawTotalBet = parseFloat(
          $draw.find('.draw-total, .tie-total, [class*="draw"], [class*="tie"]').text().replace(/[^0-9.-]/g, '') || '0'
        );

        // Add to totals
        totalAmount += redTotalBet + blueTotalBet + drawTotalBet;
        if (redTotalBet > 0) totalBets++;
        if (blueTotalBet > 0) totalBets++;
        if (drawTotalBet > 0) totalBets++;

        // Check for betting status
        const drawText = $draw.text().toLowerCase();
        if (drawText.includes('closed') || drawText.includes('tutup') || drawText.includes('finished')) {
          bettingStatus = 'closed';
        }
      } catch (parseError) {
        console.warn(`⚠️ Failed to parse draw ${index}:`, parseError.message);
      }
    });

    // If no structured data found, fall back to text parsing
    if (totalAmount === 0) {
      console.log('🔄 No structured data found, trying text parsing...');
      const pageText = $('body').text();

      // Parse status
      const statusLower = pageText.toLowerCase();
      if (statusLower.includes('closed') || statusLower.includes('tutup')) {
        bettingStatus = 'closed';
      }

      // Parse amounts using regex
      const amounts = pageText.match(/\d{2,}|\d{1,}\,\d{3}/g) || [];
      amounts.forEach(amountStr => {
        const parsed = parseFloat(amountStr.replace(/,/g, ''));
        if (parsed >= 100 && parsed <= 1000000000) {
          totalAmount += parsed;
          totalBets += 1;
        }
      });
    }

    const bettingData = {
      totalBets: totalBets,
      totalAmount: totalAmount,
      bettingStatus: bettingStatus,
      currentFight: null,
      source: 'gtarena-leaderboard',
      lastUpdated: new Date().toISOString()
    };

    console.log(`💰 [SCRAPER] Found: ${bettingData.totalBets} bets, ₱${bettingData.totalAmount.toLocaleString()}`);
    return bettingData;

  } catch (err) {
    console.error('❌ [SCRAPER] Error:', err.message);
    if (err.response) {
      console.error('❌ [SCRAPER] Response status:', err.response.status);
      console.error('❌ [SCRAPER] Response headers:', err.response.headers);
      console.error('❌ [SCRAPER] Response data:', err.response.data);
    } else if (err.code) {
      console.error('❌ [SCRAPER] Network error code:', err.code);
    }

    // Return fallback data that won't break the system
    return {
      totalBets: 0,
      totalAmount: 0,
      bettingStatus: 'open',
      source: 'gtarena-leaderboard',
      lastUpdated: new Date().toISOString(),
      error: err.message,
      isDemo: true
    };
  }
}

/**
 * Proxy endpoint for GTA betting event report
 * Fetches from external API: http://122.3.203.8/api/m/secure/report/event
 * with X-TOKEN authentication
 */
router.get('/gta-event-report-proxy', async (req, res) => {
  try {
    const externalUrl = 'http://122.3.203.8/api/m/secure/report/event';
    const xToken = 'af9735e1c7857a07f0b078df36842ace';

    console.log('🔄 Fetching GTA event report from external API...');

    const response = await axios.get(externalUrl, {
      headers: {
        'X-TOKEN': xToken,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      timeout: 10000
    });

    console.log('✅ GTA event report fetched successfully');

    // Return success response
    res.json({
      success: true,
      data: response.data
    });

  } catch (error) {
    console.error('❌ Error fetching GTA event report:', error.message);

    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch GTA event report',
      message: 'Failed to fetch betting event data from external API'
    });
  }
});

/**
 * Proxy endpoint for GTA leaderboard
 * Fetches from external API: http://122.3.203.8/leaderboard
 * With improved error handling and fallback data
 */
router.get('/gta-leaderboard-proxy', async (req, res) => {
  try {
    const externalUrl = 'http://122.3.203.8/leaderboard';

    console.log('🔄 Fetching GTA leaderboard from external API...');

    const response = await axios.get(externalUrl, {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      timeout: 15000, // Increased timeout
      validateStatus: (status) => status < 500 // Accept any status below 500
    });

    console.log(`📊 External API response status: ${response.status}`);

    // Check if we got valid data
    if (response.status === 200 && response.data) {
      // Validate that we have an array of leaderboard data
      let leaderboardData = response.data;

      // Handle different response formats
      if (typeof leaderboardData === 'string') {
        try {
          leaderboardData = JSON.parse(leaderboardData);
        } catch (parseError) {
          console.warn('⚠️ Failed to parse response as JSON:', parseError.message);
          leaderboardData = [];
        }
      }

      // Ensure it's an array
      if (!Array.isArray(leaderboardData)) {
        if (leaderboardData.data && Array.isArray(leaderboardData.data)) {
          leaderboardData = leaderboardData.data;
        } else if (leaderboardData.players && Array.isArray(leaderboardData.players)) {
          leaderboardData = leaderboardData.players;
        } else if (leaderboardData.leaderboard && Array.isArray(leaderboardData.leaderboard)) {
          leaderboardData = leaderboardData.leaderboard;
        } else {
          console.warn('⚠️ Unexpected data format, wrapping in array');
          leaderboardData = [leaderboardData];
        }
      }

      // Filter out invalid entries and ensure proper structure
      const validData = leaderboardData.filter(player =>
        player &&
        (player.name || player.username || player.playerName) &&
        typeof player === 'object'
      );

      console.log(`✅ GTA leaderboard fetched successfully: ${validData.length} players`);

      // Return success response with validated data
      res.json({
        success: true,
        data: validData,
        count: validData.length,
        fetchedAt: new Date().toISOString(),
        source: 'external-api'
      });
    } else {
      console.warn(`⚠️ External API returned status ${response.status} with data:`, response.data);
      throw new Error(`API returned status ${response.status}`);
    }

  } catch (error) {
    console.error('❌ Error fetching GTA leaderboard:', error.message);

    // Provide fallback demo data when external API fails
    const fallbackData = [
      {
        name: "Player One",
        username: "player1",
        score: 15420,
        points: 1250,
        wins: 45,
        losses: 12,
        rank: 1
      },
      {
        name: "Player Two",
        username: "player2",
        score: 14850,
        points: 1180,
        wins: 42,
        losses: 15,
        rank: 2
      },
      {
        name: "Player Three",
        username: "player3",
        score: 13990,
        points: 1120,
        wins: 38,
        losses: 18,
        rank: 3
      },
      {
        name: "Player Four",
        username: "player4",
        score: 13200,
        points: 1050,
        wins: 35,
        losses: 22,
        rank: 4
      },
      {
        name: "Player Five",
        username: "player5",
        score: 12800,
        points: 980,
        wins: 32,
        losses: 25,
        rank: 5
      }
    ];

    console.log('🔄 External API failed, returning fallback demo data');

    res.json({
      success: true,
      data: fallbackData,
      count: fallbackData.length,
      fetchedAt: new Date().toISOString(),
      source: 'fallback-demo',
      message: `External API unavailable: ${error.message}. Showing demo data.`,
      isDemo: true,
      error: error.message
    });
  }
});

/**
 * Helper function to check if a bet won based on draw result
 */
function checkIfBetWon(bet, draw) {
  try {
    // Get the bet type and selection
    const betType = bet.type || bet.betType || 'meron'; // Default to meron if not specified
    const selection = bet.selection || bet.choice || betType;

    // Get the draw result
    const result = draw.result1 || draw.result; // result1 is typically 'meron' or 'wala'

    if (!result) return false;

    // Normalize the result and selection for comparison
    const normalizedResult = result.toLowerCase().trim();
    const normalizedSelection = selection.toLowerCase().trim();

    // Check if the bet matches the result
    if (normalizedResult === 'meron' && normalizedSelection === 'meron') return true;
    if (normalizedResult === 'wala' && normalizedSelection === 'wala') return true;
    if (normalizedResult === 'draw' && normalizedSelection === 'draw') return true;

    return false;
  } catch (error) {
    console.error('Error checking if bet won:', error);
    return false;
  }
}

export default router;

