import React, { useEffect, useState, useContext } from "react";
import axios from "axios";
import { SettingsContext } from "../context/SettingsContext";
import { useToast } from "../context/ToastContext";
import { useNavigate } from "react-router-dom";
import {
  User,
  Check,
  X,
  Clock,
  CalendarDays,
  RefreshCw,
  PlusCircle,
  Users,
  Calendar,
  CheckCircle,
  XCircle,
  RotateCcw,
  UserPlus,
  UserMinus,
  AlertTriangle,
  Award,
  Bot,
  Sparkles,
} from "lucide-react";
import { getSocket } from "../socket";
import { getApiUrl } from "../utils/apiConfig";

const API = getApiUrl();

export default function ScheduleRotation() {
  const { user, settings } = useContext(SettingsContext);
  const { showToast } = useToast();
  const navigate = useNavigate();
  const dark = settings?.theme?.mode === "dark";

  const [tomorrowAssignments, setTomorrowAssignments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [tellerCount, setTellerCount] = useState(3);
  const [generating, setGenerating] = useState(false);

  // 🆕 Replacement modal & suggestions
  const [showModal, setShowModal] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [selectedAssignment, setSelectedAssignment] = useState(null);
  const [suggestLoading, setSuggestLoading] = useState(false);

  // 🆕 Absent reason modal
  const [showAbsentModal, setShowAbsentModal] = useState(false);
  const [absentReason, setAbsentReason] = useState("");
  const [penaltyDays, setPenaltyDays] = useState(0);

  // 🆕 Suggested tellers card
  const [suggestedTellers, setSuggestedTellers] = useState([]);
  const [allTellers, setAllTellers] = useState([]);

  // 🆕 Today's working tellers
  const [todayWorkingTellers, setTodayWorkingTellers] = useState([]);
  const [todayDate, setTodayDate] = useState(new Date().toISOString().slice(0, 10));

  const isSupervisorOrAdmin =
    user?.role === "supervisor" || user?.role === "admin" || user?.role === "super_admin";

  const isAdminOnly = user?.role === "admin" || user?.role === "super_admin";

  useEffect(() => {
    console.log("📅 useEffect triggered for todayDate:", todayDate);
    fetchData();
    fetchSuggestedTellers();
    if (isAdminOnly) {
      fetchAllTellers();
    }
    fetchTodayWorkingTellers();
  }, [todayDate]);

  // ✅ Real-time socket listener
  useEffect(() => {
    const socket = getSocket();
    if (socket) {
      socket.on("scheduleUpdated", (update) => {
        console.log("🔄 Schedule update:", update);
        setTomorrowAssignments((prev) =>
          prev.map((t) =>
            t.tellerId === update.tellerId
              ? { ...t, status: update.status }
              : t
          )
        );
        showToast({
          type:
            update.status === "present"
              ? "success"
              : update.status === "absent"
              ? "warning"
              : "info",
          message: `${update.tellerName} marked ${update.status}`,
        });
      });

      return () => {
        socket.off("scheduleUpdated");
      };
    }
  }, []);

  // ✅ Fetch schedule data
  const fetchData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("token");
      const res = await axios.get(`${API}/api/schedule/tomorrow`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setTomorrowAssignments(res.data.schedule || []);
    } catch (err) {
      console.error("❌ Failed to fetch schedule:", err);
      showToast({ type: "error", message: "Failed to load schedule data." });
    } finally {
      setLoading(false);
    }
  };

  // ✅ Fetch suggested tellers (visible card)
  const fetchSuggestedTellers = async () => {
    try {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const formatted = tomorrow.toISOString().slice(0, 10);

      const token = localStorage.getItem("token");
      const res = await axios.get(`${API}/api/schedule/suggest/${formatted}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSuggestedTellers(res.data.suggestions || []);
    } catch (err) {
      console.error("❌ Failed to load suggested tellers:", err);
    }
  };

  // ✅ Fetch all tellers for directory
  const fetchAllTellers = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await axios.get(`${API}/api/admin/users`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      // Filter to only show tellers and supervisor_tellers
      const tellersOnly = res.data.filter(user =>
        user.role === 'teller' || user.role === 'supervisor_teller'
      );
      setAllTellers(tellersOnly || []);
    } catch (err) {
      console.error("❌ Failed to load all tellers:", err);
      setAllTellers([]);
    }
  };

  // 🆕 Fetch today's working tellers based on submitted reports
  const fetchTodayWorkingTellers = async () => {
    try {
      console.log("🔍 Fetching working tellers for date:", todayDate);
      const token = localStorage.getItem("token");
      const res = await axios.get(`${API}/api/schedule/today-working/${todayDate}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      console.log("📊 Working tellers response:", res.data);
      setTodayWorkingTellers(res.data.tellers || []);
    } catch (err) {
      console.error("❌ Failed to load today's working tellers:", err);
      setTodayWorkingTellers([]);
    }
  };

  const handleGenerateTomorrow = async () => {
    if (!window.confirm("Generate tomorrow’s schedule now?")) return;
    try {
      setGenerating(true);
      const token = localStorage.getItem("token");
      const res = await axios.get(`${API}/api/schedule/tomorrow`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setTomorrowAssignments(res.data.schedule || []);
      showToast({
        type: "success",
        message: "Tomorrow’s schedule generated successfully.",
      });
    } catch (err) {
      console.error("❌ Failed to generate tomorrow’s schedule:", err);
      showToast({
        type: "error",
        message: "Failed to generate tomorrow’s schedule.",
      });
    } finally {
      setGenerating(false);
    }
  };

  const handleSetTellerCount = async () => {
    if (tellerCount <= 0) return;
    try {
      const token = localStorage.getItem("token");
      const res = await axios.put(`${API}/api/schedule/set-teller-count`, {
        tellerCount,
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // Update the assignments immediately without page refresh
      setTomorrowAssignments(res.data.schedule || []);
      fetchSuggestedTellers(); // Refresh suggested tellers too
      
      showToast({
        type: "success",
        message: `Teller count updated to ${tellerCount}.`,
      });
    } catch (err) {
      console.error("Error updating teller count:", err);
      showToast({ type: "error", message: "Failed to update teller count." });
    }
  };

  const markPresent = async (assignmentId) => {
    try {
      const assignment = tomorrowAssignments.find((a) => a._id === assignmentId);
      if (!assignment) return;

      const token = localStorage.getItem("token");
      await axios.put(`${API}/api/schedule/mark-present/${assignmentId}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      showToast({ type: "success", message: "Marked teller as present." });
      fetchData();
      fetchSuggestedTellers();
    } catch (err) {
      console.error("❌ Error marking present:", err);
      showToast({ type: "error", message: "Failed to mark present." });
    }
  };

  const handleAbsentClick = (assignment) => {
    setSelectedAssignment(assignment);
    setAbsentReason("");
    setPenaltyDays(0);
    setShowAbsentModal(true);
  };

  const confirmAbsent = async () => {
    if (!selectedAssignment) return;
    if (!absentReason) {
      showToast({ type: "warning", message: "Please select an absent reason." });
      return;
    }

    try {
      const token = localStorage.getItem("token");
      await axios.post(`${API}/api/schedule/mark-absent`, {
        tellerId: selectedAssignment.tellerId,
        tellerName: selectedAssignment.tellerName,
        dayKey: selectedAssignment.dayKey,
        reason: absentReason,
        penaltyDays: penaltyDays,
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      showToast({
        type: "success",
        message: `${selectedAssignment.tellerName} marked absent${penaltyDays > 0 ? ` with ${penaltyDays} day penalty` : ""}.`,
      });

      setShowAbsentModal(false);
      
      // Now show replacement suggestions
      setSuggestLoading(true);
      setShowModal(true);
      
      const res = await axios.get(`${API}/api/schedule/suggest/${selectedAssignment.dayKey}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSuggestions(res.data.suggestions || []);
      setSuggestLoading(false);
      
      fetchData();
      fetchSuggestedTellers();
    } catch (err) {
      console.error("❌ Error marking absent:", err);
      showToast({ type: "error", message: "Failed to mark absent." });
      setSuggestLoading(false);
    }
  };

  const handleReplace = async (replacementId) => {
    if (!selectedAssignment) return;
    if (!window.confirm("Assign this teller as replacement?")) return;

    try {
      const token = localStorage.getItem("token");
      await axios.put(`${API}/api/schedule/replace/${selectedAssignment._id}`, {
        replacementId,
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      showToast({
        type: "success",
        message: "Replacement teller assigned successfully.",
      });
      setShowModal(false);
      fetchData();
      fetchSuggestedTellers();
    } catch (err) {
      console.error("❌ Error assigning replacement:", err);
      showToast({ type: "error", message: "Failed to assign replacement." });
    }
  };

  const markAbsent = (assignmentId) => {
    const assignment = tomorrowAssignments.find((a) => a._id === assignmentId);
    if (assignment) {
      handleAbsentClick(assignment);
    }
  };

  return (
    <div
      className={`p-6 min-h-screen ${
        dark ? "bg-gray-900 text-gray-100" : "bg-gray-50 text-gray-900"
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <CalendarDays className="w-6 h-6 text-indigo-500" />
            Teller Schedule Rotation
          </h1>
          <p className="text-sm opacity-70">
            Manage tomorrow’s teller assignments and track attendance.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {(user?.role === "supervisor" || user?.role === "admin" || user?.role === "super_admin") && (
            <button
              onClick={() => navigate("/attendance-scheduler")}
              className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors"
            >
              <Bot className="w-4 h-4" />
              AI Attendance Scheduler
            </button>
          )}
          {(user?.role === "admin" || user?.role === "super_admin") && (
            <button
              onClick={handleGenerateTomorrow}
              disabled={generating}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold ${
                generating
                  ? "bg-gray-500 text-white"
                  : "bg-green-600 hover:bg-green-700 text-white"
              }`}
            >
              <PlusCircle className="w-4 h-4" />
              {generating ? "Generating..." : "Generate Tomorrow"}
            </button>
          )}
          <button
            onClick={() => {
              fetchData();
              fetchSuggestedTellers();
              if (isAdminOnly) {
                fetchAllTellers();
              }
            }}
            className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:opacity-90"
          >
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        </div>
      </div>

      {/* Tomorrow’s Schedule */}
      <div
        className={`rounded-lg shadow p-4 mb-8 ${
          dark ? "bg-gray-800" : "bg-white"
        }`}
      >
        <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
          <Clock className="w-5 h-5 text-indigo-500" /> Tomorrow’s Assignments
        </h2>

        {loading ? (
          <div className="text-center text-gray-400 py-6">Loading...</div>
        ) : tomorrowAssignments.length === 0 ? (
          <div className="text-center text-gray-400 py-6">
            No teller assignments found.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead
              className={`${dark ? "bg-gray-700" : "bg-gray-100"} text-left`}
            >
              <tr>
                <th className="p-3">Teller</th>
                <th className="p-3">Days Worked</th>
                {isSupervisorOrAdmin && <th className="p-3 text-center">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {tomorrowAssignments.map((a) => (
                <tr
                  key={a._id}
                  className={`${
                    dark ? "hover:bg-gray-700" : "hover:bg-gray-50"
                  }`}
                >
                  <td className="p-3 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-500">
                      <User className="w-4 h-4" />
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`w-3 h-3 rounded-full ${
                          a.status === "present"
                            ? "bg-green-500"
                            : a.status === "absent"
                            ? "bg-red-500"
                            : "bg-yellow-400"
                        }`}
                      ></span>
                      <span className="font-semibold">{a.tellerName}</span>
                    </div>
                  </td>
                  <td className="p-3">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      {a.totalWorkDays || 0} days
                    </span>
                  </td>
                  {isSupervisorOrAdmin && (
                    <td className="p-3 text-center">
                      <div className="flex justify-center gap-2">
                        <button
                          onClick={() => markPresent(a._id)}
                          className="flex items-center gap-1 px-3 py-1 text-xs rounded-lg bg-green-600 text-white hover:opacity-90"
                        >
                          <Check className="w-3 h-3" /> Present
                        </button>
                        <button
                          onClick={() => markAbsent(a._id)}
                          className="flex items-center gap-1 px-3 py-1 text-xs rounded-lg bg-red-600 text-white hover:opacity-90"
                        >
                          <X className="w-3 h-3" /> Absent
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* 🆕 Today's Working Tellers */}
      <div
        className={`p-4 mb-6 rounded-xl ${
          dark ? "bg-gray-800" : "bg-white"
        } shadow-sm`}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-green-500" />
            Today's Working Tellers ({todayDate})
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                const newDate = new Date(todayDate);
                newDate.setDate(newDate.getDate() - 1);
                const newDateStr = newDate.toISOString().slice(0, 10);
                console.log("⬅️ Previous Day clicked, setting date to:", newDateStr);
                setTodayDate(newDateStr);
              }}
              className="px-3 py-1 text-sm bg-gray-600 text-white rounded-lg hover:opacity-90"
            >
              ← Previous Day
            </button>
            <button
              onClick={() => {
                const today = new Date();
                const todayStr = today.toISOString().slice(0, 10);
                console.log("🏠 Today clicked, setting date to:", todayStr);
                setTodayDate(todayStr);
              }}
              className="px-3 py-1 text-sm bg-indigo-600 text-white rounded-lg hover:opacity-90"
            >
              Today
            </button>
            <button
              onClick={() => {
                const newDate = new Date(todayDate);
                newDate.setDate(newDate.getDate() + 1);
                const newDateStr = newDate.toISOString().slice(0, 10);
                console.log("➡️ Next Day clicked, setting date to:", newDateStr);
                setTodayDate(newDateStr);
              }}
              className="px-3 py-1 text-sm bg-gray-600 text-white rounded-lg hover:opacity-90"
            >
              Next Day →
            </button>
            <button
              onClick={fetchTodayWorkingTellers}
              className="flex items-center gap-2 px-3 py-1 text-sm bg-green-600 text-white rounded-lg hover:opacity-90"
            >
              <RefreshCw className="w-3 h-3" />
              Refresh
            </button>
          </div>
        </div>

        {todayWorkingTellers.length === 0 ? (
          <div className="text-center text-gray-400 py-4">
            No tellers have submitted reports for {new Date(todayDate).toLocaleDateString()} yet.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {todayWorkingTellers.map((teller) => (
              <div
                key={teller._id}
                className={`p-3 rounded-lg border ${
                  dark ? "bg-gray-700 border-gray-600" : "bg-gray-50 border-gray-200"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                  </div>
                  <div>
                    <p className="font-semibold">{teller.name}</p>
                    <p className="text-xs text-gray-500">{teller.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Teller Count */}
      <div
        className={`p-4 mb-6 rounded-xl ${
          dark ? "bg-gray-800" : "bg-white"
        } flex flex-col sm:flex-row items-center justify-between gap-4`}
      >
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-400">
            Number of tellers for tomorrow:
          </span>
          {isSupervisorOrAdmin ? (
            <input
              type="number"
              min={1}
              value={tellerCount}
              onChange={(e) => setTellerCount(Number(e.target.value))}
              className={`w-20 text-center p-2 rounded-lg border ${
                dark
                  ? "bg-gray-700 border-gray-600 text-gray-100"
                  : "bg-gray-50 border-gray-200"
              }`}
            />
          ) : (
            <span className="w-20 text-center p-2 rounded-lg border bg-gray-100 text-gray-600">
              {tellerCount}
            </span>
          )}
        </div>
        {isSupervisorOrAdmin && (
          <button
            onClick={handleSetTellerCount}
            className="px-4 py-2 rounded-lg bg-indigo-600 text-white hover:opacity-90"
          >
            Update Count
          </button>
        )}
      </div>

      {/* 🆕 All Tellers Directory */}
      {isAdminOnly && (
        <div
          className={`rounded-lg shadow p-4 mb-8 ${
            dark ? "bg-gray-800" : "bg-white"
          }`}
        >
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <Users className="w-5 h-5 text-indigo-500" /> All Tellers Directory
          </h2>
          {allTellers.length === 0 ? (
            <div className="text-center text-gray-400 py-4">No tellers found.</div>
          ) : (
            <ul className="divide-y divide-gray-200 max-h-96 overflow-y-auto">
              {allTellers.map((teller) => (
                <li
                  key={teller._id}
                  className={`flex justify-between items-center py-3 ${
                    dark ? "hover:bg-gray-700" : "hover:bg-gray-50"
                  }`}
                >
                  <div className="flex-1">
                    <p className="font-semibold">{teller.name || teller.username}</p>
                    <div className="flex gap-3 text-xs mt-1">
                      <span className="text-gray-500">
                        Last Worked: {teller.lastWorked ? new Date(teller.lastWorked).toLocaleDateString() : "Never"}
                      </span>
                      <span className="text-indigo-600 font-medium">
                        Total Days: {teller.totalWorkDays || 0}
                      </span>
                    </div>
                    {teller.skipUntil && new Date(teller.skipUntil) > new Date() && (
                      <p className="text-xs text-red-500 mt-1">
                        ⚠️ Penalty until: {new Date(teller.skipUntil).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-3 py-1 text-xs rounded-full ${
                        teller.status === "approved"
                          ? "bg-green-100 text-green-700"
                          : teller.status === "pending"
                          ? "bg-yellow-100 text-yellow-700"
                          : "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {teller.status}
                    </span>
                    <span className="text-xs text-gray-500">
                      {teller.role === 'supervisor_teller' ? 'Supervisor' : 'Teller'}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* 🆕 Absent Reason Modal */}
      {showAbsentModal && isSupervisorOrAdmin && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/50 z-50">
          <div
            className={`rounded-2xl shadow-lg p-6 w-full max-w-md ${
              dark ? "bg-gray-800 text-gray-100" : "bg-white text-gray-900"
            }`}
          >
            <h2 className="text-xl font-bold flex items-center gap-2 mb-4">
              <X className="w-5 h-5 text-red-500" />
              Mark Teller Absent
            </h2>

            <div className="mb-4">
              <p className="text-sm mb-2">
                Marking <span className="font-semibold">{selectedAssignment?.tellerName}</span> as absent
              </p>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">
                Reason for Absence <span className="text-red-500">*</span>
              </label>
              <select
                value={absentReason}
                onChange={(e) => setAbsentReason(e.target.value)}
                className={`w-full p-2 border rounded-lg ${
                  dark
                    ? "bg-gray-700 border-gray-600 text-white"
                    : "bg-white border-gray-300"
                }`}
              >
                <option value="">-- Select Reason --</option>
                <option value="Sick">Sick</option>
                <option value="Emergency">Emergency</option>
                <option value="Personal">Personal Leave</option>
                <option value="Family Matter">Family Matter</option>
                <option value="NCNS">No Call No Show (NCNS)</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">
                Penalty (Skip Work Days)
              </label>
              <select
                value={penaltyDays}
                onChange={(e) => setPenaltyDays(parseInt(e.target.value))}
                className={`w-full p-2 border rounded-lg ${
                  dark
                    ? "bg-gray-700 border-gray-600 text-white"
                    : "bg-white border-gray-300"
                }`}
              >
                <option value={0}>No Penalty</option>
                <option value={1}>1 Day</option>
                <option value={3}>3 Days</option>
                <option value={5}>5 Days</option>
                <option value={7}>7 Days (1 Week)</option>
                <option value={14}>14 Days (2 Weeks)</option>
              </select>
              {penaltyDays > 0 && (
                <p className="text-xs text-orange-500 mt-1">
                  ⚠️ Teller will be skipped from schedule for {penaltyDays} day(s)
                </p>
              )}
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowAbsentModal(false)}
                className="flex-1 px-4 py-2 rounded-lg bg-gray-500 text-white hover:opacity-90"
              >
                Cancel
              </button>
              <button
                onClick={confirmAbsent}
                className="flex-1 px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700"
              >
                Confirm Absent
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🆕 Replacement Modal */}
      {showModal && isSupervisorOrAdmin && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/50 z-50">
          <div
            className={`rounded-2xl shadow-lg p-6 w-full max-w-md ${
              dark ? "bg-gray-800 text-gray-100" : "bg-white text-gray-900"
            }`}
          >
            <h2 className="text-xl font-bold flex items-center gap-2 mb-4">
              <Users className="w-5 h-5 text-indigo-500" />
              Suggested Replacement Tellers
            </h2>

            {suggestLoading ? (
              <div className="text-center py-4 text-gray-400">Loading...</div>
            ) : suggestions.length === 0 ? (
              <div className="text-center py-4 text-gray-400">
                No available tellers to suggest.
              </div>
            ) : (
              <ul className="divide-y divide-gray-200 max-h-60 overflow-y-auto">
                {suggestions.map((teller) => (
                  <li
                    key={teller._id}
                    className="flex justify-between items-center py-3"
                  >
                    <div className="flex-1">
                      <p className="font-semibold">{teller.name}</p>
                      <div className="flex gap-3 text-xs text-gray-500 mt-1">
                        <span>Last Worked: {teller.lastWorked || "Never"}</span>
                      </div>
                      {teller.skipUntil && (
                        <p className="text-xs text-red-500 mt-1">
                          ⚠️ Penalty until: {teller.skipUntil}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => handleReplace(teller._id)}
                      className="bg-indigo-600 text-white text-xs px-3 py-1.5 rounded-lg hover:bg-indigo-700 ml-3"
                    >
                      Select
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <div className="mt-6 text-right">
              <button
                onClick={() => setShowModal(false)}
                className="text-sm px-4 py-2 rounded-lg bg-gray-500 text-white hover:opacity-90"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
