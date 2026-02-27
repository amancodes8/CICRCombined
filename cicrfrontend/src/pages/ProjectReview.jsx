import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  BadgeCheck,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  Loader2,
  ShieldCheck,
  TriangleAlert,
} from 'lucide-react';
import { addProjectUpdate, fetchProjectById, updateProjectStatus } from '../api';

const REVIEW_STATUSES = ['Planning', 'Active', 'On-Hold', 'Delayed', 'Awaiting Review', 'Completed', 'Archived', 'Ongoing'];

const formatDateTime = (value) => {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return 'TBD';
  return d.toLocaleString();
};

const dispatchToast = (message, type = 'info') => {
  try {
    window.dispatchEvent(new CustomEvent('app:toast', { detail: { message, type } }));
  } catch {
    window.alert(message);
  }
};

const statusTone = (status) => {
  const normalized = String(status || '').toLowerCase();
  if (normalized === 'completed') return 'text-emerald-200 border-emerald-500/40 bg-emerald-500/10';
  if (normalized === 'awaiting review') return 'text-amber-200 border-amber-500/40 bg-amber-500/10';
  if (normalized === 'on-hold' || normalized === 'delayed') return 'text-rose-200 border-rose-500/40 bg-rose-500/10';
  return 'text-cyan-100 border-cyan-500/40 bg-cyan-500/10';
};

