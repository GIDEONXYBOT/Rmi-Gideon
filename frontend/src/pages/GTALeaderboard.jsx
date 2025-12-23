import React, { useState, useEffect } from 'react';
import { RefreshCw, AlertCircle, BarChart3 } from 'lucide-react';
import axios from 'axios';
import { getApiUrl } from '../utils/apiConfig.js';

export default function GTALeaderboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  const fetchLeaderboard = async () => {
    try {
      setLoading(true);
      setError(null);

      const token = localStorage.getItem('token');
      if (!token) {
        setError('Authentication token not found. Please log in again.');
        setLoading(false);
        return;
      }

      // Fetch from backend proxy
      const url = `${getApiUrl()}/api/external-betting/gta-event-report-proxy`;
      const response = await axios.get(url);
      
      if (response.data.success && response.data.data) {
        setData(response.data.data);
        setLastUpdated(new Date());
      } else {
        throw new Error('Invalid data format from API');
      }
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
      {/* Header */}
      <div className="bg-gray-900 dark:bg-gray-800 border-b border-gray-700 px-6 py-4 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center space-x-4">
              <BarChart3 size={24} className="text-yellow-400" />
              <h1 className="text-2xl font-bold text-white">🎮 GTA Leaderboards</h1>
            </div>
            <button
              onClick={fetchLeaderboard}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50"
              title="Refresh data"
            >
              <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
              Refresh
            </button>
          </div>
          <div className="flex justify-between items-center text-sm">
            <div className="text-gray-400">
              {getCurrentTime()} • {getCurrentDate()}
            </div>
            {lastUpdated && (
              <div className="text-xs text-gray-500">
                Last updated: {lastUpdated.toLocaleTimeString()}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="p-6">
        <div className="max-w-7xl mx-auto">
          {data && data.staffReports ? (
            <div className="space-y-6">
              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-gray-800 dark:bg-gray-700 border border-gray-700 rounded-lg p-4">
                  <div className="text-sm text-gray-400 mb-1">Total Bets</div>
                  <div className="text-2xl font-bold text-blue-400">
                    {formatCurrency(data.totalBetAmount || 0)}
                  </div>
                </div>
                <div className="bg-gray-800 dark:bg-gray-700 border border-gray-700 rounded-lg p-4">
                  <div className="text-sm text-gray-400 mb-1">Total Payout</div>
                  <div className="text-2xl font-bold text-red-400">
                    {formatCurrency(data.totalPayout || 0)}
                  </div>
                </div>
                <div className="bg-gray-800 dark:bg-gray-700 border border-gray-700 rounded-lg p-4">
                  <div className="text-sm text-gray-400 mb-1">Total Commission (5.5%)</div>
                  <div className="text-2xl font-bold text-green-400">
                    {formatCurrency((data.totalBetAmount || 0) * 0.055)}
                  </div>
                </div>
                <div className="bg-gray-800 dark:bg-gray-700 border border-gray-700 rounded-lg p-4">
                  <div className="text-sm text-gray-400 mb-1">Active Tellers</div>
                  <div className="text-2xl font-bold text-yellow-400">
                    {data.staffReports ? data.staffReports.length : 0}
                  </div>
                </div>
              </div>

              {/* Leaderboard Table */}
              <div className="bg-gray-800 dark:bg-gray-700 border border-gray-700 rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-gray-700 dark:bg-gray-600 border-b border-gray-700">
                        <th className="px-6 py-3 text-left text-sm font-semibold text-yellow-400">Rank</th>
                        <th className="px-6 py-3 text-left text-sm font-semibold text-gray-300">Teller</th>
                        <th className="px-6 py-3 text-right text-sm font-semibold text-gray-300">Bet Amount</th>
                        <th className="px-6 py-3 text-right text-sm font-semibold text-gray-300">System Balance</th>
                        <th className="px-6 py-3 text-right text-sm font-semibold text-gray-300">Commission</th>
                        <th className="px-6 py-3 text-right text-sm font-semibold text-gray-300">Profit/Loss</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(data.staffReports || [])
                        .sort((a, b) => (b.betAmount || 0) - (a.betAmount || 0))
                        .map((staff, index) => {
                          const profit = (staff.betAmount || 0) - (staff.payout || 0);
                          const commission = (staff.betAmount || 0) * 0.055;
                          return (
                            <tr 
                              key={index} 
                              className={`border-b border-gray-700 ${
                                index % 2 === 0 ? 'bg-gray-800 dark:bg-gray-750' : 'bg-gray-750 dark:bg-gray-700'
                              } hover:bg-gray-700 dark:hover:bg-gray-600 transition`}
                            >
                              <td className="px-6 py-4 text-sm font-bold text-yellow-400">#{index + 1}</td>
                              <td className="px-6 py-4 text-sm">
                                <div className="font-medium text-white">{staff.name}</div>
                                <div className="text-xs text-gray-400">{staff.username}</div>
                              </td>
                              <td className="px-6 py-4 text-sm text-right text-blue-400 font-medium">
                                {formatCurrency(staff.betAmount || 0)}
                              </td>
                              <td className="px-6 py-4 text-sm text-right text-green-400 font-medium">
                                {formatCurrency(staff.systemBalance || 0)}
                              </td>
                              <td className="px-6 py-4 text-sm text-right text-purple-400 font-medium">
                                {formatCurrency(commission)}
                              </td>
                              <td className={`px-6 py-4 text-sm text-right font-medium ${
                                profit >= 0 ? 'text-green-400' : 'text-red-400'
                              }`}>
                                {profit >= 0 ? '+' : ''}{formatCurrency(profit)}
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              </div>
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
