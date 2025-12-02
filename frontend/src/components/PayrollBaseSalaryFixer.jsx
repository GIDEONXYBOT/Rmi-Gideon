import React, { useEffect, useState, useContext } from "react";
import axios from "axios";
import { SettingsContext } from "../context/SettingsContext";
import { useToast } from "../context/ToastContext";
import { getApiUrl } from "../utils/apiConfig";
import { AlertTriangle, CheckCircle, Loader2, RefreshCw, History } from "lucide-react";

export default function PayrollBaseSalaryFixer() {
  const { settings } = useContext(SettingsContext);
  const { showToast } = useToast();
  const dark = settings?.theme?.mode === "dark";

  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [showAuditLog, setShowAuditLog] = useState(false);
  const [auditLogs, setAuditLogs] = useState([]);
  const [reason, setReason] = useState("");

  const [targetEmployees] = useState([
    { name: "charm", role: "teller", baseSalary: 450 },
    { name: "missy", role: "teller", baseSalary: 450 },
    { name: "jenessa", role: "teller", baseSalary: 450 },
    { name: "shane", role: "teller", baseSalary: 450 },
    { name: "apple", role: "supervisor", baseSalary: 600 }
  ]);

  // Fetch audit logs
  const fetchAuditLogs = async () => {
    try {
      const API_BASE = getApiUrl();
      const res = await axios.get(`${API_BASE}/admin/payroll-audit-logs`, {
        params: { limit: 10, sort: -1 }
      });
      setAuditLogs(res.data || []);
    } catch (err) {
      console.error("Error fetching audit logs:", err);
    }
  };

  useEffect(() => {
    if (showAuditLog) {
      fetchAuditLogs();
    }
  }, [showAuditLog]);

  // Execute the fix
  const handleFixPayroll = async () => {
    if (!reason.trim()) {
      showToast({
        type: "warning",
        message: "Please provide a reason for this update."
      });
      return;
    }

    setLoading(true);

    try {
      const API_BASE = getApiUrl();

      const response = await axios.post(
        `${API_BASE}/admin/fix-payroll-base-salaries`,
        {
          targetNames: targetEmployees.map(e => e.name),
          baseSalary: 450,
          conditionalSalaries: { apple: 600 },
          reason
        }
      );

      const data = response.data;

      if (data.success) {
        showToast({
          type: "success",
          message: `✅ ${data.message}`
        });

        if (data.notificationSent) {
          showToast({
            type: "info",
            message: "📧 Notifications sent to admin"
          });
        }

        setReason("");
        setShowModal(false);
        
        // Refresh audit logs
        setTimeout(() => fetchAuditLogs(), 1000);
      } else {
        showToast({
          type: "error",
          message: data.message || "Update failed"
        });
      }
    } catch (err) {
      const errorMsg = err.response?.data?.error || err.message;
      showToast({
        type: "error",
        message: `❌ ${errorMsg}`
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`p-6 rounded-lg ${dark ? "bg-gray-800" : "bg-white"}`}>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <RefreshCw size={24} />
          Payroll Base Salary Manager
        </h2>
        <button
          onClick={() => setShowAuditLog(!showAuditLog)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
        >
          <History size={18} />
          Audit Log
        </button>
      </div>

      {/* Employee List */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-4">Employees to Update:</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {targetEmployees.map((emp, idx) => (
            <div
              key={idx}
              className={`p-4 rounded-lg border ${
                dark
                  ? "bg-gray-700 border-gray-600"
                  : "bg-gray-50 border-gray-200"
              }`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold capitalize">{emp.name}</p>
                  <p className="text-sm text-gray-500">{emp.role}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-lg text-green-600">
                    ₱{emp.baseSalary}
                  </p>
                  <p className="text-xs text-gray-500">Base Salary</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Info Box */}
      <div className={`p-4 rounded-lg border-l-4 border-yellow-500 mb-6 ${
        dark ? "bg-yellow-900/20" : "bg-yellow-50"
      }`}>
        <div className="flex gap-3">
          <AlertTriangle className="text-yellow-600 flex-shrink-0 mt-0.5" size={20} />
          <div>
            <p className="font-semibold text-yellow-800">Important:</p>
            <p className="text-sm text-yellow-700">
              This will update payroll records with ₱0 base salary to the correct amounts.
              An audit log will be created and notifications will be sent to administrators.
            </p>
          </div>
        </div>
      </div>

      {/* Action Button */}
      <button
        onClick={() => setShowModal(true)}
        disabled={loading}
        className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center gap-2"
      >
        {loading ? (
          <>
            <Loader2 size={18} className="animate-spin" />
            Processing...
          </>
        ) : (
          <>
            <CheckCircle size={18} />
            Execute Base Salary Fix
          </>
        )}
      </button>

      {/* Confirmation Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div
            className={`rounded-lg p-6 w-full max-w-md ${
              dark ? "bg-gray-900" : "bg-white"
            }`}
          >
            <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
              <AlertTriangle className="text-orange-500" />
              Confirm Update
            </h3>

            <p className="mb-4 text-gray-600 dark:text-gray-400">
              You're about to update base salaries for {targetEmployees.length} employees.
              This action will be logged and audited.
            </p>

            <div className="mb-4">
              <label className="block text-sm font-semibold mb-2">
                Reason for Update:
              </label>
              <textarea
                value={reason}
                onChange={e => setReason(e.target.value)}
                placeholder="Enter reason for this update (required)..."
                className={`w-full p-3 rounded border ${
                  dark
                    ? "bg-gray-800 border-gray-600 text-white"
                    : "bg-white border-gray-300"
                }`}
                rows={3}
              />
              {!reason.trim() && (
                <p className="text-sm text-red-500 mt-1">
                  ⚠️ Reason is required
                </p>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowModal(false);
                  setReason("");
                }}
                disabled={loading}
                className="flex-1 px-4 py-2 rounded border border-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleFixPayroll}
                disabled={loading || !reason.trim()}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading && <Loader2 size={16} className="animate-spin" />}
                Confirm Update
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Audit Log Section */}
      {showAuditLog && (
        <div className="mt-8 pt-8 border-t">
          <h3 className="text-lg font-bold mb-4">Update History (Audit Log)</h3>

          {auditLogs.length === 0 ? (
            <p className="text-gray-500">No audit logs found.</p>
          ) : (
            <div className="space-y-4">
              {auditLogs.map((log, idx) => (
                <div
                  key={idx}
                  className={`p-4 rounded-lg border ${
                    dark
                      ? "bg-gray-700 border-gray-600"
                      : "bg-gray-50 border-gray-200"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold">{log.actionType}</p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        By: {log.performedBy?.name || "Unknown"}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        {new Date(log.createdAt).toLocaleString()}
                      </p>
                      {log.reason && (
                        <p className="text-sm mt-2 italic">
                          Reason: {log.reason}
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <p
                        className={`font-bold ${
                          log.status === "SUCCESS"
                            ? "text-green-600"
                            : log.status === "PARTIAL"
                            ? "text-yellow-600"
                            : "text-red-600"
                        }`}
                      >
                        {log.status}
                      </p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {log.payrollsUpdated} records
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
