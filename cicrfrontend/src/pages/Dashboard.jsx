import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  Activity,
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
      <div className="h-20 rounded-3xl border border-gray-800 bg-[#0a0e14] animate-pulse" />
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={`kpi-skeleton-${index}`} className="h-24 rounded-2xl border border-gray-800 bg-[#090d13] animate-pulse" />
        ))}
      </div>
      <div className="h-14 rounded-2xl border border-gray-800 bg-[#090d13] animate-pulse" />
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.45fr)_360px] gap-6">
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={`section-skeleton-${index}`} className="h-56 rounded-3xl border border-gray-800 bg-[#080d12] animate-pulse" />
          ))}
        </div>
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={`rail-skeleton-${index}`} className="h-44 rounded-3xl border border-gray-800 bg-[#080d12] animate-pulse" />
          ))}
        </div>
      </div>
    </div>
  );
}

function KpiTile({ label, value, delta, tone = 'cyan' }) {
  const toneClass =
    tone === 'emerald'
      ? 'border-emerald-500/30 bg-emerald-500/10'
      : tone === 'amber'
      ? 'border-amber-500/30 bg-amber-500/10'
      : tone === 'blue'
      ? 'border-blue-500/30 bg-blue-500/10'
      : 'border-cyan-500/30 bg-cyan-500/10';

  const deltaTone = delta > 0 ? 'text-emerald-300' : delta < 0 ? 'text-rose-300' : 'text-gray-400';
  const deltaPrefix = delta > 0 ? '+' : '';

  return (
    <article className={`rounded-2xl border px-4 py-3 ${toneClass}`}>
      <p className="text-[10px] uppercase tracking-[0.18em] text-gray-300 font-black">{label}</p>
      <p className="text-2xl md:text-3xl font-black text-white mt-1">{value}</p>
      <p className={`text-[11px] mt-1 ${deltaTone}`}>
        {deltaPrefix}
        {delta} vs previous 7 days
      </p>
    </article>
  );
}

