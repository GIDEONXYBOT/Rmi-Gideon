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
    <div className={`min-h-screen p-6 ${isDarkMode ? 'bg-slate-900' : 'bg-gray-50'}`}>
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-8">
        <h1 className={`text-4xl font-bold mb-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
          🐔 Chicken Fight Registration
        </h1>
        <p className={isDarkMode ? 'text-gray-400' : 'text-gray-600'}>
          Track entry registrations and payment status
        </p>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="max-w-7xl mx-auto mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
          <AlertCircle className="text-red-600" size={20} />
          <span className="text-red-700 flex-1">{error}</span>
          <button onClick={() => setError('')} className="text-red-600 hover:text-red-800">
            <X size={18} />
          </button>
        </div>
      )}

      {/* Success Alert */}
      {success && (
        <div className="max-w-7xl mx-auto mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-3">
          <Check className="text-green-600" size={20} />
          <span className="text-green-700">{success}</span>
        </div>
      )}

      {/* Statistics */}
      {stats && (
        <div className="max-w-7xl mx-auto mb-8 grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className={`p-4 rounded-lg ${isDarkMode ? 'bg-slate-800' : 'bg-white'} shadow`}>
            <div className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Total</div>
            <div className={`text-3xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
              {stats.total}
            </div>
          </div>
          <div className={`p-4 rounded-lg ${isDarkMode ? 'bg-slate-800' : 'bg-white'} shadow`}>
            <div className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>2-Wins Paid</div>
            <div className="text-3xl font-bold text-green-600">{stats.paid2wins}/{stats.by2wins}</div>
            <div className="text-xs text-green-600">₱{stats.paid2wins * 500}</div>
          </div>
          <div className={`p-4 rounded-lg ${isDarkMode ? 'bg-slate-800' : 'bg-white'} shadow`}>
            <div className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>3-Wins Paid</div>
            <div className="text-3xl font-bold text-blue-600">{stats.paid3wins}/{stats.by3wins}</div>
            <div className="text-xs text-blue-600">₱{stats.paid3wins * 1000}</div>
          </div>
          <div className={`p-4 rounded-lg ${isDarkMode ? 'bg-slate-800' : 'bg-white'} shadow`}>
            <div className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Revenue</div>
            <div className={`text-3xl font-bold ${isDarkMode ? 'text-yellow-400' : 'text-yellow-600'}`}>
              ₱{stats.totalRevenue}
            </div>
          </div>
        </div>
      )}

      {/* Registration Form */}
      {showRegForm && (
        <div className="max-w-7xl mx-auto mb-8">
          <div className={`p-6 rounded-lg ${isDarkMode ? 'bg-slate-800' : 'bg-white'} shadow`}>
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
                    isDarkMode ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-gray-300'
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
                  isDarkMode ? 'bg-slate-700 border-slate-600' : 'bg-gray-50 border-gray-200'
                } ${selected2Wins ? (isDarkMode ? 'bg-red-900 border-red-600' : 'bg-red-50 border-red-300') : ''}`}>
                  <input
                    type="checkbox"
                    checked={selected2Wins}
                    onChange={(e) => setSelected2Wins(e.target.checked)}
                    className="w-4 h-4"
                  />
                  <span className={isDarkMode ? 'text-white' : 'text-gray-900'}>
                    2-Wins (₱500)
                  </span>
                </label>

                <label className={`flex items-center gap-3 p-3 rounded border cursor-pointer ${
                  isDarkMode ? 'bg-slate-700 border-slate-600' : 'bg-gray-50 border-gray-200'
                } ${selected3Wins ? (isDarkMode ? 'bg-blue-900 border-blue-600' : 'bg-blue-50 border-blue-300') : ''}`}>
                  <input
                    type="checkbox"
                    checked={selected3Wins}
                    onChange={(e) => setSelected3Wins(e.target.checked)}
                    className="w-4 h-4"
                  />
                  <span className={isDarkMode ? 'text-white' : 'text-gray-900'}>
                    3-Wins (₱1,000)
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
                    isDarkMode ? 'border-slate-600 text-gray-300 hover:bg-slate-700' : 'border-gray-300 text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Button */}
      {!showRegForm && (
        <div className="max-w-7xl mx-auto mb-8">
          <button
            onClick={() => setShowRegForm(true)}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium flex items-center gap-2"
          >
            <Plus size={20} />
            Add Registration
          </button>
        </div>
      )}

      {/* Registrations Table */}
      <div className="max-w-7xl mx-auto">
        {registrationsLoading ? (
          <div className="flex justify-center py-12">
            <Loader className="animate-spin text-blue-600" size={32} />
          </div>
        ) : registrations.length === 0 ? (
          <div className={`p-8 text-center rounded-lg ${isDarkMode ? 'bg-slate-800' : 'bg-white'}`}>
            <p className={isDarkMode ? 'text-gray-400' : 'text-gray-600'}>No registrations yet</p>
          </div>
        ) : (
          <div className={`rounded-lg overflow-hidden shadow ${isDarkMode ? 'bg-slate-800' : 'bg-white'}`}>
            <table className="w-full">
              <thead>
                <tr className={isDarkMode ? 'bg-slate-700' : 'bg-gray-100'}>
                  <th className={`px-6 py-3 text-left font-semibold ${isDarkMode ? 'text-gray-300' : 'text-gray-900'}`}>Entry Name</th>
                  <th className={`px-6 py-3 text-left font-semibold ${isDarkMode ? 'text-gray-300' : 'text-gray-900'}`}>2-Wins</th>
                  <th className={`px-6 py-3 text-left font-semibold ${isDarkMode ? 'text-gray-300' : 'text-gray-900'}`}>3-Wins</th>
                  <th className={`px-6 py-3 text-left font-semibold ${isDarkMode ? 'text-gray-300' : 'text-gray-900'}`}>Total</th>
                  <th className={`px-6 py-3 text-left font-semibold ${isDarkMode ? 'text-gray-300' : 'text-gray-900'}`}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {registrations.map((reg) => {
                  const reg2wins = reg.registrations.find(r => r.gameType === '2wins');
                  const reg3wins = reg.registrations.find(r => r.gameType === '3wins');
                  const totalFees = (reg2wins?.registrationFee || 0) + (reg3wins?.registrationFee || 0);

                  return (
                    <tr key={reg._id} className={`border-t ${isDarkMode ? 'border-slate-700' : 'border-gray-200'}`}>
                      <td className={`px-6 py-4 font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                        {reg.entryName}
                      </td>
                      <td className="px-6 py-4">
                        {reg2wins ? (
                          <div className="flex items-center gap-2">
                            <span className={reg2wins.isPaid ? 'text-green-600' : 'text-orange-600'}>₱500</span>
                            <button
                              onClick={() => handleMarkPaid(reg._id, '2wins')}
                              disabled={reg2wins.isPaid}
                              className={`px-2 py-1 text-xs rounded font-medium ${
                                reg2wins.isPaid ? 'bg-green-100 text-green-700' : isDarkMode ? 'bg-orange-900 text-orange-200' : 'bg-orange-100 text-orange-700'
                              }`}
                            >
                              {reg2wins.isPaid ? '✓' : 'Pay'}
                            </button>
                          </div>
                        ) : <span className={isDarkMode ? 'text-gray-500' : 'text-gray-400'}>-</span>}
                      </td>
                      <td className="px-6 py-4">
                        {reg3wins ? (
                          <div className="flex items-center gap-2">
                            <span className={reg3wins.isPaid ? 'text-green-600' : 'text-orange-600'}>₱1,000</span>
                            <button
                              onClick={() => handleMarkPaid(reg._id, '3wins')}
                              disabled={reg3wins.isPaid}
                              className={`px-2 py-1 text-xs rounded font-medium ${
                                reg3wins.isPaid ? 'bg-green-100 text-green-700' : isDarkMode ? 'bg-orange-900 text-orange-200' : 'bg-orange-100 text-orange-700'
                              }`}
                            >
                              {reg3wins.isPaid ? '✓' : 'Pay'}
                            </button>
                          </div>
                        ) : <span className={isDarkMode ? 'text-gray-500' : 'text-gray-400'}>-</span>}
                      </td>
                      <td className={`px-6 py-4 font-semibold ${isDarkMode ? 'text-yellow-400' : 'text-yellow-600'}`}>
                        ₱{totalFees}
                      </td>
                      <td className="px-6 py-4">
                        <button
                          onClick={() => handleDeleteRegistration(reg._id)}
                          className={`px-3 py-1 text-xs rounded font-medium ${
                            isDarkMode ? 'bg-red-900 text-red-200' : 'bg-red-100 text-red-700'
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
  );
}
