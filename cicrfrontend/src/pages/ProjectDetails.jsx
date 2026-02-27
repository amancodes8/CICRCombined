import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  CalendarDays,
  Loader2,
  MessageSquarePlus,
  Users,
  Activity,
  Flag,
  Percent,
  ShieldCheck,
  Trash2,
  UserPlus,
} from 'lucide-react';
import {
  addProjectUpdate,
  deleteProject,
  fetchDirectoryMembers,
  fetchProjectById,
  updateProjectProgress,
  updateProjectStatus,
  updateProjectTeam,
} from '../api';

const PROJECT_STAGES = ['Planning', 'Execution', 'Testing', 'Review', 'Deployment'];
const PROJECT_STATUSES = ['Planning', 'Active', 'On-Hold', 'Delayed', 'Awaiting Review', 'Completed', 'Archived', 'Ongoing'];
const UPDATE_TYPES = ['Comment', 'Blocker', 'Achievement', 'Status'];

const fmt = (value) => {
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
  if (normalized === 'completed') return 'border-emerald-500/40 text-emerald-200';
  if (normalized === 'awaiting review') return 'border-amber-500/40 text-amber-200';
  if (normalized === 'on-hold' || normalized === 'delayed') return 'border-rose-500/40 text-rose-200';
  return 'border-blue-500/40 text-blue-200';
};

