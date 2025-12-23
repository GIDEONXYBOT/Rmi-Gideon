import express from 'express';
import axios from 'axios';

const router = express.Router();

// Test endpoint to verify route is working
router.get('/test', (req, res) => {
  res.json({
    message: '✅ Leaderboard route is registered and working',
    endpoint: '/api/leaderboard/gta',
    status: 'ready',
  });
});

// Proxy endpoint to fetch GTA leaderboard data from external service
router.get('/gta', async (req, res) => {
  try {
    console.log('🎯 Leaderboard request received for /api/leaderboard/gta');
    
    // Fetch from external endpoint (safe on backend)
    const leaderboardUrl = 'https://reverb.sixthreeinteractive.me/VMWAZWRLKTPR2XRU0XZJ3QQO/leaderboard';
    console.log('📡 Fetching from', leaderboardUrl);
    const response = await axios.get(leaderboardUrl, {
      timeout: 10000, // 10 second timeout
      headers: {
        'User-Agent': 'RMI-Teller-Report/1.0',
      },
    });

    console.log('✅ Successfully fetched leaderboard data');
    
    // Return the data to frontend over HTTPS
    res.setHeader('Content-Type', 'application/json');
    res.json(response.data);
  } catch (error) {
    console.error('❌ Error fetching GTA leaderboard:', {
      message: error.message,
      code: error.code,
      status: error.response?.status,
      statusText: error.response?.statusText,
      responseData: error.response?.data?.substring(0, 200), // First 200 chars
    });
    
    // Return appropriate error response
    if (error.code === 'ECONNREFUSED') {
      return res.status(503).json({
        error: 'External leaderboard service unavailable',
        details: 'Could not connect to external service',
      });
    }
    
    if (error.code === 'ENOTFOUND') {
      return res.status(503).json({
        error: 'External leaderboard host not found',
        details: 'Could not resolve leaderboard host',
      });
    }

    if (error.code === 'ECONNABORTED') {
      return res.status(504).json({
        error: 'Request timeout',
        details: 'External service took too long to respond',
      });
    }

    res.status(500).json({
      error: 'Failed to fetch leaderboard data',
      details: error.message,
    });
  }
});

export default router;
