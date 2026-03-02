import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Link, useSearchParams } from 'react-router-dom';
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock4,
  Download,
  Layers3,
  MapPin,
  Plus,
  Search,
  Sparkles,
  Trash2,
  Users,
} from 'lucide-react';
import { createEvent, deleteEvent, fetchDirectoryMembers, fetchEventById, fetchEvents, updateEvent } from '../api';
import FormField from '../components/FormField';
import PageHeader from '../components/PageHeader';
import { DataEmpty, DataLoading } from '../components/DataState';
import useDraftForm from '../hooks/useDraftForm';
import useUnsavedChangesWarning from '../hooks/useUnsavedChangesWarning';

const EVENT_TYPES = ['Orientation', 'Workshop', 'Recruitment', 'Competition', 'Seminar', 'Internal'];
const PROJECT_DOMAINS = ['Tech', 'Management', 'PR'];
const PROJECT_STAGES = ['Planning', 'Execution', 'Testing', 'Review', 'Deployment'];
const EVENT_STATUS_FILTERS = ['All', 'Scheduled', 'Completed', 'Cancelled'];
const EVENTS_VIEW_KEY = 'events_saved_view_v1';

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
const fmt = (value) => {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return 'TBD';
  return d.toLocaleString();
};

const csvValue = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;

