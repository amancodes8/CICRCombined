import { useEffect, useMemo, useState } from 'react';
import {
  Calendar,
  CalendarClock,
  ChevronRight,
  Clock,
  History,
  MapPin,
  Plus,
  Search,
  Users,
  Video,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { fetchMeetings } from '../api';
import PageHeader from '../components/PageHeader';
import { DataEmpty, DataLoading } from '../components/DataState';

const TYPE_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'online', label: 'Online' },
  { id: 'offline', label: 'Offline' },
];

const isSameDay = (left, right) =>
  left.getFullYear() === right.getFullYear() &&
  left.getMonth() === right.getMonth() &&
  left.getDate() === right.getDate();

const parseDate = (value) => {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const formatDate = (value) => {
  const parsed = parseDate(value);
  if (!parsed) return 'TBD';
  return parsed.toLocaleDateString([], {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

const formatTime = (value) => {
  const parsed = parseDate(value);
  if (!parsed) return '--:--';
  return parsed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const getMeetingState = (meeting) => {
  const start = parseDate(meeting.startTime);
  const end = parseDate(meeting.endTime);
  const now = new Date();

  if (!start || !end) {
    return {
      id: 'upcoming',
      label: 'Scheduled',
      className: 'text-cyan-200 border-cyan-500/35 bg-cyan-500/10',
    };
  }

  if (start <= now && end >= now) {
    return {
      id: 'live',
      label: 'Live',
      className: 'text-emerald-200 border-emerald-500/35 bg-emerald-500/10',
    };
  }

  if (start > now) {
    return {
      id: 'upcoming',
      label: 'Upcoming',
      className: 'text-cyan-200 border-cyan-500/35 bg-cyan-500/10',
    };
  }

  return {
    id: 'past',
    label: 'Completed',
    className: 'text-gray-300 border-gray-600/40 bg-gray-700/25',
  };
};

const resolveJoinUrl = (meeting) => {
  const location = String(meeting?.details?.location || '').trim();
  if (!location) return '';
  if (/^https?:\/\//i.test(location)) return location;
  if (meeting?.meetingType === 'Online' && /^[\w.-]+\.[A-Za-z]{2,}/.test(location)) {
    return `https://${location}`;
  }
  return '';
};

export default function Meetings() {
  const [meetings, setMeetings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');

  const profile = JSON.parse(localStorage.getItem('profile') || '{}');
  const user = profile.result || profile;
  const role = String(user.role || '').toLowerCase();
  const isAdminOrHead = role === 'admin' || role === 'head';
  const year = Number(user.year);
  const isSenior = Number.isFinite(year) && year >= 2;
  const canSchedule = isAdminOrHead || isSenior;

  useEffect(() => {
    const loadMeetings = async () => {
      setLoading(true);
      try {
        const response = await fetchMeetings();
        setMeetings(Array.isArray(response?.data) ? response.data : []);
      } catch (error) {
        console.error('Error fetching meetings:', error);
      } finally {
        setLoading(false);
      }
    };

    loadMeetings();
  }, []);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();

    return [...meetings]
      .filter((meeting) => {
        const typeNormalized = String(meeting.meetingType || '').toLowerCase();
        const matchesType = typeFilter === 'all' || typeNormalized === typeFilter;

        if (!matchesType) return false;
        if (!normalized) return true;

        return [meeting.title, meeting.details?.topic, meeting.details?.location]
          .map((value) => String(value || '').toLowerCase())
          .some((value) => value.includes(normalized));
      })
      .sort((a, b) => {
        const aMs = parseDate(a.startTime)?.getTime() || 0;
        const bMs = parseDate(b.startTime)?.getTime() || 0;
        return aMs - bMs;
      });
  }, [meetings, query, typeFilter]);

  const grouped = useMemo(() => {
    const now = new Date();
    const today = [];
    const upcoming = [];
    const past = [];

    for (const meeting of filtered) {
      const start = parseDate(meeting.startTime);
      if (!start) {
        upcoming.push(meeting);
        continue;
      }

      if (isSameDay(start, now)) {
        today.push(meeting);
        continue;
      }

      if (start > now) {
        upcoming.push(meeting);
      } else {
        past.push(meeting);
      }
    }

    return { today, upcoming, past };
  }, [filtered]);

  const summary = useMemo(() => {
    const now = new Date();
    const liveCount = meetings.filter((meeting) => {
      const start = parseDate(meeting.startTime);
      const end = parseDate(meeting.endTime);
      return start && end ? start <= now && end >= now : false;
    }).length;

    return {
      total: meetings.length,
      today: grouped.today.length,
      live: liveCount,
      upcoming: grouped.upcoming.length,
    };
  }, [meetings, grouped.today.length, grouped.upcoming.length]);

  if (loading) {
    return (
      <div className="h-96 flex items-center justify-center">
        <DataLoading label="Loading meetings..." />
      </div>
    );
  }

  return (
    <div className="ui-page space-y-8 page-motion-b pb-16">
      <header className="section-motion section-motion-delay-1">
        <PageHeader
          eyebrow="Meeting Operations"
          title="Meetings"
          subtitle="Timeline-first coordination for calls, standups, and review sessions."
          icon={Calendar}
          actions={
            canSchedule ? (
              <Link to="/schedule" className="btn btn-primary">
                <Plus size={14} /> Schedule New
              </Link>
            ) : null
          }
        />
      </header>

      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 section-motion section-motion-delay-2">
        <Metric label="Total" value={summary.total} hint="Visible meetings" />
        <Metric label="Today" value={summary.today} hint="Current day agenda" tone="blue" />
        <Metric label="Live" value={summary.live} hint="In-progress right now" tone="emerald" />
        <Metric label="Upcoming" value={summary.upcoming} hint="Future sessions" tone="amber" />
      </section>

      <section className="section-motion section-motion-delay-2">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative w-full lg:max-w-md">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="ui-input pl-9"
              placeholder="Search title, topic, location"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {TYPE_FILTERS.map((filter) => (
              <button
                key={filter.id}
                type="button"
                onClick={() => setTypeFilter(filter.id)}
                className={`btn !w-auto !px-3 !py-2 ${
                  typeFilter === filter.id ? 'btn-primary' : 'btn-ghost'
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="space-y-6 section-motion section-motion-delay-3">
        <MeetingSection
          icon={CalendarClock}
          title="Today"
          subtitle="Sessions scheduled for the current day."
          rows={grouped.today}
        />

        <MeetingSection
          icon={Clock}
          title="Upcoming"
          subtitle="Planned sessions in future dates."
          rows={grouped.upcoming}
        />

        <MeetingSection
          icon={History}
          title="Past"
          subtitle="Recent completed meetings and records."
          rows={grouped.past}
          muted
        />
      </section>
    </div>
  );
}

function MeetingSection({ icon: Icon, title, subtitle, rows, muted = false }) {
  return (
    <article className={muted ? 'opacity-80' : ''}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-white inline-flex items-center gap-2">
            <Icon size={16} className="text-cyan-300" />
            {title}
          </h2>
          <p className="text-sm text-gray-500 mt-1">{subtitle}</p>
        </div>
        <span className="text-xs text-gray-500 uppercase tracking-wider">{rows.length} items</span>
      </div>

      <div className="mt-3 border border-gray-800/80 rounded-2xl overflow-hidden">
        {rows.length === 0 ? (
          <div className="p-4">
            <DataEmpty label={`No ${title.toLowerCase()} meetings found.`} />
          </div>
        ) : (
          <div className="divide-y divide-gray-800/70">
            {rows.map((meeting, index) => (
              <MeetingRow key={meeting._id || `${meeting.title}-${index}`} meeting={meeting} />
            ))}
          </div>
        )}
      </div>
    </article>
  );
}

function MeetingRow({ meeting }) {
  const state = getMeetingState(meeting);
  const joinUrl = resolveJoinUrl(meeting);
  const startDate = formatDate(meeting.startTime);
  const startTime = formatTime(meeting.startTime);
  const endTime = formatTime(meeting.endTime);
  const participantCount = Array.isArray(meeting.participants) ? meeting.participants.length : 0;

  return (
    <div className="px-4 py-4 grid grid-cols-1 lg:grid-cols-[210px_minmax(0,1fr)_auto] gap-4 pro-row-glide">
      <div>
        <p className="text-sm font-semibold text-gray-100">{startDate}</p>
        <p className="text-xs text-gray-500 mt-1">{startTime} - {endTime}</p>
        <span className={`mt-2 inline-flex items-center text-[11px] px-2 py-0.5 rounded-full border ${state.className}`}>
          {state.label}
        </span>
      </div>

      <div className="min-w-0">
        <p className="text-base font-semibold text-white truncate">{meeting.title || 'Untitled meeting'}</p>
        <p className="text-sm text-gray-400 mt-1">{meeting.details?.topic || 'No topic provided'}</p>

        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500">
          <span className="inline-flex items-center gap-1">
            {meeting.meetingType === 'Online' ? (
              <Video size={13} className="text-cyan-300" />
            ) : (
              <MapPin size={13} className="text-amber-300" />
            )}
            {meeting.meetingType || 'Session'}
          </span>
          <span className="inline-flex items-center gap-1">
            <Users size={13} className="text-gray-400" /> {participantCount} participants
          </span>
          <span className="truncate max-w-[250px] inline-flex items-center gap-1">
            <MapPin size={13} className="text-gray-400" />
            {meeting.details?.location || 'Location not specified'}
          </span>
        </div>
      </div>

      <div className="flex flex-wrap lg:justify-end items-start gap-2">
        {joinUrl ? (
          <a
            href={joinUrl}
            target="_blank"
            rel="noreferrer"
            className="btn btn-primary !w-auto !px-3 !py-2"
          >
            Join <ChevronRight size={13} />
          </a>
        ) : null}
      </div>
    </div>
  );
}

function Metric({ label, value, hint, tone = 'slate' }) {
  const toneClass =
    tone === 'emerald'
      ? 'border-emerald-500/30'
      : tone === 'blue'
      ? 'border-blue-500/30'
      : tone === 'amber'
      ? 'border-amber-500/30'
      : 'border-gray-700/70';

  return (
    <article className={`px-3 py-3 border-y ${toneClass}`}>
      <p className="text-[11px] uppercase tracking-[0.14em] text-gray-500 font-semibold">{label}</p>
      <p className="mt-1 text-2xl font-black text-white">{value}</p>
      <p className="mt-1 text-xs text-gray-500">{hint}</p>
    </article>
  );
}
