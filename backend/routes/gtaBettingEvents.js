import express from 'express';

const router = express.Router();

// GET /api/gta-betting-events - Fetch actual betting event records from external API
router.get('/', async (req, res) => {
  try {
    // Fetch from GTArena API with X-TOKEN to get betting event data
    const externalUrl = 'https://rmi-gideon.gtarena.ph/api/m/secure/report/event';
    const token = 'af9735e1c7857a07f0b078df36842ace';

    console.log(`📊 Fetching betting event records from ${externalUrl}`);

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

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ External service error: ${response.status}`, errorText);
      return res.status(response.status).json({
        error: `External service returned ${response.status}`,
        details: errorText || 'No additional details'
      });
    }

    const data = await response.json();
    
    console.log(`📊 Full response structure:`, JSON.stringify(data, null, 2).substring(0, 500));
    
    // Extract actual betting event records (different from staff reports)
    let eventData = [];
    
    if (data.data?.eventReports && Array.isArray(data.data.eventReports)) {
      // eventReports contains actual betting events
      eventData = data.data.eventReports;
      console.log(`✅ Found ${eventData.length} event records in eventReports`);
    } else if (data.data?.events && Array.isArray(data.data.events)) {
      // events array
      eventData = data.data.events;
      console.log(`✅ Found ${eventData.length} event records in events`);
    } else if (data.data?.matches && Array.isArray(data.data.matches)) {
      // matches array
      eventData = data.data.matches;
      console.log(`✅ Found ${eventData.length} event records in matches`);
    } else if (Array.isArray(data.data)) {
      // Direct array
      eventData = data.data;
      console.log(`✅ Found ${eventData.length} event records in data.data`);
    } else if (Array.isArray(data)) {
      // Root level array
      eventData = data;
      console.log(`✅ Found ${eventData.length} event records at root`);
    } else {
      // Try to find any array in the response
      const values = Object.values(data.data || {});
      const arrayValues = values.filter(v => Array.isArray(v));
      if (arrayValues.length > 0) {
        eventData = arrayValues[0];
        console.log(`✅ Found ${eventData.length} event records in nested array`);
      }
    }
    
    console.log(`✅ Returning ${eventData.length} betting event records`);
    res.json(eventData || []);
  } catch (error) {
    console.error('❌ Error fetching GTA betting events:', error.message);

    res.status(500).json({
      error: 'Failed to fetch GTA betting events',
      details: error.message
    });
  }
});

export default router;
