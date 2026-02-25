import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  LayoutDashboard, Users, FolderKanban, 
  Calendar, LogOut, ShieldCheck, FileText, UserSquare2,
  Package, Menu, X, Radio, Sparkles, Bell, CheckCheck, GitBranchPlus
} from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  fetchCommunicationMessages,
  fetchNotifications,
  getMe,
  markAllNotificationsRead,
  markNotificationRead,
} from '../api';
import logo from './logo.png';

export default function Layout({ children }) {
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [hasUnreadChat, setHasUnreadChat] = useState(false);
  const [logoMode, setLogoMode] = useState('bundle');
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [notificationBusy, setNotificationBusy] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const location = useLocation();
  const navigate = useNavigate();
  
  const profile = JSON.parse(localStorage.getItem('profile') || '{}');
  const [user, setUser] = useState(profile.result || profile);
  const isStrictAdmin = user.role?.toLowerCase() === 'admin';
  const logoSrc = useMemo(() => {
    if (logoMode === 'bundle') return logo;
    if (logoMode === 'public') return '/cicr-logo.png';
    return '';
  }, [logoMode]);

  useEffect(() => {
    const syncProfile = async () => {
      try {
        const { data } = await getMe();
        const existing = JSON.parse(localStorage.getItem('profile') || '{}');
        const merged = { ...existing, ...data };
        localStorage.setItem('profile', JSON.stringify(merged));
        setUser(merged.result || merged);
      } catch (err) {
        // ignore periodic sync errors
      }
    };
    syncProfile();
  }, []);

  useEffect(() => {
    if (!isStrictAdmin) {
      setHasUnreadChat(false);
      return;
    }

    const isChatOpen = location.pathname.startsWith('/communication');
    if (isChatOpen) {
      localStorage.setItem('communication_last_seen_at', String(Date.now()));
      setHasUnreadChat(false);
      return;
    }

    const token = localStorage.getItem('token');
    if (!token) {
      setHasUnreadChat(false);
      return;
    }

    const checkUnread = async () => {
      try {
        const { data } = await fetchCommunicationMessages(1);
        const latest = Array.isArray(data) ? data[data.length - 1] : null;
        if (!latest?.createdAt) {
          setHasUnreadChat(false);
          return;
        }
        const lastSeen = Number(localStorage.getItem('communication_last_seen_at') || 0);
        const latestTime = new Date(latest.createdAt).getTime();
        const isOwnMessage = String(latest.sender?._id || '') === String(user._id || '');
        setHasUnreadChat(!isOwnMessage && latestTime > lastSeen);
      } catch {
        // keep current unread state on fetch failures
      }
    };

    checkUnread();
    const poll = setInterval(checkUnread, 20000);
    const onReadUpdated = () => {
      if (!location.pathname.startsWith('/communication')) {
        checkUnread();
      }
    };
    window.addEventListener('communication-read-updated', onReadUpdated);
    return () => {
      clearInterval(poll);
      window.removeEventListener('communication-read-updated', onReadUpdated);
    };
  }, [isStrictAdmin, location.pathname, user._id]);

  const loadNotifications = async (silent = true) => {
    const token = localStorage.getItem('token');
    if (!token) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }

    if (!silent) setNotificationBusy(true);
    try {
      const { data } = await fetchNotifications({ limit: 20 });
      const items = Array.isArray(data?.items) ? data.items : [];
      setNotifications(items);
      setUnreadCount(Number(data?.unreadCount || 0));
    } catch {
      // keep previous state on errors
    } finally {
      if (!silent) setNotificationBusy(false);
    }
  };

  useEffect(() => {
    loadNotifications(false);
    const poll = setInterval(() => loadNotifications(true), 30000);
    return () => clearInterval(poll);
  }, []);

  useEffect(() => {
    setNotificationsOpen(false);
  }, [location.pathname]);

  const openNotifications = () => {
    setNotificationsOpen((prev) => !prev);
    if (!notificationsOpen) {
      loadNotifications(false);
    }
  };

  const handleReadNotification = async (item) => {
    try {
      if (!item.isRead) {
        await markNotificationRead(item._id);
        setNotifications((prev) =>
          prev.map((row) => (row._id === item._id ? { ...row, isRead: true } : row))
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }
    } catch {
      // ignore read failures
    }

    if (item.link) {
      setIsMobileOpen(false);
      setNotificationsOpen(false);
      navigate(item.link);
    }
  };

  const handleMarkAllNotificationsRead = async () => {
    try {
      await markAllNotificationsRead();
      setNotifications((prev) => prev.map((row) => ({ ...row, isRead: true })));
      setUnreadCount(0);
    } catch {
      // ignore
    }
  };

  const handleLogoError = () => {
    if (logoMode === 'bundle') {
      setLogoMode('public');
      return;
    }
    setLogoMode('fallback');
  };

  const handleLogout = () => {
    localStorage.clear();
    window.location.href = '/login';
  };

  // Profile icon removed from here as requested
  const navLinks = [
    { icon: LayoutDashboard, label: "Dashboard", path: "/dashboard" },
    { icon: FolderKanban, label: "Projects", path: "/projects" },
    { icon: Calendar, label: "Meetings", path: "/meetings" },
    { icon: GitBranchPlus, label: "Mentorship Ops", path: "/hierarchy" },
    { icon: Sparkles, label: "Events", path: "/events" },
    { icon: Package, label: "Inventory", path: "/inventory" },
    ...(isStrictAdmin ? [{ icon: Radio, label: "Collab Stream", path: "/communication" }] : []),
    { icon: Users, label: "Community", path: "/community" },
    { icon: UserSquare2, label: "Profile", path: "/profile" },
    { icon: FileText, label: "Guidelines", path: "/guidelines" },
  ];

  const SidebarContent = () => (
    <>
      {/* Brand Logo */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: 'easeOut' }}
        className="mb-10 px-2"
      >
        <Link
          to="/dashboard"
          onClick={() => setIsMobileOpen(false)}
          className="group inline-flex items-center gap-3"
        >
          {logoMode !== 'fallback' ? (
            <img
              className="h-9 w-auto max-w-[124px] object-contain drop-shadow-[0_0_14px_rgba(96,165,250,0.35)]"
              src={logoSrc}
              alt="CICR logo"
              onError={handleLogoError}
            />
          ) : (
            <div className="h-9 min-w-[54px] px-3 rounded-lg border border-blue-500/35 inline-flex items-center justify-center text-[10px] uppercase tracking-[0.24em] text-blue-300 font-black">
              CICR
            </div>
          )}
          <motion.h1
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="brand-title brand-text-animate text-[1.22rem] leading-tight"
          >
            CICR Connect
          </motion.h1>
        </Link>
      </motion.div>

      <div className="relative mb-4 px-2">
        <button
          type="button"
          onClick={openNotifications}
          className="w-full inline-flex items-center justify-between px-3 py-2.5 rounded-xl border border-gray-800 text-gray-300 hover:border-blue-500/40 hover:text-white transition-colors"
        >
          <span className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.14em] font-black">
            <Bell size={14} className="text-blue-400" />
            Notifications
          </span>
          {unreadCount > 0 ? (
            <span className="inline-flex items-center justify-center min-w-5 h-5 px-1 rounded-full bg-blue-500/20 text-[10px] text-blue-200 font-black">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          ) : (
            <span className="text-[10px] text-gray-500 uppercase tracking-widest">Clear</span>
          )}
        </button>

        <AnimatePresence>
          {notificationsOpen && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className="absolute left-2 right-2 top-[calc(100%+8px)] z-40 border border-gray-800 rounded-2xl bg-[#0a0a0c] shadow-2xl overflow-hidden"
            >
              <div className="flex items-center justify-between px-3 py-2.5 border-b border-gray-800">
                <p className="text-[10px] uppercase tracking-[0.18em] text-gray-500 font-black">Recent Alerts</p>
                <button
                  type="button"
                  onClick={handleMarkAllNotificationsRead}
                  className="inline-flex items-center gap-1 text-[10px] uppercase tracking-widest text-blue-300 hover:text-blue-200"
                >
                  <CheckCheck size={12} />
                  Read all
                </button>
              </div>
              {notificationBusy ? (
                <div className="px-3 py-6 text-center text-xs text-gray-500">Loading...</div>
              ) : notifications.length === 0 ? (
                <div className="px-3 py-6 text-center text-xs text-gray-500">No notifications</div>
              ) : (
                <div className="max-h-72 overflow-y-auto">
                  {notifications.map((item) => (
                    <button
                      key={item._id}
                      type="button"
                      onClick={() => handleReadNotification(item)}
                      className={`w-full text-left px-3 py-2.5 border-b border-gray-800/70 last:border-b-0 hover:bg-white/[0.03] ${
                        item.isRead ? 'text-gray-400' : 'text-gray-200'
                      }`}
                    >
                      <p className="text-xs font-semibold truncate">{item.title}</p>
                      <p className="text-[11px] mt-1 line-clamp-2">{item.message}</p>
                    </button>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      
      {/* Main Navigation */}
      <nav className="flex-1 space-y-2">
        {navLinks.map((link) => (
          <Link key={link.path} to={link.path} onClick={() => setIsMobileOpen(false)}>
            <motion.div
              whileHover={{ x: 5 }}
              className={`flex items-center justify-between p-3 rounded-xl transition-colors ${
                location.pathname === link.path ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-400 hover:bg-gray-800'
              }`}
            >
              <div className="flex items-center space-x-3">
                <link.icon size={20} />
                <span className="font-medium">{link.label}</span>
              </div>
              {link.path === '/communication' && hasUnreadChat && (
                <span className="inline-block w-2.5 h-2.5 rounded-full bg-red-500" title="Unread messages" />
              )}
            </motion.div>
          </Link>
        ))}

        {/* Admin Link (Conditional) */}
        {(user.role?.toLowerCase() === 'admin' || user.role?.toLowerCase() === 'head') && (
          <div className="pt-4 mt-4 border-t border-gray-800/50">
            <Link to="/admin" onClick={() => setIsMobileOpen(false)}>
              <div className={`flex items-center space-x-3 p-3 rounded-xl transition-colors ${
                location.pathname === '/admin' ? 'bg-purple-600 text-white shadow-lg' : 'text-gray-500 hover:bg-gray-800'
              }`}>
                <ShieldCheck size={20} />
                <span className="font-medium">Admin Panel</span>
              </div>
            </Link>
          </div>
        )}
      </nav>

      {/* Footer Profile Section (This acts as the link to /profile) */}
      <div className="mt-auto pt-6 border-t border-gray-800 space-y-4">
        <div className="group px-2 py-2 rounded-xl border border-gray-800/70">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-blue-600/10 border border-blue-500/20 rounded-lg flex items-center justify-center text-blue-500 font-black">
              {user.name?.[0] || 'M'}
            </div>
            <div className="overflow-hidden">
              <p className="text-sm font-bold truncate text-gray-100 flex items-center gap-2">
                {user.name || 'Member'}
                {user.hasUnreadWarning && <span className="inline-block w-2 h-2 bg-red-500 rounded-full" />}
              </p>
              <p className="text-[10px] text-blue-500 font-bold uppercase tracking-widest">{user.role || 'User'}</p>
            </div>
          </div>
        </div>

        {/* Logout Button */}
        <button onClick={handleLogout} className="flex items-center space-x-3 p-3 text-red-400 hover:bg-red-500/10 rounded-xl w-full group transition-all">
          <LogOut size={20} className="group-hover:translate-x-1 transition-transform" />
          <span className="font-medium">Logout</span>
        </button>
      </div>
    </>
  );

  return (
    <div className="flex min-h-screen bg-[#0a0a0c] text-white">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex w-64 border-r border-gray-800 p-6 flex-col fixed h-full bg-[#0a0a0c] z-20">
        <SidebarContent />
      </aside>

      {/* Mobile Top Nav */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-[#0a0a0c]/80 backdrop-blur-md border-b border-gray-800 flex items-center justify-between px-6 z-30">
        <div className="flex items-center gap-2.5">
          {logoMode !== 'fallback' ? (
            <img
              className="h-7 w-auto max-w-[88px] object-contain drop-shadow-[0_0_12px_rgba(96,165,250,0.35)]"
              src={logoSrc}
              alt="CICR logo"
              onError={handleLogoError}
            />
          ) : (
            <div className="h-7 min-w-[44px] px-2 rounded-md border border-blue-500/35 inline-flex items-center justify-center text-[9px] uppercase tracking-[0.2em] text-blue-300 font-black">
              CICR
            </div>
          )}
          <motion.p
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="brand-title brand-text-animate text-[1rem] tracking-wide"
          >
            CICR Connect
          </motion.p>
        </div>
        <button onClick={() => setIsMobileOpen(!isMobileOpen)} className="p-2 text-gray-400">
          {isMobileOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Mobile Sidebar Drawer */}
      <AnimatePresence>
        {isMobileOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setIsMobileOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
            />
            <motion.aside 
              initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }}
              className="fixed top-0 left-0 bottom-0 w-72 bg-[#0a0a0c] p-6 z-50 flex flex-col border-r border-gray-800 lg:hidden"
            >
              <SidebarContent />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main Content Area */}
      <main className="flex-1 lg:ml-64 p-4 md:p-8 pt-24 lg:pt-8 min-h-screen relative overflow-x-hidden">
        {/* Aesthetic Background Glow */}
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-600/5 blur-[120px] rounded-full -z-10 pointer-events-none" />
        
        <motion.div
          key={location.pathname}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          {children}
        </motion.div>
      </main>
    </div>
  );
}
