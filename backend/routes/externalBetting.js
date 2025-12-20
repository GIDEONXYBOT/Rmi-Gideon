// routes/externalBetting.js - Fetch betting data from GTArena
import express from 'express';
import axios from 'axios';
import * as cheerio from 'cheerio';
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

    let importedCount = 0;
    fights.forEach(fight => {
      if (!historicalDraws.has(fight.id)) {
        historicalDraws.set(fight.id, fight);
        importedCount++;
      }
    });

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
 * Fetch teller betting data from GTArena (admin/super_admin only)
 */
router.get('/teller-bets', requireAuth, requireRole(['admin', 'super_admin']), async (req, res) => {
  try {
    // If no credentials set, return mock/demo data
    if (!sessionData.username || !sessionData.password) {
      console.log('⚠️ No GTArena credentials configured, showing demo data');
      return res.json({ 
        success: true, 
        data: [
          { username: 'teller_1', totalBet: 15000, mwBetPercent: 45.5, fetchedAt: new Date() },
          { username: 'teller_2', totalBet: 12500, mwBetPercent: 38.2, fetchedAt: new Date() },
          { username: 'teller_3', totalBet: 8750, mwBetPercent: 52.1, fetchedAt: new Date() },
          { username: 'teller_4', totalBet: 6200, mwBetPercent: 41.7, fetchedAt: new Date() },
          { username: 'teller_5', totalBet: 4500, mwBetPercent: 35.9, fetchedAt: new Date() }
        ],
        isDemo: true,
        message: 'Demo data shown. Set real GTArena credentials to fetch live data.',
        lastFetch: new Date()
      });
    }

    // Try to fetch betting data
    console.log(`📡 Attempting to fetch betting data for user: ${sessionData.username}`);
    const bettingData = await fetchBettingDataFromGTArena(
      sessionData.username,
      sessionData.password
    );

    sessionData.lastFetch = new Date();
    console.log(`✅ Successfully fetched ${bettingData.length} tellers from GTArena`);
    res.json({ 
      success: true, 
      data: bettingData,
      isDemo: false,
      lastFetch: sessionData.lastFetch 
    });
  } catch (err) {
    console.error('❌ Error fetching betting data:', err.message);
    // Fall back to demo data on error
    res.json({ 
      success: true, 
      data: [
        { username: 'teller_1', totalBet: 15000, mwBetPercent: 45.5, fetchedAt: new Date() },
        { username: 'teller_2', totalBet: 12500, mwBetPercent: 38.2, fetchedAt: new Date() },
        { username: 'teller_3', totalBet: 8750, mwBetPercent: 52.1, fetchedAt: new Date() },
        { username: 'teller_4', totalBet: 6200, mwBetPercent: 41.7, fetchedAt: new Date() },
        { username: 'teller_5', totalBet: 4500, mwBetPercent: 35.9, fetchedAt: new Date() }
      ],
      isDemo: true,
      message: `Error fetching real data: ${err.message}. Showing demo data.`,
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
 * Helper function to fetch betting data from GTArena
 */
async function fetchBettingDataFromGTArena(username, password) {
  try {
    // Create axios instance
    const client = axios.create();

    // Step 1: Login to GTArena API - try different endpoints
    const loginEndpoints = [
      'https://rmi-gideon.gtarena.ph/api/auth/login',
      'https://rmi-gideon.gtarena.ph/api/v1/login',
      'https://rmi-gideon.gtarena.ph/api/authenticate',
      'https://rmi-gideon.gtarena.ph/login'  // fallback to original
    ];

    let loginResponse = null;
    let loginUrl = '';

    for (const endpoint of loginEndpoints) {
      console.log(`🔐 Trying login endpoint: ${endpoint}`);
      try {
        // Try different account formats for API login
        let loginPayload;
        if (endpoint.includes('/api/auth/login')) {
          const accountFormats = [
            username,  // admin.jell
            `${username}@rmi-gideon.gtarena.ph`,  // admin.jell@rmi-gideon.gtarena.ph
            username.replace('.', ''),  // adminjell
            `admin@${username.split('.')[1]}`,  // admin@jell
          ];

          for (const accountFormat of accountFormats) {
            console.log(`🔐 Trying account format: ${accountFormat}`);
            try {
              const testResponse = await client.post(endpoint,
                { account: accountFormat, password },
                {
                  headers: {
                    'Content-Type': 'application/json',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                  },
                  validateStatus: () => true
                }
              );

              if (testResponse.status === 200 && (testResponse.data?.data?.success || testResponse.data?.success || testResponse.data?.token)) {
                loginPayload = { account: accountFormat, password };
                break;
              } else {
                console.log(`❌ Account format ${accountFormat} failed:`, testResponse.data?.data?.error?.message);
              }
            } catch (err) {
              console.log(`❌ Error with account format ${accountFormat}:`, err.message);
            }
          }

          if (!loginPayload) {
            loginPayload = { account: username, password }; // fallback
          }
        } else if (endpoint.includes('login') && !endpoint.includes('/api/')) {
          loginPayload = `username=${username}&password=${password}`;
        } else {
          loginPayload = { username, password };
        }

        const contentType = endpoint.includes('/api/') ? 'application/json' : 'application/x-www-form-urlencoded';

        const response = await client.post(endpoint, loginPayload, {
          headers: {
            'Content-Type': contentType,
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          },
          validateStatus: () => true
        });

        if (response.status === 200 && (response.data?.data?.success || response.data?.success || response.data?.token)) {
          loginResponse = response;
          loginUrl = endpoint;
          console.log(`✅ Login successful with endpoint: ${endpoint}`);
          break;
        } else {
          console.log(`❌ Login failed for ${endpoint}:`, JSON.stringify(response.data, null, 2));
        }
      } catch (err) {
        console.log(`❌ Error with ${endpoint}:`, err.message);
      }
    }

    if (!loginResponse) {
      throw new Error('All login endpoints failed');
    }

    console.log(`📊 Login response status: ${loginResponse.status}`);
    console.log(`📊 Login response data:`, loginResponse.data);

    // Check if login was successful
    if (loginResponse.status !== 200 || !loginResponse.data?.data?.success) {
      throw new Error(`Login failed: ${loginResponse.data?.data?.error?.message || 'Unknown error'}`);
    }

    // Extract token from response
    const token = loginResponse.data?.data?.token || loginResponse.data?.token;
    if (!token) {
      throw new Error('No authentication token received from login');
    }
    console.log(`🔑 Authentication token received`);

    // Step 2: Fetch betting data from API - try different endpoints
    const bettingEndpoints = [
      'https://rmi-gideon.gtarena.ph/api/reports/event/data',
      'https://rmi-gideon.gtarena.ph/api/reports/event',
      'https://rmi-gideon.gtarena.ph/api/betting/reports',
      'https://rmi-gideon.gtarena.ph/api/tellers/bets',
      'https://rmi-gideon.gtarena.ph/reports/event/page'  // fallback to original
    ];

    let bettingResponse = null;
    let bettingUrl = '';

    for (const endpoint of bettingEndpoints) {
      console.log(`📥 Trying betting endpoint: ${endpoint}`);
      try {
        const response = await client.get(endpoint, {
          headers: {
            'Authorization': token ? `Bearer ${token}` : undefined,
            'Cookie': loginResponse.headers['set-cookie']?.join('; ') || '',
            'Content-Type': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          },
          validateStatus: () => true
        });

        if (response.status === 200 && (response.data?.data?.staffReports || response.data?.staffReports || Array.isArray(response.data?.data))) {
          bettingResponse = response;
          bettingUrl = endpoint;
          console.log(`✅ Betting data retrieved from: ${endpoint}`);
          break;
        } else {
          console.log(`❌ No valid data from ${endpoint}:`, response.data);
        }
      } catch (err) {
        console.log(`❌ Error with ${endpoint}:`, err.message);
      }
    }

    if (!bettingResponse) {
      throw new Error('All betting data endpoints failed');
    }

    console.log(`📄 Betting API response status: ${bettingResponse.status}`);
    console.log(`📄 Response data type: ${typeof bettingResponse.data}`);
    console.log(`📄 Response data:`, bettingResponse.data);

    // Check if API response is successful
    if (bettingResponse.status !== 200 || !bettingResponse.data?.data?.success) {
      throw new Error(`API request failed: ${bettingResponse.data?.data?.error?.message || bettingResponse.data?.message || 'Unknown API error'}`);
    }

    // Parse JSON response
    const apiData = bettingResponse.data?.data || bettingResponse.data;
    if (!apiData || !Array.isArray(apiData.staffReports)) {
      console.log(`⚠️ API response structure:`, Object.keys(apiData || {}));
      throw new Error('Unexpected API response structure');
    }

    // Transform API data to expected format
    const bettingData = apiData.staffReports.map(item => ({
      name: item.name || item.username,
      username: item.username,
      betAmount: item.betAmount || item.totalBet || 0,
      payout: item.payout || 0,
      canceledBet: item.canceledBet || 0,
      commission: item.commission || 0,
      systemBalance: item.systemBalance || 0,
      startingBalance: item.startingBalance || 0
    }));

    console.log(`✅ Successfully parsed ${bettingData.length} teller records from API`);
    return { staffReports: bettingData };
  } catch (err) {
    console.error('❌ Error in fetchBettingDataFromGTArena:', err.message);
    throw err;
  }
}

/**
 * GET /api/external-betting/leaderboard
 * Fetch leaderboard data from GTArena (public access for frontend) - redeploy trigger
 * Acts as a proxy to bypass CORS restrictions
 */
router.get('/leaderboard', async (req, res) => {
  try {
    console.log('📡 Fetching leaderboard data from GTArena with authentication...');

    const client = axios.create();

    // Step 1: Login to get authenticated session
    const loginUrl = 'https://rmi-gideon.gtarena.ph/login';
    console.log(`🔐 Attempting login to ${loginUrl}`);
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
    console.log(`📊 Login response status: ${loginResponse.status}`);

    // Get cookies from login response
    const cookies = loginResponse.headers['set-cookie']?.join('; ') || '';
    console.log(`🍪 Cookies length: ${cookies.length}`);

    if (loginResponse.status !== 200 && loginResponse.status !== 302) {
      console.log('⚠️ Login may have failed, proceeding with public access');
    }

    // Try multiple potential endpoints to get historical data
    const potentialUrls = [
      'https://rmi-gideon.gtarena.ph/leaderboard',
      'https://rmi-gideon.gtarena.ph/reports/event/page',
      'https://rmi-gideon.gtarena.ph/leaderboard?page=1',
      'https://rmi-gideon.gtarena.ph/leaderboard?page=all',
      'https://rmi-gideon.gtarena.ph/api/leaderboard',
      'https://rmi-gideon.gtarena.ph/api/draws',
      'https://rmi-gideon.gtarena.ph/api/events/current/draws',
      'https://rmi-gideon.gtarena.ph/api/fights/history',
      'https://rmi-gideon.gtarena.ph/api/draws/history',
      'https://rmi-gideon.gtarena.ph/reports/draws',
      'https://rmi-gideon.gtarena.ph/reports/fights'
    ];

    // Also try with different query parameters for historical data
    const queryParams = ['', '?limit=300', '?per_page=300', '?size=300', '?all=1', '?historical=1', '?archive=1'];
    const allUrls = [];
    potentialUrls.forEach(url => {
      queryParams.forEach(param => {
        allUrls.push(url + param);
      });
    });

    let html = '';
    let successfulUrl = '';

    for (const url of allUrls) {
      try {
        console.log(`🔍 Trying authenticated URL: ${url}`);
        const response = await client.get(url, {
          headers: {
            'Cookie': cookies,
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Accept-Encoding': 'gzip, deflate',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
          },
          timeout: 15000,
          validateStatus: () => true
        });

        if (response.status === 200 && response.data) {
          html = response.data;
          successfulUrl = url;
          console.log(`✅ Successfully fetched data from: ${url}`);
          break;
        }
      } catch (error) {
        console.log(`❌ Failed to fetch from ${url}: ${error.message}`);
        continue;
      }
    }

    if (!html) {
      throw new Error('All potential URLs failed');
    }

    console.log(`📄 HTML/API response length: ${html.length} characters`);

    // Parse the response - could be HTML with data-page or direct JSON
    let draws = [];

    if (html.trim().startsWith('{') || html.trim().startsWith('[')) {
      // Direct JSON response
      console.log('📄 Response appears to be JSON');
      try {
        const jsonData = JSON.parse(html);
        draws = jsonData.draws || jsonData.data || jsonData;
        if (!Array.isArray(draws)) {
          draws = [draws];
        }
      } catch (error) {
        console.error('❌ Failed to parse JSON response:', error.message);
        throw new Error('Invalid JSON response from API');
      }
    } else {
      // HTML response - parse data-page attribute
      console.log('📄 Response appears to be HTML');
      const dataMatch = html.match(/data-page="([^"]*)"/);
      if (!dataMatch) {
        console.log('⚠️ No data-page attribute found in HTML');
        // Try alternative patterns
        const altMatch = html.match(/data-page='([^']*)'/);
        if (!altMatch) {
          throw new Error('Could not find leaderboard data in response');
        }
        console.log('✅ Found data-page with single quotes');
      }

      // Decode HTML entities before parsing JSON
      const encodedData = dataMatch ? dataMatch[1] : altMatch[1];
      console.log(`📄 Encoded data length: ${encodedData.length}`);

      // Decode HTML entities (like &quot; -> ")
      const decodedData = encodedData
        .replace(/&quot;/g, '"')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&#39;/g, "'")
        .replace(/&apos;/g, "'");

      console.log(`📄 Decoded data length: ${decodedData.length}`);

      let pageData;
      try {
        pageData = JSON.parse(decodedData);
      } catch (parseError) {
        console.error('❌ JSON parse error:', parseError.message);
        console.log('📄 First 500 chars of decoded data:', decodedData.substring(0, 500));
        throw new Error(`Failed to parse leaderboard JSON: ${parseError.message}`);
      }

      // Extract draws data
      draws = pageData?.props?.draws;
      if (!draws || !Array.isArray(draws)) {
        console.log('⚠️ No draws array found in pageData.props');
        console.log('📄 Available keys in pageData:', Object.keys(pageData || {}));
        if (pageData?.props) {
          console.log('📄 Available keys in pageData.props:', Object.keys(pageData.props));
        }
        throw new Error('Unexpected leaderboard data structure');
      }
    }

    console.log(`✅ Successfully parsed ${draws.length} draws from leaderboard`);

    // Accumulate historical data
    let newDrawsCount = 0;
    draws.forEach(draw => {
      if (!historicalDraws.has(draw.id)) {
        historicalDraws.set(draw.id, draw);
        newDrawsCount++;
      } else {
        // Update existing draw with latest data
        historicalDraws.set(draw.id, { ...historicalDraws.get(draw.id), ...draw });
      }
    });

    console.log(`📊 Accumulated ${newDrawsCount} new draws. Total historical draws: ${historicalDraws.size}`);

    // Check if we need more historical data
    if (historicalDraws.size < 115) {
      console.log(`⚠️ Only have ${historicalDraws.size} historical draws, expected around 115+. This will grow over time as new data becomes available.`);
    }

    // Convert Map to array and sort by fight sequence (ascending - oldest first)
    const allDraws = Array.from(historicalDraws.values());
    allDraws.sort((a, b) => (a.batch?.fightSequence || 0) - (b.batch?.fightSequence || 0));

    console.log(`📊 Historical draw sequence range: ${allDraws[0]?.batch?.fightSequence || 'N/A'} to ${allDraws[allDraws.length - 1]?.batch?.fightSequence || 'N/A'}`);

    // Emit leaderboard update to connected clients
    const io = req.app.io;
    if (io) {
      emitLeaderboardUpdate(io, {
        draws: allDraws,
        currentDraw: allDraws[allDraws.length - 1] || null, // Most recent draw
        totalDraws: allDraws.length
      });
    }

    // Return accumulated historical data
    res.json({
      success: true,
      data: allDraws,
      totalDraws: allDraws.length,
      fetchedAt: new Date().toISOString(),
      message: `Returning ${allDraws.length} accumulated historical draws`
    });

  } catch (err) {
    console.error('❌ Error fetching leaderboard data:', err.message);
    res.status(500).json({
      success: false,
      error: err.message,
      message: 'Failed to fetch leaderboard data from external platform'
    });
  }
});

/**
 * GET /api/external-betting/chicken-fight-bets
 * Fetch chicken fight betting data from GTArena
 */
router.get('/chicken-fight-bets', requireAuth, requireRole(['admin', 'super_admin']), async (req, res) => {
  try {
    console.log('🐔 Fetching chicken fight betting data from GTArena...');

    const client = axios.create();

    // Step 1: Login to GTArena
    const loginUrl = 'https://rmi-gideon.gtarena.ph/login';
    console.log(`🔐 Attempting login to ${loginUrl}`);
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

    if (loginResponse.status !== 200 && loginResponse.status !== 302) {
      throw new Error(`Login failed with status ${loginResponse.status}`);
    }

    // Get cookies from login response
    const cookies = loginResponse.headers['set-cookie']?.join('; ') || '';
    sessionData.cookies = cookies;

    // Step 2: Fetch chicken fight betting data page
    const chickenFightUrl = 'https://rmi-gideon.gtarena.ph/chicken-fight/betting';
    console.log(`🐔 Fetching chicken fight betting from ${chickenFightUrl}`);
    const bettingResponse = await client.get(chickenFightUrl, {
      headers: {
        'Cookie': cookies,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      validateStatus: () => true
    });

    if (bettingResponse.status !== 200) {
      throw new Error(`Failed to fetch chicken fight betting data: HTTP ${bettingResponse.status}`);
    }

    console.log(`📄 Chicken fight betting response status: ${bettingResponse.status}`);

    // Step 3: Parse the HTML for betting data
    const $ = cheerio.load(bettingResponse.data);

    const bettingData = {
      totalBets: 0,
      totalAmount: 0,
      bettingStatus: 'open',
      currentFight: null,
      fights: [],
      lastUpdated: new Date().toISOString()
    };

    // Parse betting status
    const statusText = $('.betting-status, .status, [class*="status"]').first().text().trim().toLowerCase();
    if (statusText.includes('closed') || statusText.includes('suspend')) {
      bettingData.bettingStatus = 'closed';
    } else if (statusText.includes('open')) {
      bettingData.bettingStatus = 'open';
    }

    // Parse current fight
    const currentFightText = $('.current-fight, .fight-number, [class*="fight"]').first().text().trim();
    const fightMatch = currentFightText.match(/fight\s*#?\s*(\d+)/i);
    if (fightMatch) {
      bettingData.currentFight = parseInt(fightMatch[1]);
    }

    // Parse betting amounts from tables or data elements
    $('.bet-row, .bet-item, tr, [class*="bet"]').each((index, element) => {
      try {
        const $row = $(element);
        const betText = $row.text();

        // Extract amounts using regex
        const amountMatches = betText.match(/[\d,]+\.?\d*/g);
        if (amountMatches && amountMatches.length > 0) {
          const amount = parseFloat(amountMatches[0].replace(/,/g, ''));
          if (amount > 0) {
            bettingData.totalAmount += amount;
            bettingData.totalBets += 1;
          }
        }
      } catch (parseError) {
        console.warn(`⚠️ Failed to parse bet row ${index}:`, parseError.message);
      }
    });

    // If no data found in structured elements, try alternative parsing
    if (bettingData.totalBets === 0) {
      console.log('🔄 Trying alternative chicken fight betting parsing...');

      // Look for any numbers that could be betting amounts
      const allText = $('body').text();
      const numberMatches = allText.match(/[\d,]+\.?\d*/g);

      if (numberMatches) {
        numberMatches.forEach(match => {
          const amount = parseFloat(match.replace(/,/g, ''));
          if (amount > 100 && amount < 1000000) { // Reasonable betting amount range
            bettingData.totalAmount += amount;
            bettingData.totalBets += 1;
          }
        });
      }
    }

    console.log(`✅ Successfully parsed chicken fight betting: ${bettingData.totalBets} bets, ₱${bettingData.totalAmount.toLocaleString()}, status: ${bettingData.bettingStatus}`);

    res.json({
      success: true,
      data: bettingData
    });

  } catch (err) {
    console.error('❌ Error fetching chicken fight betting data:', err.message);
    res.status(500).json({
      success: false,
      error: err.message,
      message: 'Failed to fetch chicken fight betting data from external platform'
    });
  }
});

/**
 * Fetch chicken fight betting data directly from GTArena (for use in scheduler)
 */
export async function fetchChickenFightBettingData() {
  try {
    console.log('🐔 [SCRAPER] Fetching chicken fight betting from GTArena...');

    const client = axios.create();

    // Login
    const loginUrl = 'https://rmi-gideon.gtarena.ph/login';
    const loginResponse = await client.post(loginUrl,
      `username=${sessionData.username}&password=${sessionData.password}`,
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
        },
        validateStatus: () => true,
        timeout: 15000
      }
    );

    if (loginResponse.status !== 200 && loginResponse.status !== 302) {
      throw new Error(`Login failed: ${loginResponse.status}`);
    }

    const cookies = loginResponse.headers['set-cookie']?.join('; ') || '';
    console.log('✅ [SCRAPER] Login successful');

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
    return {
      totalBets: 0,
      totalAmount: 0,
      bettingStatus: 'open',
      source: 'gtarena-leaderboard',
      lastUpdated: new Date().toISOString(),
      error: err.message
    };
  }
}

// Export the function for use in other modules
export { fetchBettingDataFromGTArena };

export default router;
