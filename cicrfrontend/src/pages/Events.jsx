import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Link, useSearchParams } from 'react-router-dom';
import {
  CalendarDays,
  CheckCircle2,
  Clock4,
  Layers3,
  MapPin,
  Plus,
  Sparkles,
  Trash2,
  Users,
} from 'lucide-react';
import { createEvent, deleteEvent, fetchDirectoryMembers, fetchEvents, updateEvent } from '../api';
import FormField from '../components/FormField';
import PageHeader from '../components/PageHeader';
import { DataEmpty, DataLoading } from '../components/DataState';
import useDraftForm from '../hooks/useDraftForm';
import useUnsavedChangesWarning from '../hooks/useUnsavedChangesWarning';

const EVENT_TYPES = ['Orientation', 'Workshop', 'Recruitment', 'Competition', 'Seminar', 'Internal'];
const PROJECT_DOMAINS = ['Tech', 'Management', 'PR'];
const PROJECT_STAGES = ['Planning', 'Execution', 'Testing', 'Review', 'Deployment'];

const INITIAL_EVENT_FORM = {
  title: '',
  type: 'Internal',
  location: '',
  startTime: '',
  endTime: '',
  description: '',
  allowApplications: false,
  applicationDeadline: '',
};

const buildProjectDraft = () => ({
  title: '',
  description: '',
  domain: 'Tech',
  components: '',
  startTime: '',
  deadline: '',
  lead: '',
  guide: '',
  team: [],
  stage: 'Planning',
});

const dispatchToast = (message, type = 'info') => {
  try {
    window.dispatchEvent(new CustomEvent('app:toast', { detail: { message, type } }));
  } catch {
    window.alert(message);
  }
};

const fmtDate = (value) => {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return 'TBD';
  return d.toLocaleDateString();
};

