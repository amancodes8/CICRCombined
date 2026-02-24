import { useEffect, useState } from 'react';
import { 
  Calendar, Plus, Video, MapPin, 
  Clock, Loader2, ChevronRight, History 
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { fetchMeetings } from '../api';

export default function Meetings() {
  const [meetings, setMeetings] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Get user profile to check role for the "Schedule" button
  const user = JSON.parse(localStorage.getItem('profile') || '{}');

  useEffect(() => {
    const loadMeetings = async () => {
      try {
        const response = await fetchMeetings();
        setMeetings(response.data);
      } catch (error) {
        console.error("Error fetching meetings:", error);
      } finally {
        setLoading(false);
      }
    };
    loadMeetings();
  }, []);

  // Filter meetings into Upcoming and Past categories
  const now = new Date();
  const upcoming = meetings.filter(m => new Date(m.startTime) >= now);
  const past = meetings.filter(m => new Date(m.startTime) < now);

  if (loading) return (
    <div className="h-96 flex items-center justify-center">
      <Loader2 className="animate-spin text-blue-500" size={40} />
    </div>
  );

  return (
    <div className="space-y-10 max-w-6xl mx-auto">
      {/* Header Section */}
      <header className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold">Meetings</h2>
          <p className="text-gray-400 mt-1">Manage your sessions and attendance</p>
        </div>

        {/* ONLY Admin or Head can see the Schedule button */}
        {(user.role === 'Admin' || user.role === 'Head') && (
          <Link 
            to="/schedule" 
            className="bg-blue-600 hover:bg-blue-700 px-6 py-3 rounded-xl flex items-center gap-2 font-bold transition-all shadow-lg shadow-blue-600/20"
          >
            <Plus size={20} /> Schedule New
          </Link>
        )}
      </header>

      {/* Upcoming Meetings */}
      <section className="space-y-4">
        <h3 className="text-xl font-semibold flex items-center gap-2">
          <Clock className="text-blue-500" size={20} /> Upcoming Sessions
        </h3>
        <div className="grid grid-cols-1 gap-4">
          {upcoming.length > 0 ? upcoming.map(m => (
            <MeetingCard key={m._id} meeting={m} isPast={false} />
          )) : (
            <p className="text-gray-500 italic p-6 bg-[#141417] rounded-2xl border border-dashed border-gray-800 text-center">
              No upcoming meetings scheduled.
            </p>
          )}
        </div>
      </section>

      {/* Earlier Meetings */}
      <section className="space-y-4">
        <h3 className="text-xl font-semibold flex items-center gap-2 text-gray-400">
          <History size={20} /> Earlier Meetings
        </h3>
        <div className="grid grid-cols-1 gap-4 opacity-70">
          {past.length > 0 ? past.map(m => (
            <MeetingCard key={m._id} meeting={m} isPast={true} />
          )) : (
            <p className="text-gray-500 text-sm">No past records found.</p>
          )}
        </div>
      </section>
    </div>
  );
}

// Sub-component for the Meeting Card
function MeetingCard({ meeting, isPast }) {
  const date = new Date(meeting.startTime);
  
  return (
    <div className="bg-[#141417] border border-gray-800 p-6 rounded-2xl flex flex-col md:flex-row justify-between items-center hover:border-gray-700 transition-all group">
      <div className="flex items-center gap-6 w-full">
        {/* Date Icon */}
        <div className={`p-4 rounded-xl flex flex-col items-center min-w-[70px] ${isPast ? 'bg-gray-800 text-gray-500' : 'bg-blue-600/10 text-blue-500'}`}>
          <span className="text-sm font-bold uppercase">{date.toLocaleString('default', { month: 'short' })}</span>
          <span className="text-2xl font-black">{date.getDate()}</span>
        </div>

        {/* Info */}
        <div className="flex-1">
          <h4 className={`text-xl font-bold ${isPast ? 'text-gray-400' : 'text-white'}`}>{meeting.title}</h4>
          <div className="flex flex-wrap gap-4 mt-2 text-sm text-gray-500">
            <span className="flex items-center gap-1 font-medium text-gray-400">
              {meeting.meetingType === 'Online' ? <Video size={14} className="text-blue-500" /> : <MapPin size={14} className="text-purple-500" />}
              {meeting.meetingType}
            </span>
            <span className="flex items-center gap-1">
              <Clock size={14} /> {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
            <span className="text-xs bg-gray-800 px-2 py-0.5 rounded border border-gray-700">
              Topic: {meeting.details?.topic}
            </span>
          </div>
        </div>
      </div>
      
      {!isPast && (
        <button className="mt-4 md:mt-0 w-full md:w-auto px-6 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-2 group-hover:bg-blue-600 group-hover:text-white">
          Join Link <ChevronRight size={14} />
        </button>
      )}
    </div>
  );
}