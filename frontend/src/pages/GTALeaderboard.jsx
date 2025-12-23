import React, { useState, useEffect } from 'react';
import { RefreshCw, AlertCircle } from 'lucide-react';

export default function GTALeaderboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchLeaderboard = async () => {
    try {
      setLoading(true);
      setError(null);
      // Fetch from backend proxy instead of directly from HTTP endpoint
      // This avoids mixed content (HTTPS -> HTTP) security issues
      const backendUrl = 'https://rmi-backend-zhdr.onrender.com/api/leaderboard/gta';
      const response = await fetch(backendUrl);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP Error: ${response.status}`);
      }
      
      const result = await response.json();
      setData(result);
    } catch (err) {
      const errorMsg = err.message || 'Failed to fetch GTA leaderboard data';
      setError(errorMsg);
      console.error('Leaderboard fetch error:', errorMsg, err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaderboard();
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchLeaderboard, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="p-6 bg-gray-50 dark:bg-gray-900 min-h-screen">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-gray-800 dark:text-white">🎮 GTA Leaderboards</h1>
          <button
            onClick={fetchLeaderboard}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 dark:bg-blue-700 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-800 disabled:opacity-50"
          >
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>

        {/* Error State */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6 flex gap-3">
            <AlertCircle className="text-red-600 dark:text-red-400 flex-shrink-0" size={20} />
            <div>
              <p className="font-semibold text-red-800 dark:text-red-200">Error fetching data</p>
              <p className="text-red-700 dark:text-red-300 text-sm">{error}</p>
            </div>
          </div>
        )}

        {/* Loading State */}
        {loading && !data && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-8 text-center">
            <div className="animate-spin w-8 h-8 border-4 border-blue-200 dark:border-blue-900 border-t-blue-600 dark:border-t-blue-400 rounded-full mx-auto mb-4"></div>
            <p className="text-gray-600 dark:text-gray-300">Loading GTA leaderboard data...</p>
          </div>
        )}

        {/* Data Display */}
        {data && !loading && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
            {/* JSON Raw View */}
            <div className="p-6">
              <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-4">📊 Leaderboard Data</h2>
              
              {/* Check if data is an array */}
              {Array.isArray(data) ? (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-gray-100 dark:bg-gray-700">
                        <th className="border border-gray-300 dark:border-gray-600 px-4 py-2 text-left text-gray-900 dark:text-white">Rank</th>
                        <th className="border border-gray-300 dark:border-gray-600 px-4 py-2 text-left text-gray-900 dark:text-white">Name</th>
                        <th className="border border-gray-300 dark:border-gray-600 px-4 py-2 text-right text-gray-900 dark:text-white">Score</th>
                        <th className="border border-gray-300 dark:border-gray-600 px-4 py-2 text-left text-gray-900 dark:text-white">Details</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.map((item, idx) => (
                        <tr key={idx} className={idx % 2 === 0 ? 'bg-white dark:bg-gray-800' : 'bg-gray-50 dark:bg-gray-750'}>
                          <td className="border border-gray-300 dark:border-gray-600 px-4 py-2 font-bold text-gray-900 dark:text-white">{idx + 1}</td>
                          <td className="border border-gray-300 dark:border-gray-600 px-4 py-2 text-gray-900 dark:text-white">{item.name || item.player || 'N/A'}</td>
                          <td className="border border-gray-300 dark:border-gray-600 px-4 py-2 text-right font-bold text-gray-900 dark:text-white">{item.score || item.points || 0}</td>
                          <td className="border border-gray-300 dark:border-gray-600 px-4 py-2 text-sm text-gray-600 dark:text-gray-400">
                            {JSON.stringify(item).length > 100 
                              ? JSON.stringify(item).substring(0, 100) + '...' 
                              : JSON.stringify(item)
                            }
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="bg-gray-100 dark:bg-gray-700 p-4 rounded text-sm font-mono text-gray-900 dark:text-gray-100 overflow-x-auto max-h-96 overflow-y-auto">
                  <pre>{JSON.stringify(data, null, 2)}</pre>
                </div>
              )}

              {/* Stats */}
              <div className="mt-6 grid grid-cols-3 gap-4">
                <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                  <p className="text-gray-600 dark:text-gray-400 text-sm">Total Entries</p>
                  <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                    {Array.isArray(data) ? data.length : 'N/A'}
                  </p>
                </div>
                <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg border border-green-200 dark:border-green-800">
                  <p className="text-gray-600 dark:text-gray-400 text-sm">Last Updated</p>
                  <p className="text-sm font-bold text-green-600 dark:text-green-400">{new Date().toLocaleTimeString()}</p>
                </div>
                <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg border border-purple-200 dark:border-purple-800">
                  <p className="text-gray-600 dark:text-gray-400 text-sm">Source</p>
                  <p className="text-xs font-bold text-purple-600 dark:text-purple-400 break-words">GTA Event Leaderboard</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Empty State */}
        {data && !loading && Object.keys(data).length === 0 && (
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
            <p className="text-yellow-800 dark:text-yellow-200">No leaderboard data available at this moment.</p>
          </div>
        )}
      </div>
    </div>
  );
}
