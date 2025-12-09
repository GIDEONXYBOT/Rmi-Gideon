import React, { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import { AlertCircle, Plus, Loader, Check, X } from 'lucide-react';
import { SettingsContext } from '../context/SettingsContext';
import { getApiUrl } from '../utils/apiConfig';

export default function ChickenFight() {
  const { isDarkMode } = useContext(SettingsContext);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Entries
  const [entries, setEntries] = useState([]);
  const [entriesLoading, setEntriesLoading] = useState(false);
  
  // Registrations
  const [registrations, setRegistrations] = useState([]);
  const [registrationsLoading, setRegistrationsLoading] = useState(false);
  
  // Registration form
  const [showRegForm, setShowRegForm] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState('');
  const [selected2Wins, setSelected2Wins] = useState(false);
  const [selected3Wins, setSelected3Wins] = useState(false);
  const [submittingReg, setSubmittingReg] = useState(false);
  const [selectedMeronEntry, setSelectedMeronEntry] = useState('');
  const [selectedMeronLegBand, setSelectedMeronLegBand] = useState('');
  const [selectedWalaEntry, setSelectedWalaEntry] = useState('');
  const [selectedWalaLegBand, setSelectedWalaLegBand] = useState('');
  const [fightNumber, setFightNumber] = useState(0);
  const [fights, setFights] = useState([]); // Track fight results
  const [showHistory, setShowHistory] = useState(false);
  const [historyDates, setHistoryDates] = useState([]);
  const [selectedHistoryDate, setSelectedHistoryDate] = useState(null);
  const [historyFights, setHistoryFights] = useState([]);

  const today = new Date().toISOString().split('T')[0];

  // Load fights from localStorage on mount
  useEffect(() => {
    const savedFights = localStorage.getItem(`chicken-fight-${today}`);
    const savedFightNumber = localStorage.getItem(`chicken-fight-number-${today}`);
    
    if (savedFights) {
      setFights(JSON.parse(savedFights));
    }
    if (savedFightNumber) {
      setFightNumber(parseInt(savedFightNumber));
    }
  }, [today]);

  // Save fights to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem(`chicken-fight-${today}`, JSON.stringify(fights));
    localStorage.setItem(`chicken-fight-number-${today}`, fightNumber.toString());
  }, [fights, fightNumber, today]);

  // Load history dates on mount
  useEffect(() => {
    loadHistoryDates();
  }, []);

  // Load available history dates
  const loadHistoryDates = () => {
    const dates = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('chicken-fight-') && !key.includes('number')) {
        const date = key.replace('chicken-fight-', '');
        if (date !== today && !dates.includes(date)) {
          dates.push(date);
        }
      }
    }
    setHistoryDates(dates.sort().reverse());
  };

  // Load history for selected date
  const loadHistoryForDate = (date) => {
    const savedFights = localStorage.getItem(`chicken-fight-${date}`);
    if (savedFights) {
      setHistoryFights(JSON.parse(savedFights));
      setSelectedHistoryDate(date);
    }
  };

  // Reset today's records
  const handleResetToday = () => {
    if (window.confirm('Are you sure you want to reset today\'s records? This action cannot be undone.')) {
      setFights([]);
      setFightNumber(0);
      localStorage.removeItem(`chicken-fight-${today}`);
      localStorage.removeItem(`chicken-fight-number-${today}`);
      setSuccess('Today\'s records have been reset');
      setTimeout(() => setSuccess(''), 2000);
    }
  };

  // Get leg bands for selected Meron entry
  const meronEntry = entries.find(e => e._id === selectedMeronEntry);
  const meronLegBands = meronEntry?.legBandNumbers || [];

  // Get leg bands for selected Wala entry
  const walaEntry = entries.find(e => e._id === selectedWalaEntry);
  const walaLegBands = walaEntry?.legBandNumbers || [];

  // Get used leg bands (already fought)
  const usedLegBands = new Set(fights.map(f => f.legBand).filter(Boolean));

  // Filter out already-used leg bands
  const availableMeronLegBands = meronLegBands.filter(band => !usedLegBands.has(band));
  const availableWalaLegBands = walaLegBands.filter(band => !usedLegBands.has(band));

  // Get entries that still have available leg bands (not all used up)
  const availableEntries = entries.filter(entry => {
    const entryLegBands = entry.legBandNumbers || [];
    const unusedBands = entryLegBands.filter(band => !usedLegBands.has(band));
    return unusedBands.length > 0;
  });

  // Filter Meron entries - exclude if already selected in Wala
  const availableMeronEntries = availableEntries.filter(entry => entry._id !== selectedWalaEntry);

  // Filter Wala entries - exclude if already selected in Meron
  const availableWalaEntries = availableEntries.filter(entry => entry._id !== selectedMeronEntry);

  const handleMeronWin = () => {
    if (!selectedMeronEntry || !selectedMeronLegBand || !selectedWalaEntry || !selectedWalaLegBand) {
      setError('Please select both Meron and Wala entries with leg bands');
      return;
    }
    const meronFight = {
      id: fightNumber + 1,
      entryName: meronEntry.entryName,
      legBand: selectedMeronLegBand,
      result: 1  // 1 for win
    };
    const walaFight = {
      id: fightNumber + 1,
      entryName: walaEntry.entryName,
      legBand: selectedWalaLegBand,
      result: 0  // 0 for loss
    };
    setFights([...fights, meronFight, walaFight]);
    setFightNumber(fightNumber + 1);
    setSuccess(`Meron (${meronEntry.entryName}) defeats Wala (${walaEntry.entryName})`);
    setSelectedMeronEntry('');
    setSelectedMeronLegBand('');
    setSelectedWalaEntry('');
    setSelectedWalaLegBand('');
    setTimeout(() => setSuccess(''), 2000);
  };

  const handleWalaWin = () => {
    if (!selectedMeronEntry || !selectedMeronLegBand || !selectedWalaEntry || !selectedWalaLegBand) {
      setError('Please select both Meron and Wala entries with leg bands');
      return;
    }
    const meronFight = {
      id: fightNumber + 1,
      entryName: meronEntry.entryName,
      legBand: selectedMeronLegBand,
      result: 0  // 0 for loss
    };
    const walaFight = {
      id: fightNumber + 1,
      entryName: walaEntry.entryName,
      legBand: selectedWalaLegBand,
      result: 1  // 1 for win
    };
    setFights([...fights, meronFight, walaFight]);
    setFightNumber(fightNumber + 1);
    setSuccess(`Wala (${walaEntry.entryName}) defeats Meron (${meronEntry.entryName})`);
    setSelectedMeronEntry('');
    setSelectedMeronLegBand('');
    setSelectedWalaEntry('');
    setSelectedWalaLegBand('');
    setTimeout(() => setSuccess(''), 2000);
  };
  
  // Stats
  const [stats, setStats] = useState(null);

  // Fetch data on load
  useEffect(() => {
    fetchEntries();
    fetchRegistrations();
    fetchStats();
    autoRegisterEntries();
  }, []);

  // Fetch available entries
  const fetchEntries = async () => {
    setEntriesLoading(true);
    try {
      const response = await axios.get(`${getApiUrl()}/api/chicken-fight/entries`);
      if (response.data.success) {
        setEntries(response.data.entries || []);
      }
    } catch (err) {
      console.error('Error fetching entries:', err);
      setError('Failed to load entries');
    } finally {
      setEntriesLoading(false);
    }
  };

  // Fetch registrations for today
  const fetchRegistrations = async () => {
    setRegistrationsLoading(true);
    try {
      const response = await axios.get(`${getApiUrl()}/api/chicken-fight-registration/registrations`, {
        params: { gameDate: today }
      });
      if (response.data.success) {
        setRegistrations(response.data.registrations || []);
      }
    } catch (err) {
      console.error('Error fetching registrations:', err);
    } finally {
      setRegistrationsLoading(false);
    }
  };

  // Fetch statistics
  const fetchStats = async () => {
    try {
      const response = await axios.get(`${getApiUrl()}/api/chicken-fight-registration/registrations-stats`, {
        params: { gameDate: today }
      });
      if (response.data.success) {
        setStats(response.data.stats);
      }
    } catch (err) {
      console.error('Error fetching stats:', err);
    }
  };

  // Register entry
  const handleRegisterEntry = async () => {
    if (!selectedEntry || (!selected2Wins && !selected3Wins)) {
      setError('Please select an entry and at least one game type');
      return;
    }

    const entry = entries.find(e => e._id === selectedEntry);
    const gameTypes = [];
    if (selected2Wins) gameTypes.push('2wins');
    if (selected3Wins) gameTypes.push('3wins');

    setSubmittingReg(true);
    try {
      await axios.post(`${getApiUrl()}/api/chicken-fight-registration/registrations`, {
        entryId: selectedEntry,
        entryName: entry.entryName,
        gameTypes,
        gameDate: today
      });

      setSuccess(`Entry "${entry.entryName}" registered successfully!`);
      setSelectedEntry('');
      setSelected2Wins(false);
      setSelected3Wins(false);
      setShowRegForm(false);
      fetchRegistrations();
      fetchStats();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to register entry');
    } finally {
      setSubmittingReg(false);
    }
  };

  // Mark as paid
  const handleMarkPaid = async (registrationId, gameType) => {
    try {
      await axios.put(
        `${getApiUrl()}/api/chicken-fight-registration/registrations/${registrationId}/pay`,
        { gameType }
      );

      setSuccess(`Payment recorded for ${gameType}`);
      fetchRegistrations();
      fetchStats();
      setTimeout(() => setSuccess(''), 2000);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to mark payment');
    }
  };

  // Delete registration
  const handleDeleteRegistration = async (registrationId) => {
    if (!window.confirm('Delete this registration?')) return;

    try {
      await axios.delete(
        `${getApiUrl()}/api/chicken-fight-registration/registrations/${registrationId}`
      );

      setSuccess('Registration deleted');
      fetchRegistrations();
      fetchStats();
      setTimeout(() => setSuccess(''), 2000);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete registration');
    }
  };

  // Auto-register all entries on page load
  const autoRegisterEntries = async () => {
    try {
      const response = await axios.get(`${getApiUrl()}/api/chicken-fight/entries`);
      if (response.data.success && response.data.entries) {
        for (const entry of response.data.entries) {
          // Register each entry with both game types
          await axios.post(`${getApiUrl()}/api/chicken-fight-registration/registrations`, {
            entryId: entry._id,
            entryName: entry.entryName,
            gameTypes: ['2wins', '3wins'],
            gameDate: today
          }).catch(() => {
            // Silently ignore if already registered
          });
        }
        fetchRegistrations();
        fetchStats();
      }
    } catch (err) {
      console.error('Auto-registration error:', err);
    }
  };

  // Withdraw payment (mark as unpaid)
  const handleWithdrawPayment = async (registrationId, gameType) => {
    try {
      await axios.put(
        `${getApiUrl()}/api/chicken-fight-registration/registrations/${registrationId}/withdraw`,
        { gameType }
      );

      setSuccess(`Payment withdrawn for ${gameType}`);
      fetchRegistrations();
      fetchStats();
      setTimeout(() => setSuccess(''), 2000);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to withdraw payment');
    }
  };

  return (
    <div className={`min-h-screen flex ${isDarkMode ? 'bg-gray-900' : 'bg-white'}`}>
      {/* Left Sidebar - RESULT */}
      <div className={`w-48 ${isDarkMode ? 'bg-gray-800' : 'bg-gray-900'} text-white p-4 overflow-y-auto`}>
        <div className="mb-6">
          <div className="font-bold text-white bg-gray-700 p-3 rounded mb-2 text-center">RESULT</div>
          
          {/* Score Summary with Champions */}
          <div className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-400'} mb-4 space-y-2`}>
            {(() => {
              // Count wins per entry (only count result === 1)
              const entryWins = {};
              fights.forEach(fight => {
                if (fight.result === 1) {
                  entryWins[fight.entryName] = (entryWins[fight.entryName] || 0) + 1;
                }
              });

              // Find champions (2 wins for Meron, 3 wins for Wala)
              const meronChampions = Object.entries(entryWins)
                .filter(([name, wins]) => {
                  const entry = entries.find(e => e.entryName === name);
                  return entry?.gameType === '2wins' && wins >= 2;
                })
                .map(([name]) => name);

              const walaChampions = Object.entries(entryWins)
                .filter(([name, wins]) => {
                  const entry = entries.find(e => e.entryName === name);
                  return entry?.gameType === '3wins' && wins >= 3;
                })
                .map(([name]) => name);

                const meronScore = fights.filter(f => {
                const entry = entries.find(e => e.entryName === f.entryName);
                return entry?.gameType === '2wins' && f.result === 1;
              }).length;
              const walaScore = fights.filter(f => {
                const entry = entries.find(e => e.entryName === f.entryName);
                return entry?.gameType === '3wins' && f.result === 1;
              }).length;

              // Get all Meron fights (2wins) with their results
              const meronFights = fights.filter(f => {
                const entry = entries.find(e => e.entryName === f.entryName);
                return entry?.gameType === '2wins';
              });

              // Get all Wala fights (3wins) with their results
              const walaFights = fights.filter(f => {
                const entry = entries.find(e => e.entryName === f.entryName);
                return entry?.gameType === '3wins';
              });

              return (
                <>
                  <div className="bg-red-700 p-3 rounded font-medium">
                    <div className="flex justify-between items-center mb-2">
                      <span>MERON</span>
                      <span>{meronScore}</span>
                    </div>
                    <div className="flex gap-1 flex-wrap">
                      {meronFights.map((fight, idx) => (
                        <span key={idx} className="font-bold text-sm">{fight.result}</span>
                      ))}
                    </div>
                  </div>
                  <div className="bg-blue-700 p-3 rounded font-medium">
                    <div className="flex justify-between items-center mb-2">
                      <span>WALA</span>
                      <span>{walaScore}</span>
                    </div>
                    <div className="flex gap-1 flex-wrap">
                      {walaFights.map((fight, idx) => (
                        <span key={idx} className="font-bold text-sm">{fight.result}</span>
                      ))}
                    </div>
                  </div>
                </>
              );
            })()}
          </div>
        </div>

        {/* Fight List with Champions and Win/Loss Indicators */}
        <div className="text-xs space-y-1">
          {fights.length === 0 ? (
            <div className={`p-2 text-center ${isDarkMode ? 'text-gray-500' : 'text-gray-600'}`}>
              No fights recorded
            </div>
          ) : (
            (() => {
              // Track entry types and their fight results
              let entryTypes = {}; // Track entry types
              fights.forEach(fight => {
                const entry = entries.find(e => e.entryName === fight.entryName);
                if (entry) {
                  entryTypes[fight.entryName] = entry.gameType;
                }
              });

              // Get unique entries in order of first appearance
              const uniqueEntries = [];
              const seenEntries = new Set();
              fights.forEach(fight => {
                if (!seenEntries.has(fight.entryName)) {
                  seenEntries.add(fight.entryName);
                  uniqueEntries.push({
                    name: fight.entryName,
                    gameType: entryTypes[fight.entryName]
                  });
                }
              });

              return uniqueEntries.map(entryData => {
                const entry = entries.find(e => e.entryName === entryData.name);
                // Get all fight results for this entry (1 for win, 0 for loss)
                const entryFights = fights.filter(f => f.entryName === entryData.name);
                const wins = entryFights.filter(f => f.result === 1).length;
                const isMeronChampion = entry?.gameType === '2wins' && wins >= 2;
                const isWalaChampion = entry?.gameType === '3wins' && wins >= 3;
                const isChampion = isMeronChampion || isWalaChampion;

                return (
                  <div key={entryData.name} className={`p-2 rounded font-medium flex items-center justify-between gap-2 ${
                    entry?.gameType === '2wins' ? 'bg-red-700' : 'bg-blue-700'
                  }`}>
                    <div className="flex items-center gap-1 truncate flex-1">
                      {isChampion && <span>★</span>}
                      <span className="truncate">{entryData.name}</span>
                    </div>
                    {/* Win/Loss Indicators - Show actual results (1 for win, 0 for loss) */}
                    <div className="flex gap-1 items-center flex-shrink-0">
                      {entryFights.map((fight, idx) => (
                        <span
                          key={idx}
                          className={`font-bold text-sm ${fight.result === 1 ? 'text-white' : 'text-red-200'}`}
                        >
                          {fight.result}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              });
            })()
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className={`flex-1 p-8 overflow-y-auto ${isDarkMode ? 'bg-gray-900' : 'bg-white'}`}>
        {/* Header */}
        <div className="mb-6 flex justify-between items-center">
          <h1 className={`text-4xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
            RMI {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }).toUpperCase()}
          </h1>
          <div className="flex gap-2">
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-medium"
            >
              {showHistory ? 'Hide History' : 'View History'}
            </button>
            <button
              onClick={handleResetToday}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium"
            >
              Reset Today
            </button>
          </div>
        </div>

        {/* Alerts */}
        {error && (
          <div className="mb-6 p-4 bg-red-100 border border-red-400 text-red-700 rounded flex items-center gap-3">
            <AlertCircle size={20} />
            <span className="flex-1">{error}</span>
            <button onClick={() => setError('')}>
              <X size={18} />
            </button>
          </div>
        )}

        {success && (
          <div className="mb-6 p-4 bg-green-100 border border-green-400 text-green-700 rounded flex items-center gap-3">
            <Check size={20} />
            <span>{success}</span>
          </div>
        )}

        {/* History Viewer */}
        {showHistory && (
          <div className={`mb-6 p-6 rounded-lg border ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-gray-50 border-gray-300'}`}>
            <div className="flex justify-between items-center mb-4">
              <h2 className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Fight History</h2>
              <button
                onClick={() => setShowHistory(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <X size={20} />
              </button>
            </div>

            {historyDates.length === 0 ? (
              <p className={isDarkMode ? 'text-gray-400' : 'text-gray-600'}>No history records found</p>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                {/* Date List */}
                <div>
                  <h3 className={`font-bold mb-3 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Past Dates</h3>
                  <div className="space-y-2">
                    {historyDates.map(date => (
                      <button
                        key={date}
                        onClick={() => loadHistoryForDate(date)}
                        className={`w-full text-left px-3 py-2 rounded transition ${
                          selectedHistoryDate === date
                            ? isDarkMode ? 'bg-blue-600 text-white' : 'bg-blue-100 text-blue-900'
                            : isDarkMode ? 'bg-gray-700 hover:bg-gray-600 text-gray-300' : 'bg-gray-200 hover:bg-gray-300'
                        }`}
                      >
                        {new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Fight Records */}
                <div>
                  <h3 className={`font-bold mb-3 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                    {selectedHistoryDate ? `Fights on ${new Date(selectedHistoryDate).toLocaleDateString()}` : 'Select a date'}
                  </h3>
                  <div className={`p-3 rounded max-h-96 overflow-y-auto ${isDarkMode ? 'bg-gray-700' : 'bg-white border border-gray-300'}`}>
                    {selectedHistoryDate && historyFights.length > 0 ? (
                      <div className="space-y-2">
                        {historyFights.map((fight, idx) => (
                          <div key={idx} className={`p-2 rounded text-sm ${isDarkMode ? 'bg-gray-600' : 'bg-gray-100'}`}>
                            <div className="font-medium">{fight.entryName}</div>
                            <div className="text-xs">Result: {fight.result === 1 ? '✓ Win' : '✗ Loss'} | Leg Band: {fight.legBand}</div>
                          </div>
                        ))}
                      </div>
                    ) : selectedHistoryDate ? (
                      <p className={isDarkMode ? 'text-gray-400' : 'text-gray-600'}>No fights recorded</p>
                    ) : (
                      <p className={isDarkMode ? 'text-gray-400' : 'text-gray-600'}>Select a date to view fights</p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Three Column Display - Meron, Fight Number, Wala */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          {/* Meron Column */}
          <div className="bg-red-700 text-white rounded-lg p-8">
            <h2 className="text-2xl font-bold mb-4">MERON</h2>
            
            {/* Available Entries - Only those with remaining leg bands */}
            <div className="mb-4 p-3 bg-red-600 rounded text-sm max-h-32 overflow-y-auto">
              <div className="font-medium mb-2">Available:</div>
              <div className="space-y-1">
                {availableMeronEntries.map(entry => (
                  <div key={entry._id} className="text-xs">
                    {entry.entryName} ({entry.gameType})
                  </div>
                ))}
                {availableMeronEntries.length === 0 && (
                  <div className="text-xs text-red-200">No entries available</div>
                )}
              </div>
            </div>
            
            {/* Entry Selector */}
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">Select Entry</label>
              <select
                value={selectedMeronEntry}
                onChange={(e) => {
                  setSelectedMeronEntry(e.target.value);
                  setSelectedMeronLegBand('');
                }}
                className="w-full px-4 py-2 rounded-lg bg-red-600 text-white border border-red-500"
              >
                <option value="">-- Select Entry --</option>
                {availableMeronEntries.map(entry => (
                  <option key={entry._id} value={entry._id}>
                    {entry.entryName} ({entry.gameType})
                  </option>
                ))}
              </select>
            </div>

            {/* Leg Band Selector */}
            {selectedMeronEntry && meronLegBands.length > 0 && (
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">Select Leg Band</label>
                <select
                  value={selectedMeronLegBand}
                  onChange={(e) => setSelectedMeronLegBand(e.target.value)}
                  className="w-full px-4 py-2 rounded-lg bg-red-600 text-white border border-red-500"
                >
                  <option value="">-- Select Leg Band --</option>
                  {availableMeronLegBands.map(band => (
                    <option key={band} value={band}>
                      Band {band}
                    </option>
                  ))}
                </select>
                {availableMeronLegBands.length === 0 && (
                  <p className="text-xs text-red-200 mt-1">All leg bands have already fought</p>
                )}

                {/* Meron Fight Results - Show below leg band selector */}
                <div className="mt-3 p-3 bg-red-600 rounded text-center">
                  <div className="flex gap-1 flex-wrap justify-center">
                    {(() => {
                      const meronEntry = entries.find(e => e._id === selectedMeronEntry);
                      const selectedEntryFights = fights.filter(f => f.entryName === meronEntry?.entryName);
                      return selectedEntryFights.length > 0 ? (
                        selectedEntryFights.map((fight, idx) => (
                          <span key={idx} className="text-3xl font-bold">{fight.result}</span>
                        ))
                      ) : (
                        <span className="text-3xl font-bold text-gray-300">-</span>
                      );
                    })()}
                  </div>
                </div>
              </div>
            )}

            {/* Win Button */}
            <button
              onClick={handleMeronWin}
              disabled={!selectedMeronEntry || !selectedMeronLegBand}
              className={`w-full py-3 font-bold rounded-lg text-lg transition ${
                selectedMeronEntry && selectedMeronLegBand
                  ? 'bg-red-500 hover:bg-red-600 text-white cursor-pointer'
                  : 'bg-red-900 text-gray-400 cursor-not-allowed opacity-50'
              }`}
            >
              MERON WINS
            </button>
          </div>

          {/* Fight Number Column */}
          <div className="bg-gray-800 text-white rounded-lg p-8 flex flex-col items-center justify-center">
            <div className="text-7xl font-bold mb-4">{fightNumber}</div>
            <div className="text-lg font-bold">FIGHT</div>
          </div>

          {/* Wala Column */}
          <div className="bg-blue-700 text-white rounded-lg p-8">
            <h2 className="text-2xl font-bold mb-4">WALA</h2>
            
            {/* Available Entries - Only those with remaining leg bands */}
            <div className="mb-4 p-3 bg-blue-600 rounded text-sm max-h-32 overflow-y-auto">
              <div className="font-medium mb-2">Available:</div>
              <div className="space-y-1">
                {availableWalaEntries.map(entry => (
                  <div key={entry._id} className="text-xs">
                    {entry.entryName} ({entry.gameType})
                  </div>
                ))}
                {availableWalaEntries.length === 0 && (
                  <div className="text-xs text-blue-200">No entries available</div>
                )}
              </div>
            </div>
            
            {/* Entry Selector */}
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">Select Entry</label>
              <select
                value={selectedWalaEntry}
                onChange={(e) => {
                  setSelectedWalaEntry(e.target.value);
                  setSelectedWalaLegBand('');
                }}
                className="w-full px-4 py-2 rounded-lg bg-blue-600 text-white border border-blue-500"
              >
                <option value="">-- Select Entry --</option>
                {availableWalaEntries.map(entry => (
                  <option key={entry._id} value={entry._id}>
                    {entry.entryName} ({entry.gameType})
                  </option>
                ))}
              </select>
            </div>

            {/* Leg Band Selector */}
            {selectedWalaEntry && walaLegBands.length > 0 && (
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">Select Leg Band</label>
                <select
                  value={selectedWalaLegBand}
                  onChange={(e) => setSelectedWalaLegBand(e.target.value)}
                  className="w-full px-4 py-2 rounded-lg bg-blue-600 text-white border border-blue-500"
                >
                  <option value="">-- Select Leg Band --</option>
                  {availableWalaLegBands.map(band => (
                    <option key={band} value={band}>
                      Band {band}
                    </option>
                  ))}
                </select>
                {availableWalaLegBands.length === 0 && (
                  <p className="text-xs text-blue-200 mt-1">All leg bands have already fought</p>
                )}

                {/* Wala Fight Results - Show below leg band selector */}
                <div className="mt-3 p-3 bg-blue-600 rounded text-center">
                  <div className="flex gap-1 flex-wrap justify-center">
                    {(() => {
                      const walaEntry = entries.find(e => e._id === selectedWalaEntry);
                      const selectedEntryFights = fights.filter(f => f.entryName === walaEntry?.entryName);
                      return selectedEntryFights.length > 0 ? (
                        selectedEntryFights.map((fight, idx) => (
                          <span key={idx} className="text-3xl font-bold">{fight.result}</span>
                        ))
                      ) : (
                        <span className="text-3xl font-bold text-gray-300">-</span>
                      );
                    })()}
                  </div>
                </div>
              </div>
            )}

            {/* Win Button */}
            <button
              onClick={handleWalaWin}
              disabled={!selectedWalaEntry || !selectedWalaLegBand}
              className={`w-full py-3 font-bold rounded-lg text-lg transition ${
                selectedWalaEntry && selectedWalaLegBand
                  ? 'bg-blue-500 hover:bg-blue-600 text-white cursor-pointer'
                  : 'bg-blue-900 text-gray-400 cursor-not-allowed opacity-50'
              }`}
            >
              WALA WINS
            </button>
          </div>
        </div>

        {/* Statistics */}
        {stats && (
          <div className="grid grid-cols-6 gap-4 mb-8">
            <div className={`p-4 rounded-lg ${isDarkMode ? 'bg-gray-800' : 'bg-gray-100'}`}>
              <div className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Total Registered</div>
              <div className={`text-3xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                {stats.total}
              </div>
            </div>
            <div className={`p-4 rounded-lg ${isDarkMode ? 'bg-gray-800' : 'bg-gray-100'}`}>
              <div className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>2-Wins Paid (₱500)</div>
              <div className="text-3xl font-bold text-red-600">{stats.paid2wins}/{stats.by2wins}</div>
              <div className="text-xs text-red-600">₱{stats.paid2wins * 500}</div>
            </div>
            <div className={`p-4 rounded-lg ${isDarkMode ? 'bg-gray-800' : 'bg-gray-100'}`}>
              <div className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>3-Wins Paid (₱1,000)</div>
              <div className="text-3xl font-bold text-blue-600">{stats.paid3wins}/{stats.by3wins}</div>
              <div className="text-xs text-blue-600">₱{stats.paid3wins * 1000}</div>
            </div>
            <div className={`p-4 rounded-lg ${isDarkMode ? 'bg-gray-800' : 'bg-gray-100'}`}>
              <div className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Champion 2-Wins</div>
              <div className={`text-3xl font-bold ${isDarkMode ? 'text-red-400' : 'text-red-600'}`}>
                ₱{(() => {
                  const meronChampionCount = Object.entries(
                    fights.reduce((acc, fight) => {
                      const entry = entries.find(e => e.entryName === fight.entryName);
                      if (entry?.gameType === '2wins' && fight.result === 1) {
                        acc[fight.entryName] = (acc[fight.entryName] || 0) + 1;
                      }
                      return acc;
                    }, {})
                  ).filter(([_, wins]) => wins >= 2).length;
                  return meronChampionCount * 500;
                })()}
              </div>
            </div>
            <div className={`p-4 rounded-lg ${isDarkMode ? 'bg-gray-800' : 'bg-gray-100'}`}>
              <div className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Champion 3-Wins</div>
              <div className={`text-3xl font-bold ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`}>
                ₱{(() => {
                  const walaChampionCount = Object.entries(
                    fights.reduce((acc, fight) => {
                      const entry = entries.find(e => e.entryName === fight.entryName);
                      if (entry?.gameType === '3wins' && fight.result === 1) {
                        acc[fight.entryName] = (acc[fight.entryName] || 0) + 1;
                      }
                      return acc;
                    }, {})
                  ).filter(([_, wins]) => wins >= 3).length;
                  return walaChampionCount * 1000;
                })()}
              </div>
            </div>
            <div className={`p-4 rounded-lg ${isDarkMode ? 'bg-gray-800' : 'bg-gray-100'}`}>
              <div className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Total Revenue</div>
              <div className={`text-3xl font-bold ${isDarkMode ? 'text-yellow-400' : 'text-yellow-600'}`}>
                ₱{stats.totalRevenue}
              </div>
            </div>
          </div>
        )}

        {/* Registrations Table */}
        <div>
          <h2 className={`text-2xl font-bold mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
            Registrations
          </h2>
          {registrationsLoading ? (
            <div className="flex justify-center py-12">
              <Loader className="animate-spin text-blue-600" size={32} />
            </div>
          ) : registrations.length === 0 ? (
            <div className={`p-8 text-center rounded-lg ${isDarkMode ? 'bg-gray-800' : 'bg-gray-100'}`}>
              <p className={isDarkMode ? 'text-gray-400' : 'text-gray-600'}>No registrations yet</p>
            </div>
          ) : (
            <div className={`rounded-lg overflow-hidden shadow ${isDarkMode ? 'bg-gray-800' : 'bg-white'} border ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
              <table className="w-full">
                <thead>
                  <tr className={isDarkMode ? 'bg-gray-700' : 'bg-gray-100'}>
                    <th className={`px-6 py-3 text-left font-semibold ${isDarkMode ? 'text-gray-300' : 'text-gray-900'}`}>Entry Name</th>
                    <th className={`px-6 py-3 text-left font-semibold ${isDarkMode ? 'text-gray-300' : 'text-gray-900'}`}>2-Wins (₱500)</th>
                    <th className={`px-6 py-3 text-left font-semibold ${isDarkMode ? 'text-gray-300' : 'text-gray-900'}`}>3-Wins (₱1,000)</th>
                    <th className={`px-6 py-3 text-left font-semibold ${isDarkMode ? 'text-gray-300' : 'text-gray-900'}`}>Total Fees</th>
                    <th className={`px-6 py-3 text-left font-semibold ${isDarkMode ? 'text-gray-300' : 'text-gray-900'}`}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {registrations.map((reg) => {
                    const reg2wins = reg.registrations.find(r => r.gameType === '2wins');
                    const reg3wins = reg.registrations.find(r => r.gameType === '3wins');
                    const totalFees = (reg2wins?.registrationFee || 0) + (reg3wins?.registrationFee || 0);

                    return (
                      <tr key={reg._id} className={`border-t ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                        <td className={`px-6 py-4 font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                          {reg.entryName}
                        </td>
                        <td className="px-6 py-4">
                          {reg2wins ? (
                            <div className="flex items-center gap-2">
                              <span className={reg2wins.isPaid ? 'text-green-600 font-bold' : 'text-gray-600'}>
                                {reg2wins.isPaid ? '✓ PAID' : 'UNPAID'}
                              </span>
                              <button
                                onClick={() => handleMarkPaid(reg._id, '2wins')}
                                disabled={reg2wins.isPaid}
                                className={`px-2 py-1 text-xs rounded font-medium ${
                                  reg2wins.isPaid ? 'bg-green-100 text-green-700' : isDarkMode ? 'bg-red-900 text-red-200 hover:bg-red-800' : 'bg-red-100 text-red-700'
                                }`}
                              >
                                {reg2wins.isPaid ? '✓' : 'Mark Paid'}
                              </button>
                            </div>
                          ) : <span className={isDarkMode ? 'text-gray-500' : 'text-gray-400'}>-</span>}
                        </td>
                        <td className="px-6 py-4">
                          {reg3wins ? (
                            <div className="flex items-center gap-2">
                              <span className={reg3wins.isPaid ? 'text-green-600 font-bold' : 'text-gray-600'}>
                                {reg3wins.isPaid ? '✓ PAID' : 'UNPAID'}
                              </span>
                              <button
                                onClick={() => handleMarkPaid(reg._id, '3wins')}
                                disabled={reg3wins.isPaid}
                                className={`px-2 py-1 text-xs rounded font-medium ${
                                  reg3wins.isPaid ? 'bg-green-100 text-green-700' : isDarkMode ? 'bg-blue-900 text-blue-200 hover:bg-blue-800' : 'bg-blue-100 text-blue-700'
                                }`}
                              >
                                {reg3wins.isPaid ? '✓' : 'Mark Paid'}
                              </button>
                            </div>
                          ) : <span className={isDarkMode ? 'text-gray-500' : 'text-gray-400'}>-</span>}
                        </td>
                        <td className={`px-6 py-4 font-semibold text-lg ${isDarkMode ? 'text-yellow-400' : 'text-yellow-600'}`}>
                          ₱{totalFees}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleDeleteRegistration(reg._id)}
                              className={`px-3 py-1 text-xs rounded font-medium ${
                                isDarkMode ? 'bg-red-900 text-red-200 hover:bg-red-800' : 'bg-red-100 text-red-700'
                              }`}
                            >
                              Delete
                            </button>
                            <button
                              onClick={() => {
                                const gameTypes = [];
                                if (reg.registrations.find(r => r.gameType === '2wins')?.isPaid) gameTypes.push('2wins');
                                if (reg.registrations.find(r => r.gameType === '3wins')?.isPaid) gameTypes.push('3wins');
                                if (gameTypes.length > 0) {
                                  gameTypes.forEach(gt => handleWithdrawPayment(reg._id, gt));
                                }
                              }}
                              disabled={!reg.registrations.some(r => r.isPaid)}
                              className={`px-3 py-1 text-xs rounded font-medium ${
                                reg.registrations.some(r => r.isPaid)
                                  ? isDarkMode ? 'bg-yellow-900 text-yellow-200 hover:bg-yellow-800' : 'bg-yellow-100 text-yellow-700'
                                  : isDarkMode ? 'bg-gray-700 text-gray-500 cursor-not-allowed' : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                              }`}
                            >
                              Withdraw
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
