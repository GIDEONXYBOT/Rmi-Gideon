import React, { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import { SettingsContext } from '../context/SettingsContext';
import { useToast } from '../context/ToastContext';
import { getApiUrl } from '../utils/apiConfig';
import { Loader2, ChevronLeft, ChevronRight, Calendar } from 'lucide-react';

export default function TellerSalaryCalculation() {
  const { user, settings } = useContext(SettingsContext);
  const { showToast } = useToast();
  const dark = settings?.theme?.mode === 'dark';

  const [tellers, setTellers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedWeek, setSelectedWeek] = useState(new Date().toISOString().split('T')[0]);
  const [weekStart, setWeekStart] = useState(null);
  const [weekEnd, setWeekEnd] = useState(null);

  // Check if user is super_admin or supervisor
  const isSuperAdminOrSupervisor = user?.role === 'super_admin' || user?.role === 'supervisor';

  useEffect(() => {
    if (!isSuperAdminOrSupervisor) {
      showToast({ type: 'error', message: 'Access denied. Only superadmin and supervisors can view this page.' });
      return;
    }
    fetchTellerSalaryData();
  }, [selectedWeek]);

  const fetchTellerSalaryData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      // Get the week start (Monday)
      const date = new Date(selectedWeek);
      const dayOfWeek = date.getDay();
      const diffToMonday = date.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
      const start = new Date(date.setDate(diffToMonday));
      const end = new Date(start);
      end.setDate(end.getDate() + 4); // Friday

      setWeekStart(start);
      setWeekEnd(end);

      const response = await axios.get(
        `${getApiUrl()}/api/teller-salary-calculation`,
        {
          params: {
            weekStart: start.toISOString().split('T')[0],
            weekEnd: end.toISOString().split('T')[0],
            supervisorId: user?.role === 'supervisor' ? user?.id : undefined
          },
          headers
        }
      );

      setTellers(response.data?.tellers || []);
    } catch (err) {
      console.error('Error fetching teller salary data:', err);
      showToast({ type: 'error', message: 'Failed to load teller salary data' });
    } finally {
      setLoading(false);
    }
  };

  const handlePreviousWeek = () => {
    const date = new Date(selectedWeek);
    date.setDate(date.getDate() - 7);
    setSelectedWeek(date.toISOString().split('T')[0]);
  };

  const handleNextWeek = () => {
    const date = new Date(selectedWeek);
    date.setDate(date.getDate() + 7);
    setSelectedWeek(date.toISOString().split('T')[0]);
  };

  const handleToday = () => {
    setSelectedWeek(new Date().toISOString().split('T')[0]);
  };

  if (!isSuperAdminOrSupervisor) {
    return (
      <div className={`flex flex-col items-center justify-center min-h-screen ${dark ? 'bg-gray-900 text-gray-100' : 'bg-gray-50 text-gray-900'}`}>
        <h1 className="text-3xl font-bold mb-2">Access Denied</h1>
        <p className="text-sm opacity-70">You do not have permission to view this page.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className={`flex items-center justify-center min-h-screen ${dark ? 'bg-gray-900' : 'bg-gray-50'}`}>
        <Loader2 className="animate-spin text-indigo-600" size={40} />
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${dark ? 'bg-gray-900' : 'bg-gray-50'} p-6`}>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className={`text-3xl font-bold mb-2 ${dark ? 'text-white' : 'text-gray-900'}`}>
            Teller Salary Calculation
          </h1>
          <p className={`text-sm ${dark ? 'text-gray-400' : 'text-gray-600'}`}>
            Weekly overtime and salary summary
          </p>
        </div>

        {/* Week Navigation */}
        <div className={`mb-6 p-4 rounded-lg ${dark ? 'bg-gray-800' : 'bg-white'} shadow-md`}>
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-2">
              <button
                onClick={handlePreviousWeek}
                className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition"
                title="Previous week"
              >
                <ChevronLeft size={20} />
              </button>
              <button
                onClick={handleToday}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition text-sm"
              >
                This Week
              </button>
              <button
                onClick={handleNextWeek}
                className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition"
                title="Next week"
              >
                <ChevronRight size={20} />
              </button>
            </div>

            <div className="flex items-center gap-2">
              <Calendar size={18} />
              <input
                type="date"
                value={selectedWeek}
                onChange={(e) => setSelectedWeek(e.target.value)}
                className={`px-3 py-2 rounded-lg border ${
                  dark
                    ? 'bg-gray-700 border-gray-600 text-white'
                    : 'bg-white border-gray-300 text-gray-900'
                }`}
              />
            </div>

            <div className={`text-sm font-semibold ${dark ? 'text-gray-300' : 'text-gray-700'}`}>
              {weekStart && weekEnd && (
                <>
                  {weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - {weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </>
              )}
            </div>
          </div>
        </div>

        {/* Teller Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {tellers.length === 0 ? (
            <div className={`col-span-full p-8 rounded-lg text-center ${dark ? 'bg-gray-800 text-gray-400' : 'bg-white text-gray-500'}`}>
              <p>No tellers found for this week</p>
            </div>
          ) : (
            tellers.map((teller) => {
              const dailyOT = teller.overtime || {};
              const totalOT = Object.values(dailyOT).reduce((sum, val) => sum + (val || 0), 0);
              const baseSalary = 450;

              return (
                <div
                  key={teller.id}
                  className={`rounded-xl shadow-lg overflow-hidden transition transform hover:shadow-xl ${
                    dark ? 'bg-gray-800' : 'bg-white'
                  }`}
                >
                  {/* Card Header */}
                  <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 p-4">
                    <h3 className="text-lg font-bold text-white">{teller.name}</h3>
                    <p className="text-indigo-100 text-sm">Teller ID: {teller.id}</p>
                  </div>

                  {/* Card Content */}
                  <div className="p-4">
                    {/* Base Salary */}
                    <div className={`mb-4 p-3 rounded-lg ${dark ? 'bg-gray-700' : 'bg-gray-50'}`}>
                      <div className="flex justify-between items-center">
                        <span className={`text-sm font-semibold ${dark ? 'text-gray-300' : 'text-gray-700'}`}>
                          Base Salary
                        </span>
                        <span className="text-lg font-bold text-indigo-600">
                          ₱{baseSalary.toFixed(2)}
                        </span>
                      </div>
                    </div>

                    {/* Daily Over */}
                    <div className="mb-4">
                      <h4 className={`text-sm font-semibold mb-3 ${dark ? 'text-gray-300' : 'text-gray-700'}`}>
                        Daily Over (Cash)
                      </h4>
                      <div className="space-y-2">
                        {['mon', 'tue', 'wed', 'thu', 'fri'].map((day) => {
                          const label = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
                          const overAmount = dailyOT[day] || 0;
                          return (
                            <div key={day} className="flex justify-between items-center">
                              <span className={`text-sm ${dark ? 'text-gray-400' : 'text-gray-600'}`}>
                                {label[['mon', 'tue', 'wed', 'thu', 'fri'].indexOf(day)]}
                              </span>
                              <span className={`font-semibold ${
                                overAmount > 0 ? 'text-green-600' : overAmount < 0 ? 'text-red-600' : dark ? 'text-gray-500' : 'text-gray-400'
                              }`}>
                                ₱{overAmount.toFixed(2)}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Weekly Total Over */}
                    <div className={`pt-3 border-t ${dark ? 'border-gray-700' : 'border-gray-200'}`}>
                      <div className="flex justify-between items-center">
                        <span className={`font-semibold ${dark ? 'text-gray-300' : 'text-gray-700'}`}>
                          Weekly Over Total
                        </span>
                        <span className={`text-xl font-bold ${totalOT > 0 ? 'text-green-600' : totalOT < 0 ? 'text-red-600' : 'text-gray-400'}`}>
                          ₱{totalOT.toFixed(2)}
                        </span>
                      </div>
                    </div>

                    {/* Total Compensation */}
                    <div className={`mt-4 p-3 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-700`}>
                      <div className="text-xs font-semibold text-indigo-700 dark:text-indigo-300 mb-2">
                        Total Compensation
                      </div>
                      <div className="text-2xl font-bold text-indigo-600">
                        ₱{(baseSalary + totalOT).toFixed(2)}
                      </div>
                      <p className="text-xs text-indigo-600 dark:text-indigo-400 mt-1">
                        Base (₱{baseSalary.toFixed(2)}) + Over (₱{totalOT.toFixed(2)})
                      </p>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Summary Stats */}
        {tellers.length > 0 && (
          <div className="mt-8 grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className={`rounded-xl p-6 ${dark ? 'bg-gray-800' : 'bg-white'} shadow-lg`}>
              <p className={`text-sm ${dark ? 'text-gray-400' : 'text-gray-600'} mb-2`}>Total Tellers</p>
              <p className="text-3xl font-bold text-indigo-600">{tellers.length}</p>
            </div>
            
            <div className={`rounded-xl p-6 ${dark ? 'bg-gray-800' : 'bg-white'} shadow-lg`}>
              <p className={`text-sm ${dark ? 'text-gray-400' : 'text-gray-600'} mb-2`}>Base Salary (Each)</p>
              <p className="text-3xl font-bold text-green-600">₱450</p>
            </div>

            <div className={`rounded-xl p-6 ${dark ? 'bg-gray-800' : 'bg-white'} shadow-lg`}>
              <p className={`text-sm ${dark ? 'text-gray-400' : 'text-gray-600'} mb-2`}>Total Weekly Over</p>
              <p className="text-3xl font-bold text-green-600">
                ₱{tellers.reduce((sum, t) => {
                  const total = (t.over?.mon || 0) + (t.over?.tue || 0) + (t.over?.wed || 0) + (t.over?.thu || 0) + (t.over?.fri || 0);
                  return sum + total;
                }, 0).toFixed(2)}
              </p>
            </div>

            <div className={`rounded-xl p-6 ${dark ? 'bg-gray-800' : 'bg-white'} shadow-lg`}>
              <p className={`text-sm ${dark ? 'text-gray-400' : 'text-gray-600'} mb-2`}>Avg Weekly Over</p>
              <p className="text-3xl font-bold text-purple-600">
                ₱{(tellers.length > 0 ? tellers.reduce((sum, t) => {
                  const total = (t.over?.mon || 0) + (t.over?.tue || 0) + (t.over?.wed || 0) + (t.over?.thu || 0) + (t.over?.fri || 0);
                  return sum + total;
                }, 0) / tellers.length : 0).toFixed(2)}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
