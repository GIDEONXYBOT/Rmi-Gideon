import express from 'express';
import axios from 'axios';

const router = express.Router();

// GET /api/gta-betting-events - Proxy to external GTA dashboard
router.get('/', async (req, res) => {
  try {
    // Use the correct API endpoint that works with X-TOKEN authentication
    const externalUrl = 'https://rmi-gideon.gtarena.ph/api/m/secure/report/event';
    const token = 'af9735e1c7857a07f0b078df36842ace';

    console.log(`📊 Fetching GTA betting events from ${externalUrl}`);

    const response = await axios.get(externalUrl, {
      headers: {
        'X-TOKEN': token,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (RMI-Betting-Dashboard) Node.js Backend',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      },
      timeout: 10000, // 10 second timeout
      validateStatus: () => true // Don't throw on any status code
    });

    console.log(`📊 Response status: ${response.status}`);
    console.log(`📊 Response headers:`, response.headers);

    // Check if response is successful
    if (response.status >= 400) {
      console.error(`❌ External service error: ${response.status}`, response.data);
      return res.status(response.status).json({
        error: `External service returned ${response.status}`,
        details: response.data || 'No additional details'
      });
    }

    // The API returns data in response.data.data, so extract it
    const eventData = response.data?.data || response.data;
    console.log(`✅ GTA betting events fetched successfully: ${Array.isArray(eventData) ? eventData.length : 'unknown'} records`);
    res.json(eventData);
  } catch (error) {
    console.error('❌ Error fetching GTA betting events:', error.message);
    console.error('Error details:', {
      code: error.code,
      statusCode: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data
    });

    // Handle different error types
    if (error.code === 'ECONNREFUSED') {
      return res.status(503).json({
        error: 'External GTA dashboard is unavailable',
        details: 'Connection refused - service may be down'
      });
    }

    if (error.code === 'ENOTFOUND') {
      return res.status(503).json({
        error: 'External GTA dashboard host not found',
        details: 'DNS resolution failed - incorrect host or network issue'
      });
    }

    if (error.code === 'ECONNABORTED') {
      return res.status(504).json({
        error: 'External GTA dashboard request timeout',
        details: 'Request took too long (>10s)'
      });
    }

    if (error.response?.status === 403) {
      return res.status(403).json({
        error: 'Access Forbidden - Authentication Failed',
        details: 'The X-TOKEN may be invalid or expired, or the service is rejecting requests from this IP',
        timestamp: new Date().toISOString()
      });
    }

    if (error.response?.status) {
      return res.status(error.response.status).json({
        error: `External service returned ${error.response.status}`,
        details: error.response.data || error.message,
        statusText: error.response.statusText
      });
    }

    res.status(500).json({
      error: 'Failed to fetch GTA betting events',
      details: error.message,
      code: error.code
    });
  }
});

export default router;
