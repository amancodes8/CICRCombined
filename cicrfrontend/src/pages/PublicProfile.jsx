import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CalendarDays, IdCard, Loader2, User, Workflow } from 'lucide-react';
import { fetchPublicProfile } from '../api';

const fmtDate = (v) => (v ? new Date(v).toLocaleDateString() : 'N/A');

const Stat = ({ label, value }) => (
  <div className="bg-[#0a0a0c] border border-gray-800 rounded-2xl p-4">
    <p className="text-[10px] uppercase tracking-widest text-gray-500 font-black">{label}</p>
    <p className="text-xl font-black text-white mt-2">{value}</p>
  </div>
);

export default function PublicProfile() {
  const { collegeId } = useParams();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const res = await fetchPublicProfile(collegeId);
        setData(res.data);
      } catch (err) {
        setData(null);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [collegeId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0c] text-white flex items-center justify-center page-motion-c">
        <Loader2 className="animate-spin text-blue-500" />
      </div>
    );
  }

  if (!data?.profile) {
    return (
      <div className="min-h-screen bg-[#0a0a0c] text-white p-6 flex items-center justify-center page-motion-c">
        <div className="border border-gray-800 rounded-3xl p-8 text-center">
          <p className="text-red-400 font-semibold">Profile not found for college ID: {collegeId}</p>
          <Link to="/login" className="inline-block mt-4 text-blue-400 hover:text-blue-300">Go to sign in</Link>
        </div>
      </div>
    );
  }

  const { profile, metrics } = data;
  return (
    <div className="min-h-screen bg-[#0a0a0c] text-white p-4 md:p-8 page-motion-c">
      <div className="max-w-5xl mx-auto space-y-6 pro-stagger">
        <header className="border border-gray-800 rounded-3xl p-8 section-motion section-motion-delay-1">
          <p className="text-xs uppercase tracking-widest text-blue-400 font-black">Public CICR Profile</p>
          <h1 className="text-3xl font-black mt-2">{profile.name}</h1>
          <div className="mt-3 flex flex-wrap gap-3 text-xs">
            <span className="bg-[#0a0a0c] border border-gray-800 rounded-full px-3 py-1 inline-flex items-center gap-1"><IdCard size={12} /> {profile.collegeId}</span>
            <span className="bg-[#0a0a0c] border border-gray-800 rounded-full px-3 py-1 inline-flex items-center gap-1"><User size={12} /> {profile.role}</span>
            <span className="bg-[#0a0a0c] border border-gray-800 rounded-full px-3 py-1 inline-flex items-center gap-1"><CalendarDays size={12} /> Joined {fmtDate(profile.joinedAt)}</span>
          </div>
          {profile.bio && <p className="mt-5 text-gray-300">{profile.bio}</p>}
        </header>

        <section className="grid grid-cols-1 md:grid-cols-3 gap-4 section-motion section-motion-delay-2">
          <Stat label="Years in CICR" value={profile.yearsInCICR || 0} />
          <Stat label="Project Contributions" value={metrics?.totalProjectContributions || 0} />
          <Stat label="Events Participated" value={metrics?.totalEvents || 0} />
        </section>

        <section className="grid grid-cols-1 xl:grid-cols-2 gap-4 section-motion section-motion-delay-3">
          <div className="border border-gray-800 rounded-3xl p-6 pro-hover-lift">
            <h2 className="text-lg font-black">Skills</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {(profile.skills || []).length === 0 && <p className="text-gray-500 text-sm">No skills added.</p>}
              {(profile.skills || []).map((s) => (
                <span key={s} className="bg-[#0a0a0c] border border-gray-700 text-gray-200 rounded-full px-3 py-1 text-xs">{s}</span>
              ))}
            </div>
          </div>

          <div className="border border-gray-800 rounded-3xl p-6 pro-hover-lift">
            <h2 className="text-lg font-black inline-flex items-center gap-2"><Workflow size={16} className="text-emerald-400" /> Achievements</h2>
            <ul className="mt-3 space-y-2">
              {(profile.achievements || []).length === 0 && <li className="text-gray-500 text-sm">No achievements added.</li>}
              {(profile.achievements || []).map((a, idx) => (
                <li key={`${a}-${idx}`} className="text-sm text-gray-300">• {a}</li>
              ))}
            </ul>
          </div>
        </section>
      </div>
    </div>
  );
}
