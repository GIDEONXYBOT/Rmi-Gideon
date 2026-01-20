const axios = require('axios');

(async () => {
  try {
    console.log('Analyzing leaderboard HTML for embedded data...');
    const response = await axios.get('http://122.3.203.8/leaderboard', {
      timeout: 15000
    });

    const html = response.data;
    console.log('HTML length:', html.length);

    // Look for any data attributes or props that might contain leaderboard data
    const dataProps = html.match(/data-[^=]*="[^"]*"/gi);
    if (dataProps) {
      console.log(`\nFound ${dataProps.length} data attributes`);
      dataProps.slice(0, 10).forEach(prop => console.log('  ' + prop));
    }

    // Look for Vue.js or React props
    const propMatches = html.match(/:data="[^"]*"|v-bind:data="[^"]*"/gi);
    if (propMatches) {
      console.log(`\nFound ${propMatches.length} Vue/React data bindings`);
      propMatches.forEach(prop => console.log('  ' + prop));
    }

    // Look for any script tags with leaderboard data
    const scripts = html.match(/<script[^>]*>([\s\S]*?)<\/script>/gi);
    if (scripts) {
      console.log(`\nAnalyzing ${scripts.length} script tags for leaderboard data...`);
      scripts.forEach((script, i) => {
        if (script.includes('leaderboard') || script.includes('players') || script.includes('rank')) {
          console.log(`Script ${i + 1} contains potential leaderboard data:`);
          console.log(script.substring(0, 300));
        }
      });
    }

    // Look for table content that might be leaderboard
    const tableContent = html.match(/<tbody[^>]*>([\s\S]*?)<\/tbody>/gi);
    if (tableContent) {
      console.log(`\nFound ${tableContent.length} table bodies`);
      tableContent.forEach((tbody, i) => {
        console.log(`Table body ${i + 1} length: ${tbody.length}`);
        if (tbody.length > 100) {
          console.log('Content preview:', tbody.substring(0, 200));
        }
      });
    }

    // Try the event report API again
    console.log('\nRetrying event report API...');
    try {
      const eventResponse = await axios.get('http://122.3.203.8/api/m/secure/report/event', {
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
      console.log('Event report API success!');
      console.log('Data keys:', Object.keys(eventResponse.data));
    } catch (e) {
      console.log('Event report API still failing:', e.message);
    }

  } catch (e) {
    console.log('Error:', e.message);
  }
})();