const fmtTime = (value) => {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return 'TBD';
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

export default function Events() {
  const [searchParams] = useSearchParams();
  const createFormRef = useRef(null);
  const [events, setEvents] = useState([]);
  const [members, setMembers] = useState([]);
  const [projectDrafts, setProjectDrafts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [errors, setErrors] = useState({});

  const profile = JSON.parse(localStorage.getItem('profile') || '{}');
  const user = profile.result || profile;
  const role = String(user.role || '').toLowerCase();
  const isAdmin = role === 'admin';

  const { values: form, setValues: setForm, isDirty, lastSavedAt, resetForm } = useDraftForm({
    storageKey: `draft_events_create_${String(user._id || user.collegeId || 'member')}`,
    initialValues: INITIAL_EVENT_FORM,
  });
  useUnsavedChangesWarning(isAdmin && (isDirty || projectDrafts.length > 0));

  const loadEvents = async () => {
    setLoading(true);
    try {
      const { data } = await fetchEvents();
      setEvents(Array.isArray(data) ? data : []);
    } catch (err) {
      dispatchToast(err.response?.data?.message || 'Failed to load events.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEvents();
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    fetchDirectoryMembers()
      .then((res) => setMembers(Array.isArray(res.data) ? res.data : []))
      .catch(() => setMembers([]));
  }, [isAdmin]);

  useEffect(() => {
    if (!isAdmin) return;
    if (searchParams.get('quick') !== 'create') return;
    createFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    window.setTimeout(() => document.getElementById('event-title')?.focus(), 160);
  }, [isAdmin, searchParams]);

  const openEvents = useMemo(() => events.filter((event) => event.status === 'Scheduled'), [events]);

  const updateField = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: '' }));
  };

  const setProjectField = (index, key, value) => {
    setProjectDrafts((prev) => prev.map((row, idx) => (idx === index ? { ...row, [key]: value } : row)));
    const errorKey = `project_${index}_${key}`;
    if (errors[errorKey]) {
      setErrors((prev) => ({ ...prev, [errorKey]: '' }));
    }
  };

  const toggleProjectMember = (index, userId) => {
    setProjectDrafts((prev) =>
      prev.map((row, idx) => {
        if (idx !== index) return row;
        const hasUser = row.team.includes(userId);
        return {
          ...row,
          team: hasUser ? row.team.filter((id) => id !== userId) : [...row.team, userId],
        };
      })
    );

    const errorKey = `project_${index}_team`;
    if (errors[errorKey]) {
      setErrors((prev) => ({ ...prev, [errorKey]: '' }));
    }
  };

  const addProjectDraft = () => {
    setProjectDrafts((prev) => [...prev, buildProjectDraft()]);
  };

  const removeProjectDraft = (index) => {
    setProjectDrafts((prev) => prev.filter((_, idx) => idx !== index));
  };

  const validate = () => {
    const next = {};
    if (String(form.title || '').trim().length < 4) next.title = 'Title must be at least 4 characters.';
    if (!String(form.location || '').trim()) next.location = 'Location is required.';
    if (!form.startTime) next.startTime = 'Start time is required.';
    if (!form.endTime) next.endTime = 'End time is required.';
    if (form.startTime && form.endTime && new Date(form.endTime) <= new Date(form.startTime)) {
      next.endTime = 'End time must be after start time.';
    }
    if (form.allowApplications && !form.applicationDeadline) {
      next.applicationDeadline = 'Deadline is required when applications are enabled.';
    }
    if (form.allowApplications && form.applicationDeadline && form.startTime) {
      if (new Date(form.applicationDeadline) > new Date(form.startTime)) {
        next.applicationDeadline = 'Deadline must be on or before event date.';
      }
    }

    projectDrafts.forEach((row, index) => {
      if (String(row.title || '').trim().length < 4) next[`project_${index}_title`] = 'Project name must be at least 4 characters.';
      if (String(row.description || '').trim().length < 20) {
        next[`project_${index}_description`] = 'Description must be at least 20 characters.';
      }
      const components = String(row.components || '')
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
      if (!components.length) next[`project_${index}_components`] = 'Add at least one component/resource.';
      if (!row.startTime) next[`project_${index}_startTime`] = 'Project start time is required.';
      if (!row.deadline) next[`project_${index}_deadline`] = 'Project deadline is required.';
      if (row.startTime && row.deadline && new Date(row.deadline) <= new Date(row.startTime)) {
        next[`project_${index}_deadline`] = 'Deadline must be after start time.';
      }
      if (!String(row.lead || '').trim()) next[`project_${index}_lead`] = 'Select a lead.';
      if (!String(row.guide || '').trim()) next[`project_${index}_guide`] = 'Select a guide.';
      if (!Array.isArray(row.team) || row.team.length === 0) next[`project_${index}_team`] = 'Select at least one team member.';
    });

    return next;
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!isAdmin) return;

    const nextErrors = validate();
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setCreating(true);
    try {
      const payload = {
        ...form,
        applicationDeadline: form.applicationDeadline || null,
        allowApplications: !!form.allowApplications,
        projects: projectDrafts.map((row) => ({
          title: row.title,
          description: row.description,
          domain: row.domain,
          components: String(row.components || '')
            .split(',')
            .map((item) => item.trim())
            .filter(Boolean),
          startTime: row.startTime,
          deadline: row.deadline,
          lead: row.lead,
          guide: row.guide,
          team: row.team,
          stage: row.stage,
        })),
      };

      const { data } = await createEvent(payload);
      setEvents((prev) => [data, ...prev]);
      resetForm(INITIAL_EVENT_FORM);
      setProjectDrafts([]);
      dispatchToast('Event created successfully.', 'success');
    } catch (err) {
      dispatchToast(err.response?.data?.message || 'Failed to create event.', 'error');
    } finally {
      setCreating(false);
    }
  };

  const handleStatusUpdate = async (eventId, status) => {
    try {
      const { data } = await updateEvent(eventId, { status });
      setEvents((prev) => prev.map((item) => (item._id === data._id ? data : item)));
      dispatchToast(`Event marked ${status}.`, 'success');
    } catch (err) {
      dispatchToast(err.response?.data?.message || 'Failed to update event.', 'error');
    }
  };

  const handleDelete = async (eventId) => {
    if (!window.confirm('Delete this event and all linked projects?')) return;
    try {
      await deleteEvent(eventId);
      setEvents((prev) => prev.filter((item) => item._id !== eventId));
      dispatchToast('Event removed.', 'success');
    } catch (err) {
      dispatchToast(err.response?.data?.message || 'Failed to delete event.', 'error');
    }
  };

  return (
    <div className="ui-page max-w-6xl space-y-8 pb-16 page-motion-b">
      <motion.section
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45 }}
        className="section-motion section-motion-delay-1"
      >
        <PageHeader
          eyebrow="CICR Events"
          title="Events & Project Tracks"
          subtitle="Create events and initialize delivery projects with lead, guide, and team assignments in one workflow."
          icon={CalendarDays}
          badge={
            <>
              <Sparkles size={13} className="text-blue-300" />
              {openEvents.length} active events
            </>
          }
        />
      </motion.section>

      {isAdmin ? (
        <motion.form
          ref={createFormRef}
          onSubmit={handleCreate}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.05 }}
          className="border border-gray-800 rounded-[2rem] p-6 md:p-8 space-y-5 section-motion section-motion-delay-2"
        >
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2 text-xs text-gray-400 uppercase tracking-[0.22em] font-black">
              <Plus size={14} /> Create Event
            </div>
            {lastSavedAt ? (
              <span className="text-[10px] uppercase tracking-widest text-gray-500">
                Draft autosaved {new Date(lastSavedAt).toLocaleTimeString()}
              </span>
            ) : null}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField id="event-title" label="Event Title" required error={errors.title}>
              <input
                id="event-title"
                value={form.title}
                onChange={(e) => updateField('title', e.target.value)}
                placeholder="Event title"
                className="ui-input"
                maxLength={140}
              />
            </FormField>
            <FormField label="Event Type" required>
              <select value={form.type} onChange={(e) => updateField('type', e.target.value)} className="ui-input">
                {EVENT_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Location / Link" required error={errors.location}>
              <input
                value={form.location}
                onChange={(e) => updateField('location', e.target.value)}
                placeholder="Location or link"
                className="ui-input"
              />
            </FormField>
            <FormField label="Starts At" required error={errors.startTime}>
              <input
                type="datetime-local"
                value={form.startTime}
                onChange={(e) => updateField('startTime', e.target.value)}
                className="ui-input [color-scheme:dark]"
              />
            </FormField>
            <FormField label="Ends At" required error={errors.endTime}>
              <input
                type="datetime-local"
                value={form.endTime}
                onChange={(e) => updateField('endTime', e.target.value)}
                className="ui-input [color-scheme:dark]"
              />
            </FormField>
            <FormField label="Application Deadline" optional error={errors.applicationDeadline}>
              <input
                type="date"
                value={form.applicationDeadline}
                onChange={(e) => updateField('applicationDeadline', e.target.value)}
                className="ui-input"
              />
            </FormField>
          </div>

          <FormField label="Description" optional>
            <textarea
              value={form.description}
              onChange={(e) => updateField('description', e.target.value)}
              placeholder="Event description"
              rows={3}
              className="ui-input resize-none"
            />
          </FormField>

          <label className="inline-flex items-center gap-2 text-xs text-gray-300">
            <input
              type="checkbox"
              checked={form.allowApplications}
              onChange={(e) => updateField('allowApplications', e.target.checked)}
            />
            Allow applications for this event
          </label>

          <div className="border border-gray-800/90 rounded-2xl p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-2">
                <Layers3 size={14} className="text-cyan-300" /> Initialize Projects (Optional)
              </h3>
              <button type="button" onClick={addProjectDraft} className="btn btn-secondary !px-3 !py-1.5 !text-[10px]">
                Add Project
              </button>
            </div>

            {projectDrafts.length === 0 ? (
              <p className="text-xs text-gray-500">No project blueprints added yet.</p>
            ) : null}

            {projectDrafts.map((row, index) => (
              <div key={`seed-${index}`} className="border border-gray-800 rounded-xl p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs uppercase tracking-widest text-gray-400 font-black">Project {index + 1}</p>
                  <button
                    type="button"
                    onClick={() => removeProjectDraft(index)}
                    className="text-[10px] uppercase tracking-widest text-rose-300"
                  >
                    Remove
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <FormField label="Name" required error={errors[`project_${index}_title`]}>
                    <input
                      value={row.title}
                      onChange={(e) => setProjectField(index, 'title', e.target.value)}
                      className="ui-input"
                    />
                  </FormField>
                  <FormField label="Domain" required>
                    <select
                      value={row.domain}
                      onChange={(e) => setProjectField(index, 'domain', e.target.value)}
                      className="ui-input"
                    >
                      {PROJECT_DOMAINS.map((domain) => (
                        <option key={domain} value={domain}>
                          {domain}
                        </option>
                      ))}
                    </select>
                  </FormField>
                </div>

                <FormField label="Description" required error={errors[`project_${index}_description`]}>
                  <textarea
                    rows={3}
                    value={row.description}
                    onChange={(e) => setProjectField(index, 'description', e.target.value)}
                    className="ui-input resize-none"
                  />
                </FormField>

                <FormField label="Components / Resources" required error={errors[`project_${index}_components`]}>
                  <input
                    value={row.components}
                    onChange={(e) => setProjectField(index, 'components', e.target.value)}
                    placeholder="Comma separated resources"
                    className="ui-input"
                  />
                </FormField>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <FormField label="Start" required error={errors[`project_${index}_startTime`]}>
                    <input
                      type="datetime-local"
                      value={row.startTime}
                      onChange={(e) => setProjectField(index, 'startTime', e.target.value)}
                      className="ui-input [color-scheme:dark]"
                    />
                  </FormField>
                  <FormField label="Deadline" required error={errors[`project_${index}_deadline`]}>
                    <input
                      type="datetime-local"
                      value={row.deadline}
                      onChange={(e) => setProjectField(index, 'deadline', e.target.value)}
                      className="ui-input [color-scheme:dark]"
                    />
                  </FormField>
                  <FormField label="Stage" required>
                    <select
                      value={row.stage}
                      onChange={(e) => setProjectField(index, 'stage', e.target.value)}
                      className="ui-input"
                    >
                      {PROJECT_STAGES.map((stage) => (
                        <option key={stage} value={stage}>
                          {stage}
                        </option>
                      ))}
                    </select>
                  </FormField>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <FormField label="Lead" required error={errors[`project_${index}_lead`]}>
                    <select
                      value={row.lead}
                      onChange={(e) => setProjectField(index, 'lead', e.target.value)}
                      className="ui-input"
                    >
                      <option value="">Select lead</option>
                      {members.map((member) => (
                        <option key={member._id} value={member._id}>
                          {member.name} ({member.role})
                        </option>
                      ))}
                    </select>
                  </FormField>
                  <FormField label="Guide" required error={errors[`project_${index}_guide`]}>
                    <select
                      value={row.guide}
                      onChange={(e) => setProjectField(index, 'guide', e.target.value)}
                      className="ui-input"
                    >
                      <option value="">Select guide</option>
                      {members.map((member) => (
                        <option key={member._id} value={member._id}>
                          {member.name} ({member.role})
                        </option>
                      ))}
                    </select>
                  </FormField>
                </div>

                <div>
                  <p className="text-[10px] uppercase tracking-widest text-gray-500 font-black">Initial Team</p>
                  <div className="mt-2 max-h-36 overflow-y-auto grid grid-cols-1 md:grid-cols-2 gap-2 pr-1">
                    {members.map((member) => (
                      <button
                        key={`seed-${index}-${member._id}`}
                        type="button"
                        onClick={() => toggleProjectMember(index, member._id)}
                        className={`text-left text-xs px-3 py-2 rounded-lg border transition-colors ${
                          row.team.includes(member._id)
                            ? 'border-blue-500/60 text-blue-100 bg-blue-500/10'
                            : 'border-gray-800 text-gray-300'
                        }`}
                      >
                        {member.name}
                      </button>
                    ))}
                  </div>
                  {errors[`project_${index}_team`] ? <p className="ui-field-error mt-2">{errors[`project_${index}_team`]}</p> : null}
                </div>
              </div>
            ))}
          </div>

          <div className="mobile-sticky-action">
            <button type="submit" disabled={creating} className="btn btn-primary !px-4 !py-2.5">
              {creating ? 'Saving...' : 'Create Event'}
            </button>
          </div>
        </motion.form>
      ) : null}

      {loading ? (
        <div className="h-64 flex items-center justify-center"><DataLoading label="Loading events..." /></div>
      ) : events.length === 0 ? (
        <DataEmpty
          title="No events created yet"
          hint={isAdmin ? 'Create your first event and initialize project tracks.' : 'Please check again later.'}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 section-motion section-motion-delay-3 pro-stagger">
          {events.map((event) => (
            <motion.article
              key={event._id}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35 }}
              whileHover={{ y: -4 }}
              className="border border-gray-800 rounded-[1.6rem] p-5 space-y-4 pro-hover-lift"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-black text-white">{event.title}</h3>
                  <p className="text-xs text-gray-500 uppercase tracking-widest mt-1">{event.type}</p>
                </div>
                <span className="text-[10px] uppercase tracking-widest text-gray-300 border border-gray-700 rounded-lg px-2 py-1">
                  {event.status}
                </span>
              </div>

              <p className="text-sm text-gray-300">{event.description || 'No description provided.'}</p>

              <div className="text-xs text-gray-400 space-y-1">
                <div className="flex items-center gap-2">
                  <CalendarDays size={12} className="text-blue-400" /> {fmtDate(event.startTime)}
                  <Clock4 size={12} className="text-amber-400" /> {fmtTime(event.startTime)} - {fmtTime(event.endTime)}
                </div>
                <div className="flex items-center gap-2">
                  <MapPin size={12} className="text-emerald-400" /> {event.location}
                </div>
                <div className="flex items-center gap-2">
                  <Layers3 size={12} className="text-cyan-300" /> {event.projectCount || 0} linked projects
                </div>
                {event.allowApplications ? (
                  <div className="flex items-center gap-2">
                    <Users size={12} className="text-purple-400" /> Applications open until {fmtDate(event.applicationDeadline)}
                  </div>
                ) : null}
              </div>

              <div className="flex flex-wrap gap-2">
                <Link
                  to={`/projects?event=${event._id}`}
                  className="text-[10px] uppercase tracking-widest border border-cyan-500/40 text-cyan-200 px-3 py-1.5 rounded-lg"
                >
                  View Projects
                </Link>

                {event.allowApplications ? (
                  <Link
                    to={`/apply${event._id ? `?event=${event._id}` : ''}`}
                    className="text-[10px] uppercase tracking-widest border border-emerald-500/40 text-emerald-200 px-3 py-1.5 rounded-lg"
                  >
                    Apply
                  </Link>
                ) : null}

                {isAdmin && event.status === 'Scheduled' ? (
                  <button
                    onClick={() => handleStatusUpdate(event._id, 'Completed')}
                    className="text-[10px] uppercase tracking-widest border border-emerald-500/40 text-emerald-200 px-3 py-1.5 rounded-lg inline-flex items-center gap-1"
                  >
                    <CheckCircle2 size={12} /> Complete
                  </button>
                ) : null}
                {isAdmin ? (
                  <button
                    onClick={() => handleStatusUpdate(event._id, 'Cancelled')}
                    className="text-[10px] uppercase tracking-widest border border-rose-500/40 text-rose-200 px-3 py-1.5 rounded-lg"
                  >
                    Cancel
                  </button>
                ) : null}
                {isAdmin ? (
                  <button
                    onClick={() => handleDelete(event._id)}
                    className="text-[10px] uppercase tracking-widest border border-gray-700 text-gray-300 px-3 py-1.5 rounded-lg inline-flex items-center gap-1"
                  >
                    <Trash2 size={12} /> Delete
                  </button>
                ) : null}
              </div>
            </motion.article>
          ))}
        </div>
      )}
    </div>
  );
}
