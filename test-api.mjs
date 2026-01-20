import axios from 'axios';

async function testAPI() {
  try {
    console.log('Testing leaderboard API...');
    const response = await axios.get('http://localhost:5000/api/external-betting/player-leaderboard?external=false&internal=false&demo=true');
    console.log('Response:', JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.error('Error:', error.message);
    if (error.code) console.error('Error code:', error.code);
    if (error.response) console.error('Response status:', error.response.status);
  }
}

testAPI();