import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useSearchParams } from 'react-router-dom';
import { CheckCircle2, ClipboardCheck, Loader2 } from 'lucide-react';
import { createApplication, fetchEvents } from '../api';
import FormField from '../components/FormField';
import useDraftForm from '../hooks/useDraftForm';
import useUnsavedChangesWarning from '../hooks/useUnsavedChangesWarning';

const INITIAL_FORM = {
  fullName: '',
  email: '',
  phone: '',
  year: '',
  branch: '',
  college: '',
  interests: '',
  motivation: '',
  experience: '',
  availability: '',
  linkedin: '',
  github: '',
  portfolio: '',
  eventId: '',
  website: '',
};

const dispatchToast = (message, type = 'info') => {
  try {
    window.dispatchEvent(new CustomEvent('app:toast', { detail: { message, type } }));
  } catch {
    window.alert(message);
  }
};

export default function Apply() {
  const [searchParams] = useSearchParams();
  const eventParam = searchParams.get('event') || '';

  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errors, setErrors] = useState({});
  const [submitNotice, setSubmitNotice] = useState('');

  const { values: form, setValues: setForm, isDirty, lastSavedAt, resetForm } = useDraftForm({
    storageKey: 'draft_public_apply_form',
    initialValues: { ...INITIAL_FORM, eventId: eventParam },
  });
  useUnsavedChangesWarning(isDirty);

  useEffect(() => {
    const loadEvents = async () => {
      try {
        const { data } = await fetchEvents({ allowApplications: 'true' });
        setEvents(Array.isArray(data) ? data : []);
      } catch {
        setEvents([]);
      } finally {
        setLoading(false);
      }
    };
    loadEvents();
  }, []);

  useEffect(() => {
    if (!eventParam) return;
    setForm((prev) => ({ ...prev, eventId: eventParam }));
  }, [eventParam, setForm]);

  const selectedEvent = useMemo(
    () => events.find((event) => String(event._id) === String(form.eventId)),
    [events, form.eventId]
  );

  const updateField = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: '' }));
    if (submitNotice) setSubmitNotice('');
  };

  const validate = () => {
    const next = {};
    if (String(form.fullName || '').trim().length < 3) next.fullName = 'Enter your full name.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(form.email || '').trim())) next.email = 'Enter a valid email address.';
    if (String(form.phone || '').trim().length < 8) next.phone = 'Enter a valid phone number.';
    if (String(form.motivation || '').trim().length < 20) next.motivation = 'Motivation must be at least 20 characters.';

    const yearNum = Number(form.year);
    if (form.year && (!Number.isFinite(yearNum) || yearNum < 1 || yearNum > 6)) {
      next.year = 'Year must be between 1 and 6.';
    }
    return next;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const nextErrors = validate();
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setSubmitNotice('Please review the highlighted fields before submitting.');
      return;
    }

    setSubmitting(true);
    setSubmitNotice('Submitting your application...');
    try {
      const payload = {
        fullName: form.fullName,
        email: form.email,
        phone: form.phone,
        year: form.year,
        branch: form.branch,
        college: form.college,
        interests: form.interests,
        motivation: form.motivation,
        experience: form.experience,
        availability: form.availability,
        linkedin: form.linkedin,
        github: form.github,
        portfolio: form.portfolio,
        eventId: form.eventId || null,
        website: form.website,
        source: 'public-apply-page',
      };

      await createApplication(payload);
      setSubmitted(true);
      resetForm({ ...INITIAL_FORM, eventId: '' });
      dispatchToast('Application submitted successfully.', 'success');
      setSubmitNotice('Application submitted successfully.');
    } catch (err) {
      dispatchToast(err.response?.data?.message || 'Unable to submit application.', 'error');
      setSubmitNotice('Submission failed. Please retry in a moment.');
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 page-motion-c">
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
          className="border border-gray-800 rounded-4xl p-10 max-w-lg text-center pro-hover-lift"
        >
          <CheckCircle2 size={48} className="text-emerald-400 mx-auto" />
          <h2 className="text-2xl font-black text-white mt-4">Application Received</h2>
          <p className="text-gray-400 mt-2">
            Your details are now with the CICR team. Watch your email for interview or onboarding updates.
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen px-4 py-10 page-motion-a">
      <div className="max-w-4xl mx-auto space-y-8 pro-stagger">
        <motion.header
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
          className="space-y-3"
        >
          <div className="inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.3em] text-blue-400 font-black">
            <ClipboardCheck size={14} /> CICR Application
          </div>
          <h1 className="text-3xl md:text-4xl font-black text-white">Join the CICR Society</h1>
          <p className="text-gray-400 max-w-2xl">
            Submit your profile for the ongoing recruitment drive. The team will review and schedule interviews where needed.
          </p>
          {lastSavedAt ? (
            <p className="text-[10px] uppercase tracking-widest text-gray-500">
              Draft autosaved at {new Date(lastSavedAt).toLocaleTimeString()}
            </p>
          ) : null}
        </motion.header>

        <motion.form
          onSubmit={handleSubmit}
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.05 }}
          className="border border-gray-800 rounded-4xl p-6 md:p-8 space-y-5"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField label="Full Name" required error={errors.fullName}>
              <input
                value={form.fullName}
                onChange={(e) => updateField('fullName', e.target.value)}
                placeholder="Full name"
                className="ui-input"
              />
            </FormField>
            <FormField label="Email" required hint="Use an active email for updates" error={errors.email}>
              <input
                type="email"
                value={form.email}
                onChange={(e) => updateField('email', e.target.value)}
                placeholder="Email"
                className="ui-input"
              />
            </FormField>
            <FormField label="Phone" required hint="Include active contact number" error={errors.phone}>
              <input
                value={form.phone}
                onChange={(e) => updateField('phone', e.target.value)}
                placeholder="Phone"
                className="ui-input"
              />
            </FormField>
            <FormField label="Year" optional error={errors.year}>
              <input
                value={form.year}
                onChange={(e) => updateField('year', e.target.value)}
                placeholder="Year (e.g. 1)"
                className="ui-input"
              />
            </FormField>
            <FormField label="Branch" optional>
              <input
                value={form.branch}
                onChange={(e) => updateField('branch', e.target.value)}
                placeholder="Branch"
                className="ui-input"
              />
            </FormField>
            <FormField label="College" optional>
              <input
                value={form.college}
                onChange={(e) => updateField('college', e.target.value)}
                placeholder="College"
                className="ui-input"
              />
            </FormField>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField label="LinkedIn" optional>
              <input
                value={form.linkedin}
                onChange={(e) => updateField('linkedin', e.target.value)}
                placeholder="LinkedIn profile"
                className="ui-input"
              />
            </FormField>
            <FormField label="GitHub" optional>
              <input
                value={form.github}
                onChange={(e) => updateField('github', e.target.value)}
                placeholder="GitHub profile"
                className="ui-input"
              />
            </FormField>
            <FormField label="Portfolio" optional>
              <input
                value={form.portfolio}
                onChange={(e) => updateField('portfolio', e.target.value)}
                placeholder="Portfolio / Website"
                className="ui-input"
              />
            </FormField>
            <FormField label="Event Selection" optional>
              <select
                value={form.eventId}
                onChange={(e) => updateField('eventId', e.target.value)}
                className="ui-input"
              >
                <option value="">Select event (optional)</option>
                {events.map((event) => (
                  <option key={event._id} value={event._id}>
                    {event.title}
                  </option>
                ))}
              </select>
            </FormField>
          </div>

          <FormField label="Motivation" required hint="Minimum 20 characters" error={errors.motivation}>
            <textarea
              value={form.motivation}
              onChange={(e) => updateField('motivation', e.target.value)}
              placeholder="Why do you want to join CICR?"
              rows={4}
              className="ui-input resize-none"
            />
          </FormField>
          <FormField label="Experience" optional>
            <textarea
              value={form.experience}
              onChange={(e) => updateField('experience', e.target.value)}
              placeholder="Relevant experience or projects"
              rows={3}
              className="ui-input resize-none"
            />
          </FormField>
          <FormField label="Areas of Interest" optional>
            <textarea
              value={form.interests}
              onChange={(e) => updateField('interests', e.target.value)}
              placeholder="Areas of interest (comma separated)"
              rows={2}
              className="ui-input resize-none"
            />
          </FormField>
          <FormField label="Availability" optional>
            <input
              value={form.availability}
              onChange={(e) => updateField('availability', e.target.value)}
              placeholder="Availability / time commitment"
              className="ui-input"
            />
          </FormField>

          <input
            value={form.website}
            onChange={(e) => updateField('website', e.target.value)}
            className="hidden"
            tabIndex={-1}
            autoComplete="off"
          />

          <div className="mobile-sticky-action">
            <button type="submit" disabled={submitting} className="btn btn-primary px-5! py-3!">
              {submitting ? <Loader2 size={14} className="animate-spin" /> : null}
              Submit Application
            </button>
            {submitNotice ? <p className="mt-2 text-xs text-gray-300">{submitNotice}</p> : null}
          </div>
        </motion.form>

        {loading ? <div className="text-xs text-gray-500">Loading events...</div> : null}
        {!loading && selectedEvent ? (
          <div className="text-xs text-gray-400">
            Applying for: <span className="text-gray-200">{selectedEvent.title}</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}
