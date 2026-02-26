import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Check, FolderKanban, Loader2, Users } from 'lucide-react';
import { createProject, fetchDirectoryMembers } from '../api';
import FormField from '../components/FormField';
import useDraftForm from '../hooks/useDraftForm';
import useUnsavedChangesWarning from '../hooks/useUnsavedChangesWarning';

const INITIAL_FORM = {
  title: '',
  description: '',
  domain: 'Tech',
  team: [],
  lead: '',
};

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
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  const profile = JSON.parse(localStorage.getItem('profile') || '{}');
  const userData = profile.result || profile;
  const role = String(userData.role || '').toLowerCase();
  const isAdminOrHead = role === 'admin' || role === 'head';
  const year = Number(userData.year);
  const isSenior = Number.isFinite(year) && year >= 2;
  const canCreate = isAdminOrHead || isSenior;

  const { values: formData, setValues: setFormData, isDirty, lastSavedAt, resetForm } = useDraftForm({
    storageKey: `draft_create_project_${String(userData._id || userData.collegeId || 'member')}`,
    initialValues: INITIAL_FORM,
  });
  useUnsavedChangesWarning(isDirty);

  useEffect(() => {
    fetchDirectoryMembers()
      .then((res) => setUsers(Array.isArray(res.data) ? res.data : []))
      .catch(() => setUsers([]));
  }, []);

  useEffect(() => {
    if (searchParams.get('quick') === 'create') {
      const node = document.getElementById('project-title');
      node?.focus();
    }
  }, [searchParams]);

  const eligibleUsers = useMemo(
    () =>
      isAdminOrHead
        ? users
        : users.filter((u) => {
            const yr = Number(u.year);
            if (!Number.isFinite(yr)) return false;
            return Number.isFinite(year) && yr <= year;
          }),
    [isAdminOrHead, users, year]
  );

  const validate = () => {
    const next = {};
    if (String(formData.title || '').trim().length < 4) next.title = 'Title must be at least 4 characters.';
    if (!String(formData.lead || '').trim()) next.lead = 'Select a project lead.';
    if (String(formData.description || '').trim().length < 20) next.description = 'Description must be at least 20 characters.';
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
    if (!canCreate) {
      dispatchToast('Only seniors (2nd year+) can create projects.', 'error');
      return;
    }

    const nextErrors = validate();
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setLoading(true);
    try {
      await createProject(formData);
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
    <div className="ui-page max-w-4xl mx-auto space-y-6 page-motion-a pro-stagger">
      <button onClick={() => navigate('/projects')} className="flex items-center gap-2 text-gray-400 hover:text-white section-motion section-motion-delay-1">
        <ArrowLeft size={18} /> Back to Projects
      </button>

      {!canCreate && (
        <div className="border border-amber-500/30 rounded-2xl p-4 text-sm text-amber-200 section-motion section-motion-delay-1">
          Project creation is available to seniors (2nd year+) and Admin/Head only.
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6 section-motion section-motion-delay-2">
        <div className="border border-gray-800 p-6 md:p-8 rounded-3xl space-y-6 pro-hover-lift">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-xl font-bold flex items-center gap-2"><FolderKanban size={20} className="text-blue-500" /> Project Details</h3>
            {lastSavedAt ? (
              <span className="text-[10px] uppercase tracking-widest text-gray-500">
                Draft saved {new Date(lastSavedAt).toLocaleTimeString()}
              </span>
            ) : null}
          </div>

          <FormField id="project-title" label="Project Title" required error={errors.title}>
            <input
              id="project-title"
              value={formData.title}
              onChange={(e) => updateField('title', e.target.value)}
              placeholder="Enter unique title"
              className="ui-input"
              maxLength={140}
            />
          </FormField>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
            <FormField id="project-lead" label="Project Lead" required error={errors.lead}>
              <select
                id="project-lead"
                value={formData.lead}
                onChange={(e) => updateField('lead', e.target.value)}
                className="ui-input"
              >
                <option value="">Select a lead</option>
                {eligibleUsers.map((u) => (
                  <option key={u._id} value={u._id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </FormField>
          </div>

          <FormField id="project-description" label="Description" required error={errors.description}>
            <textarea
              id="project-description"
              value={formData.description}
              onChange={(e) => updateField('description', e.target.value)}
              rows={4}
              placeholder="What is this project about?"
              className="ui-input resize-none"
            />
          </FormField>
        </div>

        <div className="border border-gray-800 p-6 md:p-8 rounded-3xl space-y-4 pro-hover-lift">
          <h3 className="text-xl font-bold flex items-center gap-2"><Users size={20} className="text-blue-500" /> Assemble Team</h3>
          <p className="text-xs text-gray-500 uppercase tracking-widest">Click members to assign</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-72 overflow-y-auto pr-2 custom-scrollbar">
            {eligibleUsers.map((u) => (
              <div
                key={u._id}
                onClick={() => toggleTeamMember(u._id)}
                className={`flex items-center justify-between p-4 rounded-xl border cursor-pointer transition-all ${
                  formData.team.includes(u._id) ? 'border-blue-600 bg-blue-600/10' : 'border-gray-800 bg-[#0a0a0c]'
                }`}
              >
                <span className="text-sm font-bold">{u.name}</span>
                {formData.team.includes(u._id) && <Check size={18} className="text-blue-500" />}
              </div>
            ))}
          </div>
          {errors.team ? <p className="ui-field-error">{errors.team}</p> : null}
        </div>

        <div className="mobile-sticky-action">
          <button
            type="submit"
            disabled={loading || !canCreate}
            className="w-full btn btn-primary !py-4 !text-sm"
          >
            {loading ? <Loader2 className="animate-spin" size={16} /> : 'Launch Project'}
          </button>
        </div>
      </form>
    </div>
  );
}
