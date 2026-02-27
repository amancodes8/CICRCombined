import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Clock3,
  Layers3,
  Loader2,
  MapPin,
  Users,
} from 'lucide-react';
import { fetchEventById } from '../api';

const formatDateTime = (value) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'TBD';
  return parsed.toLocaleString();
};

const formatDate = (value) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'TBD';
  return parsed.toLocaleDateString();
};

const statusTone = (status) => {
  const normalized = String(status || '').toLowerCase();
  if (normalized === 'scheduled') return 'text-cyan-200 border-cyan-500/40 bg-cyan-500/10';
  if (normalized === 'completed') return 'text-emerald-200 border-emerald-500/40 bg-emerald-500/10';
  return 'text-rose-200 border-rose-500/40 bg-rose-500/10';
};

const projectStatusTone = (status) => {
  const normalized = String(status || '').toLowerCase();
  if (normalized === 'completed') return 'text-emerald-200 border-emerald-500/35 bg-emerald-500/10';
  if (normalized === 'awaiting review') return 'text-amber-200 border-amber-500/35 bg-amber-500/10';
  if (normalized === 'delayed' || normalized === 'on-hold') return 'text-rose-200 border-rose-500/35 bg-rose-500/10';
  return 'text-cyan-100 border-cyan-500/35 bg-cyan-500/10';
};

