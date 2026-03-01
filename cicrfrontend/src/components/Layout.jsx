import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  LayoutDashboard, Users, FolderKanban, 
  Calendar, ShieldCheck, FileText, UserSquare2,
  Package, Menu, X, Radio, Sparkles, Bell, GitBranchPlus, Search, PlusCircle, Bug, CalendarPlus, BookOpenCheck, PanelsTopLeft, ChevronDown, BadgeCheck, TriangleAlert
} from 'lucide-react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  fetchCommunicationMessages,
  fetchNotifications,
  getMe,
  markAllNotificationsRead,
  markNotificationRead,
} from '../api';
import logo from './logo.png';
import CommandPalette from './CommandPalette';
import NotificationCenter from './NotificationCenter';

const COMMUNICATION_CONVERSATION_ID = 'admin-stream';
const COMMUNICATION_LAST_SEEN_KEY = `communication_last_seen_at_${COMMUNICATION_CONVERSATION_ID}`;
const ROUTE_LABELS = {
  dashboard: 'Dashboard',
  projects: 'Projects',
  meetings: 'Meetings',
  schedule: 'Schedule Meeting',
  hierarchy: 'Mentorship Ops',
  learning: 'Learning Hub',
  programs: 'Programs Hub',
  events: 'Events',
  inventory: 'Inventory',
  community: 'Community',
  profile: 'Profile',
  guidelines: 'Guidelines',
  admin: 'Admin Panel',
  communication: 'Collab Stream',
  apply: 'Application',
  'create-project': 'Create Project',
  add: 'Add',
};

const normalizeRouteKey = (rawPath) => {
  const value = String(rawPath || '/');
  if (value === '/') return '/';
  return value.replace(/\/+$/, '') || '/';
};

