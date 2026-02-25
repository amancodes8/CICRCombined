import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  CheckCircle2,
  Clock3,
  FolderKanban,
  Loader2,
  Plus,
  ShieldCheck,
  Trash2,
  Users,
} from 'lucide-react';
import {
  createHierarchyTask,
  deleteHierarchyTask,
  fetchDirectoryMembers,
  fetchHierarchyTasks,
  updateHierarchyTask,
} from '../api';
import PageHeader from '../components/PageHeader';

const TASK_CATEGORIES = ['Project', 'Meeting', 'Learning', 'Operations'];
const TASK_PRIORITIES = ['Low', 'Medium', 'High'];
const TASK_STATUSES = ['Open', 'InProgress', 'Blocked', 'Completed'];

const dispatchToast = (message, type = 'info') => {
  try {
    window.dispatchEvent(new CustomEvent('app:toast', { detail: { message, type } }));
  } catch {
    window.alert(message);
  }
};

const prettyStatus = (value) => (value === 'InProgress' ? 'In Progress' : value || 'Open');
const fmtDate = (value) => {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return 'No due date';
  return d.toLocaleDateString();
};

export default function Hierarchy() {
  const profile = JSON.parse(localStorage.getItem('profile') || '{}');
  const user = profile.result || profile;
  const role = String(user.role || '').toLowerCase();
  const year = Number(user.year);
  const isAdminOrHead = role === 'admin' || role === 'head';
  const canAssign = isAdminOrHead || (Number.isFinite(year) && year >= 2);

  const [members, setMembers] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [scope, setScope] = useState(isAdminOrHead ? 'all' : 'assigned');
  const [statusFilter, setStatusFilter] = useState('All');
  const [form, setForm] = useState({
    title: '',
    description: '',
    category: 'Project',
    priority: 'Medium',
    assignedTo: '',
    dueDate: '',
  });

  const loadData = async (nextScope = scope) => {
    setLoading(true);
    try {
      const [membersRes, tasksRes] = await Promise.all([
        fetchDirectoryMembers().catch(() => ({ data: [] })),
        fetchHierarchyTasks(nextScope === 'all' ? {} : { scope: nextScope }).catch(() => ({ data: [] })),
      ]);
      setMembers(Array.isArray(membersRes.data) ? membersRes.data : []);
      setTasks(Array.isArray(tasksRes.data) ? tasksRes.data : []);
    } catch (err) {
      dispatchToast(err.response?.data?.message || 'Failed to load hierarchy data.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData(scope);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const eligibleMembers = useMemo(() => {
    if (isAdminOrHead) return members;
    return members.filter((m) => {
      const mYear = Number(m.year);
      if (!Number.isFinite(mYear)) return false;
      return Number.isFinite(year) && mYear <= year;
    });
  }, [isAdminOrHead, members, year]);

  useEffect(() => {
    if (!form.assignedTo) return;
    const exists = eligibleMembers.some((member) => String(member._id) === String(form.assignedTo));
    if (!exists) {
      setForm((prev) => ({ ...prev, assignedTo: '' }));
    }
  }, [eligibleMembers, form.assignedTo]);

  const visibleTasks = useMemo(() => {
    const list = statusFilter === 'All' ? tasks : tasks.filter((task) => task.status === statusFilter);
    return list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }, [statusFilter, tasks]);

  const myCreated = useMemo(
    () => tasks.filter((task) => String(task.assignedBy?._id || task.assignedBy) === String(user._id)),
    [tasks, user._id]
  );
  const assignedToMe = useMemo(
    () => tasks.filter((task) => String(task.assignedTo?._id || task.assignedTo) === String(user._id)),
    [tasks, user._id]
  );

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!canAssign) {
      dispatchToast('Only seniors (2nd year+) or Admin/Head can assign tasks.', 'error');
      return;
    }
    if (!form.assignedTo) {
      dispatchToast('Please select an assignee.', 'error');
      return;
    }
    setBusy(true);
    try {
      await createHierarchyTask({
        ...form,
        dueDate: form.dueDate || null,
      });
      setForm({
        title: '',
        description: '',
        category: 'Project',
        priority: 'Medium',
        assignedTo: '',
        dueDate: '',
      });
      await loadData(scope);
      dispatchToast('Hierarchy task assigned.', 'success');
    } catch (err) {
      dispatchToast(err.response?.data?.message || 'Unable to assign task.', 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleStatusChange = async (task, status) => {
    const note = window.prompt('Add update note (optional):', '');
    if (note === null) return;
    try {
      await updateHierarchyTask(task._id, { status, note });
      await loadData(scope);
      dispatchToast(`Task moved to ${prettyStatus(status)}.`, 'success');
    } catch (err) {
      dispatchToast(err.response?.data?.message || 'Unable to update task.', 'error');
    }
  };

  const handleDelete = async (task) => {
    if (!window.confirm(`Delete task "${task.title}"?`)) return;
    try {
      await deleteHierarchyTask(task._id);
      setTasks((prev) => prev.filter((row) => row._id !== task._id));
      dispatchToast('Task removed.', 'success');
    } catch (err) {
      dispatchToast(err.response?.data?.message || 'Unable to delete task.', 'error');
    }
  };

  return (
    <div className="ui-page pb-16 space-y-8 page-motion-b">
      <header className="section-motion section-motion-delay-1">
        <PageHeader
          eyebrow="Team Operations"
          title="Mentorship Task Management"
          subtitle="Assign, track, and review responsibilities across meetings, projects, and onboarding workflows."
          icon={Users}
          actions={
            <div className="grid grid-cols-2 gap-3 w-full lg:w-auto">
              <Stat label="Assigned By Me" value={myCreated.length} />
              <Stat label="Assigned To Me" value={assignedToMe.length} />
            </div>
          }
        />
      </header>

      {!canAssign && (
        <div className="border border-amber-500/30 rounded-2xl px-4 py-3 text-sm text-amber-200 section-motion section-motion-delay-1">
          You can view assigned tasks, but creating tasks is limited to seniors (2nd year+) and Admin/Head.
        </div>
      )}

      <section className="grid grid-cols-1 xl:grid-cols-12 gap-6 section-motion section-motion-delay-2">
        <article className="xl:col-span-4 border border-gray-800 rounded-[1.8rem] p-5 md:p-6 space-y-4">
          <h2 className="text-sm font-black uppercase tracking-[0.2em] text-gray-200 inline-flex items-center gap-2">
            <Plus size={14} className="text-blue-400" /> Assign Task
          </h2>

          <form onSubmit={handleCreate} className="space-y-3">
            <input
              value={form.title}
              onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
              placeholder="Task title"
              className="w-full border border-gray-800 rounded-xl px-3 py-2.5 bg-[#0b0e13]/65 text-sm text-white outline-none focus:border-blue-500"
              required
              minLength={4}
            />
            <textarea
              value={form.description}
              onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
              placeholder="Expected outcome and context"
              rows={4}
              className="w-full border border-gray-800 rounded-xl px-3 py-2.5 bg-[#0b0e13]/65 text-sm text-white outline-none focus:border-blue-500 resize-none"
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <select
                value={form.category}
                onChange={(e) => setForm((prev) => ({ ...prev, category: e.target.value }))}
                className="border border-gray-800 rounded-xl px-3 py-2.5 bg-[#0b0e13]/65 text-sm text-white outline-none focus:border-blue-500"
              >
                {TASK_CATEGORIES.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
              <select
                value={form.priority}
                onChange={(e) => setForm((prev) => ({ ...prev, priority: e.target.value }))}
                className="border border-gray-800 rounded-xl px-3 py-2.5 bg-[#0b0e13]/65 text-sm text-white outline-none focus:border-blue-500"
              >
                {TASK_PRIORITIES.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>
            <select
              value={form.assignedTo}
              onChange={(e) => setForm((prev) => ({ ...prev, assignedTo: e.target.value }))}
              className="w-full border border-gray-800 rounded-xl px-3 py-2.5 bg-[#0b0e13]/65 text-sm text-white outline-none focus:border-blue-500"
            >
              <option value="">Select assignee</option>
              {eligibleMembers.map((member) => (
                <option key={member._id} value={member._id}>
                  {member.name} ({member.year ? `Year ${member.year}` : member.role})
                </option>
              ))}
            </select>
            <input
              type="date"
              value={form.dueDate}
              onChange={(e) => setForm((prev) => ({ ...prev, dueDate: e.target.value }))}
              className="w-full border border-gray-800 rounded-xl px-3 py-2.5 bg-[#0b0e13]/65 text-sm text-white outline-none focus:border-blue-500"
            />

            <button
              type="submit"
              disabled={busy || !canAssign}
              className="w-full inline-flex items-center justify-center gap-2 border border-blue-500/40 text-blue-100 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-blue-500/10 disabled:opacity-60"
            >
              {busy ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              Create Task
            </button>
          </form>
        </article>

        <article className="xl:col-span-8 border border-gray-800 rounded-[1.8rem] p-5 md:p-6 space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
            <h2 className="text-sm font-black uppercase tracking-[0.2em] text-gray-200 inline-flex items-center gap-2">
              <Users size={14} className="text-cyan-300" /> Active Task Board
            </h2>
            <div className="flex flex-wrap gap-2">
              <select
                value={scope}
                onChange={(e) => {
                  const nextScope = e.target.value;
                  setScope(nextScope);
                  loadData(nextScope);
                }}
                className="border border-gray-800 rounded-xl px-3 py-2 bg-[#0b0e13]/65 text-xs text-gray-300"
              >
                <option value="assigned">Assigned To Me</option>
                <option value="created">Assigned By Me</option>
                {isAdminOrHead && <option value="all">All Tasks</option>}
              </select>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="border border-gray-800 rounded-xl px-3 py-2 bg-[#0b0e13]/65 text-xs text-gray-300"
              >
                <option value="All">All Statuses</option>
                {TASK_STATUSES.map((item) => (
                  <option key={item} value={item}>
                    {prettyStatus(item)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {loading ? (
            <div className="h-44 flex items-center justify-center text-gray-500">
              <Loader2 size={20} className="animate-spin mr-2" /> Loading tasks...
            </div>
          ) : (
            <div className="space-y-3">
              {visibleTasks.map((task) => {
                const isOwner = String(task.assignedBy?._id || task.assignedBy) === String(user._id);
                const canDelete = isOwner || isAdminOrHead;
                const latestNote = task.updates?.[0];
                return (
                  <motion.article
                    key={task._id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="border border-gray-800 rounded-xl p-4"
                  >
                    <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                      <div>
                        <h3 className="text-base font-bold text-white">{task.title}</h3>
                        <p className="text-xs text-gray-500 mt-1">
                          {task.category} • {task.priority} • Due {fmtDate(task.dueDate)}
                        </p>
                      </div>
                      <span className="text-[10px] uppercase tracking-widest border border-gray-700 rounded-lg px-2 py-1 text-gray-300 self-start">
                        {prettyStatus(task.status)}
                      </span>
                    </div>

                    {task.description ? (
                      <p className="mt-3 text-sm text-gray-300 leading-relaxed">{task.description}</p>
                    ) : null}

                    <div className="mt-3 text-[11px] text-gray-400 grid grid-cols-1 md:grid-cols-2 gap-2">
                      <p className="inline-flex items-center gap-1.5">
                        <ShieldCheck size={12} className="text-blue-400" />
                        Assigned by {task.assignedBy?.name || 'Unknown'}
                      </p>
                      <p className="inline-flex items-center gap-1.5">
                        <FolderKanban size={12} className="text-cyan-300" />
                        Assigned to {task.assignedTo?.name || 'Unknown'}
                      </p>
                    </div>

                    {latestNote?.note ? (
                      <p className="mt-3 text-xs text-amber-100 border border-amber-500/25 rounded-lg px-2.5 py-1.5">
                        Latest update: {latestNote.note}
                      </p>
                    ) : null}

                    <div className="mt-3 pt-3 border-t border-gray-800 flex flex-wrap gap-2">
                      {TASK_STATUSES.map((status) => (
                        <button
                          key={status}
                          type="button"
                          onClick={() => handleStatusChange(task, status)}
                          className={`text-[10px] px-2.5 py-1.5 rounded-lg border uppercase tracking-widest ${
                            task.status === status
                              ? 'border-blue-500/45 text-blue-200'
                              : 'border-gray-700 text-gray-400 hover:text-gray-200'
                          }`}
                        >
                          {status === 'Completed' ? <CheckCircle2 size={11} className="inline mr-1" /> : null}
                          {prettyStatus(status)}
                        </button>
                      ))}
                      {canDelete ? (
                        <button
                          type="button"
                          onClick={() => handleDelete(task)}
                          className="text-[10px] px-2.5 py-1.5 rounded-lg border border-rose-500/30 text-rose-200 uppercase tracking-widest inline-flex items-center gap-1"
                        >
                          <Trash2 size={11} />
                          Delete
                        </button>
                      ) : null}
                    </div>
                  </motion.article>
                );
              })}
              {visibleTasks.length === 0 && (
                <div className="text-center py-14 border border-dashed border-gray-800 rounded-xl text-gray-500">
                  <Clock3 size={28} className="mx-auto mb-2 text-gray-600" />
                  No hierarchy tasks available in this view.
                </div>
              )}
            </div>
          )}
        </article>
      </section>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="border border-gray-800 rounded-xl px-4 py-3 min-w-[140px]">
      <p className="text-[10px] uppercase tracking-widest text-gray-500 font-black">{label}</p>
      <p className="text-xl font-black text-white mt-1">{value}</p>
    </div>
  );
}
