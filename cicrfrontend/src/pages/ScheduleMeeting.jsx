import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Calendar as CalendarIcon, Check, Loader2, MapPin, Users as UsersIcon, Video } from 'lucide-react';
import { fetchDirectoryMembers, scheduleMeeting } from '../api';
import FormField from '../components/FormField';
import useDraftForm from '../hooks/useDraftForm';
import useUnsavedChangesWarning from '../hooks/useUnsavedChangesWarning';

const INITIAL_FORM = {
  title: '',
  meetingType: 'Online',
  topic: '',
  location: '',
  startTime: '',
  endTime: '',
  participants: [],
};

const dispatchToast = (message, type = 'info') => {
  try {
    window.dispatchEvent(new CustomEvent('app:toast', { detail: { message, type } }));
  } catch {
    window.alert(message);
  }
};

export default function ScheduleMeeting() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  const profile = JSON.parse(localStorage.getItem('profile') || '{}');
  const userData = profile.result || profile;
  const role = String(userData.role || '').toLowerCase();
  const isAdminOrHead = role === 'admin' || role === 'head';
  const userYear = Number(userData.year);
  const isSenior = Number.isFinite(userYear) && userYear >= 2;
  const canSchedule = isAdminOrHead || isSenior;

  const { values: formData, setValues: setFormData, isDirty, lastSavedAt, resetForm } = useDraftForm({
    storageKey: `draft_schedule_meeting_${String(userData._id || userData.collegeId || 'member')}`,
    initialValues: INITIAL_FORM,
  });
  useUnsavedChangesWarning(isDirty);

  useEffect(() => {
    const loadUsers = async () => {
      try {
        const { data } = await fetchDirectoryMembers();
        setUsers(Array.isArray(data) ? data : []);
      } catch {
        setUsers([]);
      }
    };
    loadUsers();
  }, []);

  useEffect(() => {
    if (searchParams.get('quick') === 'create') {
      document.getElementById('meeting-title')?.focus();
    }
  }, [searchParams]);

  const eligibleUsers = useMemo(
    () =>
      isAdminOrHead
        ? users
        : users.filter((u) => {
            const yr = Number(u.year);
            if (!Number.isFinite(yr)) return false;
            return Number.isFinite(userYear) && yr <= userYear;
          }),
    [isAdminOrHead, users, userYear]
  );

  const updateField = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: '' }));
  };

  const toggleParticipant = (userId) => {
    setFormData((prev) => ({
      ...prev,
      participants: prev.participants.includes(userId)
        ? prev.participants.filter((id) => id !== userId)
        : [...prev.participants, userId],
    }));
    if (errors.participants) setErrors((prev) => ({ ...prev, participants: '' }));
  };

  const validate = () => {
    const next = {};
    if (String(formData.title || '').trim().length < 4) next.title = 'Title must be at least 4 characters.';
    if (String(formData.topic || '').trim().length < 3) next.topic = 'Topic is required.';
    if (String(formData.location || '').trim().length < 3) next.location = 'Meeting location or link is required.';
    if (!formData.startTime) next.startTime = 'Start date/time is required.';
    if (!formData.endTime) next.endTime = 'End date/time is required.';
    if (formData.startTime && formData.endTime && new Date(formData.endTime) <= new Date(formData.startTime)) {
      next.endTime = 'End time must be after start time.';
    }
    if (!Array.isArray(formData.participants) || formData.participants.length === 0) {
      next.participants = 'Select at least one participant.';
    }
    return next;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSchedule) {
      dispatchToast('Only seniors (2nd year+) can schedule meetings.', 'error');
      return;
    }

    const nextErrors = validate();
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setLoading(true);
    try {
      const payload = {
        ...formData,
        details: { topic: formData.topic, location: formData.location },
      };
      await scheduleMeeting(payload);
      dispatchToast('Meeting scheduled successfully.', 'success');
      resetForm(INITIAL_FORM);
      navigate('/meetings');
    } catch (err) {
      dispatchToast(err.response?.data?.message || 'Failed to schedule meeting.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="ui-page max-w-5xl mx-auto pb-20 px-4 page-motion-d">
      <div className="flex items-center justify-between mb-10 section-motion section-motion-delay-1">
        <button
          onClick={() => navigate('/meetings')}
          className="group flex items-center gap-2 text-gray-400 hover:text-white transition-all px-4 py-2 rounded-full border border-gray-800"
        >
          <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
          <span className="text-sm font-medium">Back</span>
        </button>

        <div className="text-right">
          <h2 className="text-3xl font-black tracking-tight text-white">Schedule Meeting</h2>
          <p className="text-gray-500 text-sm">Structured planning with autosaved drafts and validation.</p>
        </div>
      </div>

      {!canSchedule && (
        <div className="border border-amber-500/30 rounded-2xl p-4 text-sm text-amber-200 mb-6 section-motion section-motion-delay-1">
          Scheduling meetings is available to seniors (2nd year+) and Admin/Head only.
        </div>
      )}

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-8 section-motion section-motion-delay-2">
        <div className="lg:col-span-2 space-y-6">
          <section className="border border-gray-800 p-6 md:p-8 rounded-[2rem] space-y-5 pro-hover-lift">
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-bold text-lg inline-flex items-center gap-2"><CalendarIcon size={18} className="text-blue-400" /> Meeting Details</h3>
              {lastSavedAt ? (
                <span className="text-[10px] uppercase tracking-widest text-gray-500">
                  Draft saved {new Date(lastSavedAt).toLocaleTimeString()}
                </span>
              ) : null}
            </div>

            <FormField id="meeting-title" label="Event Title" required error={errors.title}>
              <input
                id="meeting-title"
                value={formData.title}
                onChange={(e) => updateField('title', e.target.value)}
                className="ui-input"
                placeholder="What is this meeting about?"
                maxLength={140}
              />
            </FormField>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField id="meeting-type" label="Meeting Type" required>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => updateField('meetingType', 'Online')}
                    className={`btn ${formData.meetingType === 'Online' ? 'btn-primary' : 'btn-ghost'}`}
                  >
                    <Video size={14} /> Online
                  </button>
                  <button
                    type="button"
                    onClick={() => updateField('meetingType', 'Offline')}
                    className={`btn ${formData.meetingType === 'Offline' ? 'btn-primary' : 'btn-ghost'}`}
                  >
                    <MapPin size={14} /> Offline
                  </button>
                </div>
              </FormField>

              <FormField id="meeting-topic" label="Topic" required error={errors.topic}>
                <input
                  id="meeting-topic"
                  value={formData.topic}
                  onChange={(e) => updateField('topic', e.target.value)}
                  className="ui-input"
                  placeholder="Core agenda topic"
                />
              </FormField>
            </div>

            <FormField
              id="meeting-location"
              label={formData.meetingType === 'Online' ? 'Meeting Link' : 'Venue / Room'}
              required
              error={errors.location}
            >
              <input
                id="meeting-location"
                value={formData.location}
                onChange={(e) => updateField('location', e.target.value)}
                className="ui-input"
                placeholder={formData.meetingType === 'Online' ? 'https://meet.google.com/...' : 'Room / Hall name'}
              />
            </FormField>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField id="meeting-start" label="Starts" required error={errors.startTime}>
                <input
                  id="meeting-start"
                  type="datetime-local"
                  value={formData.startTime}
                  onChange={(e) => updateField('startTime', e.target.value)}
                  className="ui-input [color-scheme:dark]"
                />
              </FormField>
              <FormField id="meeting-end" label="Ends" required error={errors.endTime}>
                <input
                  id="meeting-end"
                  type="datetime-local"
                  value={formData.endTime}
                  onChange={(e) => updateField('endTime', e.target.value)}
                  className="ui-input [color-scheme:dark]"
                />
              </FormField>
            </div>
          </section>
        </div>

        <div className="lg:col-span-1">
          <section className="border border-gray-800 p-5 rounded-[1.6rem] h-full flex flex-col pro-hover-lift">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-lg flex items-center gap-2">
                <UsersIcon className="text-blue-500" size={18} /> Participants
              </h3>
              <span className="text-[10px] uppercase tracking-widest text-blue-300">{formData.participants.length} selected</span>
            </div>
            <div className="flex-1 space-y-2.5 overflow-y-auto pr-2 custom-scrollbar" style={{ maxHeight: '480px' }}>
              {eligibleUsers.map((u) => (
                <div
                  key={u._id}
                  onClick={() => toggleParticipant(u._id)}
                  className={`group flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${
                    formData.participants.includes(u._id)
                      ? 'border-blue-600 bg-blue-600/10'
                      : 'border-gray-800 bg-[#0a0a0c] hover:border-gray-600'
                  }`}
                >
                  <div>
                    <p className={`text-sm font-bold ${formData.participants.includes(u._id) ? 'text-white' : 'text-gray-400'}`}>{u.name}</p>
                    <p className="text-[10px] text-gray-600 uppercase tracking-widest">{u.role}</p>
                  </div>
                  {formData.participants.includes(u._id) ? <Check size={16} className="text-blue-400" /> : null}
                </div>
              ))}
            </div>
            {errors.participants ? <p className="ui-field-error mt-2">{errors.participants}</p> : null}
          </section>
        </div>

        <div className="lg:col-span-3 mobile-sticky-action">
          <button
            type="submit"
            disabled={loading || !canSchedule}
            className="w-full btn btn-primary !py-4 !text-sm disabled:opacity-60"
          >
            {loading ? <Loader2 className="animate-spin" size={16} /> : 'Confirm Schedule'}
          </button>
        </div>
      </form>
    </div>
  );
}