export default function Layout() {
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [hasUnreadChat, setHasUnreadChat] = useState(false);
  const [logoMode, setLogoMode] = useState('bundle');
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [notificationBusy, setNotificationBusy] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isCommandOpen, setIsCommandOpen] = useState(false);
  const [commandSeedQuery, setCommandSeedQuery] = useState('');
  const [topSearch, setTopSearch] = useState('');
  const [sidebarAvatarFailed, setSidebarAvatarFailed] = useState(false);
  const [openNavGroups, setOpenNavGroups] = useState({
    core: true,
    growth: true,
    operations: true,
    account: true,
  });
  const location = useLocation();
  const navigate = useNavigate();
  const routerPathRef = useRef('/');
  const mismatchCounterRef = useRef(0);
  
  const profile = JSON.parse(localStorage.getItem('profile') || '{}');
  const [user, setUser] = useState(profile.result || profile);
  const isStrictAdmin = user.role?.toLowerCase() === 'admin';
  const isAdminOrHead = user.role?.toLowerCase() === 'admin' || user.role?.toLowerCase() === 'head';
  const logoSrc = useMemo(() => {
    if (logoMode === 'bundle') return logo;
    if (logoMode === 'public') return '/cicr-logo.png';
    return '';
  }, [logoMode]);

  const routeKey = useMemo(
    () => normalizeRouteKey(`${location.pathname}${location.search}${location.hash}`),
    [location.hash, location.pathname, location.search]
  );

  useEffect(() => {
    routerPathRef.current = routeKey;
  }, [routeKey]);

  // Defensive sync: if the browser URL and router state drift apart, recover automatically.
  useEffect(() => {
    let recoveryTimer = 0;
    const readBrowserPath = () =>
      normalizeRouteKey(`${window.location.pathname}${window.location.search}${window.location.hash}`);

    const syncIfNeeded = () => {
      const browserPath = readBrowserPath();
      const routerPath = routerPathRef.current;
      if (browserPath === routerPath) {
        mismatchCounterRef.current = 0;
        return;
      }

      mismatchCounterRef.current += 1;
      if (mismatchCounterRef.current >= 2) {
        mismatchCounterRef.current = 0;
        navigate(browserPath, { replace: true });
        // If router state is still stale after navigate, force a hard recovery.
        window.clearTimeout(recoveryTimer);
        recoveryTimer = window.setTimeout(() => {
          const latestBrowserPath = readBrowserPath();
          const latestRouterPath = routerPathRef.current;
          if (latestBrowserPath !== latestRouterPath) {
            window.location.replace(latestBrowserPath);
          }
        }, 220);
      }
    };

    const poll = window.setInterval(syncIfNeeded, 500);
    return () => {
      window.clearInterval(poll);
      window.clearTimeout(recoveryTimer);
    };
  }, [navigate]);

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
    setSidebarAvatarFailed(false);
  }, [user.avatarUrl]);

  useEffect(() => {
    if (!isStrictAdmin) {
      setHasUnreadChat(false);
      return;
    }

    const isChatOpen = location.pathname.startsWith('/communication');
    if (isChatOpen) {
      localStorage.setItem(COMMUNICATION_LAST_SEEN_KEY, String(Date.now()));
      // Keep legacy key for compatibility with existing local state.
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
        const { data } = await fetchCommunicationMessages({
          limit: 1,
          conversationId: COMMUNICATION_CONVERSATION_ID,
        });
        const rows = Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : [];
        const latest = rows[rows.length - 1];
        if (!latest?.createdAt) {
          setHasUnreadChat(false);
          return;
        }
        const lastSeen = Number(
          localStorage.getItem(COMMUNICATION_LAST_SEEN_KEY) ||
            localStorage.getItem('communication_last_seen_at') ||
            0
        );
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

  const loadNotifications = useCallback(async (silent = true) => {
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
  }, []);

  useEffect(() => {
    loadNotifications(false);
    const poll = setInterval(() => loadNotifications(true), 30000);
    return () => clearInterval(poll);
  }, [loadNotifications]);

  useEffect(() => {
    setNotificationsOpen(false);
    setIsCommandOpen(false);
  }, [location.pathname]);

  const openNotifications = useCallback(() => {
    setNotificationsOpen(true);
    loadNotifications(false);
  }, [loadNotifications]);

  const closeNotifications = useCallback(() => {
    setNotificationsOpen(false);
  }, []);

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
      closeNotifications();
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

  const openCommandPalette = useCallback(() => {
    closeNotifications();
    setIsMobileOpen(false);
    setCommandSeedQuery('');
    setIsCommandOpen(true);
  }, [closeNotifications]);

  const openCommandPaletteWithQuery = useCallback(
    (value) => {
      closeNotifications();
      setIsMobileOpen(false);
      setCommandSeedQuery(String(value || '').trim());
      setIsCommandOpen(true);
    },
    [closeNotifications]
  );

  const closeNavigationPanels = useCallback(() => {
    setIsMobileOpen(false);
    closeNotifications();
    setIsCommandOpen(false);
  }, [closeNotifications]);

  const isRouteActive = useCallback(
    (path) => location.pathname === path || location.pathname.startsWith(`${path}/`),
    [location.pathname]
  );

  useEffect(() => {
    const onKeyDown = (event) => {
      const key = String(event.key || '').toLowerCase();
      if ((event.metaKey || event.ctrlKey) && key === 'k') {
        event.preventDefault();
        openCommandPalette();
        return;
      }

      if (
        key === '/' &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.altKey &&
        !(event.target instanceof HTMLInputElement) &&
        !(event.target instanceof HTMLTextAreaElement) &&
        !(event.target?.isContentEditable)
      ) {
        event.preventDefault();
        openCommandPaletteWithQuery(topSearch);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [openCommandPalette, openCommandPaletteWithQuery, topSearch]);

  const handleLogoError = () => {
    if (logoMode === 'bundle') {
      setLogoMode('public');
      return;
    }
    setLogoMode('fallback');
  };

  const navGroups = useMemo(
    () => [
      {
        id: 'core',
        label: 'Core Workspace',
        items: [
          { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
          { icon: FolderKanban, label: 'Projects', path: '/projects' },
          { icon: Calendar, label: 'Meetings', path: '/meetings' },
          { icon: Sparkles, label: 'Events', path: '/events' },
          { icon: Package, label: 'Inventory', path: '/inventory' },
        ],
      },
      {
        id: 'growth',
        label: 'Growth & Community',
        items: [
          { icon: GitBranchPlus, label: 'Mentorship Ops', path: '/hierarchy' },
          { icon: BookOpenCheck, label: 'Learning Hub', path: '/learning' },
          { icon: PanelsTopLeft, label: 'Programs Hub', path: '/programs' },
          { icon: Users, label: 'Community', path: '/community' },
        ],
      },
      {
        id: 'operations',
        label: 'Operations',
        items: [
          ...(isStrictAdmin ? [{ icon: Radio, label: 'Collab Stream', path: '/communication' }] : []),
          ...(isAdminOrHead ? [{ icon: ShieldCheck, label: 'Admin Panel', path: '/admin' }] : []),
        ],
      },
      {
        id: 'account',
        label: 'Account',
        items: [
          { icon: UserSquare2, label: 'Profile', path: '/profile' },
          { icon: FileText, label: 'Guidelines', path: '/guidelines' },
        ],
      },
    ],
    [isAdminOrHead, isStrictAdmin]
  );

  const navLinks = useMemo(() => navGroups.flatMap((group) => group.items), [navGroups]);

  useEffect(() => {
    const activeGroup = navGroups.find((group) =>
      group.items.some((item) => isRouteActive(item.path))
    );
    if (!activeGroup) return;

    setOpenNavGroups((prev) =>
      prev[activeGroup.id]
        ? prev
        : {
            ...prev,
            [activeGroup.id]: true,
          }
    );
  }, [isRouteActive, navGroups]);

  const commandItems = useMemo(() => {
    const primary = navLinks.map((item) => ({
      id: `nav-${item.path}`,
      label: item.label,
      subtitle: `Go to ${item.label}`,
      icon: item.icon,
      keywords: `${item.label} ${item.path}`,
      onSelect: () => navigate(item.path),
    }));

    const ops = [
      {
        id: 'cmd-notifications',
        label: 'Open Notifications',
        subtitle: 'Review latest alerts',
        icon: Bell,
        keywords: 'notifications inbox alerts',
        onSelect: () => openNotifications(),
      },
      {
        id: 'cmd-quick-project',
        label: 'Quick Create: Project',
        subtitle: 'Open project initiation flow',
        icon: PlusCircle,
        keywords: 'quick create project new',
        onSelect: () => navigate('/create-project?quick=create'),
      },
      {
        id: 'cmd-quick-meeting',
        label: 'Quick Create: Meeting',
        subtitle: 'Open meeting scheduler',
        icon: CalendarPlus,
        keywords: 'quick create meeting schedule',
        onSelect: () => navigate('/schedule?quick=create'),
      },
      {
        id: 'cmd-quick-event',
        label: 'Quick Create: Event',
        subtitle: 'Open event creation section',
        icon: Sparkles,
        keywords: 'quick create event recruitment',
        onSelect: () => navigate('/events?quick=create'),
      },
      {
        id: 'cmd-quick-issue',
        label: 'Quick Create: Issue Ticket',
        subtitle: 'Raise issue for admin review',
        icon: Bug,
        keywords: 'quick create issue ticket support',
        onSelect: () => navigate('/community?tab=issues&quick=create-issue'),
      },
      {
        id: 'cmd-learning',
        label: 'Open Learning Hub',
        subtitle: 'Tracks, skill tasks, and progress',
        icon: BookOpenCheck,
        keywords: 'learning hub upskill juniors track',
        onSelect: () => navigate('/learning'),
      },
      {
        id: 'cmd-programs',
        label: 'Open Programs Hub',
        subtitle: 'Quests, mentor desk, badges, ideas, office hours',
        icon: PanelsTopLeft,
        keywords: 'programs quests mentor badges ideas office hours',
        onSelect: () => navigate('/programs'),
      },
      {
        id: 'cmd-profile',
        label: 'Open My Profile',
        subtitle: 'Manage personal account details',
        icon: UserSquare2,
        keywords: 'profile settings account',
        onSelect: () => navigate('/profile'),
      },
    ];

    if (user.role?.toLowerCase() === 'admin' || user.role?.toLowerCase() === 'head') {
      ops.push({
        id: 'cmd-admin',
        label: 'Open Admin Panel',
        subtitle: 'Access operations controls',
        icon: ShieldCheck,
        keywords: 'admin approvals recruitment users audit',
        onSelect: () => navigate('/admin'),
      });
    }

    return [...primary, ...ops];
  }, [navLinks, navigate, openNotifications, user.role]);

  const breadcrumbs = useMemo(() => {
    const segments = location.pathname.split('/').filter(Boolean);
    if (segments.length === 0) return [{ label: 'Dashboard', path: '/dashboard' }];

    let accPath = '';
    const rows = segments.map((segment, idx) => {
      accPath += `/${segment}`;
      let label = ROUTE_LABELS[segment];

      if (!label) {
        if (segments[0] === 'projects' && idx === 1) label = 'Project Details';
        else if (segments[0] === 'inventory' && idx === 1 && segments[1] !== 'add' && segments[1] !== 'my-items')
          label = 'Component Details';
        else if (segments[0] === 'profile' && idx === 1) label = 'Public Profile';
        else label = segment.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
      }

      return {
        label,
        path: accPath,
      };
    });

    return rows;
  }, [location.pathname]);

  const navScrollRef = useRef(null);
  const [scrollFade, setScrollFade] = useState({ top: false, bottom: false });

  const handleNavScroll = useCallback(() => {
    const el = navScrollRef.current;
    if (!el) return;
    setScrollFade({
      top: el.scrollTop > 8,
      bottom: el.scrollTop + el.clientHeight < el.scrollHeight - 8,
    });
  }, []);

  useEffect(() => {
    const el = navScrollRef.current;
    if (!el) return;
    handleNavScroll();
    el.addEventListener('scroll', handleNavScroll, { passive: true });
    return () => el.removeEventListener('scroll', handleNavScroll);
  }, [handleNavScroll]);

  const navItemVariants = {
    hidden: { opacity: 0, x: -12 },
    visible: (i) => ({
      opacity: 1,
      x: 0,
      transition: { delay: i * 0.04, duration: 0.3, ease: [0.22, 1, 0.36, 1] },
    }),
  };

  const sidebarContent = (
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
          onClick={closeNavigationPanels}
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

      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.12 }}
        className="relative mb-4 px-2"
      >
        <button
          type="button"
          onClick={openNotifications}
          className="w-full inline-flex items-center justify-between px-3 py-2.5 rounded-xl border border-gray-800 text-gray-300 hover:border-blue-500/40 hover:text-white transition-all duration-200 hover:bg-white/[0.02]"
        >
          <span className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.14em] font-black">
            <Bell size={14} className="text-blue-400" />
            Notifications
          </span>
          {unreadCount > 0 ? (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 400, damping: 15 }}
              className="inline-flex items-center justify-center min-w-5 h-5 px-1 rounded-full bg-blue-500/20 text-[10px] text-blue-200 font-black"
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </motion.span>
          ) : (
            <span className="text-[10px] text-gray-500 uppercase tracking-widest">Clear</span>
          )}
        </button>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.18 }}
        className="mb-4 px-2"
      >
        <button
          type="button"
          onClick={openCommandPalette}
          className="w-full inline-flex items-center justify-between px-3 py-2.5 rounded-xl border border-gray-800 text-gray-300 hover:border-blue-500/40 hover:text-white transition-all duration-200 hover:bg-white/[0.02]"
        >
          <span className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.14em] font-black">
            <Search size={14} className="text-cyan-300" />
            Command Palette
          </span>
          <span className="text-[10px] uppercase tracking-widest text-gray-500">Ctrl/⌘ K</span>
        </button>
      </motion.div>
      
      {/* Main Navigation */}
      <div className={`sidebar-scroll-container flex-1 min-h-0${scrollFade.top ? ' fade-top' : ''}${scrollFade.bottom ? ' fade-bottom' : ''}`}>
        <nav
          ref={navScrollRef}
          className="sidebar-scroll h-full overflow-y-auto pr-1 space-y-2.5"
        >
          {navGroups.map((group, groupIdx) => {
            if (!group.items.length) return null;
            const open = !!openNavGroups[group.id];
            const groupHasActive = group.items.some((item) => isRouteActive(item.path));

            return (
              <motion.section
                key={group.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: 0.08 * groupIdx, ease: [0.22, 1, 0.36, 1] }}
                className="border border-gray-800/70 rounded-2xl overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() =>
                    setOpenNavGroups((prev) => ({
                      ...prev,
                      [group.id]: !prev[group.id],
                    }))
                  }
                  className={`w-full px-3 py-2.5 inline-flex items-center justify-between transition-colors ${
                    groupHasActive ? 'bg-blue-500/10 text-blue-100' : 'text-gray-300 hover:text-white hover:bg-gray-900/70'
                  }`}
                >
                  <span className="text-[10px] uppercase tracking-[0.16em] font-black">{group.label}</span>
                  <motion.span
                    animate={{ rotate: open ? 180 : 0 }}
                    transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                  >
                    <ChevronDown
                      size={14}
                      className={open ? 'text-blue-300' : 'text-gray-500'}
                    />
                  </motion.span>
                </button>

                <AnimatePresence initial={false}>
                  {open && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                      className="border-t border-gray-800/70 overflow-hidden"
                    >
                      <div className="p-2 space-y-1.5">
                        {group.items.map((link, linkIdx) => {
                          const active = isRouteActive(link.path);
                          return (
                            <NavLink key={link.path} to={link.path} onClick={closeNavigationPanels}>
                              <motion.div
                                custom={linkIdx}
                                variants={navItemVariants}
                                initial="hidden"
                                animate="visible"
                                whileHover={{ x: 4, transition: { duration: 0.15 } }}
                                className={`nav-item-hover flex items-center justify-between p-2.5 rounded-xl ${
                                  active
                                    ? 'nav-active-glow nav-active-indicator text-white'
                                    : 'text-gray-400 hover:text-gray-100'
                                }`}
                              >
                                <div className="flex items-center gap-2.5">
                                  <motion.span
                                    animate={active ? { scale: [1, 1.15, 1] } : {}}
                                    transition={{ duration: 0.4 }}
                                  >
                                    <link.icon size={18} />
                                  </motion.span>
                                  <span className="text-sm font-medium">{link.label}</span>
                                </div>
                                {link.path === '/communication' && hasUnreadChat && (
                                  <motion.span
                                    animate={{ scale: [1, 1.2, 1] }}
                                    transition={{ duration: 1.5, repeat: Infinity }}
                                    className="inline-block w-2.5 h-2.5 rounded-full bg-red-500"
                                    title="Unread messages"
                                  />
                                )}
                              </motion.div>
                            </NavLink>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.section>
            );
          })}
        </nav>
      </div>

      {/* Footer Profile Section */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.25 }}
        className="mt-auto pt-6 border-t border-white/5 space-y-4"
      >
        <Link to="/profile" onClick={closeNavigationPanels}>
          <div className="sidebar-profile-card group px-3 py-3 rounded-xl border border-white/8 bg-white/3 backdrop-blur-sm cursor-pointer">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-gradient-to-br from-blue-600/20 to-purple-600/20 border border-blue-500/30 rounded-lg flex items-center justify-center text-blue-400 font-black overflow-hidden">
                {user.avatarUrl && !sidebarAvatarFailed ? (
                  <img
                    src={user.avatarUrl}
                    alt={user.name || 'Member'}
                    className="h-full w-full object-cover"
                    onError={() => setSidebarAvatarFailed(true)}
                  />
                ) : (
                  <span>{user.name?.[0] || 'M'}</span>
                )}
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
        </Link>
      </motion.div>
    </>
  );

  return (
    <div className="flex min-h-screen mesh-bg text-white">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex w-64 border-r border-gray-800/50 p-6 flex-col fixed h-full z-20 sidebar-bg">
        {sidebarContent}
      </aside>

      {/* Mobile Top Nav */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-16 backdrop-blur-xl border-b border-white/5 flex items-center justify-between px-6 z-30 mobile-nav-bg">
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
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={openNotifications}
            className="relative p-2 text-gray-400 hover:text-white"
            aria-label="Open notifications"
          >
            <Bell size={20} />
            {unreadCount > 0 ? (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 400, damping: 15 }}
                className="absolute top-1 right-1 min-w-4 h-4 px-1 rounded-full bg-blue-500/30 text-[9px] text-blue-100 font-black inline-flex items-center justify-center"
              >
                {unreadCount > 9 ? '9+' : unreadCount}
              </motion.span>
            ) : null}
          </button>
          <button
            type="button"
            onClick={openCommandPalette}
            className="p-2 text-gray-400 hover:text-white"
            aria-label="Open command palette"
          >
            <Search size={20} />
          </button>
          <button onClick={() => setIsMobileOpen(!isMobileOpen)} className="p-2 text-gray-400 hover:text-white transition-colors" aria-label="Toggle menu">
            <motion.span
              key={isMobileOpen ? 'close' : 'menu'}
              initial={{ rotate: -90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              transition={{ duration: 0.2 }}
            >
              {isMobileOpen ? <X size={24} /> : <Menu size={24} />}
            </motion.span>
          </button>
        </div>
      </div>

      {/* Mobile Sidebar Drawer */}
      <AnimatePresence>
        {isMobileOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              onClick={() => setIsMobileOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
            />
            <motion.aside 
              initial={{ x: '-100%', opacity: 0.5 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: '-100%', opacity: 0 }}
              transition={{ type: 'spring', damping: 28, stiffness: 260, mass: 0.8 }}
              className="fixed top-0 left-0 bottom-0 w-72 p-6 z-50 flex flex-col border-r border-white/5 lg:hidden sidebar-bg overflow-hidden"
            >
              {sidebarContent}
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main Content Area */}
      <main className="flex-1 lg:ml-64 p-4 md:p-8 pt-24 lg:pt-8 min-h-screen relative overflow-x-hidden">
        {/* Aesthetic Background Glow */}
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-blue-600/8 blur-[160px] rounded-full -z-10 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-purple-600/5 blur-[140px] rounded-full -z-10 pointer-events-none" />

        {(() => {
          const missing = [];
          const isAlumni = String(user?.role || '').toLowerCase() === 'alumni';
          if (!String(user?.branch || '').trim()) missing.push('Branch');
          if (!String(user?.batch || '').trim()) missing.push('Batch');
          if (isAlumni) {
            if (!Number.isFinite(Number(user?.alumniProfile?.graduationYear))) {
              missing.push('Graduation Year');
            }
          } else if (!Number.isFinite(Number(user?.year)) || Number(user?.year) <= 0) {
            missing.push('Year');
          }
          if (!String(user?.phone || '').trim()) missing.push('Phone');
          const complete = missing.length === 0;

          return (
            <div
              className={`mb-4 md:mb-5 rounded-xl border px-3 py-2.5 text-xs md:text-sm inline-flex items-center gap-2 ${
                complete
                  ? 'border-emerald-500/35 bg-emerald-500/10 text-emerald-200'
                  : 'border-amber-500/35 bg-amber-500/10 text-amber-200'
              }`}
            >
              {complete ? <BadgeCheck size={14} /> : <TriangleAlert size={14} />}
              {complete
                ? 'Profile essentials complete.'
                : `Complete your profile: add ${missing.join(', ')}.`}
            </div>
          );
        })()}

        <div className="mb-4 md:mb-6 flex items-center justify-between gap-3">
          <nav className="inline-flex items-center flex-wrap gap-2 text-[10px] md:text-xs uppercase tracking-widest text-gray-500">
            <Link to="/dashboard" className="hover:text-gray-200 transition-colors">
              Home
            </Link>
            {breadcrumbs.map((crumb, idx) => {
              const isLast = idx === breadcrumbs.length - 1;
              return (
                <span key={`${crumb.path}-${idx}`} className="inline-flex items-center gap-2">
                  <span>/</span>
                  {isLast ? (
                    <span className="text-gray-200">{crumb.label}</span>
                  ) : (
                    <Link to={crumb.path} className="hover:text-gray-200 transition-colors">
                      {crumb.label}
                    </Link>
                  )}
                </span>
              );
            })}
          </nav>
          <div className="hidden md:flex items-center gap-2">
            <form
              onSubmit={(event) => {
                event.preventDefault();
                openCommandPaletteWithQuery(topSearch);
              }}
              className="relative"
            >
              <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                value={topSearch}
                onChange={(event) => setTopSearch(event.target.value)}
                className="ui-input !py-1.5 !pl-8 !pr-2 !text-xs min-w-[220px]"
                placeholder="Search pages/actions..."
                aria-label="Global search"
              />
            </form>
            <button
              type="button"
              onClick={() => openCommandPaletteWithQuery(topSearch)}
              className="inline-flex items-center gap-2 border border-gray-800 rounded-lg px-2.5 py-1.5 text-[10px] uppercase tracking-widest text-gray-400 hover:text-gray-200 hover:border-gray-700"
              aria-label="Open command palette"
            >
              <Search size={12} />
              Ctrl/⌘ K
            </button>
          </div>
        </div>
        
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={routeKey}
            initial={{ opacity: 0, y: 14, filter: 'blur(6px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            exit={{ opacity: 0, y: -10, filter: 'blur(4px)' }}
            transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
          >
            <Outlet />
          </motion.div>
        </AnimatePresence>
      </main>

      <NotificationCenter
        open={notificationsOpen}
        onClose={closeNotifications}
        items={notifications}
        loading={notificationBusy}
        unreadCount={unreadCount}
        onRefresh={() => loadNotifications(false)}
        onReadAll={handleMarkAllNotificationsRead}
        onReadItem={handleReadNotification}
      />

      <CommandPalette
        open={isCommandOpen}
        onClose={() => setIsCommandOpen(false)}
        commands={commandItems}
        initialQuery={commandSeedQuery}
      />
    </div>
  );
}
