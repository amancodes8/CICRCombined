import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { CalendarDays, CheckCircle2, Clock4, MapPin, Plus, ShieldCheck, Sparkles, Trash2, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createEvent, deleteEvent, fetchEvents, updateEvent } from '../api';

const EVENT_TYPES = ['Orientation', 'Workshop', 'Recruitment', 'Competition', 'Seminar', 'Internal'];

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
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    title: '',
    type: 'Internal',
    location: '',
    startTime: '',
    endTime: '',
    description: '',
    allowApplications: false,
    applicationDeadline: '',
  });

  const profile = JSON.parse(localStorage.getItem('profile') || '{}');
  const user = profile.result || profile;
  const role = String(user.role || '').toLowerCase();
  const isAdminOrHead = role === 'admin' || role === 'head';

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

  const openEvents = useMemo(
    () => events.filter((event) => event.status === 'Scheduled'),
    [events]
  );

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!isAdminOrHead) return;
    setCreating(true);
    try {
      const payload = {
        ...form,
        applicationDeadline: form.applicationDeadline || null,
        allowApplications: !!form.allowApplications,
      };
      const { data } = await createEvent(payload);
      setEvents((prev) => [data, ...prev]);
      setForm({
        title: '',
        type: 'Internal',
        location: '',
        startTime: '',
        endTime: '',
        description: '',
        allowApplications: false,
        applicationDeadline: '',
      });
      dispatchToast('Event created.', 'success');
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
    if (!window.confirm('Delete this event?')) return;
    try {
      await deleteEvent(eventId);
      setEvents((prev) => prev.filter((item) => item._id !== eventId));
      dispatchToast('Event removed.', 'success');
    } catch (err) {
      dispatchToast(err.response?.data?.message || 'Failed to delete event.', 'error');
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-16 page-motion-b">
      <motion.header
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45 }}
        className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 section-motion section-motion-delay-1"
      >
        <div>
          <p className="text-[10px] uppercase tracking-[0.3em] text-blue-400 font-black">CICR Events</p>
          <h2 className="text-3xl md:text-4xl font-black text-white mt-2">Events & Recruitment Drives</h2>
          <p className="text-gray-500 mt-2 text-sm max-w-2xl">
            Track workshops, orientation sessions, and recruitment pipelines. Open events can host applications from new members.
          </p>
        </div>
        <div className="inline-flex items-center gap-2 text-xs text-gray-400 border border-gray-800 rounded-xl px-3 py-2">
          <Sparkles size={14} className="text-blue-400" /> {openEvents.length} active events
        </div>
      </motion.header>

      {isAdminOrHead && (
        <motion.form
          onSubmit={handleCreate}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.05 }}
          className="border border-gray-800 rounded-[2rem] p-6 md:p-8 space-y-4 section-motion section-motion-delay-2"
        >
          <div className="flex items-center gap-2 text-xs text-gray-400 uppercase tracking-[0.22em] font-black">
            <Plus size={14} /> Create Event
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input
              value={form.title}
              onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
              placeholder="Event title"
              className="w-full border border-gray-800 rounded-xl px-3 py-2.5 bg-[#0b0e13]/60 text-sm text-white outline-none focus:border-blue-500"
              required
            />
            <select
              value={form.type}
              onChange={(e) => setForm((prev) => ({ ...prev, type: e.target.value }))}
              className="w-full border border-gray-800 rounded-xl px-3 py-2.5 bg-[#0b0e13]/60 text-sm text-white outline-none focus:border-blue-500"
            >
              {EVENT_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
            <input
              value={form.location}
              onChange={(e) => setForm((prev) => ({ ...prev, location: e.target.value }))}
              placeholder="Location or link"
              className="w-full border border-gray-800 rounded-xl px-3 py-2.5 bg-[#0b0e13]/60 text-sm text-white outline-none focus:border-blue-500"
              required
            />
            <input
              type="datetime-local"
              value={form.startTime}
              onChange={(e) => setForm((prev) => ({ ...prev, startTime: e.target.value }))}
              className="w-full border border-gray-800 rounded-xl px-3 py-2.5 bg-[#0b0e13]/60 text-sm text-white outline-none focus:border-blue-500"
              required
            />
            <input
              type="datetime-local"
              value={form.endTime}
              onChange={(e) => setForm((prev) => ({ ...prev, endTime: e.target.value }))}
              className="w-full border border-gray-800 rounded-xl px-3 py-2.5 bg-[#0b0e13]/60 text-sm text-white outline-none focus:border-blue-500"
              required
            />
            <div className="flex items-center gap-2 border border-gray-800 rounded-xl px-3 py-2.5 bg-[#0b0e13]/60">
              <input
                type="checkbox"
                checked={form.allowApplications}
                onChange={(e) => setForm((prev) => ({ ...prev, allowApplications: e.target.checked }))}
              />
              <span className="text-xs text-gray-300">Allow applications</span>
            </div>
            <input
              type="date"
              value={form.applicationDeadline}
              onChange={(e) => setForm((prev) => ({ ...prev, applicationDeadline: e.target.value }))}
              className="w-full border border-gray-800 rounded-xl px-3 py-2.5 bg-[#0b0e13]/60 text-xs text-gray-300 outline-none focus:border-blue-500"
              placeholder="Application deadline"
            />
          </div>
          <textarea
            value={form.description}
            onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
            placeholder="Event description"
            rows={3}
            className="w-full border border-gray-800 rounded-xl px-3 py-2.5 bg-[#0b0e13]/60 text-sm text-white outline-none focus:border-blue-500"
          />
          <button
            type="submit"
            disabled={creating}
            className="inline-flex items-center gap-2 border border-blue-500/40 text-blue-100 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-[0.16em] hover:bg-blue-500/10 disabled:opacity-60"
          >
            {creating ? 'Saving...' : 'Create Event'}
          </button>
        </motion.form>
      )}

      {loading ? (
        <div className="h-64 flex items-center justify-center text-gray-500">Loading events...</div>
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
                {event.allowApplications && (
                  <div className="flex items-center gap-2">
                    <Users size={12} className="text-purple-400" /> Applications open until {fmtDate(event.applicationDeadline)}
                  </div>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                {event.allowApplications && (
                  <Link
                    to={`/apply${event._id ? `?event=${event._id}` : ''}`}
                    className="text-[10px] uppercase tracking-widest border border-emerald-500/40 text-emerald-200 px-3 py-1.5 rounded-lg"
                  >
                    Apply
                  </Link>
                )}

                {isAdminOrHead && event.status === 'Scheduled' && (
                  <button
                    onClick={() => handleStatusUpdate(event._id, 'Completed')}
                    className="text-[10px] uppercase tracking-widest border border-emerald-500/40 text-emerald-200 px-3 py-1.5 rounded-lg inline-flex items-center gap-1"
                  >
                    <CheckCircle2 size={12} /> Complete
                  </button>
                )}
                {isAdminOrHead && (
                  <button
                    onClick={() => handleStatusUpdate(event._id, 'Cancelled')}
                    className="text-[10px] uppercase tracking-widest border border-rose-500/40 text-rose-200 px-3 py-1.5 rounded-lg"
                  >
                    Cancel
                  </button>
                )}
                {isAdminOrHead && (
                  <button
                    onClick={() => handleDelete(event._id)}
                    className="text-[10px] uppercase tracking-widest border border-gray-700 text-gray-300 px-3 py-1.5 rounded-lg inline-flex items-center gap-1"
                  >
                    <Trash2 size={12} /> Delete
                  </button>
                )}
              </div>
            </motion.article>
          ))}
        </div>
      )}

      {!loading && events.length === 0 && (
        <div className="border border-dashed border-gray-800 rounded-[2rem] p-10 text-center text-gray-500 section-motion section-motion-delay-3">
          No events created yet.
        </div>
      )}
    </div>
  );
}
