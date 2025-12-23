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
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-gray-800">GTA LEADERBOARDS</h1>
          <button
            onClick={fetchLeaderboard}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>

        {/* Error State */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 flex gap-3">
            <AlertCircle className="text-red-600 flex-shrink-0" size={20} />
            <div>
              <p className="font-semibold text-red-800">Error fetching data</p>
              <p className="text-red-700 text-sm">{error}</p>
              <p className="text-red-600 text-xs mt-2">Source: http://122.3.203.8/leaderboard</p>
            </div>
          </div>
        )}

        {/* Loading State */}
        {loading && !data && (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <div className="animate-spin w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full mx-auto mb-4"></div>
            <p className="text-gray-600">Loading GTA leaderboard data...</p>
          </div>
        )}

        {/* Data Display */}
        {data && !loading && (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            {/* JSON Raw View */}
            <div className="p-6">
              <h2 className="text-xl font-bold text-gray-800 mb-4">Raw Data</h2>
              
              {/* Check if data is an array */}
              {Array.isArray(data) ? (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-gray-100">
                        <th className="border border-gray-300 px-4 py-2 text-left">Rank</th>
                        <th className="border border-gray-300 px-4 py-2 text-left">Name</th>
                        <th className="border border-gray-300 px-4 py-2 text-right">Score</th>
                        <th className="border border-gray-300 px-4 py-2 text-left">Details</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.map((item, idx) => (
                        <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                          <td className="border border-gray-300 px-4 py-2 font-bold">{idx + 1}</td>
                          <td className="border border-gray-300 px-4 py-2">{item.name || item.player || 'N/A'}</td>
                          <td className="border border-gray-300 px-4 py-2 text-right font-bold">{item.score || item.points || 0}</td>
                          <td className="border border-gray-300 px-4 py-2 text-sm text-gray-600">
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
                <div className="bg-gray-100 p-4 rounded text-sm font-mono overflow-x-auto max-h-96 overflow-y-auto">
                  <pre>{JSON.stringify(data, null, 2)}</pre>
                </div>
              )}

              {/* Stats */}
              <div className="mt-6 grid grid-cols-3 gap-4">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <p className="text-gray-600 text-sm">Total Entries</p>
                  <p className="text-2xl font-bold text-blue-600">
                    {Array.isArray(data) ? data.length : 'N/A'}
                  </p>
                </div>
                <div className="bg-green-50 p-4 rounded-lg">
                  <p className="text-gray-600 text-sm">Last Updated</p>
                  <p className="text-sm font-bold text-green-600">{new Date().toLocaleTimeString()}</p>
                </div>
                <div className="bg-purple-50 p-4 rounded-lg">
                  <p className="text-gray-600 text-sm">Source</p>
                  <p className="text-xs font-bold text-purple-600 break-words">122.3.203.8</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Empty State */}
        {data && !loading && Object.keys(data).length === 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p className="text-yellow-800">No leaderboard data available at this moment.</p>
          </div>
        )}
      </div>
    </div>
  );
}
