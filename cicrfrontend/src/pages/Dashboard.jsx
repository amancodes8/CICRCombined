import { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  BarChart3,
  BookOpenCheck,
  Building2,
  CalendarDays,
  ChevronDown,
  ChevronUp,
  Clock3,
  FolderKanban,
  GraduationCap,
  Handshake,
  IdCard,
  Loader2,
  Mail,
  MapPin,
  MessageSquareText,
  Phone,
  ShieldCheck,
  Sparkles,
  Target,
  Users,
} from 'lucide-react';
import {
  fetchApplications,
  fetchDirectoryMembers,
  fetchLearningOverview,
  fetchMeetings,
  fetchMyInsights,
  fetchPosts,
  fetchProjects,
} from '../api';
import PageHeader from '../components/PageHeader';

const TIME_WINDOWS = [
  { id: 'today', label: 'Today' },
  { id: '7d', label: '7 days' },
  { id: '30d', label: '30 days' },
  { id: 'all', label: 'All' },
];

const ROLE_OPTIONS = [
  { id: 'all', label: 'All roles' },
  { id: 'admin', label: 'Admin' },
  { id: 'head', label: 'Head' },
  { id: 'user', label: 'Member' },
  { id: 'alumni', label: 'Alumni' },
];

const PROJECT_STATUS_OPTIONS = ['all', 'planning', 'active', 'on-hold', 'delayed', 'awaiting review', 'completed', 'archived', 'ongoing'];
const SECTION_KEYS = ['timeline', 'meetings', 'projects', 'discussions'];

const fmtDate = (d) => {
  const parsed = new Date(d);
  if (Number.isNaN(parsed.getTime())) return 'TBD';
  return parsed.toLocaleDateString();
};

const fmtTime = (d) => {
  const parsed = new Date(d);
  if (Number.isNaN(parsed.getTime())) return '--:--';
  return parsed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const toMs = (value) => {
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : NaN;
};

const isSameDay = (a, b) => {
  const left = new Date(a);
  const right = new Date(b);
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
};

const inTimeWindow = (value, windowId) => {
  if (windowId === 'all') return true;
  const timestamp = toMs(value);
  if (!Number.isFinite(timestamp)) return false;
  const now = Date.now();
  if (windowId === 'today') return isSameDay(timestamp, now);
  if (windowId === '7d') return timestamp >= now - 7 * 24 * 60 * 60 * 1000;
  if (windowId === '30d') return timestamp >= now - 30 * 24 * 60 * 60 * 1000;
  return true;
};

const normalizeRole = (value) => String(value || '').trim().toLowerCase();

const matchesRole = (roleValue, filterValue) => {
  if (filterValue === 'all') return true;
  return normalizeRole(roleValue) === filterValue;
};

const statusBadgeClass = (status) => {
  const normalized = String(status || '').trim().toLowerCase();
  if (normalized === 'completed' || normalized === 'selected' || normalized === 'approved') {
    return 'text-emerald-200 border-emerald-500/35 bg-emerald-500/10';
  }
  if (normalized === 'awaiting review' || normalized === 'interview' || normalized === 'accepted') {
    return 'text-amber-200 border-amber-500/35 bg-amber-500/10';
  }
  if (normalized === 'delayed' || normalized === 'on-hold' || normalized === 'rejected' || normalized === 'cancelled') {
    return 'text-rose-200 border-rose-500/35 bg-rose-500/10';
  }
  return 'text-cyan-100 border-cyan-500/35 bg-cyan-500/10';
};

const trendDelta = (items, dateAccessor, days = 7) => {
  const now = Date.now();
  const currentStart = now - days * 24 * 60 * 60 * 1000;
  const previousStart = now - days * 2 * 24 * 60 * 60 * 1000;

  let current = 0;
  let previous = 0;
  for (const item of items) {
    const timestamp = toMs(dateAccessor(item));
    if (!Number.isFinite(timestamp)) continue;
    if (timestamp >= currentStart && timestamp <= now) {
      current += 1;
      continue;
    }
    if (timestamp >= previousStart && timestamp < currentStart) {
      previous += 1;
    }
  }
  return current - previous;
};

function DashboardSkeleton() {
  return (
    <div className="ui-page pb-16 space-y-5 page-motion-a">
      <div className="h-20 border-b border-gray-800 bg-[#0a0e14] animate-pulse" />
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={`kpi-skeleton-${index}`} className="h-24 border-y border-gray-800 bg-[#090d13] animate-pulse" />
        ))}
      </div>
      <div className="h-14 border-y border-gray-800 bg-[#090d13] animate-pulse" />
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.42fr)_340px] gap-6">
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={`section-skeleton-${index}`} className="h-56 border-y border-gray-800 bg-[#080d12] animate-pulse" />
          ))}
        </div>
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={`rail-skeleton-${index}`} className="h-44 border-y border-gray-800 bg-[#080d12] animate-pulse" />
          ))}
        </div>
      </div>
    </div>
  );
}

