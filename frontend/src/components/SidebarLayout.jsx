import React, { useEffect, useState, useContext, useRef } from "react"; 
import { useNavigate, useLocation } from "react-router-dom";
import axios from "axios";
import { SettingsContext } from "../context/SettingsContext";
import { useToast } from "../context/ToastContext";
import { getApiUrl } from "../utils/apiConfig";
import { getGlobalSocket } from "../utils/globalSocket";
import {
  LayoutDashboard,
  Users,
  FileText,
  PiggyBank,
  Settings,
  History,
  UserCircle,
  BarChart3,
  Calendar,
  Award,
  FileBarChart,
  Wallet,
  Package,
  Briefcase,
  Shield,
  CheckSquare,
  MapPin,
  TrendingUp,
} from "lucide-react";

import FloatingChat from "../pages/ChatRoom.jsx"; // ✅ floating chat import
import SuperAdminSidebarControl from '../pages/SuperAdminSidebarControl.jsx';

export default function SidebarLayout({ role, children }) {
  const { user, settings } = useContext(SettingsContext);
  const { showToast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const dark = settings?.theme?.mode === "dark";

  const [collapsed, setCollapsed] = useState(false);
  const [payrollTotal, setPayrollTotal] = useState(0);
  const [availableBalance, setAvailableBalance] = useState(0); // sum of unwithdrawn payrolls
  const [payrollLoading, setPayrollLoading] = useState(false);
  // Removed collapsible sub-menus for teller sections; keep simple flat nav
  const [pendingCount, setPendingCount] = useState(0);

  const sidebarRef = useRef(null);

  // ✅ Mobile sidebar + gestures + overlay
  const [showSidebar, setShowSidebar] = useState(true);
  const [showArrow, setShowArrow] = useState(true);
  const touchStartX = useRef(0);
  const touchEndX = useRef(0);

  const fetchPayrollTotal = async () => {
    if (!user?._id) return;

    try {
      setPayrollLoading(true);
      const API = getApiUrl(); // Get fresh API URL
      const res = await axios.get(`${API}/api/payroll/user/${user._id}`);
      const payrolls = res.data?.payrolls || [];
      // Prefer latest entry (sorted desc in backend), fallback to 0
      const latest = payrolls[0];
      const total = Number(latest?.totalSalary || 0);
      setPayrollTotal(total);
      // Compute available balance (sum of totalSalary of unwithdrawn payrolls)
      const unwithdrawnSum = payrolls.reduce((sum, p) => {
        if (p && !p.withdrawn) return sum + Number(p.totalSalary || 0);
        return sum;
      }, 0);
      setAvailableBalance(unwithdrawnSum);
    } catch {
      setPayrollTotal(0);
      setAvailableBalance(0);
    } finally {
      setPayrollLoading(false);
    }
  };

  const fetchPendingCount = async () => {
    try {
      const API = getApiUrl(); // Get fresh API URL
      const res = await axios.get(`${API}/api/admin/pending-count`);
      setPendingCount(res.data?.pendingCount || 0);
    } catch {
      setPendingCount(0);
    }
  };

  useEffect(() => {
    if (user?._id) fetchPayrollTotal();
    fetchPendingCount();

    const socket = getGlobalSocket();
    if (socket) {
      socket.on("userUpdated", fetchPendingCount);
      socket.on("userDeleted", fetchPendingCount);
      socket.on("payrollUpdated", fetchPayrollTotal);
    }

    return () => {
      if (socket) {
        socket.off("userUpdated", fetchPendingCount);
        socket.off("userDeleted", fetchPendingCount);
        socket.off("payrollUpdated", fetchPayrollTotal);
      }
    };
  }, [user?._id]);

  // ✅ Swipe gestures for mobile sidebar - DISABLED to prevent form interference
  // useEffect(() => {
  //   const handleTouchStart = (e) => (touchStartX.current = e.touches[0].clientX);
  //   const handleTouchMove = (e) => (touchEndX.current = e.touches[0].clientX);
  //   const handleTouchEnd = () => {
  //     const diff = touchStartX.current - touchEndX.current;
  //     if (diff > 80) {
  //       setShowSidebar(false);
  //       setShowArrow(true);
  //     }
  //     if (diff < -80) {
  //       setShowSidebar(true);
  //       setShowArrow(false);
  //     }
  //   };

  //   document.addEventListener("touchstart", handleTouchStart);
  //   document.addEventListener("touchmove", handleTouchMove);
  //   document.addEventListener("touchend", handleTouchEnd);

  //   return () => {
  //     document.removeEventListener("touchstart", handleTouchStart);
  //     document.removeEventListener("touchmove", handleTouchMove);
  //     document.removeEventListener("touchend", handleTouchEnd);
  //   };
  // }, []);

  const logout = () => {
    localStorage.removeItem("token");
    navigate("/login");
    showToast({ type: "info", message: "Logged out successfully" });
  };

  const isActive = (path) => location.pathname.includes(path);

  // ✅ Hide chat on login/register pages
  const hideChat =
    location.pathname.includes("/login") || location.pathname.includes("/register");

  // ================= Dynamic Menu Permissions =================
  // Central catalog of menu items (id -> definition). Functions generate role-based paths.
  const MENU_ITEM_DEFS = {
    dashboard: { to: r => `/${r}/dashboard`, icon: <LayoutDashboard size={18} />, text: 'Dashboard' },
    'supervisor-report': { to: r => `/${r}/supervisor-report`, icon: <Users size={18} />, text: 'Supervisor Reports' },
    'teller-reports': { to: r => `/${r}/teller-reports`, icon: <FileText size={18} />, text: 'Teller Reports' },
    'teller-reports-viewer': { to: r => `/${r}/teller-reports/viewer`, icon: <FileBarChart size={18} />, text: 'Reports Viewer' },
    'teller-management': { to: r => `/${r}/teller-management`, icon: <Users size={18} />, text: 'Teller Management', roles: ['admin','super_admin','supervisor'] },
    'staff-performance': { to: r => `/${r}/staff-performance`, icon: <BarChart3 size={18} />, text: 'Staff Performance', roles: ['supervisor'] },
    'teller-overview': { to: r => `/${r}/teller-overview`, icon: <BarChart3 size={18} />, text: 'Teller Overview', roles: ['admin','super_admin'] },
    report: { to: r => `/${r}/report`, icon: <FileBarChart size={18} />, text: 'Admin Report', roles: ['admin','super_admin'] },
    cashflow: { to: r => `/${r}/cashflow`, icon: <PiggyBank size={18} />, text: 'Cash Flow' },
    payroll: { to: r => `/${r}/payroll`, icon: <Wallet size={18} />, text: 'Payroll Management' },
    withdrawals: { to: r => `/${r}/withdrawals`, icon: <Wallet size={18} />, text: 'Withdrawal Approvals' },
    employees: { to: r => `/${r}/employees`, icon: <Briefcase size={18} />, text: 'Employees', roles: ['admin','super_admin'] },
    'user-approval': { to: r => `/${r}/user-approval`, icon: <Users size={18} />, text: 'User Approval', dynamicBadge: true, roles: ['admin','super_admin'] },
    salary: { to: r => `/${r}/salary`, icon: <Wallet size={18} />, text: 'My Salary', roles: ['admin','super_admin'] },
    'suggested-schedule': { to: r => `/${r}/suggested-schedule`, icon: <Calendar size={18} />, text: 'Suggested Schedule' },
    history: { to: r => `/${r}/history`, icon: <History size={18} />, text: 'History' },
    'teller-month': { to: r => `/${r}/teller-month`, icon: <Award size={18} />, text: 'Teller of Month' },
    deployments: { to: r => `/${r}/deployments`, icon: <Package size={18} />, text: 'Deployment Management', roles: ['declarator','admin','super_admin','supervisor','supervisor_teller','teller'] },
    settings: { to: r => `/${r}/settings`, icon: <Settings size={18} />, text: 'Settings' },
    'menu-config': { to: r => `/${r}/menu-config`, icon: <Shield size={18} />, text: 'Menu Permissions', roles: ['admin','super_admin'] },
    'manage-sidebars': { to: r => `/${r}/manage-sidebars`, icon: <Settings size={18} />, text: 'Sidebar Control', roles: ['admin','super_admin'] },
    'live-map': { to: r => `/${r}/live-map`, icon: <MapPin size={18} />, text: 'Live Map', roles: ['admin','super_admin','declarator'] },
    'map-editor': { to: r => `/${r}/map-editor`, icon: <Settings size={18} />, text: 'Map Editor', roles: ['admin','super_admin','declarator'] },
    'teller-betting': { to: r => `/${r}/teller-betting`, icon: <TrendingUp size={18} />, text: 'Teller Betting Data', roles: ['admin','super_admin'] },
    'manage-betting': { to: r => `/${r}/manage-betting`, icon: <Settings size={18} />, text: 'Manage Betting Data', roles: ['admin','super_admin'] },
    'betting-analytics': { to: r => `/${r}/betting-analytics`, icon: <BarChart3 size={18} />, text: 'Betting Analytics', roles: ['admin','super_admin'] },
    'betting-event-report': { to: r => `/${r}/betting-event-report`, icon: <TrendingUp size={18} />, text: 'Betting Event Report', roles: ['super_admin'] },
    'key-performance-indicator': { to: r => `/${r}/key-performance-indicator`, icon: <BarChart3 size={18} />, text: 'Key Performance Indicator', roles: ['admin','super_admin','supervisor'] },
    // Extra items that appear in config but not previously mapped
    chat: { to: r => `/${r}/chat`, icon: <FileText size={18} />, text: 'Chat/Messages' },
    approvals: { to: r => `/${r}/user-approval`, icon: <CheckSquare size={18} />, text: 'Approvals', dynamicBadge: true, roles: ['admin','super_admin'] },
    // Mark experimental/unstable items disabled by default (hidden in sidebar)
    'attendance-scheduler': { to: r => `/${r}/attendance-scheduler`, icon: <Calendar size={18} />, text: 'Attendance Scheduler', roles: ['admin','super_admin','supervisor'] },
    assistant: { to: r => `/${r}/assistant`, icon: <Users size={18} />, text: 'Admin Assistant', roles: ['admin','super_admin'] },
  };

  // Allow backward compatibility: map legacy IDs from config page to new canonical IDs
  const LEGACY_SYNONYMS = {
    'supervisor-reports': 'supervisor-report',
    'teller-report': 'teller-reports',
    'submit-report': 'teller-reports',
    'schedule': 'suggested-schedule',
    'teller-of-month': 'teller-month',
    'users': 'user-approval',
    'approvals': 'approvals',
  };

  // Fallback default item IDs per role (used if DB not yet initialized)
  const FALLBACK_ROLE_ITEMS = {
    super_admin: [
      'dashboard','supervisor-report','teller-reports','teller-reports-viewer','teller-management','teller-overview','report','cashflow','user-approval','withdrawals','employees','salary','payroll','history','teller-month','suggested-schedule','attendance-scheduler','deployments','assistant','menu-config','manage-sidebars','live-map','map-editor','teller-betting','manage-betting','betting-analytics','betting-event-report','key-performance-indicator','settings','approvals'
    ],
    admin: ['dashboard','supervisor-report','teller-reports','teller-reports-viewer','teller-management','teller-overview','report','cashflow','payroll','withdrawals','employees','user-approval','salary','history','teller-month','suggested-schedule','attendance-scheduler','deployments','assistant','map-editor','teller-betting','manage-betting','menu-config','manage-sidebars','key-performance-indicator','settings'],
    supervisor: ['dashboard','supervisor-report','teller-reports','teller-reports-viewer','teller-management','staff-performance','teller-month','history','payroll','suggested-schedule','key-performance-indicator','deployments','live-map'],
    supervisor_teller: ['dashboard','supervisor-report','teller-reports','teller-reports-viewer','teller-management','staff-performance','teller-month','history','payroll','suggested-schedule','deployments','live-map'],
    teller: ['dashboard','teller-reports','history','payroll','teller-month','suggested-schedule','deployments','live-map'],
    declarator: ['deployments','settings','live-map','map-editor'],
  };

  const [permissionsLoaded, setPermissionsLoaded] = useState(false);
  const [rolePermissions, setRolePermissions] = useState({});

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const API = getApiUrl();
        const res = await axios.get(`${API}/api/menu-permissions`);
        if (cancelled) return;
        const map = {};
        res.data.forEach(p => { map[p.role] = p.menuItems || []; });
        setRolePermissions(map);
      } catch (err) {
        console.warn('Menu permissions fetch failed, using fallbacks:', err.message);
      } finally {
        if (!cancelled) setPermissionsLoaded(true);
      }
    }
    load();
    // Optional live update via socket
    const socket = getGlobalSocket();
    if (socket) {
      socket.on('menuPermissionsUpdated', load);
    }
    return () => {
      cancelled = true;
      if (socket) socket.off('menuPermissionsUpdated', load);
    };
  }, []);

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50 dark:bg-gray-950">
      {/* ✅ Dimmed overlay for mobile */}
      {showSidebar && (
        <div
          className="md:hidden fixed inset-0 bg-black bg-opacity-40 backdrop-blur-sm z-30"
          onClick={() => {
            setShowSidebar(false);
            setShowArrow(true);
          }}
        ></div>
      )}

      {/* Sidebar */}
      <aside
        ref={sidebarRef}
        className={`fixed md:sticky md:top-0 sidebar-fixed z-40 h-screen transition-transform duration-300 transform 
        ${showSidebar ? "translate-x-0" : "-translate-x-64"} 
        w-64 
        bg-white dark:bg-gray-900 border-r dark:border-gray-700 flex flex-col shadow-lg md:shadow-none overflow-hidden`}
      >
        <div className="px-4 pt-4 pb-3 border-b dark:border-gray-700 flex-shrink-0">
          <div 
            className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition"
            onClick={() => navigate(`/${role}/dashboard`)}
            title="Go to Dashboard"
          >
            <UserCircle className="h-12 w-12 text-indigo-500 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-gray-800 dark:text-gray-200 text-base leading-tight truncate">
                {user?.name || user?.username || "User"}
              </p>
              <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                {user?.role}
              </p>
            </div>
          </div>
          <div
            onClick={() => {
              const target = role === 'admin' ? '/admin/salary' : `/${role}/payroll`;
              navigate(target);
            }}
            className="mt-4 cursor-pointer group"
            >
              <div className="rounded-xl p-4 bg-gradient-to-r from-indigo-600 via-purple-600 to-fuchsia-600 text-white shadow hover:shadow-md transition relative overflow-hidden">
                <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_30%_30%,#ffffff,transparent)]" />
                <div className="flex items-center justify-between relative z-10">
                  <div>
                    <div className="text-[11px] font-semibold tracking-wider text-indigo-100">
                      TOTAL BALANCE
                    </div>
                    <div className="mt-1 text-2xl font-bold">
                      {payrollLoading ? (
                        <span className="animate-pulse">…</span>
                      ) : (
                        `₱${availableBalance.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
                      )}
                    </div>
                  </div>
                  <div className="text-xs text-indigo-100 text-right">
                    <div className="opacity-80">Unwithdrawn</div>
                    <div className="group-hover:underline">View Details →</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

        {/* ==================== NAVIGATION ==================== */}
        <nav className="mt-4 space-y-1 text-sm flex-1 overflow-y-auto px-2 pb-4 scrollbar-thin scrollbar-thumb-gray-400 dark:scrollbar-thumb-gray-600 scrollbar-track-transparent">
          {!permissionsLoaded && (
            <div className="text-xs px-3 py-1 text-gray-500 dark:text-gray-400">Loading menu…</div>
          )}
          {permissionsLoaded && (
            (() => {
              const isSuperAdminUsername = (user?.username === 'admin');
              const roleKey = user?.role;
              const menuRole = (isSuperAdminUsername && (
                (rolePermissions['super_admin'] && rolePermissions['super_admin'].length) ||
                (FALLBACK_ROLE_ITEMS['super_admin'] && FALLBACK_ROLE_ITEMS['super_admin'].length)
              )) ? 'super_admin' : roleKey;

              let list = (rolePermissions[menuRole] && rolePermissions[menuRole].length
                ? rolePermissions[menuRole]
                : FALLBACK_ROLE_ITEMS[menuRole] || []);
              // Auto-approve all items for super_admin: union with every defined item id
              if (menuRole === 'super_admin') {
                const allIds = Object.keys(MENU_ITEM_DEFS);
                const set = new Set(list);
                for (const id of allIds) {
                  if (!set.has(id)) {
                    list.push(id);
                    set.add(id);
                  }
                }
              }
              // Normalize legacy IDs first
              const normalized = list.map(id => LEGACY_SYNONYMS[id] || id);
              // Deduplicate while preserving order to avoid duplicate React keys
              const seen = new Set();
              const unique = normalized.filter(id => {
                if (seen.has(id)) return false;
                seen.add(id);
                return true;
              });
              // Allow showing disabled/experimental menus with a local override for debugging
              const showExperimental = localStorage.getItem('showExperimentalMenus') === 'true';
              return unique
              .filter(id => MENU_ITEM_DEFS[id])
              .filter(id => showExperimental || menuRole === 'super_admin' || MENU_ITEM_DEFS[id].enabled !== false)
              .filter(id => {
                const roles = MENU_ITEM_DEFS[id].roles;
                return !roles || roles.includes(menuRole);
              })
              .map(id => {
                const def = MENU_ITEM_DEFS[id];
                const to = typeof def.to === 'function' ? def.to(user?.role) : def.to;
                const badge = def.dynamicBadge ? (pendingCount || 0) : undefined;
                return (
                  <SidebarItem
                    key={id}
                    to={to}
                    icon={def.icon}
                    text={def.text}
                    active={isActive(to.replace(/\/.*/, ''))}
                    badge={badge}
                  />
                );
              });
            })()
          )}
        </nav>

        {/* Logout button - stays at bottom */}
        <div className="border-t dark:border-gray-700 mt-auto flex-shrink-0">
          <button
            onClick={logout}
            className="w-full py-3 text-center text-sm text-gray-500 dark:text-gray-300 hover:bg-red-100 dark:hover:bg-red-800 hover:text-red-600 transition"
          >
            Logout
          </button>
        </div>
      </aside>

      {/* ✅ Floating arrow for mobile */}
      {showArrow && (
        <button
          onClick={() => {
            setShowSidebar(true);
            setShowArrow(false);
          }}
          className="md:hidden fixed top-4 left-3 z-50 bg-indigo-600 text-white p-2 rounded-full shadow-lg focus:outline-none transition-transform duration-300"
        >
          <span className="transform transition-transform duration-300 rotate-0">➤</span>
        </button>
      )}

      {/* ✅ MAIN CONTENT */}
      <main
        className="flex-1 h-screen overflow-y-auto bg-gray-50 dark:bg-gray-950 md:ml-0 relative"
        style={{ 
          marginLeft: showSidebar ? '0' : '0' // Let CSS handle responsive behavior
        }}
      >
        <div className="min-h-full w-full">
          {children}
        </div>

        {/* ✅ Draggable + Auto-adjust Floating Chat */}
        {!hideChat && user && (
          <DraggableChatBubble>
            <FloatingChat user={user} />
          </DraggableChatBubble>
        )}
      </main>
    </div>
  );
}

function SidebarItem({ to, icon, text, active, badge }) {
  const navigate = useNavigate();
  return (
    <div
      onClick={() => navigate(to)}
      className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer rounded-lg transition-all ${
        active
          ? "bg-indigo-100 dark:bg-indigo-700 text-indigo-700 dark:text-white font-medium shadow-sm"
          : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 hover:translate-x-1"
      }`}
      title={text}
    >
      <span className="flex-shrink-0">{icon}</span>
      <span className="truncate flex-1">{text}</span>
      {badge > 0 && (
        <span className="flex-shrink-0 bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">
          {badge}
        </span>
      )}
    </div>
  );
}

