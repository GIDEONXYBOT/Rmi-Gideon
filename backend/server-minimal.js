// Minimal test server using CommonJS
const express = require("express");
const app = express();

// Add CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  next();
});

app.get('/api/health', (req, res) => {
  res.json({ message: 'Server is running' });
});

// Player leaderboard endpoint
app.get('/api/external-betting/player-leaderboard', (req, res) => {
  const { external = 'true', internal = 'true', demo = 'true' } = req.query;
  const sources = {
    external: external === 'true',
    internal: internal === 'true',
    demo: demo === 'true'
  };

  console.log('Requested sources:', sources);

  // Return demo data
  const demoData = [
    {
      rank: 1,
      name: "Player One",
      username: "player1",
      score: 15420,
      points: 1250,
      wins: 45,
      losses: 12,
      winRate: 78.9,
      totalBets: 57,
      totalAmount: 15420
    },
    {
      rank: 2,
      name: "Player Two",
      username: "player2",
      score: 14850,
      points: 1180,
      wins: 42,
      losses: 15,
      winRate: 73.7,
      totalBets: 57,
      totalAmount: 14850
    },
    {
      rank: 3,
      name: "Player Three",
      username: "player3",
      score: 13990,
      points: 1120,
      wins: 38,
      losses: 18,
      winRate: 67.9,
      totalBets: 56,
      totalAmount: 13990
    }
  ];

  res.json({
    success: true,
    data: demoData,
    count: demoData.length,
    fetchedAt: new Date().toISOString(),
    source: 'demo-data',
    message: 'Data from: demo-data',
    isDemo: true,
    sourcesUsed: ['demo-data']
  });
});

app.listen(5004, () => {
  console.log('🚀 Minimal server with leaderboard started on port 5004');
});