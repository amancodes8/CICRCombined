import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useSearchParams } from 'react-router-dom';
import { CheckCircle2, ClipboardCheck, Loader2 } from 'lucide-react';
import { createApplication, fetchEvents } from '../api';

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

  const [form, setForm] = useState({
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
    eventId: eventParam,
    website: '',
  });

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

  const selectedEvent = useMemo(
    () => events.find((event) => String(event._id) === String(form.eventId)),
    [events, form.eventId]
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
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
      dispatchToast('Application submitted successfully.', 'success');
    } catch (err) {
      dispatchToast(err.response?.data?.message || 'Unable to submit application.', 'error');
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
          className="border border-gray-800 rounded-[2rem] p-10 max-w-lg text-center pro-hover-lift"
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
        </motion.header>

        <motion.form
          onSubmit={handleSubmit}
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.05 }}
          className="border border-gray-800 rounded-[2rem] p-6 md:p-8 space-y-5"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input
              required
              value={form.fullName}
              onChange={(e) => setForm((prev) => ({ ...prev, fullName: e.target.value }))}
              placeholder="Full name"
              className="w-full border border-gray-800 rounded-xl px-4 py-3 bg-[#0b0e13]/70 text-white text-sm outline-none focus:border-blue-500"
            />
            <input
              required
              type="email"
              value={form.email}
              onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
              placeholder="Email"
              className="w-full border border-gray-800 rounded-xl px-4 py-3 bg-[#0b0e13]/70 text-white text-sm outline-none focus:border-blue-500"
            />
            <input
              required
              value={form.phone}
              onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
              placeholder="Phone"
              className="w-full border border-gray-800 rounded-xl px-4 py-3 bg-[#0b0e13]/70 text-white text-sm outline-none focus:border-blue-500"
            />
            <input
              value={form.year}
              onChange={(e) => setForm((prev) => ({ ...prev, year: e.target.value }))}
              placeholder="Year (e.g. 1)"
              className="w-full border border-gray-800 rounded-xl px-4 py-3 bg-[#0b0e13]/70 text-white text-sm outline-none focus:border-blue-500"
            />
            <input
              value={form.branch}
              onChange={(e) => setForm((prev) => ({ ...prev, branch: e.target.value }))}
              placeholder="Branch"
              className="w-full border border-gray-800 rounded-xl px-4 py-3 bg-[#0b0e13]/70 text-white text-sm outline-none focus:border-blue-500"
            />
            <input
              value={form.college}
              onChange={(e) => setForm((prev) => ({ ...prev, college: e.target.value }))}
              placeholder="College"
              className="w-full border border-gray-800 rounded-xl px-4 py-3 bg-[#0b0e13]/70 text-white text-sm outline-none focus:border-blue-500"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input
              value={form.linkedin}
              onChange={(e) => setForm((prev) => ({ ...prev, linkedin: e.target.value }))}
              placeholder="LinkedIn profile"
              className="w-full border border-gray-800 rounded-xl px-4 py-3 bg-[#0b0e13]/70 text-white text-sm outline-none focus:border-blue-500"
            />
            <input
              value={form.github}
              onChange={(e) => setForm((prev) => ({ ...prev, github: e.target.value }))}
              placeholder="GitHub profile"
              className="w-full border border-gray-800 rounded-xl px-4 py-3 bg-[#0b0e13]/70 text-white text-sm outline-none focus:border-blue-500"
            />
            <input
              value={form.portfolio}
              onChange={(e) => setForm((prev) => ({ ...prev, portfolio: e.target.value }))}
              placeholder="Portfolio / Website"
              className="w-full border border-gray-800 rounded-xl px-4 py-3 bg-[#0b0e13]/70 text-white text-sm outline-none focus:border-blue-500"
            />
            <select
              value={form.eventId}
              onChange={(e) => setForm((prev) => ({ ...prev, eventId: e.target.value }))}
              className="w-full border border-gray-800 rounded-xl px-4 py-3 bg-[#0b0e13]/70 text-white text-sm outline-none focus:border-blue-500"
            >
              <option value="">Select event (optional)</option>
              {events.map((event) => (
                <option key={event._id} value={event._id}>
                  {event.title}
                </option>
              ))}
            </select>
          </div>

          <textarea
            required
            value={form.motivation}
            onChange={(e) => setForm((prev) => ({ ...prev, motivation: e.target.value }))}
            placeholder="Why do you want to join CICR?"
            rows={4}
            className="w-full border border-gray-800 rounded-xl px-4 py-3 bg-[#0b0e13]/70 text-white text-sm outline-none focus:border-blue-500"
          />
          <textarea
            value={form.experience}
            onChange={(e) => setForm((prev) => ({ ...prev, experience: e.target.value }))}
            placeholder="Relevant experience or projects (optional)"
            rows={3}
            className="w-full border border-gray-800 rounded-xl px-4 py-3 bg-[#0b0e13]/70 text-white text-sm outline-none focus:border-blue-500"
          />
          <textarea
            value={form.interests}
            onChange={(e) => setForm((prev) => ({ ...prev, interests: e.target.value }))}
            placeholder="Areas of interest (comma separated)"
            rows={2}
            className="w-full border border-gray-800 rounded-xl px-4 py-3 bg-[#0b0e13]/70 text-white text-sm outline-none focus:border-blue-500"
          />
          <input
            value={form.availability}
            onChange={(e) => setForm((prev) => ({ ...prev, availability: e.target.value }))}
            placeholder="Availability / time commitment"
            className="w-full border border-gray-800 rounded-xl px-4 py-3 bg-[#0b0e13]/70 text-white text-sm outline-none focus:border-blue-500"
          />

          <input
            value={form.website}
            onChange={(e) => setForm((prev) => ({ ...prev, website: e.target.value }))}
            className="hidden"
            tabIndex={-1}
            autoComplete="off"
          />

          <div className="mobile-sticky-action">
            <button
              type="submit"
              disabled={submitting}
              className="btn btn-primary !px-5 !py-3"
            >
              {submitting ? <Loader2 size={14} className="animate-spin" /> : null}
              Submit Application
            </button>
          </div>
        </motion.form>

        {loading && (
          <div className="text-xs text-gray-500">Loading events...</div>
        )}
        {!loading && selectedEvent && (
          <div className="text-xs text-gray-400">
            Applying for: <span className="text-gray-200">{selectedEvent.title}</span>
          </div>
        )}
      </div>
    </div>
  );
}