export default function ProjectDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState([]);

  const [updateText, setUpdateText] = useState('');
  const [updateType, setUpdateType] = useState('Comment');
  const [savingUpdate, setSavingUpdate] = useState(false);

  const [progressValue, setProgressValue] = useState(0);
  const [stageValue, setStageValue] = useState('Planning');
  const [progressNote, setProgressNote] = useState('');
  const [savingProgress, setSavingProgress] = useState(false);

  const [statusValue, setStatusValue] = useState('Planning');
  const [statusNote, setStatusNote] = useState('');
  const [savingStatus, setSavingStatus] = useState(false);

  const [selectedMembers, setSelectedMembers] = useState([]);
  const [savingMembers, setSavingMembers] = useState(false);

  const profile = JSON.parse(localStorage.getItem('profile') || '{}');
  const user = profile.result || profile;
  const role = String(user.role || '').toLowerCase();
  const actorId = String(user._id || user.id || '');
  const isAdmin = role === 'admin';

  const loadProject = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await fetchProjectById(id);
      setProject(data);
      setProgressValue(Number(data?.progress || 0));
      setStageValue(String(data?.stage || 'Planning'));
      setStatusValue(String(data?.status || 'Planning'));
    } catch {
      setProject(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadProject();
  }, [loadProject]);

  useEffect(() => {
    fetchDirectoryMembers()
      .then((res) => setUsers(Array.isArray(res.data) ? res.data : []))
      .catch(() => setUsers([]));
  }, []);

  const leadId = String(project?.lead?._id || project?.lead || '');
  const teamIds = useMemo(
    () => (project?.team || []).map((member) => String(member?._id || member || '')),
    [project?.team]
  );

  const isLead = actorId && leadId === actorId;
  const canManage = isAdmin || isLead;

  const progressPercent = Math.max(0, Math.min(100, Number(project?.progress || 0)));

  const orderedUpdates = useMemo(
    () => [...(project?.updates || [])].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
    [project?.updates]
  );

  const orderedStatusHistory = useMemo(
    () => [...(project?.statusHistory || [])].sort((a, b) => new Date(b.changedAt) - new Date(a.changedAt)),
    [project?.statusHistory]
  );

  const memberOptions = useMemo(
    () =>
      users.filter((member) => {
        const memberId = String(member._id || '');
        return memberId && !teamIds.includes(memberId);
      }),
    [users, teamIds]
  );

  const submitUpdate = async (e) => {
    e.preventDefault();
    if (!canManage) return;
    const text = updateText.trim();
    if (!text) return;

    setSavingUpdate(true);
    try {
      const { data } = await addProjectUpdate(id, { text, type: updateType });
      setProject(data);
      setUpdateText('');
      setUpdateType('Comment');
      dispatchToast('Project update posted.', 'success');
    } catch (err) {
      dispatchToast(err.response?.data?.message || 'Failed to post update.', 'error');
    } finally {
      setSavingUpdate(false);
    }
  };

  const submitProgress = async (e) => {
    e.preventDefault();
    if (!canManage) return;

    setSavingProgress(true);
    try {
      const { data } = await updateProjectProgress(id, {
        progress: Number(progressValue),
        stage: stageValue,
        note: progressNote,
        type: 'Status',
      });
      setProject(data);
      setProgressValue(Number(data?.progress || 0));
      setStageValue(String(data?.stage || 'Planning'));
      setStatusValue(String(data?.status || 'Planning'));
      setProgressNote('');
      dispatchToast('Project progress updated.', 'success');
    } catch (err) {
      dispatchToast(err.response?.data?.message || 'Failed to update progress.', 'error');
    } finally {
      setSavingProgress(false);
    }
  };

  const submitStatus = async (e) => {
    e.preventDefault();
    if (!isAdmin) return;

    setSavingStatus(true);
    try {
      const { data } = await updateProjectStatus(id, { status: statusValue, note: statusNote });
      setProject(data);
      setStatusValue(String(data?.status || 'Planning'));
      setProgressValue(Number(data?.progress || 0));
      setStatusNote('');
      dispatchToast('Project status updated.', 'success');
    } catch (err) {
      dispatchToast(err.response?.data?.message || 'Failed to update status.', 'error');
    } finally {
      setSavingStatus(false);
    }
  };

  const submitMembers = async (e) => {
    e.preventDefault();
    if (!canManage || selectedMembers.length === 0) return;

    setSavingMembers(true);
    try {
      const { data } = await updateProjectTeam(id, { addMemberIds: selectedMembers });
      setProject(data);
      setSelectedMembers([]);
      dispatchToast('Team members added.', 'success');
    } catch (err) {
      dispatchToast(err.response?.data?.message || 'Failed to add members.', 'error');
    } finally {
      setSavingMembers(false);
    }
  };

  const handleDeleteProject = async () => {
    if (!isAdmin) return;
    if (!window.confirm('Delete this project permanently?')) return;

    try {
      await deleteProject(id);
      dispatchToast('Project deleted.', 'success');
      navigate('/projects');
    } catch (err) {
      dispatchToast(err.response?.data?.message || 'Failed to delete project.', 'error');
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
        <Link to="/projects" className="inline-flex items-center gap-2 text-gray-400 hover:text-white section-motion section-motion-delay-1">
          <ArrowLeft size={16} /> Back to projects
        </Link>
        <div className="border border-gray-800 rounded-3xl p-8 section-motion section-motion-delay-2">
          <p className="text-red-400 font-semibold">Project not found or not visible for your account.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12 page-motion-b pro-stagger">
      <Link to="/projects" className="inline-flex items-center gap-2 text-gray-400 hover:text-white section-motion section-motion-delay-1">
        <ArrowLeft size={16} /> Back to projects
      </Link>

      <section className="border border-gray-800 rounded-3xl p-6 md:p-8 space-y-5 section-motion section-motion-delay-2">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-xs uppercase tracking-widest text-cyan-300 font-black">
              {project.event?.title || 'Project Workspace'}
            </p>
            <h1 className="text-3xl font-black text-white mt-2">{project.title}</h1>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-[10px] uppercase tracking-widest border rounded-full px-3 py-1 ${statusTone(project.status)}`}>
              {project.status}
            </span>
            {isAdmin ? (
              <button
                type="button"
                onClick={handleDeleteProject}
                className="text-[10px] uppercase tracking-widest border border-rose-500/40 text-rose-200 rounded-full px-3 py-1 inline-flex items-center gap-1"
              >
                <Trash2 size={11} /> Delete
              </button>
            ) : null}
          </div>
        </div>

        <p className="text-gray-300 leading-relaxed">{project.description}</p>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="border border-gray-800 rounded-2xl p-4">
            <p className="text-[10px] uppercase tracking-widest text-gray-500 font-black">Progress</p>
            <div className="mt-2 h-2 rounded-full bg-gray-800 overflow-hidden">
              <div className="h-full bg-cyan-400 transition-all" style={{ width: `${progressPercent}%` }} />
            </div>
            <p className="text-sm text-cyan-100 mt-2">{progressPercent}% • {project.stage}</p>
          </div>

          <div className="border border-gray-800 rounded-2xl p-4">
            <p className="text-[10px] uppercase tracking-widest text-gray-500 font-black">Timeline</p>
            <p className="text-sm text-gray-200 mt-2">Start: {fmt(project.startTime)}</p>
            <p className="text-sm text-gray-200 mt-1">Deadline: {fmt(project.deadline)}</p>
          </div>

          <div className="border border-gray-800 rounded-2xl p-4">
            <p className="text-[10px] uppercase tracking-widest text-gray-500 font-black">Stakeholders</p>
            <p className="text-sm text-gray-200 mt-2">Lead: {project.lead?.name || 'N/A'}</p>
            <p className="text-sm text-gray-200 mt-1">Guide: {project.guide?.name || 'N/A'}</p>
            <p className="text-sm text-gray-200 mt-1">Team: {project.team?.length || 0} members</p>
          </div>
        </div>

        <div className="border border-gray-800 rounded-2xl p-4">
          <p className="text-[10px] uppercase tracking-widest text-gray-500 font-black">Required Components / Resources</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {(project.components || []).map((item, idx) => (
              <span key={`${item}-${idx}`} className="text-xs px-2.5 py-1 rounded-full border border-gray-700 text-gray-200">
                {item}
              </span>
            ))}
            {(project.components || []).length === 0 ? <span className="text-xs text-gray-500">No components listed.</span> : null}
          </div>
        </div>
      </section>

      <section className="border border-gray-800 rounded-3xl p-6 md:p-8 section-motion section-motion-delay-2 space-y-5">
        <h2 className="text-xl font-black text-white flex items-center gap-2">
          <Users size={18} className="text-indigo-300" /> Team Roster
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[project.lead, project.guide, ...(project.team || [])]
            .filter(Boolean)
            .reduce((acc, member) => {
              const idValue = String(member?._id || member || '');
              if (!idValue || acc.some((row) => String(row?._id || row || '') === idValue)) return acc;
              acc.push(member);
              return acc;
            }, [])
            .map((member) => (
              <Link
                key={member._id}
                to={`/profile/${member.collegeId || ''}`}
                className="border border-gray-800 rounded-xl p-4 hover:border-cyan-500/40 transition-colors"
              >
                <p className="text-white font-semibold">{member.name || 'Member'}</p>
                <p className="text-xs text-gray-400 mt-1">{member.role || 'User'} • {member.email || 'No email'}</p>
              </Link>
            ))}
        </div>

        {canManage ? (
          <form onSubmit={submitMembers} className="border border-gray-800 rounded-2xl p-4 space-y-3">
            <p className="text-xs uppercase tracking-widest text-gray-500 font-black inline-flex items-center gap-2">
              <UserPlus size={12} className="text-cyan-300" /> Add Members
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-40 overflow-y-auto">
              {memberOptions.map((member) => {
                const memberId = String(member._id || '');
                const selected = selectedMembers.includes(memberId);
                return (
                  <button
                    key={memberId}
                    type="button"
                    onClick={() =>
                      setSelectedMembers((prev) =>
                        selected ? prev.filter((idValue) => idValue !== memberId) : [...prev, memberId]
                      )
                    }
                    className={`text-left text-xs px-3 py-2 rounded-lg border ${
                      selected ? 'border-cyan-500/60 bg-cyan-500/10 text-cyan-100' : 'border-gray-800 text-gray-300'
                    }`}
                  >
                    {member.name}
                  </button>
                );
              })}
            </div>
            <button disabled={savingMembers || selectedMembers.length === 0} className="btn btn-secondary !w-auto !text-xs">
              {savingMembers ? <Loader2 size={14} className="animate-spin" /> : 'Add Selected Members'}
            </button>
          </form>
        ) : (
          <p className="text-xs text-gray-500">Team updates are restricted to assigned lead/admin accounts.</p>
        )}
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-2 gap-6 section-motion section-motion-delay-3">
        <div className="border border-gray-800 rounded-3xl p-6 space-y-4">
          <h2 className="text-xl font-black text-white flex items-center gap-2"><Percent size={18} className="text-cyan-300" /> Progress Control</h2>
          {canManage ? (
            <form onSubmit={submitProgress} className="space-y-3">
              <FormRow label="Progress %">
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={progressValue}
                  onChange={(e) => setProgressValue(e.target.value)}
                  className="ui-input"
                />
              </FormRow>
              <FormRow label="Stage">
                <select value={stageValue} onChange={(e) => setStageValue(e.target.value)} className="ui-input">
                  {PROJECT_STAGES.map((stage) => (
                    <option key={stage} value={stage}>
                      {stage}
                    </option>
                  ))}
                </select>
              </FormRow>
              <FormRow label="Progress Note (optional)">
                <textarea
                  rows={3}
                  value={progressNote}
                  onChange={(e) => setProgressNote(e.target.value)}
                  className="ui-input resize-none"
                  placeholder="Document blockers, achievements, or execution notes."
                />
              </FormRow>
              <button disabled={savingProgress} className="btn btn-primary !w-auto !text-xs">
                {savingProgress ? <Loader2 size={14} className="animate-spin" /> : 'Update Progress'}
              </button>
              <p className="text-[11px] text-gray-500">
                Reaching 100% progress moves project to <span className="text-amber-200">Awaiting Review</span>. Only admin can mark Completed.
              </p>
            </form>
          ) : (
            <p className="text-sm text-gray-400">Read-only for team members and guide role.</p>
          )}
        </div>

        <div className="border border-gray-800 rounded-3xl p-6 space-y-4">
          <h2 className="text-xl font-black text-white flex items-center gap-2"><ShieldCheck size={18} className="text-emerald-300" /> Admin Status Control</h2>
          {isAdmin ? (
            <form onSubmit={submitStatus} className="space-y-3">
              <FormRow label="Status">
                <select value={statusValue} onChange={(e) => setStatusValue(e.target.value)} className="ui-input">
                  {PROJECT_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </FormRow>
              <FormRow label="Status Note (optional)">
                <textarea
                  rows={3}
                  value={statusNote}
                  onChange={(e) => setStatusNote(e.target.value)}
                  className="ui-input resize-none"
                  placeholder="Reason for status transition"
                />
              </FormRow>
              <button disabled={savingStatus} className="btn btn-primary !w-auto !text-xs">
                {savingStatus ? <Loader2 size={14} className="animate-spin" /> : 'Update Status'}
              </button>
            </form>
          ) : (
            <p className="text-sm text-gray-400">Only administrators can close or globally move project status.</p>
          )}
        </div>
      </section>

      <section className="border border-gray-800 rounded-3xl p-6 md:p-8 space-y-4 section-motion section-motion-delay-3">
        <h2 className="text-xl font-black text-white flex items-center gap-2"><Activity size={18} className="text-cyan-300" /> Updates & Comments</h2>

        {canManage ? (
          <form onSubmit={submitUpdate} className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <select value={updateType} onChange={(e) => setUpdateType(e.target.value)} className="ui-input md:col-span-1">
                {UPDATE_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
              <textarea
                rows={3}
                value={updateText}
                onChange={(e) => setUpdateText(e.target.value)}
                placeholder="Document roadblocks, achievements, or action items."
                className="ui-input resize-none md:col-span-3"
              />
            </div>
            <button disabled={savingUpdate} className="btn btn-secondary !w-auto !text-xs inline-flex items-center gap-2">
              {savingUpdate ? <Loader2 size={14} className="animate-spin" /> : <MessageSquarePlus size={14} />}
              Publish Update
            </button>
          </form>
        ) : (
          <p className="text-sm text-gray-500">Update publishing is restricted to lead/admin accounts.</p>
        )}

        <div className="space-y-3">
          {orderedUpdates.length === 0 && <p className="text-sm text-gray-500">No updates yet.</p>}
          {orderedUpdates.map((row, idx) => (
            <div key={`${row.createdAt}-${idx}`} className="border border-gray-800 rounded-2xl p-4">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <span className="text-[10px] uppercase tracking-widest text-cyan-200 border border-cyan-500/35 rounded-full px-2 py-1">
                  {row.type}
                </span>
                <p className="text-xs text-gray-500">{row.createdBy?.name || 'Member'} • {fmt(row.createdAt)}</p>
              </div>
              <p className="text-gray-200 mt-2 text-sm">{row.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border border-gray-800 rounded-3xl p-6 md:p-8 section-motion section-motion-delay-3">
        <h2 className="text-xl font-black text-white flex items-center gap-2"><Flag size={18} className="text-amber-300" /> Status Timeline</h2>
        <div className="mt-4 space-y-3">
          {orderedStatusHistory.length === 0 ? <p className="text-sm text-gray-500">No status changes recorded yet.</p> : null}
          {orderedStatusHistory.map((row, idx) => (
            <div key={`${row.status}-${row.changedAt}-${idx}`} className="border border-gray-800 rounded-xl p-3">
              <p className="text-sm text-white font-semibold">{row.status}</p>
              <p className="text-xs text-gray-400 mt-1">{row.changedBy?.name || 'Admin'} • {fmt(row.changedAt)}</p>
              {row.note ? <p className="text-xs text-gray-300 mt-2">{row.note}</p> : null}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function FormRow({ label, children }) {
  return (
    <label className="block">
      <span className="text-[10px] uppercase tracking-widest text-gray-500 font-black">{label}</span>
      <div className="mt-1.5">{children}</div>
    </label>
  );
}
