import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  BadgeCheck,
  Building2,
  CalendarDays,
  ExternalLink,
  FolderKanban,
  Github,
  GraduationCap,
  IdCard,
  Link as LinkIcon,
  Loader2,
  MapPin,
  Sparkles,
  Trophy,
  User,
  Workflow,
} from 'lucide-react';
import { fetchPublicProfile } from '../api';

const fmtDate = (v) => (v ? new Date(v).toLocaleDateString() : 'N/A');

const resolveSocialUrl = (kind, rawValue) => {
  const raw = String(rawValue || '').trim();
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw)) return raw;

  const handle = raw.replace(/^@/, '');
  if (!handle) return '';
  if (kind === 'github') return `https://github.com/${handle}`;
  if (kind === 'linkedin') return `https://linkedin.com/in/${handle}`;
  if (kind === 'instagram') return `https://instagram.com/${handle}`;
  if (kind === 'facebook') return `https://facebook.com/${handle}`;
  return `https://${handle}`;
};

const StatTile = ({ label, value, accent = 'text-cyan-200' }) => (
  <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
    <p className="text-[10px] uppercase tracking-[0.18em] text-gray-400 font-black">{label}</p>
    <p className={`mt-1.5 text-2xl font-black ${accent}`}>{value}</p>
  </div>
);