/* ✅ Draggable Chat Bubble that Auto Adjusts and Stays Visible */
function DraggableChatBubble({ children }) {
  const [pos, setPos] = useState({
    x: window.innerWidth - 90,
    y: window.innerHeight - 140,
  });
  const dragging = useRef(false);
  const offset = useRef({ x: 0, y: 0 });

  // ✅ Auto-adjust to screen size and orientation
  useEffect(() => {
    const adjustPosition = () => {
      const maxX = window.innerWidth - 80;
      const maxY = window.innerHeight - 80;
      setPos((p) => ({
        x: Math.max(10, Math.min(p.x, maxX)),
        y: Math.max(10, Math.min(p.y, maxY)),
      }));
    };

    window.addEventListener("resize", adjustPosition);
    window.addEventListener("scroll", adjustPosition);
    window.addEventListener("orientationchange", adjustPosition);

    return () => {
      window.removeEventListener("resize", adjustPosition);
      window.removeEventListener("scroll", adjustPosition);
      window.removeEventListener("orientationchange", adjustPosition);
    };
  }, []);

  // Desktop drag
  const startDrag = (e) => {
    dragging.current = true;
    offset.current = { x: e.clientX - pos.x, y: e.clientY - pos.y };
    document.addEventListener("mousemove", onDrag);
    document.addEventListener("mouseup", stopDrag);
  };

  const onDrag = (e) => {
    if (!dragging.current) return;
    const newX = e.clientX - offset.current.x;
    const newY = e.clientY - offset.current.y;
    setPos({
      x: Math.max(10, Math.min(newX, window.innerWidth - 80)),
      y: Math.max(10, Math.min(newY, window.innerHeight - 80)),
    });
  };

  const stopDrag = () => {
    dragging.current = false;
    snapToEdge();
    document.removeEventListener("mousemove", onDrag);
    document.removeEventListener("mouseup", stopDrag);
  };

  // Mobile touch drag
  const startTouch = (e) => {
    dragging.current = true;
    const touch = e.touches[0];
    offset.current = { x: touch.clientX - pos.x, y: touch.clientY - pos.y };
    document.addEventListener("touchmove", onTouchDrag, { passive: false });
    document.addEventListener("touchend", stopTouch);
  };

  const onTouchDrag = (e) => {
    if (!dragging.current) return;
    e.preventDefault();
    const touch = e.touches[0];
    const newX = touch.clientX - offset.current.x;
    const newY = touch.clientY - offset.current.y;
    setPos({
      x: Math.max(10, Math.min(newX, window.innerWidth - 80)),
      y: Math.max(10, Math.min(newY, window.innerHeight - 80)),
    });
  };

  const stopTouch = () => {
    dragging.current = false;
    snapToEdge();
    document.removeEventListener("touchmove", onTouchDrag);
    document.removeEventListener("touchend", stopTouch);
  };

  // ✅ Snap to nearest edge
  const snapToEdge = () => {
    setPos((p) => ({
      x: p.x < window.innerWidth / 2 ? 10 : window.innerWidth - 80,
      y: Math.max(10, Math.min(p.y, window.innerHeight - 80)),
    }));
  };

  return (
    <div
      onMouseDown={startDrag}
      onTouchStart={startTouch}
      style={{
        position: "fixed",
        left: `${pos.x}px`,
        top: `${pos.y}px`,
        zIndex: 99999,
        cursor: "grab",
        touchAction: "none",
        transition: dragging.current ? "none" : "all 0.25s ease-out",
        filter: "drop-shadow(0 4px 8px rgba(0,0,0,0.25))",
      }}
    >
      {children}
    </div>
  );
}
