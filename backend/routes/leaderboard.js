import express from 'express';
import axios from 'axios';

const router = express.Router();

// Proxy endpoint to fetch GTA leaderboard data from external service
router.get('/gta', async (req, res) => {
  try {
    // Fetch from external HTTP endpoint (safe on backend)
    const response = await axios.get('http://122.3.203.8/leaderboard', {
      timeout: 10000, // 10 second timeout
    });

    // Return the data to frontend over HTTPS
    res.json(response.data);
  } catch (error) {
    console.error('Error fetching GTA leaderboard:', error.message);
    
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
        details: '122.3.203.8 could not be resolved',
      });
    }

    res.status(500).json({
      error: 'Failed to fetch leaderboard data',
      details: error.message,
    });
  }
});

export default router;
