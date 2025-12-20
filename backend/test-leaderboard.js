const axios = require('axios');

async function testLeaderboard() {
  try {
    console.log('Testing leaderboard endpoint...');
    const response = await axios.get('https://rmi-gideon.gtarena.ph/leaderboard', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      timeout: 10000
    });

    console.log('Status:', response.status);
    console.log('HTML length:', response.data.length);

    const dataMatch = response.data.match(/data-page="([^"]*)"/);
    if (dataMatch) {
      console.log('Found data-page attribute');
      const decodedData = dataMatch[1]
        .replace(/&quot;/g, '"')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&#39;/g, "'")
        .replace(/&apos;/g, "'");

      try {
        const pageData = JSON.parse(decodedData);
        const draws = pageData?.props?.draws;

        console.log('Draws found:', draws ? draws.length : 0);
        if (draws && draws.length > 0) {
          console.log('Sample draw:', JSON.stringify(draws[0], null, 2));
        }
      } catch (parseErr) {
        console.log('JSON parse error:', parseErr.message);
        console.log('First 200 chars:', decodedData.substring(0, 200));
      }
    } else {
      console.log('No data-page attribute found');
    }
  } catch (err) {
    console.error('Error:', err.message);
  }
}

testLeaderboard();