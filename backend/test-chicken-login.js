#!/usr/bin/env node

// Test script to check chicken fight scraper login credentials
import { testLoginCredentials } from './routes/externalBetting.js';

async function main() {
  console.log('🧪 Testing Chicken Fight Scraper Login Credentials\n');

  const result = await testLoginCredentials();

  if (result.success) {
    console.log('✅ SUCCESS: Login credentials are working');
    console.log(`📊 Status: ${result.status}`);
  } else {
    console.log('❌ FAILURE: Login credentials are not working');
    console.log(`📊 Status: ${result.status || 'N/A'}`);
    console.log(`📊 Error: ${result.error || 'Unknown error'}`);

    console.log('\n🔧 Troubleshooting suggestions:');
    console.log('1. Check if the website is accessible: https://rmi-gideon.gtarena.ph');
    console.log('2. Verify username/password in routes/externalBetting.js');
    console.log('3. Check if the login endpoint has changed');
    console.log('4. Try accessing the site manually to see if it requires CAPTCHA or other authentication');
  }

  process.exit(result.success ? 0 : 1);
}

main().catch(err => {
  console.error('❌ Test script error:', err);
  process.exit(1);
});