const Section = ({ title, icon: Icon, children }) => (
  <section className="rounded-3xl border border-slate-700/55 bg-[#0c1119]/82 p-5 md:p-6">
    <h2 className="text-sm md:text-base font-black uppercase tracking-[0.16em] text-slate-200 inline-flex items-center gap-2">
      <Icon size={15} className="text-cyan-300" />
      {title}
    </h2>
    <div className="mt-4">{children}</div>
  </section>
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
      } catch {
        setData(null);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [collegeId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#070a10] text-white flex items-center justify-center">
        <div className="inline-flex items-center gap-2 text-sm text-cyan-200">
          <Loader2 className="animate-spin" size={18} />
          Loading profile...
        </div>
      </div>
    );
  }

  if (!data?.profile) {
    return (
      <div className="min-h-screen bg-[#070a10] text-white p-6 flex items-center justify-center">
        <div className="w-full max-w-xl border border-slate-700 rounded-3xl p-8 text-center bg-[#0b0f16]/90">
          <p className="text-rose-300 font-semibold">Profile not found for college ID: {collegeId}</p>
          <Link
            to="/login"
            className="inline-flex items-center gap-2 mt-5 rounded-xl border border-cyan-500/35 px-4 py-2 text-cyan-200 hover:bg-cyan-500/10"
          >
            Go to sign in <ExternalLink size={14} />
          </Link>
        </div>
      </div>
    );
  }

  const { profile, metrics } = data;
  const isAlumni = String(profile.role || '').toLowerCase() === 'alumni';
  const skills = Array.isArray(profile.skills) ? profile.skills : [];
  const achievements = Array.isArray(profile.achievements) ? profile.achievements : [];
  const social = profile.social || {};
  const alumniProfile = profile.alumniProfile || {};
  const alumniTenures = Array.isArray(alumniProfile.tenures) ? alumniProfile.tenures : [];

  const socialItems = [
    { id: 'linkedin', label: 'LinkedIn', href: resolveSocialUrl('linkedin', social.linkedin), icon: LinkIcon },
    { id: 'github', label: 'GitHub', href: resolveSocialUrl('github', social.github), icon: Github },
    { id: 'portfolio', label: 'Portfolio', href: resolveSocialUrl('portfolio', social.portfolio), icon: ExternalLink },
  ].filter((item) => item.href);

  const completionChecks = [
    Boolean(profile.bio),
    Boolean(profile.branch),
    Boolean(profile.batch),
    skills.length > 0,
    achievements.length > 0,
    socialItems.length > 0,
  ];
  const completionScore = Math.round(
    (completionChecks.filter(Boolean).length / completionChecks.length) * 100
  );

  return (
    <div className="min-h-screen bg-[#070a10] text-white px-4 py-6 md:px-8 md:py-10">
      <div className="mx-auto max-w-6xl space-y-6 md:space-y-7">
        <motion.header
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-[2rem] border border-cyan-500/25 bg-gradient-to-br from-[#101929] via-[#0d1522] to-[#111827] p-6 md:p-8"
        >
          <div className="pointer-events-none absolute -top-28 -right-24 h-64 w-64 rounded-full bg-cyan-500/20 blur-[95px]" />
          <div className="pointer-events-none absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-indigo-500/20 blur-[95px]" />

          <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0 flex-1">
              <p className="text-[10px] uppercase tracking-[0.22em] text-cyan-200 font-black">CICR Public Profile</p>
              <div className="mt-3 flex items-start gap-4">
                <div className="h-16 w-16 rounded-2xl border border-cyan-400/45 bg-cyan-400/10 text-cyan-100 flex items-center justify-center text-2xl font-black shrink-0">
                  {profile.name?.[0] || 'C'}
                </div>
                <div className="min-w-0">
                  <h1 className="text-2xl md:text-4xl font-black tracking-tight break-words">{profile.name}</h1>
                  <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
                    <span className="inline-flex items-center gap-1 rounded-full border border-slate-500/50 px-2.5 py-1 text-slate-200">
                      <IdCard size={12} /> {profile.collegeId}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/35 px-2.5 py-1 text-emerald-200">
                      <BadgeCheck size={12} /> {profile.role}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/35 px-2.5 py-1 text-amber-200">
                      <CalendarDays size={12} /> Joined {fmtDate(profile.joinedAt)}
                    </span>
                  </div>
                </div>
              </div>

              <p className="mt-4 text-sm text-slate-300 leading-relaxed max-w-3xl">
                {profile.bio || 'No bio added yet. This member has not shared a public summary.'}
              </p>
            </div>

            <div className="w-full sm:w-auto grid grid-cols-2 gap-3">
              <StatTile label="Profile Score" value={`${completionScore}%`} accent="text-cyan-200" />
              <StatTile label="Years in CICR" value={profile.yearsInCICR || 0} accent="text-indigo-200" />
            </div>
          </div>
        </motion.header>

        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.06 }}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4"
        >
          <StatTile label="Project Contributions" value={metrics?.totalProjectContributions || 0} accent="text-cyan-200" />
          <StatTile label="Events Participated" value={metrics?.totalEvents || 0} accent="text-emerald-200" />
          <StatTile label="Posts Created" value={metrics?.postsCreated || 0} accent="text-amber-200" />
          <StatTile
            label={isAlumni ? 'Alumni Tenure' : 'Academic'}
            value={
              isAlumni
                ? `${metrics?.alumniTenureYears || profile.yearsInCICR || 0}Y`
                : `${profile.year || 'N/A'}${profile.year ? 'Y' : ''}`
            }
            accent="text-violet-200"
          />
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-1 xl:grid-cols-12 gap-4 md:gap-5"
        >
          <div className="xl:col-span-4 space-y-4">
            <Section title="Identity" icon={User}>
              <div className="space-y-2 text-sm">
                <p className="text-slate-300 inline-flex items-center gap-2">
                  <IdCard size={14} className="text-cyan-300" />
                  {profile.collegeId || 'Not available'}
                </p>
                <p className="text-slate-300 inline-flex items-center gap-2">
                  <GraduationCap size={14} className="text-amber-300" />
                  {profile.branch || 'Branch not added'} {profile.batch ? `• ${profile.batch}` : ''}
                </p>
                <p className="text-slate-300 inline-flex items-center gap-2">
                  <FolderKanban size={14} className="text-indigo-300" />
                  {isAlumni
                    ? `Graduated ${alumniProfile.graduationYear || 'N/A'}`
                    : profile.year
                    ? `${profile.year} Year`
                    : 'Year not added'}
                </p>
                {isAlumni && (
                  <>
                    <p className="text-slate-300 inline-flex items-center gap-2">
                      <Building2 size={14} className="text-cyan-300" />
                      {alumniProfile.currentOrganization || 'Organization not added'}
                    </p>
                    <p className="text-slate-300 inline-flex items-center gap-2">
                      <MapPin size={14} className="text-emerald-300" />
                      {alumniProfile.location || 'Location not added'}
                    </p>
                  </>
                )}
              </div>
            </Section>

            <Section title="Public Links" icon={LinkIcon}>
              {socialItems.length === 0 ? (
                <p className="text-sm text-slate-500">No public links available.</p>
              ) : (
                <div className="space-y-2.5">
                  {socialItems.map((item) => (
                    <a
                      key={item.id}
                      href={item.href}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex w-full items-center justify-between rounded-xl border border-slate-700/60 px-3 py-2.5 text-sm text-slate-200 hover:border-cyan-500/45 hover:text-cyan-100 transition-colors"
                    >
                      <span className="inline-flex items-center gap-2">
                        <item.icon size={14} />
                        {item.label}
                      </span>
                      <ExternalLink size={13} />
                    </a>
                  ))}
                </div>
              )}
            </Section>
          </div>

          <div className="xl:col-span-8 space-y-4">
            <Section title="Skill Stack" icon={Sparkles}>
              {skills.length === 0 ? (
                <p className="text-sm text-slate-500">No skills listed.</p>
              ) : (
                <div className="flex flex-wrap gap-2.5">
                  {skills.map((skill) => (
                    <span
                      key={skill}
                      className="rounded-full border border-cyan-500/35 bg-cyan-500/10 px-3 py-1.5 text-xs font-semibold text-cyan-100"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              )}
            </Section>

            <Section title="Achievements" icon={Trophy}>
              {achievements.length === 0 ? (
                <p className="text-sm text-slate-500">No achievements listed.</p>
              ) : (
                <div className="space-y-2.5">
                  {achievements.map((item, idx) => (
                    <article key={`${item}-${idx}`} className="rounded-xl border border-slate-700/60 bg-slate-900/45 px-3.5 py-3">
                      <p className="text-[10px] uppercase tracking-[0.16em] text-cyan-300 font-black">
                        Milestone {idx + 1}
                      </p>
                      <p className="mt-1.5 text-sm text-slate-200 leading-relaxed">{item}</p>
                    </article>
                  ))}
                </div>
              )}
            </Section>

            <Section title="Professional Snapshot" icon={Workflow}>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="rounded-xl border border-slate-700/60 bg-slate-900/45 p-3">
                  <p className="text-[10px] uppercase tracking-[0.16em] text-slate-400 font-black">Consistency</p>
                  <p className="mt-1.5 text-lg font-black text-cyan-200">{Math.max(25, completionScore)}%</p>
                </div>
                <div className="rounded-xl border border-slate-700/60 bg-slate-900/45 p-3">
                  <p className="text-[10px] uppercase tracking-[0.16em] text-slate-400 font-black">Skills</p>
                  <p className="mt-1.5 text-lg font-black text-emerald-200">{skills.length}</p>
                </div>
                <div className="rounded-xl border border-slate-700/60 bg-slate-900/45 p-3">
                  <p className="text-[10px] uppercase tracking-[0.16em] text-slate-400 font-black">Achievements</p>
                  <p className="mt-1.5 text-lg font-black text-amber-200">{achievements.length}</p>
                </div>
              </div>
            </Section>

            {isAlumni && (
              <Section title="CICR Leadership Timeline" icon={CalendarDays}>
                {alumniTenures.length === 0 ? (
                  <p className="text-sm text-slate-500">No tenure timeline available.</p>
                ) : (
                  <div className="space-y-2.5">
                    {alumniTenures.map((row, idx) => (
                      <article key={`${row.position}-${idx}`} className="rounded-xl border border-slate-700/60 bg-slate-900/45 px-3.5 py-3">
                        <p className="text-sm font-semibold text-cyan-100">{row.position || 'Role'}</p>
                        <p className="mt-1 text-xs text-slate-400">
                          {row.fromYear || 'N/A'} - {row.toYear || 'N/A'}
                        </p>
                      </article>
                    ))}
                  </div>
                )}
              </Section>
            )}
          </div>
        </motion.section>
      </div>
    </div>
  );
}