function KpiTile({ label, value, delta, hint, tone = 'cyan', icon: Icon = BarChart3, index = 0 }) {
  const toneMap = {
    cyan: {
      accent: 'from-cyan-300 to-blue-400',
      ring: 'border-cyan-500/35',
      icon: 'text-cyan-200 bg-cyan-500/10 border-cyan-500/35',
    },
    blue: {
      accent: 'from-blue-300 to-indigo-400',
      ring: 'border-blue-500/35',
      icon: 'text-blue-200 bg-blue-500/10 border-blue-500/35',
    },
    amber: {
      accent: 'from-amber-300 to-orange-400',
      ring: 'border-amber-500/35',
      icon: 'text-amber-200 bg-amber-500/10 border-amber-500/35',
    },
    emerald: {
      accent: 'from-emerald-300 to-teal-400',
      ring: 'border-emerald-500/35',
      icon: 'text-emerald-200 bg-emerald-500/10 border-emerald-500/35',
    },
  };

  const theme = toneMap[tone] || toneMap.cyan;
  const deltaTone = delta > 0 ? 'text-emerald-300' : delta < 0 ? 'text-rose-300' : 'text-gray-400';
  const deltaPrefix = delta > 0 ? '+' : '';

  return (
    <motion.article
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.44, delay: 0.06 + index * 0.05, ease: 'easeOut' }}
      className={`px-3 py-3 md:px-4 md:py-3.5 border-y ${theme.ring}`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-[0.14em] text-gray-400 font-semibold truncate">{label}</p>
          <p className="text-3xl md:text-[2.1rem] font-black tracking-tight text-white mt-1">{value}</p>
        </div>
        <span className={`inline-flex items-center justify-center w-9 h-9 rounded-lg border ${theme.icon}`}>
          <Icon size={15} />
        </span>
      </div>
      <div className="mt-2 flex items-center justify-between gap-2">
        <p className="text-xs text-gray-500 truncate">{hint || 'Current operational signal'}</p>
        <p className={`text-xs font-semibold whitespace-nowrap ${deltaTone}`}>
          {deltaPrefix}
          {delta}
        </p>
      </div>
      <div className="mt-2 h-1 bg-white/5 overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(100, Math.max(16, Math.abs(Number(delta || 0)) * 8 + 22))}%` }}
          transition={{ duration: 0.8, delay: 0.1 + index * 0.05 }}
          className={`h-full bg-linear-to-r ${theme.accent}`}
        />
      </div>
    </motion.article>
  );
}

