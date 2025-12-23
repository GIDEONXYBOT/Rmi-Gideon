import express from 'express';
import axios from 'axios';

const router = express.Router();

// GET /api/gta-betting-events - Proxy to external GTA dashboard
router.get('/', async (req, res) => {
  try {
    const externalUrl = 'http://122.3.203.8/dashboard';
    const token = 'af9735e1c7857a07f0b078df36842ace';

    console.log(`📊 Fetching GTA betting events from ${externalUrl}`);

    const response = await axios.get(externalUrl, {
      headers: {
        'X-TOKEN': token,
        'Content-Type': 'application/json'
      },
      timeout: 10000 // 10 second timeout
    });

    console.log(`✅ GTA betting events fetched successfully: ${response.data?.length || 0} records`);
    res.json(response.data);
  } catch (error) {
    console.error('❌ Error fetching GTA betting events:', error.message);

    // Handle different error types
    if (error.code === 'ECONNREFUSED') {
      return res.status(503).json({
        error: 'External GTA dashboard is unavailable',
        details: 'Connection refused'
      });
    }

    if (error.code === 'ENOTFOUND') {
      return res.status(503).json({
        error: 'External GTA dashboard host not found',
        details: 'DNS resolution failed'
      });
    }

    if (error.code === 'ECONNABORTED') {
      return res.status(504).json({
        error: 'External GTA dashboard request timeout',
        details: 'Request took too long'
      });
    }

    if (error.response?.status) {
      return res.status(error.response.status).json({
        error: `External service returned ${error.response.status}`,
        details: error.response.data || error.message
      });
    }

    res.status(500).json({
      error: 'Failed to fetch GTA betting events',
      details: error.message
    });
  }
});

export default router;