export default function EventDetails() {
  const { id } = useParams();
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const loadEvent = async () => {
      setLoading(true);
      try {
        const { data } = await fetchEventById(id);
        if (!active) return;
        setEvent(data || null);
      } catch {
        if (!active) return;
        setEvent(null);
      } finally {
        if (active) setLoading(false);
      }
    };
    loadEvent();
    return () => {
      active = false;
    };
  }, [id]);

  const projects = useMemo(
    () =>
      [...(Array.isArray(event?.projects) ? event.projects : [])].sort((a, b) => {
        const aTime = new Date(a.deadline).getTime();
        const bTime = new Date(b.deadline).getTime();
        if (!Number.isFinite(aTime) || !Number.isFinite(bTime)) return 0;
        return aTime - bTime;
      }),
    [event?.projects]
  );

  const projectStatusCounts = useMemo(() => {
    const map = {};
    for (const project of projects) {
      const status = String(project.status || 'Planning');
      map[status] = (map[status] || 0) + 1;
    }
    return map;
  }, [projects]);

  const projectStageCounts = useMemo(() => {
    const map = {};
    for (const project of projects) {
      const stage = String(project.stage || 'Planning');
      map[stage] = (map[stage] || 0) + 1;
    }
    return map;
  }, [projects]);

  const averageProgress = useMemo(() => {
    if (!projects.length) return 0;
    const total = projects.reduce((sum, project) => sum + Math.max(0, Math.min(100, Number(project.progress || 0))), 0);
    return Math.round(total / projects.length);
  }, [projects]);

  if (loading) {
    return (
      <div className="h-[70vh] flex items-center justify-center">
        <Loader2 className="animate-spin text-blue-500" />
      </div>
    );
  }

  if (!event) {
    return (
      <div className="ui-page max-w-5xl space-y-5 page-motion-b">
        <Link to="/events" className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white">
          <ArrowLeft size={14} /> Back to events
        </Link>
        <div className="border border-gray-800 p-8">
          <p className="text-red-300 font-semibold">Event not found.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="ui-page max-w-7xl space-y-6 pb-14 page-motion-c">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-800/70 pb-3">
        <Link to="/events" className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white">
          <ArrowLeft size={14} /> Back to events
        </Link>
        <div className="flex items-center gap-2 flex-wrap">
          <Link to={`/projects?event=${event._id}`} className="btn btn-secondary !text-xs !px-3 !py-2">
            <Layers3 size={12} /> Project Tracks
          </Link>
          {event.allowApplications ? (
            <Link to={`/apply?event=${event._id}`} className="btn btn-secondary !text-xs !px-3 !py-2">
              <Users size={12} /> Apply Link
            </Link>
          ) : null}
        </div>
      </header>

      <motion.section
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45 }}
        className="space-y-3 border-b border-gray-800/70 pb-5"
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2 max-w-3xl">
            <p className="text-xs text-cyan-300 font-semibold">Event Command View</p>
            <h1 className="text-3xl md:text-4xl font-semibold text-white leading-tight">{event.title}</h1>
            <p className="text-sm md:text-base text-gray-300">{event.description || 'No event description available.'}</p>
          </div>
          <span className={`text-xs px-3 py-1.5 rounded-full border h-fit ${statusTone(event.status)}`}>
            {event.status}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
          <Metric label="Event Type" value={event.type || 'Internal'} tone="cyan" />
          <Metric label="Project Tracks" value={String(projects.length)} tone="blue" />
          <Metric label="Avg Progress" value={`${averageProgress}%`} tone="violet" />
          <Metric label="Start" value={formatDate(event.startTime)} tone="emerald" />
          <Metric label="End" value={formatDate(event.endTime)} tone="amber" />
        </div>
      </motion.section>

      <section className="grid grid-cols-1 xl:grid-cols-[320px_minmax(0,1fr)] gap-8">
        <aside className="space-y-4 xl:border-r xl:border-gray-800/70 xl:pr-5 h-fit">
          <h2 className="text-sm font-semibold text-gray-300">Operational Context</h2>
          <div className="space-y-2 text-sm text-gray-300">
            <p className="inline-flex items-center gap-2"><MapPin size={14} className="text-emerald-300" /> {event.location}</p>
            <p className="inline-flex items-center gap-2"><CalendarDays size={14} className="text-blue-300" /> {formatDateTime(event.startTime)}</p>
            <p className="inline-flex items-center gap-2"><Clock3 size={14} className="text-amber-300" /> {formatDateTime(event.endTime)}</p>
            {event.allowApplications ? (
              <p className="inline-flex items-center gap-2 text-cyan-200">
                <Users size={14} /> Applications open till {formatDate(event.applicationDeadline)}
              </p>
            ) : (
              <p className="text-gray-500">Applications disabled for this event.</p>
            )}
          </div>

          <div className="space-y-2 pt-2 border-t border-gray-800/70">
            <p className="text-xs text-gray-400 font-semibold">Status Distribution</p>
            {Object.keys(projectStatusCounts).length === 0 ? (
              <p className="text-sm text-gray-500">No project statuses available yet.</p>
            ) : (
              Object.entries(projectStatusCounts).map(([status, count]) => (
                <div key={status} className="flex items-center justify-between text-sm text-gray-300">
                  <span>{status}</span>
                  <span className="text-cyan-200">{count}</span>
                </div>
              ))
            )}
          </div>

          <div className="space-y-2 pt-2 border-t border-gray-800/70">
            <p className="text-xs text-gray-400 font-semibold">Stage Distribution</p>
            {Object.keys(projectStageCounts).length === 0 ? (
              <p className="text-sm text-gray-500">No stage data available yet.</p>
            ) : (
              Object.entries(projectStageCounts).map(([stage, count]) => {
                const width = projects.length ? Math.max(8, (count / projects.length) * 100) : 0;
                return (
                  <div key={stage} className="space-y-1">
                    <div className="flex items-center justify-between text-xs text-gray-300">
                      <span>{stage}</span>
                      <span className="text-cyan-200">{count}</span>
                    </div>
                    <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-cyan-400 via-blue-400 to-indigo-400" style={{ width: `${width}%` }} />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </aside>

        <section className="border-y border-gray-800/80">
          <div className="grid grid-cols-[minmax(0,1.5fr)_0.75fr_0.85fr] gap-2 px-4 md:px-6 py-2 text-sm text-gray-400 font-semibold border-b border-gray-800/80">
            <span>Project</span>
            <span className="hidden md:block">Deadline</span>
            <span className="text-right">Status</span>
          </div>

          {projects.length === 0 ? (
            <p className="px-6 py-10 text-sm text-gray-500">No projects initialized for this event.</p>
          ) : (
            <div className="divide-y divide-gray-800/80">
              {projects.map((project, idx) => (
                <motion.article
                  key={project._id || `${project.title}-${idx}`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.035, duration: 0.32 }}
                  className="px-4 md:px-6 py-4 hover:bg-white/[0.03] transition-colors"
                >
                  <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1.5fr)_0.75fr_0.85fr] gap-2 items-center">
                    <div>
                      <p className="text-white font-semibold text-base">{project.title}</p>
                      <p className="text-xs text-gray-400 mt-1">{project.stage || 'Planning'} • {project.domain || 'Tech'}</p>
                      <div className="mt-2 h-1.5 rounded-full bg-gray-800 overflow-hidden max-w-xl">
                        <div
                          className="h-full bg-gradient-to-r from-cyan-400 via-blue-400 to-indigo-400"
                          style={{ width: `${Math.max(0, Math.min(100, Number(project.progress || 0)))}%` }}
                        />
                      </div>
                    </div>
                    <p className="hidden md:block text-sm text-gray-300">{formatDate(project.deadline)}</p>
                    <div className="flex items-center justify-end gap-2">
                      <span className={`text-xs px-2 py-1 rounded-full border ${projectStatusTone(project.status)}`}>
                        {project.status || 'Planning'}
                      </span>
                      <Link to={`/projects/${project._id}`} className="inline-flex items-center gap-1 text-xs text-cyan-200 hover:text-white">
                        Open <ArrowRight size={13} />
                      </Link>
                    </div>
                  </div>
                </motion.article>
              ))}
            </div>
          )}
        </section>
      </section>
    </div>
  );
}

function Metric({ label, value, tone = 'cyan' }) {
  const toneClass =
    tone === 'blue'
      ? 'border-blue-500/40 text-blue-100'
      : tone === 'emerald'
      ? 'border-emerald-500/40 text-emerald-100'
      : tone === 'violet'
      ? 'border-violet-500/40 text-violet-100'
      : tone === 'amber'
      ? 'border-amber-500/40 text-amber-100'
      : 'border-cyan-500/40 text-cyan-100';

  return (
    <article className={`border-l-2 pl-3 ${toneClass}`}>
      <p className="text-sm text-gray-400">{label}</p>
      <p className="text-base font-semibold mt-1">{value}</p>
    </article>
  );
}