function SectionShell({ title, subtitle, badge, action, collapsed, onToggle, children, index = 0 }) {
  const reduceMotion = useReducedMotion();
  const motionProps = reduceMotion
    ? {}
    : {
        initial: { opacity: 0, y: 24 },
        whileInView: { opacity: 1, y: 0 },
        viewport: { once: true, amount: 0.18 },
        transition: { duration: 0.55, delay: index * 0.06, ease: [0.22, 1, 0.36, 1] },
      };

  return (
    <motion.section {...motionProps} className="border-y border-gray-800/80 overflow-hidden">
      <header className="px-4 md:px-5 py-3 border-b border-gray-800/75 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-white">{title}</h3>
          <p className="text-sm text-gray-400 mt-0.5">{subtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          {badge ? (
            <span className="text-xs px-2.5 py-1 rounded-full border border-cyan-500/35 text-cyan-200 bg-cyan-500/10">
              {badge}
            </span>
          ) : null}
          {action}
          <button
            type="button"
            onClick={onToggle}
            aria-label={collapsed ? `Expand ${title}` : `Collapse ${title}`}
            className="lg:hidden p-2 rounded-lg border border-gray-700/80 text-gray-300"
          >
            {collapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
          </button>
        </div>
      </header>

      <AnimatePresence initial={false}>
        {!collapsed ? (
          <motion.div
            key={`${title}-content`}
            initial={reduceMotion ? false : { opacity: 0, height: 0 }}
            animate={reduceMotion ? undefined : { opacity: 1, height: 'auto' }}
            exit={reduceMotion ? undefined : { opacity: 0, height: 0 }}
            transition={{ duration: 0.28, ease: 'easeOut' }}
            className="px-4 md:px-5 py-4"
          >
            {children}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </motion.section>
  );
}

function EmptyInline({ title, ctaLabel, to }) {
  return (
    <div className="py-4 text-sm text-gray-500">
      <p>{title}</p>
      {to ? (
        <Link to={to} className="inline-flex mt-2 text-sm font-semibold text-cyan-200">
          {ctaLabel || 'Open'}
        </Link>
      ) : null}
    </div>
  );
}

export default function Dashboard() {
  const profile = JSON.parse(localStorage.getItem('profile') || '{}');
  const userData = profile.result || profile;
  const role = normalizeRole(userData.role);
  const year = Number(userData.year);
  const isAdminOrHead = role === 'admin' || role === 'head';
  const isAlumni = role === 'alumni';
  const isJuniorMember = role === 'user' && (year === 1 || year === 2);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [posts, setPosts] = useState([]);
  const [projects, setProjects] = useState([]);
  const [meetings, setMeetings] = useState([]);
  const [insights, setInsights] = useState(null);
  const [applications, setApplications] = useState([]);
  const [directoryMembers, setDirectoryMembers] = useState([]);
  const [learningOverview, setLearningOverview] = useState(null);

  const [timeWindow, setTimeWindow] = useState('7d');
  const [roleFilter, setRoleFilter] = useState('all');
  const [projectStatusFilter, setProjectStatusFilter] = useState('all');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [collapsed, setCollapsed] = useState(
    SECTION_KEYS.reduce((acc, key) => {
      acc[key] = false;
      return acc;
    }, {})
  );

  const toggleSection = (key) => {
    setCollapsed((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const requests = [
        fetchPosts(),
        fetchProjects(),
        fetchMeetings(),
        fetchMyInsights(),
        isAdminOrHead ? fetchApplications() : Promise.resolve({ data: [] }),
        isAlumni || isAdminOrHead ? fetchDirectoryMembers() : Promise.resolve({ data: [] }),
        isJuniorMember ? fetchLearningOverview() : Promise.resolve({ data: null }),
      ];

      const [postRes, projectRes, meetingRes, insightRes, appRes, directoryRes, learningRes] =
        await Promise.allSettled(requests);

      setPosts(postRes.status === 'fulfilled' && Array.isArray(postRes.value?.data) ? postRes.value.data : []);
      setProjects(projectRes.status === 'fulfilled' && Array.isArray(projectRes.value?.data) ? projectRes.value.data : []);
      setMeetings(meetingRes.status === 'fulfilled' && Array.isArray(meetingRes.value?.data) ? meetingRes.value.data : []);
      setInsights(insightRes.status === 'fulfilled' ? insightRes.value?.data || null : null);
      setApplications(appRes.status === 'fulfilled' && Array.isArray(appRes.value?.data) ? appRes.value.data : []);
      setDirectoryMembers(
        directoryRes.status === 'fulfilled' && Array.isArray(directoryRes.value?.data) ? directoryRes.value.data : []
      );
      setLearningOverview(learningRes.status === 'fulfilled' ? learningRes.value?.data || null : null);

      const criticalFailures = [postRes, projectRes, meetingRes].filter((result) => result.status === 'rejected').length;
      if (criticalFailures >= 2) {
        setLoadError('Dashboard data is partially unavailable. Please retry.');
      }
    } catch {
      setLoadError('Unable to load dashboard right now.');
    } finally {
      setLoading(false);
    }
  }, [isAdminOrHead, isAlumni, isJuniorMember]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const member = insights?.member || userData || {};
  const metrics = insights?.metrics || {};
  const alumniProfile = member?.alumniProfile || userData.alumniProfile || {};

  const filteredMeetings = useMemo(
    () =>
      [...meetings]
        .filter((row) => inTimeWindow(row.startTime, timeWindow))
        .sort((a, b) => toMs(a.startTime) - toMs(b.startTime))
        .slice(0, 8),
    [meetings, timeWindow]
  );

  const filteredProjects = useMemo(
    () =>
      [...projects]
        .filter((row) => inTimeWindow(row.updatedAt || row.createdAt || row.deadline, timeWindow))
        .filter((row) => (projectStatusFilter === 'all' ? true : String(row.status || '').toLowerCase() === projectStatusFilter))
        .filter((row) => {
          if (roleFilter === 'all') return true;
          const leadRole = normalizeRole(row?.lead?.role);
          return !leadRole ? true : leadRole === roleFilter;
        })
        .sort((a, b) => toMs(a.deadline) - toMs(b.deadline))
        .slice(0, 10),
    [projects, projectStatusFilter, roleFilter, timeWindow]
  );

  const filteredPosts = useMemo(
    () =>
      [...posts]
        .filter((row) => inTimeWindow(row.createdAt, timeWindow))
        .filter((row) => {
          if (roleFilter === 'all') return true;
          return matchesRole(row?.user?.role, roleFilter);
        })
        .sort((a, b) => toMs(b.createdAt) - toMs(a.createdAt))
        .slice(0, 8),
    [posts, roleFilter, timeWindow]
  );

  const filteredApplications = useMemo(
    () =>
      [...applications]
        .filter((row) => inTimeWindow(row.updatedAt || row.createdAt, timeWindow))
        .sort((a, b) => toMs(b.updatedAt || b.createdAt) - toMs(a.updatedAt || a.createdAt)),
    [applications, timeWindow]
  );

  const activityTimeline = useMemo(() => {
    const timeline = [];

    for (const project of projects) {
      const time = project.updatedAt || project.createdAt || project.deadline;
      if (!inTimeWindow(time, timeWindow)) continue;
      if (projectStatusFilter !== 'all' && String(project.status || '').toLowerCase() !== projectStatusFilter) continue;
      if (roleFilter !== 'all' && !matchesRole(project?.lead?.role, roleFilter)) continue;

      timeline.push({
        id: `project-${project._id}`,
        time,
        actor: project?.lead?.name || 'Project Lead',
        actorRole: project?.lead?.role || '',
        title: `${project.title} • ${project.status || 'Planning'}`,
        detail: `Progress ${Math.round(Number(project.progress || 0))}% • Stage ${project.stage || 'Planning'}`,
        status: project.status || 'Planning',
      });
    }

    for (const meeting of meetings) {
      if (!inTimeWindow(meeting.startTime, timeWindow)) continue;
      timeline.push({
        id: `meeting-${meeting._id}`,
        time: meeting.startTime,
        actor: meeting?.createdBy?.name || 'Coordinator',
        actorRole: meeting?.createdBy?.role || '',
        title: `${meeting.title} scheduled`,
        detail: `${meeting.meetingType || 'Session'} • ${fmtDate(meeting.startTime)} ${fmtTime(meeting.startTime)}`,
        status: 'Scheduled',
      });
    }

    for (const post of posts) {
      if (!inTimeWindow(post.createdAt, timeWindow)) continue;
      if (roleFilter !== 'all' && !matchesRole(post?.user?.role, roleFilter)) continue;
      timeline.push({
        id: `post-${post._id}`,
        time: post.createdAt,
        actor: post?.user?.name || 'Member',
        actorRole: post?.user?.role || '',
        title: `${post.type || 'Update'} posted`,
        detail: post.content ? String(post.content).slice(0, 120) : 'Community update',
        status: post.type || 'Active',
      });
    }

    for (const application of applications) {
      if (!inTimeWindow(application.updatedAt || application.createdAt, timeWindow)) continue;
      timeline.push({
        id: `application-${application._id}`,
        time: application.updatedAt || application.createdAt,
        actor: application.fullName || 'Applicant',
        actorRole: 'Applicant',
        title: `Application moved to ${application.status || 'New'}`,
        detail: application.stage ? `Stage: ${application.stage}` : `Email: ${application.email || 'N/A'}`,
        status: application.status || 'New',
      });
    }

    return timeline
      .sort((a, b) => toMs(b.time) - toMs(a.time))
      .slice(0, isAdminOrHead ? 14 : 10);
  }, [applications, isAdminOrHead, meetings, posts, projectStatusFilter, projects, roleFilter, timeWindow]);

  const applicationStats = useMemo(() => {
    const base = { total: filteredApplications.length, new: 0, interview: 0, accepted: 0, selected: 0 };
    filteredApplications.forEach((app) => {
      if (app.status === 'New') base.new += 1;
      if (app.status === 'Interview') base.interview += 1;
      if (app.status === 'Accepted') base.accepted += 1;
      if (app.status === 'Selected') base.selected += 1;
    });
    return base;
  }, [filteredApplications]);

  const juniorRecommendations = useMemo(
    () => (Array.isArray(learningOverview?.recommendedTasks) ? learningOverview.recommendedTasks.slice(0, 5) : []),
    [learningOverview?.recommendedTasks]
  );

  const alumniTenures = useMemo(
    () =>
      (Array.isArray(alumniProfile?.tenures) ? alumniProfile.tenures : [])
        .filter((row) => row?.position && row?.fromYear && row?.toYear)
        .sort((a, b) => Number(a.fromYear || 0) - Number(b.fromYear || 0)),
    [alumniProfile?.tenures]
  );

  const projectPulse = useMemo(() => {
    const total = Math.max(1, filteredProjects.length);
    const completed = filteredProjects.filter((row) => String(row.status || '').toLowerCase() === 'completed').length;
    const atRisk = filteredProjects.filter((row) => ['delayed', 'on-hold'].includes(String(row.status || '').toLowerCase())).length;
    const active = Math.max(0, filteredProjects.length - completed - atRisk);
    return [
      { label: 'Completed', value: completed, percent: Math.round((completed / total) * 100), tone: 'from-emerald-400 to-teal-400' },
      { label: 'Active', value: active, percent: Math.round((active / total) * 100), tone: 'from-cyan-400 to-blue-400' },
      { label: 'At Risk', value: atRisk, percent: Math.round((atRisk / total) * 100), tone: 'from-rose-400 to-orange-400' },
    ];
  }, [filteredProjects]);

  const kpiConfig = useMemo(
    () => [
      {
        label: 'Projects',
        value: filteredProjects.length,
        delta: trendDelta(projects, (row) => row.updatedAt || row.createdAt || row.deadline),
        tone: 'cyan',
        icon: FolderKanban,
        hint: 'Delivery tracks in current scope',
      },
      {
        label: 'Meetings',
        value: filteredMeetings.length,
        delta: trendDelta(meetings, (row) => row.startTime),
        tone: 'blue',
        icon: CalendarDays,
        hint: 'Session cadence this window',
      },
      {
        label: 'Discussions',
        value: filteredPosts.length,
        delta: trendDelta(posts, (row) => row.createdAt),
        tone: 'amber',
        icon: MessageSquareText,
        hint: 'Community communication volume',
      },
      isAdminOrHead
        ? {
            label: 'Recruitment',
            value: applicationStats.total,
            delta: trendDelta(applications, (row) => row.updatedAt || row.createdAt),
            tone: 'emerald',
            icon: Target,
            hint: 'Pipeline movement this window',
          }
        : {
            label: 'Learning Points',
            value: Number(learningOverview?.stats?.myPoints || 0),
            delta: Number(learningOverview?.stats?.myApprovedTasks || 0),
            tone: 'emerald',
            icon: BookOpenCheck,
            hint: 'Approved task outcomes',
          },
    ],
    [
      applicationStats.total,
      applications,
      filteredMeetings.length,
      filteredPosts.length,
      filteredProjects.length,
      isAdminOrHead,
      learningOverview?.stats?.myApprovedTasks,
      learningOverview?.stats?.myPoints,
      meetings,
      posts,
      projects,
    ]
  );

  const quickActions = useMemo(() => {
    const base = [
      { to: '/community?tab=issues', label: 'Raise Issue' },
      { to: '/meetings', label: 'Open Meetings' },
      { to: '/projects', label: 'Project Workspace' },
      { to: '/community', label: 'Community Feed' },
    ];
    if (isAdminOrHead) {
      return [
        { to: '/admin', label: 'Admin Console' },
        { to: '/events', label: 'Create Event' },
        { to: '/schedule', label: 'Schedule Meeting' },
        ...base,
      ];
    }
    if (isJuniorMember) {
      return [
        { to: '/learning', label: 'Learning Hub' },
        { to: '/programs', label: 'Programs Hub' },
        { to: '/hierarchy', label: 'Mentorship Tasks' },
        ...base,
      ];
    }
    if (isAlumni) {
      return [
        { to: '/community?tab=directory', label: 'Member Directory' },
        { to: '/events', label: 'Events' },
        ...base,
      ];
    }
    return base;
  }, [isAdminOrHead, isAlumni, isJuniorMember]);

  if (loading) return <DashboardSkeleton />;

  return (
    <div className="ui-page pb-24 space-y-8 page-motion-c relative">
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease: 'easeOut' }}
        className="relative overflow-hidden border-b border-cyan-500/30 bg-linear-to-br from-[#0a131e] via-[#09111a] to-[#080d14] section-motion section-motion-delay-1"
      >
        <div className="relative z-10 px-4 md:px-6 py-6 md:py-7">
          <PageHeader
            eyebrow={isAlumni ? 'Alumni Command Center' : 'CICR Operations Dashboard'}
            title={isAlumni ? `Welcome Back, ${member?.name || 'Alumni Member'}` : 'Operational Command Center'}
            subtitle="Live, role-based intelligence across projects, meetings, discussions, and recruitment movement."
            icon={isAlumni ? Handshake : Activity}
            actions={
              <>
                <Link to="/projects" className="btn btn-primary">Projects</Link>
                <Link to="/events" className="btn btn-secondary">Events</Link>
                {isAdminOrHead ? <Link to="/admin" className="btn btn-secondary">Admin</Link> : null}
              </>
            }
            badge={
              <>
                <Sparkles size={12} className="text-cyan-300" />
                Synced command view
              </>
            }
          />

          <div className="mt-4 flex flex-wrap gap-2">
            <span className="px-2.5 py-1 rounded-full border border-gray-700 text-gray-300 text-xs">
              {isAlumni ? 'Alumni View' : isAdminOrHead ? 'Admin View' : 'Member View'}
            </span>
            <span className="px-2.5 py-1 rounded-full border border-cyan-500/35 bg-cyan-500/10 text-cyan-200 text-xs">
              {filteredProjects.length} projects in scope
            </span>
            <span className="px-2.5 py-1 rounded-full border border-blue-500/35 bg-blue-500/10 text-blue-200 text-xs">
              {filteredMeetings.length} meetings in scope
            </span>
            <span className="px-2.5 py-1 rounded-full border border-amber-500/35 bg-amber-500/10 text-amber-200 text-xs">
              {filteredPosts.length} discussions visible
            </span>
          </div>
        </div>
      </motion.section>

      {loadError ? (
        <section className="border border-amber-500/35 bg-amber-500/10 rounded-xl px-4 py-3 flex items-center justify-between gap-3">
          <p className="text-sm text-amber-100">{loadError}</p>
          <button type="button" onClick={loadDashboard} className="btn btn-secondary w-auto! text-xs!">
            <Loader2 size={12} /> Retry
          </button>
        </section>
      ) : null}

      <section className="sticky top-3 z-20 border-y border-gray-800/80 bg-[#070c12]/88 backdrop-blur-md px-1 py-2 section-motion section-motion-delay-2">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
          {kpiConfig.map((kpi, index) => (
            <KpiTile
              key={kpi.label}
              label={kpi.label}
              value={kpi.value}
              delta={kpi.delta}
              tone={kpi.tone}
              icon={kpi.icon}
              hint={kpi.hint}
              index={index}
            />
          ))}
        </div>
      </section>

      <motion.section
        initial={{ opacity: 0, y: 14 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.3 }}
        transition={{ duration: 0.45 }}
        className="border-y border-gray-800/75 px-2 py-4 section-motion section-motion-delay-2"
      >
        <div className="space-y-4">
          <div>
            <p className="text-xs text-gray-400 font-semibold mb-1.5">Time Window</p>
            <div className="flex flex-wrap gap-2">
              {TIME_WINDOWS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  aria-label={`Filter time window ${option.label}`}
                  onClick={() => setTimeWindow(option.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                    timeWindow === option.id
                      ? 'border-cyan-500/45 text-cyan-100 bg-cyan-500/10'
                      : 'border-gray-800 text-gray-500 hover:text-gray-300'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-gray-400 font-semibold">Advanced Filters</p>
            <button
              type="button"
              onClick={() => setShowAdvancedFilters((prev) => !prev)}
              className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-gray-700 text-gray-300 hover:text-white"
              aria-expanded={showAdvancedFilters}
              aria-controls="dashboard-advanced-filters"
            >
              {showAdvancedFilters ? 'Hide' : 'Show'}
              {showAdvancedFilters ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            </button>
          </div>

          {showAdvancedFilters ? (
            <div id="dashboard-advanced-filters" className="grid grid-cols-1 lg:grid-cols-[auto_1fr] gap-4 items-start lg:items-center">
              <div>
                <p className="text-xs text-gray-400 font-semibold mb-1.5">Role Scope</p>
                <select
                  aria-label="Role scope filter"
                  value={roleFilter}
                  onChange={(event) => setRoleFilter(event.target.value)}
                  className="ui-input py-2! text-xs! max-w-48"
                >
                  {ROLE_OPTIONS.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <p className="text-xs text-gray-400 font-semibold mb-1.5">Project Status</p>
                <div className="flex flex-wrap gap-2">
                  {PROJECT_STATUS_OPTIONS.map((status) => (
                    <button
                      key={status}
                      type="button"
                      aria-label={`Filter project status ${status}`}
                      onClick={() => setProjectStatusFilter(status)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                        projectStatusFilter === status
                          ? 'border-blue-500/45 text-blue-100 bg-blue-500/10'
                          : 'border-gray-800 text-gray-500 hover:text-gray-300'
                      }`}
                    >
                      {status}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </motion.section>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.45fr)_340px] gap-7 section-motion section-motion-delay-3">
        <main className="space-y-5">
          <SectionShell
            title="Activity Timeline"
            subtitle={isAdminOrHead ? 'Who changed what, when, with context and status.' : 'Recent operational changes relevant to your workspace.'}
            badge={`${activityTimeline.length} entries`}
            collapsed={collapsed.timeline}
            onToggle={() => toggleSection('timeline')}
            action={isAdminOrHead ? <span className="text-xs font-semibold text-emerald-300">Admin trace</span> : null}
            index={0}
          >
            {activityTimeline.length === 0 ? (
              <EmptyInline title="No timeline entries for the current filters." ctaLabel="Reset filters" to="/dashboard" />
            ) : (
              <div className="space-y-2">
                {activityTimeline.map((entry, index) => (
                  <motion.article
                    key={entry.id}
                    initial={{ opacity: 0, x: -12 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true, amount: 0.6 }}
                    transition={{ duration: 0.3, delay: index * 0.02 }}
                    className="grid grid-cols-[auto_minmax(0,1fr)_auto] gap-3 py-2.5 px-2 rounded-lg hover:bg-white/3 transition-colors"
                  >
                    <span className="mt-1.5 w-2 h-2 rounded-full bg-cyan-400" />
                    <div className="min-w-0">
                      <p className="text-sm text-white font-semibold truncate">{entry.title}</p>
                      <p className="text-sm text-gray-300 mt-1 truncate">{entry.detail}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        {entry.actor}
                        {entry.actorRole ? ` • ${entry.actorRole}` : ''}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className={`text-xs px-2 py-1 rounded-full border ${statusBadgeClass(entry.status)}`}>
                        {entry.status}
                      </span>
                      <span className="text-xs text-gray-500 whitespace-nowrap">
                        {fmtDate(entry.time)} {fmtTime(entry.time)}
                      </span>
                    </div>
                  </motion.article>
                ))}
              </div>
            )}
          </SectionShell>

          <SectionShell
            title="Meetings"
            subtitle="Upcoming sessions and recent scheduling activity."
            badge={`${filteredMeetings.length} visible`}
            collapsed={collapsed.meetings}
            onToggle={() => toggleSection('meetings')}
            action={<Link to="/meetings" className="text-xs font-semibold text-cyan-200">Open all</Link>}
            index={1}
          >
            {filteredMeetings.length === 0 ? (
              <EmptyInline title="No meetings for current filters." ctaLabel="Schedule meeting" to="/schedule" />
            ) : (
              <div className="overflow-x-auto">
                <div className="min-w-140">
                  <div className="grid grid-cols-[minmax(0,1.2fr)_0.9fr_0.7fr] gap-3 text-sm text-gray-400 font-semibold py-2 border-b border-gray-800">
                    <span>Meeting</span>
                    <span>When</span>
                    <span>Type</span>
                  </div>
                  {filteredMeetings.map((meeting, index) => (
                    <motion.div
                      key={meeting._id}
                      initial={{ opacity: 0, x: -8 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true, amount: 0.7 }}
                      transition={{ delay: index * 0.02, duration: 0.26 }}
                      className="grid grid-cols-[minmax(0,1.2fr)_0.9fr_0.7fr] gap-3 py-3 border-b border-gray-800/70 hover:bg-white/2 transition-colors"
                    >
                      <div className="min-w-0">
                        <p className="text-sm text-white font-semibold truncate">{meeting.title}</p>
                        <p className="text-xs text-gray-400 truncate">{meeting.details?.topic || 'Session details not added'}</p>
                      </div>
                      <p className="text-xs text-gray-300">
                        {fmtDate(meeting.startTime)} {fmtTime(meeting.startTime)}
                      </p>
                      <span className={`text-xs px-2 py-1 rounded-full border h-fit ${statusBadgeClass('Scheduled')}`}>
                        {meeting.meetingType || 'General'}
                      </span>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}
          </SectionShell>

          <SectionShell
            title="Projects"
            subtitle="Delivery overview with stage, status, and progress alignment."
            badge={`${filteredProjects.length} visible`}
            collapsed={collapsed.projects}
            onToggle={() => toggleSection('projects')}
            action={<Link to="/projects" className="text-xs font-semibold text-cyan-200">Workspace</Link>}
            index={2}
          >
            {filteredProjects.length === 0 ? (
              <EmptyInline title="No projects for the selected filters." ctaLabel="Open projects" to="/projects" />
            ) : (
              <div className="overflow-x-auto">
                <div className="min-w-160">
                  <div className="grid grid-cols-[minmax(0,1.15fr)_0.6fr_0.65fr_0.45fr] gap-3 text-sm text-gray-400 font-semibold py-2 border-b border-gray-800">
                    <span>Project</span>
                    <span>Stage</span>
                    <span>Status</span>
                    <span>Done</span>
                  </div>
                  {filteredProjects.slice(0, 10).map((project, index) => (
                    <motion.div
                      key={project._id}
                      initial={{ opacity: 0, x: -8 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true, amount: 0.65 }}
                      transition={{ delay: index * 0.02, duration: 0.26 }}
                    >
                      <Link
                        to={`/projects/${project._id}`}
                        className="grid grid-cols-[minmax(0,1.15fr)_0.6fr_0.65fr_0.45fr] gap-3 py-3 border-b border-gray-800/70 hover:bg-white/2 transition-colors"
                      >
                        <div className="min-w-0">
                          <p className="text-sm text-white font-semibold truncate">{project.title}</p>
                          <p className="text-xs text-gray-400 truncate">{project.event?.title || 'Standalone'}</p>
                          <div className="mt-2 h-1.5 rounded-full bg-gray-800 overflow-hidden">
                            <div
                              className="h-full bg-linear-to-r from-cyan-400 via-blue-400 to-indigo-400"
                              style={{ width: `${Math.max(0, Math.min(100, Number(project.progress || 0)))}%` }}
                            />
                          </div>
                        </div>
                        <p className="text-xs text-gray-300">{project.stage || 'Planning'}</p>
                        <span className={`text-xs px-2 py-1 rounded-full border h-fit ${statusBadgeClass(project.status)}`}>
                          {project.status || 'Planning'}
                        </span>
                        <p className="text-xs text-cyan-200 font-semibold">{Math.round(Number(project.progress || 0))}%</p>
                      </Link>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}
          </SectionShell>

          <SectionShell
            title="Discussions"
            subtitle="Latest community messages and participation updates."
            badge={`${filteredPosts.length} visible`}
            collapsed={collapsed.discussions}
            onToggle={() => toggleSection('discussions')}
            action={<Link to="/community" className="text-xs font-semibold text-cyan-200">Open feed</Link>}
            index={3}
          >
            {filteredPosts.length === 0 ? (
              <EmptyInline title="No discussions match your filters." ctaLabel="Start discussion" to="/community" />
            ) : (
              <div className="overflow-x-auto">
                <div className="min-w-140">
                  <div className="grid grid-cols-[minmax(0,1.35fr)_0.65fr_0.55fr] gap-3 text-sm text-gray-400 font-semibold py-2 border-b border-gray-800">
                    <span>Discussion</span>
                    <span>Author</span>
                    <span>When</span>
                  </div>
                  {filteredPosts.slice(0, 10).map((post, index) => (
                    <motion.div
                      key={post._id}
                      initial={{ opacity: 0, x: -8 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true, amount: 0.7 }}
                      transition={{ delay: index * 0.02, duration: 0.26 }}
                    >
                      <Link
                        to="/community"
                        className="grid grid-cols-[minmax(0,1.35fr)_0.65fr_0.55fr] gap-3 py-3 border-b border-gray-800/70 hover:bg-white/2 transition-colors"
                      >
                        <div className="min-w-0">
                          <p className="text-xs text-blue-300 font-semibold">{post.type || 'Update'}</p>
                          <p className="text-sm text-white truncate mt-1">{post.content || 'No message content'}</p>
                        </div>
                        <p className="text-xs text-gray-300 truncate">
                          {post.user?.name || 'Member'}
                          {post.user?.role ? ` • ${post.user.role}` : ''}
                        </p>
                        <p className="text-xs text-gray-400 whitespace-nowrap">{fmtDate(post.createdAt)}</p>
                      </Link>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}
          </SectionShell>
        </main>

        <aside className="space-y-5">
          <motion.section
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.25 }}
            transition={{ duration: 0.45 }}
            className="border-y border-gray-800/80 py-4 px-1 md:px-2"
          >
            <div className="flex items-center gap-2">
              <Sparkles size={15} className="text-cyan-300" />
              <h3 className="text-base font-semibold text-white">Quick Actions</h3>
            </div>
            <p className="text-sm text-gray-400 mt-1">Fast navigation to high-value workflows.</p>
            <div className="mt-3 divide-y divide-gray-800/70">
              {quickActions.slice(0, 6).map((action) => (
                <Link
                  key={action.to + action.label}
                  to={action.to}
                  className="flex items-center justify-between py-2.5 text-sm text-gray-200 hover:text-white transition-colors"
                >
                  <span>{action.label}</span>
                  <ArrowUpRight size={14} className="text-cyan-300" />
                </Link>
              ))}
            </div>
          </motion.section>

          <motion.section
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.25 }}
            transition={{ duration: 0.45, delay: 0.04 }}
            className="border-y border-gray-800/80 py-4 px-1 md:px-2"
          >
            <h3 className="text-base font-semibold text-white">Profile Snapshot</h3>
            <p className="text-sm text-gray-400 mt-1">Identity and operational profile details.</p>
            <div className="mt-3 grid grid-cols-1 gap-2 text-sm text-gray-300">
              <p className="inline-flex items-center gap-2"><Users size={12} className="text-cyan-300" /> {member.name || 'N/A'}</p>
              <p className="inline-flex items-center gap-2"><IdCard size={12} className="text-blue-300" /> {member.collegeId || 'N/A'}</p>
              <p className="inline-flex items-center gap-2"><Mail size={12} className="text-indigo-300" /> {member.email || 'N/A'}</p>
              <p className="inline-flex items-center gap-2"><Phone size={12} className="text-emerald-300" /> {member.phone || 'N/A'}</p>
              <p className="inline-flex items-center gap-2"><Clock3 size={12} className="text-amber-300" /> {member.yearsInCICR ?? 0} years in CICR</p>
              <p className="inline-flex items-center gap-2"><FolderKanban size={12} className="text-cyan-300" /> {metrics.totalProjectContributions || filteredProjects.length} contributions</p>
              <p className="inline-flex items-center gap-2"><Users size={12} className="text-blue-300" /> {directoryMembers.length} members in directory</p>
            </div>
            <div className="mt-3">
              <Link to="/profile" className="btn btn-ghost w-auto! text-xs!">Open Profile</Link>
            </div>
          </motion.section>

          <motion.section
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.25 }}
            transition={{ duration: 0.45, delay: 0.06 }}
            className="border-y border-gray-800/80 py-4 px-1 md:px-2"
          >
            <h3 className="text-base font-semibold text-white inline-flex items-center gap-2">
              <BarChart3 size={14} className="text-cyan-300" />
              Project Pulse
            </h3>
            <p className="text-sm text-gray-400 mt-1">Completion, active execution, and risk profile.</p>
            <div className="mt-3 space-y-3">
              {projectPulse.map((item) => (
                <article key={item.label}>
                  <div className="flex items-center justify-between text-xs">
                    <p className="text-gray-300">{item.label}</p>
                    <p className="text-gray-400">{item.value} • {item.percent}%</p>
                  </div>
                  <div className="mt-1 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      whileInView={{ width: `${Math.max(8, item.percent)}%` }}
                      viewport={{ once: true, amount: 0.7 }}
                      transition={{ duration: 0.75, ease: 'easeOut' }}
                      className={`h-full bg-linear-to-r ${item.tone}`}
                    />
                  </div>
                </article>
              ))}
            </div>
          </motion.section>

          {isJuniorMember ? (
            <motion.section
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.25 }}
              transition={{ duration: 0.45, delay: 0.08 }}
              className="border-y border-gray-800/80 py-4 px-1 md:px-2"
            >
              <h3 className="text-base font-semibold text-white inline-flex items-center gap-2">
                <BookOpenCheck size={14} className="text-cyan-300" />
                Junior Launchpad
              </h3>
              <p className="text-sm text-gray-400 mt-1">Actionable checklist for skill growth and mentorship workflow.</p>
              <div className="grid grid-cols-1 gap-2 mt-3">
                <MiniMetric label="Active Tracks" value={learningOverview?.stats?.activeTracks || 0} />
                <MiniMetric label="Tasks Approved" value={learningOverview?.stats?.myApprovedTasks || 0} />
                <MiniMetric label="Points" value={learningOverview?.stats?.myPoints || 0} />
              </div>
              <div className="mt-3 space-y-2">
                {juniorRecommendations.length === 0 ? (
                  <EmptyInline title="No pending recommendations." ctaLabel="Open Learning Hub" to="/learning" />
                ) : (
                  juniorRecommendations.map((item) => (
                    <article key={`${item.trackId}-${item.moduleIndex}-${item.taskIndex}`} className="py-2 border-b border-gray-800/60">
                      <p className="text-sm text-white font-semibold">{item.taskTitle}</p>
                      <p className="text-xs text-gray-400 mt-1">{item.trackTitle}</p>
                    </article>
                  ))
                )}
              </div>
            </motion.section>
          ) : null}

          {isAlumni ? (
            <motion.section
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.25 }}
              transition={{ duration: 0.45, delay: 0.08 }}
              className="border-y border-gray-800/80 py-4 px-1 md:px-2"
            >
              <h3 className="text-base font-semibold text-white inline-flex items-center gap-2">
                <GraduationCap size={14} className="text-indigo-300" />
                Alumni Overview
              </h3>
              <div className="mt-3 space-y-2 text-sm text-gray-300">
                <p className="inline-flex items-center gap-2"><Building2 size={12} className="text-cyan-300" /> {alumniProfile?.currentOrganization || 'Organization not added'}</p>
                <p className="inline-flex items-center gap-2"><Activity size={12} className="text-emerald-300" /> {alumniProfile?.currentDesignation || 'Designation not added'}</p>
                <p className="inline-flex items-center gap-2"><MapPin size={12} className="text-amber-300" /> {alumniProfile?.location || 'Location not added'}</p>
              </div>
              <div className="mt-3 space-y-2 text-sm text-gray-300">
                {alumniTenures.length === 0 ? (
                  <p className="text-sm text-gray-500">No CICR tenure history added yet.</p>
                ) : (
                  alumniTenures.slice(0, 4).map((tenure, idx) => (
                    <div key={`${tenure.position}-${idx}`} className="py-1.5 border-b border-gray-800/60">
                      {tenure.position} • {tenure.fromYear}-{tenure.toYear}
                    </div>
                  ))
                )}
              </div>
            </motion.section>
          ) : null}

          {isAdminOrHead ? (
            <motion.section
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.25 }}
              transition={{ duration: 0.45, delay: 0.08 }}
              className="border-y border-gray-800/80 py-4 px-1 md:px-2"
            >
              <h3 className="text-base font-semibold text-white inline-flex items-center gap-2">
                <ShieldCheck size={14} className="text-emerald-300" />
                Recruitment Snapshot
              </h3>
              <div className="grid grid-cols-2 gap-2 mt-3">
                <MiniMetric label="Total" value={applicationStats.total} />
                <MiniMetric label="New" value={applicationStats.new} />
                <MiniMetric label="Interview" value={applicationStats.interview} />
                <MiniMetric label="Selected" value={applicationStats.selected} />
              </div>
              {applicationStats.new > 0 ? (
                <p className="mt-3 text-xs text-amber-200 inline-flex items-center gap-1">
                  <AlertTriangle size={12} />
                  {applicationStats.new} applications need triage.
                </p>
              ) : null}
              <div className="mt-3">
                <Link to="/admin" className="btn btn-ghost w-auto! text-xs!">Open Recruitment</Link>
              </div>
            </motion.section>
          ) : null}
        </aside>
      </div>

      <nav className="fixed bottom-4 left-4 right-4 z-30 lg:hidden">
        <div className="rounded-2xl border border-gray-800 bg-[#080d13]/95 backdrop-blur p-2 grid grid-cols-3 gap-2">
          <Link to="/projects" className="btn btn-secondary text-[10px]! py-2!">Projects</Link>
          <Link to="/community?tab=issues" className="btn btn-secondary text-[10px]! py-2!">Issue</Link>
          <Link to="/events" className="btn btn-primary text-[10px]! py-2!">Events</Link>
        </div>
      </nav>
    </div>
  );
}

function MiniMetric({ label, value }) {
  return (
    <article className="flex items-center justify-between border-b border-gray-800/70 py-2">
      <p className="text-sm text-gray-400 font-medium">{label}</p>
      <p className="text-base font-semibold text-white">{value}</p>
    </article>
  );
}
