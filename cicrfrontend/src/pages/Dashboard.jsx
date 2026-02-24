import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Activity,
  CalendarDays,
  Clock3,
  FolderKanban,
  Loader2,
  MessageSquareText,
  Mail,
  Phone,
  IdCard,
  Sparkles,
  Users,
} from 'lucide-react';
import { fetchMeetings, fetchMyInsights, fetchPosts, fetchProjects } from '../api';

const fmtDate = (d) => new Date(d).toLocaleDateString();
const fmtTime = (d) => new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

const Stat = ({ label, value }) => (
  <div className="bg-[#141417] border border-gray-800 rounded-3xl p-6">
    <p className="text-[10px] uppercase tracking-[0.2em] text-gray-500 font-black">{label}</p>
    <p className="text-4xl font-black text-white mt-2">{value}</p>
  </div>
);

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [posts, setPosts] = useState([]);
  const [projects, setProjects] = useState([]);
  const [meetings, setMeetings] = useState([]);
  const [insights, setInsights] = useState(null);

  const recentRef = useRef(null);
  const meetingsRef = useRef(null);
  const projectsRef = useRef(null);
  const discussionsRef = useRef(null);

  useEffect(() => {
    const load = async () => {
      try {
        const [postRes, projectRes, meetingRes, insightRes] = await Promise.all([
          fetchPosts().catch(() => ({ data: [] })),
          fetchProjects().catch(() => ({ data: [] })),
          fetchMeetings().catch(() => ({ data: [] })),
          fetchMyInsights().catch(() => ({ data: null })),
        ]);
        setPosts(Array.isArray(postRes.data) ? postRes.data : []);
        setProjects(Array.isArray(projectRes.data) ? projectRes.data : []);
        setMeetings(Array.isArray(meetingRes.data) ? meetingRes.data : []);
        setInsights(insightRes.data);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const recentPosts = useMemo(() => posts.slice(0, 4), [posts]);
  const metrics = insights?.metrics;
  const member = insights?.member;

  const scrollTo = (ref) => ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  if (loading) {
    return (
      <div className="h-[80vh] flex flex-col items-center justify-center gap-4">
        <Loader2 className="animate-spin text-blue-500" size={42} />
        <p className="text-xs text-gray-500 uppercase tracking-widest font-black">Loading Dashboard</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto pb-16 space-y-8">
      <section className="bg-[#141417] p-6 md:p-10 relative overflow-hidden">
        <div className="absolute -top-16 right-0 w-72 h-72 bg-blue-600/10 blur-[100px] rounded-full" />
        <div className="relative flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
          <div>
            <p className="text-[10px] uppercase tracking-[0.3em] text-blue-400 font-black">CICR Dashboard</p>
            <h2 className="text-4xl md:text-4xl font-black text-white mt-2 tracking-tight">Recent Activities</h2>
            <p className="text-gray-400 mt-3 text-sm md:text-base">Events, meetings, projects and discussions on one page.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => scrollTo(recentRef)} className="px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-black uppercase tracking-widest">Recent</button>
            <button onClick={() => scrollTo(meetingsRef)} className="px-4 py-2 rounded-xl border border-gray-700 text-gray-300 text-xs font-black uppercase tracking-widest">Meetings</button>
            <button onClick={() => scrollTo(projectsRef)} className="px-4 py-2 rounded-xl border border-gray-700 text-gray-300 text-xs font-black uppercase tracking-widest">Projects</button>
            <button onClick={() => scrollTo(discussionsRef)} className="px-4 py-2 rounded-xl border border-gray-700 text-gray-300 text-xs font-black uppercase tracking-widest">Discussions</button>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
        <Stat label="Projects Involved" value={metrics?.totalProjectContributions || projects.length} />
        <Stat label="Meetings & Events" value={metrics?.totalEvents || meetings.length} />
        <Stat label="Discussions" value={posts.length} />
        <Stat label="Years In CICR" value={insights?.member?.yearsInCICR ?? 0} />
      </section>

      {member && (
        <section className="border-b-white border-b-1  p-6 md:p-6">
          <div className="flex items-center justify-between gap-4 mb-5">
            <h3 className="text-xl font-black text-white">Profile Snapshot</h3>
            <span className="text-[10px] uppercase tracking-widest text-blue-400 font-black">{member.role}</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            <Detail icon={Users} label="Name" value={member.name} />
            <Detail icon={IdCard} label="College ID" value={member.collegeId} />
            <Detail icon={Mail} label="Email" value={member.email} />
            <Detail icon={Phone} label="Contact" value={member.phone} />
            <Detail icon={CalendarDays} label="Joined CICR" value={member.joinedAt ? fmtDate(member.joinedAt) : 'N/A'} />
            <Detail icon={Activity} label="Branch" value={member.branch || 'N/A'} />
            <Detail icon={FolderKanban} label="Batch" value={member.batch || 'N/A'} />
            <Detail icon={Clock3} label="Time in CICR" value={`${member.yearsInCICR ?? 0} years`} />
          </div>
          {member.bio && (
            <p className="mt-5 text-sm text-gray-300 bg-[#0a0a0c] border border-gray-800 rounded-2xl p-4">{member.bio}</p>
          )}
        </section>
      )}

      <section ref={recentRef} className="  rounded-[2rem] p-6 md:p-8">
        <div className="flex items-center gap-2 mb-6">
          <Sparkles size={18} className="text-blue-400" />
          <h3 className="text-xl font-black text-white">Latest Posts (Top 4)</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {recentPosts.map((post) => (
            <motion.div key={post._id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-[#0a0a0c] border border-gray-800 rounded-2xl p-4">
              <p className="text-[10px] uppercase tracking-widest text-blue-300 font-black">{post.type} • {post.topic || 'General'}</p>
              <p className="text-white mt-2 line-clamp-3">{post.content}</p>
              <p className="text-xs text-gray-500 mt-3">{post.user?.name} • {fmtDate(post.createdAt)} • {fmtTime(post.createdAt)}</p>
            </motion.div>
          ))}
        </div>
      </section>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        <section ref={meetingsRef} className=" p-6 md:p-8">
          <h3 className="text-xl font-black text-white flex items-center gap-2 mb-5"><CalendarDays size={18} className="text-emerald-400" />Meetings</h3>
          <div className="space-y-3">
            {meetings.slice(0, 6).map((m) => (
              <div key={m._id} className="bg-[#0a0a0c] border border-gray-800 rounded-2xl p-4">
                <p className="text-white font-bold">{m.title}</p>
                <p className="text-sm text-gray-400">{m.details?.topic || 'Session'} • {m.meetingType}</p>
                <p className="text-xs text-gray-500 mt-2 flex items-center gap-1"><Clock3 size={12} /> {fmtDate(m.startTime)} {fmtTime(m.startTime)}</p>
              </div>
            ))}
          </div>
        </section>

        <section ref={projectsRef} className=" p-6 md:p-8">
          <h3 className="text-xl font-black text-white flex items-center gap-2 mb-5"><FolderKanban size={18} className="text-indigo-400" />Projects</h3>
          <div className="space-y-3">
            {projects.slice(0, 6).map((p) => (
              <div key={p._id} className="bg-[#0a0a0c] border border-gray-800 rounded-2xl p-4">
                <p className="text-white font-bold">{p.title}</p>
                <p className="text-xs text-gray-400 uppercase tracking-widest mt-1">{p.domain} • {p.status}</p>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section ref={discussionsRef} className=" p-6 md:p-8">
        <h3 className="text-xl font-black text-white flex items-center gap-2 mb-5"><MessageSquareText size={18} className="text-amber-400" />Recent Discussions</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {posts.slice(0, 6).map((post) => (
            <div key={post._id} className="bg-[#0a0a0c] border border-gray-800 rounded-2xl p-4">
              <p className="text-[10px] uppercase tracking-widest text-blue-300 font-black">{post.type}</p>
              <p className="text-white mt-2 line-clamp-2">{post.content}</p>
              <p className="text-xs text-gray-500 mt-3 flex items-center gap-1"><Users size={12} /> {post.user?.name}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function Detail({ icon: Icon, label, value }) {
  return (
    <div className="bg-[#0a0a0c] border border-gray-800 rounded-2xl p-4">
      <p className="text-[10px] uppercase tracking-[0.2em] text-gray-500 font-black flex items-center gap-1">
        <Icon size={12} className="text-blue-400" /> {label}
      </p>
      <p className="text-white text-sm mt-2 break-words">{value}</p>
    </div>
  );
}
