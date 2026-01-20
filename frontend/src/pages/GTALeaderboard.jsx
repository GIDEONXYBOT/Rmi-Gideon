import React, { useState, useEffect } from 'react';
import { RefreshCw, AlertCircle, BarChart3 } from 'lucide-react';
import axios from 'axios';
import { getApiUrl } from '../utils/apiConfig.js';

export default function GTALeaderboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  // API source toggles
  const [apiSources, setApiSources] = useState({
    external: true,
    internal: true,
    demo: true
  });

  const fetchLeaderboard = async () => {
    try {
      setLoading(true);
      setError(null);

      // Build query params for selected sources
      const params = new URLSearchParams();
      Object.entries(apiSources).forEach(([key, enabled]) => {
        if (enabled) params.append(key, 'true');
      });

      // Use the production API temporarily for testing
      const url = `https://rmi-backend-zhdr.onrender.com/api/external-betting/player-leaderboard?${params.toString()}`;
      console.log('Using production API:', url);
      const response = await axios.get(url);

      if (response.data.success && response.data.data) {
        // Check if we have actual data, not just an empty array
        if (Array.isArray(response.data.data) && response.data.data.length > 0) {
          setData(response.data.data);
          setLastUpdated(new Date());

          // Show a message if using demo data
          if (response.data.isDemo) {
            console.warn('⚠️ Using demo leaderboard data:', response.data.message);
          }
        } else {
          // API returned success but no data, fall back to demo
          console.log('🔄 API returned empty data, using demo data as fallback');
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
            },
            {
              rank: 4,
              name: "Player Four",
              username: "player4",
              score: 13200,
              points: 1050,
              wins: 35,
              losses: 22,
              winRate: 61.4,
              totalBets: 57,
              totalAmount: 13200
            },
            {
              rank: 5,
              name: "Player Five",
              username: "player5",
              score: 12800,
              points: 980,
              wins: 32,
              losses: 25,
              winRate: 56.1,
              totalBets: 57,
              totalAmount: 12800
            }
          ];
          setData(demoData);
          setLastUpdated(new Date());
          console.warn('Leaderboard service returned no data, showing demo data.');
        }
      } else {
        throw new Error(response.data.message || 'Invalid data format from API');
      }
    } catch (err) {
      const errorMsg = err.message || 'Failed to fetch GTA leaderboard data';
      console.error('Leaderboard fetch error:', errorMsg, err);

      // If API completely fails, show error (no demo data in catch anymore)
      setError(errorMsg);
      setData(null);

      // If API completely fails, show a user-friendly message
      if (err.response?.status >= 500) {
        console.warn('Leaderboard service temporarily unavailable.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSourceToggle = (source) => {
    setApiSources(prev => ({
      ...prev,
      [source]: !prev[source]
    }));
  };

  useEffect(() => {
    fetchLeaderboard();
    // Auto-refresh every 60 seconds (reduced from 30 to avoid excessive API calls)
    const interval = setInterval(fetchLeaderboard, 60000);
    return () => clearInterval(interval);
  }, [apiSources]);

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP'
    }).format(amount || 0);
  };

  const formatDateTime = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString('en-PH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Get current time and date
  const getCurrentTime = () => {
    return new Date().toLocaleString('en-PH', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });
  };

  const getCurrentDate = () => {
    return new Date().toLocaleString('en-PH', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    }).toUpperCase();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black dark:bg-gray-900 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <span className="text-lg">Loading GTA leaderboard...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-black dark:bg-gray-900 text-white p-6">
        <div className="bg-red-900 dark:bg-red-900/30 border border-red-700 rounded-lg p-4 max-w-2xl mx-auto">
          <div className="flex">
            <AlertCircle className="text-red-400 flex-shrink-0 mr-3" size={20} />
            <div>
              <h3 className="text-sm font-medium text-red-200">Error Loading Data</h3>
              <div className="mt-2 text-sm text-red-300">{error}</div>
              <button
                onClick={fetchLeaderboard}
                className="mt-4 bg-red-800 hover:bg-red-700 text-red-200 px-3 py-2 rounded-md text-sm font-medium"
              >
                Try Again
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black dark:bg-gray-900 text-white font-sans">
      {/* API Source Toggles */}
      <div className="bg-gray-900 dark:bg-gray-800 border-b border-gray-700 px-6 py-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-wrap items-center gap-4">
            <span className="text-sm font-medium text-gray-300">Data Sources:</span>
            {Object.entries(apiSources).map(([source, enabled]) => (
              <label key={source} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={enabled}
                  onChange={() => handleSourceToggle(source)}
                  className="rounded border-gray-600 bg-gray-700 text-blue-500 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-300 capitalize">
                  {source === 'external' ? 'External API' : source === 'internal' ? 'Internal Data' : 'Demo Data'}
                </span>
              </label>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="p-6">
        <div className="max-w-7xl mx-auto">
          {data ? (
            <div className="space-y-6">
              {/* Summary Cards */}
              {Array.isArray(data) && data.length > 0 ? (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-gray-800 dark:bg-gray-700 border border-gray-700 rounded-lg p-4">
                      <div className="text-sm text-gray-400 mb-1">Total Players</div>
                      <div className="text-2xl font-bold text-blue-400">{data.length}</div>
                    </div>
                    {data[0]?.score && (
                      <div className="bg-gray-800 dark:bg-gray-700 border border-gray-700 rounded-lg p-4">
                        <div className="text-sm text-gray-400 mb-1">Top Score</div>
                        <div className="text-2xl font-bold text-green-400">{data[0].score?.toLocaleString()}</div>
                      </div>
                    )}
                    {data[0]?.points && (
                      <div className="bg-gray-800 dark:bg-gray-700 border border-gray-700 rounded-lg p-4">
                        <div className="text-sm text-gray-400 mb-1">Top Points</div>
                        <div className="text-2xl font-bold text-yellow-400">{data[0].points?.toLocaleString()}</div>
                      </div>
                    )}
                    <div className="bg-gray-800 dark:bg-gray-700 border border-gray-700 rounded-lg p-4">
                      <div className="text-sm text-gray-400 mb-1">Last Updated</div>
                      <div className="text-sm font-bold text-purple-400">{lastUpdated?.toLocaleTimeString()}</div>
                    </div>
                  </div>

                  {/* Leaderboard Table */}
                  <div className="bg-gray-800 dark:bg-gray-700 border border-gray-700 rounded-lg overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="bg-gray-700 dark:bg-gray-600 border-b border-gray-700">
                            <th className="px-6 py-3 text-left text-sm font-semibold text-yellow-400">Rank</th>
                            <th className="px-6 py-3 text-left text-sm font-semibold text-gray-300">Player Name</th>
                            {data[0]?.score !== undefined && (
                              <th className="px-6 py-3 text-right text-sm font-semibold text-gray-300">Score</th>
                            )}
                            {data[0]?.points !== undefined && (
                              <th className="px-6 py-3 text-right text-sm font-semibold text-gray-300">Points</th>
                            )}
                            {data[0]?.wins !== undefined && (
                              <th className="px-6 py-3 text-right text-sm font-semibold text-gray-300">Wins</th>
                            )}
                            {data[0]?.losses !== undefined && (
                              <th className="px-6 py-3 text-right text-sm font-semibold text-gray-300">Losses</th>
                            )}
                          </tr>
                        </thead>
                        <tbody>
                          {data.map((player, index) => (
                            <tr 
                              key={index} 
                              className={`border-b border-gray-700 ${
                                index % 2 === 0 ? 'bg-gray-800 dark:bg-gray-750' : 'bg-gray-750 dark:bg-gray-700'
                              } hover:bg-gray-700 dark:hover:bg-gray-600 transition`}
                            >
                              <td className="px-6 py-4 text-sm font-bold text-yellow-400">#{index + 1}</td>
                              <td className="px-6 py-4 text-sm">
                                <div className="font-medium text-white">{player.name || player.username || 'Unknown'}</div>
                              </td>
                              {player.score !== undefined && (
                                <td className="px-6 py-4 text-sm text-right text-blue-400 font-medium">
                                  {player.score?.toLocaleString()}
                                </td>
                              )}
                              {player.points !== undefined && (
                                <td className="px-6 py-4 text-sm text-right text-green-400 font-medium">
                                  {player.points?.toLocaleString()}
                                </td>
                              )}
                              {player.wins !== undefined && (
                                <td className="px-6 py-4 text-sm text-right text-blue-400 font-medium">
                                  {player.wins}
                                </td>
                              )}
                              {player.losses !== undefined && (
                                <td className="px-6 py-4 text-sm text-right text-red-400 font-medium">
                                  {player.losses}
                                </td>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              ) : (
                <div className="bg-gray-800 dark:bg-gray-700 border border-gray-700 rounded-lg p-8 text-center">
                  <p className="text-gray-400">Loading or no leaderboard data available</p>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-gray-800 dark:bg-gray-700 border border-gray-700 rounded-lg p-8 text-center">
              <p className="text-gray-400">No leaderboard data available</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
