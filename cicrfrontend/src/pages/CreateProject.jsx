import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Check, FolderKanban, Loader2, Users } from 'lucide-react';
import { createProject, fetchDirectoryMembers, fetchEvents } from '../api';
import FormField from '../components/FormField';
import useDraftForm from '../hooks/useDraftForm';
import useUnsavedChangesWarning from '../hooks/useUnsavedChangesWarning';

const INITIAL_FORM = {
  eventId: '',
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
};

const STAGES = ['Planning', 'Execution', 'Testing', 'Review', 'Deployment'];

const dispatchToast = (message, type = 'info') => {
  try {
    window.dispatchEvent(new CustomEvent('app:toast', { detail: { message, type } }));
  } catch {
    window.alert(message);
  }
};

export default function CreateProject() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [users, setUsers] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  const profile = JSON.parse(localStorage.getItem('profile') || '{}');
  const userData = profile.result || profile;
  const role = String(userData.role || '').toLowerCase();
  const isAdmin = role === 'admin';

  const { values: formData, setValues: setFormData, isDirty, lastSavedAt, resetForm } = useDraftForm({
    storageKey: `draft_create_project_${String(userData._id || userData.collegeId || 'member')}`,
    initialValues: INITIAL_FORM,
  });
  useUnsavedChangesWarning(isDirty);

  useEffect(() => {
    Promise.all([fetchDirectoryMembers(), fetchEvents()])
      .then(([memberRes, eventRes]) => {
        setUsers(Array.isArray(memberRes.data) ? memberRes.data : []);
        const rows = Array.isArray(eventRes.data) ? eventRes.data : [];
        const activeEvents = rows.filter((row) => row.status !== 'Cancelled');
        setEvents(activeEvents);
      })
      .catch(() => {
        setUsers([]);
        setEvents([]);
      });
  }, []);

  useEffect(() => {
    const quickEvent = searchParams.get('event');
    if (quickEvent) {
      setFormData((prev) => ({ ...prev, eventId: quickEvent }));
    }
  }, [searchParams, setFormData]);

  const selectedEvent = useMemo(
    () => events.find((row) => String(row._id) === String(formData.eventId)),
    [events, formData.eventId]
  );

  const validate = () => {
    const next = {};
    if (!String(formData.eventId || '').trim()) next.eventId = 'Select an event.';
    if (String(formData.title || '').trim().length < 4) next.title = 'Name must be at least 4 characters.';
    if (String(formData.description || '').trim().length < 20) next.description = 'Description must be at least 20 characters.';

    const components = String(formData.components || '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
    if (!components.length) next.components = 'Add at least one required component/resource.';

    if (!formData.startTime) next.startTime = 'Start time is required.';
    if (!formData.deadline) next.deadline = 'Deadline is required.';
    if (formData.startTime && formData.deadline && new Date(formData.deadline) <= new Date(formData.startTime)) {
      next.deadline = 'Deadline must be after start time.';
    }

    if (!String(formData.lead || '').trim()) next.lead = 'Select a project lead.';
    if (!String(formData.guide || '').trim()) next.guide = 'Select a guide.';
    if (!Array.isArray(formData.team) || formData.team.length === 0) next.team = 'Select at least one team member.';

    return next;
  };

  const updateField = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: '' }));
    }
  };

  const toggleTeamMember = (userId) => {
    setFormData((prev) => ({
      ...prev,
      team: prev.team.includes(userId) ? prev.team.filter((id) => id !== userId) : [...prev.team, userId],
    }));
    if (errors.team) {
      setErrors((prev) => ({ ...prev, team: '' }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isAdmin) {
      dispatchToast('Only administrators can create projects.', 'error');
      return;
    }

    const nextErrors = validate();
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setLoading(true);
    try {
      const payload = {
        eventId: formData.eventId,
        title: formData.title,
        description: formData.description,
        domain: formData.domain,
        components: String(formData.components || '')
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean),
        startTime: formData.startTime,
        deadline: formData.deadline,
        lead: formData.lead,
        guide: formData.guide,
        team: formData.team,
        stage: formData.stage,
      };

      await createProject(payload);
      dispatchToast('Project created successfully.', 'success');
      resetForm(INITIAL_FORM);
      navigate('/projects');
    } catch (err) {
      dispatchToast(err.response?.data?.message || 'Failed to create project.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="ui-page max-w-5xl mx-auto space-y-6 page-motion-a pb-16">
      <button onClick={() => navigate('/projects')} className="flex items-center gap-2 text-gray-400 hover:text-white section-motion section-motion-delay-1">
        <ArrowLeft size={18} /> Back to Projects
      </button>

      {!isAdmin ? (
        <div className="border-l-2 border-amber-500/50 bg-amber-500/10 px-4 py-3 text-sm text-amber-200 section-motion section-motion-delay-1">
          Only administrators can initialize projects. Leads can manage updates once assigned.
        </div>
      ) : null}

      <form onSubmit={handleSubmit} className="space-y-6 section-motion section-motion-delay-2">
        <section className="space-y-5 border-b border-gray-800/70 pb-6">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-xl font-semibold flex items-center gap-2"><FolderKanban size={20} className="text-blue-400" /> Project Initialization</h3>
            {lastSavedAt ? (
              <span className="text-xs text-gray-500">
                Draft saved {new Date(lastSavedAt).toLocaleTimeString()}
              </span>
            ) : null}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <FormField id="project-event" label="Event" required error={errors.eventId}>
              <select
                id="project-event"
                value={formData.eventId}
                onChange={(e) => updateField('eventId', e.target.value)}
                className="ui-input"
              >
                <option value="">Select event</option>
                {events.map((evt) => (
                  <option key={evt._id} value={evt._id}>
                    {evt.title} ({new Date(evt.startTime).toLocaleDateString()})
                  </option>
                ))}
              </select>
            </FormField>

            <FormField id="project-domain" label="Domain" required>
              <select
                id="project-domain"
                value={formData.domain}
                onChange={(e) => updateField('domain', e.target.value)}
                className="ui-input"
              >
                <option value="Tech">Tech</option>
                <option value="Management">Management</option>
                <option value="PR">PR</option>
              </select>
            </FormField>
          </div>

          {selectedEvent ? (
            <p className="text-sm text-cyan-200">
              Linked event: <span className="font-semibold">{selectedEvent.title}</span>
            </p>
          ) : null}

          <FormField id="project-title" label="Project Name" required error={errors.title}>
            <input
              id="project-title"
              value={formData.title}
              onChange={(e) => updateField('title', e.target.value)}
              placeholder="Enter project name"
              className="ui-input"
              maxLength={160}
            />
          </FormField>

          <FormField id="project-description" label="Detailed Description" required error={errors.description}>
            <textarea
              id="project-description"
              value={formData.description}
              onChange={(e) => updateField('description', e.target.value)}
              rows={4}
              placeholder="Define the project objective, deliverables, and scope."
              className="ui-input resize-none"
            />
          </FormField>

          <FormField id="project-components" label="Required Components / Resources" required error={errors.components}>
            <input
              id="project-components"
              value={formData.components}
              onChange={(e) => updateField('components', e.target.value)}
              placeholder="e.g. Sensor kit, API access, Prototype PCB"
              className="ui-input"
            />
          </FormField>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <FormField id="project-start-time" label="Start Time" required error={errors.startTime}>
              <input
                id="project-start-time"
                type="datetime-local"
                value={formData.startTime}
                onChange={(e) => updateField('startTime', e.target.value)}
                className="ui-input [color-scheme:dark]"
              />
            </FormField>
            <FormField id="project-deadline" label="Hard Deadline" required error={errors.deadline}>
              <input
                id="project-deadline"
                type="datetime-local"
                value={formData.deadline}
                onChange={(e) => updateField('deadline', e.target.value)}
                className="ui-input [color-scheme:dark]"
              />
            </FormField>
            <FormField id="project-stage" label="Initial Stage" required>
              <select
                id="project-stage"
                value={formData.stage}
                onChange={(e) => updateField('stage', e.target.value)}
                className="ui-input"
              >
                {STAGES.map((stage) => (
                  <option key={stage} value={stage}>
                    {stage}
                  </option>
                ))}
              </select>
            </FormField>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <FormField id="project-lead" label="Project Lead" required error={errors.lead}>
              <select
                id="project-lead"
                value={formData.lead}
                onChange={(e) => updateField('lead', e.target.value)}
                className="ui-input"
              >
                <option value="">Select lead</option>
                {users.map((u) => (
                  <option key={u._id} value={u._id}>
                    {u.name} ({u.role})
                  </option>
                ))}
              </select>
            </FormField>

            <FormField id="project-guide" label="Guide" required error={errors.guide}>
              <select
                id="project-guide"
                value={formData.guide}
                onChange={(e) => updateField('guide', e.target.value)}
                className="ui-input"
              >
                <option value="">Select guide</option>
                {users.map((u) => (
                  <option key={u._id} value={u._id}>
                    {u.name} ({u.role})
                  </option>
                ))}
              </select>
            </FormField>
          </div>
        </section>

        <section className="space-y-3 border-b border-gray-800/70 pb-6">
          <h3 className="text-lg font-semibold flex items-center gap-2"><Users size={18} className="text-blue-400" /> Initial Team Members</h3>
          <p className="text-sm text-gray-400">Click members to include in the project team.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-80 overflow-y-auto pr-2">
            {users.map((u) => (
              <button
                key={u._id}
                type="button"
                onClick={() => toggleTeamMember(u._id)}
                className={`flex items-center justify-between px-3 py-2 rounded-lg border text-left transition-colors ${
                  formData.team.includes(u._id) ? 'border-blue-500/60 bg-blue-500/10 text-blue-100' : 'border-gray-800 text-gray-300'
                }`}
              >
                <span className="text-sm">{u.name}</span>
                {formData.team.includes(u._id) ? <Check size={16} className="text-blue-300" /> : null}
              </button>
            ))}
          </div>
          {errors.team ? <p className="ui-field-error">{errors.team}</p> : null}
        </section>

        <div className="mobile-sticky-action">
          <button
            type="submit"
            disabled={loading || !isAdmin}
            className="w-full btn btn-primary !py-4 !text-sm"
          >
            {loading ? <Loader2 className="animate-spin" size={16} /> : 'Create Project'}
          </button>
        </div>
      </form>
    </div>
  );
}