function SectionShell({
  title,
  subtitle,
  badge,
  action,
  collapsed,
  onToggle,
  children,
}) {
  return (
    <section className="rounded-[1.6rem] border border-gray-800 bg-[#090e15]/72 overflow-hidden">
      <header className="px-4 md:px-5 py-4 border-b border-gray-800 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base md:text-lg font-black text-white">{title}</h3>
          <p className="text-xs text-gray-500 mt-1">{subtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          {badge ? (
            <span className="text-[10px] uppercase tracking-widest px-2 py-1 rounded-full border border-cyan-500/35 text-cyan-200 bg-cyan-500/10">
              {badge}
            </span>
          ) : null}
          {action}
          <button
            type="button"
            onClick={onToggle}
            aria-label={collapsed ? `Expand ${title}` : `Collapse ${title}`}
            className="lg:hidden p-2 rounded-lg border border-gray-700 text-gray-300"
          >
            {collapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
          </button>
        </div>
      </header>
      {!collapsed ? <div className="px-4 md:px-5 py-4">{children}</div> : null}
    </section>
  );
}

function EmptyInline({ title, ctaLabel, to }) {
  return (
    <div className="rounded-xl border border-dashed border-gray-700 p-4 text-sm text-gray-500">
      <p>{title}</p>
      {to ? (
        <Link to={to} className="inline-flex mt-3 text-xs uppercase tracking-widest text-cyan-200">
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
        (isAlumni || isAdminOrHead) ? fetchDirectoryMembers() : Promise.resolve({ data: [] }),
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

  const kpiConfig = useMemo(
    () => [
      {
        label: 'Projects',
        value: filteredProjects.length,
        delta: trendDelta(projects, (row) => row.updatedAt || row.createdAt || row.deadline),
        tone: 'cyan',
      },
      {
        label: 'Meetings',
        value: filteredMeetings.length,
        delta: trendDelta(meetings, (row) => row.startTime),
        tone: 'blue',
      },
      {
        label: 'Discussions',
        value: filteredPosts.length,
        delta: trendDelta(posts, (row) => row.createdAt),
        tone: 'amber',
      },
      isAdminOrHead
        ? {
            label: 'Recruitment',
            value: applicationStats.total,
            delta: trendDelta(applications, (row) => row.updatedAt || row.createdAt),
            tone: 'emerald',
          }
        : {
            label: 'Learning Points',
            value: Number(learningOverview?.stats?.myPoints || 0),
            delta: Number(learningOverview?.stats?.myApprovedTasks || 0),
            tone: 'emerald',
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
    <div className="ui-page pb-24 space-y-6 page-motion-a">
      <section className="section-motion section-motion-delay-1">
        <PageHeader
          eyebrow={isAlumni ? 'Alumni Dashboard' : 'CICR Dashboard'}
          title={isAlumni ? `Welcome Back, ${member?.name || 'Alumni Member'}` : 'Operations Dashboard'}
          subtitle="Role-based workspace with filtered signals, operational timelines, and quick actions."
          icon={isAlumni ? Handshake : Activity}
          actions={
            <>
              <Link to="/projects" className="btn btn-primary">Projects</Link>
              <Link to="/events" className="btn btn-secondary">Events</Link>
              {isAdminOrHead ? <Link to="/admin" className="btn btn-secondary">Admin</Link> : null}
            </>
          }
        />
      </section>

      {loadError ? (
        <section className="rounded-2xl border border-amber-500/35 bg-amber-500/10 p-4 flex items-center justify-between gap-3">
          <p className="text-sm text-amber-100">{loadError}</p>
          <button type="button" onClick={loadDashboard} className="btn btn-secondary !w-auto !text-[10px]">
            <Loader2 size={12} /> Retry
          </button>
        </section>
      ) : null}

      <section className="sticky top-3 z-20 section-motion section-motion-delay-1">
        <div className="rounded-2xl border border-gray-800 bg-[#080d13]/92 backdrop-blur px-3 md:px-4 py-3 shadow-xl">
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
            {kpiConfig.map((kpi) => (
              <KpiTile
                key={kpi.label}
                label={kpi.label}
                value={kpi.value}
                delta={kpi.delta}
                tone={kpi.tone}
              />
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-gray-800 bg-[#090e14]/75 p-3 md:p-4 section-motion section-motion-delay-2">
        <div className="grid grid-cols-1 lg:grid-cols-[auto_auto_1fr] gap-3 items-start lg:items-center">
          <div>
            <p className="text-[10px] uppercase tracking-[0.18em] text-gray-500 font-black mb-1.5">Time window</p>
            <div className="flex flex-wrap gap-2">
              {TIME_WINDOWS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  aria-label={`Filter time window ${option.label}`}
                  onClick={() => setTimeWindow(option.id)}
                  className={`px-3 py-2 rounded-lg text-[10px] uppercase tracking-widest font-black border ${
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

          <div>
            <p className="text-[10px] uppercase tracking-[0.18em] text-gray-500 font-black mb-1.5">Role scope</p>
            <select
              aria-label="Role scope filter"
              value={roleFilter}
              onChange={(event) => setRoleFilter(event.target.value)}
              className="ui-input !py-2 !text-xs !max-w-[12rem]"
            >
              {ROLE_OPTIONS.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <p className="text-[10px] uppercase tracking-[0.18em] text-gray-500 font-black mb-1.5">Project status</p>
            <div className="flex flex-wrap gap-2">
              {PROJECT_STATUS_OPTIONS.map((status) => (
                <button
                  key={status}
                  type="button"
                  aria-label={`Filter project status ${status}`}
                  onClick={() => setProjectStatusFilter(status)}
                  className={`px-3 py-2 rounded-lg text-[10px] uppercase tracking-widest font-black border ${
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
      </section>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.45fr)_360px] gap-6 section-motion section-motion-delay-3">
        <main className="space-y-4">
          <SectionShell
            title="Activity Timeline"
            subtitle={isAdminOrHead ? 'Who changed what, when, with current status context.' : 'Recent operational changes relevant to your workspace.'}
            badge={`${activityTimeline.length} entries`}
            collapsed={collapsed.timeline}
            onToggle={() => toggleSection('timeline')}
            action={isAdminOrHead ? <span className="text-[10px] uppercase tracking-widest text-emerald-300">Admin Trace</span> : null}
          >
            {activityTimeline.length === 0 ? (
              <EmptyInline title="No timeline entries for the current filters." ctaLabel="Reset filters" to="/dashboard" />
            ) : (
              <div className="divide-y divide-gray-800">
                {activityTimeline.map((entry) => (
                  <div key={entry.id} className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 py-3">
                    <div className="min-w-0">
                      <p className="text-sm text-white font-semibold truncate">{entry.title}</p>
                      <p className="text-xs text-gray-400 mt-1 truncate">{entry.detail}</p>
                      <p className="text-[11px] text-gray-500 mt-1">
                        {entry.actor}
                        {entry.actorRole ? ` • ${entry.actorRole}` : ''}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className={`text-[10px] uppercase tracking-widest px-2 py-1 rounded-full border ${statusBadgeClass(entry.status)}`}>
                        {entry.status}
                      </span>
                      <span className="text-[11px] text-gray-500 whitespace-nowrap">
                        {fmtDate(entry.time)} {fmtTime(entry.time)}
                      </span>
                    </div>
                  </div>
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
            action={<Link to="/meetings" className="text-[10px] uppercase tracking-widest text-cyan-200">Open all</Link>}
          >
            {filteredMeetings.length === 0 ? (
              <EmptyInline title="No meetings for current filters." ctaLabel="Schedule meeting" to="/schedule" />
            ) : (
              <div className="overflow-x-auto">
                <div className="min-w-[560px]">
                  <div className="grid grid-cols-[minmax(0,1.2fr)_0.9fr_0.7fr] gap-3 text-[10px] uppercase tracking-widest text-gray-500 font-black py-2 border-b border-gray-800">
                    <span>Meeting</span>
                    <span>When</span>
                    <span>Type</span>
                  </div>
                  {filteredMeetings.map((meeting) => (
                    <div key={meeting._id} className="grid grid-cols-[minmax(0,1.2fr)_0.9fr_0.7fr] gap-3 py-3 border-b border-gray-800/70">
                      <div className="min-w-0">
                        <p className="text-sm text-white font-semibold truncate">{meeting.title}</p>
                        <p className="text-xs text-gray-400 truncate">{meeting.details?.topic || 'Session details not added'}</p>
                      </div>
                      <p className="text-xs text-gray-300">
                        {fmtDate(meeting.startTime)} {fmtTime(meeting.startTime)}
                      </p>
                      <span className={`text-[10px] uppercase tracking-widest px-2 py-1 rounded-full border h-fit ${statusBadgeClass('Scheduled')}`}>
                        {meeting.meetingType || 'General'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </SectionShell>

          <SectionShell
            title="Projects"
            subtitle="Delivery overview with stage and status alignment."
            badge={`${filteredProjects.length} visible`}
            collapsed={collapsed.projects}
            onToggle={() => toggleSection('projects')}
            action={<Link to="/projects" className="text-[10px] uppercase tracking-widest text-cyan-200">Workspace</Link>}
          >
            {filteredProjects.length === 0 ? (
              <EmptyInline title="No projects for the selected filters." ctaLabel="Open projects" to="/projects" />
            ) : (
              <div className="overflow-x-auto">
                <div className="min-w-[560px]">
                  <div className="grid grid-cols-[minmax(0,1.3fr)_0.65fr_0.65fr] gap-3 text-[10px] uppercase tracking-widest text-gray-500 font-black py-2 border-b border-gray-800">
                    <span>Project</span>
                    <span>Stage</span>
                    <span>Status</span>
                  </div>
                  {filteredProjects.slice(0, 10).map((project) => (
                    <Link
                      to={`/projects/${project._id}`}
                      key={project._id}
                      className="grid grid-cols-[minmax(0,1.3fr)_0.65fr_0.65fr] gap-3 py-3 border-b border-gray-800/70 hover:bg-white/[0.02] transition-colors"
                    >
                      <div className="min-w-0">
                        <p className="text-sm text-white font-semibold truncate">{project.title}</p>
                        <p className="text-xs text-gray-400 truncate">{project.event?.title || 'Standalone'}</p>
                      </div>
                      <p className="text-xs text-gray-300">{project.stage || 'Planning'}</p>
                      <span className={`text-[10px] uppercase tracking-widest px-2 py-1 rounded-full border h-fit ${statusBadgeClass(project.status)}`}>
                        {project.status || 'Planning'}
                      </span>
                    </Link>
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
            action={<Link to="/community" className="text-[10px] uppercase tracking-widest text-cyan-200">Open feed</Link>}
          >
            {filteredPosts.length === 0 ? (
              <EmptyInline title="No discussions match your filters." ctaLabel="Start discussion" to="/community" />
            ) : (
              <div className="overflow-x-auto">
                <div className="min-w-[560px]">
                  <div className="grid grid-cols-[minmax(0,1.35fr)_0.65fr_0.55fr] gap-3 text-[10px] uppercase tracking-widest text-gray-500 font-black py-2 border-b border-gray-800">
                    <span>Discussion</span>
                    <span>Author</span>
                    <span>When</span>
                  </div>
                  {filteredPosts.slice(0, 10).map((post) => (
                    <Link
                      to="/community"
                      key={post._id}
                      className="grid grid-cols-[minmax(0,1.35fr)_0.65fr_0.55fr] gap-3 py-3 border-b border-gray-800/70 hover:bg-white/[0.02] transition-colors"
                    >
                      <div className="min-w-0">
                        <p className="text-[10px] uppercase tracking-widest text-blue-300 font-black">{post.type || 'Update'}</p>
                        <p className="text-sm text-white truncate mt-1">{post.content || 'No message content'}</p>
                      </div>
                      <p className="text-xs text-gray-300 truncate">
                        {post.user?.name || 'Member'}
                        {post.user?.role ? ` • ${post.user.role}` : ''}
                      </p>
                      <p className="text-xs text-gray-400 whitespace-nowrap">{fmtDate(post.createdAt)}</p>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </SectionShell>
        </main>

        <aside className="space-y-4">
          <section className="rounded-[1.6rem] border border-cyan-500/25 bg-gradient-to-b from-[#0a1626] via-[#08111d] to-[#070f1a] p-5 pro-aurora">
            <div className="flex items-center gap-2">
              <Sparkles size={15} className="text-cyan-300" />
              <h3 className="text-base font-black text-white">Quick Actions</h3>
            </div>
            <p className="text-xs text-gray-400 mt-1">Fast navigation to high-value workflows.</p>
            <div className="mt-4 grid grid-cols-1 gap-2">
              {quickActions.slice(0, 6).map((action) => (
                <Link key={action.to + action.label} to={action.to} className="btn btn-secondary !justify-start !text-[10px] !px-3 !py-2">
                  {action.label}
                </Link>
              ))}
            </div>
          </section>

          <section className="rounded-[1.6rem] border border-gray-800 bg-[#090f17]/75 p-5">
            <h3 className="text-base font-black text-white">Profile Snapshot</h3>
            <p className="text-xs text-gray-500 mt-1">Visible identity and operational profile details.</p>
            <div className="mt-4 space-y-2 text-xs text-gray-300">
              <p className="inline-flex items-center gap-2"><Users size={12} className="text-cyan-300" /> {member.name || 'N/A'}</p>
              <p className="inline-flex items-center gap-2"><IdCard size={12} className="text-blue-300" /> {member.collegeId || 'N/A'}</p>
              <p className="inline-flex items-center gap-2"><Mail size={12} className="text-indigo-300" /> {member.email || 'N/A'}</p>
              <p className="inline-flex items-center gap-2"><Phone size={12} className="text-emerald-300" /> {member.phone || 'N/A'}</p>
              <p className="inline-flex items-center gap-2"><Clock3 size={12} className="text-amber-300" /> {member.yearsInCICR ?? 0} years in CICR</p>
              <p className="inline-flex items-center gap-2"><FolderKanban size={12} className="text-cyan-300" /> {metrics.totalProjectContributions || filteredProjects.length} project contributions</p>
              <p className="inline-flex items-center gap-2"><Users size={12} className="text-blue-300" /> {directoryMembers.length} members in directory</p>
            </div>
            <div className="mt-4">
              <Link to="/profile" className="btn btn-ghost !w-auto !text-[10px]">Open Profile</Link>
            </div>
          </section>

          {isJuniorMember ? (
            <section className="rounded-[1.6rem] border border-blue-500/25 bg-blue-500/[0.07] p-5">
              <h3 className="text-base font-black text-white inline-flex items-center gap-2">
                <BookOpenCheck size={14} className="text-cyan-300" />
                Junior Launchpad
              </h3>
              <p className="text-xs text-gray-400 mt-1">Actionable checklist for skill growth and mentorship workflow.</p>
              <div className="grid grid-cols-1 gap-2 mt-4">
                <MiniMetric label="Active Tracks" value={learningOverview?.stats?.activeTracks || 0} />
                <MiniMetric label="Tasks Approved" value={learningOverview?.stats?.myApprovedTasks || 0} />
                <MiniMetric label="Points" value={learningOverview?.stats?.myPoints || 0} />
              </div>
              <div className="mt-4 space-y-2">
                {juniorRecommendations.length === 0 ? (
                  <EmptyInline title="No pending recommendations." ctaLabel="Open Learning Hub" to="/learning" />
                ) : (
                  juniorRecommendations.map((item) => (
                    <article key={`${item.trackId}-${item.moduleIndex}-${item.taskIndex}`} className="rounded-lg border border-gray-800 p-2.5 bg-[#090e15]">
                      <p className="text-xs text-white font-semibold">{item.taskTitle}</p>
                      <p className="text-[11px] text-gray-400 mt-1">{item.trackTitle}</p>
                    </article>
                  ))
                )}
              </div>
            </section>
          ) : null}

          {isAlumni ? (
            <section className="rounded-[1.6rem] border border-indigo-500/25 bg-indigo-500/[0.06] p-5">
              <h3 className="text-base font-black text-white inline-flex items-center gap-2">
                <GraduationCap size={14} className="text-indigo-300" />
                Alumni Overview
              </h3>
              <div className="mt-3 space-y-2 text-xs text-gray-300">
                <p className="inline-flex items-center gap-2"><Building2 size={12} className="text-cyan-300" /> {alumniProfile?.currentOrganization || 'Organization not added'}</p>
                <p className="inline-flex items-center gap-2"><Activity size={12} className="text-emerald-300" /> {alumniProfile?.currentDesignation || 'Designation not added'}</p>
                <p className="inline-flex items-center gap-2"><MapPin size={12} className="text-amber-300" /> {alumniProfile?.location || 'Location not added'}</p>
              </div>
              <div className="mt-3 space-y-2">
                {alumniTenures.length === 0 ? (
                  <p className="text-xs text-gray-500">No CICR tenure history added yet.</p>
                ) : (
                  alumniTenures.slice(0, 4).map((tenure, idx) => (
                    <div key={`${tenure.position}-${idx}`} className="text-xs border border-gray-800 rounded-lg px-2 py-1.5 text-gray-300">
                      {tenure.position} • {tenure.fromYear}-{tenure.toYear}
                    </div>
                  ))
                )}
              </div>
            </section>
          ) : null}

          {isAdminOrHead ? (
            <section className="rounded-[1.6rem] border border-emerald-500/25 bg-emerald-500/[0.06] p-5">
              <h3 className="text-base font-black text-white inline-flex items-center gap-2">
                <ShieldCheck size={14} className="text-emerald-300" />
                Recruitment Snapshot
              </h3>
              <div className="grid grid-cols-2 gap-2 mt-4">
                <MiniMetric label="Total" value={applicationStats.total} />
                <MiniMetric label="New" value={applicationStats.new} />
                <MiniMetric label="Interview" value={applicationStats.interview} />
                <MiniMetric label="Selected" value={applicationStats.selected} />
              </div>
              <div className="mt-4">
                <Link to="/admin" className="btn btn-ghost !w-auto !text-[10px]">Open Recruitment</Link>
              </div>
            </section>
          ) : null}
        </aside>
      </div>

      <nav className="fixed bottom-4 left-4 right-4 z-30 lg:hidden">
        <div className="rounded-2xl border border-gray-800 bg-[#080d13]/95 backdrop-blur p-2 grid grid-cols-3 gap-2">
          <Link to="/projects" className="btn btn-secondary !text-[10px] !py-2">Projects</Link>
          <Link to="/community?tab=issues" className="btn btn-secondary !text-[10px] !py-2">Issue</Link>
          <Link to="/events" className="btn btn-primary !text-[10px] !py-2">Events</Link>
        </div>
      </nav>
    </div>
  );
}

function MiniMetric({ label, value }) {
  return (
    <article className="rounded-lg border border-gray-800 px-3 py-2 bg-[#090e15]/70">
      <p className="text-[10px] uppercase tracking-widest text-gray-500 font-black">{label}</p>
      <p className="text-sm font-semibold text-white mt-1">{value}</p>
    </article>
  );
}
