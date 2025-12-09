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
  const [meronLegBandSearch, setMeronLegBandSearch] = useState('');
  const [selectedWalaEntry, setSelectedWalaEntry] = useState('');
  const [selectedWalaLegBand, setSelectedWalaLegBand] = useState('');
  const [walaLegBandSearch, setWalaLegBandSearch] = useState('');
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
      setRegistrations([]);
      setSelectedMeronEntry('');
      setSelectedMeronLegBand('');
      setMeronLegBandSearch('');
      setSelectedWalaEntry('');
      setSelectedWalaLegBand('');
      setWalaLegBandSearch('');
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

  // Handle Meron leg band search - auto-select entry and leg band
  const handleMeronLegBandSearch = (value) => {
    setMeronLegBandSearch(value);
    if (!value.trim()) {
      setSelectedMeronEntry('');
      setSelectedMeronLegBand('');
      return;
    }
    // Search for entry with this leg band
    const foundEntry = availableMeronEntries.find(entry => 
      entry.legBandNumbers?.includes(value.trim())
    );
    if (foundEntry) {
      setSelectedMeronEntry(foundEntry._id);
      setSelectedMeronLegBand(value.trim());
    }
  };

  // Handle Wala leg band search - auto-select entry and leg band
  const handleWalaLegBandSearch = (value) => {
    setWalaLegBandSearch(value);
    if (!value.trim()) {
      setSelectedWalaEntry('');
      setSelectedWalaLegBand('');
      return;
    }
    // Search for entry with this leg band
    const foundEntry = availableWalaEntries.find(entry => 
      entry.legBandNumbers?.includes(value.trim())
    );
    if (foundEntry) {
      setSelectedWalaEntry(foundEntry._id);
      setSelectedWalaLegBand(value.trim());
    }
  };

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

  // Insurance payment
  const handleInsurance = async (registrationId) => {
    try {
      await axios.put(
        `${getApiUrl()}/api/chicken-fight-registration/registrations/${registrationId}/insurance`,
        {}
      );

      setSuccess('Insurance recorded');
      fetchRegistrations();
      fetchStats();
      setTimeout(() => setSuccess(''), 2000);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to record insurance');
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
          <div className={`mb-6 rounded-xl border shadow-lg ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
            <div className={`flex justify-between items-center p-6 border-b ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
              <div>
                <h2 className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>📅 Fight History</h2>
                <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'} mt-1`}>Review past records and fights</p>
              </div>
              <button
                onClick={() => setShowHistory(false)}
                className={`p-2 rounded-lg transition ${isDarkMode ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-600'}`}
              >
                <X size={24} />
              </button>
            </div>

            <div className="p-6">
              {historyDates.length === 0 ? (
                <div className={`text-center py-12 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                  <p className="text-lg">No history records found</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Date List */}
                  <div className={`lg:col-span-1 ${isDarkMode ? 'bg-gray-700/50' : 'bg-gray-50'} rounded-lg p-4 max-h-96 overflow-y-auto`}>
                    <h3 className={`font-bold mb-3 text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>AVAILABLE DATES</h3>
                    <div className="space-y-2">
                      {historyDates.map(date => (
                        <button
                          key={date}
                          onClick={() => loadHistoryForDate(date)}
                          className={`w-full text-left px-4 py-3 rounded-lg transition font-medium text-sm ${
                            selectedHistoryDate === date
                              ? isDarkMode 
                                ? 'bg-blue-600 text-white shadow-lg' 
                                : 'bg-blue-500 text-white shadow-lg'
                              : isDarkMode 
                                ? 'bg-gray-600 hover:bg-gray-500 text-gray-100' 
                                : 'bg-white hover:bg-gray-100 text-gray-900 border border-gray-200'
                          }`}
                        >
                          {new Date(date).toLocaleDateString('en-US', { 
                            weekday: 'short',
                            month: 'short', 
                            day: 'numeric',
                            year: 'numeric' 
                          })}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Fight Records */}
                  <div className="lg:col-span-2">
                    <div className={`rounded-lg p-4 ${isDarkMode ? 'bg-gray-700/50' : 'bg-gray-50'}`}>
                      <h3 className={`font-bold mb-4 text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                        {selectedHistoryDate 
                          ? `FIGHTS - ${new Date(selectedHistoryDate).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}`
                          : 'SELECT A DATE TO VIEW FIGHTS'
                        }
                      </h3>
                      <div className={`max-h-96 overflow-y-auto space-y-2`}>
                        {selectedHistoryDate && historyFights.length > 0 ? (
                          <div className="space-y-2">
                            {historyFights.map((fight, idx) => {
                              const entry = entries.find(e => e.entryName === fight.entryName);
                              const isWin = fight.result === 1;
                              return (
                                <div 
                                  key={idx} 
                                  className={`p-4 rounded-lg border-l-4 ${
                                    entry?.gameType === '2wins'
                                      ? isDarkMode ? 'bg-red-900/30 border-red-600 text-red-200' : 'bg-red-50 border-red-400 text-red-900'
                                      : isDarkMode ? 'bg-blue-900/30 border-blue-600 text-blue-200' : 'bg-blue-50 border-blue-400 text-blue-900'
                                  }`}
                                >
                                  <div className="flex justify-between items-start">
                                    <div className="flex-1">
                                      <div className={`font-bold text-sm ${isDarkMode ? 'text-white' : ''}`}>{fight.entryName}</div>
                                      <div className="text-xs mt-1">Leg Band: <span className="font-mono font-bold">{fight.legBand}</span></div>
                                    </div>
                                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                                      isWin 
                                        ? isDarkMode ? 'bg-green-600 text-white' : 'bg-green-500 text-white'
                                        : isDarkMode ? 'bg-red-600 text-white' : 'bg-red-500 text-white'
                                    }`}>
                                      {isWin ? '✓ WIN' : '✗ LOSS'}
                                    </span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : selectedHistoryDate ? (
                          <p className={`text-center py-8 ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>No fights recorded on this date</p>
                        ) : (
                          <p className={`text-center py-8 ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>Select a date to view fight records</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Three Column Display - Meron, Fight Number, Wala */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          {/* Meron Column */}
          <div className="bg-red-700 text-white rounded-lg p-8">
            <h2 className="text-2xl font-bold mb-4">MERON</h2>
            
            {/* Leg Band Search */}
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">Search Leg Band</label>
              <input
                type="text"
                value={meronLegBandSearch}
                onChange={(e) => handleMeronLegBandSearch(e.target.value)}
                placeholder="Enter leg band number..."
                className="w-full px-4 py-2 rounded-lg bg-red-600 text-white border border-red-500 placeholder-red-300"
              />
              {meronLegBandSearch && selectedMeronEntry && (
                <div className="mt-2 p-2 bg-red-600 rounded text-sm">
                  <div className="font-medium">{meronEntry?.entryName}</div>
                  <div className="text-xs">Leg Band: {selectedMeronLegBand}</div>
                </div>
              )}
            </div>
            
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
            
            {/* Leg Band Search */}
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">Search Leg Band</label>
              <input
                type="text"
                value={walaLegBandSearch}
                onChange={(e) => handleWalaLegBandSearch(e.target.value)}
                placeholder="Enter leg band number..."
                className="w-full px-4 py-2 rounded-lg bg-blue-600 text-white border border-blue-500 placeholder-blue-300"
              />
              {walaLegBandSearch && selectedWalaEntry && (
                <div className="mt-2 p-2 bg-blue-600 rounded text-sm">
                  <div className="font-medium">{walaEntry?.entryName}</div>
                  <div className="text-xs">Leg Band: {selectedWalaLegBand}</div>
                </div>
              )}
            </div>

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
          <div className="mb-8">
            <h2 className={`text-2xl font-bold mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>💰 Statistics</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-4">
              {/* Total Registered - Based on Manage Entries */}
              <div className={`p-4 rounded-lg border ${isDarkMode ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700' : 'bg-gradient-to-br from-white to-gray-50 border-gray-200'} shadow-md hover:shadow-lg transition`}>
                <div className={`text-xs font-bold ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>TOTAL REGISTERED</div>
                <div className={`text-4xl font-bold mt-2 ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`}>
                  {entries.length}
                </div>
              </div>

              {/* 2-Wins Paid - Based on Manage Entries */}
              <div className={`p-4 rounded-lg border ${isDarkMode ? 'bg-gradient-to-br from-red-900/30 to-red-900/20 border-red-700' : 'bg-gradient-to-br from-red-50 to-red-100 border-red-200'} shadow-md hover:shadow-lg transition`}>
                <div className={`text-xs font-bold ${isDarkMode ? 'text-red-300' : 'text-red-700'}`}>2-WINS REGISTERED</div>
                <div className={`text-3xl font-bold mt-2 ${isDarkMode ? 'text-red-400' : 'text-red-600'}`}>
                  {(() => {
                    const by2wins = entries.filter(e => e.gameType === '2wins').length;
                    const paid2wins = registrations.filter(reg => {
                      const entry = entries.find(e => e.entryName === reg.entryName);
                      return entry?.gameType === '2wins' && reg.registrations.find(r => r.gameType === '2wins' && r.isPaid);
                    }).length;
                    return `${paid2wins}/${by2wins}`;
                  })()}
                </div>
                <div className={`text-xs mt-1 font-mono ${isDarkMode ? 'text-red-300' : 'text-red-600'}`}>
                  ₱{(() => {
                    const paid2wins = registrations.filter(reg => {
                      const entry = entries.find(e => e.entryName === reg.entryName);
                      return entry?.gameType === '2wins' && reg.registrations.find(r => r.gameType === '2wins' && r.isPaid);
                    }).length;
                    return paid2wins * 500;
                  })()}
                </div>
              </div>

              {/* 3-Wins Paid - Based on Manage Entries */}
              <div className={`p-4 rounded-lg border ${isDarkMode ? 'bg-gradient-to-br from-blue-900/30 to-blue-900/20 border-blue-700' : 'bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200'} shadow-md hover:shadow-lg transition`}>
                <div className={`text-xs font-bold ${isDarkMode ? 'text-blue-300' : 'text-blue-700'}`}>3-WINS REGISTERED</div>
                <div className={`text-3xl font-bold mt-2 ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`}>
                  {(() => {
                    const by3wins = entries.filter(e => e.gameType === '3wins').length;
                    const paid3wins = registrations.filter(reg => {
                      const entry = entries.find(e => e.entryName === reg.entryName);
                      return entry?.gameType === '3wins' && reg.registrations.find(r => r.gameType === '3wins' && r.isPaid);
                    }).length;
                    return `${paid3wins}/${by3wins}`;
                  })()}
                </div>
                <div className={`text-xs mt-1 font-mono ${isDarkMode ? 'text-blue-300' : 'text-blue-600'}`}>
                  ₱{(() => {
                    const paid3wins = registrations.filter(reg => {
                      const entry = entries.find(e => e.entryName === reg.entryName);
                      return entry?.gameType === '3wins' && reg.registrations.find(r => r.gameType === '3wins' && r.isPaid);
                    }).length;
                    return paid3wins * 1000;
                  })()}
                </div>
              </div>

              {/* Champion 2-Wins */}
              <div className={`p-4 rounded-lg border ${isDarkMode ? 'bg-gradient-to-br from-orange-900/30 to-orange-900/20 border-orange-700' : 'bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200'} shadow-md hover:shadow-lg transition`}>
                <div className={`text-xs font-bold ${isDarkMode ? 'text-orange-300' : 'text-orange-700'}`}>CHAMPION 2-WINS</div>
                <div className={`text-3xl font-bold mt-2 ${isDarkMode ? 'text-orange-400' : 'text-orange-600'}`}>
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

              {/* Champion 3-Wins */}
              <div className={`p-4 rounded-lg border ${isDarkMode ? 'bg-gradient-to-br from-cyan-900/30 to-cyan-900/20 border-cyan-700' : 'bg-gradient-to-br from-cyan-50 to-cyan-100 border-cyan-200'} shadow-md hover:shadow-lg transition`}>
                <div className={`text-xs font-bold ${isDarkMode ? 'text-cyan-300' : 'text-cyan-700'}`}>CHAMPION 3-WINS</div>
                <div className={`text-3xl font-bold mt-2 ${isDarkMode ? 'text-cyan-400' : 'text-cyan-600'}`}>
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

              {/* Insurance */}
              <div className={`p-4 rounded-lg border ${isDarkMode ? 'bg-gradient-to-br from-purple-900/30 to-purple-900/20 border-purple-700' : 'bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200'} shadow-md hover:shadow-lg transition`}>
                <div className={`text-xs font-bold ${isDarkMode ? 'text-purple-300' : 'text-purple-700'}`}>INSURANCE</div>
                <div className={`text-3xl font-bold mt-2 ${isDarkMode ? 'text-purple-400' : 'text-purple-600'}`}>
                  ₱{(() => {
                    const insuranceCount = registrations.filter(r => r.insurancePaid).length;
                    return insuranceCount * 5000;
                  })()}
                </div>
                <div className={`text-xs mt-1 ${isDarkMode ? 'text-purple-300' : 'text-purple-600'}`}>{registrations.filter(r => r.insurancePaid).length} entries</div>
              </div>

              {/* Net Revenue */}
              <div className={`p-4 rounded-lg border md:col-span-2 lg:col-span-1 ${isDarkMode ? 'bg-gradient-to-br from-green-900/30 to-green-900/20 border-green-700' : 'bg-gradient-to-br from-green-50 to-green-100 border-green-200'} shadow-md hover:shadow-lg transition`}>
                <div className={`text-xs font-bold ${isDarkMode ? 'text-green-300' : 'text-green-700'}`}>NET REVENUE</div>
                <div className={`text-3xl font-bold mt-2 ${isDarkMode ? 'text-green-400' : 'text-green-600'}`}>
                  ₱{(() => {
                    const totalCollected = stats.totalRevenue || 0;
                    const meronChampionCount = Object.entries(
                      fights.reduce((acc, fight) => {
                        const entry = entries.find(e => e.entryName === fight.entryName);
                        if (entry?.gameType === '2wins' && fight.result === 1) {
                          acc[fight.entryName] = (acc[fight.entryName] || 0) + 1;
                        }
                        return acc;
                      }, {})
                    ).filter(([_, wins]) => wins >= 2).length;
                    const meronChampionPayout = meronChampionCount * 500;
                    
                    const walaChampionCount = Object.entries(
                      fights.reduce((acc, fight) => {
                        const entry = entries.find(e => e.entryName === fight.entryName);
                        if (entry?.gameType === '3wins' && fight.result === 1) {
                          acc[fight.entryName] = (acc[fight.entryName] || 0) + 1;
                        }
                        return acc;
                      }, {})
                    ).filter(([_, wins]) => wins >= 3).length;
                    const walaChampionPayout = walaChampionCount * 1000;
                    
                    const insuranceCount = registrations.filter(r => r.insurancePaid).length;
                    const insuranceTotal = insuranceCount * 5000;
                    
                    const netRevenue = totalCollected - meronChampionPayout - walaChampionPayout - insuranceTotal;
                    return Math.max(0, netRevenue);
                  })()}
                </div>
                <div className={`text-xs mt-1 font-mono ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Gross - Payouts</div>
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
                    <th className={`px-6 py-3 text-center font-semibold ${isDarkMode ? 'text-gray-300' : 'text-gray-900'}`}>2-Wins (₱500)</th>
                    <th className={`px-6 py-3 text-center font-semibold ${isDarkMode ? 'text-gray-300' : 'text-gray-900'}`}>3-Wins (₱1,000)</th>
                    <th className={`px-6 py-3 text-center font-semibold ${isDarkMode ? 'text-gray-300' : 'text-gray-900'}`}>Insurance</th>
                    <th className={`px-6 py-3 text-left font-semibold ${isDarkMode ? 'text-gray-300' : 'text-gray-900'}`}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    // Deduplicate by entry name - keep only latest version of each entry
                    const entryMap = new Map();
                    registrations.forEach(reg => {
                      const entryName = reg.entryName;
                      if (!entryMap.has(entryName) || new Date(reg.updatedAt || 0) > new Date(entryMap.get(entryName).updatedAt || 0)) {
                        entryMap.set(entryName, reg);
                      }
                    });
                    
                    // Filter to only show entries that exist in the Manage Entries page
                    const validEntryNames = new Set(entries.map(e => e.entryName));
                    const filteredRegistrations = Array.from(entryMap.values()).filter(reg => validEntryNames.has(reg.entryName));
                    
                    return filteredRegistrations.map((reg) => {
                      const reg2wins = reg.registrations.find(r => r.gameType === '2wins');
                      const reg3wins = reg.registrations.find(r => r.gameType === '3wins');

                    return (
                      <tr key={reg._id} className={`border-t ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                        <td className={`px-6 py-4 font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                          {reg.entryName}
                        </td>
                        <td className="px-6 py-4 text-center">
                          {reg2wins ? (
                            <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                              reg2wins.isPaid
                                ? isDarkMode ? 'bg-green-900/30 text-green-300' : 'bg-green-100 text-green-700'
                                : isDarkMode ? 'bg-red-900/30 text-red-300' : 'bg-red-100 text-red-700'
                            }`}>
                              {reg2wins.isPaid ? '✓ PAID' : 'UNPAID'}
                            </span>
                          ) : <span className={isDarkMode ? 'text-gray-500' : 'text-gray-400'}>-</span>}
                        </td>
                        <td className="px-6 py-4 text-center">
                          {reg3wins ? (
                            <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                              reg3wins.isPaid
                                ? isDarkMode ? 'bg-green-900/30 text-green-300' : 'bg-green-100 text-green-700'
                                : isDarkMode ? 'bg-blue-900/30 text-blue-300' : 'bg-blue-100 text-blue-700'
                            }`}>
                              {reg3wins.isPaid ? '✓ PAID' : 'UNPAID'}
                            </span>
                          ) : <span className={isDarkMode ? 'text-gray-500' : 'text-gray-400'}>-</span>}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <div className="flex flex-col items-center gap-2">
                            <span className={reg.insurancePaid ? 'text-purple-600 font-bold text-sm' : 'text-gray-600 text-sm'}>
                              {reg.insurancePaid ? '✓' : '✗'}
                            </span>
                            <button
                              onClick={() => handleInsurance(reg._id)}
                              className={`px-3 py-1 text-xs rounded font-medium ${
                                reg.insurancePaid
                                  ? 'bg-green-100 text-green-700'
                                  : isDarkMode ? 'bg-purple-900 text-purple-200 hover:bg-purple-800' : 'bg-purple-100 text-purple-700'
                              }`}
                            >
                              {reg.insurancePaid ? '✓' : 'Add'}
                            </button>
                          </div>
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
                    });
                  })()}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