const downloadCsv = (filename, headers, rows) => {
  const head = headers.map(csvValue).join(',');
  const body = rows.map((row) => row.map(csvValue).join(',')).join('\n');
  const csv = `${head}\n${body}`;
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export default function Events() {
  const [searchParams, setSearchParams] = useSearchParams();
  const savedView = (() => {
    try {
      const raw = localStorage.getItem(EVENTS_VIEW_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  })();

  const createFormRef = useRef(null);
  const noticeTimerRef = useRef(null);
  const [events, setEvents] = useState([]);
  const [members, setMembers] = useState([]);
  const [projectDrafts, setProjectDrafts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [exportingEventId, setExportingEventId] = useState('');
  const [selectedEventId, setSelectedEventId] = useState(searchParams.get('focus') || savedView.focus || '');
  const [selectedEventDetails, setSelectedEventDetails] = useState(null);
  const [selectedDetailsLoading, setSelectedDetailsLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState(() => {
    const candidate = searchParams.get('status') || savedView.status || 'All';
    return EVENT_STATUS_FILTERS.includes(candidate) ? candidate : 'All';
  });
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || savedView.q || '');
  const [errors, setErrors] = useState({});
  const [actionNotice, setActionNotice] = useState(null);

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

  useEffect(() => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);

        if (searchQuery.trim()) next.set('q', searchQuery.trim());
        else next.delete('q');

        if (statusFilter !== 'All') next.set('status', statusFilter);
        else next.delete('status');

        if (selectedEventId) next.set('focus', selectedEventId);
        else next.delete('focus');

        return next;
      },
      { replace: true }
    );
  }, [searchQuery, selectedEventId, setSearchParams, statusFilter]);

  useEffect(() => {
    try {
      localStorage.setItem(
        EVENTS_VIEW_KEY,
        JSON.stringify({
          q: searchQuery,
          status: statusFilter,
          focus: selectedEventId,
        })
      );
    } catch {
      // ignore persistence errors
    }
  }, [searchQuery, selectedEventId, statusFilter]);

  useEffect(() => {
    return () => {
      if (noticeTimerRef.current) {
        window.clearTimeout(noticeTimerRef.current);
      }
    };
  }, []);

  const showActionNotice = (text, type = 'info') => {
    if (noticeTimerRef.current) {
      window.clearTimeout(noticeTimerRef.current);
    }
    setActionNotice({ text, type });
    noticeTimerRef.current = window.setTimeout(() => {
      setActionNotice(null);
    }, 3600);
  };

  const openEvents = useMemo(() => events.filter((event) => event.status === 'Scheduled'), [events]);
  const orderedEvents = useMemo(
    () =>
      [...events].sort((a, b) => {
        const aTime = new Date(a.startTime).getTime();
        const bTime = new Date(b.startTime).getTime();
        if (!Number.isFinite(aTime) || !Number.isFinite(bTime)) return 0;
        return aTime - bTime;
      }),
    [events]
  );

  const eventCounts = useMemo(() => {
    const counts = { all: events.length, scheduled: 0, completed: 0, cancelled: 0 };
    events.forEach((event) => {
      const normalized = String(event.status || '').toLowerCase();
      if (normalized === 'scheduled') counts.scheduled += 1;
      if (normalized === 'completed') counts.completed += 1;
      if (normalized === 'cancelled') counts.cancelled += 1;
    });
    return counts;
  }, [events]);

  const filteredEvents = useMemo(() => {
    const normalizedQuery = String(searchQuery || '').trim().toLowerCase();
    return orderedEvents.filter((event) => {
      const statusMatch = statusFilter === 'All' ? true : String(event.status || '') === statusFilter;
      const queryMatch = normalizedQuery
        ? `${event.title || ''} ${event.type || ''} ${event.location || ''}`.toLowerCase().includes(normalizedQuery)
        : true;
      return statusMatch && queryMatch;
    });
  }, [orderedEvents, searchQuery, statusFilter]);

  const selectedEvent = useMemo(
    () => filteredEvents.find((event) => event._id === selectedEventId) || filteredEvents[0] || null,
    [filteredEvents, selectedEventId]
  );
  const selectedEventKey = selectedEvent?._id || '';

  useEffect(() => {
    if (!filteredEvents.length) {
      setSelectedEventId('');
      setSelectedEventDetails(null);
      return;
    }
    if (!filteredEvents.some((event) => event._id === selectedEventId)) {
      setSelectedEventId(filteredEvents[0]._id);
    }
  }, [filteredEvents, selectedEventId]);

  useEffect(() => {
    if (!selectedEventKey) {
      setSelectedEventDetails(null);
      return;
    }

    let active = true;
    const loadSelectedEventDetails = async () => {
      setSelectedDetailsLoading(true);
      try {
        const { data } = await fetchEventById(selectedEventKey);
        if (!active) return;
        setSelectedEventDetails(data || null);
      } catch {
        if (!active) return;
        setSelectedEventDetails(null);
      } finally {
        if (active) {
          setSelectedDetailsLoading(false);
        }
      }
    };

    loadSelectedEventDetails();
    return () => {
      active = false;
    };
  }, [selectedEventKey]);

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
      setSelectedEventId(data?._id || '');
      resetForm(INITIAL_EVENT_FORM);
      setProjectDrafts([]);
      dispatchToast('Event created successfully.', 'success');
      showActionNotice('Event created and selected for review.', 'success');
    } catch (err) {
      dispatchToast(err.response?.data?.message || 'Failed to create event.', 'error');
      showActionNotice('Could not create event. Check required fields and retry.', 'error');
    } finally {
      setCreating(false);
    }
  };

  const handleStatusUpdate = async (eventId, status) => {
    try {
      const { data } = await updateEvent(eventId, { status });
      setEvents((prev) => prev.map((item) => (item._id === data._id ? data : item)));
      setSelectedEventDetails((prev) => (prev && prev._id === data._id ? { ...prev, ...data } : prev));
      dispatchToast(`Event marked ${status}.`, 'success');
      showActionNotice(`Status updated to ${status}.`, 'success');
    } catch (err) {
      dispatchToast(err.response?.data?.message || 'Failed to update event.', 'error');
      showActionNotice('Status update failed. Please retry.', 'error');
    }
  };

  const handleDelete = async (eventId) => {
    if (!window.confirm('Delete this event and all linked projects?')) return;
    try {
      await deleteEvent(eventId);
      setEvents((prev) => prev.filter((item) => item._id !== eventId));
      if (selectedEventId === eventId) {
        setSelectedEventId('');
        setSelectedEventDetails(null);
      }
      dispatchToast('Event removed.', 'success');
      showActionNotice('Event deleted successfully.', 'success');
    } catch (err) {
      dispatchToast(err.response?.data?.message || 'Failed to delete event.', 'error');
      showActionNotice('Delete failed. Please retry.', 'error');
    }
  };

  const handleExportEvent = async (eventId) => {
    if (!isAdmin || !eventId) return;
    setExportingEventId(eventId);
    try {
      const { data } = await fetchEventById(eventId);
      const event = data || {};
      const projects = Array.isArray(event.projects) ? event.projects : [];

      const headers = [
        'Event Title',
        'Event Type',
        'Event Status',
        'Event Location',
        'Event Start',
        'Event End',
        'Project Title',
        'Project Domain',
        'Project Status',
        'Project Stage',
        'Progress %',
        'Project Start',
        'Project Deadline',
        'Components',
        'Lead',
        'Guide',
        'Member Name',
        'Member Role',
        'Member Year',
        'Member Branch',
        'Member Email',
        'Last Edited By',
        'Last Edited At',
        'Last Edited Action',
        'Updates Count',
        'Last Update Note',
        'Status Changes',
      ];

      const rows = [];
      projects.forEach((project) => {
        const members = Array.isArray(project.team) && project.team.length > 0 ? project.team : [null];
        const updates = Array.isArray(project.updates) ? project.updates : [];
        const statusHistory = Array.isArray(project.statusHistory) ? project.statusHistory : [];
        const latestUpdate = updates[0]?.text || '';
        const statusTrail = statusHistory
          .slice(0, 6)
          .map((row) => `${row.status} (${new Date(row.changedAt || row.createdAt || Date.now()).toLocaleDateString()})`)
          .join(' | ');

        members.forEach((member) => {
          rows.push([
            event.title || '',
            event.type || '',
            event.status || '',
            event.location || '',
            fmt(event.startTime),
            fmt(event.endTime),
            project.title || '',
            project.domain || '',
            project.status || '',
            project.stage || '',
            Number(project.progress || 0),
            fmt(project.startTime),
            fmt(project.deadline),
            (project.components || []).join(' | '),
            project.lead?.name || '',
            project.guide?.name || '',
            member?.name || '',
            member?.role || '',
            member?.year ?? '',
            member?.branch || '',
            member?.email || '',
            project.lastEditedBy?.name || '',
            project.lastEditedAt ? fmt(project.lastEditedAt) : '',
            project.lastEditedAction || '',
            updates.length,
            latestUpdate,
            statusTrail,
          ]);
        });
      });

      if (rows.length === 0) {
        rows.push([
          event.title || '',
          event.type || '',
          event.status || '',
          event.location || '',
          fmt(event.startTime),
          fmt(event.endTime),
          '',
          '',
          '',
          '',
          '',
          '',
          '',
          '',
          '',
          '',
          '',
          '',
          '',
          '',
          '',
          '',
          '',
          '',
          0,
          '',
          '',
        ]);
      }

      const filename = `${String(event.title || 'event-report')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')}-details.csv`;

      downloadCsv(filename, headers, rows);
      dispatchToast('Event sheet exported successfully.', 'success');
      showActionNotice('Event sheet exported successfully.', 'success');
    } catch (err) {
      dispatchToast(err.response?.data?.message || 'Failed to export event details.', 'error');
      showActionNotice('Export failed. Please retry.', 'error');
    } finally {
      setExportingEventId('');
    }
  };

  const selectedProjects = useMemo(
    () => (Array.isArray(selectedEventDetails?.projects) ? selectedEventDetails.projects : []),
    [selectedEventDetails?.projects]
  );

  return (
    <div className="ui-page max-w-7xl space-y-8 pb-16 page-motion-b">
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

      <section className="grid grid-cols-2 lg:grid-cols-4 gap-x-5 gap-y-4 border-y border-gray-800/70 py-3">
        <StreamMetric label="All Events" value={eventCounts.all} tone="white" />
        <StreamMetric label="Scheduled" value={eventCounts.scheduled} tone="cyan" />
        <StreamMetric label="Completed" value={eventCounts.completed} tone="emerald" />
        <StreamMetric label="Cancelled" value={eventCounts.cancelled} tone="rose" />
      </section>

      {actionNotice ? (
        <section
          className={`rounded-xl border px-3 py-2 text-sm ${
            actionNotice.type === 'error'
              ? 'border-rose-500/35 bg-rose-500/10 text-rose-200'
              : actionNotice.type === 'success'
              ? 'border-emerald-500/35 bg-emerald-500/10 text-emerald-200'
              : 'border-cyan-500/35 bg-cyan-500/10 text-cyan-200'
          }`}
        >
          {actionNotice.text}
        </section>
      ) : null}

      {isAdmin ? (
        <motion.form
          ref={createFormRef}
          onSubmit={handleCreate}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.05 }}
          className="border-y border-gray-800/70 py-5 px-1 md:px-2 space-y-5 section-motion section-motion-delay-2"
        >
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2 text-sm text-gray-300 font-semibold">
              <Plus size={14} /> Create Event
            </div>
            {lastSavedAt ? (
              <span className="text-xs text-gray-400">
                Draft autosaved {new Date(lastSavedAt).toLocaleTimeString()}
              </span>
            ) : null}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField id="event-title" label="Event Title" required hint="Minimum 4 characters" error={errors.title}>
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
            <FormField label="Location / Link" required hint="Use venue name or meeting URL" error={errors.location}>
              <input
                value={form.location}
                onChange={(e) => updateField('location', e.target.value)}
                placeholder="Location or link"
                className="ui-input"
              />
            </FormField>
            <FormField label="Starts At" required hint="Event opening date and time" error={errors.startTime}>
              <input
                type="datetime-local"
                value={form.startTime}
                onChange={(e) => updateField('startTime', e.target.value)}
                className="ui-input scheme-dark"
              />
            </FormField>
            <FormField label="Ends At" required hint="Must be after start time" error={errors.endTime}>
              <input
                type="datetime-local"
                value={form.endTime}
                onChange={(e) => updateField('endTime', e.target.value)}
                className="ui-input scheme-dark"
              />
            </FormField>
            <FormField label="Application Deadline" optional hint="Required when applications are enabled" error={errors.applicationDeadline}>
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

          <label className="inline-flex items-center gap-2 text-sm text-gray-300">
            <input
              type="checkbox"
              checked={form.allowApplications}
              onChange={(e) => updateField('allowApplications', e.target.checked)}
            />
            Allow applications for this event
          </label>

          <div className="border-t border-gray-800/90 pt-4 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <Layers3 size={14} className="text-cyan-300" /> Initialize Projects (Optional)
              </h3>
              <button type="button" onClick={addProjectDraft} className="btn btn-secondary px-3! py-1.5! text-xs!">
                Add Project
              </button>
            </div>

            {projectDrafts.length === 0 ? (
              <p className="text-xs text-gray-400">No project blueprints added yet.</p>
            ) : null}

            {projectDrafts.map((row, index) => (
              <div key={`seed-${index}`} className="border-t border-gray-800/80 pt-4 pb-1 space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-gray-300 font-semibold">Project {index + 1}</p>
                  <button
                    type="button"
                    onClick={() => removeProjectDraft(index)}
                    className="text-xs text-rose-300"
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
                      className="ui-input scheme-dark"
                    />
                  </FormField>
                  <FormField label="Deadline" required error={errors[`project_${index}_deadline`]}>
                    <input
                      type="datetime-local"
                      value={row.deadline}
                      onChange={(e) => setProjectField(index, 'deadline', e.target.value)}
                      className="ui-input scheme-dark"
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
                  <p className="text-xs text-gray-400 font-semibold">Initial Team</p>
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
            <button type="submit" disabled={creating} className="btn btn-primary px-4! py-2.5! text-xs!">
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
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.12fr)_360px] gap-8 section-motion section-motion-delay-3">
          <section className="overflow-hidden border-y border-gray-800/80">
            <div className="ui-toolbar-sticky flex flex-wrap items-center justify-between gap-3 px-4 md:px-6 py-3 border-b border-gray-800/80">
              <div className="relative min-w-55 flex-1 max-w-md">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search title, type, location..."
                  className="ui-input pl-9! py-2!"
                />
              </div>
              <div className="w-full sm:w-55">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  aria-label="Filter events by status"
                  className="ui-input py-2!"
                >
                  {EVENT_STATUS_FILTERS.map((filter) => (
                    <option key={filter} value={filter}>
                      {filter === 'all' ? 'All statuses' : filter}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-[minmax(0,1.6fr)_0.7fr_0.75fr] gap-3 px-4 md:px-6 py-2 text-sm text-gray-400 font-semibold border-b border-gray-800/80">
              <span>Event Stream</span>
              <span className="hidden md:block">Timeline</span>
              <span className="text-right">Projects</span>
            </div>

            {filteredEvents.length === 0 ? (
              <p className="px-4 md:px-6 py-10 text-sm text-gray-400">No events match your current filters.</p>
            ) : (
              <div className="divide-y divide-gray-800/80">
                {filteredEvents.map((event, idx) => {
                const active = selectedEvent?._id === event._id;
                const statusTone =
                  event.status === 'Scheduled'
                    ? 'text-cyan-200 border-cyan-500/40 bg-cyan-500/10'
                    : event.status === 'Completed'
                    ? 'text-emerald-200 border-emerald-500/40 bg-emerald-500/10'
                    : 'text-rose-200 border-rose-500/40 bg-rose-500/10';

                return (
                  <motion.button
                    key={event._id}
                    type="button"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.04, duration: 0.35 }}
                    onClick={() => setSelectedEventId(event._id)}
                    className={`w-full text-left px-4 md:px-6 py-4 transition-all ${
                      active ? 'bg-cyan-500/6' : 'hover:bg-white/3'
                    }`}
                  >
                    <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1.6fr)_0.7fr_0.75fr] gap-3 items-center">
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-base md:text-lg font-semibold text-white tracking-tight">{event.title}</h3>
                          <span className={`text-xs px-2 py-1 rounded-full border ${statusTone}`}>
                            {event.status}
                          </span>
                        </div>
                        <p className="text-xs text-cyan-300/90">{event.type}</p>
                        <p className="text-sm text-gray-400 line-clamp-2">{event.description || 'No event description.'}</p>
                        <div className="flex items-center gap-3 text-xs text-gray-400 flex-wrap">
                          <span className="inline-flex items-center gap-1.5"><MapPin size={12} className="text-emerald-300" /> {event.location}</span>
                          {event.allowApplications ? (
                            <span className="inline-flex items-center gap-1.5 text-purple-200">
                              <Users size={12} /> Applications till {fmtDate(event.applicationDeadline)}
                            </span>
                          ) : null}
                        </div>
                      </div>
                      <div className="hidden md:block text-xs text-gray-300">
                        <p className="inline-flex items-center gap-1.5">
                          <CalendarDays size={12} className="text-blue-300" /> {fmtDate(event.startTime)}
                        </p>
                        <p className="mt-1 inline-flex items-center gap-1.5 text-gray-400">
                          <Clock4 size={12} className="text-amber-300" /> {fmtTime(event.startTime)} - {fmtTime(event.endTime)}
                        </p>
                      </div>
                      <div className="text-right text-sm">
                        <p className="text-white font-semibold">{event.projectCount || 0}</p>
                        <p className="text-xs text-gray-400">tracks</p>
                      </div>
                    </div>
                  </motion.button>
                );
                })}
              </div>
            )}
          </section>

          <aside className="space-y-5 xl:sticky xl:top-24 h-fit xl:border-l xl:border-gray-800/70 xl:pl-5">
            {selectedEvent ? (
              <>
                <div className="space-y-2">
                  <p className="text-xs text-cyan-300 font-semibold">Event Detail Workspace</p>
                  <h3 className="text-2xl font-semibold text-white leading-tight">{selectedEvent.title}</h3>
                  <p className="text-sm text-gray-300">{selectedEvent.description || 'No event description provided.'}</p>
                </div>

                <div className="grid grid-cols-2 gap-2 text-sm border-y border-gray-800/70 py-3">
                  <div>
                    <p className="text-xs text-blue-300">Start</p>
                    <p className="text-white font-semibold mt-1">{fmtDate(selectedEvent.startTime)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-amber-200">End</p>
                    <p className="text-white font-semibold mt-1">{fmtDate(selectedEvent.endTime)}</p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Link to={`/events/${selectedEvent._id}`} className="btn btn-secondary text-xs! px-3! py-2!">
                    <ArrowRight size={12} /> Open Details
                  </Link>
                  <Link to={`/projects?event=${selectedEvent._id}`} className="btn btn-secondary text-xs! px-3! py-2!">
                    <Layers3 size={12} /> Project Tracks
                  </Link>
                  {selectedEvent.allowApplications ? (
                    <Link to={`/apply?event=${selectedEvent._id}`} className="btn btn-secondary text-xs! px-3! py-2!">
                      <Users size={12} /> Application Form
                    </Link>
                  ) : null}
                </div>

                {isAdmin ? (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {selectedEvent.status === 'Scheduled' ? (
                      <button
                        onClick={() => handleStatusUpdate(selectedEvent._id, 'Completed')}
                        className="btn btn-secondary text-xs! px-3! py-2! text-emerald-200! border-emerald-500/40!"
                      >
                        <CheckCircle2 size={12} /> Complete
                      </button>
                    ) : null}
                    <button
                      onClick={() => handleStatusUpdate(selectedEvent._id, 'Cancelled')}
                      className="btn btn-secondary text-xs! px-3! py-2! text-rose-200! border-rose-500/40!"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => handleExportEvent(selectedEvent._id)}
                      disabled={exportingEventId === selectedEvent._id}
                      className="btn btn-secondary text-xs! px-3! py-2! text-cyan-200! border-cyan-500/40!"
                    >
                      <Download size={12} />
                      {exportingEventId === selectedEvent._id ? 'Exporting...' : 'Export'}
                    </button>
                    <button
                      onClick={() => handleDelete(selectedEvent._id)}
                      className="btn btn-secondary text-xs! px-3! py-2! text-gray-200!"
                    >
                      <Trash2 size={12} /> Delete
                    </button>
                  </div>
                ) : null}

                <div className="space-y-2">
                  <p className="text-xs text-gray-400 font-semibold">Project Snapshot</p>
                  {selectedDetailsLoading ? (
                    <p className="text-sm text-gray-400">Loading project summary...</p>
                  ) : selectedProjects.length === 0 ? (
                    <p className="text-sm text-gray-400">No projects seeded for this event yet.</p>
                  ) : (
                    <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                      {selectedProjects.slice(0, 8).map((project) => (
                        <article key={project._id || project.title} className="px-3 py-2 border-b border-gray-800/70">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm text-white font-semibold truncate">{project.title}</p>
                            <span className="text-xs text-cyan-200">{Math.round(Number(project.progress || 0))}%</span>
                          </div>
                          <div className="mt-2 h-1.5 rounded-full bg-gray-800 overflow-hidden">
                            <div
                              className="h-full bg-linear-to-r from-cyan-400 via-blue-400 to-indigo-400"
                              style={{ width: `${Math.max(0, Math.min(100, Number(project.progress || 0)))}%` }}
                            />
                          </div>
                        </article>
                      ))}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <p className="text-sm text-gray-400">Select an event to view details.</p>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}

function StreamMetric({ label, value, tone = 'white' }) {
  const toneClass =
    tone === 'cyan'
      ? 'border-cyan-500/40 text-cyan-100'
      : tone === 'emerald'
      ? 'border-emerald-500/40 text-emerald-100'
      : tone === 'rose'
      ? 'border-rose-500/40 text-rose-100'
      : 'border-gray-700 text-gray-200';

  return (
    <article className={`border-l-2 pl-3 ${toneClass}`}>
      <p className="text-xs text-gray-400">{label}</p>
      <p className="text-lg font-semibold mt-1">{value}</p>
    </article>
  );
}
