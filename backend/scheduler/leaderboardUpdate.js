// scheduler/leaderboardUpdate.js - Periodic leaderboard data fetching and real-time updates
import axios from 'axios';
import * as cheerio from 'cheerio';
import { emitLeaderboardUpdate } from '../socket/leaderboardSocket.js';

let updateInterval = null;
let isRunning = false;

export function initLeaderboardUpdateScheduler(io) {
  if (isRunning) {
    console.log('📊 Leaderboard update scheduler already running');
    return;
  }

  isRunning = true;
  console.log('📊 Starting leaderboard update scheduler...');

  // Function to fetch and emit leaderboard updates
  const fetchAndEmitUpdates = async () => {
    try {
      console.log('🔄 Fetching leaderboard data for live updates...');

      const client = axios.create();

      // Fetch leaderboard page directly (no authentication required for public leaderboard)
      const leaderboardUrl = 'https://rmi-gideon.gtarena.ph/leaderboard';
      console.log(`📥 Fetching leaderboard from: ${leaderboardUrl}`);

      const response = await client.get(leaderboardUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        timeout: 10000
      });

      console.log(`📄 Leaderboard response status: ${response.status}`);

      if (response.status !== 200) {
        throw new Error(`Failed to fetch leaderboard: HTTP ${response.status}`);
      }

      const $ = cheerio.load(response.data);

      // Parse leaderboard data (same logic as externalBetting.js)
      const draws = [];

      // Find all draw containers
      $('.draw-container, .draw-item, [class*="draw"]').each((index, element) => {
        try {
          const $draw = $(element);

          // Extract draw information
          const drawId = $draw.attr('data-draw-id') ||
                        $draw.find('[data-draw-id]').attr('data-draw-id') ||
                        `draw-${index}`;

          const result1 = $draw.find('.result, .winner, [class*="result"]').first().text().trim().toLowerCase();
          const result2 = $draw.find('.result, .winner, [class*="result"]').eq(1).text().trim().toLowerCase();

          // Extract betting amounts
          const redTotalBet = parseFloat(
            $draw.find('.red-total, .meron-total, [class*="red"]').text().replace(/[^0-9.-]/g, '') || '0'
          );
          const blueTotalBet = parseFloat(
            $draw.find('.blue-total, .wala-total, [class*="blue"]').text().replace(/[^0-9.-]/g, '') || '0'
          );
          const drawTotalBet = parseFloat(
            $draw.find('.draw-total, .tie-total, [class*="draw"]').text().replace(/[^0-9.-]/g, '') || '0'
          );

          // Only include draws with actual betting data
          if (redTotalBet > 0 || blueTotalBet > 0 || drawTotalBet > 0) {
            draws.push({
              id: drawId,
              result1: result1 || null,
              result2: result2 || null,
              details: {
                redTotalBetAmount: redTotalBet,
                blueTotalBetAmount: blueTotalBet,
                drawTotalBetAmount: drawTotalBet
              },
              timestamp: new Date().toISOString()
            });
          }
        } catch (parseError) {
          console.warn(`⚠️ Failed to parse draw ${index}:`, parseError.message);
        }
      });

      if (draws.length === 0) {
        // Try alternative parsing method
        console.log('🔄 Trying alternative leaderboard parsing...');

        // Look for table rows or other structures
        $('tr, .fight, [class*="fight"]').each((index, element) => {
          try {
            const $row = $(element);
            const text = $row.text();

            // Simple regex to extract numbers
            const numbers = text.match(/[\d,]+\.?\d*/g);
            if (numbers && numbers.length >= 3) {
              draws.push({
                id: `alt-draw-${index}`,
                result1: null,
                result2: null,
                details: {
                  redTotalBetAmount: parseFloat(numbers[0].replace(/,/g, '')) || 0,
                  blueTotalBetAmount: parseFloat(numbers[1].replace(/,/g, '')) || 0,
                  drawTotalBetAmount: parseFloat(numbers[2].replace(/,/g, '')) || 0
                },
                timestamp: new Date().toISOString()
              });
            }
          } catch (altParseError) {
            console.warn(`⚠️ Alternative parsing failed for row ${index}:`, altParseError.message);
          }
        });
      }

      if (draws.length > 0) {
        console.log(`✅ Successfully parsed ${draws.length} draws for live updates`);

        // Emit leaderboard update to connected clients
        emitLeaderboardUpdate(io, {
          draws: draws,
          currentDraw: draws[0] || null, // Most recent draw
          totalDraws: draws.length
        });

        console.log('📡 Live leaderboard update emitted to all connected clients');
      } else {
        console.warn('⚠️ No draws found in leaderboard response');
      }

    } catch (error) {
      console.error('❌ Leaderboard update scheduler error:', error.message);
    }
  };

  // Initial fetch
  fetchAndEmitUpdates();

  // Set up periodic updates every 30 seconds
  updateInterval = setInterval(fetchAndEmitUpdates, 30000);

  console.log('📊 Leaderboard update scheduler started - updating every 30 seconds');

  return {
    stop: () => {
      if (updateInterval) {
        clearInterval(updateInterval);
        updateInterval = null;
        isRunning = false;
        console.log('📊 Leaderboard update scheduler stopped');
      }
    }
  };
}

export default initLeaderboardUpdateScheduler;