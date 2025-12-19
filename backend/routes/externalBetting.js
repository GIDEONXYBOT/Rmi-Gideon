// routes/externalBetting.js - Fetch betting data from GTArena
import express from 'express';
import axios from 'axios';
// import * as cheerio from 'cheerio';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = express.Router();

// Store session data for credential management
let sessionData = {
  username: 'admin.jell',
  password: 'adminjell',
  cookies: '',
  lastFetch: null
};

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
 * POST /api/external-betting/set-credentials
 * Set GTArena credentials (admin only)
 */
router.post('/set-credentials', requireAuth, requireRole(['admin', 'super_admin']), async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }
    sessionData.username = username;
    sessionData.password = password;
    res.json({ success: true, message: 'Credentials saved' });
  } catch (err) {
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
 * Fetch leaderboard data from GTArena (admin/super_admin only)
 * Acts as a proxy to bypass CORS restrictions
 */
router.get('/leaderboard', requireAuth, requireRole(['admin', 'super_admin']), async (req, res) => {
  try {
    console.log('📡 Fetching leaderboard data from GTArena...');

    const client = axios.create();

    // Fetch leaderboard page directly (no authentication required for public leaderboard)
    const leaderboardUrl = 'https://rmi-gideon.gtarena.ph/leaderboard';
    console.log(`📥 Fetching leaderboard from: ${leaderboardUrl}`);

    const response = await client.get(leaderboardUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1'
      },
      timeout: 10000,
      validateStatus: () => true
    });

    console.log(`📄 Leaderboard response status: ${response.status}`);

    if (response.status !== 200) {
      throw new Error(`Failed to fetch leaderboard: HTTP ${response.status}`);
    }

    const html = response.data;
    console.log(`📄 HTML length: ${html.length} characters`);

    // Parse the HTML to extract JSON data from data-page attribute
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
    const draws = pageData?.props?.draws;
    if (!draws || !Array.isArray(draws)) {
      console.log('⚠️ No draws array found in pageData.props');
      console.log('📄 Available keys in pageData:', Object.keys(pageData || {}));
      if (pageData?.props) {
        console.log('📄 Available keys in pageData.props:', Object.keys(pageData.props));
      }
      throw new Error('Unexpected leaderboard data structure');
    }

    console.log(`✅ Successfully parsed ${draws.length} draws from leaderboard`);

    // Return the leaderboard data
    res.json({
      success: true,
      data: draws,
      fetchedAt: new Date(),
      totalDraws: draws.length
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

// Export the function for use in other modules
export { fetchBettingDataFromGTArena };

export default router;
