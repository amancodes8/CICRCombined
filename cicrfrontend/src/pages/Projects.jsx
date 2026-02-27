import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus,
  Search,
  ChevronRight,
  Users,
  Target,
  Loader2,
  Rocket,
  CalendarClock,
  Layers3,
} from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { fetchProjects } from '../api';
import PageHeader from '../components/PageHeader';

const STATUS_OPTIONS = ['all', 'Planning', 'Active', 'On-Hold', 'Delayed', 'Awaiting Review', 'Completed', 'Archived', 'Ongoing'];

const dispatchToast = (message, type = 'info') => {
  try {
    window.dispatchEvent(new CustomEvent('app:toast', { detail: { message, type } }));
  } catch {
    window.alert(message);
  }
};

const formatDateTime = (value) => {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return 'TBD';
  return d.toLocaleString();
};

const statusClass = (status) => {
  const normalized = String(status || '').toLowerCase();
  if (normalized === 'completed') return 'text-emerald-300 border-emerald-500/40';
  if (normalized === 'awaiting review') return 'text-amber-300 border-amber-500/40';
  if (normalized === 'on-hold' || normalized === 'delayed') return 'text-rose-300 border-rose-500/40';
  return 'text-blue-300 border-blue-500/35';
};

function ProgressDonut({ progress = 0 }) {
  const clamped = Math.max(0, Math.min(100, Number(progress) || 0));
  const radius = 24;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (clamped / 100) * circumference;

  return (
    <svg width="64" height="64" viewBox="0 0 64 64" className="shrink-0">
      <circle cx="32" cy="32" r={radius} stroke="rgba(148,163,184,0.2)" strokeWidth="6" fill="none" />
      <circle
        cx="32"
        cy="32"
        r={radius}
        stroke="rgba(56,189,248,0.95)"
        strokeWidth="6"
        fill="none"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={dashOffset}
        transform="rotate(-90 32 32)"
      />
      <text x="32" y="36" textAnchor="middle" className="fill-white text-[11px] font-black">
        {clamped}%
      </text>
    </svg>
  );
}

export default function Projects() {
  const [searchParams] = useSearchParams();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  const profile = JSON.parse(localStorage.getItem('profile') || '{}');
  const userData = profile.result || profile;
  const role = String(userData.role || '').toLowerCase();
  const isAdmin = role === 'admin';

  const eventId = searchParams.get('event') || '';

  useEffect(() => {
    const loadProjects = async () => {
      setLoading(true);
      try {
        const { data } = await fetchProjects(eventId ? { eventId } : {});
        const projectData = Array.isArray(data) ? data : data?.projects || [];
        setProjects(projectData);
      } catch (err) {
        dispatchToast(err.response?.data?.message || 'Error fetching projects.', 'error');
      } finally {
        setLoading(false);
      }
    };
    loadProjects();
  }, [eventId]);

  const filteredProjects = useMemo(
    () =>
      projects.filter((project) => {
        const text = `${project.title || ''} ${project.description || ''} ${project.event?.title || ''}`.toLowerCase();
        const matchesSearch = text.includes(searchTerm.toLowerCase());
        const matchesStatus = statusFilter === 'all' ? true : project.status === statusFilter;
        return matchesSearch && matchesStatus;
      }),
    [projects, searchTerm, statusFilter]
  );

  if (loading)
    return (
      <div className="h-[70vh] flex flex-col items-center justify-center gap-4">
        <Loader2 className="animate-spin text-blue-500" size={40} />
        <p className="text-gray-500 font-black text-[10px] uppercase tracking-widest">Loading Projects...</p>
      </div>
    );

  return (
    <div className="ui-page space-y-8 px-4 sm:px-6 lg:px-8 pb-20 page-motion-b">
      <header className="pt-4 section-motion section-motion-delay-1">
        <PageHeader
          eyebrow="Project Workspace"
          title="Event Projects"
          subtitle="Live view of assigned projects, delivery stages, and completion readiness."
          icon={Rocket}
          actions={
            isAdmin ? (
              <Link to={eventId ? `/create-project?event=${eventId}` : '/create-project'} className="btn btn-primary">
                <Plus size={14} /> Initialize Project
              </Link>
            ) : (
              <div className="btn btn-ghost">Lead/Admin managed</div>
            )
          }
        />
      </header>

      <div className="flex flex-col lg:flex-row gap-4 items-center justify-between p-3 md:p-4 section-motion section-motion-delay-2">
        <div className="relative w-full lg:w-96 group">
          <Search
            className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-blue-500 transition-colors"
            size={18}
          />
          <input
            type="text"
            placeholder="Search projects, event, description..."
            className="w-full bg-[#0a0a0c] border border-gray-800 rounded-xl md:rounded-2xl py-3 pl-12 pr-4 outline-none focus:border-blue-500 transition-all text-white text-sm"
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="w-full lg:w-auto flex flex-wrap gap-2">
          {STATUS_OPTIONS.map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                statusFilter === status ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-500 hover:text-gray-300 border border-gray-800'
              }`}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 section-motion section-motion-delay-3 pro-stagger">
        <AnimatePresence>
          {filteredProjects.map((project, idx) => (
            <motion.article
              layout
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.03 }}
              key={project._id}
              className="border border-gray-800 rounded-[1.7rem] p-6 flex flex-col gap-4 hover:border-blue-500/45 transition-all group"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-cyan-300 font-black">
                    {project.event?.title || 'Standalone'}
                  </p>
                  <h3 className="text-xl font-black text-white mt-2 tracking-tight">{project.title}</h3>
                </div>
                <ProgressDonut progress={project.progress} />
              </div>

              <p className="text-sm text-gray-400 leading-relaxed line-clamp-3">{project.description}</p>

              <div className="grid grid-cols-2 gap-3 text-xs text-gray-400">
                <div className="inline-flex items-center gap-2">
                  <Layers3 size={13} className="text-blue-400" />
                  <span>{project.stage || 'Planning'}</span>
                </div>
                <div className="inline-flex items-center gap-2 justify-end">
                  <Users size={13} className="text-blue-400" />
                  <span>{project.team?.length || 0} members</span>
                </div>
                <div className="inline-flex items-center gap-2 col-span-2">
                  <CalendarClock size={13} className="text-amber-400" />
                  <span>Deadline: {formatDateTime(project.deadline)}</span>
                </div>
              </div>

              <div className="flex items-center justify-between mt-auto pt-3 border-t border-gray-800">
                <span className={`text-[10px] px-3 py-1 rounded-full border uppercase tracking-widest font-black ${statusClass(project.status)}`}>
                  {project.status || 'Planning'}
                </span>
                <Link
                  to={`/projects/${project._id}`}
                  className="inline-flex items-center gap-1 text-xs uppercase tracking-widest text-cyan-100"
                >
                  Open <ChevronRight size={14} />
                </Link>
              </div>
            </motion.article>
          ))}
        </AnimatePresence>
      </div>

      {filteredProjects.length === 0 && !loading && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-20 rounded-[2rem] border border-dashed border-gray-800">
          <Target className="mx-auto text-gray-700 mb-4" size={46} />
          <p className="text-gray-500 font-black uppercase text-xs tracking-[0.24em]">No projects visible for this filter</p>
        </motion.div>
      )}
    </div>
  );
}
