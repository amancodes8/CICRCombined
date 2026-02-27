import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  ClipboardList,
  Loader2,
  MessageSquarePlus,
  Percent,
  ShieldCheck,
  Trash2,
  UserPlus,
  Users,
} from 'lucide-react';
import {
  addProjectUpdate,
  deleteProject,
  fetchDirectoryMembers,
  fetchProjectById,
  updateProjectDetails,
  updateProjectProgress,
  updateProjectStatus,
  updateProjectTeam,
} from '../api';

const PROJECT_DOMAINS = ['Tech', 'Management', 'PR'];
const PROJECT_STAGES = ['Planning', 'Execution', 'Testing', 'Review', 'Deployment'];
const PROJECT_STATUSES = ['Planning', 'Active', 'On-Hold', 'Delayed', 'Awaiting Review', 'Completed', 'Archived', 'Ongoing'];
const UPDATE_TYPES = ['Comment', 'Blocker', 'Achievement', 'Status'];

const formatDateTime = (value) => {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return 'TBD';
  return d.toLocaleString();
};
const toDateTimeLocal = (value) => {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
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
  if (normalized === 'awaiting review') return 'text-amber-200 border-amber-500/45 bg-amber-500/10';
  if (normalized === 'on-hold' || normalized === 'delayed') return 'text-rose-200 border-rose-500/40 bg-rose-500/10';
  return 'text-cyan-100 border-cyan-500/40 bg-cyan-500/10';
};

const updateTone = (type) => {
  const normalized = String(type || '').toLowerCase();
  if (normalized === 'achievement') return 'text-emerald-200 border-emerald-500/40';
  if (normalized === 'blocker') return 'text-rose-200 border-rose-500/40';
  if (normalized === 'status') return 'text-amber-200 border-amber-500/40';
  return 'text-cyan-100 border-cyan-500/40';
};

