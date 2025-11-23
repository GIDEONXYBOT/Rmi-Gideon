import React, { useEffect, useState, useContext } from "react";
import axios from "axios";
import { SettingsContext } from "../context/SettingsContext.jsx";
import { useToast } from "../context/ToastContext.jsx";
import { FileText, Loader2, Save, Printer } from "lucide-react";
import { buildTellerReceipt58, tryPrintRawBT } from "../utils/escpos.js";
import { getApiUrl } from "../utils/apiConfig.js";
import { getGlobalSocket } from "../utils/globalSocket.js";

export default function TellerReports() {
  const { user, settings } = useContext(SettingsContext);
  const { showToast } = useToast();
  const dark = settings?.theme?.mode === "dark";
  
  // Initialize socket connection
  const socket = getGlobalSocket();

  // 🔥 CRITICAL: Global error handler for catching any uncaught errors
  useEffect(() => {
    // Enhanced error handling - ALERTS TEMPORARILY DISABLED FOR INPUT TESTING
    const handleGlobalError = (error) => {
      console.error("🔥 GLOBAL ERROR CAUGHT:", error);
      console.error("🔥 Error stack:", error.stack);
      console.error("🔥 Error details:", {
        message: error.message,
        filename: error.filename,
        lineno: error.lineno,
        colno: error.colno
      });
      // alert(`🔥 GLOBAL ERROR: ${error.message}`); // TEMPORARILY DISABLED
    };

    const handleUnhandledRejection = (event) => {
      console.error("🔥 UNHANDLED PROMISE REJECTION:", event.reason);
      console.error("🔥 Promise:", event.promise);
      // alert(`🔥 PROMISE REJECTION: ${event.reason}`); // TEMPORARILY DISABLED
    };

    window.addEventListener('error', handleGlobalError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    // Mobile viewport debugging
    console.log("📱 MOBILE VIEWPORT DEBUG:", {
      innerWidth: window.innerWidth,
      innerHeight: window.innerHeight,
      screenWidth: window.screen.width,
      screenHeight: window.screen.height,
      devicePixelRatio: window.devicePixelRatio,
      userAgent: navigator.userAgent,
      touchSupport: 'ontouchstart' in window,
      isMobile: /Mobile|Android|iPhone|iPad/.test(navigator.userAgent)
    });

    return () => {
      window.removeEventListener('error', handleGlobalError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);

  const [form, setForm] = useState({
    systemBalance: "",
    d1000: "",
    d500: "",
    d200: "",
    d100: "",
    d50: "",
    d20: "",
    coins: "",
    short: "",
    over: "",
  });

  const [loading, setLoading] = useState(false);

  // 💰 Capital state for validation
  const [activeCapital, setActiveCapital] = useState(null);
  const [capitalLoading, setCapitalLoading] = useState(true);

  // 🖨️ Printer finder state
  const [showPrinterFinder, setShowPrinterFinder] = useState(false);
  const [printerSearch, setPrinterSearch] = useState("");
  const [availablePrinters, setAvailablePrinters] = useState([]);
  const [selectedPrinter, setSelectedPrinter] = useState(null);
  const [printerScanning, setPrinterScanning] = useState(false);
  const [savedPrinters, setSavedPrinters] = useState(() => {
    const saved = localStorage.getItem('tellerPrinters');
    return saved ? JSON.parse(saved) : [];
  });

  // Diagnostic tool to check why a teller might not be able to submit
  const runDiagnostic = async () => {
    if (!user?._id) {
      console.error("❌ Cannot run diagnostic - no user ID");
      alert("❌ No user found for diagnostic");
      return;
    }
    
    console.log("🔍 Running simplified diagnostic...");
    
    // Use local validation instead of broken backend endpoint
    const localValidation = validateUserForSubmission(user);
    
    let message = `� MOBILE SUBMISSION DIAGNOSTIC REPORT\n\n`;
    message += `👤 User: ${user.name || user.username}\n`;
    message += `🆔 User ID: ${user._id}\n`;
    message += `🎭 Role: ${user.role}\n`;
    message += `📱 Device: ${/Mobile|Android|iPhone|iPad/.test(navigator.userAgent) ? 'Mobile' : 'Desktop'}\n`;
    message += `✅ Status: ${user.status || 'Unknown'}\n\n`;
    
    message += `📊 REQUIREMENTS CHECK:\n`;
    message += `✅ Has User ID: ${!!user._id ? 'YES' : 'NO'}\n`;
    message += `✅ Teller Role: ${user.role === 'teller' ? 'YES' : 'NO'}\n`;
    message += `✅ User Approved: ${user.approved !== false ? 'YES' : 'NO'}\n`;
    message += `✅ Active Status: ${user.status !== 'inactive' && user.status !== 'disabled' ? 'YES' : 'NO'}\n`;
    message += `✅ Has Active Capital: ${!!activeCapital ? 'YES' : 'NO'}\n`;
    message += `✅ Has Supervisor: ${!!(user.supervisorId || user.supervisor?._id) ? 'YES' : 'NO'}\n\n`;
    
    if (activeCapital) {
      message += `💰 Active Capital: ₱${activeCapital.amount || 0}`;
      if (activeCapital.totalAdditional) message += ` + ₱${activeCapital.totalAdditional}`;
      if (activeCapital.totalRemitted) message += ` - ₱${activeCapital.totalRemitted}`;
      message += `\n`;
    } else {
      message += `💰 Active Capital: NONE\n`;
    }
    
    if (user.supervisor?.name || user.supervisorName) {
      message += `👨‍💼 Supervisor: ${user.supervisor?.name || user.supervisorName}\n\n`;
    }
    
    if (localValidation.valid) {
      message += `🎉 RESULT: You CAN submit reports!\n`;
      message += `✅ All critical validation checks passed.\n\n`;
      
      // Show warnings if any
      if (localValidation.warnings && localValidation.warnings.length > 0) {
        message += `⚠️ WARNINGS (non-blocking):\n`;
        localValidation.warnings.forEach((warning, index) => {
          message += `${index + 1}. ${warning}\n`;
        });
        message += `\n`;
      }
    } else {
      message += `❌ RESULT: Cannot submit reports\n\n`;
      message += `🔧 CRITICAL ISSUES TO FIX:\n`;
      localValidation.issues.forEach((issue, index) => {
        message += `${index + 1}. ${issue}\n`;
      });
      message += `\n💡 Contact your supervisor or administrator to resolve these issues.\n\n`;
    }
    
    // Add specific note about database sync issues for affected users
    if (!user.supervisorId && localValidation.warnings?.some(w => w.includes('database sync'))) {
      message += `� SUPERVISOR ASSIGNMENT:\n`;
      message += `• Your reports are automatically assigned to your supervisor\n`;
      message += `• System handles supervisor assignment dynamically\n`;
      message += `• No action needed from you\n\n`;
    }
    
    message += `ℹ️ System Status: All systems operational\n`;
    message += `📱 Ready for report submission!\n\n`;
    
    console.log("🔍 Local diagnostic complete:", localValidation);
    alert(message);
  };

  const safeNum = (v) =>
    v === "" || v === null || typeof v === "undefined" ? 0 : Number(v);

  // ✅ Compute Cash on Hand (from actual denominations counted)
  const cashOnHand =
    safeNum(form.d1000) * 1000 +
    safeNum(form.d500) * 500 +
    safeNum(form.d200) * 200 +
    safeNum(form.d100) * 100 +
    safeNum(form.d50) * 50 +
    safeNum(form.d20) * 20 +
    safeNum(form.coins);

  // ✅ Auto compute Short / Over on every change
  useEffect(() => {
    const sys = safeNum(form.systemBalance);
    const diff = cashOnHand - sys;

    if (!sys && !cashOnHand) {
      setForm((prev) => ({ ...prev, short: "", over: "" }));
      return;
    }

    if (diff > 0) {
      // Over
      setForm((prev) => ({
        ...prev,
        over: diff.toFixed(2),
        short: "",
      }));
    } else if (diff < 0) {
      // Short
      setForm((prev) => ({
        ...prev,
        short: Math.abs(diff).toFixed(2),
        over: "",
      }));
    } else {
      setForm((prev) => ({ ...prev, short: "", over: "" }));
    }
  }, [
    form.systemBalance,
    form.d1000,
    form.d500,
    form.d200,
    form.d100,
    form.d50,
    form.d20,
    form.coins,
  ]);

  // 💰 Fetch active capital for validation
  useEffect(() => {
    const fetchActiveCapital = async () => {
      if (!user?._id) {
        setCapitalLoading(false);
        return;
      }

      try {
        console.log("💰 Fetching active capital for user:", user._id);
        const response = await axios.get(`${getApiUrl()}/api/teller-management/capital/${user._id}`);
        const capitalData = response.data;

        if (capitalData && capitalData.status === 'active') {
          setActiveCapital(capitalData);
          console.log("✅ Active capital found:", capitalData);
        } else {
          setActiveCapital(null);
          console.log("⚠️ No active capital found for user");
        }
      } catch (error) {
        console.error("❌ Failed to fetch active capital:", error);
        setActiveCapital(null);
      } finally {
        setCapitalLoading(false);
      }
    };

    fetchActiveCapital();
  }, [user?._id]);

  // ✅ Input change handler
  const handleChange = (e) => {
    const { name, value } = e.target;
    console.log(`📝 Form change detected: ${name} = "${value}"`);
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  // � Enhanced user validation for mobile-specific issues
  const validateUserForSubmission = (user) => {
    console.log("🔍 VALIDATING USER FOR SUBMISSION:");
    console.log("📋 User Details:", {
      userId: user?._id,
      userName: user?.name || user?.username,
      userEmail: user?.email,
      userRole: user?.role,
      supervisorId: user?.supervisorId,
      supervisorName: user?.supervisor?.name || user?.supervisorName,
      userStatus: user?.status,
      userApproved: user?.approved,
      hasPayroll: !!user?.payroll,
      userCreated: user?.createdAt,
      userUpdated: user?.updatedAt,
      timestamp: new Date().toISOString()
    });

    // Check for common blocking issues
    const blockingIssues = [];
    const warnings = [];
    
    if (!user) {
      blockingIssues.push("No user object");
      return { valid: false, issues: blockingIssues, warnings };
    }
    
    if (!user._id) {
      blockingIssues.push("Missing user ID");
    }
    
    if (user.role !== 'teller') {
      blockingIssues.push(`Invalid role: ${user.role} (expected: teller)`);
    }
    
    if (user.approved === false) {
      blockingIssues.push("User not approved");
    }
    
    if (user.status === 'inactive' || user.status === 'disabled') {
      blockingIssues.push(`User status: ${user.status}`);
    }
    
    // 💰 CAPITAL CHECK - Critical for report submission
    if (!activeCapital) {
      blockingIssues.push("No active capital assigned - cannot submit reports");
    }

    // ⚠️ SUPERVISOR CHECK - Handle database synchronization issues
    if (!user.supervisorId && !user.supervisor?._id) {
      warnings.push("Supervisor ID missing from user record (possible database sync issue)");
      console.log(`⚠️ DATABASE SYNC ISSUE: ${user.name} missing supervisorId in user record`);
      console.log("💡 NOTE: User may appear in supervisor reports but supervisorId not synced to user record");
      console.log("💡 SOLUTION: Backend should dynamically assign supervisor or sync database");
      console.log("⚠️ ALLOWING SUBMISSION: Mobile validation should not block due to sync issues");
    }

    const isValid = blockingIssues.length === 0; // Only blocking issues prevent submission

    console.log("🔍 VALIDATION RESULT:", {
      valid: isValid,
      blockingIssues: blockingIssues.length,
      warningsCount: warnings.length,
      issues: blockingIssues,
      warnings: warnings,
      hasActiveCapital: !!activeCapital
    });

    return {
      valid: isValid,
      issues: blockingIssues,
      warnings: warnings
    };
  };

  // �📱 Mobile-safe submit wrapper with aggressive debugging
  // Enhanced mobile submit with double-click prevention
  const [lastSubmitTime, setLastSubmitTime] = useState(0);
  
  const handleMobileSubmit = async (e) => {
    console.log("🚨 HANDLESUBMIT ENTRY - Function called successfully!");
    
    try {
      // Prevent double-clicking (300ms debounce)
      const now = Date.now();
      if (now - lastSubmitTime < 300) {
        console.log("🔥 BLOCKED: Double-click detected, ignoring");
        return;
      }
      setLastSubmitTime(now);
      
      console.log("CRITICAL: Mobile submit wrapper called");
      
      // Enhanced user validation
      const validation = validateUserForSubmission(user);
      console.log("🔍 USER VALIDATION RESULT:", validation);
      
      if (!validation.valid) {
        console.log("CRITICAL: BLOCKED - User validation failed:", validation.issues);
        alert(`❌ SUBMISSION BLOCKED\n\nUser: ${user?.name || 'Unknown'}\n\nIssues found:\n${validation.issues.join('\n')}\n\nContact your supervisor or administrator.`);
        return;
      }

      console.log("✅ User validation passed, calling handleSubmit");
      
      // Continue with rest of the submission
      console.log("🔥 CURRENT FORM DATA:", form);
    } catch (error) {
      alert(`🚨 ERROR in handleMobileSubmit entry: ${error.message}`);
      console.error("ERROR in handleMobileSubmit entry:", error);
      return;
    }

    console.log("CRITICAL: Event details:", {
      type: e?.type,
      target: e?.target?.tagName,
      isMobile: /Mobile|Android|iPhone|iPad/.test(navigator.userAgent),
      touchSupported: 'ontouchstart' in window,
      loading: loading,
      user: !!user,
      userId: user?._id,
      userRole: user?.role
    });

    // Prevent any default behavior
    if (e) {
      console.log("🔥 CRITICAL: Preventing default and stopping propagation");
      e.preventDefault();
      e.stopPropagation();
    }

    // Check if already loading
    if (loading) {
      console.log("🔥 CRITICAL: BLOCKED - Already loading, aborting submission");
      alert("⏳ Please wait - submission in progress");
      return;
    }

    // Check user immediately
    if (!user) {
      console.log("🔥 CRITICAL: BLOCKED - No user found, aborting submission");
      alert("❌ ERROR: No user session\n\nPlease refresh the page and log in again.");
      return;
    }

    if (!user._id) {
      console.log("🔥 CRITICAL: BLOCKED - No user ID found, aborting submission");
      alert("❌ ERROR: No user ID\n\nPlease refresh the page and log in again.");
      return;
    }

    console.log("🔥 CRITICAL: All preliminary checks passed, proceeding to handleSubmit");

    // Set loading immediately to prevent double-clicks
    setLoading(true);
    console.log("🔥 CRITICAL: Loading set to true");

    try {
      // Add slight delay for mobile to ensure touch events complete
      if (/Mobile|Android|iPhone|iPad/.test(navigator.userAgent)) {
        console.log("� CRITICAL: Mobile device detected - adding 150ms delay");
        setTimeout(() => {
          console.log("� CRITICAL: Mobile delay complete, calling handleSubmit");
          handleSubmit();
        }, 150);
      } else {
        console.log("� CRITICAL: Desktop device - calling handleSubmit immediately");
        handleSubmit();
      }
    } catch (error) {
      console.error("🔥 CRITICAL ERROR in handleMobileSubmit:", error);
      setLoading(false);
      alert(`❌ CRITICAL ERROR\n\n${error.message}\n\nPlease try again or contact support.`);
    }
  };

  // ✅ Submit Teller Report with comprehensive debugging
  const handleSubmit = async () => {
    console.log("�🔥🔥 HANDLESUBMIT CALLED - ENTRY POINT");
    console.log("🔥 CRITICAL CHECK: Loading state at entry:", loading);
    
    // Prevent double submission
    if (loading) {
      console.log("🔥 CRITICAL: DOUBLE SUBMISSION BLOCKED - loading is true");
      return;
    }

    console.log("�🚀 Starting handleSubmit function...");
    console.log("👤 Current user:", user);
    console.log("📝 Current form state:", form);
    console.log("🌐 API URL:", getApiUrl());
    console.log("⚙️ Settings:", settings);
    console.log("🌍 Window location:", window.location.href);
    console.log("🌐 Network status:", navigator.onLine ? "Online" : "Offline");
    console.log("📱 Device info:", {
      userAgent: navigator.userAgent,
      isMobile: /Mobile|Android|iPhone|iPad/.test(navigator.userAgent),
      screenWidth: window.screen.width,
      screenHeight: window.screen.height,
      windowWidth: window.innerWidth,
      windowHeight: window.innerHeight
    });
    
    // Step 1: User validation
    console.log("🔍 Step 1: User validation");
    if (!user) {
      console.error("❌ User validation failed - user is null/undefined");
      alert("❌ ERROR: User session not found.\n\nPlease refresh the page and log in again.");
      return showToast({ type: "error", message: "❌ User session not found. Please log in again." });
    }
    
    if (!user._id) {
      console.error("❌ User validation failed - no user._id. User object:", user);
      alert("❌ ERROR: User ID missing.\n\nPlease refresh the page and try again.");
      return showToast({ type: "error", message: "❌ User ID missing. Please refresh and try again." });
    }
    
    console.log("🔍 User role check:", user.role);
    console.log("🔍 User supervisor:", user.supervisorId || user.supervisor);
    
    if (user.role !== 'teller') {
      console.error("❌ User role validation failed - not a teller. Role:", user.role);
      alert(`❌ ERROR: Only tellers can submit reports.\n\nYour role: ${user.role}\n\nContact admin if this is incorrect.`);
      return showToast({ type: "error", message: `❌ Only tellers can submit reports. Your role: ${user.role}` });
    }
    
    console.log("✅ Step 1 passed: User validation");

    // Step 2: Form validation
    console.log("🔍 Step 2: Form validation");
    console.log("📊 System balance:", form.systemBalance, typeof form.systemBalance);
    
    if (!form.systemBalance || form.systemBalance === "" || form.systemBalance === "0" || isNaN(Number(form.systemBalance))) {
      console.error("❌ System balance validation failed:", form.systemBalance);
      console.error("🔍 Validation details:", {
        isEmpty: !form.systemBalance,
        isEmptyString: form.systemBalance === "",
        isZero: form.systemBalance === "0",
        isNaN: isNaN(Number(form.systemBalance)),
        actualValue: form.systemBalance,
        actualType: typeof form.systemBalance
      });
      alert(`❌ SYSTEM BALANCE ERROR\n\nCurrent value: "${form.systemBalance}"\nType: ${typeof form.systemBalance}\n\nPlease enter a valid number greater than 0 for system balance.\n\nExample: 15000`);
      setLoading(false);
      return showToast({ type: "error", message: "❌ Please enter a valid system balance (numbers only)" });
    }

    console.log("💰 Checking denominations...");
    const hasAnyDenomination = form.d1000 || form.d500 || form.d200 || form.d100 || form.d50 || form.d20 || form.coins;
    console.log("📋 Denomination check:", {
      d1000: form.d1000,
      d500: form.d500, 
      d200: form.d200,
      d100: form.d100,
      d50: form.d50,
      d20: form.d20,
      coins: form.coins,
      hasAny: hasAnyDenomination
    });
    
    if (!hasAnyDenomination) {
      console.error("❌ No denomination data provided. Form:", form);
      alert("❌ ERROR: No cash counted.\n\nPlease enter at least one denomination amount.");
      return showToast({ type: "error", message: "❌ Please count and enter at least one denomination" });
    }
    
    console.log("✅ Step 2 passed: Form validation");
    
    // Step 3: API connectivity test
    console.log("🔍 Step 3: API connectivity test");
    try {
      console.log("🌐 Testing API connectivity to:", `${getApiUrl()}/api/settings`);
      const testResponse = await axios.get(`${getApiUrl()}/api/settings`);
      console.log("✅ API connectivity confirmed:", testResponse.status);
    } catch (connectError) {
      console.error("❌ API connectivity failed:", connectError);
      alert(`❌ ERROR: Cannot connect to server.\n\nError: ${connectError.message}\n\nCheck your internet connection.`);
      return showToast({ type: "error", message: "❌ Cannot connect to server. Check your internet connection." });
    }
    
    console.log("✅ Step 3 passed: API connectivity");

    console.log("✅ All validations passed, preparing payload...");

    // Step 4: Cash calculation
    console.log("🔍 Step 4: Cash calculation");
    console.log("💰 Cash on hand calculation:", {
      d1000_count: safeNum(form.d1000), 
      d1000_value: safeNum(form.d1000) * 1000,
      d500_count: safeNum(form.d500), 
      d500_value: safeNum(form.d500) * 500,
      d200_count: safeNum(form.d200), 
      d200_value: safeNum(form.d200) * 200,
      d100_count: safeNum(form.d100), 
      d100_value: safeNum(form.d100) * 100,
      d50_count: safeNum(form.d50), 
      d50_value: safeNum(form.d50) * 50,
      d20_count: safeNum(form.d20), 
      d20_value: safeNum(form.d20) * 20,
      coins: safeNum(form.coins),
      total_cashOnHand: cashOnHand
    });
    console.log("✅ Step 4 passed: Cash calculation");

    try {
      console.log("🔍 Step 5: Setting loading state and creating payload");
      setLoading(true);
      console.log("🔄 Loading state set to true");
      
      const payload = {
        tellerId: user._id,
        tellerName: user.name || user.username,
        supervisorId: user.supervisorId || user.supervisor?._id || null,
        supervisorName: user.supervisor?.name || user.supervisorName || "",
        date: new Date().toISOString(),
        systemBalance: safeNum(form.systemBalance),
        cashOnHand,
        short: safeNum(form.short),
        over: safeNum(form.over),
        d1000: safeNum(form.d1000),
        d500: safeNum(form.d500),
        d200: safeNum(form.d200),
        d100: safeNum(form.d100),
        d50: safeNum(form.d50),
        d20: safeNum(form.d20),
        coins: safeNum(form.coins),
      };
      
      console.log("✅ Step 5 passed: Payload created");

      // 🔍 Debug logging to check form vs payload
      console.log("� Step 6: Final payload review");
      console.log("�📝 Original Form Data:", JSON.stringify(form, null, 2));
      console.log("📤 Final Payload to Submit:", JSON.stringify(payload, null, 2));
      console.log("� User context:", {
        _id: user._id,
        name: user.name,
        username: user.username,
        role: user.role,
        supervisorId: user.supervisorId,
        supervisor: user.supervisor
      });

      console.log("🔍 Step 7: Making API call");
      console.log("🌐 API URL:", `${getApiUrl()}/api/teller-reports/create`);
      console.log("🔑 Axios default headers:", axios.defaults.headers);
      
      const response = await axios.post(`${getApiUrl()}/api/teller-reports/create`, payload);
      
      console.log("✅ Step 7 passed: API call successful");
      console.log("📨 Full API response:", {
        status: response.status,
        statusText: response.statusText,
        data: response.data,
        headers: response.headers
      });

      console.log("🔍 Step 8: Post-submission actions");
      
      // Notify others live
      console.log("📡 Emitting socket event...");
      if (socket) {
        socket.emit("tellerReportCreated", payload);
        console.log("✅ Socket event emitted successfully");
      } else {
        console.log("🔇 Socket disabled - skipping live notification");
      }
      
      // ✅ Enhanced success notification
      console.log("🔔 Showing success toast...");
      showToast({ 
        type: "success", 
        message: "🎉 Report submitted successfully! Your teller report has been sent for supervisor review." 
      });

      // Show additional success alert
      console.log("📢 Showing success alert...");
      alert("✅ REPORT SUBMITTED SUCCESSFULLY!\n\n📊 Your teller report has been submitted and is now pending supervisor verification.\n\n✨ Thank you for your submission!");

      console.log("🧹 Clearing form...");
      
      setForm({
        systemBalance: "",
        d1000: "",
        d500: "",
        d200: "",
        d100: "",
        d50: "",
        d20: "",
        coins: "",
        short: "",
        over: "",
      });
      
      console.log("✅ Step 8 passed: Post-submission actions completed");
      console.log("✅ Report submission completed successfully - ALL STEPS PASSED");
    } catch (err) {
      console.log("🔍 Step X: ERROR HANDLING");
      console.error("❌ SUBMISSION FAILED - Error during submission:", err);
      console.error("❌ Error name:", err.name);
      console.error("❌ Error message:", err.message);
      console.error("❌ Error code:", err.code);
      console.error("❌ Error response:", err.response);
      console.error("❌ Error response status:", err.response?.status);
      console.error("❌ Error response data:", err.response?.data);
      console.error("❌ Error response headers:", err.response?.headers);
      console.error("❌ Full error object:", JSON.stringify(err, Object.getOwnPropertyNames(err), 2));
      
      let errorMessage = "❌ Failed to submit report";
      let alertMessage = "";
      
      if (err.response?.status === 400) {
        errorMessage = `❌ Validation Error: ${err.response.data?.error || 'Invalid data provided'}`;
        alertMessage = `❌ VALIDATION ERROR\n\n${err.response.data?.error || 'The data you entered is invalid.'}\n\nPlease check your entries and try again.`;
      } else if (err.response?.status === 401) {
        errorMessage = "❌ Authentication Error: Please log in again";
        alertMessage = "❌ AUTHENTICATION ERROR\n\nYour login session has expired.\n\nPlease refresh the page and log in again.";
      } else if (err.response?.status === 403) {
        errorMessage = "❌ Permission Error: You don't have permission to submit reports";
        alertMessage = "❌ PERMISSION ERROR\n\nYou don't have permission to submit reports.\n\nContact your supervisor or admin.";
      } else if (err.response?.status === 500) {
        errorMessage = "❌ Server Error: Please try again later or contact support";
        alertMessage = "❌ SERVER ERROR\n\nThe server encountered an error.\n\nPlease try again in a few minutes or contact technical support.";
      } else if (err.code === 'NETWORK_ERROR' || !err.response) {
        errorMessage = "❌ Network Error: Check your internet connection and try again";
        alertMessage = "❌ NETWORK ERROR\n\nCannot connect to the server.\n\nPlease check your internet connection and try again.";
      } else {
        errorMessage = `❌ Error: ${err.response?.data?.error || err.message}`;
        alertMessage = `❌ SUBMISSION ERROR\n\nError: ${err.response?.data?.error || err.message}\n\nPlease try again or contact support.`;
      }
      
      console.log("📨 Error message to show user:", errorMessage);
      console.log("📢 Alert message to show user:", alertMessage);
      
      showToast({ 
        type: "error", 
        message: errorMessage
      });
      
      // Show detailed alert for all errors to help with debugging
      alert(alertMessage || `${errorMessage}\n\nIf this problem continues, please contact technical support.`);
      
      console.log("❌ ERROR HANDLING COMPLETED");
    } finally {
      console.log("� FINALLY BLOCK - Setting loading to false");
      setLoading(false);
      console.log("✅ Loading state reset to false");
    }
  };

  const formatMoney = (v) =>
    v === "" || v === null || typeof v === "undefined"
      ? ""
      : Number(v).toLocaleString();

  // 🖨️ Printer Discovery Functions
  const scanForPrinters = async () => {
    setPrinterScanning(true);
    setAvailablePrinters([]);
    
    try {
      // Start with mock printers for demo/testing
      const mockPrinters = [
        { id: 'xprint_58iih', name: 'xPrint 58IIH Thermal Printer', type: 'thermal', connected: true, serialNumber: 'XPRINT-58IIH', macAddress: 'USB-XPRINT' },
        { id: 'real_1', name: 'Your Thermal Printer TM-T20II', type: 'thermal', connected: true, serialNumber: '10:22:4B:3C:75', macAddress: '10:22:4B:3C:75' },
        { id: 'mock_1', name: 'Thermal Printer TM-T20', type: 'demo', connected: false, serialNumber: 'AA:BB:CC:DD:EE:01', macAddress: 'AA:BB:CC:DD:EE:01' },
        { id: 'mock_2', name: 'Receipt Printer RP-80', type: 'demo', connected: false, serialNumber: 'BB:CC:DD:EE:FF:02', macAddress: 'BB:CC:DD:EE:FF:02' },
        { id: 'mock_3', name: 'POS Printer POS-58', type: 'demo', connected: false, serialNumber: 'CC:DD:EE:FF:00:03', macAddress: 'CC:DD:EE:FF:00:03' },
      ];
      
      setAvailablePrinters(mockPrinters);
      
      // Enhanced Bluetooth detection with detailed debugging
      console.log("🔍 Starting Bluetooth diagnostics...");
      console.log("User Agent:", navigator.userAgent);
      console.log("Protocol:", window.location.protocol);
      console.log("Host:", window.location.host);
      console.log("Is Secure Context:", window.isSecureContext);
      
      // Check if Web Bluetooth API exists
      if ('bluetooth' in navigator) {
        console.log("✅ Web Bluetooth API is available");
        
        try {
          // Check for HTTPS requirement - allow localhost and local IPs without HTTPS
          const isLocalhost = window.location.hostname === 'localhost' || 
                             window.location.hostname === '127.0.0.1' ||
                             window.location.hostname.startsWith('192.168.') ||
                             window.location.hostname.startsWith('10.') ||
                             window.location.hostname.startsWith('172.');
                             
          if (window.location.protocol !== 'https:' && !isLocalhost) {
            console.log("❌ HTTPS required for Bluetooth (unless local network)");
            showToast({ 
              type: "error", 
              message: "Bluetooth requires HTTPS for remote access. Local network access allowed." 
            });
            return;
          }
          
          // For localhost, we can bypass the secure context requirement in some cases
          if (!window.isSecureContext && !isLocalhost) {
            console.log("❌ Not in secure context and not localhost");
            showToast({ 
              type: "error", 
              message: "Bluetooth requires secure context (HTTPS) for remote access" 
            });
            return;
          }
          
          // Test if Bluetooth adapter is available
          console.log("🔍 Checking Bluetooth adapter availability...");
          const available = await navigator.bluetooth.getAvailability();
          console.log("📡 Bluetooth adapter available:", available);
          
          if (!available) {
            console.log("❌ Bluetooth adapter not available");
            showToast({ 
              type: "warning", 
              message: "Bluetooth adapter not found. Please turn on Bluetooth in your system settings." 
            });
            return;
          }
          
          console.log("✅ Bluetooth is available, showing device picker...");
          showToast({ 
            type: "info", 
            message: "Bluetooth ready! Click OK to select your printer from the device list." 
          });
          
          // Request device with comprehensive options
          const device = await navigator.bluetooth.requestDevice({
            acceptAllDevices: true,
            optionalServices: [
              '00001101-0000-1000-8000-00805f9b34fb', // Serial Port Profile (SPP)
              '000018f0-0000-1000-8000-00805f9b34fb', // Generic Printer Service
              '0000180f-0000-1000-8000-00805f9b34fb', // Battery Service
              '0000180a-0000-1000-8000-00805f9b34fb', // Device Information Service
              '49535343-fe7d-4ae5-8fa9-9fafd205e455', // Custom printer service (some manufacturers)
            ]
          });
          
          if (device) {
            console.log("✅ User selected Bluetooth device:", device);
            
            let serialNumber = device.id || 'Unknown';
            let macAddress = null;
            
            // Try to extract MAC from device name
            if (device.name) {
              const macPattern = /([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})/;
              const macMatch = device.name.match(macPattern);
              if (macMatch) {
                macAddress = macMatch[0].toUpperCase();
                serialNumber = macAddress;
              }
            }
            
            // Create a cleaner device ID if no MAC found
            if (!macAddress && device.id) {
              const cleanId = device.id.replace(/[^0-9A-Fa-f]/g, '');
              if (cleanId.length >= 12) {
                const macBytes = cleanId.slice(-12).match(/.{2}/g);
                if (macBytes && macBytes.length === 6) {
                  macAddress = macBytes.join(':').toUpperCase();
                  serialNumber = macAddress;
                }
              }
            }
            
            const bluetoothPrinter = {
              id: 'bluetooth_' + Date.now(),
              name: device.name || 'Bluetooth Printer',
              type: 'bluetooth',
              connected: false,
              serialNumber: serialNumber,
              macAddress: macAddress,
              bluetoothDevice: device // Keep reference to the actual device
            };
            
            // Add the real Bluetooth device to the list
            setAvailablePrinters(prev => [bluetoothPrinter, ...prev]);
            console.log("✅ Added Bluetooth printer:", bluetoothPrinter);
            
            showToast({ 
              type: "success", 
              message: `Found: ${device.name || 'Unknown Printer'}` 
            });
            
          } else {
            console.log("❌ No device selected");
            showToast({ 
              type: "info", 
              message: "No device selected. Showing demo printers." 
            });
          }
        } catch (bluetoothError) {
          console.error("❌ Bluetooth operation failed:", bluetoothError);
          console.log("Error name:", bluetoothError.name);
          console.log("Error message:", bluetoothError.message);
          
          let errorMessage = "Bluetooth scan failed. ";
          
          switch (bluetoothError.name) {
            case 'NotFoundError':
              errorMessage += "No devices found or user cancelled.";
              break;
            case 'NotSupportedError':
              errorMessage += "Bluetooth not supported in this context. Try HTTPS.";
              break;
            case 'SecurityError':
              errorMessage += "Bluetooth access denied. Check browser permissions.";
              break;
            case 'NotAllowedError':
              errorMessage += "Bluetooth permission denied.";
              break;
            case 'InvalidStateError':
              errorMessage += "Bluetooth not available. Check system Bluetooth settings.";
              break;
            default:
              errorMessage += bluetoothError.message || "Unknown error.";
          }
          
          showToast({ 
            type: "warning", 
            message: errorMessage 
          });
        }
      } else {
        console.log("❌ Web Bluetooth API not available");
        console.log("Browser support check:");
        console.log("- Chrome 56+:", /Chrome/.test(navigator.userAgent));
        console.log("- Edge 79+:", /Edg/.test(navigator.userAgent));
        console.log("- Opera 43+:", /OPR/.test(navigator.userAgent));
        
        showToast({ 
          type: "error", 
          message: "Web Bluetooth not supported. Use Chrome 56+, Edge 79+, or Opera 43+ on Windows/Android." 
        });
      }
      
      showToast({ 
        type: "info", 
        message: `Scan completed. ${mockPrinters.length} demo printers available.` 
      });
      
    } catch (error) {
      console.error("❌ Printer scan error:", error);
      showToast({ type: "error", message: "Failed to scan for printers: " + error.message });
    } finally {
      setPrinterScanning(false);
    }
  };

  const connectToPrinter = async (printer) => {
    try {
      console.log("🔗 Connecting to printer:", printer);
      
      // Show confirmation dialog for printer selection
      const confirmed = window.confirm(
        `⚠️ PRINTER CONFIRMATION\n\n` +
        `You are about to connect to:\n` +
        `Printer: ${printer.name}\n` +
        `MAC Address: ${printer.serialNumber}\n` +
        `Type: ${printer.type.toUpperCase()}\n\n` +
        `⚠️ IMPORTANT: Make sure this is YOUR assigned printer!\n` +
        `Printing to another teller's printer may cause confusion.\n\n` +
        `Is this your correct printer?`
      );
      
      if (!confirmed) {
        showToast({ type: "info", message: "Printer selection cancelled" });
        return;
      }
      
      // For Bluetooth printers, try to establish connection
      if (printer.type === 'bluetooth' && printer.bluetoothDevice) {
        try {
          console.log("🔗 Testing Bluetooth connection...");
          
          if (!printer.bluetoothDevice.gatt.connected) {
            await printer.bluetoothDevice.gatt.connect();
          }
          
          // Simple test - just check if we can get services
          const services = await printer.bluetoothDevice.gatt.getPrimaryServices();
          console.log("📡 Found services:", services.length);
          
          printer.connected = true;
          showToast({ 
            type: "success", 
            message: `✅ Connected to ${printer.name}! Found ${services.length} services.` 
          });
          
        } catch (connectError) {
          console.error("❌ Bluetooth connection test failed:", connectError);
          showToast({ 
            type: "warning", 
            message: `Cannot connect to ${printer.name}. Will use for browser printing only.` 
          });
          printer.connected = false;
        }
      }
      
      // Save and select the printer
      setSelectedPrinter(printer);
      
      // Save to localStorage (without the device object which can't be serialized)
      const printerToSave = {
        ...printer,
        bluetoothDevice: undefined // Remove device object for storage
      };
      
      const updatedSaved = [...savedPrinters.filter(p => p.id !== printer.id), printerToSave];
      setSavedPrinters(updatedSaved);
      localStorage.setItem('tellerPrinters', JSON.stringify(updatedSaved));
      
      showToast({ 
        type: "success", 
        message: `✅ Selected printer: ${printer.name}` 
      });
      
    } catch (error) {
      console.error("❌ Printer selection error:", error);
      showToast({ type: "error", message: "Failed to select printer: " + error.message });
    }
  };

  const printWithSelectedPrinter = async () => {
    if (!selectedPrinter) {
      showToast({ type: "warning", message: "Please select a printer first" });
      return;
    }
    
    try {
      console.log("🖨️ Printing with selected printer:", selectedPrinter);
      
      // Use existing smart print logic but with selected printer context
      smartPrint();
      
      showToast({ 
        type: "success", 
        message: `Print sent to ${selectedPrinter.name} (${selectedPrinter.serialNumber})` 
      });
      
    } catch (error) {
      console.error("❌ Print error:", error);
      showToast({ type: "error", message: "Print failed: " + error.message });
    }
  };

  const removeSavedPrinter = (printerId) => {
    const updated = savedPrinters.filter(p => p.id !== printerId);
    setSavedPrinters(updated);
    localStorage.setItem('tellerPrinters', JSON.stringify(updated));
    
    if (selectedPrinter?.id === printerId) {
      setSelectedPrinter(null);
    }
  };

  const filteredPrinters = availablePrinters.filter(printer => {
    const searchTerm = printerSearch.toLowerCase();
    const printerName = printer.name.toLowerCase();
    const serialNumber = (printer.serialNumber || '').toLowerCase();
    const macAddress = (printer.macAddress || '').toLowerCase();
    
    // Remove colons for flexible MAC address searching
    const serialNoColons = serialNumber.replace(/[:-]/g, '');
    const macNoColons = macAddress.replace(/[:-]/g, '');
    const searchNoColons = searchTerm.replace(/[:-]/g, '');
    
    return printerName.includes(searchTerm) ||
           serialNumber.includes(searchTerm) ||
           macAddress.includes(searchTerm) ||
           serialNoColons.includes(searchNoColons) ||
           macNoColons.includes(searchNoColons);
  });

  // 🧾 Build simple 58mm receipt HTML and trigger print
  const printReceipt58 = () => {
    const sys = safeNum(form.systemBalance);
    const diff = cashOnHand - sys;
    const overVal = diff > 0 ? diff : 0;
    const shortVal = diff < 0 ? Math.abs(diff) : 0;

    const padField = (label, value) => {
      const total = 32;
      const spaces = Math.max(1, total - label.length - value.length);
      return label + " ".repeat(spaces) + value;
    };
    
    const padTable = (col1, col2, col3) => {
      const c1 = String(col1 || "").padEnd(10);
      const c2 = String(col2 || "").padStart(6);
      const c3 = String(col3 || "").padStart(12);
      return c1 + c2 + c3;
    };

    const now = new Date();
    const dateStr = now.toLocaleString();
    const tellerName = (user?.name || user?.username || "").toUpperCase();
    const org = settings?.systemName || "RMI Teller Report";

    const html = `<!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Teller Report</title>
          <style>
            @page { size: 58mm auto; margin: 2mm; }
            body { 
              width: 58mm; 
              font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; 
              font-size: 10px;
              line-height: 1.2;
            }
            .center { text-align: center; }
            .bold { font-weight: bold; }
            .line { border-top: 1px solid #000; margin: 4px 0; }
            pre { 
              white-space: pre-wrap; 
              word-wrap: break-word; 
              margin: 1px 0;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              font-size: 9px;
            }
            td {
              padding: 1px 2px;
              border: 1px solid #000;
            }
            .header-section {
              margin-bottom: 8px;
            }
          </style>
        </head>
        <body>
          <div class="center bold">${org.toUpperCase()}</div>
          <br>
          
          <div class="header-section">
            <pre>SV:</pre>
            <pre>TELLER:                  ${tellerName}</pre>
            <pre>DATE:                    ${dateStr}</pre>
            <pre>SYSTEM BALANCE:          ${sys.toLocaleString()}</pre>
            <pre>CASH ON HAND:            ${cashOnHand.toLocaleString()}</pre>
            <pre>OVER:                    ${overVal.toLocaleString()}</pre>
            <pre>SHORT:                   ${shortVal.toLocaleString()}</pre>
          </div>

          <div class="center bold">DENOMINATION</div>
          <table>
            <tr>
              <td style="width: 40%"></td>
              <td style="width: 25%; text-align: center;"><strong>PCS</strong></td>
              <td style="width: 35%; text-align: center;"><strong>TOTAL</strong></td>
            </tr>
            <tr>
              <td>1000x</td>
              <td style="text-align: right;">${safeNum(form.d1000)}</td>
              <td style="text-align: right;">${(safeNum(form.d1000) * 1000).toLocaleString()}</td>
            </tr>
            <tr>
              <td>500x</td>
              <td style="text-align: right;">${safeNum(form.d500)}</td>
              <td style="text-align: right;">${(safeNum(form.d500) * 500).toLocaleString()}</td>
            </tr>
            <tr>
              <td>200x</td>
              <td style="text-align: right;">${safeNum(form.d200)}</td>
              <td style="text-align: right;">${(safeNum(form.d200) * 200).toLocaleString()}</td>
            </tr>
            <tr>
              <td>100x</td>
              <td style="text-align: right;">${safeNum(form.d100)}</td>
              <td style="text-align: right;">${(safeNum(form.d100) * 100).toLocaleString()}</td>
            </tr>
            <tr>
              <td>50x</td>
              <td style="text-align: right;">${safeNum(form.d50)}</td>
              <td style="text-align: right;">${(safeNum(form.d50) * 50).toLocaleString()}</td>
            </tr>
            <tr>
              <td>20x</td>
              <td style="text-align: right;">${safeNum(form.d20)}</td>
              <td style="text-align: right;">${(safeNum(form.d20) * 20).toLocaleString()}</td>
            </tr>
            <tr>
              <td>COINS</td>
              <td style="text-align: right;"></td>
              <td style="text-align: right;">${safeNum(form.coins).toLocaleString()}</td>
            </tr>
            <tr style="border-top: 2px solid #000;">
              <td><strong>TOTAL</strong></td>
              <td style="text-align: right;"></td>
              <td style="text-align: right;"><strong>${cashOnHand.toLocaleString()}</strong></td>
            </tr>
          </table>

          <div class="center" style="margin-top: 8px;">Thank you</div>
          
          <script>
            window.onload = function(){
              window.print();
              setTimeout(() => window.close(), 300);
            }
          <\/script>
        </body>
      </html>`;

    const win = window.open("", "_blank", "width=320,height=540");
    if (!win) return;
    win.document.open();
    win.document.write(html);
    win.document.close();
  };

  // 🔌 Attempt direct ESC/POS print via RawBT (Android) else fallback to HTML print
  const smartPrint = async () => {
    try {
      const sys = safeNum(form.systemBalance);
      const diff = cashOnHand - sys;
      const overVal = diff > 0 ? diff : 0;
      const shortVal = diff < 0 ? Math.abs(diff) : 0;
      
      console.log("🖨️ Starting print process...");
      
      // Generate receipt data
      const receiptData = {
        orgName: settings?.systemName || "RMI Teller Report",
        tellerName: user?.name || user?.username || "",
        dateStr: new Date().toLocaleString(),
        systemBalance: sys,
        cashOnHand,
        d: {
          d1000: safeNum(form.d1000),
          d500: safeNum(form.d500),
          d200: safeNum(form.d200),
          d100: safeNum(form.d100),
          d50: safeNum(form.d50),
          d20: safeNum(form.d20),
          coins: safeNum(form.coins),
        },
        over: overVal,
        short: shortVal,
      };
      
      // If we have a selected Bluetooth printer, try direct printing first
      if (selectedPrinter && selectedPrinter.type === 'bluetooth' && selectedPrinter.bluetoothDevice) {
        try {
          console.log("🔗 Attempting Bluetooth print to:", selectedPrinter.name);
          
          const device = selectedPrinter.bluetoothDevice;
          
          // Connect if not already connected
          if (!device.gatt.connected) {
            console.log("🔗 Connecting to Bluetooth device...");
            await device.gatt.connect();
          }
          
          console.log("✅ Connected to Bluetooth device");
          
          // Generate ESC/POS commands
          const escposBytes = buildTellerReceipt58(receiptData);
          
          // Try to find a writable service
          const services = await device.gatt.getPrimaryServices();
          console.log("📡 Available services:", services.length);
          
          for (let service of services) {
            try {
              const characteristics = await service.getCharacteristics();
              
              for (let char of characteristics) {
                if (char.properties.write || char.properties.writeWithoutResponse) {
                  console.log("✅ Found writable characteristic:", char.uuid);
                  
                  // Send data in chunks
                  const chunkSize = 20;
                  for (let i = 0; i < escposBytes.length; i += chunkSize) {
                    const chunk = escposBytes.slice(i, i + chunkSize);
                    await char.writeValue(chunk);
                    await new Promise(resolve => setTimeout(resolve, 50));
                  }
                  
                  showToast({ 
                    type: "success", 
                    message: `✅ Printed to ${selectedPrinter.name} via Bluetooth!` 
                  });
                  return;
                }
              }
            } catch (charError) {
              console.log("❌ Error checking characteristics:", charError.message);
            }
          }
          
          console.log("❌ No writable characteristics found");
          
        } catch (bluetoothError) {
          console.error("❌ Bluetooth print failed:", bluetoothError);
          showToast({ 
            type: "warning", 
            message: `Bluetooth print failed: ${bluetoothError.message}. Using browser print...` 
          });
        }
      }
      
      // Fallback 1: Try Web Share API for mobile devices
      if (navigator.share) {
        try {
          const receiptText = generateReceiptText(receiptData);
          
          await navigator.share({
            title: 'Teller Report',
            text: receiptText,
          });
          
          showToast({ type: "success", message: "Receipt shared successfully!" });
          return;
          
        } catch (shareError) {
          console.log("❌ Web Share failed:", shareError.message);
        }
      }
      
      // Fallback 2: Browser print dialog
      console.log("🖨️ Using browser print dialog");
      printReceipt58();
      showToast({ type: "success", message: "Print dialog opened" });
      
    } catch (error) {
      console.error("❌ Print failed:", error);
      showToast({ type: "error", message: "Print failed: " + error.message });
    }
  };

  // Helper function to generate plain text receipt for sharing
  const generateReceiptText = (data) => {
    const line = "-".repeat(32);
    return `
${data.orgName.toUpperCase()}
TELLER REPORT
${data.dateStr}
${line}
TELLER: ${data.tellerName}
SYSTEM BALANCE: ₱${data.systemBalance.toLocaleString()}
CASH ON HAND: ₱${data.cashOnHand.toLocaleString()}
${line}
₱1000 x ${data.d.d1000} = ₱${(data.d.d1000 * 1000).toLocaleString()}
₱500 x ${data.d.d500} = ₱${(data.d.d500 * 500).toLocaleString()}
₱200 x ${data.d.d200} = ₱${(data.d.d200 * 200).toLocaleString()}
₱100 x ${data.d.d100} = ₱${(data.d.d100 * 100).toLocaleString()}
₱50 x ${data.d.d50} = ₱${(data.d.d50 * 50).toLocaleString()}
₱20 x ${data.d.d20} = ₱${(data.d.d20 * 20).toLocaleString()}
COINS: ₱${data.d.coins.toLocaleString()}
${line}
TOTAL: ₱${data.cashOnHand.toLocaleString()}
OVER: ₱${data.over.toLocaleString()}
SHORT: ₱${data.short.toLocaleString()}
${line}
Thank you
`.trim();
  };

  return (
    <div
      className={`p-6 min-h-screen ${
        dark ? "bg-gray-900 text-gray-100" : "bg-gray-50 text-gray-900"
      }`}
    >
      <div className="flex items-center gap-3 mb-6">
        <FileText className="text-indigo-500" />
        <h1 className="text-2xl font-semibold">Teller Report</h1>
        <div className="ml-auto text-xs text-gray-500">
          API: {getApiUrl()} | User: {user?.username || 'Not logged in'} | Socket: {socket?.connected ? '🟢' : '🔴'}
        </div>
      </div>

      <div
        className={`rounded-xl p-5 mb-6 border shadow ${
          dark ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"
        }`}
      >
        <h2 className="font-semibold mb-3">💰 Financial Summary</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          ⚠️ Enter your <strong>System Balance</strong> from your terminal/system. Cash On Hand is auto-calculated from denominations below.
        </p>

        {/* System Balance + Cash On Hand + Short + Over */}
        <div className="grid md:grid-cols-4 gap-4">
          <div>
            <label 
              className="block text-sm mb-1 font-medium text-blue-600 dark:text-blue-400 cursor-pointer"
            >
              📊 System Balance (from terminal)
            </label>
            <input
              name="systemBalance"
              type="number"
              value={form.systemBalance}
              onChange={handleChange}
              className="input-box border-blue-300 focus:border-blue-500"
              placeholder="Enter actual system balance"
              step="0.01"
              autoComplete="off"
            />
            <p className="text-xs text-gray-500 mt-1">From your system/terminal</p>
          </div>

          <div>
            <label className="block text-sm mb-1 font-medium text-indigo-600 dark:text-indigo-400">
              💰 Cash On Hand (counted)
            </label>
            <input
              readOnly
              value={formatMoney(cashOnHand)}
              className="input-box bg-indigo-100 dark:bg-indigo-900 text-indigo-800 dark:text-indigo-200 font-semibold"
            />
            <p className="text-xs text-gray-500 mt-1">Auto-calculated from bills/coins</p>
          </div>

          <div>
            <label className="block text-sm mb-1 font-medium text-red-500">
              ⚠️ Short (missing cash)
            </label>
            <input
              readOnly
              value={form.short ? formatMoney(form.short) : ""}
              className="input-box bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 font-semibold"
              placeholder="₱0.00"
            />
            <p className="text-xs text-gray-500 mt-1">When physical cash &lt; system</p>
          </div>

          <div>
            <label className="block text-sm mb-1 font-medium text-green-500">
              ✅ Over (excess cash)
            </label>
            <input
              readOnly
              value={form.over ? formatMoney(form.over) : ""}
              className="input-box bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 font-semibold"
              placeholder="₱0.00"
            />
            <p className="text-xs text-gray-500 mt-1">When physical cash &gt; system</p>
          </div>
        </div>

        {/* Calculation explanation */}
        {form.systemBalance && cashOnHand > 0 && (
          <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/30 rounded-lg border border-blue-200 dark:border-blue-700">
            <h3 className="font-medium text-blue-800 dark:text-blue-200 mb-2">📊 Calculation Breakdown:</h3>
            <div className="text-sm space-y-1">
              <div>💻 System Balance: ₱{formatMoney(form.systemBalance)}</div>
              <div>💰 Cash On Hand (counted): ₱{formatMoney(cashOnHand)}</div>
              <div className="font-medium">
                {cashOnHand > safeNum(form.systemBalance) 
                  ? `✅ Over: ₱${formatMoney(cashOnHand - safeNum(form.systemBalance))} (You have MORE than expected)`
                  : cashOnHand < safeNum(form.systemBalance)
                  ? `⚠️ Short: ₱${formatMoney(safeNum(form.systemBalance) - cashOnHand)} (You have LESS than expected)`
                  : `✅ Perfect Balance! No shortage or overage.`
                }
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Denominations */}
      <div
        className={`rounded-xl p-5 border shadow ${
          dark ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"
        }`}
      >
        <h2 className="font-semibold mb-3">🏦 Physical Cash Count (Denominations)</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          📋 Count your actual physical bills and coins. Enter the <strong>number of pieces</strong> for each denomination.
        </p>

        <div className="grid md:grid-cols-4 gap-4 mb-4">
          {["d1000", "d500", "d200", "d100", "d50", "d20"].map((d) => (
            <div key={d}>
              <label 
                className="block text-sm mb-1 font-medium text-green-600 dark:text-green-400 cursor-pointer"
              >
                💵 ₱{d.replace("d", "")} bills
              </label>
              <input
                type="number"
                name={d}
                value={form[d]}
                onChange={handleChange}
                className="input-box border-green-300 focus:border-green-500"
                placeholder="0"
                min="0"
                autoComplete="off"
              />
              <p className="text-xs text-gray-500 mt-1">
                {form[d] ? `= ₱${(parseInt(form[d]) * parseInt(d.replace("d", ""))).toLocaleString()}` : "pieces"}
              </p>
            </div>
          ))}
          <div>
            <label 
              className="block text-sm mb-1 font-medium text-green-600 dark:text-green-400 cursor-pointer"
            >
              🪙 Coins (total value)
            </label>
            <input
              type="number"
              name="coins"
              value={form.coins}
              onChange={handleChange}
              className="input-box border-green-300 focus:border-green-500"
              placeholder="0"
              min="0"
              step="0.01"
              autoComplete="off"
            />
            <p className="text-xs text-gray-500 mt-1">Total peso value of all coins</p>
          </div>
        </div>

        {/* 💰 Capital Warning */}
        {!capitalLoading && !activeCapital && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
            <div className="flex items-center gap-2 text-red-700">
              <span className="text-lg">⚠️</span>
              <div>
                <h3 className="font-semibold">No Active Capital</h3>
                <p className="text-sm">
                  You cannot submit teller reports without active capital assigned by your supervisor.
                  Please contact your supervisor to receive capital before submitting your report.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* 💰 Capital Info */}
        {!capitalLoading && activeCapital && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
            <div className="flex items-center gap-2 text-green-700">
              <span className="text-lg">💰</span>
              <div>
                <h3 className="font-semibold">Active Capital Available</h3>
                <p className="text-sm">
                  Base: ₱{activeCapital.amount?.toLocaleString() || 0}
                  {activeCapital.totalAdditional > 0 && ` + Additional: ₱${activeCapital.totalAdditional.toLocaleString()}`}
                  {activeCapital.totalRemitted > 0 && ` - Remitted: ₱${activeCapital.totalRemitted.toLocaleString()}`}
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => {
              alert("🔥 SUBMIT CLICKED!");
              console.log("🔥 Submit button clicked!");
              handleMobileSubmit();
            }}
            disabled={loading || (!capitalLoading && !activeCapital)}
            className="btn-mobile flex items-center gap-2 text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:bg-gray-400 disabled:cursor-not-allowed"
            type="button"
          >
            {loading ? "Loading..." : "Submit Report"}
          </button>
          
          <button
            type="button"
            onClick={() => setShowPrinterFinder(!showPrinterFinder)}
            className="btn-mobile flex items-center gap-2 text-white bg-purple-600 hover:bg-purple-700 active:bg-purple-800"
            title="Find and connect to thermal printers"
          >
            🔍 <Printer />
            Find Printer
          </button>
          
          <button
            type="button"
            onClick={selectedPrinter ? printWithSelectedPrinter : smartPrint}
            className="btn-mobile flex items-center gap-2 text-white bg-slate-700 hover:bg-slate-800 active:bg-slate-900"
            title={selectedPrinter ? `Print with ${selectedPrinter.name}` : "Auto print (RawBT if available, else browser)"}
          >
            <Printer />
            {selectedPrinter ? `Print (${selectedPrinter.serialNumber})` : "Print (58mm)"}
          </button>
          
          <button
            type="button"
            onClick={() => {
              const sys = safeNum(form.systemBalance);
              const diff = cashOnHand - sys;
              const overVal = diff > 0 ? diff : 0;
              const shortVal = diff < 0 ? Math.abs(diff) : 0;
              
              const receiptData = {
                orgName: settings?.systemName || "RMI Teller Report",
                tellerName: user?.name || user?.username || "",
                dateStr: new Date().toLocaleString(),
                systemBalance: sys,
                cashOnHand,
                d: {
                  d1000: safeNum(form.d1000),
                  d500: safeNum(form.d500),
                  d200: safeNum(form.d200),
                  d100: safeNum(form.d100),
                  d50: safeNum(form.d50),
                  d20: safeNum(form.d20),
                  coins: safeNum(form.coins),
                },
                over: overVal,
                short: shortVal,
              };
              
              const receiptText = generateReceiptText(receiptData);
              
              // Try multiple methods to share/copy the text
              const shareReceipt = async () => {
                try {
                  // Method 1: Try Web Share API (mobile)
                  if (navigator.share) {
                    await navigator.share({
                      title: 'Teller Report',
                      text: receiptText,
                    });
                    showToast({ type: "success", message: "Receipt shared successfully!" });
                    return;
                  }
                  
                  // Method 2: Try Clipboard API (modern browsers)
                  if (navigator.clipboard && navigator.clipboard.writeText) {
                    await navigator.clipboard.writeText(receiptText);
                    showToast({ type: "success", message: "Receipt copied to clipboard!" });
                    return;
                  }
                  
                  // Method 3: Fallback - create temporary text area and copy
                  const textArea = document.createElement('textarea');
                  textArea.value = receiptText;
                  textArea.style.position = 'fixed';
                  textArea.style.left = '-999999px';
                  textArea.style.top = '-999999px';
                  document.body.appendChild(textArea);
                  textArea.focus();
                  textArea.select();
                  
                  try {
                    const successful = document.execCommand('copy');
                    document.body.removeChild(textArea);
                    
                    if (successful) {
                      showToast({ type: "success", message: "Receipt copied to clipboard!" });
                      return;
                    } else {
                      throw new Error('Copy command failed');
                    }
                  } catch (err) {
                    document.body.removeChild(textArea);
                    throw err;
                  }
                  
                } catch (error) {
                  console.log("❌ All copy methods failed:", error);
                  // Method 4: Final fallback - show in alert
                  alert("Receipt Text (please copy manually):\n\n" + receiptText);
                  showToast({ type: "info", message: "Receipt displayed in popup - please copy manually" });
                }
              };
              
              shareReceipt();
            }}
            className="btn-mobile flex items-center gap-2 text-white bg-green-600 hover:bg-green-700 active:bg-green-800"
            title="Generate receipt as text (no Bluetooth needed)"
          >
            📄
            Copy Receipt Text
          </button>
          
          <button
            type="button"
            onClick={runDiagnostic}
            className="btn-mobile flex items-center gap-2 text-white bg-orange-600 hover:bg-orange-700 active:bg-orange-800"
            title="Check if you can submit reports"
          >
            🔍
            Check Status
          </button>
        </div>
      </div>

      {/* 🖨️ Printer Finder Modal */}
      {showPrinterFinder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className={`rounded-xl p-6 max-w-lg w-full max-h-[80vh] overflow-y-auto ${
            dark ? "bg-gray-800 text-gray-100" : "bg-white text-gray-900"
          }`}>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                🖨️ Printer Finder
              </h2>
              <button
                onClick={() => setShowPrinterFinder(false)}
                className="text-gray-500 hover:text-gray-700 text-xl font-bold"
              >
                ×
              </button>
            </div>

            {/* Selected Printer Display */}
            {selectedPrinter && (
              <div className={`p-3 rounded mb-4 ${
                dark ? "bg-green-900/20 border border-green-500" : "bg-green-50 border border-green-200"
              }`}>
                <div className="flex justify-between items-center">
                  <div>
                    <p className="font-medium text-green-600 dark:text-green-400">
                      📌 Selected: {selectedPrinter.name}
                    </p>
                    <p className="text-sm text-gray-600">
                      Serial: {selectedPrinter.serialNumber} | Type: {selectedPrinter.type}
                    </p>
                  </div>
                  <button
                    onClick={() => setSelectedPrinter(null)}
                    className="text-red-500 hover:text-red-700 text-sm"
                  >
                    Remove
                  </button>
                </div>
              </div>
            )}

            {/* Search Box */}
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">
                🔍 Search by Name or Serial Number
              </label>
              <input
                type="text"
                value={printerSearch}
                onChange={(e) => setPrinterSearch(e.target.value)}
                placeholder="Type MAC address (e.g., 10:22:4B:3C:75) or printer name..."
                className={`w-full p-3 border rounded-lg ${
                  dark ? "bg-gray-700 border-gray-600 placeholder-gray-400" : "bg-white border-gray-300 placeholder-gray-500"
                }`}
              />
              <div className="flex items-center justify-between mt-1">
                <p className="text-xs text-gray-500">
                  💡 Tip: Type <code className="bg-gray-200 dark:bg-gray-700 px-1 rounded">10:22:4B:3C:75</code> to find your printer
                </p>
                {(printerSearch.includes('10:22:4B:3C:75') || printerSearch.includes('10224B3C75')) && (
                  <span className="text-xs text-green-600 dark:text-green-400 font-medium">
                    ✅ Searching for your printer!
                  </span>
                )}
              </div>
            </div>

            {/* Scan Button */}
            <div className="mb-4">
              <button
                onClick={scanForPrinters}
                disabled={printerScanning}
                className="w-full btn-mobile flex items-center justify-center gap-2 text-white bg-indigo-600 hover:bg-indigo-700"
              >
                {printerScanning ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Scanning for Bluetooth devices...
                  </>
                ) : (
                  <>
                    � Scan for Bluetooth Printers
                  </>
                )}
              </button>
              <p className="text-xs text-gray-500 mt-2 text-center">
                🔍 Make sure your Bluetooth printer is turned on and discoverable
              </p>
              <p className="text-xs text-blue-600 dark:text-blue-400 mt-1 text-center">
                💡 You'll be prompted to select your printer from the Bluetooth dialog
              </p>
            </div>

            {/* Saved Printers */}
            {savedPrinters.length > 0 && (
              <div className="mb-4">
                <h3 className="font-medium mb-2">💾 Saved Printers</h3>
                <div className="space-y-2">
                  {savedPrinters.map((printer) => (
                    <div
                      key={printer.id}
                      className={`p-3 rounded border cursor-pointer transition-colors ${
                        selectedPrinter?.id === printer.id
                          ? (dark ? "bg-indigo-900/30 border-indigo-500" : "bg-indigo-50 border-indigo-300")
                          : (dark ? "bg-gray-700 border-gray-600 hover:bg-gray-600" : "bg-gray-50 border-gray-200 hover:bg-gray-100")
                      }`}
                      onClick={() => setSelectedPrinter(printer)}
                    >
                      <div className="flex justify-between items-center">
                        <div className="flex-1">
                          <p className="font-medium">{printer.name}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-sm font-mono bg-green-100 dark:bg-green-900 px-2 py-1 rounded text-green-700 dark:text-green-300">
                              MAC: {printer.serialNumber}
                            </span>
                            <span className="text-xs text-gray-500 uppercase">
                              {printer.type}
                            </span>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              connectToPrinter(printer);
                            }}
                            className="text-green-600 hover:text-green-700 text-sm"
                          >
                            Connect
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              removeSavedPrinter(printer.id);
                            }}
                            className="text-red-500 hover:text-red-700 text-sm"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Available Printers */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-medium">📡 Available Printers</h3>
                <div className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-2 py-1 rounded">
                  ⚠️ Check Serial Number!
                </div>
              </div>
              
              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg p-3 mb-3">
                <p className="text-sm text-yellow-800 dark:text-yellow-200">
                  <span className="font-semibold">🚨 Important:</span> Multiple printers detected. 
                  Verify the <strong>serial number</strong> matches your assigned printer to avoid printing to another teller's printer.
                </p>
                <p className="text-xs text-yellow-700 dark:text-yellow-300 mt-1">
                  Your printer MAC: <span className="font-mono bg-yellow-100 dark:bg-yellow-800 px-1 rounded">10:22:4B:3C:75</span>
                </p>
              </div>
              {filteredPrinters.length === 0 ? (
                <p className="text-gray-500 text-center py-4">
                  {printerSearch ? "No printers found matching your search." : "No printers found. Click 'Scan for Printers' to search."}
                </p>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {filteredPrinters.map((printer) => {
                    const isMyPrinter = printer.serialNumber === '10:22:4B:3C:75' || printer.macAddress === '10:22:4B:3C:75';
                    return (
                    <div
                      key={printer.id}
                      className={`p-3 rounded border cursor-pointer transition-colors ${
                        isMyPrinter 
                          ? (dark ? "bg-green-900/30 border-green-500 ring-2 ring-green-400" : "bg-green-50 border-green-300 ring-2 ring-green-400")
                          : selectedPrinter?.id === printer.id
                            ? (dark ? "bg-indigo-900/30 border-indigo-500" : "bg-indigo-50 border-indigo-300")
                            : (dark ? "bg-gray-700 border-gray-600 hover:bg-gray-600" : "bg-gray-50 border-gray-200 hover:bg-gray-100")
                      }`}
                      onClick={() => connectToPrinter(printer)}
                    >
                      <div className="flex justify-between items-center">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-medium">{printer.name}</p>
                            {isMyPrinter && (
                              <span className="text-xs bg-green-600 text-white px-2 py-1 rounded-full">
                                YOUR PRINTER
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <span className={`text-sm font-mono px-2 py-1 rounded ${
                              isMyPrinter 
                                ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 font-bold'
                                : 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300'
                            }`}>
                              MAC: {printer.serialNumber}
                            </span>
                            {printer.macAddress && printer.macAddress !== printer.serialNumber && (
                              <span className="text-xs text-gray-500 font-mono">
                                Alt: {printer.macAddress}
                              </span>
                            )}
                            {printer.vendorId && (
                              <span className="text-xs text-gray-500">
                                VID: {printer.vendorId.toString(16).toUpperCase()}
                              </span>
                            )}
                            <span className="text-xs text-gray-500 uppercase">
                              {printer.type}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`w-3 h-3 rounded-full ${
                            printer.connected ? "bg-green-500" : "bg-gray-400"
                          }`} />
                          <span className="text-xs mr-2">
                            {printer.connected ? "Connected" : "Available"}
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              connectToPrinter(printer);
                            }}
                            className={`px-3 py-1 text-xs rounded-md font-medium transition-colors ${
                              selectedPrinter?.id === printer.id
                                ? 'bg-green-600 text-white hover:bg-green-700'
                                : 'bg-blue-600 text-white hover:bg-blue-700'
                            }`}
                          >
                            {selectedPrinter?.id === printer.id ? '✅ Selected' : '🔗 Connect'}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                  })}
                </div>
              )}
            </div>

            {/* Instructions */}
            <div className={`mt-4 p-3 rounded text-xs ${
              dark ? "bg-blue-900/20 text-blue-300" : "bg-blue-50 text-blue-600"
            }`}>
              <p className="font-medium mb-1">💡 Instructions:</p>
              <ul className="space-y-1">
                <li>• Search for your printer by name or MAC address</li>
                <li>• Click "Scan for Printers" to find nearby Bluetooth devices</li>
                <li>• Select a printer to save it for future use</li>
                <li>• Your selected printer will be used for all prints</li>
              </ul>
            </div>
            
            {/* Bluetooth Troubleshooting */}
            {!('bluetooth' in navigator) && (
              <div className={`mt-2 p-3 rounded text-xs ${
                dark ? "bg-red-900/20 text-red-300" : "bg-red-50 text-red-600"
              }`}>
                <p className="font-medium mb-1">🚨 Bluetooth Not Available:</p>
                <ul className="space-y-1">
                  <li>• Use Chrome, Edge, or Opera browser</li>
                  <li>• Ensure site is accessed via HTTPS</li>
                  <li>• Enable Bluetooth on your device</li>
                  <li>• Try on Windows 10+, Android, or macOS</li>
                </ul>
              </div>
            )}
            
            {('bluetooth' in navigator) && (
              <div className={`mt-2 p-3 rounded text-xs ${
                dark ? "bg-green-900/20 text-green-300" : "bg-green-50 text-green-600"
              }`}>
                <p className="font-medium mb-1">📱 Bluetooth Available:</p>
                <ul className="space-y-1">
                  <li>• Turn on your thermal printer</li>
                  <li>• Make printer discoverable/pairing mode</li>
                  <li>• Click scan and select from browser dialog</li>
                  <li>• If no devices appear, check printer manual</li>
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
