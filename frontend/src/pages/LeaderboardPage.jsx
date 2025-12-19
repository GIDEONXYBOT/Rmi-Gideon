import React, { useState, useEffect } from 'react';
import { leaderboardService } from '../services/leaderboardService';
import { useToast } from '../context/ToastContext';

const LeaderboardPage = () => {
  const [draws, setDraws] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState(null);
  const [currentDraw, setCurrentDraw] = useState(null);
  const { showToast } = useToast();

  const fetchData = async () => {
    setLoading(true);
    setError(null);

    try {
      const [drawsData, statsData, currentDrawData] = await Promise.all([
        leaderboardService.fetchLeaderboardData(),
        leaderboardService.getBettingStats(),
        leaderboardService.getCurrentDraw()
      ]);

      setDraws(drawsData);
      setStats(statsData);
      setCurrentDraw(currentDrawData);

      showToast({
        type: 'success',
        message: `Loaded ${drawsData.length} draws from external leaderboard`
      });
    } catch (err) {
      console.error('Error fetching leaderboard data:', err);
      setError(err.message);
      showToast({
        type: 'error',
        message: 'Failed to load leaderboard data'
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP'
    }).format(amount);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString('en-PH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

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
      <div className="min-h-screen bg-gray-900 text-white">
        <div className="flex items-center justify-center h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
          <span className="ml-3 text-lg">Loading leaderboard data...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-900 text-white p-6">
        <div className="bg-red-900 border border-red-700 rounded-lg p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-200">Error Loading Data</h3>
              <div className="mt-2 text-sm text-red-300">{error}</div>
              <div className="mt-4">
                <button
                  onClick={fetchData}
                  className="bg-red-800 hover:bg-red-700 text-red-200 px-3 py-2 rounded-md text-sm font-medium"
                >
                  Try Again
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white font-sans">
      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-700 px-4 py-3">
        <div className="flex justify-between items-center max-w-6xl mx-auto">
          <div className="flex items-center space-x-6">
            <div className="text-xl font-bold text-white">
              {getCurrentTime()}
            </div>
            <div className="text-sm text-gray-400">
              {getCurrentDate()}
            </div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-yellow-400">
              RMI FRIDAY - 90 FIGHTS
            </div>
            <div className="text-xs text-gray-500">
              DECEMBER 19, 2025 MINIMUM BET 100
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* Current Fight Section */}
        {currentDraw && (
          <div className="bg-gray-900 rounded-lg p-6 mb-6 border border-gray-700">
            <div className="text-center mb-6">
              <div className="text-4xl font-bold text-white mb-2">
                FIGHT {currentDraw.batch?.fightSequence || currentDraw.id}
              </div>
              <div className="text-lg text-gray-300">
                {currentDraw.status === 'completed' ? `RESULT: ${currentDraw.result1?.toUpperCase() || 'PENDING'}` : 'LIVE BETTING'}
              </div>
            </div>

            {/* Betting Options */}
            <div className="grid grid-cols-3 gap-4 mb-6">
              {/* Meron (Red) */}
              <div className="bg-red-600 hover:bg-red-500 rounded-lg p-4 text-center cursor-pointer transition-all duration-200 border-2 border-red-500">
                <div className="text-2xl font-bold text-white mb-2">MERON</div>
                <div className="text-lg text-red-100 font-semibold">
                  {currentDraw.details?.formattedRedOdds || '1.47'}
                </div>
                <div className="text-sm text-red-200 mt-1">
                  ₱{currentDraw.details?.redTotalBetAmount?.toLocaleString() || '0'}
                </div>
              </div>

              {/* Draw */}
              <div className="bg-yellow-600 hover:bg-yellow-500 rounded-lg p-4 text-center cursor-pointer transition-all duration-200 border-2 border-yellow-500">
                <div className="text-2xl font-bold text-white mb-2">DRAW</div>
                <div className="text-lg text-yellow-100 font-semibold">
                  {currentDraw.details?.formattedDrawOdds || '8.00'}
                </div>
                <div className="text-sm text-yellow-200 mt-1">
                  ₱{currentDraw.details?.drawTotalBetAmount?.toLocaleString() || '0'}
                </div>
              </div>

              {/* Wala (Blue) */}
              <div className="bg-blue-600 hover:bg-blue-500 rounded-lg p-4 text-center cursor-pointer transition-all duration-200 border-2 border-blue-500">
                <div className="text-2xl font-bold text-white mb-2">WALA</div>
                <div className="text-lg text-blue-100 font-semibold">
                  {currentDraw.details?.formattedBlueOdds || '2.63'}
                </div>
                <div className="text-sm text-blue-200 mt-1">
                  ₱{currentDraw.details?.blueTotalBetAmount?.toLocaleString() || '0'}
                </div>
              </div>
            </div>

            {/* Fight Status */}
            <div className="text-center">
              <div className={`text-xl font-bold ${currentDraw.status === 'started' ? 'text-green-400' : 'text-gray-400'}`}>
                {currentDraw.status === 'started' ? 'BETTING IS OPEN' : 'BETTING CLOSED'}
              </div>
            </div>
          </div>
        )}

        {/* Fight Results History */}
        <div className="bg-gray-900 rounded-lg border border-gray-700 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-700 bg-gray-800">
            <h3 className="text-lg font-semibold text-white">FIGHT RESULTS</h3>
          </div>
          <div className="p-6">
            {/* Results Grid */}
            <div className="grid grid-cols-6 gap-3 mb-6">
              {draws.slice(0, 18).reverse().map((draw, index) => (
                <div key={draw.id} className="bg-gray-800 rounded border border-gray-600 p-3 text-center">
                  <div className="text-xs text-gray-400 mb-1">
                    #{draw.batch?.fightSequence || draw.id}
                  </div>
                  <div className={`text-lg font-bold ${
                    draw.result1 === 'red' ? 'text-red-400' :
                    draw.result1 === 'blue' ? 'text-blue-400' :
                    draw.result1 === 'draw' ? 'text-yellow-400' :
                    'text-gray-400'
                  }`}>
                    {draw.result1 ? draw.result1.toUpperCase() : '?'}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {draw.details?.redTotalBetAmount && draw.details?.blueTotalBetAmount ?
                      `₱${(draw.details.redTotalBetAmount + draw.details.blueTotalBetAmount + (draw.details.drawTotalBetAmount || 0)).toLocaleString()}` :
                      '₱0'
                    }
                  </div>
                </div>
              ))}
            </div>

            {/* Winner Sequence */}
            <div className="text-center mb-4">
              <div className="text-sm text-gray-400 mb-2">WINNER SEQUENCE</div>
              <div className="text-lg font-mono text-white bg-gray-800 p-2 rounded">
                {draws.slice(0, 18).reverse().map(draw => draw.result1 ? draw.result1.charAt(0).toUpperCase() : '?').join(' ')}
              </div>
            </div>

            {/* Fight Numbers */}
            <div className="text-center">
              <div className="text-xs text-gray-500 mb-2">FIGHT NUMBERS</div>
              <div className="text-sm font-mono text-gray-400">
                {draws.slice(0, 18).reverse().map((draw, index) => (
                  <span key={draw.id} className="mx-1">
                    {18 - index}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Footer Message */}
        <div className="text-center mt-6 text-sm text-gray-500">
          Payout less than 1.40 shall be canceled
        </div>
      </div>

      {/* Refresh Button */}
      <div className="fixed bottom-6 right-6">
        <button
          onClick={fetchData}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2 shadow-lg text-sm font-medium"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          <span>REFRESH</span>
        </button>
      </div>
    </div>
  );
};

export default LeaderboardPage;