import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  CalendarClock,
  ChevronRight,
  Layers3,
  Plus,
  Rocket,
  Search,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { fetchProjects } from '../api';
import { DataEmpty, DataLoading } from '../components/DataState';
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
  if (normalized === 'completed') return 'text-emerald-200 border-emerald-500/35 bg-emerald-500/10';
  if (normalized === 'awaiting review') return 'text-amber-200 border-amber-500/35 bg-amber-500/10';
  if (normalized === 'on-hold' || normalized === 'delayed') return 'text-rose-200 border-rose-500/35 bg-rose-500/10';
  return 'text-cyan-100 border-cyan-500/35 bg-cyan-500/10';
};

const clampProgress = (value) => Math.max(0, Math.min(100, Number(value) || 0));

export default function Projects() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const initialStatus = searchParams.get('status') || 'all';
  const [statusFilter, setStatusFilter] = useState(STATUS_OPTIONS.includes(initialStatus) ? initialStatus : 'all');
  const [searchTerm, setSearchTerm] = useState(searchParams.get('q') || '');
  const [selectedProjectId, setSelectedProjectId] = useState('');

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

  useEffect(() => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (searchTerm.trim()) next.set('q', searchTerm.trim());
        else next.delete('q');

        if (statusFilter && statusFilter !== 'all') next.set('status', statusFilter);
        else next.delete('status');

        return next;
      },
      { replace: true }
    );
  }, [searchTerm, setSearchParams, statusFilter]);

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

  useEffect(() => {
    if (!filteredProjects.length) {
      setSelectedProjectId('');
      return;
    }
    if (!filteredProjects.some((project) => project._id === selectedProjectId)) {
      setSelectedProjectId(filteredProjects[0]._id);
    }
  }, [filteredProjects, selectedProjectId]);

  const selectedProject = useMemo(
    () => filteredProjects.find((project) => project._id === selectedProjectId) || filteredProjects[0] || null,
    [filteredProjects, selectedProjectId]
  );

  const projectMetrics = useMemo(() => {
    const completed = filteredProjects.filter((project) => String(project.status || '').toLowerCase() === 'completed').length;
    const review = filteredProjects.filter((project) => String(project.status || '').toLowerCase() === 'awaiting review').length;
    const active = filteredProjects.length - completed;
    return { completed, review, active };
  }, [filteredProjects]);

  if (loading) {
    return (
      <div className="h-[70vh] flex items-center justify-center">
        <DataLoading label="Loading projects..." />
      </div>
    );
  }

  return (
    <div className="ui-page space-y-6 px-4 sm:px-6 lg:px-8 pb-20 page-motion-b">
      <header className="pt-4 section-motion section-motion-delay-1">
        <PageHeader
          eyebrow="Project Workspace"
          title="Project Operations Desk"
          subtitle="Unified workspace for delivery state, ownership, and review readiness."
          icon={Rocket}
          actions={
            isAdmin ? (
              <Link to={eventId ? `/create-project?event=${eventId}` : '/create-project'} className="btn btn-primary">
                <Plus size={14} /> Initialize Project
              </Link>
            ) : (
              <div className="text-sm text-gray-400">Lead/Admin managed</div>
            )
          }
        />
      </header>

      <section className="border-y border-gray-800/70 py-3 section-motion section-motion-delay-1">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <MetricLine label="Active Scope" value={String(projectMetrics.active)} tone="cyan" />
          <MetricLine label="Awaiting Review" value={String(projectMetrics.review)} tone="amber" />
          <MetricLine label="Completed" value={String(projectMetrics.completed)} tone="emerald" />
        </div>
      </section>

      <section className="ui-toolbar-sticky border border-gray-800/70 section-motion section-motion-delay-2">
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)] gap-3 items-start lg:items-center">
          <div className="relative w-full">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
            <input
              type="text"
              placeholder="Search projects, event, description..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="ui-input pl-12"
            />
          </div>

          <div className="w-full flex flex-wrap gap-2">
            {STATUS_OPTIONS.map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => setStatusFilter(status)}
                aria-label={`Filter status ${status}`}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors border ${
                  statusFilter === status
                    ? 'text-cyan-100 border-cyan-500/50 bg-cyan-500/10'
                    : 'text-gray-500 hover:text-gray-200 border-gray-800'
                }`}
              >
                {status}
              </button>
            ))}
          </div>
        </div>
      </section>

      {filteredProjects.length === 0 ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="py-10">
          <DataEmpty
            title="No projects visible for this filter"
            hint="Try clearing filters or search to broaden results."
            actionLabel="Clear filters"
            onAction={() => {
              setSearchTerm('');
              setStatusFilter('all');
            }}
          />
        </motion.div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.25fr)_340px] gap-8 section-motion section-motion-delay-3">
          <section className="border-y border-gray-800/80">
            <div className="grid grid-cols-[minmax(0,1.6fr)_0.62fr_0.88fr] gap-2 px-4 md:px-5 py-2 text-sm text-gray-400 font-semibold border-b border-gray-800/80">
              <span>Project</span>
              <span className="hidden md:block">Deadline</span>
              <span className="text-right">Status</span>
            </div>

            <div className="divide-y divide-gray-800/80">
              {filteredProjects.map((project, idx) => {
                const active = project._id === selectedProject?._id;
                const progress = clampProgress(project.progress);
                return (
                  <motion.article
                    key={project._id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.025, duration: 0.3 }}
                    onClick={() => setSelectedProjectId(project._id)}
                    className={`px-4 md:px-5 py-4 cursor-pointer transition-colors ${
                      active ? 'bg-cyan-500/[0.06]' : 'hover:bg-white/[0.02]'
                    }`}
                  >
                    <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1.6fr)_0.62fr_0.88fr] gap-3 items-center">
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-base md:text-lg font-semibold text-white tracking-tight">{project.title}</h3>
                          <span className="text-xs text-cyan-300">{project.event?.title || 'Standalone'}</span>
                        </div>
                        <p className="text-sm text-gray-300 line-clamp-2">{project.description || 'No project summary.'}</p>
                        <div className="flex items-center gap-3 text-xs text-gray-400 flex-wrap">
                          <span className="inline-flex items-center gap-1.5"><Layers3 size={12} className="text-blue-300" /> {project.stage || 'Planning'}</span>
                          <span className="inline-flex items-center gap-1.5"><Users size={12} className="text-cyan-300" /> {project.team?.length || 0} members</span>
                        </div>
                        <div className="mt-1 h-1.5 rounded-full bg-gray-800 overflow-hidden max-w-xl">
                          <div
                            className="h-full bg-gradient-to-r from-cyan-400 via-blue-400 to-indigo-400"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      </div>

                      <div className="hidden md:block text-sm text-gray-300">
                        <p className="inline-flex items-center gap-1.5"><CalendarClock size={12} className="text-amber-300" /> {formatDateTime(project.deadline)}</p>
                      </div>

                      <div className="flex items-center justify-end gap-2">
                        <span className={`text-xs px-2.5 py-1 rounded-full border ${statusClass(project.status)}`}>
                          {project.status || 'Planning'}
                        </span>
                        <Link
                          to={`/projects/${project._id}`}
                          onClick={(event) => event.stopPropagation()}
                          className="inline-flex items-center gap-1 text-xs text-cyan-100 hover:text-white"
                        >
                          Open <ChevronRight size={13} />
                        </Link>
                      </div>
                    </div>
                  </motion.article>
                );
              })}
            </div>
          </section>

          <aside className="xl:border-l xl:border-gray-800/80 xl:pl-5 h-fit xl:sticky xl:top-24">
            {selectedProject ? (
              <div className="space-y-4">
                <div>
                  <p className="text-xs text-cyan-300 font-semibold">Project Intelligence</p>
                  <h3 className="text-2xl font-semibold text-white mt-2 leading-tight">{selectedProject.title}</h3>
                  <p className="text-sm text-gray-300 mt-2">{selectedProject.description || 'No project description available.'}</p>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-xs px-2.5 py-1 rounded-full border ${statusClass(selectedProject.status)}`}>
                    {selectedProject.status || 'Planning'}
                  </span>
                  <span className="text-xs px-2.5 py-1 rounded-full border border-blue-500/30 text-blue-100 bg-blue-500/10">
                    {selectedProject.stage || 'Planning'}
                  </span>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm text-gray-400">
                    <span>Execution progress</span>
                    <span className="text-cyan-100 font-semibold">{clampProgress(selectedProject.progress)}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-gray-800 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-cyan-400 via-blue-400 to-indigo-400"
                      style={{ width: `${clampProgress(selectedProject.progress)}%` }}
                    />
                  </div>
                </div>

                <div className="space-y-1.5 text-sm text-gray-300 border-y border-gray-800/70 py-3">
                  <p>Event: <span className="text-white">{selectedProject.event?.title || 'Standalone project'}</span></p>
                  <p>Lead: <span className="text-white">{selectedProject.lead?.name || 'Not assigned'}</span></p>
                  <p>Guide: <span className="text-white">{selectedProject.guide?.name || 'Not assigned'}</span></p>
                  <p>Deadline: <span className="text-white">{formatDateTime(selectedProject.deadline)}</span></p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Link to={`/projects/${selectedProject._id}`} className="btn btn-secondary !text-xs !px-3 !py-2">
                    <ArrowRight size={12} /> Open Workspace
                  </Link>
                  <Link to={`/projects/${selectedProject._id}/review`} className="btn btn-secondary !text-xs !px-3 !py-2 !text-emerald-200 !border-emerald-500/40">
                    <ShieldCheck size={12} /> Review Desk
                  </Link>
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-500">Select a project to preview details.</p>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}

function MetricLine({ label, value, tone = 'cyan' }) {
  const toneClass =
    tone === 'emerald'
      ? 'border-emerald-500/40 text-emerald-100'
      : tone === 'amber'
      ? 'border-amber-500/45 text-amber-100'
      : 'border-cyan-500/40 text-cyan-100';

  return (
    <article className={`border-l-2 pl-3 ${toneClass}`}>
      <p className="text-sm text-gray-400">{label}</p>
      <p className="text-2xl font-semibold mt-1">{value}</p>
    </article>
  );
}
