import React, { useEffect, useState, useContext } from "react";
import axios from "axios";
import { SettingsContext } from "../context/SettingsContext";
import { useToast } from "../context/ToastContext";
import {
  Save,
  AlertCircle,
  CheckCircle,
  Loader,
  Users,
  Calendar,
} from "lucide-react";

const API = import.meta.env.VITE_API_URL || "http://localhost:5000";

export default function SuperAdminTellerReportCreate() {
  const { user, settings } = useContext(SettingsContext);
  const { showToast } = useToast();
  const dark = settings?.theme?.mode === "dark";

  const [tellers, setTellers] = useState([]);
  const [selectedTeller, setSelectedTeller] = useState("");
  const [reportDate, setReportDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [loading, setLoading] = useState(false);
  const [fetchingTellers, setFetchingTellers] = useState(true);
  const [formError, setFormError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  // Fetch list of tellers
  useEffect(() => {
    const fetchTellers = async () => {
      try {
        const res = await axios.get(`${API}/api/tellers/all`);
        setTellers(res.data.tellers || []);
      } catch (err) {
        console.error("Failed to fetch tellers:", err);
        showToast({ type: "error", message: "Failed to load tellers" });
      } finally {
        setFetchingTellers(false);
      }
    };

    fetchTellers();
  }, []);

  const handleCreateReport = async (e) => {
    e.preventDefault();
    setFormError("");
    setSuccessMessage("");

    // Validation
    if (!selectedTeller) {
      setFormError("Please select a teller");
      return;
    }

    if (!reportDate) {
      setFormError("Please select a report date");
      return;
    }

    setLoading(true);

    try {
      // Create a new report for the selected teller with the selected date
      const res = await axios.post(`${API}/api/teller-reports/create-by-admin`, {
        tellerId: selectedTeller,
        reportDate: reportDate,
        createdBy: user?._id,
      });

      showToast({
        type: "success",
        message: `Report created for ${res.data.tellerName}`,
      });

      setSuccessMessage(
        `✅ Report created successfully for ${res.data.tellerName} on ${reportDate}`
      );

      // Reset form
      setSelectedTeller("");
      setReportDate(new Date().toISOString().split("T")[0]);

      // Scroll to success message
      setTimeout(() => {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }, 100);
    } catch (err) {
      const errorMsg =
        err.response?.data?.error || "Failed to create report";
      setFormError(errorMsg);
      showToast({ type: "error", message: errorMsg });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className={`min-h-screen p-4 md:p-8 ${
        dark ? "bg-gray-900 text-gray-100" : "bg-gray-50 text-gray-800"
      }`}
    >
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
            <Users size={32} className="text-indigo-600" />
            Create Teller Report
          </h1>
          <p className="text-gray-500">
            Select a teller and date to create a new report
          </p>
        </div>

        {/* Success Message */}
        {successMessage && (
          <div
            className={`mb-6 p-4 rounded-lg border-l-4 border-green-500 ${
              dark ? "bg-green-900 text-green-100" : "bg-green-50 text-green-800"
            }`}
          >
            <div className="flex items-start gap-3">
              <CheckCircle size={20} className="flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold">Success</h3>
                <p className="text-sm mt-1">{successMessage}</p>
              </div>
            </div>
          </div>
        )}

        {/* Error Message */}
        {formError && (
          <div
            className={`mb-6 p-4 rounded-lg border-l-4 border-red-500 ${
              dark ? "bg-red-900 text-red-100" : "bg-red-50 text-red-800"
            }`}
          >
            <div className="flex items-start gap-3">
              <AlertCircle size={20} className="flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold">Error</h3>
                <p className="text-sm mt-1">{formError}</p>
              </div>
            </div>
          </div>
        )}

        {/* Form Card */}
        <div
          className={`rounded-lg shadow-lg p-6 ${
            dark
              ? "bg-gray-800 border border-gray-700"
              : "bg-white border border-gray-200"
          }`}
        >
          <form onSubmit={handleCreateReport} className="space-y-6">
            {/* Teller Dropdown */}
            <div>
              <label className="block text-sm font-semibold mb-3 flex items-center gap-2">
                <Users size={18} className="text-indigo-600" />
                Select Teller
              </label>
              {fetchingTellers ? (
                <div className="flex items-center gap-2 text-gray-500">
                  <Loader size={18} className="animate-spin" />
                  Loading tellers...
                </div>
              ) : (
                <select
                  value={selectedTeller}
                  onChange={(e) => setSelectedTeller(e.target.value)}
                  className={`w-full px-4 py-2 rounded-lg border transition-all ${
                    dark
                      ? "bg-gray-700 border-gray-600 text-gray-100 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                      : "bg-gray-50 border-gray-300 text-gray-800 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                  }`}
                  disabled={fetchingTellers}
                >
                  <option value="">-- Choose a teller --</option>
                  {tellers.map((teller) => (
                    <option key={teller._id} value={teller._id}>
                      {teller.name || teller.username}
                    </option>
                  ))}
                </select>
              )}
              {tellers.length === 0 && !fetchingTellers && (
                <p className="text-sm text-amber-600 mt-2">
                  ⚠️ No tellers found in the system
                </p>
              )}
            </div>

            {/* Date Picker */}
            <div>
              <label className="block text-sm font-semibold mb-3 flex items-center gap-2">
                <Calendar size={18} className="text-indigo-600" />
                Report Date
              </label>
              <input
                type="date"
                value={reportDate}
                onChange={(e) => setReportDate(e.target.value)}
                className={`w-full px-4 py-2 rounded-lg border transition-all ${
                  dark
                    ? "bg-gray-700 border-gray-600 text-gray-100 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                    : "bg-gray-50 border-gray-300 text-gray-800 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                }`}
              />
              <p className="text-xs text-gray-500 mt-1">
                Select the date for this report
              </p>
            </div>

            {/* Submit Button */}
            <div className="pt-4 border-t border-gray-700">
              <button
                type="submit"
                disabled={loading || !selectedTeller}
                className={`w-full px-6 py-3 rounded-lg font-semibold flex items-center justify-center gap-2 transition-all ${
                  loading || !selectedTeller
                    ? "opacity-50 cursor-not-allowed bg-gray-600"
                    : "bg-indigo-600 hover:bg-indigo-700 active:scale-95"
                } text-white`}
              >
                {loading ? (
                  <>
                    <Loader size={18} className="animate-spin" />
                    Creating Report...
                  </>
                ) : (
                  <>
                    <Save size={18} />
                    Create Report
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Info Box */}
        <div
          className={`mt-6 p-4 rounded-lg ${
            dark
              ? "bg-indigo-900/20 border border-indigo-700 text-indigo-100"
              : "bg-indigo-50 border border-indigo-200 text-indigo-800"
          }`}
        >
          <h3 className="font-semibold mb-2">How it works:</h3>
          <ul className="text-sm space-y-1">
            <li>1. Select a teller from the dropdown</li>
            <li>2. Choose the date for the report</li>
            <li>3. Click "Create Report" to generate the report</li>
            <li>4. The report will be auto-linked to the selected teller</li>
            <li>5. The teller can then view and edit their report</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
