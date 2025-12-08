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
  
  // Stats
  const [stats, setStats] = useState(null);

  const today = new Date().toISOString().split('T')[0];

  // Fetch data on load
  useEffect(() => {
    fetchEntries();
    fetchRegistrations();
    fetchStats();
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

  return (
    <div className={`min-h-screen flex ${isDarkMode ? 'bg-gray-900' : 'bg-white'}`}>
      {/* Left Sidebar - RESULT */}
      <div className={`w-48 ${isDarkMode ? 'bg-gray-800' : 'bg-gray-900'} text-white p-4 overflow-y-auto`}>
        <div className="mb-6">
          <div className="font-bold text-white bg-gray-700 p-3 rounded mb-2 text-center">RESULT</div>
          <div className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-400'}`}>
            {stats && (
              <div className="space-y-2">
                <div className="flex justify-between bg-red-700 p-2 rounded">
                  <span>Meron</span>
                  <span className="font-bold">{stats.by2wins || 0}</span>
                </div>
                <div className="flex justify-between bg-blue-700 p-2 rounded">
                  <span>Wala</span>
                  <span className="font-bold">{stats.by3wins || 0}</span>
                </div>
                <div className="flex justify-between bg-green-700 p-2 rounded">
                  <span>Draw</span>
                  <span className="font-bold">0</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Fight List */}
        <div className="text-xs">
          {registrations.map((reg, idx) => (
            <div key={reg._id} className={`p-2 mb-1 rounded font-medium ${
              reg.registrations.some(r => r.gameType === '2wins') ? 'bg-red-700' : 
              reg.registrations.some(r => r.gameType === '3wins') ? 'bg-blue-700' : 'bg-gray-700'
            }`}>
              #{idx + 1} {reg.registrations.some(r => r.gameType === '2wins') ? 'MERON' : 'WALA'}
            </div>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div className={`flex-1 p-8 overflow-y-auto ${isDarkMode ? 'bg-gray-900' : 'bg-white'}`}>
        {/* Header */}
        <div className="mb-6">
          <h1 className={`text-4xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
            RMI {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }).toUpperCase()}
          </h1>
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

        {/* Three Column Display - Meron, Fight Number, Wala */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          {/* Meron Column */}
          <div className="bg-red-700 text-white rounded-lg p-8">
            <h2 className="text-2xl font-bold mb-4">MERON</h2>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">Select Entry</label>
              <select className="w-full px-4 py-2 rounded-lg bg-red-600 text-white border border-red-500">
                <option value="">-- Select Entry --</option>
                {entries
                  .filter(e => e.gameType === '2wins')
                  .map(entry => (
                    <option key={entry._id} value={entry._id}>
                      {entry.entryName}
                    </option>
                  ))}
              </select>
            </div>
            <div className="text-6xl font-bold text-center">0</div>
          </div>

          {/* Fight Number Column */}
          <div className="bg-gray-800 text-white rounded-lg p-8 flex flex-col items-center justify-center">
            <div className="mb-6">
              <label className="block text-sm font-medium mb-2 text-center">Select Leg Band</label>
              <select className="px-4 py-2 rounded-lg bg-gray-700 text-white border border-gray-600 min-w-[150px]">
                <option value="">-- Select Leg Band --</option>
                {entries.flatMap(entry => 
                  (entry.legBandNumbers || []).map(band => (
                    <option key={`${entry._id}-${band}`} value={band}>
                      {entry.entryName} - Band {band}
                    </option>
                  ))
                )}
              </select>
            </div>
            <div className="text-7xl font-bold">0</div>
            <div className="text-lg mt-4">FIGHT</div>
          </div>

          {/* Wala Column */}
          <div className="bg-blue-700 text-white rounded-lg p-8">
            <h2 className="text-2xl font-bold mb-4">WALA</h2>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">Select Entry</label>
              <select className="w-full px-4 py-2 rounded-lg bg-blue-600 text-white border border-blue-500">
                <option value="">-- Select Entry --</option>
                {entries
                  .filter(e => e.gameType === '3wins')
                  .map(entry => (
                    <option key={entry._id} value={entry._id}>
                      {entry.entryName}
                    </option>
                  ))}
              </select>
            </div>
            <div className="text-6xl font-bold text-center">0</div>
          </div>
        </div>

        {/* Statistics */}
        {stats && (
          <div className="grid grid-cols-4 gap-4 mb-8">
            <div className={`p-4 rounded-lg ${isDarkMode ? 'bg-gray-800' : 'bg-gray-100'}`}>
              <div className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Total Registered</div>
              <div className={`text-3xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                {stats.total}
              </div>
            </div>
            <div className={`p-4 rounded-lg ${isDarkMode ? 'bg-gray-800' : 'bg-gray-100'}`}>
              <div className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>2-Wins (₱500)</div>
              <div className="text-3xl font-bold text-red-600">{stats.paid2wins}/{stats.by2wins}</div>
              <div className="text-xs text-red-600">₱{stats.paid2wins * 500}</div>
            </div>
            <div className={`p-4 rounded-lg ${isDarkMode ? 'bg-gray-800' : 'bg-gray-100'}`}>
              <div className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>3-Wins (₱1,000)</div>
              <div className="text-3xl font-bold text-blue-600">{stats.paid3wins}/{stats.by3wins}</div>
              <div className="text-xs text-blue-600">₱{stats.paid3wins * 1000}</div>
            </div>
            <div className={`p-4 rounded-lg ${isDarkMode ? 'bg-gray-800' : 'bg-gray-100'}`}>
              <div className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Total Revenue</div>
              <div className={`text-3xl font-bold ${isDarkMode ? 'text-yellow-400' : 'text-yellow-600'}`}>
                ₱{stats.totalRevenue}
              </div>
            </div>
          </div>
        )}

        {/* Registration Form Button */}
        {!showRegForm && (
          <button
            onClick={() => setShowRegForm(true)}
            className="mb-8 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium flex items-center gap-2"
          >
            <Plus size={20} />
            Add Registration
          </button>
        )}

        {/* Registration Form */}
        {showRegForm && (
          <div className={`mb-8 p-6 rounded-lg ${isDarkMode ? 'bg-gray-800' : 'bg-gray-100'}`}>
            <h2 className={`text-2xl font-bold mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
              Register New Entry
            </h2>

            <div className="space-y-4">
              <div>
                <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  Select Entry
                </label>
                <select
                  value={selectedEntry}
                  onChange={(e) => setSelectedEntry(e.target.value)}
                  disabled={entriesLoading}
                  className={`w-full px-4 py-2 rounded-lg border ${
                    isDarkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'
                  }`}
                >
                  <option value="">-- Select Entry --</option>
                  {entries.map(entry => (
                    <option key={entry._id} value={entry._id}>
                      {entry.entryName} ({entry.gameType})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className={`block text-sm font-medium mb-3 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  Game Types
                </label>
                <label className={`flex items-center gap-3 p-3 rounded border mb-2 cursor-pointer ${
                  isDarkMode ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-300'
                } ${selected2Wins ? (isDarkMode ? 'bg-red-900 border-red-600' : 'bg-red-50 border-red-300') : ''}`}>
                  <input
                    type="checkbox"
                    checked={selected2Wins}
                    onChange={(e) => setSelected2Wins(e.target.checked)}
                    className="w-4 h-4"
                  />
                  <span className={isDarkMode ? 'text-white' : 'text-gray-900'}>
                    2-Wins / Meron (₱500)
                  </span>
                </label>

                <label className={`flex items-center gap-3 p-3 rounded border cursor-pointer ${
                  isDarkMode ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-300'
                } ${selected3Wins ? (isDarkMode ? 'bg-blue-900 border-blue-600' : 'bg-blue-50 border-blue-300') : ''}`}>
                  <input
                    type="checkbox"
                    checked={selected3Wins}
                    onChange={(e) => setSelected3Wins(e.target.checked)}
                    className="w-4 h-4"
                  />
                  <span className={isDarkMode ? 'text-white' : 'text-gray-900'}>
                    3-Wins / Wala (₱1,000)
                  </span>
                </label>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={handleRegisterEntry}
                  disabled={submittingReg || !selectedEntry || (!selected2Wins && !selected3Wins)}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium flex items-center justify-center gap-2"
                >
                  {submittingReg ? <Loader size={18} className="animate-spin" /> : <Plus size={18} />}
                  {submittingReg ? 'Registering...' : 'Register'}
                </button>
                <button
                  onClick={() => {
                    setShowRegForm(false);
                    setSelectedEntry('');
                    setSelected2Wins(false);
                    setSelected3Wins(false);
                  }}
                  className={`px-6 py-2 rounded-lg border ${
                    isDarkMode ? 'border-gray-600 text-gray-300 hover:bg-gray-700' : 'border-gray-300 text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  Cancel
                </button>
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
                          <button
                            onClick={() => handleDeleteRegistration(reg._id)}
                            className={`px-3 py-1 text-xs rounded font-medium ${
                              isDarkMode ? 'bg-red-900 text-red-200 hover:bg-red-800' : 'bg-red-100 text-red-700'
                            }`}
                          >
                            Delete
                          </button>
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
