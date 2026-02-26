import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  Activity,
  Building2,
  CalendarDays,
  Clock3,
  FolderKanban,
  GraduationCap,
  Handshake,
  Loader2,
  MessageSquareText,
  Mail,
  Phone,
  IdCard,
  MapPin,
  Sparkles,
  Users,
} from 'lucide-react';
import {
  fetchMeetings,
  fetchMyInsights,
  fetchPosts,
  fetchProjects,
  fetchApplications,
  fetchDirectoryMembers,
} from '../api';
import PageHeader from '../components/PageHeader';

const fmtDate = (d) => new Date(d).toLocaleDateString();
const fmtTime = (d) => new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

const Stat = ({ label, value }) => (
  <div className="border border-gray-800 rounded-3xl p-6">
    <p className="text-[10px] uppercase tracking-[0.2em] text-gray-500 font-black">{label}</p>
    <p className="text-4xl font-black text-white mt-2">{value}</p>
  </div>
);

export default function Dashboard() {
  const profile = JSON.parse(localStorage.getItem('profile') || '{}');
  const userData = profile.result || profile;
  const role = String(userData.role || '').toLowerCase();
  const isAdminOrHead = role === 'admin' || role === 'head';
  const isAlumni = role === 'alumni';

  const [loading, setLoading] = useState(true);
  const [posts, setPosts] = useState([]);
  const [projects, setProjects] = useState([]);
  const [meetings, setMeetings] = useState([]);
  const [insights, setInsights] = useState(null);
  const [applications, setApplications] = useState([]);
  const [directoryMembers, setDirectoryMembers] = useState([]);

  const recentRef = useRef(null);
  const meetingsRef = useRef(null);
  const projectsRef = useRef(null);
  const discussionsRef = useRef(null);

  useEffect(() => {
    const load = async () => {
      try {
        const [postRes, projectRes, meetingRes, insightRes, appRes, directoryRes] = await Promise.all([
          fetchPosts().catch(() => ({ data: [] })),
          fetchProjects().catch(() => ({ data: [] })),
          fetchMeetings().catch(() => ({ data: [] })),
          fetchMyInsights().catch(() => ({ data: null })),
          isAdminOrHead ? fetchApplications().catch(() => ({ data: [] })) : Promise.resolve({ data: [] }),
          isAlumni ? fetchDirectoryMembers().catch(() => ({ data: [] })) : Promise.resolve({ data: [] }),
        ]);
        setPosts(Array.isArray(postRes.data) ? postRes.data : []);
        setProjects(Array.isArray(projectRes.data) ? projectRes.data : []);
        setMeetings(Array.isArray(meetingRes.data) ? meetingRes.data : []);
        setInsights(insightRes.data);
        setApplications(Array.isArray(appRes.data) ? appRes.data : []);
        setDirectoryMembers(Array.isArray(directoryRes.data) ? directoryRes.data : []);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [isAdminOrHead, isAlumni]);

  const recentPosts = useMemo(() => posts.slice(0, 4), [posts]);
  const metrics = insights?.metrics;
  const member = insights?.member;
  const applicationStats = useMemo(() => {
    const base = { total: applications.length, new: 0, interview: 0, accepted: 0, selected: 0 };
    applications.forEach((app) => {
      if (app.status === 'New') base.new += 1;
      if (app.status === 'Interview') base.interview += 1;
      if (app.status === 'Accepted') base.accepted += 1;
      if (app.status === 'Selected') base.selected += 1;
    });
    return base;
  }, [applications]);
  const alumniProfile = member?.alumniProfile || userData.alumniProfile || {};
  const alumniTenures = useMemo(
    () =>
      (Array.isArray(alumniProfile?.tenures) ? alumniProfile.tenures : [])
        .filter((row) => row?.position && row?.fromYear && row?.toYear)
        .sort((a, b) => Number(a.fromYear || 0) - Number(b.fromYear || 0)),
    [alumniProfile?.tenures]
  );
  const directoryPreview = useMemo(() => directoryMembers.slice(0, 8), [directoryMembers]);
  const upcomingMeetings = useMemo(
    () =>
      [...meetings]
        .filter((row) => new Date(row.startTime).getTime() >= Date.now())
        .sort((a, b) => new Date(a.startTime) - new Date(b.startTime))
        .slice(0, 5),
    [meetings]
  );

  const scrollTo = (ref) => ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  if (loading) {
    return (
      <div className="h-[80vh] flex flex-col items-center justify-center gap-4">
        <Loader2 className="animate-spin text-blue-500" size={42} />
        <p className="text-xs text-gray-500 uppercase tracking-widest font-black">Loading Dashboard</p>
      </div>
    );
  }

  if (isAlumni) {
    return (
      <div className="ui-page pb-16 space-y-8 page-motion-a">
        <section className="section-motion section-motion-delay-1">
          <PageHeader
            eyebrow="Alumni Portal"
            title={`Welcome Back, ${member?.name || 'Alumni Member'}`}
            subtitle="Mentor current members, stay connected with CICR operations, and track your institutional timeline."
            icon={Handshake}
            actions={
              <>
                <Link to="/community?tab=directory" className="btn btn-primary">Member Directory</Link>
                <Link to="/events" className="btn btn-secondary">Events</Link>
                <Link to="/community?tab=issues" className="btn btn-secondary">Raise Issue</Link>
              </>
            }
          />
        </section>

        <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5 section-motion section-motion-delay-2 pro-stagger">
          <Stat label="Directory Members" value={directoryMembers.length} />
          <Stat label="Alumni Tenure Years" value={metrics?.alumniTenureYears || alumniTenures.length || 0} />
          <Stat label="Projects Contributed" value={metrics?.totalProjectContributions || 0} />
          <Stat label="Mentorship Status" value={alumniProfile?.willingToMentor ? 'Open' : 'Limited'} />
        </section>

        <section className="grid grid-cols-1 xl:grid-cols-12 gap-8 section-motion section-motion-delay-2">
          <article className="xl:col-span-7 border border-gray-800 rounded-3xl p-6">
            <h3 className="text-xl font-black text-white inline-flex items-center gap-2">
              <CalendarDays size={18} className="text-cyan-300" />
              CICR Role Timeline
            </h3>
            <div className="mt-4 space-y-3">
              {alumniTenures.length === 0 && <p className="text-sm text-gray-500">No role timeline has been added in profile yet.</p>}
              {alumniTenures.map((row, idx) => (
                <article key={`${row.position}-${idx}`} className="border border-gray-700/75 rounded-xl p-3 bg-[#0a0f16]/70">
                  <p className="text-sm font-bold text-cyan-100">{row.position}</p>
                  <p className="text-xs text-gray-400 mt-1">
                    {row.fromYear} - {row.toYear}
                  </p>
                </article>
              ))}
            </div>
          </article>

          <article className="xl:col-span-5 border border-gray-800 rounded-3xl p-6">
            <h3 className="text-xl font-black text-white inline-flex items-center gap-2">
              <Building2 size={18} className="text-indigo-300" />
              Alumni Profile Snapshot
            </h3>
            <div className="mt-4 space-y-2 text-sm">
              <p className="text-gray-300 inline-flex items-center gap-2">
                <GraduationCap size={14} className="text-amber-300" />
                Graduation Year: {alumniProfile?.graduationYear || 'N/A'}
              </p>
              <p className="text-gray-300 inline-flex items-center gap-2">
                <Building2 size={14} className="text-cyan-300" />
                Organization: {alumniProfile?.currentOrganization || 'Not added'}
              </p>
              <p className="text-gray-300 inline-flex items-center gap-2">
                <Activity size={14} className="text-cyan-300" />
                Designation: {alumniProfile?.currentDesignation || 'Not added'}
              </p>
              <p className="text-gray-300 inline-flex items-center gap-2">
                <MapPin size={14} className="text-emerald-300" />
                Location: {alumniProfile?.location || 'Not added'}
              </p>
            </div>

            <p className="text-xs uppercase tracking-widest text-gray-500 mt-5">Mentorship Areas</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {(alumniProfile?.mentorshipAreas || []).length === 0 && (
                <span className="text-xs text-gray-500">No mentorship areas listed.</span>
              )}
              {(alumniProfile?.mentorshipAreas || []).map((area) => (
                <span key={area} className="text-xs px-2.5 py-1 rounded-full border border-cyan-500/35 text-cyan-200">
                  {area}
                </span>
              ))}
            </div>
          </article>
        </section>

        <section className="grid grid-cols-1 xl:grid-cols-2 gap-8 section-motion section-motion-delay-3">
          <article className="border border-gray-800 rounded-3xl p-6">
            <h3 className="text-xl font-black text-white inline-flex items-center gap-2">
              <CalendarDays size={18} className="text-emerald-400" />
              Upcoming Meetings & Events
            </h3>
            <div className="mt-4 space-y-3">
              {upcomingMeetings.length === 0 && (
                <p className="text-sm text-gray-500">No upcoming meetings are scheduled right now.</p>
              )}
              {upcomingMeetings.map((row) => (
                <article key={row._id} className="rounded-xl border border-gray-700/70 p-3 bg-[#0a0f16]/70">
                  <p className="text-sm font-bold text-white">{row.title}</p>
                  <p className="text-xs text-gray-400 mt-1">
                    {fmtDate(row.startTime)} {fmtTime(row.startTime)} • {row.meetingType}
                  </p>
                </article>
              ))}
            </div>
          </article>

          <article className="border border-gray-800 rounded-3xl p-6">
            <h3 className="text-xl font-black text-white inline-flex items-center gap-2">
              <Users size={18} className="text-blue-300" />
              Member Directory Preview
            </h3>
            <div className="mt-4 space-y-3">
              {directoryPreview.length === 0 && (
                <p className="text-sm text-gray-500">Directory data not available right now.</p>
              )}
              {directoryPreview.map((row) => (
                <article key={row._id} className="rounded-xl border border-gray-700/70 p-3 bg-[#0a0f16]/70">
                  <p className="text-sm font-bold text-white">{row.name}</p>
                  <p className="text-xs text-gray-400 mt-1">{row.role} • {row.branch || 'Branch N/A'}</p>
                </article>
              ))}
            </div>
            <div className="mt-4">
              <Link to="/community?tab=directory" className="btn btn-ghost !w-auto">Open Full Directory</Link>
            </div>
          </article>
        </section>
      </div>
    );
  }

  return (
    <div className="ui-page pb-16 space-y-8 page-motion-a">
      <section className="section-motion section-motion-delay-1">
        <PageHeader
          eyebrow="CICR Dashboard"
          title="Recent Activities"
          subtitle="Events, meetings, projects, and discussions in one operational view."
          icon={Activity}
          actions={
            <>
              <button onClick={() => scrollTo(recentRef)} className="btn btn-primary">Recent</button>
              <button onClick={() => scrollTo(meetingsRef)} className="btn btn-secondary">Meetings</button>
              <button onClick={() => scrollTo(projectsRef)} className="btn btn-secondary">Projects</button>
              <button onClick={() => scrollTo(discussionsRef)} className="btn btn-secondary">Discussions</button>
            </>
          }
        />
      </section>

      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5 section-motion section-motion-delay-2 pro-stagger">
        <Stat label="Projects Involved" value={metrics?.totalProjectContributions || projects.length} />
        <Stat label="Meetings & Events" value={metrics?.totalEvents || meetings.length} />
        <Stat label="Discussions" value={posts.length} />
        <Stat label="Years In CICR" value={insights?.member?.yearsInCICR ?? 0} />
      </section>

      {member && (
        <section className="border-b-white border-b-1  p-6 md:p-6 section-motion section-motion-delay-2">
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

      <section ref={recentRef} className="rounded-[2rem] p-6 md:p-8 section-motion section-motion-delay-3">
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

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 section-motion section-motion-delay-3">
        <section ref={meetingsRef} className="p-6 md:p-8">
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

        <section ref={projectsRef} className="p-6 md:p-8">
          <h3 className="text-xl font-black text-white flex items-center gap-2 mb-5"><FolderKanban size={18} className="text-indigo-400" />Projects</h3>
          <div className="space-y-3">
            {projects.slice(0, 6).map((p) => (
              <Link key={p._id} to={`/projects/${p._id}`} className="block bg-[#0a0a0c] border border-gray-800 rounded-2xl p-4 hover:border-blue-500/40 transition-colors">
                <p className="text-white font-bold">{p.title}</p>
                <p className="text-xs text-gray-400 uppercase tracking-widest mt-1">{p.domain} • {p.status}</p>
              </Link>
            ))}
          </div>
        </section>
      </div>

      <section ref={discussionsRef} className="p-6 md:p-8 section-motion section-motion-delay-3">
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

      {isAdminOrHead && (
        <section className="border border-gray-800 rounded-[2rem] p-6 md:p-8 section-motion section-motion-delay-3">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles size={16} className="text-blue-400" />
            <h3 className="text-lg font-black text-white">Recruitment Snapshot</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
            <Stat label="Total Applications" value={applicationStats.total} />
            <Stat label="New" value={applicationStats.new} />
            <Stat label="Interview" value={applicationStats.interview} />
            <Stat label="Accepted" value={applicationStats.accepted} />
            <Stat label="Selected" value={applicationStats.selected} />
          </div>
        </section>
      )}
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
