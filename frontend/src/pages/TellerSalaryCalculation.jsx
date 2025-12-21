import React, { Fragment, useState, useEffect, useContext } from 'react';
import axios from 'axios';
import { SettingsContext } from '../context/SettingsContext';
import { useToast } from '../context/ToastContext';
import { getApiUrl } from '../utils/apiConfig';
import { Loader2, ChevronLeft, ChevronRight, Calendar, Printer } from 'lucide-react';

export default function TellerSalaryCalculation() {
  const { user, settings } = useContext(SettingsContext);
  const { showToast } = useToast();
  const dark = settings?.theme?.mode === 'dark';

  const [tellers, setTellers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedWeek, setSelectedWeek] = useState(new Date().toISOString().split('T')[0]);
  const [weekStart, setWeekStart] = useState(null);
  const [weekEnd, setWeekEnd] = useState(null);
  const dayLabels = [
    { key: 'mon', label: 'Mon' },
    { key: 'tue', label: 'Tue' },
    { key: 'wed', label: 'Wed' },
    { key: 'thu', label: 'Thu' },
    { key: 'fri', label: 'Fri' },
    { key: 'sat', label: 'Sat' },
    { key: 'sun', label: 'Sun' }
  ];
  const baseSalaryAmount = 450;
  const baseWeeklySum = baseSalaryAmount * dayLabels.length;
  const sumOver = (overObj = {}) =>
    dayLabels.reduce((sum, { key }) => sum + (overObj[key] || 0), 0);
  const formatCurrency = (value) => `₱${value.toFixed(2)}`;
  const getWeekRangeLabel = () => {
    if (weekStart && weekEnd) {
      return `${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
    }
    return 'Week overview';
  };

  const handlePrint = (teller) => {
    const dailyOver = teller.over || {};
    const weekLabel = getWeekRangeLabel();
    const printableRows = dayLabels
      .map(({ key, label }) => {
        const overAmount = dailyOver[key] || 0;
        return `<div class="row"><span>${label}</span><span>${formatCurrency(overAmount)}</span><span>${formatCurrency(baseSalaryAmount)}</span></div>`;
      })
      .join('');

    const html = `<!doctype html>
<html>
<head>
  <title>${teller.name} - Teller Report</title>
  <style>
    @media print {
      @page { size: 58mm auto; margin: 4mm; }
    }
    body { font-family: 'Helvetica', Arial, sans-serif; padding: 12px; margin: 0; width: 220px; }
    h2 { margin: 0 0 4px; font-size: 16px; }
    p { margin: 2px 0; font-size: 11px; }
    .row { display: flex; justify-content: space-between; margin: 3px 0; font-size: 12px; }
    .divider { border-top: 1px dashed #111; margin: 8px 0; }
    .signature { margin-top: 14px; font-size: 10px; }
    .signature-line { border-top: 1px solid #000; margin-top: 10px; padding-top: 4px; }
  </style>
</head>
<body>
  <h2>${teller.name}</h2>
  <p>Teller ID: ${teller.id}</p>
  <p>${weekLabel}</p>
  <div class="divider"></div>
  ${printableRows}
  <div class="divider"></div>
  <div class="row"><strong>Total</strong><strong>${formatCurrency(sumOver(dailyOver))}</strong><strong>${formatCurrency(baseSalaryAmount)}</strong></div>
  <div class="signature">
    <p>Prepared by: __________________________</p>
    <p class="signature-line">Signature</p>
  </div>
  <script>
    window.onload = () => {
      setTimeout(() => {
        window.print();
      }, 250);
    };
  </script>
</body>
</html>`;

    const printWindow = window.open('', '_blank', 'width=340,height=640');
    if (!printWindow) return;
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
    printWindow.close();
  };

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
      end.setDate(end.getDate() + 6); // Sunday

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
              const dailyOver = teller.over || {};
              const totalOver = sumOver(dailyOver);
              const baseSalary = baseSalaryAmount;

              return (
                <div
                  key={teller.id}
                  className={`rounded-xl shadow-lg overflow-hidden transition transform hover:shadow-xl ${
                    dark ? 'bg-gray-800' : 'bg-white'
                  }`}
                >
                  {/* Card Header */}
                  <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 p-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="text-lg font-bold text-white">{teller.name}</h3>
                        <p className="text-indigo-100 text-sm">Teller ID: {teller.id}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handlePrint(teller)}
                        className="inline-flex items-center gap-1 px-3 py-1 bg-white/20 hover:bg-white/30 rounded-full text-white text-xs font-semibold transition"
                      >
                        <Printer size={14} />
                        Print
                      </button>
                    </div>
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
                      <div className="grid grid-cols-3 gap-2 text-xs font-semibold text-gray-500 dark:text-gray-400 border-b pb-2">
                        <span>Day</span>
                        <span>Over</span>
                        <span>Base Salary</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-sm mt-3">
                        {dayLabels.map(({ key, label }) => {
                          const overAmount = dailyOver[key] || 0;
                          return (
                            <Fragment key={key}>
                              <div className={`text-sm ${dark ? 'text-gray-400' : 'text-gray-600'}`}>{label}</div>
                              <div className={`text-sm font-semibold ${
                                overAmount > 0 ? 'text-green-600' : overAmount < 0 ? 'text-red-600' : dark ? 'text-gray-500' : 'text-gray-400'
                              }`}>₱{overAmount.toFixed(2)}</div>
                              <div className={`text-sm ${dark ? 'text-gray-300' : 'text-gray-600'}`}>₱{baseSalaryAmount.toFixed(2)}</div>
                            </Fragment>
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
                        <span className={`text-xl font-bold ${totalOver > 0 ? 'text-green-600' : totalOver < 0 ? 'text-red-600' : 'text-gray-400'}`}>
                          ₱{totalOver.toFixed(2)}
                        </span>
                      </div>
                    </div>

                    {/* Total Compensation */}
                    <div className={`mt-4 p-3 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-700`}>
                      <div className="text-xs font-semibold text-indigo-700 dark:text-indigo-300 mb-2">
                        Total Compensation
                      </div>
                        <div className="text-2xl font-bold text-indigo-600">
                          ₱{(baseWeeklySum + totalOver).toFixed(2)}
                        </div>
                        <p className="text-xs text-indigo-600 dark:text-indigo-400 mt-1">
                          Base (₱{baseWeeklySum.toFixed(2)}) + Over (₱{totalOver.toFixed(2)})
                        </p>
                    </div>
                    <div className="mt-4 border-t border-dashed border-gray-400 pt-3 text-xs text-gray-500 dark:text-gray-400">
                      <div className="flex justify-between items-center">
                        <span>Prepared By</span>
                        <div className="border-t border-dashed border-gray-400 w-32" />
                      </div>
                      <div className="flex justify-between items-center mt-2">
                        <span>Supervisor Signature</span>
                        <div className="border-t border-dashed border-gray-400 w-32" />
                      </div>
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
              <p className={`text-sm ${dark ? 'text-gray-400' : 'text-gray-600'} mb-2`}>Weekly Base Salary (Each)</p>
              <p className="text-3xl font-bold text-green-600">₱{baseWeeklySum.toFixed(2)}</p>
            </div>

            <div className={`rounded-xl p-6 ${dark ? 'bg-gray-800' : 'bg-white'} shadow-lg`}>
              <p className={`text-sm ${dark ? 'text-gray-400' : 'text-gray-600'} mb-2`}>Total Weekly Over</p>
              <p className="text-3xl font-bold text-green-600">
                ₱{tellers.reduce((sum, t) => sum + sumOver(t.over), 0).toFixed(2)}
              </p>
            </div>

            <div className={`rounded-xl p-6 ${dark ? 'bg-gray-800' : 'bg-white'} shadow-lg`}>
              <p className={`text-sm ${dark ? 'text-gray-400' : 'text-gray-600'} mb-2`}>Avg Weekly Over</p>
              <p className="text-3xl font-bold text-purple-600">
                ₱{(tellers.length > 0 ? tellers.reduce((sum, t) => sum + sumOver(t.over), 0) / tellers.length : 0).toFixed(2)}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
