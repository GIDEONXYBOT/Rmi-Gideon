import express from 'express';

const router = express.Router();

// GET /api/gta-betting-events - Proxy to external GTA dashboard
router.get('/', async (req, res) => {
  try {
    // Use the correct API endpoint that works with X-TOKEN authentication
    const externalUrl = 'https://rmi-gideon.gtarena.ph/api/m/secure/report/event';
    const token = 'af9735e1c7857a07f0b078df36842ace';

    console.log(`📊 Fetching GTA betting events from ${externalUrl}`);

    // Use native fetch (same as working endpoints in reports.js)
    const response = await fetch(externalUrl, {
      method: 'GET',
      headers: {
        'X-TOKEN': token,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      timeout: 10000
    });

    console.log(`📊 Response status: ${response.status}`);
    console.log(`📊 Response headers:`, Object.fromEntries(response.headers));

    // Check if response is successful
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ External service error: ${response.status}`, errorText);
      return res.status(response.status).json({
        error: `External service returned ${response.status}`,
        details: errorText || 'No additional details'
      });
    }

    const data = await response.json();
    
    // The API returns data in data.data, so extract it
    const eventData = data?.data || data;
    console.log(`✅ GTA betting events fetched successfully: ${Array.isArray(eventData) ? eventData.length : 'unknown'} records`);
    res.json(eventData);
  } catch (error) {
    console.error('❌ Error fetching GTA betting events:', error.message);
    console.error('Error details:', {
      name: error.name,
      message: error.message
    });

    // Network errors
    if (error.message.includes('fetch')) {
      return res.status(503).json({
        error: 'External GTA dashboard is unavailable',
        details: error.message || 'Network error - service may be down'
      });
    }

    // Timeout errors
    if (error.name === 'AbortError' || error.message.includes('timeout')) {
      return res.status(504).json({
        error: 'External GTA dashboard request timeout',
        details: 'Request took too long (>10s)'
      });
    }

    res.status(500).json({
      error: 'Failed to fetch GTA betting events',
      details: error.message
    });
  }
});

export default router;
