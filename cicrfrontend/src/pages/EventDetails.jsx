import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CalendarDays,
  Clock3,
  Layers3,
  Loader2,
  MapPin,
  Sparkles,
  UserPlus,
  Users,
} from 'lucide-react';
import { addEventParticipants, fetchDirectoryMembers, fetchEventById, fetchEvents } from '../api';

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

const initials = (name) =>
  String(name || 'User')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0] || '')
    .join('')
    .toUpperCase();

export default function EventDetails() {
  const { id } = useParams();
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [directoryMembers, setDirectoryMembers] = useState([]);
  const [participantSearch, setParticipantSearch] = useState('');
  const [selectedParticipantIds, setSelectedParticipantIds] = useState([]);
  const [addingParticipants, setAddingParticipants] = useState(false);
  const [participantMessage, setParticipantMessage] = useState(null);

  const profile = JSON.parse(localStorage.getItem('profile') || '{}');
  const user = profile.result || profile;
  const isAdmin = String(user?.role || '').toLowerCase() === 'admin';

  useEffect(() => {
    let active = true;
    const loadEvent = async () => {
      setLoading(true);
      setParticipantMessage(null);
      setSelectedParticipantIds([]);
      try {
        const { data } = await fetchEventById(id);
        if (!active) return;
        setEvent(data || null);
      } catch {
        if (!active) return;
        try {
          const fallbackResponse = await fetchEvents();
          if (!active) return;
          const rows = Array.isArray(fallbackResponse?.data) ? fallbackResponse.data : [];
          const fallbackEvent = rows.find((row) => String(row?._id || '') === String(id || '')) || null;
          setEvent(fallbackEvent);
        } catch {
          if (!active) return;
          setEvent(null);
        }
      } finally {
        if (active) setLoading(false);
      }
    };
    loadEvent();
    return () => {
      active = false;
    };
  }, [id]);

  useEffect(() => {
    if (!isAdmin) return undefined;

    let active = true;
    fetchDirectoryMembers()
      .then((response) => {
        if (!active) return;
        const rows = Array.isArray(response?.data) ? response.data : [];
        setDirectoryMembers(rows);
      })
      .catch(() => {
        if (!active) return;
        setDirectoryMembers([]);
      });

    return () => {
      active = false;
    };
  }, [isAdmin]);

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

  const eventDuration = useMemo(() => {
    const startMs = new Date(event?.startTime).getTime();
    const endMs = new Date(event?.endTime).getTime();
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) return 'Duration TBD';
    const totalHours = Math.round(((endMs - startMs) / (1000 * 60 * 60)) * 10) / 10;
    return totalHours >= 24
      ? `${Math.round((totalHours / 24) * 10) / 10} day(s)`
      : `${totalHours} hour(s)`;
  }, [event?.startTime, event?.endTime]);

  const participants = useMemo(
    () => (Array.isArray(event?.participants) ? event.participants : []),
    [event?.participants]
  );

  const participantIdSet = useMemo(
    () => new Set(participants.map((participant) => String(participant?._id || participant)).filter(Boolean)),
    [participants]
  );

  const availableMembers = useMemo(() => {
    const query = String(participantSearch || '').trim().toLowerCase();
    return directoryMembers.filter((member) => {
      const memberId = String(member?._id || '');
      if (!memberId || participantIdSet.has(memberId)) return false;
      if (!query) return true;
      const hay = `${member.name || ''} ${member.collegeId || ''} ${member.role || ''}`.toLowerCase();
      return hay.includes(query);
    });
  }, [directoryMembers, participantIdSet, participantSearch]);

  const statusEntries = useMemo(
    () => Object.entries(projectStatusCounts).sort((a, b) => b[1] - a[1]),
    [projectStatusCounts]
  );

  const stageEntries = useMemo(
    () => Object.entries(projectStageCounts).sort((a, b) => b[1] - a[1]),
    [projectStageCounts]
  );

  useEffect(() => {
    if (!selectedParticipantIds.length) return;
    setSelectedParticipantIds((prev) => prev.filter((memberId) => !participantIdSet.has(String(memberId))));
  }, [participantIdSet, selectedParticipantIds.length]);

  const toggleParticipantPick = (memberId) => {
    setParticipantMessage(null);
    setSelectedParticipantIds((prev) =>
      prev.includes(memberId) ? prev.filter((idValue) => idValue !== memberId) : [...prev, memberId]
    );
  };

  const handleAddParticipants = async () => {
    if (!isAdmin || !event?._id || selectedParticipantIds.length === 0) return;
    setAddingParticipants(true);
    setParticipantMessage(null);
    try {
      const { data } = await addEventParticipants(event._id, { participantIds: selectedParticipantIds });
      setEvent(data || null);
      const expected = new Set(selectedParticipantIds.map((idValue) => String(idValue)));
      const updatedIds = new Set(
        (Array.isArray(data?.participants) ? data.participants : [])
          .map((participant) => String(participant?._id || participant))
          .filter(Boolean)
      );
      const allApplied = [...expected].every((idValue) => updatedIds.has(idValue));
      if (!allApplied) {
        setParticipantMessage({
          type: 'error',
          text: 'Running backend does not support participant persistence yet. Restart backend with latest code.',
        });
        return;
      }
      setSelectedParticipantIds([]);
      setParticipantMessage({ type: 'success', text: 'Participants added successfully.' });
    } catch (err) {
      const status = err?.response?.status;
      setParticipantMessage({
        type: 'error',
        text:
          status === 404
            ? 'Participants API is not available on the running backend. Restart backend with latest code.'
            : err.response?.data?.message || 'Failed to add participants.',
      });
    } finally {
      setAddingParticipants(false);
    }
  };

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
    <div className="ui-page max-w-7xl pb-16 page-motion-c relative">
      <div className="pointer-events-none absolute -top-20 left-1/2 h-72 w-[82%] -translate-x-1/2 rounded-full bg-cyan-500/10 blur-3xl" />
      <div className="pointer-events-none absolute top-36 right-0 h-56 w-56 rounded-full bg-blue-500/10 blur-3xl" />

      <div className="relative space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
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
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
          className="relative overflow-hidden rounded-3xl border border-cyan-500/20 bg-[#070d14]/85 p-5 md:p-7"
        >
          <div className="pointer-events-none absolute -right-10 -top-14 h-52 w-52 rounded-full bg-cyan-400/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-20 left-24 h-52 w-52 rounded-full bg-blue-500/10 blur-3xl" />

          <div className="relative grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_310px] gap-6">
            <div className="space-y-4">
              <p className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-cyan-300 font-semibold">
                <Sparkles size={12} /> Event Command View
              </p>
              <h1 className="text-3xl md:text-4xl font-semibold text-white leading-tight tracking-tight">{event.title}</h1>
              <p className="text-sm md:text-base text-slate-300 max-w-3xl leading-relaxed">
                {event.description || 'No event description available.'}
              </p>

              <div className="flex flex-wrap gap-2">
                <span className={`text-xs px-3 py-1.5 rounded-full border ${statusTone(event.status)}`}>{event.status}</span>
                <span className="text-xs px-3 py-1.5 rounded-full border border-blue-500/40 text-blue-100 bg-blue-500/10">
                  {event.type || 'Internal'}
                </span>
                <span className="text-xs px-3 py-1.5 rounded-full border border-amber-500/35 text-amber-100 bg-amber-500/10">
                  {eventDuration}
                </span>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-800/90 bg-slate-950/70 p-4 md:p-5 space-y-3">
              <Metric label="Project Tracks" value={String(projects.length)} tone="blue" />
              <Metric label="Participants" value={String(participants.length)} tone="emerald" />
              <Metric label="Avg Progress" value={`${averageProgress}%`} tone="violet" />
              <Metric label="End Date" value={formatDate(event.endTime)} tone="amber" />
            </div>
          </div>
        </motion.section>

        <section className="grid grid-cols-1 xl:grid-cols-[360px_minmax(0,1fr)] gap-6">
          <aside className="rounded-3xl border border-slate-800/85 bg-slate-950/65 backdrop-blur-md overflow-hidden xl:sticky xl:top-24 h-fit">
            <section className="p-5 md:p-6 space-y-3">
              <h2 className="text-sm font-semibold text-slate-200">Operational Context</h2>
              <div className="space-y-2 text-sm text-slate-300">
                <p className="inline-flex items-center gap-2"><MapPin size={14} className="text-emerald-300" /> {event.location}</p>
                <p className="inline-flex items-center gap-2"><CalendarDays size={14} className="text-blue-300" /> {formatDateTime(event.startTime)}</p>
                <p className="inline-flex items-center gap-2"><Clock3 size={14} className="text-amber-300" /> {formatDateTime(event.endTime)}</p>
                {event.allowApplications ? (
                  <p className="inline-flex items-center gap-2 text-cyan-200">
                    <Users size={14} /> Applications open till {formatDate(event.applicationDeadline)}
                  </p>
                ) : (
                  <p className="text-slate-500">Applications disabled for this event.</p>
                )}
              </div>
            </section>

            <section className="border-t border-slate-800/80 p-5 md:p-6 space-y-3">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-400 font-semibold">Participants</p>
              {participants.length === 0 ? (
                <p className="text-sm text-slate-500">No participants added yet.</p>
              ) : (
                <div className="max-h-56 overflow-y-auto flex flex-wrap gap-2 pr-1">
                  {participants.map((participant) => (
                    <span
                      key={participant._id || participant.email || participant.collegeId}
                      className="inline-flex items-center gap-2 rounded-full border border-slate-700/90 bg-slate-900/80 px-2.5 py-1.5"
                    >
                      <span className="w-6 h-6 rounded-full border border-cyan-500/35 bg-cyan-500/10 text-cyan-100 text-[10px] font-semibold inline-flex items-center justify-center">
                        {initials(participant.name)}
                      </span>
                      <span className="text-xs text-slate-200">{participant.name || 'Unnamed'}</span>
                    </span>
                  ))}
                </div>
              )}
            </section>

            {isAdmin ? (
              <section className="border-t border-slate-800/80 p-5 md:p-6 space-y-3">
                <p className="text-xs uppercase tracking-[0.16em] text-cyan-200 font-semibold">Admin Controls</p>
                <input
                  value={participantSearch}
                  onChange={(eventValue) => setParticipantSearch(eventValue.target.value)}
                  className="ui-input py-2!"
                  placeholder="Search member by name, role, or college ID"
                />

                <div className="max-h-44 overflow-y-auto space-y-1.5 pr-1">
                  {availableMembers.length === 0 ? (
                    <p className="text-xs text-slate-400">No eligible members available to add.</p>
                  ) : (
                    availableMembers.map((member) => {
                      const selected = selectedParticipantIds.includes(member._id);
                      return (
                        <button
                          type="button"
                          key={member._id}
                          onClick={() => toggleParticipantPick(member._id)}
                          className={`w-full text-left text-xs rounded-lg border px-2.5 py-2 transition-colors ${
                            selected
                              ? 'border-cyan-400/80 bg-cyan-500/15 text-cyan-100'
                              : 'border-slate-700/90 text-slate-300 hover:border-slate-500'
                          }`}
                        >
                          <p className="font-medium">{member.name || 'Unnamed Member'}</p>
                          <p className="text-[11px] text-slate-400">
                            {member.role || 'Member'} {member.collegeId ? `• ${member.collegeId}` : ''}
                          </p>
                        </button>
                      );
                    })
                  )}
                </div>

                <button
                  type="button"
                  disabled={addingParticipants || selectedParticipantIds.length === 0}
                  onClick={handleAddParticipants}
                  className="btn btn-secondary !text-xs !px-3 !py-2 disabled:opacity-60"
                >
                  {addingParticipants ? <Loader2 size={12} className="animate-spin" /> : <UserPlus size={12} />}
                  Add {selectedParticipantIds.length > 0 ? `${selectedParticipantIds.length} ` : ''}Participant{selectedParticipantIds.length === 1 ? '' : 's'}
                </button>

                {selectedParticipantIds.length > 0 ? (
                  <p className="text-[11px] text-cyan-200 inline-flex items-center gap-1.5">
                    <Check size={11} /> {selectedParticipantIds.length} selected
                  </p>
                ) : null}

                {participantMessage ? (
                  <p className={`text-xs ${participantMessage.type === 'error' ? 'text-rose-200' : 'text-emerald-200'}`}>
                    {participantMessage.text}
                  </p>
                ) : null}
              </section>
            ) : null}

            <section className="border-t border-slate-800/80 p-5 md:p-6 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-1 gap-5">
              <div className="space-y-3">
                <p className="text-xs uppercase tracking-[0.16em] text-slate-400 font-semibold">Status Distribution</p>
                {statusEntries.length === 0 ? (
                  <p className="text-sm text-slate-500">No project statuses available yet.</p>
                ) : (
                  statusEntries.map(([status, count]) => (
                    <div key={status} className="flex items-center justify-between text-sm text-slate-300">
                      <span>{status}</span>
                      <span className="text-cyan-200 font-semibold">{count}</span>
                    </div>
                  ))
                )}
              </div>

              <div className="space-y-3">
                <p className="text-xs uppercase tracking-[0.16em] text-slate-400 font-semibold">Stage Distribution</p>
                {stageEntries.length === 0 ? (
                  <p className="text-sm text-slate-500">No stage data available yet.</p>
                ) : (
                  stageEntries.map(([stage, count]) => {
                    const width = projects.length ? Math.max(8, (count / projects.length) * 100) : 0;
                    return (
                      <div key={stage} className="space-y-1">
                        <div className="flex items-center justify-between text-xs text-slate-300">
                          <span>{stage}</span>
                          <span className="text-cyan-200 font-semibold">{count}</span>
                        </div>
                        <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                          <div className="h-full bg-gradient-to-r from-cyan-400 via-blue-400 to-indigo-400" style={{ width: `${width}%` }} />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </section>
          </aside>

          <section className="rounded-3xl border border-slate-800/85 bg-slate-950/65 backdrop-blur-md overflow-hidden">
            <div className="px-5 md:px-6 py-4 border-b border-slate-800/80 flex items-center justify-between gap-2">
              <div>
                <p className="text-xs uppercase tracking-[0.16em] text-slate-400 font-semibold">Project Tracks</p>
                <h3 className="text-lg text-white font-semibold mt-1">Delivery Pipeline</h3>
              </div>
              <span className="text-xs px-2.5 py-1 rounded-full border border-cyan-500/35 text-cyan-100 bg-cyan-500/10">
                {projects.length} project{projects.length === 1 ? '' : 's'}
              </span>
            </div>

            {projects.length === 0 ? (
              <p className="px-6 py-12 text-sm text-slate-500">No projects initialized for this event.</p>
            ) : (
              <div className="divide-y divide-slate-800/75">
                {projects.map((project, idx) => (
                  <motion.article
                    key={project._id || `${project.title}-${idx}`}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.04, duration: 0.32 }}
                    className="px-5 md:px-6 py-4 hover:bg-slate-900/35 transition-colors"
                  >
                    <div className="grid grid-cols-[4px_minmax(0,1fr)] gap-4">
                      <span className="rounded-full bg-gradient-to-b from-cyan-300 via-blue-400 to-indigo-500" />
                      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_130px_140px] gap-3 items-start">
                        <div>
                          <p className="text-base text-white font-semibold">{project.title}</p>
                          <p className="text-xs text-slate-400 mt-1">
                            {project.stage || 'Planning'} • {project.domain || 'Tech'}
                          </p>
                          <div className="mt-3 h-1.5 rounded-full bg-slate-800 overflow-hidden max-w-xl">
                            <div
                              className="h-full bg-gradient-to-r from-cyan-400 via-blue-400 to-indigo-400"
                              style={{ width: `${Math.max(0, Math.min(100, Number(project.progress || 0)))}%` }}
                            />
                          </div>
                        </div>
                        <div>
                          <p className="text-[11px] uppercase tracking-[0.12em] text-slate-500">Deadline</p>
                          <p className="text-sm text-slate-200 mt-1">{formatDate(project.deadline)}</p>
                        </div>
                        <div className="flex lg:flex-col items-start lg:items-end justify-between gap-2">
                          <span className={`text-xs px-2 py-1 rounded-full border ${projectStatusTone(project.status)}`}>
                            {project.status || 'Planning'}
                          </span>
                          <Link to={`/projects/${project._id}`} className="inline-flex items-center gap-1 text-xs text-cyan-200 hover:text-white">
                            Open <ArrowRight size={13} />
                          </Link>
                        </div>
                      </div>
                    </div>
                  </motion.article>
                ))}
              </div>
            )}
          </section>
        </section>
      </div>
    </div>
  );
}

function Metric({ label, value, tone = 'cyan' }) {
  const toneClass =
    tone === 'blue'
      ? 'border-blue-500/45 text-blue-100 bg-blue-500/10'
      : tone === 'emerald'
      ? 'border-emerald-500/45 text-emerald-100 bg-emerald-500/10'
      : tone === 'violet'
      ? 'border-violet-500/45 text-violet-100 bg-violet-500/10'
      : tone === 'amber'
      ? 'border-amber-500/45 text-amber-100 bg-amber-500/10'
      : 'border-cyan-500/45 text-cyan-100 bg-cyan-500/10';

  return (
    <article className={`rounded-xl border px-3 py-2.5 ${toneClass}`}>
      <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">{label}</p>
      <p className="text-base font-semibold mt-1">{value}</p>
    </article>
  );
}
