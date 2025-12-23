import React, { useState, useEffect } from 'react';
import { RefreshCw, AlertCircle, Download, TrendingUp } from 'lucide-react';

export default function GTABettingEventReport() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState({});

  const fetchReports = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Fetch from external GTA dashboard with token
      const apiUrl = 'http://122.3.203.8/dashboard';
      const token = 'af9735e1c7857a07f0b078df36842ace';
      
      const response = await fetch(apiUrl, {
        headers: {
          'X-TOKEN': token,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP Error: ${response.status}`);
      }
      
      const result = await response.json();
      setData(result);
      
      // Calculate stats
      if (Array.isArray(result)) {
        const stats = {
          totalEvents: result.length,
          totalAmount: result.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0),
          activeEvents: result.filter(item => item.status === 'active' || item.status === 'pending').length,
          completedEvents: result.filter(item => item.status === 'completed' || item.status === 'closed').length
        };
        setStats(stats);
      }
    } catch (err) {
      const errorMsg = err.message || 'Failed to fetch GTA betting event reports';
      setError(errorMsg);
      console.error('GTA betting reports fetch error:', errorMsg, err);
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
    element.download = `gta-betting-event-reports-${new Date().getTime()}.json`;
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
    element.download = `gta-betting-event-reports-${new Date().getTime()}.csv`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  return (
    <div className="p-6 bg-gray-50 dark:bg-gray-900 min-h-screen">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">GTA Betting Event Report</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">Real-time betting events and data from GTA dashboard</p>
          </div>
          <button
            onClick={fetchReports}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium"
          >
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>

        {/* Statistics Panel */}
        {!loading && !error && stats.totalEvents !== undefined && (
          <div className="grid grid-cols-4 gap-4 mb-6">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
              <p className="text-gray-600 dark:text-gray-400 text-sm font-medium">Total Events</p>
              <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">{stats.totalEvents}</p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
              <p className="text-gray-600 dark:text-gray-400 text-sm font-medium">Total Amount</p>
              <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">₱{stats.totalAmount?.toFixed(2)}</p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
              <p className="text-gray-600 dark:text-gray-400 text-sm font-medium">Active</p>
              <p className="text-3xl font-bold text-green-600 dark:text-green-400 mt-2">{stats.activeEvents}</p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
              <p className="text-gray-600 dark:text-gray-400 text-sm font-medium">Completed</p>
              <p className="text-3xl font-bold text-blue-600 dark:text-blue-400 mt-2">{stats.completedEvents}</p>
            </div>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-8 text-center">
            <div className="animate-spin w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full mx-auto mb-4"></div>
            <p className="text-gray-600 dark:text-gray-400">Loading GTA betting event reports...</p>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
            <div className="flex items-start gap-3">
              <AlertCircle size={20} className="text-red-600 dark:text-red-400 mt-0.5" />
              <div>
                <h3 className="font-semibold text-red-800 dark:text-red-300">Error Fetching Reports</h3>
                <p className="text-red-700 dark:text-red-400 text-sm mt-1">{error}</p>
                <button
                  onClick={fetchReports}
                  className="mt-3 px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700"
                >
                  Try Again
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Data Display */}
        {!loading && !error && data && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
            {/* Download Options */}
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex gap-2">
              <button
                onClick={downloadReportAsJSON}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium"
              >
                <Download size={16} />
                Download JSON
              </button>
              <button
                onClick={downloadReportAsCSV}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium"
              >
                <Download size={16} />
                Download CSV
              </button>
            </div>

            {/* Table */}
            {Array.isArray(data) && data.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-100 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
                    <tr>
                      {Object.keys(data[0] || {}).map(key => (
                        <th
                          key={key}
                          className="px-6 py-3 text-left text-sm font-semibold text-gray-900 dark:text-white whitespace-nowrap"
                        >
                          {key}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.map((row, idx) => (
                      <tr
                        key={idx}
                        className={idx % 2 === 0 ? 'bg-white dark:bg-gray-800' : 'bg-gray-50 dark:bg-gray-700'}
                      >
                        {Object.entries(row).map(([key, value]) => (
                          <td
                            key={key}
                            className="px-6 py-4 text-sm text-gray-600 dark:text-gray-300"
                          >
                            {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-8 text-center">
                <TrendingUp size={48} className="mx-auto text-gray-400 mb-4" />
                <p className="text-gray-600 dark:text-gray-400">No data available</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
