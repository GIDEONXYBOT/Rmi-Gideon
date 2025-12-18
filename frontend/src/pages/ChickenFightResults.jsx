import React, { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import { AlertCircle, Edit2, Trash2, X, ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { SettingsContext } from '../context/SettingsContext';
import { getApiUrl } from '../utils/apiConfig';

export default function ChickenFightResults() {
  const { isDarkMode } = useContext(SettingsContext);
  const [gameData, setGameData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Navigation
  const [currentFightNum, setCurrentFightNum] = useState(0);
  const [jumpToFight, setJumpToFight] = useState('');
  const [searchedEntryName, setSearchedEntryName] = useState(''); // Track searched entry
  const [entryFights, setEntryFights] = useState([]); // Store all fights for an entry
  
  // Edit modal
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingFightIndex, setEditingFightIndex] = useState(null);
  const [editData, setEditData] = useState(null);
  
  // Load game data
  const loadGameData = async () => {
    setLoading(true);
    setError('');
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${getApiUrl()}/api/chicken-fight/fights/today`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (res.data.success && res.data.game) {
        setGameData(res.data.game);
        setCurrentFightNum(1);
      } else {
        setError('No game data found for today');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load game data');
    } finally {
      setLoading(false);
    }
  };
  
  useEffect(() => {
    loadGameData();
  }, []);
  
  // Get fights grouped by leg number
  const getFightsByLegNumber = () => {
    if (!gameData?.entryResults) return {};
    
    const grouped = {};
    gameData.entryResults.forEach(entry => {
      entry.legResults?.forEach(leg => {
        if (!grouped[leg.legNumber]) {
          grouped[leg.legNumber] = [];
        }
        grouped[leg.legNumber].push({
          ...entry,
          legResult: leg
        });
      });
    });
    return grouped;
  };
  
  const fightsByLeg = getFightsByLegNumber();
  const legNumbers = Object.keys(fightsByLeg).map(Number).sort((a, b) => a - b);
  const maxFightNum = legNumbers.length > 0 ? Math.max(...legNumbers) : 0;
  
  const getCurrentFight = () => {
    const fights = fightsByLeg[currentFightNum];
    if (!fights || fights.length < 2) return null;
    return fights;
  };
  
  const handleJumpToFight = () => {
    const searchTerm = jumpToFight.trim().toLowerCase();
    if (!searchTerm) return;
    
    setError('');
    setSearchedEntryName('');
    setEntryFights([]);
    
    // Try to match fight number first
    const fightNum = parseInt(searchTerm);
    if (!isNaN(fightNum) && fightNum > 0 && fightNum <= maxFightNum) {
      setCurrentFightNum(fightNum);
      setJumpToFight('');
      return;
    }
    
    // Search through fights for entry name or leg band
    for (const legNum of legNumbers) {
      const fights = fightsByLeg[legNum];
      if (!fights) continue;
      
      for (const fight of fights) {
        // Check if entry name matches - collect ALL fights for this entry
        if (fight.entryName.toLowerCase().includes(searchTerm)) {
          const matchedEntry = fight.entryName;
          const allEntryFights = [];
          
          // Collect all fights for this entry across all leg numbers
          for (const checkLegNum of legNumbers) {
            const checkFights = fightsByLeg[checkLegNum];
            if (checkFights) {
              for (const checkFight of checkFights) {
                if (checkFight.entryName === matchedEntry) {
                  allEntryFights.push({
                    legNumber: checkLegNum,
                    fight: checkFight
                  });
                }
              }
            }
          }
          
          // Sort by leg number
          allEntryFights.sort((a, b) => a.legNumber - b.legNumber);
          
          setSearchedEntryName(matchedEntry);
          setEntryFights(allEntryFights);
          setCurrentFightNum(allEntryFights[0].legNumber);
          setJumpToFight('');
          return;
        }
        
        // Check if leg band number matches
        if (fight.legBandNumbers && fight.legBandNumbers.length > 0) {
          // Search through all leg bands for this entry
          for (let i = 0; i < fight.legBandNumbers.length; i++) {
            const legBandNumber = fight.legBandNumbers[i];
            if (legBandNumber && legBandNumber.toString() === searchTerm) {
              // Found the leg band, now find which fight it participated in
              const bandLegNumber = i + 1; // Convert index to leg number
              
              // Find the fight where this leg band actually fought
              if (fightsByLeg[bandLegNumber]) {
                setCurrentFightNum(bandLegNumber);
                setSearchedEntryName('');
                setEntryFights([]);
                setJumpToFight('');
                return;
              }
            }
          }
        }
      }
    }
    
    setError(`No fight found for: "${jumpToFight}"`);
  };
  
  const handleEditClick = (fights) => {
    setEditingFightIndex(currentFightNum);
    setEditData({
      legNumber: currentFightNum,
      meron: fights[0],
      wala: fights[1]
    });
    setShowEditModal(true);
  };
  
  const handleUpdateFight = async () => {
    if (!editData) return;
    
    setError('');
    setSuccess('');
    
    try {
      const token = localStorage.getItem('token');
      
      // Build the update payload
      const updatedEntryResults = gameData.entryResults.map(entry => {
        const updated = { ...entry };
        
        if (editData.meron?.entryId === entry._id) {
          updated.legResults = updated.legResults.map(leg => 
            leg.legNumber === currentFightNum 
              ? { ...leg, result: editData.meron.legResult.result }
              : leg
          );
        }
        
        if (editData.wala?.entryId === entry._id) {
          updated.legResults = updated.legResults.map(leg => 
            leg.legNumber === currentFightNum 
              ? { ...leg, result: editData.wala.legResult.result }
              : leg
          );
        }
        
        return updated;
      });
      
      const res = await axios.put(
        `${getApiUrl()}/api/chicken-fight/game/results`,
        {
          gameDate: gameData.gameDate,
          entryResults: updatedEntryResults
        },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      
      if (res.data.success) {
        setSuccess('Fight updated successfully!');
        setShowEditModal(false);
        setTimeout(() => setSuccess(''), 2000);
        loadGameData();
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update fight');
    }
  };
  
  const handleDeleteFight = async () => {
    if (!window.confirm(`Delete fight #${currentFightNum}? This cannot be undone.`)) return;
    
    setError('');
    setSuccess('');
    
    try {
      const token = localStorage.getItem('token');
      
      // Remove fights with this leg number
      const updatedEntryResults = gameData.entryResults.map(entry => {
        const updated = { ...entry };
        updated.legResults = updated.legResults.filter(leg => leg.legNumber !== currentFightNum);
        return updated;
      }).filter(entry => entry.legResults.length > 0); // Remove entries with no fights
      
      const res = await axios.put(
        `${getApiUrl()}/api/chicken-fight/game/results`,
        {
          gameDate: gameData.gameDate,
          entryResults: updatedEntryResults,
          fightNumber: gameData.fightNumber - 1
        },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      
      if (res.data.success) {
        setSuccess('Fight deleted successfully!');
        setTimeout(() => setSuccess(''), 2000);
        
        // Navigate to previous fight
        if (currentFightNum > 1) {
          setCurrentFightNum(currentFightNum - 1);
        }
        loadGameData();
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete fight');
    }
  };
  
  const currentFight = getCurrentFight();
  
  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }
  
  return (
    <div className={`min-h-screen ${isDarkMode ? 'bg-gray-900' : 'bg-white'}`}>
      {/* Header */}
      <div className={`${isDarkMode ? 'bg-gradient-to-r from-gray-800 to-gray-900 border-gray-700' : 'bg-gradient-to-r from-white to-gray-50 border-gray-200'} border-b sticky top-0 z-10 shadow-lg`}>
        <div className="max-w-7xl mx-auto px-4 py-8">
          <h1 className={`text-4xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
            🐓 Edit/Delete Fight Results
          </h1>
          <p className={`${isDarkMode ? 'text-gray-400' : 'text-gray-600'} mt-2 text-lg`}>
            Manage individual fight results
          </p>
        </div>
      </div>
      
      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Alerts */}
        {error && (
          <div className={`p-4 rounded-lg flex items-center gap-3 border mb-4 ${isDarkMode ? 'bg-red-900/30 text-red-300 border-red-600' : 'bg-red-50 text-red-800 border-red-300'}`}>
            <AlertCircle size={20} />
            <span className="flex-1">{error}</span>
            <button onClick={() => setError('')} className="hover:opacity-70"><X size={18} /></button>
          </div>
        )}
        
        {success && (
          <div className={`p-4 rounded-lg flex items-center gap-3 border mb-4 ${isDarkMode ? 'bg-green-900/30 text-green-300 border-green-600' : 'bg-green-50 text-green-800 border-green-300'}`}>
            <span>{success}</span>
          </div>
        )}
        
        {/* Navigation Section - Hide when showing entry search results */}
        {!searchedEntryName && (
        <div className={`rounded-lg shadow p-6 mb-8 ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
          <h2 className={`text-2xl font-bold mb-6 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
            Navigate Fights
          </h2>
          
          <div className="flex flex-col md:flex-row gap-4 items-center mb-6">
            {/* Navigation Buttons */}
            <div className="flex gap-2 items-center">
              <button
                onClick={() => setCurrentFightNum(Math.max(1, currentFightNum - 1))}
                disabled={currentFightNum <= 1}
                className={`p-2 rounded-lg ${
                  currentFightNum <= 1
                    ? isDarkMode ? 'bg-gray-700 text-gray-500 cursor-not-allowed' : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    : isDarkMode ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-blue-500 hover:bg-blue-600 text-white'
                }`}
              >
                <ChevronLeft size={20} />
              </button>
              
              <span className={`text-2xl font-bold w-16 text-center ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                {currentFightNum}
              </span>
              
              <button
                onClick={() => setCurrentFightNum(Math.min(maxFightNum, currentFightNum + 1))}
                disabled={currentFightNum >= maxFightNum}
                className={`p-2 rounded-lg ${
                  currentFightNum >= maxFightNum
                    ? isDarkMode ? 'bg-gray-700 text-gray-500 cursor-not-allowed' : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    : isDarkMode ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-blue-500 hover:bg-blue-600 text-white'
                }`}
              >
                <ChevronRight size={20} />
              </button>
            </div>
            
            {/* Jump to Fight */}
            <div className="flex gap-2 items-center flex-1 max-w-md">
              <div className="relative flex-1">
                <Search size={18} className={`absolute left-3 top-1/2 transform -translate-y-1/2 ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`} />
                <input
                  type="text"
                  value={jumpToFight}
                  onChange={(e) => setJumpToFight(e.target.value)}
                  placeholder="Search: #fight, entry name, or leg band"
                  onKeyPress={(e) => e.key === 'Enter' && handleJumpToFight()}
                  className={`w-full pl-10 pr-4 py-2 rounded-lg border ${
                    isDarkMode
                      ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-500'
                      : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
                  }`}
                />
              </div>
              <button
                onClick={handleJumpToFight}
                className={`px-4 py-2 rounded-lg font-medium transition ${
                  isDarkMode
                    ? 'bg-green-600 hover:bg-green-700 text-white'
                    : 'bg-green-500 hover:bg-green-600 text-white'
                }`}
              >
                Go
              </button>
            </div>
          </div>
          
          <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
            Total fights: <strong>{maxFightNum}</strong> | Current: <strong>Fight #{currentFightNum}</strong>
          </p>
        </div>
        )}
        
        {/* All Fights for Searched Entry */}
        {searchedEntryName && entryFights.length > 0 && (
          <div className={`rounded-lg shadow p-8 mb-8 ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
            <h2 className={`text-2xl font-bold mb-6 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
              All Fights for "{searchedEntryName}"
            </h2>
            <div className="grid grid-cols-1 gap-6">
              {entryFights.map((item, idx) => {
                const fights = fightsByLeg[item.legNumber];
                return (
                  <div key={idx} className={`p-6 rounded-lg border-2 ${isDarkMode ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-300'}`}>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className={`text-xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                        Fight #{item.legNumber}
                      </h3>
                      <div className={`text-sm font-medium px-3 py-1 rounded ${
                        item.fight.legResult?.result === 'win'
                          ? isDarkMode ? 'bg-green-900/50 text-green-400' : 'bg-green-100 text-green-700'
                          : item.fight.legResult?.result === 'loss'
                          ? isDarkMode ? 'bg-red-900/50 text-red-400' : 'bg-red-100 text-red-700'
                          : isDarkMode ? 'bg-yellow-900/50 text-yellow-400' : 'bg-yellow-100 text-yellow-700'
                      }`}>
                        {item.fight.legResult?.result === 'win' ? '✓ WIN' : item.fight.legResult?.result === 'loss' ? '✗ LOSS' : item.fight.legResult?.result === 'draw' ? '◐ DRAW' : item.fight.legResult?.result === 'cancelled' ? '🚫 CANCELLED' : 'UNKNOWN'}
                      </div>
                    </div>
                    {fights && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {fights.map((fight, fIdx) => {
                          const legNum = fight.legResult?.legNumber || item.legNumber;
                          const legBandIdx = legNum - 1;
                          const legBandNumber = fight.legBandNumbers?.[legBandIdx];
                          const legBandDetail = fight.legBandDetails?.[legBandIdx];
                          
                          return (
                            <div key={fIdx} className={`p-4 rounded ${
                              isDarkMode ? 'bg-gray-800' : 'bg-white'
                            }`}>
                              <div className={`font-medium mb-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{fight.entryName}</div>
                              <div className={`text-sm space-y-1 mb-3 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                                <div><span className="opacity-75">Game Type:</span> {fight.gameType}</div>
                                {legBandNumber && (
                                  <div className="font-mono">
                                    <span className="opacity-75">Leg Band:</span> #{legBandNumber}
                                    {legBandDetail?.featherType && <div className="text-xs opacity-75 ml-2">{legBandDetail.featherType}</div>}
                                  </div>
                                )}
                              </div>
                              <button
                                onClick={() => {
                                  setSearchedEntryName('');
                                  setEntryFights([]);
                                  setCurrentFightNum(item.legNumber);
                                }}
                                className={`text-sm px-2 py-1 rounded transition ${
                                  isDarkMode
                                    ? 'bg-blue-600 hover:bg-blue-700 text-white'
                                    : 'bg-blue-500 hover:bg-blue-600 text-white'
                                }`}
                              >
                                View Details
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <button
              onClick={() => {
                setSearchedEntryName('');
                setEntryFights([]);
              }}
              className={`mt-6 px-4 py-2 rounded-lg font-medium transition ${
                isDarkMode
                  ? 'bg-gray-700 hover:bg-gray-600 text-white'
                  : 'bg-gray-300 hover:bg-gray-400 text-gray-900'
              }`}
            >
              Clear Search
            </button>
          </div>
        )}
        
        {/* Fight Details */}
        {currentFight ? (
          <div className={`rounded-lg shadow p-8 mb-8 ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className={`text-3xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                  Fight #{currentFightNum}
                </h2>
                {currentFight && currentFight[0] && currentFight[0].legResult && (
                  <div className="mt-3 flex flex-wrap gap-3">
                    {currentFight.map((fight, idx) => {
                      const legNum = fight.legResult?.legNumber || currentFightNum;
                      const legBandIdx = legNum - 1;
                      const legBandNumber = fight.legBandNumbers?.[legBandIdx];
                      const legBandDetail = fight.legBandDetails?.[legBandIdx];
                      
                      return (
                        <div key={idx} className={`px-3 py-2 rounded-lg ${
                          isDarkMode ? 'bg-purple-900/50 border border-purple-700' : 'bg-purple-100 border border-purple-300'
                        }`}>
                          <div className="text-xs opacity-75">Leg Band:</div>
                          <div className="font-bold text-lg">{legBandNumber ? `#${legBandNumber}` : 'N/A'}</div>
                          {legBandDetail?.featherType && (
                            <div className="text-xs opacity-75">{legBandDetail.featherType}</div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => handleEditClick(currentFight)}
                  className={`px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition ${
                    isDarkMode
                      ? 'bg-blue-600 hover:bg-blue-700 text-white'
                      : 'bg-blue-500 hover:bg-blue-600 text-white'
                  }`}
                >
                  <Edit2 size={18} />
                  Edit
                </button>
                <button
                  onClick={handleDeleteFight}
                  className={`px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition ${
                    isDarkMode
                      ? 'bg-red-600 hover:bg-red-700 text-white'
                      : 'bg-red-500 hover:bg-red-600 text-white'
                  }`}
                >
                  <Trash2 size={18} />
                  Delete
                </button>
              </div>
            </div>
            
            {/* Fight Results */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {currentFight.map((fight, idx) => (
                <div
                  key={idx}
                  className={`p-6 rounded-lg border-2 ${
                    fight.legResult.result === 'win'
                      ? isDarkMode ? 'bg-green-900/30 border-green-700' : 'bg-green-50 border-green-300'
                      : fight.legResult.result === 'loss'
                      ? isDarkMode ? 'bg-red-900/30 border-red-700' : 'bg-red-50 border-red-300'
                      : isDarkMode ? 'bg-yellow-900/30 border-yellow-700' : 'bg-yellow-50 border-yellow-300'
                  }`}
                >
                  <div className={`text-sm font-medium mb-2 ${
                    fight.legResult.result === 'win'
                      ? isDarkMode ? 'text-green-400' : 'text-green-600'
                      : fight.legResult.result === 'loss'
                      ? isDarkMode ? 'text-red-400' : 'text-red-600'
                      : isDarkMode ? 'text-yellow-400' : 'text-yellow-600'
                  }`}>
                    {fight.legResult.result === 'win' ? '✓ WIN' : fight.legResult.result === 'loss' ? '✗ LOSS' : fight.legResult.result === 'draw' ? '◐ DRAW' : fight.legResult.result === 'cancelled' ? '🚫 CANCELLED' : 'UNKNOWN'}
                  </div>
                  
                  <div className={`text-2xl font-bold mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                    {fight.entryName}
                  </div>
                  
                  <div className={`space-y-2 text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                    <div>
                      <span className="font-medium">Game Type:</span>
                      <span className="ml-2">{fight.gameType}</span>
                    </div>
                    {fight.legResults && fight.legResults[0] && (
                      <>
                        {/* Show the specific leg band fighting in this fight */}
                        {(() => {
                          const legNum = fight.legResults[0].legNumber;
                          const legBandIdx = legNum - 1; // Convert to 0-based index
                          const legBandNumber = fight.legBandNumbers?.[legBandIdx];
                          const legBandDetail = fight.legBandDetails?.[legBandIdx];
                          
                          return (
                            <div>
                              <span className="font-medium">Leg Band (Fight #{legNum}):</span>
                              <div className="ml-2 mt-1 flex flex-wrap gap-2">
                                <span 
                                  className={`px-3 py-2 rounded font-mono ${
                                    isDarkMode 
                                      ? 'bg-purple-900/50 border border-purple-700' 
                                      : 'bg-purple-100 border border-purple-300'
                                  }`}
                                >
                                  <div className="font-bold">{legBandNumber ? `#${legBandNumber}` : 'N/A'}</div>
                                  {legBandDetail?.featherType && (
                                    <div className="text-xs opacity-75">{legBandDetail.featherType}</div>
                                  )}
                                </span>
                              </div>
                            </div>
                          );
                        })()}
                        {fight.legBandNumbers && fight.legBandNumbers.length > 0 && (
                          <div>
                            <span className="font-medium">All Leg Bands:</span>
                            <div className="ml-2 flex flex-wrap gap-2 mt-1">
                              {fight.legBandNumbers.map((band, bandIdx) => (
                                <span 
                                  key={bandIdx}
                                  className={`px-2 py-1 rounded font-mono text-xs ${
                                    isDarkMode 
                                      ? 'bg-blue-900/50 border border-blue-700' 
                                      : 'bg-blue-100 border border-blue-300'
                                  }`}
                                >
                                  {band ? `#${band}` : 'N/A'}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : currentFightNum > 0 ? (
          <div className={`rounded-lg shadow p-8 text-center ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
            <p className={`text-lg ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
              No fight data for Fight #{currentFightNum}
            </p>
          </div>
        ) : (
          <div className={`rounded-lg shadow p-8 text-center ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
            <p className={`text-lg ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
              Select a fight to view details
            </p>
          </div>
        )}
      </div>
      
      {/* Edit Modal */}
      {showEditModal && editData && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className={`p-6 rounded-lg w-full max-w-2xl max-h-96 overflow-y-auto ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
            <div className="flex items-center justify-between mb-4">
              <h2 className={`text-xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                Edit Fight #{currentFightNum}
              </h2>
              <button
                onClick={() => setShowEditModal(false)}
                className="p-1 hover:bg-gray-700 rounded"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="space-y-6">
              {/* Meron */}
              <div>
                <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  {editData.meron?.entryName} - Result
                </label>
                <select
                  value={editData.meron?.legResult?.result || ''}
                  onChange={(e) => setEditData({
                    ...editData,
                    meron: {
                      ...editData.meron,
                      legResult: { ...editData.meron.legResult, result: e.target.value }
                    }
                  })}
                  className={`w-full px-4 py-2 rounded-lg border ${
                    isDarkMode
                      ? 'bg-gray-700 border-gray-600 text-white'
                      : 'bg-white border-gray-300'
                  }`}
                >
                  <option value="win">Win</option>
                  <option value="loss">Loss</option>
                  <option value="draw">Draw</option>
                </select>
              </div>
              
              {/* Wala */}
              <div>
                <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  {editData.wala?.entryName} - Result
                </label>
                <select
                  value={editData.wala?.legResult?.result || ''}
                  onChange={(e) => setEditData({
                    ...editData,
                    wala: {
                      ...editData.wala,
                      legResult: { ...editData.wala.legResult, result: e.target.value }
                    }
                  })}
                  className={`w-full px-4 py-2 rounded-lg border ${
                    isDarkMode
                      ? 'bg-gray-700 border-gray-600 text-white'
                      : 'bg-white border-gray-300'
                  }`}
                >
                  <option value="win">Win</option>
                  <option value="loss">Loss</option>
                  <option value="draw">Draw</option>
                </select>
              </div>
            </div>
            
            <div className="flex gap-3 mt-8">
              <button
                onClick={handleUpdateFight}
                className={`flex-1 px-4 py-2 rounded-lg font-medium transition ${
                  isDarkMode
                    ? 'bg-green-600 hover:bg-green-700 text-white'
                    : 'bg-green-500 hover:bg-green-600 text-white'
                }`}
              >
                Save Changes
              </button>
              <button
                onClick={() => setShowEditModal(false)}
                className={`flex-1 px-4 py-2 rounded-lg border font-medium transition ${
                  isDarkMode
                    ? 'bg-gray-700 hover:bg-gray-600 text-white border-gray-600'
                    : 'bg-white hover:bg-gray-100 text-gray-900 border-gray-300'
                }`}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
