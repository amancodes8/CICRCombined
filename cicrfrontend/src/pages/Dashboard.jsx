import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  BookOpenCheck,
  Building2,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  FolderKanban,
  GraduationCap,
  Handshake,
  Loader2,
  MapPin,
  MessageSquareText,
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

/* ─── helpers ───────────────────────────────────────────────── */
const normalizeRole = (v) => String(v || '').trim().toLowerCase();
const toMs = (v) => { const p = new Date(v).getTime(); return Number.isFinite(p) ? p : NaN; };
const fmtDate = (d) => { const p = new Date(d); return Number.isNaN(p.getTime()) ? 'TBD' : p.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }); };
const fmtTime = (d) => { const p = new Date(d); return Number.isNaN(p.getTime()) ? '' : p.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); };
const relDay = (d) => {
  const now = new Date(); const t = new Date(d);
  if (Number.isNaN(t.getTime())) return 'TBD';
  const diff = Math.round((t - now) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  if (diff > 1 && diff <= 6) return `In ${diff} days`;
  return fmtDate(d);
};

const statusColor = (s) => {
  const n = String(s || '').toLowerCase();
  if (['completed', 'selected', 'approved'].includes(n)) return { bg: 'bg-emerald-500/15', text: 'text-emerald-300', border: 'border-emerald-500/30' };
  if (['awaiting review', 'interview', 'accepted', 'on-hold'].includes(n)) return { bg: 'bg-amber-500/15', text: 'text-amber-300', border: 'border-amber-500/30' };
  if (['delayed', 'rejected', 'cancelled'].includes(n)) return { bg: 'bg-rose-500/15', text: 'text-rose-300', border: 'border-rose-500/30' };
  return { bg: 'bg-cyan-500/12', text: 'text-cyan-300', border: 'border-cyan-500/25' };
};

const trendDelta = (items, dateAccessor, days = 7) => {
  const now = Date.now();
  const cs = now - days * 86400000, ps = now - days * 2 * 86400000;
  let c = 0, p = 0;
  for (const i of items) { const t = toMs(dateAccessor(i)); if (!Number.isFinite(t)) continue; if (t >= cs && t <= now) c++; else if (t >= ps && t < cs) p++; }
  return c - p;
};

/* ─── reusable horizontal slider ─────────────────────────── */
function Slider({ children, className = '' }) {
  const ref = useRef(null);
  const [canL, setCanL] = useState(false);
  const [canR, setCanR] = useState(false);

  const check = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    setCanL(el.scrollLeft > 4);
    setCanR(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  useEffect(() => { check(); window.addEventListener('resize', check); return () => window.removeEventListener('resize', check); }, [check, children]);

  const scroll = (dir) => { ref.current?.scrollBy({ left: dir * 320, behavior: 'smooth' }); setTimeout(check, 380); };

  return (
    <div className={`relative group ${className}`}>
      {canL && (
        <button onClick={() => scroll(-1)} className="dash-slider-btn left-0" aria-label="Scroll left">
          <ChevronLeft size={18} />
        </button>
      )}
      <div ref={ref} onScroll={check} className="dash-slider-track">
        {children}
      </div>
      {canR && (
        <button onClick={() => scroll(1)} className="dash-slider-btn right-0" aria-label="Scroll right">
          <ChevronRight size={18} />
        </button>
      )}
    </div>
  );
}

/* ─── skeleton ──────────────────────────────────────────────── */
function DashboardSkeleton() {
  return (
    <div className="dash-page">
      <div className="h-44 rounded-3xl bg-white/3 animate-pulse" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5 mt-8">
        {[0, 1, 2, 3].map((i) => <div key={i} className="h-28 rounded-2xl bg-white/3 animate-pulse" />)}
      </div>
      <div className="h-52 rounded-2xl bg-white/3 animate-pulse mt-8" />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════ */
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

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const [postRes, projectRes, meetingRes, insightRes, appRes, directoryRes, learningRes] =
        await Promise.allSettled([
          fetchPosts(),
          fetchProjects(),
          fetchMeetings(),
          fetchMyInsights(),
          isAdminOrHead ? fetchApplications() : Promise.resolve({ data: [] }),
          isAlumni || isAdminOrHead ? fetchDirectoryMembers() : Promise.resolve({ data: [] }),
          isJuniorMember ? fetchLearningOverview() : Promise.resolve({ data: null }),
        ]);
      setPosts(postRes.status === 'fulfilled' && Array.isArray(postRes.value?.data) ? postRes.value.data : []);
      setProjects(projectRes.status === 'fulfilled' && Array.isArray(projectRes.value?.data) ? projectRes.value.data : []);
      setMeetings(meetingRes.status === 'fulfilled' && Array.isArray(meetingRes.value?.data) ? meetingRes.value.data : []);
      setInsights(insightRes.status === 'fulfilled' ? insightRes.value?.data || null : null);
      setApplications(appRes.status === 'fulfilled' && Array.isArray(appRes.value?.data) ? appRes.value.data : []);
      setDirectoryMembers(directoryRes.status === 'fulfilled' && Array.isArray(directoryRes.value?.data) ? directoryRes.value.data : []);
      setLearningOverview(learningRes.status === 'fulfilled' ? learningRes.value?.data || null : null);
      if ([postRes, projectRes, meetingRes].filter((r) => r.status === 'rejected').length >= 2)
        setLoadError('Dashboard data is partially unavailable.');
    } catch {
      setLoadError('Unable to load dashboard right now.');
    } finally {
      setLoading(false);
    }
  }, [isAdminOrHead, isAlumni, isJuniorMember]);

  useEffect(() => { loadDashboard(); }, [loadDashboard]);

  /* derived data */
  const member = insights?.member || userData || {};
  const metrics = insights?.metrics || {};
  const alumniProfile = member?.alumniProfile || userData.alumniProfile || {};

  const upcomingMeetings = useMemo(() =>
    [...meetings].filter((r) => toMs(r.startTime) >= Date.now() - 86400000).sort((a, b) => toMs(a.startTime) - toMs(b.startTime)).slice(0, 6),
    [meetings]);

  const topProjects = useMemo(() =>
    [...projects].sort((a, b) => toMs(b.updatedAt || b.createdAt) - toMs(a.updatedAt || a.createdAt)).slice(0, 6),
    [projects]);

  const recentPosts = useMemo(() =>
    [...posts].sort((a, b) => toMs(b.createdAt) - toMs(a.createdAt)).slice(0, 6),
    [posts]);

  const applicationStats = useMemo(() => {
    const b = { total: applications.length, new: 0, interview: 0, selected: 0 };
    applications.forEach((a) => { if (a.status === 'New') b.new++; if (a.status === 'Interview') b.interview++; if (a.status === 'Selected') b.selected++; });
    return b;
  }, [applications]);

  const projectPulse = useMemo(() => {
    const t = Math.max(1, topProjects.length);
    const c = topProjects.filter((r) => String(r.status || '').toLowerCase() === 'completed').length;
    const at = topProjects.filter((r) => ['delayed', 'on-hold'].includes(String(r.status || '').toLowerCase())).length;
    return [
      { label: 'Completed', v: c, pct: Math.round(c / t * 100), grad: 'from-emerald-400 to-teal-500' },
      { label: 'Active', v: Math.max(0, topProjects.length - c - at), pct: Math.round(Math.max(0, topProjects.length - c - at) / t * 100), grad: 'from-cyan-400 to-blue-500' },
      { label: 'At Risk', v: at, pct: Math.round(at / t * 100), grad: 'from-rose-400 to-orange-500' },
    ];
  }, [topProjects]);

  const kpis = useMemo(() => [
    { label: 'Projects', value: projects.length, delta: trendDelta(projects, (r) => r.updatedAt || r.createdAt), icon: FolderKanban, grad: 'from-cyan-400 to-blue-500' },
    { label: 'Meetings', value: meetings.length, delta: trendDelta(meetings, (r) => r.startTime), icon: CalendarDays, grad: 'from-blue-400 to-indigo-500' },
    { label: 'Discussions', value: posts.length, delta: trendDelta(posts, (r) => r.createdAt), icon: MessageSquareText, grad: 'from-amber-400 to-orange-500' },
    isAdminOrHead
      ? { label: 'Recruitment', value: applicationStats.total, delta: trendDelta(applications, (r) => r.updatedAt || r.createdAt), icon: Target, grad: 'from-emerald-400 to-teal-500' }
      : { label: 'Points', value: Number(learningOverview?.stats?.myPoints || 0), delta: Number(learningOverview?.stats?.myApprovedTasks || 0), icon: BookOpenCheck, grad: 'from-emerald-400 to-teal-500' },
  ], [applications, applicationStats.total, isAdminOrHead, learningOverview, meetings, posts, projects]);

  const quickActions = useMemo(() => {
    const base = [
      { to: '/projects', label: 'Projects', icon: FolderKanban },
      { to: '/meetings', label: 'Meetings', icon: CalendarDays },
      { to: '/community', label: 'Community', icon: MessageSquareText },
      { to: '/events', label: 'Events', icon: Activity },
    ];
    if (isAdminOrHead) return [{ to: '/admin', label: 'Admin', icon: ShieldCheck }, ...base];
    if (isJuniorMember) return [{ to: '/learning', label: 'Learning', icon: BookOpenCheck }, ...base];
    if (isAlumni) return [{ to: '/community?tab=directory', label: 'Directory', icon: Users }, ...base];
    return base;
  }, [isAdminOrHead, isAlumni, isJuniorMember]);

  const alumniTenures = useMemo(() =>
    (Array.isArray(alumniProfile?.tenures) ? alumniProfile.tenures : [])
      .filter((r) => r?.position && r?.fromYear)
      .sort((a, b) => Number(a.fromYear) - Number(b.fromYear)),
    [alumniProfile?.tenures]);

  const juniorRecs = useMemo(() =>
    (Array.isArray(learningOverview?.recommendedTasks) ? learningOverview.recommendedTasks : []).slice(0, 4),
    [learningOverview?.recommendedTasks]);

  const greetName = member?.name?.split(' ')[0] || 'there';
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  if (loading) return <DashboardSkeleton />;

  /* ═══════════ RENDER ═══════════ */
  return (
    <div className="dash-page">

      {/* ── Hero Greeting ── */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="dash-hero"
      >
        <div className="dash-hero-bg" />
        <div className="relative z-10 px-6 md:px-10 py-10 md:py-14">
          <p className="text-sm md:text-base font-medium text-cyan-300/80 tracking-wide uppercase">
            {isAlumni ? 'Alumni Hub' : isAdminOrHead ? 'Admin Dashboard' : 'Dashboard'}
          </p>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-white mt-2 tracking-tight leading-tight">
            {greeting}, {greetName}
          </h1>
          <p className="text-base md:text-lg text-gray-400 mt-3 max-w-xl leading-relaxed">
            Here's what's happening across CICR Connect right now.
          </p>
          <div className="flex flex-wrap gap-3 mt-6">
            {quickActions.slice(0, 5).map((a) => (
              <Link key={a.to} to={a.to} className="dash-quick-btn">
                <a.icon size={15} />
                {a.label}
              </Link>
            ))}
          </div>
        </div>
      </motion.section>

      {loadError && (
        <section className="dash-error">
          <p>{loadError}</p>
          <button type="button" onClick={loadDashboard} className="dash-retry-btn"><Loader2 size={14} className="animate-spin" /> Retry</button>
        </section>
      )}

      {/* ── KPI Cards ── */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5">
        {kpis.map((kpi, i) => {
          const Icon = kpi.icon;
          const dt = kpi.delta;
          return (
            <motion.article
              key={kpi.label}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: i * 0.07 }}
              className="dash-kpi"
            >
              <div className={`dash-kpi-icon bg-linear-to-br ${kpi.grad}`}>
                <Icon size={20} className="text-white" />
              </div>
              <p className="text-sm text-gray-400 font-medium mt-4">{kpi.label}</p>
              <p className="text-3xl md:text-4xl font-extrabold text-white mt-1 tracking-tight">{kpi.value}</p>
              <p className={`text-xs font-semibold mt-2 ${dt > 0 ? 'text-emerald-400' : dt < 0 ? 'text-rose-400' : 'text-gray-500'}`}>
                {dt > 0 ? '+' : ''}{dt} this week
              </p>
            </motion.article>
          );
        })}
      </section>

      {/* ── Meetings Slider ── */}
      <section>
        <div className="dash-section-header">
          <div>
            <h2 className="text-xl md:text-2xl font-bold text-white">Upcoming Meetings</h2>
            <p className="text-sm text-gray-500 mt-1">Your next sessions at a glance</p>
          </div>
          <Link to="/meetings" className="dash-see-all">See all <ArrowRight size={14} /></Link>
        </div>
        {upcomingMeetings.length === 0 ? (
          <div className="dash-empty">No upcoming meetings. <Link to="/meetings" className="text-cyan-400 ml-1">Schedule one</Link></div>
        ) : (
          <Slider>
            {upcomingMeetings.map((m, i) => (
              <motion.article
                key={m._id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.05 }}
                className="dash-card dash-card-meeting"
              >
                <div className="flex items-center gap-2 mb-3">
                  <span className="dash-card-badge bg-blue-500/15 text-blue-300 border-blue-500/25">
                    {m.meetingType || 'General'}
                  </span>
                  <span className="text-xs text-gray-500">{relDay(m.startTime)}</span>
                </div>
                <h3 className="text-base font-bold text-white leading-snug line-clamp-2">{m.title}</h3>
                <p className="text-sm text-gray-400 mt-2 line-clamp-1">{m.details?.topic || 'No topic added'}</p>
                <div className="mt-auto pt-4 flex items-center gap-2 text-xs text-gray-500">
                  <CalendarDays size={13} />
                  <span>{fmtDate(m.startTime)} {fmtTime(m.startTime) && `· ${fmtTime(m.startTime)}`}</span>
                </div>
              </motion.article>
            ))}
          </Slider>
        )}
      </section>

      {/* ── Projects Slider ── */}
      <section>
        <div className="dash-section-header">
          <div>
            <h2 className="text-xl md:text-2xl font-bold text-white">Active Projects</h2>
            <p className="text-sm text-gray-500 mt-1">Latest updates across your workspace</p>
          </div>
          <Link to="/projects" className="dash-see-all">See all <ArrowRight size={14} /></Link>
        </div>
        {topProjects.length === 0 ? (
          <div className="dash-empty">No projects yet. <Link to="/projects" className="text-cyan-400 ml-1">Create one</Link></div>
        ) : (
          <Slider>
            {topProjects.map((p, i) => {
              const sc = statusColor(p.status);
              const pct = Math.max(0, Math.min(100, Math.round(Number(p.progress || 0))));
              return (
                <motion.article
                  key={p._id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.05 }}
                  className="dash-card"
                >
                  <Link to={`/projects/${p._id}`} className="block h-full">
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <span className={`dash-card-badge ${sc.bg} ${sc.text} ${sc.border}`}>{p.status || 'Planning'}</span>
                      <span className="text-lg font-extrabold text-white">{pct}%</span>
                    </div>
                    <h3 className="text-base font-bold text-white leading-snug line-clamp-2">{p.title}</h3>
                    <p className="text-sm text-gray-400 mt-1 line-clamp-1">{p.domain || p.event?.title || 'Standalone'}</p>
                    <div className="mt-auto pt-4">
                      <div className="h-2 rounded-full bg-white/6 overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${pct}%` }}
                          transition={{ duration: 0.7, delay: 0.2 }}
                          className="h-full rounded-full bg-linear-to-r from-cyan-400 to-blue-500"
                        />
                      </div>
                      <p className="text-xs text-gray-500 mt-2">{p.stage || 'Planning'} · Lead: {p.lead?.name || 'TBD'}</p>
                    </div>
                  </Link>
                </motion.article>
              );
            })}
          </Slider>
        )}
      </section>

      {/* ── Discussions Slider ── */}
      <section>
        <div className="dash-section-header">
          <div>
            <h2 className="text-xl md:text-2xl font-bold text-white">Recent Discussions</h2>
            <p className="text-sm text-gray-500 mt-1">Community activity and updates</p>
          </div>
          <Link to="/community" className="dash-see-all">See all <ArrowRight size={14} /></Link>
        </div>
        {recentPosts.length === 0 ? (
          <div className="dash-empty">Nothing posted yet. <Link to="/community" className="text-cyan-400 ml-1">Start a thread</Link></div>
        ) : (
          <Slider>
            {recentPosts.map((p, i) => (
              <motion.article
                key={p._id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.05 }}
                className="dash-card"
              >
                <Link to="/community" className="block h-full">
                  <span className="dash-card-badge bg-indigo-500/15 text-indigo-300 border-indigo-500/25 mb-3 inline-flex">
                    {p.type || 'Update'}
                  </span>
                  <p className="text-base font-semibold text-white line-clamp-3 leading-relaxed">{p.content || 'No content'}</p>
                  <div className="mt-auto pt-4 flex items-center justify-between text-xs text-gray-500">
                    <span>{p.user?.name || 'Member'}</span>
                    <span>{fmtDate(p.createdAt)}</span>
                  </div>
                </Link>
              </motion.article>
            ))}
          </Slider>
        )}
      </section>

      {/* ── Bottom Grid: Pulse + Role cards ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-5">

        {/* Project Pulse */}
        <motion.section
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
          className="dash-panel"
        >
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <BarChart3 size={18} className="text-cyan-400" /> Project Pulse
          </h3>
          <div className="mt-5 space-y-4">
            {projectPulse.map((item) => (
              <div key={item.label}>
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-sm font-medium text-gray-300">{item.label}</p>
                  <p className="text-sm font-bold text-white">{item.v} <span className="text-gray-500 font-normal">({item.pct}%)</span></p>
                </div>
                <div className="h-2.5 rounded-full bg-white/6 overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    whileInView={{ width: `${Math.max(6, item.pct)}%` }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.7 }}
                    className={`h-full rounded-full bg-linear-to-r ${item.grad}`}
                  />
                </div>
              </div>
            ))}
          </div>
        </motion.section>

        {/* Profile */}
        <motion.section
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          className="dash-panel"
        >
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Users size={18} className="text-blue-400" /> Profile
          </h3>
          <div className="mt-4 space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-gray-400">Name</span>
              <span className="text-white font-medium">{member.name || 'N/A'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-400">Role</span>
              <span className="text-white font-medium capitalize">{role || 'Member'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-400">Years in CICR</span>
              <span className="text-white font-medium">{member.yearsInCICR ?? 0}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-400">Contributions</span>
              <span className="text-white font-medium">{metrics.totalProjectContributions || projects.length}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-400">Members</span>
              <span className="text-white font-medium">{directoryMembers.length}</span>
            </div>
          </div>
          <Link to="/profile" className="dash-panel-link mt-5">View Profile <ArrowUpRight size={14} /></Link>
        </motion.section>

        {/* Role-specific card */}
        {isAdminOrHead && (
          <motion.section
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
            className="dash-panel"
          >
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <ShieldCheck size={18} className="text-emerald-400" /> Recruitment
            </h3>
            <div className="mt-4 grid grid-cols-2 gap-3">
              {[
                { l: 'Total', v: applicationStats.total },
                { l: 'New', v: applicationStats.new },
                { l: 'Interview', v: applicationStats.interview },
                { l: 'Selected', v: applicationStats.selected },
              ].map((s) => (
                <div key={s.l} className="dash-mini-stat">
                  <p className="text-2xl font-extrabold text-white">{s.v}</p>
                  <p className="text-xs text-gray-400 mt-1">{s.l}</p>
                </div>
              ))}
            </div>
            {applicationStats.new > 0 && (
              <p className="text-xs text-amber-300 flex items-center gap-1.5 mt-4"><AlertTriangle size={13} /> {applicationStats.new} need triage</p>
            )}
            <Link to="/admin" className="dash-panel-link mt-4">Open Recruitment <ArrowUpRight size={14} /></Link>
          </motion.section>
        )}

        {isJuniorMember && (
          <motion.section
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
            className="dash-panel"
          >
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <BookOpenCheck size={18} className="text-cyan-400" /> Learning
            </h3>
            <div className="mt-4 grid grid-cols-3 gap-3">
              {[
                { l: 'Tracks', v: learningOverview?.stats?.activeTracks || 0 },
                { l: 'Approved', v: learningOverview?.stats?.myApprovedTasks || 0 },
                { l: 'Points', v: learningOverview?.stats?.myPoints || 0 },
              ].map((s) => (
                <div key={s.l} className="dash-mini-stat">
                  <p className="text-2xl font-extrabold text-white">{s.v}</p>
                  <p className="text-xs text-gray-400 mt-1">{s.l}</p>
                </div>
              ))}
            </div>
            {juniorRecs.length > 0 && (
              <div className="mt-4 space-y-2">
                <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Recommended</p>
                {juniorRecs.map((r) => (
                  <p key={`${r.trackId}-${r.moduleIndex}-${r.taskIndex}`} className="text-sm text-gray-300 truncate">
                    · {r.taskTitle}
                  </p>
                ))}
              </div>
            )}
            <Link to="/learning" className="dash-panel-link mt-4">Open Learning Hub <ArrowUpRight size={14} /></Link>
          </motion.section>
        )}

        {isAlumni && (
          <motion.section
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
            className="dash-panel"
          >
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <GraduationCap size={18} className="text-indigo-400" /> Alumni
            </h3>
            <div className="mt-4 space-y-2.5 text-sm">
              <div className="flex items-center gap-2 text-gray-300"><Building2 size={14} className="text-cyan-400 shrink-0" /> {alumniProfile?.currentOrganization || 'Not added'}</div>
              <div className="flex items-center gap-2 text-gray-300"><Activity size={14} className="text-emerald-400 shrink-0" /> {alumniProfile?.currentDesignation || 'Not added'}</div>
              <div className="flex items-center gap-2 text-gray-300"><MapPin size={14} className="text-amber-400 shrink-0" /> {alumniProfile?.location || 'Not added'}</div>
            </div>
            {alumniTenures.length > 0 && (
              <div className="mt-4 space-y-1.5 text-sm text-gray-400">
                {alumniTenures.slice(0, 3).map((t, i) => (
                  <p key={i}>{t.position} · {t.fromYear}–{t.toYear}</p>
                ))}
              </div>
            )}
          </motion.section>
        )}
      </div>
    </div>
  );
}
