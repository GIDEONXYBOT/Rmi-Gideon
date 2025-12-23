import express from 'express';
import axios from 'axios';

const router = express.Router();

// Proxy endpoint to fetch GTA leaderboard data from external service
router.get('/gta', async (req, res) => {
  try {
    console.log('🎯 Leaderboard request received for /api/leaderboard/gta');
    
    // Fetch from external HTTP endpoint (safe on backend)
    console.log('📡 Fetching from http://122.3.203.8/leaderboard...');
    const response = await axios.get('http://122.3.203.8/leaderboard', {
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
        details: 'Could not connect to external service at 122.3.203.8',
      });
    }
    
    if (error.code === 'ENOTFOUND') {
      return res.status(503).json({
        error: 'External leaderboard host not found',
        details: '122.3.203.8 could not be resolved',
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
