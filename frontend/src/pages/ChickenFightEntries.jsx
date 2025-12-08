import React, { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import { AlertCircle, Plus, Loader } from 'lucide-react';
import { SettingsContext } from '../context/SettingsContext';

export default function ChickenFightEntries() {
  const { isDarkMode } = useContext(SettingsContext);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form states
  const [showForm, setShowForm] = useState(false);
  const [gameType, setGameType] = useState('2wins');
  const [entryName, setEntryName] = useState('');
  const [legBands, setLegBands] = useState(['', '']);
  const [submitting, setSubmitting] = useState(false);

  // Fetch entries
  const fetchEntries = async () => {
    setLoading(true);
    try {
      const response = await axios.get('/api/chicken-fight/entries');
      if (response.data.success) {
        setEntries(response.data.entries || []);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch entries');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEntries();
  }, []);

  // Handle game type change
  const handleGameTypeChange = (type) => {
    setGameType(type);
    if (type === '2wins') {
      setLegBands(['', '']);
    } else if (type === '3wins') {
      setLegBands(['', '', '']);
    }
  };

  // Handle leg band input change
  const handleLegBandChange = (index, value) => {
    const newLegBands = [...legBands];
    newLegBands[index] = value;
    setLegBands(newLegBands);
  };

  // Submit new entry
  const handleSubmitEntry = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    setSuccess('');

    try {
      if (!entryName.trim()) {
        setError('Entry name is required');
        setSubmitting(false);
        return;
      }

      if (legBands.some(band => !band.trim())) {
        setError('All leg band numbers are required');
        setSubmitting(false);
        return;
      }

      const response = await axios.post('/api/chicken-fight/entries', {
        entryName: entryName.trim(),
        gameType,
        legBandNumbers: legBands.map(b => b.trim())
      });

      if (response.data.success) {
        setSuccess(`Entry "${entryName}" created successfully!`);
        setEntryName('');
        setLegBands(gameType === '2wins' ? ['', ''] : ['', '', '']);
        setShowForm(false);
        fetchEntries();

        // Clear success message after 3 seconds
        setTimeout(() => setSuccess(''), 3000);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create entry');
    } finally {
      setSubmitting(false);
    }
  };

  // Group entries by game type
  const entries2Wins = entries.filter(e => e.gameType === '2wins');
  const entries3Wins = entries.filter(e => e.gameType === '3wins');

  return (
    <div className={`min-h-screen ${isDarkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
      {/* Header */}
      <div className={`${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} border-b sticky top-0 z-10`}>
        <div className="max-w-6xl mx-auto px-4 py-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className={`text-3xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                Chicken Fight Entries
              </h1>
              <p className={`${isDarkMode ? 'text-gray-400' : 'text-gray-600'} mt-1`}>
                Create and manage betting entries for today
              </p>
            </div>
            <button
              onClick={() => setShowForm(!showForm)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold transition ${
                showForm
                  ? isDarkMode
                    ? 'bg-red-600 hover:bg-red-700 text-white'
                    : 'bg-red-500 hover:bg-red-600 text-white'
                  : isDarkMode
                  ? 'bg-blue-600 hover:bg-blue-700 text-white'
                  : 'bg-blue-500 hover:bg-blue-600 text-white'
              }`}
            >
              <Plus size={20} />
              {showForm ? 'Cancel' : 'New Entry'}
            </button>
          </div>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className={`mx-4 mt-4 p-4 rounded-lg flex items-center gap-3 ${isDarkMode ? 'bg-red-900/30 text-red-400 border border-red-700' : 'bg-red-100 text-red-800 border border-red-300'}`}>
          <AlertCircle size={20} />
          <span>{error}</span>
        </div>
      )}

      {/* Success Alert */}
      {success && (
        <div className={`mx-4 mt-4 p-4 rounded-lg flex items-center gap-3 ${isDarkMode ? 'bg-green-900/30 text-green-400 border border-green-700' : 'bg-green-100 text-green-800 border border-green-300'}`}>
          <span>✓ {success}</span>
        </div>
      )}

      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* Create Entry Form */}
        {showForm && (
          <div className={`${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} border rounded-lg p-6 mb-8`}>
            <h2 className={`text-xl font-bold mb-6 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
              Create New Entry
            </h2>

            <form onSubmit={handleSubmitEntry} className="space-y-6">
              {/* Entry Name */}
              <div>
                <label className={`block text-sm font-semibold mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  Entry Name
                </label>
                <input
                  type="text"
                  value={entryName}
                  onChange={(e) => setEntryName(e.target.value)}
                  placeholder="Enter entry name (e.g., Red Tiger, Lucky Strike)"
                  className={`w-full px-4 py-2 rounded-lg border ${
                    isDarkMode
                      ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-500'
                      : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
                  } focus:outline-none focus:border-blue-500`}
                />
              </div>

              {/* Game Type Selection */}
              <div>
                <label className={`block text-sm font-semibold mb-3 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  Game Type
                </label>
                <div className="flex gap-4">
                  <button
                    type="button"
                    onClick={() => handleGameTypeChange('2wins')}
                    className={`flex-1 py-3 rounded-lg font-semibold transition ${
                      gameType === '2wins'
                        ? isDarkMode
                          ? 'bg-blue-600 text-white'
                          : 'bg-blue-500 text-white'
                        : isDarkMode
                        ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    2-Wins (2 Legs)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleGameTypeChange('3wins')}
                    className={`flex-1 py-3 rounded-lg font-semibold transition ${
                      gameType === '3wins'
                        ? isDarkMode
                          ? 'bg-blue-600 text-white'
                          : 'bg-blue-500 text-white'
                        : isDarkMode
                        ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    3-Wins (3 Legs)
                  </button>
                </div>
              </div>

              {/* Leg Band Numbers */}
              <div>
                <label className={`block text-sm font-semibold mb-3 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  Leg Band Numbers
                </label>
                <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
                  {legBands.map((band, index) => (
                    <div key={index}>
                      <label className={`text-xs mb-1 block ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                        Leg {index + 1}
                      </label>
                      <input
                        type="text"
                        value={band}
                        onChange={(e) => handleLegBandChange(index, e.target.value)}
                        placeholder={`Leg ${index + 1}`}
                        className={`w-full px-3 py-2 rounded-lg border ${
                          isDarkMode
                            ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-500'
                            : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
                        } focus:outline-none focus:border-blue-500`}
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Submit Button */}
              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  disabled={submitting}
                  className={`flex-1 py-2 rounded-lg font-semibold transition flex items-center justify-center gap-2 ${
                    submitting
                      ? isDarkMode
                        ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                        : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : isDarkMode
                      ? 'bg-green-600 hover:bg-green-700 text-white'
                      : 'bg-green-500 hover:bg-green-600 text-white'
                  }`}
                >
                  {submitting ? (
                    <>
                      <Loader size={18} className="animate-spin" />
                      Creating...
                    </>
                  ) : (
                    'Create Entry'
                  )}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Entries Display */}
        {loading ? (
          <div className="flex justify-center items-center py-12">
            <Loader size={32} className={`animate-spin ${isDarkMode ? 'text-blue-400' : 'text-blue-500'}`} />
          </div>
        ) : entries.length === 0 ? (
          <div className={`text-center py-12 ${isDarkMode ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-200'} rounded-lg`}>
            <p className={isDarkMode ? 'text-gray-400' : 'text-gray-500'}>
              No entries created yet. Create your first entry to get started!
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            {/* 2-Wins Section */}
            {entries2Wins.length > 0 && (
              <div>
                <h2 className={`text-2xl font-bold mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                  2-Wins Entries ({entries2Wins.length})
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {entries2Wins.map(entry => (
                    <div
                      key={entry._id}
                      className={`${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} border rounded-lg p-4 hover:shadow-lg transition`}
                    >
                      <h3 className={`font-bold text-lg mb-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                        {entry.entryName}
                      </h3>
                      <div className={`mb-3 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'} text-sm`}>
                        <p>Created by: {entry.createdByName}</p>
                        <p>Created: {new Date(entry.createdAt).toLocaleTimeString()}</p>
                      </div>
                      <div className={`bg-${isDarkMode ? 'gray-700' : 'gray-100'} rounded-lg p-3`}>
                        <p className={`text-xs font-semibold mb-2 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                          Leg Bands:
                        </p>
                        <div className="flex gap-2">
                          {entry.legBandNumbers.map((band, idx) => (
                            <div
                              key={idx}
                              className={`px-3 py-1 rounded font-mono text-sm ${
                                isDarkMode
                                  ? 'bg-blue-900/50 text-blue-300'
                                  : 'bg-blue-100 text-blue-700'
                              }`}
                            >
                              {band}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 3-Wins Section */}
            {entries3Wins.length > 0 && (
              <div>
                <h2 className={`text-2xl font-bold mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                  3-Wins Entries ({entries3Wins.length})
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {entries3Wins.map(entry => (
                    <div
                      key={entry._id}
                      className={`${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} border rounded-lg p-4 hover:shadow-lg transition`}
                    >
                      <h3 className={`font-bold text-lg mb-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                        {entry.entryName}
                      </h3>
                      <div className={`mb-3 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'} text-sm`}>
                        <p>Created by: {entry.createdByName}</p>
                        <p>Created: {new Date(entry.createdAt).toLocaleTimeString()}</p>
                      </div>
                      <div className={`bg-${isDarkMode ? 'gray-700' : 'gray-100'} rounded-lg p-3`}>
                        <p className={`text-xs font-semibold mb-2 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                          Leg Bands:
                        </p>
                        <div className="flex gap-2">
                          {entry.legBandNumbers.map((band, idx) => (
                            <div
                              key={idx}
                              className={`px-3 py-1 rounded font-mono text-sm ${
                                isDarkMode
                                  ? 'bg-purple-900/50 text-purple-300'
                                  : 'bg-purple-100 text-purple-700'
                              }`}
                            >
                              {band}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