export default function ProjectReview() {
  const { id } = useParams();

  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);

  const [reviewStatus, setReviewStatus] = useState('Awaiting Review');
  const [reviewNote, setReviewNote] = useState('');
  const [savingVerdict, setSavingVerdict] = useState(false);

  const profile = JSON.parse(localStorage.getItem('profile') || '{}');
  const user = profile.result || profile;
  const role = String(user.role || '').toLowerCase();
  const isAdmin = role === 'admin';

  const loadProject = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await fetchProjectById(id);
      setProject(data);
      setReviewStatus(String(data?.status || 'Awaiting Review'));
    } catch {
      setProject(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadProject();
  }, [loadProject]);

  const blockers = useMemo(
    () => (project?.updates || []).filter((row) => String(row.type || '').toLowerCase() === 'blocker'),
    [project?.updates]
  );

  const readiness = useMemo(() => {
    if (!project) return 0;
    const checks = [
      Number(project.progress || 0) >= 100,
      Array.isArray(project.components) && project.components.length > 0,
      !!project.lead,
      !!project.guide,
      Array.isArray(project.team) && project.team.length > 0,
      blockers.length === 0,
    ];
    const passed = checks.filter(Boolean).length;
    return Math.round((passed / checks.length) * 100);
  }, [project, blockers.length]);

  const orderedHistory = useMemo(
    () => [...(project?.statusHistory || [])].sort((a, b) => new Date(b.changedAt) - new Date(a.changedAt)),
    [project?.statusHistory]
  );

  const submitVerdict = async (e) => {
    e.preventDefault();
    if (!isAdmin) return;

    setSavingVerdict(true);
    try {
      const { data } = await updateProjectStatus(id, {
        status: reviewStatus,
        note: reviewNote,
      });
      setProject(data);
      setReviewStatus(String(data?.status || reviewStatus));
      if (String(reviewStatus).toLowerCase() === 'completed') {
        dispatchToast('Project marked as completed.', 'success');
      } else {
        dispatchToast('Review verdict applied.', 'success');
      }
      setReviewNote('');
    } catch (err) {
      dispatchToast(err.response?.data?.message || 'Failed to apply review verdict.', 'error');
    } finally {
      setSavingVerdict(false);
    }
  };

  const postClarification = async () => {
    if (!isAdmin || !reviewNote.trim()) return;

    setSavingVerdict(true);
    try {
      const { data } = await addProjectUpdate(id, {
        type: 'Status',
        text: `Review note: ${reviewNote.trim()}`,
      });
      setProject(data);
      setReviewNote('');
      dispatchToast('Review note logged in operational feed.', 'success');
    } catch (err) {
      dispatchToast(err.response?.data?.message || 'Failed to add review note.', 'error');
    } finally {
      setSavingVerdict(false);
    }
  };

  if (loading) {
    return (
      <div className="h-[70vh] flex items-center justify-center">
        <Loader2 className="animate-spin text-blue-500" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="max-w-5xl mx-auto space-y-6 page-motion-b">
        <Link to="/projects" className="inline-flex items-center gap-2 text-gray-400 hover:text-white">
          <ArrowLeft size={16} /> Back to projects
        </Link>
        <div className="border border-gray-800 rounded-xl p-8">
          <p className="text-red-400 font-semibold">Project not found or not visible for your account.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="ui-page max-w-7xl space-y-6 pb-12 page-motion-c">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-800/70 pb-3">
        <Link to={`/projects/${id}`} className="inline-flex items-center gap-2 text-gray-400 hover:text-white text-sm">
          <ArrowLeft size={16} /> Back to management
        </Link>
        <span className={`text-xs border rounded-full px-3 py-1.5 ${statusTone(project.status)}`}>
          {project.status}
        </span>
      </header>

      <section className="space-y-3 border-b border-gray-800/70 pb-5">
        <p className="text-xs text-cyan-300 font-semibold">Project Review Desk</p>
        <h1 className="text-3xl font-semibold text-white leading-tight">{project.title}</h1>
        <p className="text-sm text-gray-300">{project.event?.title || 'Internal Project'} • Lead: {project.lead?.name || 'N/A'} • Guide: {project.guide?.name || 'N/A'}</p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
          <Metric icon={BadgeCheck} label="Readiness Score" value={`${readiness}%`} tone={readiness >= 80 ? 'ok' : readiness >= 60 ? 'warn' : 'danger'} />
          <Metric icon={ClipboardCheck} label="Progress" value={`${Math.round(Number(project.progress || 0))}%`} tone={Number(project.progress || 0) >= 100 ? 'ok' : 'warn'} />
          <Metric icon={TriangleAlert} label="Open Blockers" value={String(blockers.length)} tone={blockers.length === 0 ? 'ok' : 'danger'} />
        </div>
      </section>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px] gap-8">
        <section>
          <h2 className="text-lg font-semibold text-white inline-flex items-center gap-2">
            <Clock3 size={16} className="text-cyan-300" /> Review Timeline
          </h2>

          <div className="mt-4 border-y border-gray-800/70">
            {orderedHistory.length === 0 ? (
              <p className="text-sm text-gray-500 py-4">No review timeline available yet.</p>
            ) : (
              orderedHistory.map((row, idx) => (
                <article key={`${row.status}-${row.changedAt}-${idx}`} className="py-3 border-b border-gray-800/70 last:border-b-0">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <span className={`text-xs border rounded-full px-2.5 py-1 ${statusTone(row.status)}`}>
                      {row.status}
                    </span>
                    <p className="text-xs text-gray-500">{formatDateTime(row.changedAt)}</p>
                  </div>
                  <p className="text-sm text-gray-200 mt-2">{row.changedBy?.name || 'Admin'}</p>
                  {row.note ? <p className="text-sm text-gray-400 mt-1">{row.note}</p> : null}
                </article>
              ))
            )}
          </div>
        </section>

        <section className="xl:border-l xl:border-gray-800/70 xl:pl-5">
          <h2 className="text-lg font-semibold text-white inline-flex items-center gap-2">
            <ShieldCheck size={16} className="text-emerald-300" /> Verdict Panel
          </h2>
          {isAdmin ? (
            <form onSubmit={submitVerdict} className="mt-4 space-y-3">
              <label className="block">
                <span className="text-xs text-gray-400 font-semibold">Review Decision</span>
                <select value={reviewStatus} onChange={(e) => setReviewStatus(e.target.value)} className="ui-input mt-1.5">
                  {REVIEW_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="text-xs text-gray-400 font-semibold">Review Note</span>
                <textarea
                  rows={5}
                  value={reviewNote}
                  onChange={(e) => setReviewNote(e.target.value)}
                  className="ui-input mt-1.5 resize-none"
                  placeholder="Add quality review notes, pending concerns, and sign-off reason"
                />
              </label>

              <div className="flex flex-wrap gap-2">
                <button disabled={savingVerdict} className="btn btn-primary !text-xs !px-3 !py-2">
                  {savingVerdict ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                  Apply Verdict
                </button>
                <button
                  type="button"
                  onClick={postClarification}
                  disabled={savingVerdict || !reviewNote.trim()}
                  className="btn btn-secondary !text-xs !px-3 !py-2"
                >
                  Save Note To Feed
                </button>
              </div>

              <p className="text-xs text-gray-500">
                Final <span className="text-emerald-200">Completed</span> state is admin-controlled for quality assurance.
              </p>
            </form>
          ) : (
            <p className="mt-4 text-sm text-gray-400">Review verdict is restricted to administrators.</p>
          )}
        </section>
      </div>
    </div>
  );
}

function Metric({ icon: Icon, label, value, tone }) {
  const toneClass =
    tone === 'ok'
      ? 'border-emerald-500/40 text-emerald-200'
      : tone === 'warn'
      ? 'border-amber-500/45 text-amber-200'
      : 'border-rose-500/40 text-rose-200';

  return (
    <article className={`border-l-2 pl-3 ${toneClass}`}>
      <p className="text-xs font-semibold inline-flex items-center gap-1.5">
        <Icon size={12} /> {label}
      </p>
      <p className="text-2xl font-semibold mt-1">{value}</p>
    </article>
  );
}
