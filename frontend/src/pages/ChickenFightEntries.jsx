import React, { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import { AlertCircle, Plus, Loader, Trash2, X } from 'lucide-react';
import { SettingsContext } from '../context/SettingsContext';
import { getApiUrl } from '../utils/apiConfig';

export default function ChickenFightEntries() {
  const { isDarkMode } = useContext(SettingsContext);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form states
  const [gameType, setGameType] = useState('2wins');
  const [entryName, setEntryName] = useState('');
  const [legBands, setLegBands] = useState(['', '']);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(null);

  // Fetch entries
  const fetchEntries = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${getApiUrl()}/api/chicken-fight/entries`);
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

      const response = await axios.post(`${getApiUrl()}/api/chicken-fight/entries`, {
        entryName: entryName.trim(),
        gameType,
        legBandNumbers: legBands.map(b => b.trim())
      });

      if (response.data.success) {
        setSuccess(`Entry "${entryName}" created successfully!`);
        setEntryName('');
        setLegBands(gameType === '2wins' ? ['', ''] : ['', '', '']);
        fetchEntries();
        setTimeout(() => setSuccess(''), 3000);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create entry');
    } finally {
      setSubmitting(false);
    }
  };

  // Delete entry
  const handleDeleteEntry = async (id) => {
    if (!window.confirm('Are you sure you want to delete this entry?')) return;
    
    setDeleting(id);
    try {
      const response = await axios.delete(`${getApiUrl()}/api/chicken-fight/entries/${id}`);
      if (response.data.success) {
        setSuccess('Entry deleted successfully!');
        fetchEntries();
        setTimeout(() => setSuccess(''), 3000);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete entry');
    } finally {
      setDeleting(null);
    }
  };

  // Group entries by game type
  const entries2Wins = entries.filter(e => e.gameType === '2wins');
  const entries3Wins = entries.filter(e => e.gameType === '3wins');

  return (
    <div className={`min-h-screen ${isDarkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
      {/* Header */}
      <div className={`${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} border-b sticky top-0 z-10`}>
        <div className="max-w-7xl mx-auto px-4 py-6">
          <h1 className={`text-3xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
            Manage Chicken Fight Entries
          </h1>
          <p className={`${isDarkMode ? 'text-gray-400' : 'text-gray-600'} mt-1`}>
            Quickly add and manage entries for 2-Wins and 3-Wins
          </p>
        </div>
      </div>

      {/* Alerts */}
      <div className="max-w-7xl mx-auto px-4 py-4 space-y-2">
        {error && (
          <div className={`p-4 rounded-lg flex items-center gap-3 ${isDarkMode ? 'bg-red-900/30 text-red-400 border border-red-700' : 'bg-red-100 text-red-800 border border-red-300'}`}>
            <AlertCircle size={20} />
            <span className="flex-1">{error}</span>
            <button onClick={() => setError('')}><X size={18} /></button>
          </div>
        )}
        {success && (
          <div className={`p-4 rounded-lg flex items-center gap-3 ${isDarkMode ? 'bg-green-900/30 text-green-400 border border-green-700' : 'bg-green-100 text-green-800 border border-green-300'}`}>
            <span className="flex-1">✓ {success}</span>
            <button onClick={() => setSuccess('')}><X size={18} /></button>
          </div>
        )}
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Add Entry Form - Left/Top */}
          <div className={`lg:col-span-1 ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} border rounded-lg p-6 h-fit`}>
            <h2 className={`text-xl font-bold mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
              ➕ Add Entry
            </h2>

            <form onSubmit={handleSubmitEntry} className="space-y-4">
              {/* Entry Name */}
              <div>
                <label className={`block text-xs font-semibold mb-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-700'}`}>
                  Entry Name
                </label>
                <input
                  type="text"
                  value={entryName}
                  onChange={(e) => setEntryName(e.target.value)}
                  placeholder="e.g., Red Tiger"
                  className={`w-full px-3 py-2 rounded-lg border ${
                    isDarkMode
                      ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-500'
                      : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
                  } focus:outline-none focus:border-blue-500`}
                />
              </div>

              {/* Game Type Tabs */}
              <div>
                <label className={`block text-xs font-semibold mb-2 ${isDarkMode ? 'text-gray-400' : 'text-gray-700'}`}>
                  Type
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleGameTypeChange('2wins')}
                    className={`flex-1 py-2 rounded-lg font-semibold text-sm transition ${
                      gameType === '2wins'
                        ? isDarkMode
                          ? 'bg-red-600 text-white'
                          : 'bg-red-500 text-white'
                        : isDarkMode
                        ? 'bg-gray-700 text-gray-300'
                        : 'bg-gray-200 text-gray-700'
                    }`}
                  >
                    2-Wins
                  </button>
                  <button
                    type="button"
                    onClick={() => handleGameTypeChange('3wins')}
                    className={`flex-1 py-2 rounded-lg font-semibold text-sm transition ${
                      gameType === '3wins'
                        ? isDarkMode
                          ? 'bg-blue-600 text-white'
                          : 'bg-blue-500 text-white'
                        : isDarkMode
                        ? 'bg-gray-700 text-gray-300'
                        : 'bg-gray-200 text-gray-700'
                    }`}
                  >
                    3-Wins
                  </button>
                </div>
              </div>

              {/* Leg Bands */}
              <div>
                <label className={`block text-xs font-semibold mb-2 ${isDarkMode ? 'text-gray-400' : 'text-gray-700'}`}>
                  Leg Bands
                </label>
                <div className="space-y-2">
                  {legBands.map((band, index) => (
                    <input
                      key={index}
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
                  ))}
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={submitting}
                className={`w-full py-2 rounded-lg font-semibold transition flex items-center justify-center gap-2 ${
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
                    <Loader size={16} className="animate-spin" />
                    Adding...
                  </>
                ) : (
                  <>
                    <Plus size={16} />
                    Add Entry
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Lists Side by Side */}
          <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* 2-Wins Column */}
            <div className={`${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} border rounded-lg p-6`}>
              <h2 className={`text-xl font-bold mb-4 flex items-center gap-2 ${isDarkMode ? 'text-red-400' : 'text-red-600'}`}>
                <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                2-Wins ({entries2Wins.length})
              </h2>
              {loading ? (
                <div className="flex justify-center py-8">
                  <Loader size={24} className={`animate-spin ${isDarkMode ? 'text-gray-400' : 'text-gray-400'}`} />
                </div>
              ) : entries2Wins.length === 0 ? (
                <p className={`text-center py-8 ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                  No 2-Wins entries yet
                </p>
              ) : (
                <div className="space-y-3">
                  {entries2Wins.map(entry => (
                    <div
                      key={entry._id}
                      className={`${isDarkMode ? 'bg-gray-700' : 'bg-gray-50'} rounded-lg p-3 flex justify-between items-start gap-2 group hover:shadow-md transition`}
                    >
                      <div className="flex-1 min-w-0">
                        <h3 className={`font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                          {entry.entryName}
                        </h3>
                        <div className="flex gap-1 mt-1 flex-wrap">
                          {entry.legBandNumbers.map((band, idx) => (
                            <span
                              key={idx}
                              className={`px-2 py-1 text-xs rounded font-mono ${
                                isDarkMode
                                  ? 'bg-red-900/30 text-red-300'
                                  : 'bg-red-100 text-red-700'
                              }`}
                            >
                              {band}
                            </span>
                          ))}
                        </div>
                      </div>
                      <button
                        onClick={() => handleDeleteEntry(entry._id)}
                        disabled={deleting === entry._id}
                        className={`p-2 rounded transition opacity-0 group-hover:opacity-100 ${
                          deleting === entry._id
                            ? 'opacity-100 text-gray-500 cursor-not-allowed'
                            : isDarkMode
                            ? 'text-red-400 hover:bg-red-900/30 hover:text-red-300'
                            : 'text-red-600 hover:bg-red-100'
                        }`}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 3-Wins Column */}
            <div className={`${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} border rounded-lg p-6`}>
              <h2 className={`text-xl font-bold mb-4 flex items-center gap-2 ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`}>
                <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                3-Wins ({entries3Wins.length})
              </h2>
              {loading ? (
                <div className="flex justify-center py-8">
                  <Loader size={24} className={`animate-spin ${isDarkMode ? 'text-gray-400' : 'text-gray-400'}`} />
                </div>
              ) : entries3Wins.length === 0 ? (
                <p className={`text-center py-8 ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                  No 3-Wins entries yet
                </p>
              ) : (
                <div className="space-y-3">
                  {entries3Wins.map(entry => (
                    <div
                      key={entry._id}
                      className={`${isDarkMode ? 'bg-gray-700' : 'bg-gray-50'} rounded-lg p-3 flex justify-between items-start gap-2 group hover:shadow-md transition`}
                    >
                      <div className="flex-1 min-w-0">
                        <h3 className={`font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                          {entry.entryName}
                        </h3>
                        <div className="flex gap-1 mt-1 flex-wrap">
                          {entry.legBandNumbers.map((band, idx) => (
                            <span
                              key={idx}
                              className={`px-2 py-1 text-xs rounded font-mono ${
                                isDarkMode
                                  ? 'bg-blue-900/30 text-blue-300'
                                  : 'bg-blue-100 text-blue-700'
                              }`}
                            >
                              {band}
                            </span>
                          ))}
                        </div>
                      </div>
                      <button
                        onClick={() => handleDeleteEntry(entry._id)}
                        disabled={deleting === entry._id}
                        className={`p-2 rounded transition opacity-0 group-hover:opacity-100 ${
                          deleting === entry._id
                            ? 'opacity-100 text-gray-500 cursor-not-allowed'
                            : isDarkMode
                            ? 'text-red-400 hover:bg-red-900/30 hover:text-red-300'
                            : 'text-red-600 hover:bg-red-100'
                        }`}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
