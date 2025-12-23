import React, { useState, useEffect } from 'react';
import { RefreshCw, AlertCircle, Download } from 'lucide-react';

export default function BettingEventReports() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchReports = async () => {
    try {
      setLoading(true);
      setError(null);
      // Fetch from backend proxy
      const backendUrl = 'https://rmi-backend-zhdr.onrender.com/api/leaderboard/gta';
      const response = await fetch(backendUrl);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP Error: ${response.status}`);
      }
      
      const result = await response.json();
      setData(result);
    } catch (err) {
      const errorMsg = err.message || 'Failed to fetch betting event reports';
      setError(errorMsg);
      console.error('Betting reports fetch error:', errorMsg, err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchReports, 30000);
    return () => clearInterval(interval);
  }, []);

  const downloadReportAsJSON = () => {
    if (!data) return;
    const element = document.createElement('a');
    const file = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    element.href = URL.createObjectURL(file);
    element.download = `betting-event-reports-${new Date().getTime()}.json`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const downloadReportAsCSV = () => {
    if (!data || !Array.isArray(data)) return;
    
    // Convert array of objects to CSV
    const headers = Object.keys(data[0] || {});
    const csvContent = [
      headers.join(','),
      ...data.map(row => 
        headers.map(header => {
          const value = row[header];
          // Escape quotes and wrap in quotes if contains comma
          if (typeof value === 'string' && value.includes(',')) {
            return `"${value.replace(/"/g, '""')}"`;
          }
          return value;
        }).join(',')
      )
    ].join('\n');

    const element = document.createElement('a');
    const file = new Blob([csvContent], { type: 'text/csv' });
    element.href = URL.createObjectURL(file);
    element.download = `betting-event-reports-${new Date().getTime()}.csv`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-gray-800">BETTING EVENT REPORTS</h1>
          <div className="flex gap-2">
            {data && (
              <>
                <button
                  onClick={downloadReportAsJSON}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                  title="Download as JSON"
                >
                  <Download size={18} />
                  JSON
                </button>
                <button
                  onClick={downloadReportAsCSV}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                  title="Download as CSV"
                >
                  <Download size={18} />
                  CSV
                </button>
              </>
            )}
            <button
              onClick={fetchReports}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
              Refresh
            </button>
          </div>
        </div>

        {/* Error State */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 flex gap-3">
            <AlertCircle className="text-red-600 flex-shrink-0" size={20} />
            <div>
              <p className="font-semibold text-red-800">Error fetching data</p>
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          </div>
        )}

        {/* Loading State */}
        {loading && !data && (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <div className="animate-spin w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full mx-auto mb-4"></div>
            <p className="text-gray-600">Loading betting event reports...</p>
          </div>
        )}

        {/* Data Display */}
        {data && !loading && (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="p-6">
              {/* Check if data is an array */}
              {Array.isArray(data) ? (
                <>
                  <h2 className="text-xl font-bold text-gray-800 mb-4">Events ({data.length} total)</h2>
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="bg-blue-50">
                          <th className="border border-gray-300 px-4 py-2 text-left font-semibold">Event ID</th>
                          <th className="border border-gray-300 px-4 py-2 text-left font-semibold">Date/Time</th>
                          <th className="border border-gray-300 px-4 py-2 text-left font-semibold">Type</th>
                          <th className="border border-gray-300 px-4 py-2 text-right font-semibold">Amount</th>
                          <th className="border border-gray-300 px-4 py-2 text-left font-semibold">Status</th>
                          <th className="border border-gray-300 px-4 py-2 text-left font-semibold">Details</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.map((item, idx) => (
                          <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                            <td className="border border-gray-300 px-4 py-2 font-mono text-sm">{item.id || item.eventId || idx + 1}</td>
                            <td className="border border-gray-300 px-4 py-2 text-sm">{item.date || item.timestamp || item.createdAt || 'N/A'}</td>
                            <td className="border border-gray-300 px-4 py-2 text-sm">{item.type || item.eventType || 'Event'}</td>
                            <td className="border border-gray-300 px-4 py-2 text-right font-bold">{item.amount || item.total || 0}</td>
                            <td className="border border-gray-300 px-4 py-2">
                              <span className={`inline-block px-2 py-1 rounded text-xs font-semibold ${
                                item.status === 'completed' || item.status === 'finished' 
                                  ? 'bg-green-100 text-green-800'
                                  : item.status === 'pending' || item.status === 'active'
                                  ? 'bg-yellow-100 text-yellow-800'
                                  : 'bg-gray-100 text-gray-800'
                              }`}>
                                {item.status || 'pending'}
                              </span>
                            </td>
                            <td className="border border-gray-300 px-4 py-2 text-xs text-gray-600">
                              {item.description || item.note || '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : (
                <div>
                  <h2 className="text-xl font-bold text-gray-800 mb-4">Raw Data</h2>
                  <div className="bg-gray-100 p-4 rounded text-sm font-mono overflow-x-auto max-h-96 overflow-y-auto">
                    <pre>{JSON.stringify(data, null, 2)}</pre>
                  </div>
                </div>
              )}

              {/* Stats */}
              <div className="mt-6 grid grid-cols-4 gap-4">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <p className="text-gray-600 text-sm">Total Events</p>
                  <p className="text-2xl font-bold text-blue-600">
                    {Array.isArray(data) ? data.length : 'N/A'}
                  </p>
                </div>
                <div className="bg-green-50 p-4 rounded-lg">
                  <p className="text-gray-600 text-sm">Last Updated</p>
                  <p className="text-sm font-bold text-green-600">{new Date().toLocaleTimeString()}</p>
                </div>
                <div className="bg-purple-50 p-4 rounded-lg">
                  <p className="text-gray-600 text-sm">Data Source</p>
                  <p className="text-xs font-bold text-purple-600">Reverb Leaderboard</p>
                </div>
                <div className="bg-orange-50 p-4 rounded-lg">
                  <p className="text-gray-600 text-sm">Report Status</p>
                  <p className="text-sm font-bold text-orange-600">Live</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Empty State */}
        {data && !loading && Object.keys(data).length === 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p className="text-yellow-800">No betting event data available at this moment.</p>
          </div>
        )}
      </div>
    </div>
  );
}