export default function ProjectDetails() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [project, setProject] = useState(null);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  const [progressValue, setProgressValue] = useState(0);
  const [stageValue, setStageValue] = useState('Planning');
  const [progressNote, setProgressNote] = useState('');
  const [savingProgress, setSavingProgress] = useState(false);

  const [statusValue, setStatusValue] = useState('Planning');
  const [statusNote, setStatusNote] = useState('');
  const [savingStatus, setSavingStatus] = useState(false);

  const [selectedAddMembers, setSelectedAddMembers] = useState([]);
  const [selectedRemoveMembers, setSelectedRemoveMembers] = useState([]);
  const [savingMembers, setSavingMembers] = useState(false);

  const [updateType, setUpdateType] = useState('Comment');
  const [updateText, setUpdateText] = useState('');
  const [savingUpdate, setSavingUpdate] = useState(false);

  const [detailTitle, setDetailTitle] = useState('');
  const [detailDescription, setDetailDescription] = useState('');
  const [detailDomain, setDetailDomain] = useState('Tech');
  const [detailComponents, setDetailComponents] = useState('');
  const [detailStartTime, setDetailStartTime] = useState('');
  const [detailDeadline, setDetailDeadline] = useState('');
  const [detailGuide, setDetailGuide] = useState('');
  const [detailNote, setDetailNote] = useState('');
  const [savingDetails, setSavingDetails] = useState(false);

  const profile = JSON.parse(localStorage.getItem('profile') || '{}');
  const user = profile.result || profile;
  const role = String(user.role || '').toLowerCase();
  const actorId = String(user._id || user.id || '');
  const isAdmin = role === 'admin';

  const syncDetailForm = useCallback((data) => {
    setDetailTitle(String(data?.title || ''));
    setDetailDescription(String(data?.description || ''));
    setDetailDomain(String(data?.domain || 'Tech'));
    setDetailComponents(Array.isArray(data?.components) ? data.components.join(', ') : '');
    setDetailStartTime(toDateTimeLocal(data?.startTime));
    setDetailDeadline(toDateTimeLocal(data?.deadline));
    setDetailGuide(String(data?.guide?._id || data?.guide || ''));
  }, []);

  const loadProject = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await fetchProjectById(id);
      setProject(data);
      setProgressValue(Number(data?.progress || 0));
      setStageValue(String(data?.stage || 'Planning'));
      setStatusValue(String(data?.status || 'Planning'));
      syncDetailForm(data);
    } catch {
      setProject(null);
    } finally {
      setLoading(false);
    }
  }, [id, syncDetailForm]);

  useEffect(() => {
    loadProject();
  }, [loadProject]);

  useEffect(() => {
    fetchDirectoryMembers()
      .then((res) => setUsers(Array.isArray(res.data) ? res.data : []))
      .catch(() => setUsers([]));
  }, []);

  const leadId = String(project?.lead?._id || project?.lead || '');
  const isLead = actorId && leadId === actorId;
  const canManage = isAdmin || isLead;

  const teamIds = useMemo(
    () => (project?.team || []).map((member) => String(member?._id || member || '')),
    [project?.team]
  );

  const memberOptions = useMemo(
    () =>
      users.filter((member) => {
        const memberId = String(member._id || '');
        return memberId && !teamIds.includes(memberId);
      }),
    [users, teamIds]
  );
  const removableTeamMembers = useMemo(
    () =>
      (project?.team || []).filter((member) => {
        const memberId = String(member?._id || member || '');
        return memberId && memberId !== leadId;
      }),
    [project?.team, leadId]
  );

  const progressPercent = Math.max(0, Math.min(100, Number(project?.progress || 0)));

  const orderedUpdates = useMemo(
    () => [...(project?.updates || [])].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
    [project?.updates]
  );

  const orderedStatusHistory = useMemo(
    () => [...(project?.statusHistory || [])].sort((a, b) => new Date(b.changedAt) - new Date(a.changedAt)),
    [project?.statusHistory]
  );

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
      dispatchToast('Progress updated.', 'success');
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
      dispatchToast('Status updated.', 'success');
    } catch (err) {
      dispatchToast(err.response?.data?.message || 'Failed to update status.', 'error');
    } finally {
      setSavingStatus(false);
    }
  };

  const submitMembers = async (e) => {
    e.preventDefault();
    if (!canManage || (selectedAddMembers.length === 0 && selectedRemoveMembers.length === 0)) return;

    setSavingMembers(true);
    try {
      const { data } = await updateProjectTeam(id, {
        addMemberIds: selectedAddMembers,
        removeMemberIds: selectedRemoveMembers,
      });
      setProject(data);
      setSelectedAddMembers([]);
      setSelectedRemoveMembers([]);
      dispatchToast('Team details updated.', 'success');
    } catch (err) {
      dispatchToast(err.response?.data?.message || 'Failed to update team.', 'error');
    } finally {
      setSavingMembers(false);
    }
  };

  const submitDetails = async (e) => {
    e.preventDefault();
    if (!canManage) return;

    const parsedComponents = String(detailComponents || '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);

    if (parsedComponents.length === 0) {
      dispatchToast('At least one component/resource is required.', 'error');
      return;
    }
    if (!String(detailGuide || '').trim()) {
      dispatchToast('Select a guide to continue.', 'error');
      return;
    }

    setSavingDetails(true);
    try {
      const payload = {
        title: detailTitle,
        description: detailDescription,
        domain: detailDomain,
        components: parsedComponents,
        startTime: detailStartTime,
        deadline: detailDeadline,
        guide: detailGuide,
        note: detailNote,
      };

      const { data } = await updateProjectDetails(id, payload);
      setProject(data);
      syncDetailForm(data);
      setDetailNote('');
      dispatchToast('Project details updated.', 'success');
    } catch (err) {
      dispatchToast(err.response?.data?.message || 'Failed to update project details.', 'error');
    } finally {
      setSavingDetails(false);
    }
  };

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
      dispatchToast('Operational update posted.', 'success');
    } catch (err) {
      dispatchToast(err.response?.data?.message || 'Failed to post update.', 'error');
    } finally {
      setSavingUpdate(false);
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
        <Link to="/projects" className="inline-flex items-center gap-2 text-gray-400 hover:text-white">
          <ArrowLeft size={16} /> Back to projects
        </Link>
        <div className="border border-gray-800 p-8">
          <p className="text-red-400 font-semibold">Project not found or not visible for your account.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="ui-page max-w-7xl space-y-6 pb-12 page-motion-d">
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="border-b border-gray-800/70 pb-4"
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <Link to="/projects" className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white">
              <ArrowLeft size={13} /> Back to projects
            </Link>
            <p className="text-xs text-cyan-300 font-semibold">{project.event?.title || 'Project Workspace'}</p>
            <h1 className="text-3xl md:text-4xl font-semibold text-white leading-tight">{project.title}</h1>
            <p className="text-sm text-gray-300 max-w-3xl">{project.description}</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-xs px-2.5 py-1.5 rounded-full border ${statusTone(project.status)}`}>
              {project.status}
            </span>
            <Link to={`/projects/${id}/review`} className="btn btn-secondary !text-xs !px-3 !py-2">
              <ShieldCheck size={13} /> Review Desk
            </Link>
            {isAdmin ? (
              <button
                type="button"
                onClick={handleDeleteProject}
                className="btn btn-secondary !text-xs !px-3 !py-2 !text-rose-200 !border-rose-500/40"
              >
                <Trash2 size={13} /> Delete
              </button>
            ) : null}
          </div>
        </div>
      </motion.section>

      <div className="grid grid-cols-1 xl:grid-cols-[320px_minmax(0,1fr)] gap-8">
        <aside className="space-y-5 xl:sticky xl:top-24 h-fit xl:border-r xl:border-gray-800/70 xl:pr-5">
          <div>
            <p className="text-xs text-gray-400 font-semibold">Delivery Pulse</p>
            <p className="text-sm text-gray-400 mt-2">Stage alignment and timeline posture for this workspace.</p>
          </div>

          <div>
            <div className="flex items-center justify-between text-xs text-gray-400">
              <span>Progress</span>
              <span className="text-cyan-100 font-semibold">{progressPercent}%</span>
            </div>
            <div className="mt-2 h-2 rounded-full bg-gray-800 overflow-hidden">
              <div className="h-full bg-gradient-to-r from-cyan-400 to-blue-400" style={{ width: `${progressPercent}%` }} />
            </div>
            <p className="text-xs text-gray-400 mt-2">Stage: <span className="text-gray-100">{project.stage}</span></p>
          </div>

          <div className="space-y-2 text-sm text-gray-300 border-y border-gray-800/70 py-3">
            <p>Lead: <span className="text-white">{project.lead?.name || 'N/A'}</span></p>
            <p>Guide: <span className="text-white">{project.guide?.name || 'N/A'}</span></p>
            <p>Team: <span className="text-white">{project.team?.length || 0}</span></p>
            <p>Start: <span className="text-white">{formatDateTime(project.startTime)}</span></p>
            <p>Deadline: <span className="text-white">{formatDateTime(project.deadline)}</span></p>
            <p>Last Edited By: <span className="text-white">{project.lastEditedBy?.name || 'Not tracked yet'}</span></p>
            <p>Last Edited At: <span className="text-white">{project.lastEditedAt ? formatDateTime(project.lastEditedAt) : 'N/A'}</span></p>
            <p>Last Action: <span className="text-white">{project.lastEditedAction || 'Initialized'}</span></p>
          </div>

          <div>
            <p className="text-xs text-gray-400 font-semibold">Components</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {(project.components || []).map((component, idx) => (
                <span key={`${component}-${idx}`} className="text-xs px-2.5 py-1 rounded-full border border-blue-500/25 bg-blue-500/10 text-blue-100">
                  {component}
                </span>
              ))}
            </div>
          </div>
        </aside>

        <main className="overflow-hidden border-y border-gray-800/70">
          <section className="p-6 md:p-7 border-b border-gray-800/70">
            <div className="flex items-center gap-2 mb-4">
              <ClipboardList size={16} className="text-cyan-300" />
              <h2 className="text-lg font-semibold text-white">Management Console</h2>
            </div>

            <div className="grid grid-cols-1 2xl:grid-cols-2 gap-6">
              <form onSubmit={submitProgress} className="space-y-3">
                <p className="text-xs text-gray-400 font-semibold">Progress & Stage</p>
                {canManage ? (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={progressValue}
                        onChange={(e) => setProgressValue(e.target.value)}
                        className="ui-input"
                        placeholder="Progress %"
                      />
                      <select value={stageValue} onChange={(e) => setStageValue(e.target.value)} className="ui-input">
                        {PROJECT_STAGES.map((stage) => (
                          <option key={stage} value={stage}>
                            {stage}
                          </option>
                        ))}
                      </select>
                    </div>
                    <textarea
                      rows={3}
                      value={progressNote}
                      onChange={(e) => setProgressNote(e.target.value)}
                      className="ui-input resize-none"
                      placeholder="Execution note (blocker, milestone, dependency)"
                    />
                    <button disabled={savingProgress} className="btn btn-primary !w-auto !text-xs">
                      {savingProgress ? <Loader2 size={14} className="animate-spin" /> : <Percent size={14} />}
                      Update Progress
                    </button>
                    <p className="text-xs text-gray-500">
                      At 100%, system moves to <span className="text-amber-200">Awaiting Review</span>. Final completion is admin-only.
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-gray-500">Read-only. Lead/Admin can update progress.</p>
                )}
              </form>

              <form onSubmit={submitMembers} className="space-y-3">
                <p className="text-xs text-gray-400 font-semibold">Team Growth</p>
                {canManage ? (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <p className="text-xs text-gray-500 font-semibold mb-2">Add Members</p>
                        <div className="grid grid-cols-1 gap-2 max-h-36 overflow-y-auto pr-1">
                          {memberOptions.map((member) => {
                            const memberId = String(member._id || '');
                            const selected = selectedAddMembers.includes(memberId);
                            return (
                              <button
                                key={`add-${memberId}`}
                                type="button"
                                onClick={() =>
                                  setSelectedAddMembers((prev) =>
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
                          {memberOptions.length === 0 ? <p className="text-xs text-gray-500">No eligible members to add.</p> : null}
                        </div>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 font-semibold mb-2">Remove Members</p>
                        <div className="grid grid-cols-1 gap-2 max-h-36 overflow-y-auto pr-1">
                          {removableTeamMembers.map((member) => {
                            const memberId = String(member?._id || member || '');
                            const selected = selectedRemoveMembers.includes(memberId);
                            return (
                              <button
                                key={`remove-${memberId}`}
                                type="button"
                                onClick={() =>
                                  setSelectedRemoveMembers((prev) =>
                                    selected ? prev.filter((idValue) => idValue !== memberId) : [...prev, memberId]
                                  )
                                }
                                className={`text-left text-xs px-3 py-2 rounded-lg border ${
                                  selected ? 'border-rose-500/60 bg-rose-500/10 text-rose-100' : 'border-gray-800 text-gray-300'
                                }`}
                              >
                                {member.name}
                              </button>
                            );
                          })}
                          {removableTeamMembers.length === 0 ? <p className="text-xs text-gray-500">No removable members.</p> : null}
                        </div>
                      </div>
                    </div>
                    <button
                      disabled={savingMembers || (selectedAddMembers.length === 0 && selectedRemoveMembers.length === 0)}
                      className="btn btn-secondary !w-auto !text-xs"
                    >
                      {savingMembers ? <Loader2 size={14} className="animate-spin" /> : <UserPlus size={14} />}
                      Save Team Changes
                    </button>
                  </>
                ) : (
                  <p className="text-sm text-gray-500">Read-only. Lead/Admin can add members.</p>
                )}
              </form>
            </div>

            <form onSubmit={submitDetails} className="mt-6 pt-5 border-t border-gray-800 space-y-3">
              <p className="text-xs text-gray-400 font-semibold">Project Configuration</p>
              {canManage ? (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <input
                      value={detailTitle}
                      onChange={(e) => setDetailTitle(e.target.value)}
                      className="ui-input"
                      placeholder="Project title"
                    />
                    <select value={detailDomain} onChange={(e) => setDetailDomain(e.target.value)} className="ui-input">
                      {PROJECT_DOMAINS.map((domain) => (
                        <option key={domain} value={domain}>
                          {domain}
                        </option>
                      ))}
                    </select>
                    <textarea
                      rows={4}
                      value={detailDescription}
                      onChange={(e) => setDetailDescription(e.target.value)}
                      className="ui-input resize-none md:col-span-2"
                      placeholder="Detailed project description"
                    />
                    <input
                      value={detailComponents}
                      onChange={(e) => setDetailComponents(e.target.value)}
                      className="ui-input md:col-span-2"
                      placeholder="Components/resources (comma separated)"
                    />
                    <input
                      type="datetime-local"
                      value={detailStartTime}
                      onChange={(e) => setDetailStartTime(e.target.value)}
                      className="ui-input [color-scheme:dark]"
                    />
                    <input
                      type="datetime-local"
                      value={detailDeadline}
                      onChange={(e) => setDetailDeadline(e.target.value)}
                      className="ui-input [color-scheme:dark]"
                    />
                    <select value={detailGuide} onChange={(e) => setDetailGuide(e.target.value)} className="ui-input md:col-span-2">
                      <option value="">Select guide</option>
                      {users.map((member) => (
                        <option key={member._id} value={member._id}>
                          {member.name} ({member.role})
                        </option>
                      ))}
                    </select>
                    <textarea
                      rows={2}
                      value={detailNote}
                      onChange={(e) => setDetailNote(e.target.value)}
                      className="ui-input resize-none md:col-span-2"
                      placeholder="Optional note for this detail change"
                    />
                  </div>
                  <button disabled={savingDetails} className="btn btn-primary !w-auto !text-xs">
                    {savingDetails ? <Loader2 size={14} className="animate-spin" /> : <ClipboardList size={14} />}
                    Save Project Details
                  </button>
                </>
              ) : (
                <p className="text-sm text-gray-500">Read-only. Lead/Admin can edit project configuration.</p>
              )}
            </form>
          </section>

          <section className="p-6 md:p-7 border-b border-gray-800/70">
            <div className="flex items-center gap-2 mb-4">
              <ShieldCheck size={16} className="text-emerald-300" />
              <h2 className="text-lg font-semibold text-white">Governance & Status Ledger</h2>
            </div>

            <div className="grid grid-cols-1 2xl:grid-cols-[360px_minmax(0,1fr)] gap-6">
              <form onSubmit={submitStatus} className="space-y-3">
                <p className="text-xs text-gray-400 font-semibold">Admin Status Control</p>
                {isAdmin ? (
                  <>
                    <select value={statusValue} onChange={(e) => setStatusValue(e.target.value)} className="ui-input">
                      {PROJECT_STATUSES.map((status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </select>
                    <textarea
                      rows={3}
                      value={statusNote}
                      onChange={(e) => setStatusNote(e.target.value)}
                      className="ui-input resize-none"
                      placeholder="Reason for status transition"
                    />
                    <button disabled={savingStatus} className="btn btn-primary !w-auto !text-xs">
                      {savingStatus ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} />}
                      Apply Status
                    </button>
                  </>
                ) : (
                  <p className="text-sm text-gray-500">Only admin can apply global status and final completion.</p>
                )}
              </form>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-gray-500 border-b border-gray-800">
                      <th className="py-2 pr-4">Status</th>
                      <th className="py-2 pr-4">Changed By</th>
                      <th className="py-2 pr-4">When</th>
                      <th className="py-2">Note</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orderedStatusHistory.map((row, idx) => (
                      <tr key={`${row.status}-${row.changedAt}-${idx}`} className="border-b border-gray-800/70 align-top">
                        <td className="py-2 pr-4 text-gray-100 font-semibold">{row.status}</td>
                        <td className="py-2 pr-4 text-gray-300">{row.changedBy?.name || 'Admin'}</td>
                        <td className="py-2 pr-4 text-gray-400 whitespace-nowrap">{formatDateTime(row.changedAt)}</td>
                        <td className="py-2 text-gray-300">{row.note || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          <section className="p-6 md:p-7">
            <div className="flex items-center gap-2 mb-4">
              <Users size={16} className="text-cyan-300" />
              <h2 className="text-lg font-semibold text-white">Operational Feed</h2>
            </div>

            {canManage ? (
              <form onSubmit={submitUpdate} className="grid grid-cols-1 md:grid-cols-[180px_minmax(0,1fr)_auto] gap-3 mb-5">
                <select value={updateType} onChange={(e) => setUpdateType(e.target.value)} className="ui-input">
                  {UPDATE_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
                <textarea
                  rows={2}
                  value={updateText}
                  onChange={(e) => setUpdateText(e.target.value)}
                  placeholder="Add update, blocker, or milestone details"
                  className="ui-input resize-none"
                />
                <button disabled={savingUpdate} className="btn btn-secondary !text-xs !px-3 !py-2 h-fit">
                  {savingUpdate ? <Loader2 size={14} className="animate-spin" /> : <MessageSquarePlus size={14} />}
                  Publish
                </button>
              </form>
            ) : null}

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-500 border-b border-gray-800">
                    <th className="py-2 pr-3">Type</th>
                    <th className="py-2 pr-3">Message</th>
                    <th className="py-2 pr-3">Actor</th>
                    <th className="py-2">Timestamp</th>
                  </tr>
                </thead>
                <tbody>
                  {orderedUpdates.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-5 text-center text-sm text-gray-500">
                        No operational updates yet.
                      </td>
                    </tr>
                  ) : (
                    orderedUpdates.map((row, idx) => (
                      <tr key={`${row.createdAt}-${idx}`} className="border-b border-gray-800/60 align-top">
                        <td className="py-2 pr-3">
                          <span className={`text-xs border rounded-full px-2 py-1 ${updateTone(row.type)}`}>
                            {row.type}
                          </span>
                        </td>
                        <td className="py-2 pr-3 text-gray-200 max-w-[540px]">{row.text}</td>
                        <td className="py-2 pr-3 text-gray-400 whitespace-nowrap">{row.createdBy?.name || 'Member'}</td>
                        <td className="py-2 text-gray-500 whitespace-nowrap">{formatDateTime(row.createdAt)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
