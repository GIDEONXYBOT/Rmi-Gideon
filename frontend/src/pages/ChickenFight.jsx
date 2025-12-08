import React, { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import { AlertCircle, Loader, Trophy, Shield } from 'lucide-react';
import { SettingsContext } from '../context/SettingsContext';

export default function ChickenFight() {
  const { isDarkMode } = useContext(SettingsContext);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Game selection
  const [gameSelection, setGameSelection] = useState([]);
  const [selectedGames, setSelectedGames] = useState([]);
  const [showingGameSelection, setShowingGameSelection] = useState(false);
  const [savingGameSelection, setSavingGameSelection] = useState(false);

  // Entries
  const [entries, setEntries] = useState([]);
  const [entriesLoading, setEntriesLoading] = useState(false);

  // Betting
  const [bets, setBets] = useState([]);
  const [betsLoading, setBetsLoading] = useState(false);
  const [showBetForm, setShowBetForm] = useState(false);
  const [betFormData, setBetFormData] = useState({
    gameType: '2wins',
    entryId: '',
    side: 'meron',
    amount: ''
  });
  const [submittingBet, setSubmittingBet] = useState(false);

  // Results
  const [results, setResults] = useState(null);
  const [resultsLoading, setResultsLoading] = useState(false);

  // Fetch initial data
  useEffect(() => {
    fetchGameSelection();
    fetchEntries();
    fetchBets();
  }, []);

  // Fetch game selection
  const fetchGameSelection = async () => {
    try {
      const response = await axios.get('/api/chicken-fight/game/daily-selection');
      if (response.data.success) {
        setGameSelection(response.data.game.gameTypes || []);
        setSelectedGames(response.data.game.gameTypes || []);
      }
    } catch (err) {
      console.error('Error fetching game selection:', err);
    }
  };

  // Fetch entries
  const fetchEntries = async () => {
    setEntriesLoading(true);
    try {
      const response = await axios.get('/api/chicken-fight/entries');
      if (response.data.success) {
        setEntries(response.data.entries || []);
      }
    } catch (err) {
      console.error('Error fetching entries:', err);
    } finally {
      setEntriesLoading(false);
    }
  };

  // Fetch bets
  const fetchBets = async () => {
    setBetsLoading(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      const response = await axios.get('/api/chicken-fight/bets', {
        params: { gameDate: today }
      });
      if (response.data.success) {
        setBets(response.data.bets || []);
      }
    } catch (err) {
      console.error('Error fetching bets:', err);
    } finally {
      setBetsLoading(false);
    }
  };

  // Fetch results
  const fetchResults = async () => {
    setResultsLoading(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      const response = await axios.get('/api/chicken-fight/game/results', {
        params: { gameDate: today }
      });
      if (response.data.success) {
        setResults(response.data.game);
      }
    } catch (err) {
      console.error('Error fetching results:', err);
    } finally {
      setResultsLoading(false);
    }
  };

  // Save game selection
  const handleSaveGameSelection = async () => {
    if (selectedGames.length === 0) {
      setError('Select at least one game type');
      return;
    }

    setSavingGameSelection(true);
    setError('');
    setSuccess('');

    try {
      const response = await axios.post('/api/chicken-fight/game/daily-selection', {
        gameTypes: selectedGames
      });

      if (response.data.success) {
        setGameSelection(selectedGames);
        setShowingGameSelection(false);
        setSuccess('Game selection updated!');
        setTimeout(() => setSuccess(''), 3000);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save game selection');
    } finally {
      setSavingGameSelection(false);
    }
  };

  // Toggle game selection
  const toggleGameType = (gameType) => {
    if (selectedGames.includes(gameType)) {
      setSelectedGames(selectedGames.filter(g => g !== gameType));
    } else {
      setSelectedGames([...selectedGames, gameType]);
    }
  };

  // Place bet
  const handlePlaceBet = async (e) => {
    e.preventDefault();
    setSubmittingBet(true);
    setError('');
    setSuccess('');

    try {
      if (!betFormData.entryId || !betFormData.amount) {
        setError('Please fill all fields');
        setSubmittingBet(false);
        return;
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const response = await axios.post('/api/chicken-fight/bets', {
        gameDate: today.toISOString(),
        gameType: betFormData.gameType,
        entryId: betFormData.entryId,
        side: betFormData.side,
        amount: parseFloat(betFormData.amount)
      });

      if (response.data.success) {
        setSuccess('Bet placed successfully!');
        setBetFormData({ gameType: '2wins', entryId: '', side: 'meron', amount: '' });
        setShowBetForm(false);
        fetchBets();
        setTimeout(() => setSuccess(''), 3000);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to place bet');
    } finally {
      setSubmittingBet(false);
    }
  };

  // Get entries for selected game type
  const getEntriesForGameType = (gameType) => {
    return entries.filter(e => e.gameType === gameType);
  };

  // Get bets for game type
  const getBetsForGameType = (gameType) => {
    return bets.filter(b => b.gameType === gameType);
  };

  return (
    <div className={`min-h-screen ${isDarkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
      {/* Header */}
      <div className={`${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} border-b sticky top-0 z-10`}>
        <div className="max-w-6xl mx-auto px-4 py-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className={`text-3xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                Chicken Fight
              </h1>
              <p className={`${isDarkMode ? 'text-gray-400' : 'text-gray-600'} mt-1`}>
                Daily betting platform
              </p>
            </div>
            <button
              onClick={() => setShowingGameSelection(!showingGameSelection)}
              className={`px-4 py-2 rounded-lg font-semibold transition ${
                isDarkMode
                  ? 'bg-blue-600 hover:bg-blue-700 text-white'
                  : 'bg-blue-500 hover:bg-blue-600 text-white'
              }`}
            >
              {showingGameSelection ? 'Cancel' : 'Select Games'}
            </button>
          </div>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className={`mx-4 mt-4 p-4 rounded-lg flex items-center gap-3 ${isDarkMode ? 'bg-red-900/30 text-red-400 border border-red-700' : 'bg-red-100 text-red-800 border border-red-300'}`}>
          <AlertCircle size={20} />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className={`mx-4 mt-4 p-4 rounded-lg flex items-center gap-3 ${isDarkMode ? 'bg-green-900/30 text-green-400 border border-green-700' : 'bg-green-100 text-green-800 border border-green-300'}`}>
          <span>✓ {success}</span>
        </div>
      )}

      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* Game Selection Section */}
        {showingGameSelection && (
          <div className={`${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} border rounded-lg p-6 mb-8`}>
            <h2 className={`text-xl font-bold mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
              Select Games for Today
            </h2>
            <div className="flex gap-4 mb-6">
              <button
                onClick={() => toggleGameType('2wins')}
                className={`flex-1 py-3 rounded-lg font-semibold transition ${
                  selectedGames.includes('2wins')
                    ? isDarkMode
                      ? 'bg-blue-600 text-white'
                      : 'bg-blue-500 text-white'
                    : isDarkMode
                    ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                2-Wins
              </button>
              <button
                onClick={() => toggleGameType('3wins')}
                className={`flex-1 py-3 rounded-lg font-semibold transition ${
                  selectedGames.includes('3wins')
                    ? isDarkMode
                      ? 'bg-blue-600 text-white'
                      : 'bg-blue-500 text-white'
                    : isDarkMode
                    ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                3-Wins
              </button>
            </div>
            <button
              onClick={handleSaveGameSelection}
              disabled={savingGameSelection}
              className={`w-full py-2 rounded-lg font-semibold transition ${
                savingGameSelection
                  ? isDarkMode
                    ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : isDarkMode
                  ? 'bg-green-600 hover:bg-green-700 text-white'
                  : 'bg-green-500 hover:bg-green-600 text-white'
              }`}
            >
              {savingGameSelection ? 'Saving...' : 'Save Selection'}
            </button>
          </div>
        )}

        {/* Active Games */}
        {gameSelection.length > 0 && (
          <div className="mb-8">
            <h2 className={`text-2xl font-bold mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
              Active Games Today
            </h2>
            <div className="flex gap-2 flex-wrap">
              {gameSelection.map(game => (
                <span
                  key={game}
                  className={`px-4 py-2 rounded-full font-semibold ${
                    isDarkMode
                      ? 'bg-blue-900/50 text-blue-300'
                      : 'bg-blue-100 text-blue-700'
                  }`}
                >
                  {game === '2wins' ? '2-Wins' : '3-Wins'}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Betting Section */}
        {gameSelection.length > 0 && (
          <div className="space-y-8 mb-8">
            {/* 2-Wins Betting */}
            {gameSelection.includes('2wins') && (
              <div className={`${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} border rounded-lg p-6`}>
                <h3 className={`text-xl font-bold mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                  2-Wins Betting
                </h3>

                {entriesLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader size={24} className={`animate-spin ${isDarkMode ? 'text-blue-400' : 'text-blue-500'}`} />
                  </div>
                ) : getEntriesForGameType('2wins').length === 0 ? (
                  <p className={isDarkMode ? 'text-gray-400' : 'text-gray-600'}>
                    No entries created for 2-Wins game yet.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    {getEntriesForGameType('2wins').map(entry => {
                      const entryBets = bets.filter(b => b.entryId === entry._id);
                      const totalAmount = entryBets.reduce((sum, b) => sum + b.amount, 0);

                      return (
                        <div
                          key={entry._id}
                          className={`${isDarkMode ? 'bg-gray-700' : 'bg-gray-50'} p-4 rounded-lg border ${isDarkMode ? 'border-gray-600' : 'border-gray-200'}`}
                        >
                          <div className="flex justify-between items-start mb-3">
                            <h4 className={`font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                              {entry.entryName}
                            </h4>
                            {totalAmount > 0 && (
                              <span className={`px-2 py-1 rounded text-sm font-semibold ${isDarkMode ? 'bg-blue-900/50 text-blue-300' : 'bg-blue-100 text-blue-700'}`}>
                                ₱{totalAmount.toLocaleString()}
                              </span>
                            )}
                          </div>
                          <button
                            onClick={() => {
                              setBetFormData({
                                gameType: '2wins',
                                entryId: entry._id,
                                side: 'meron',
                                amount: ''
                              });
                              setShowBetForm(true);
                            }}
                            className={`w-full py-2 rounded font-semibold transition ${
                              isDarkMode
                                ? 'bg-green-600 hover:bg-green-700 text-white'
                                : 'bg-green-500 hover:bg-green-600 text-white'
                            }`}
                          >
                            Place Bet
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* 3-Wins Betting */}
            {gameSelection.includes('3wins') && (
              <div className={`${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} border rounded-lg p-6`}>
                <h3 className={`text-xl font-bold mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                  3-Wins Betting
                </h3>

                {entriesLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader size={24} className={`animate-spin ${isDarkMode ? 'text-blue-400' : 'text-blue-500'}`} />
                  </div>
                ) : getEntriesForGameType('3wins').length === 0 ? (
                  <p className={isDarkMode ? 'text-gray-400' : 'text-gray-600'}>
                    No entries created for 3-Wins game yet.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    {getEntriesForGameType('3wins').map(entry => {
                      const entryBets = bets.filter(b => b.entryId === entry._id);
                      const totalAmount = entryBets.reduce((sum, b) => sum + b.amount, 0);

                      return (
                        <div
                          key={entry._id}
                          className={`${isDarkMode ? 'bg-gray-700' : 'bg-gray-50'} p-4 rounded-lg border ${isDarkMode ? 'border-gray-600' : 'border-gray-200'}`}
                        >
                          <div className="flex justify-between items-start mb-3">
                            <h4 className={`font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                              {entry.entryName}
                            </h4>
                            {totalAmount > 0 && (
                              <span className={`px-2 py-1 rounded text-sm font-semibold ${isDarkMode ? 'bg-purple-900/50 text-purple-300' : 'bg-purple-100 text-purple-700'}`}>
                                ₱{totalAmount.toLocaleString()}
                              </span>
                            )}
                          </div>
                          <button
                            onClick={() => {
                              setBetFormData({
                                gameType: '3wins',
                                entryId: entry._id,
                                side: 'meron',
                                amount: ''
                              });
                              setShowBetForm(true);
                            }}
                            className={`w-full py-2 rounded font-semibold transition ${
                              isDarkMode
                                ? 'bg-green-600 hover:bg-green-700 text-white'
                                : 'bg-green-500 hover:bg-green-600 text-white'
                            }`}
                          >
                            Place Bet
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Bet Form Modal */}
        {showBetForm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className={`${isDarkMode ? 'bg-gray-800' : 'bg-white'} rounded-lg p-6 max-w-md w-full`}>
              <h3 className={`text-xl font-bold mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                Place Bet
              </h3>

              <form onSubmit={handlePlaceBet} className="space-y-4">
                {/* Side Selection */}
                <div>
                  <label className={`block text-sm font-semibold mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    Choose Side
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setBetFormData({ ...betFormData, side: 'meron' })}
                      className={`flex-1 py-2 rounded font-semibold transition ${
                        betFormData.side === 'meron'
                          ? isDarkMode
                            ? 'bg-red-600 text-white'
                            : 'bg-red-500 text-white'
                          : isDarkMode
                          ? 'bg-gray-700 text-gray-300'
                          : 'bg-gray-200 text-gray-700'
                      }`}
                    >
                      Meron
                    </button>
                    <button
                      type="button"
                      onClick={() => setBetFormData({ ...betFormData, side: 'wala' })}
                      className={`flex-1 py-2 rounded font-semibold transition ${
                        betFormData.side === 'wala'
                          ? isDarkMode
                            ? 'bg-blue-600 text-white'
                            : 'bg-blue-500 text-white'
                          : isDarkMode
                          ? 'bg-gray-700 text-gray-300'
                          : 'bg-gray-200 text-gray-700'
                      }`}
                    >
                      Wala
                    </button>
                  </div>
                </div>

                {/* Amount */}
                <div>
                  <label className={`block text-sm font-semibold mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    Amount (₱)
                  </label>
                  <input
                    type="number"
                    value={betFormData.amount}
                    onChange={(e) => setBetFormData({ ...betFormData, amount: e.target.value })}
                    placeholder="Enter amount"
                    className={`w-full px-3 py-2 rounded border ${
                      isDarkMode
                        ? 'bg-gray-700 border-gray-600 text-white'
                        : 'bg-white border-gray-300 text-gray-900'
                    } focus:outline-none focus:border-blue-500`}
                  />
                </div>

                {/* Buttons */}
                <div className="flex gap-2 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowBetForm(false)}
                    className={`flex-1 py-2 rounded font-semibold transition ${
                      isDarkMode
                        ? 'bg-gray-700 hover:bg-gray-600 text-white'
                        : 'bg-gray-200 hover:bg-gray-300 text-gray-900'
                    }`}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingBet}
                    className={`flex-1 py-2 rounded font-semibold transition ${
                      submittingBet
                        ? isDarkMode
                          ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                          : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        : isDarkMode
                        ? 'bg-green-600 hover:bg-green-700 text-white'
                        : 'bg-green-500 hover:bg-green-600 text-white'
                    }`}
                  >
                    {submittingBet ? 'Placing...' : 'Place Bet'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
