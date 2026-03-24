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

const sectionVariants = {
  hidden: { opacity: 0, y: 20, filter: 'blur(4px)' },
  show: { opacity: 1, y: 0, filter: 'blur(0px)' },
};

export default function PublicProfile() {
  const { collegeId } = useParams();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [avatarFailed, setAvatarFailed] = useState(false);

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

  useEffect(() => {
    setAvatarFailed(false);
  }, [data?.profile?.avatarUrl]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#06090f] text-white flex items-center justify-center">
        <div className="inline-flex items-center gap-2 text-sm text-cyan-200">
          <Loader2 className="animate-spin" size={18} />
          Loading profile experience...
        </div>
      </div>
    );
  }

  if (!data?.profile) {
    return (
      <div className="min-h-screen bg-[#06090f] text-white p-6 flex items-center justify-center">
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
  const idCard = data.idCard || {};
  const showIdCard = Boolean(idCard.enabled);
  const cardAvatarUrl = String(idCard.photo || profile.avatarUrl || '').trim();
  const cardHasAvatar = Boolean(cardAvatarUrl) && !avatarFailed;
  const isAlumni = String(profile.role || '').toLowerCase() === 'alumni';
  const skills = Array.isArray(profile.skills) ? profile.skills : [];
  const achievements = Array.isArray(profile.achievements) ? profile.achievements : [];
  const social = profile.social || {};
  const alumniProfile = profile.alumniProfile || {};
  const alumniTenures = (Array.isArray(alumniProfile.tenures) ? alumniProfile.tenures : []).filter(
    (row) => row?.position || row?.fromYear || row?.toYear
  );

  const socialItems = [
    { id: 'linkedin', label: 'LinkedIn', href: resolveSocialUrl('linkedin', social.linkedin), icon: LinkIcon },
    { id: 'github', label: 'GitHub', href: resolveSocialUrl('github', social.github), icon: Github },
    { id: 'portfolio', label: 'Portfolio', href: resolveSocialUrl('portfolio', social.portfolio), icon: ExternalLink },
    { id: 'instagram', label: 'Instagram', href: resolveSocialUrl('instagram', social.instagram), icon: Sparkles },
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

  const profileStats = [
    { label: 'Project Contributions', value: metrics?.totalProjectContributions || 0 },
    { label: 'Events Participated', value: metrics?.totalEvents || 0 },
    { label: 'Posts Created', value: metrics?.postsCreated || 0 },
    {
      label: isAlumni ? 'Alumni Tenure (Years)' : 'Years In CICR',
      value: isAlumni
        ? metrics?.alumniTenureYears || profile.yearsInCICR || 0
        : profile.yearsInCICR || 0,
    },
  ];

  const publicQrPayload = encodeURIComponent(
    JSON.stringify({
      collegeId: idCard.collegeId || profile.collegeId || '',
      name: idCard.name || profile.name || '',
      email: idCard.email || '',
      role: idCard.role || profile.role || '',
      profile: typeof window !== 'undefined' ? window.location.href : '',
    })
  );
  const publicQrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${publicQrPayload}`;

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#06090f] text-white">
      <div className="pointer-events-none absolute inset-0">
        <motion.div
          className="absolute -top-24 -left-16 h-[26rem] w-[26rem] rounded-full bg-cyan-500/12 blur-[120px]"
          animate={{ x: [0, 30, -16, 0], y: [0, -18, 20, 0], scale: [1, 1.08, 0.96, 1] }}
          transition={{ duration: 15, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute top-[18%] -right-24 h-[24rem] w-[24rem] rounded-full bg-indigo-500/14 blur-[110px]"
          animate={{ x: [0, -35, 18, 0], y: [0, 16, -16, 0], scale: [1, 0.95, 1.1, 1] }}
          transition={{ duration: 17, repeat: Infinity, ease: 'easeInOut' }}
        />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.06)_1px,transparent_1px)] bg-[length:28px_28px] opacity-[0.12]" />
      </div>

      <main className="relative mx-auto max-w-6xl px-4 pb-20 pt-10 md:px-8 md:pt-14">
        <motion.section
          initial={{ opacity: 0, y: 20, filter: 'blur(6px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={{ duration: 0.45 }}
          className="pb-10 border-b border-slate-700/55"
        >
          <p className="text-[10px] uppercase tracking-[0.24em] text-cyan-200 font-black">CICR Public Profile</p>

          <div className="mt-4 flex flex-col gap-7 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0 flex-1">
              <div className="flex items-start gap-4">
                <motion.div
                  initial={{ rotate: -8, scale: 0.9 }}
                  animate={{ rotate: [0, -4, 0], scale: [1, 1.04, 1] }}
                  transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
                  className="h-16 w-16 rounded-2xl border border-cyan-400/45 bg-cyan-400/10 text-cyan-100 flex items-center justify-center text-2xl font-black shrink-0 overflow-hidden"
                >
                  {profile.avatarUrl && !avatarFailed ? (
                    <img
                      src={profile.avatarUrl}
                      alt={profile.name || 'Profile'}
                      className="h-full w-full object-cover"
                      onError={() => setAvatarFailed(true)}
                    />
                  ) : (
                    <span>{profile.name?.[0] || 'C'}</span>
                  )}
                </motion.div>
                <div className="min-w-0">
                  <h1 className="text-3xl md:text-5xl font-black tracking-tight break-words leading-[1.05] bg-gradient-to-r from-white via-cyan-100 to-slate-300 text-transparent bg-clip-text">
                    {profile.name}
                  </h1>
                  <p className="mt-2 text-sm md:text-base text-slate-300">
                    {isAlumni
                      ? `${alumniProfile.currentDesignation || 'Alumni Member'}${
                          alumniProfile.currentOrganization ? ` • ${alumniProfile.currentOrganization}` : ''
                        }`
                      : `${profile.year ? `Year ${profile.year}` : 'CICR Member'}${
                          profile.branch ? ` • ${profile.branch}` : ''
                        }`}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
                    <span className="inline-flex items-center gap-1 rounded-full border border-slate-500/45 px-2.5 py-1 text-slate-200">
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

              <p className="mt-5 max-w-4xl text-sm md:text-base text-slate-300 leading-relaxed">
                {profile.bio || 'This member has not added a public professional summary yet.'}
              </p>
            </div>

            <div className="w-full lg:w-[20rem]">
              <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400 font-black">Profile Completion</div>
              <div className="mt-2 flex items-end justify-between gap-3">
                <p className="text-4xl font-black text-cyan-100">{completionScore}%</p>
                <p className="text-xs text-slate-400">Visibility & detail score</p>
              </div>
              <div className="mt-3 h-2 rounded-full bg-slate-800/90 overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.max(5, Math.min(100, completionScore))}%` }}
                  transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
                  className="h-full rounded-full bg-gradient-to-r from-cyan-500 via-blue-400 to-indigo-400"
                />
              </div>
            </div>
          </div>

          <motion.div
            initial="hidden"
            animate="show"
            variants={{ show: { transition: { staggerChildren: 0.08 } } }}
            className="mt-8 grid grid-cols-2 lg:grid-cols-4 gap-4"
          >
            {profileStats.map((stat) => (
              <motion.article
                key={stat.label}
                variants={sectionVariants}
                className="border-l border-cyan-500/30 pl-3"
              >
                <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500 font-black">{stat.label}</p>
                <p className="mt-1 text-2xl md:text-3xl font-black text-slate-100">{stat.value}</p>
              </motion.article>
            ))}
          </motion.div>
        </motion.section>

        <motion.section
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.25 }}
          variants={sectionVariants}
          transition={{ duration: 0.42 }}
          className="py-9 border-b border-slate-700/55"
        >
          <SectionTitle icon={IdCard} title="Digital Identity Card" />
          <div className="relative mt-4 rounded-3xl border border-cyan-500/28 bg-gradient-to-br from-[#071321] via-[#0a2340] to-[#162f55] p-5 md:p-7 overflow-hidden">
            <div className="pointer-events-none absolute inset-0 opacity-30 bg-[radial-gradient(circle_at_18%_18%,rgba(34,211,238,0.28)_0,transparent_42%),radial-gradient(circle_at_85%_72%,rgba(59,130,246,0.24)_0,transparent_38%),radial-gradient(circle_at_56%_8%,rgba(129,140,248,0.2)_0,transparent_32%)]" />
            <div className="pointer-events-none absolute inset-0 opacity-[0.07] bg-[linear-gradient(to_right,rgba(148,163,184,0.55)_1px,transparent_1px),linear-gradient(to_bottom,rgba(148,163,184,0.55)_1px,transparent_1px)] bg-[size:22px_22px]" />
            <div className="pointer-events-none absolute -top-16 -left-10 h-44 w-44 rounded-full bg-cyan-400/20 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-14 -right-8 h-48 w-48 rounded-full bg-indigo-500/20 blur-3xl" />
            <div className={!showIdCard ? 'pointer-events-none select-none opacity-40 blur-[1.8px]' : ''}>
              <div className="flex flex-col lg:flex-row gap-4 lg:gap-5 items-stretch">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs uppercase tracking-[0.28em] text-cyan-300 font-black">CICR Connect</p>
                    <span className="text-xs font-black uppercase tracking-[0.15em] px-3 py-1 rounded-xl border border-cyan-400/40 bg-cyan-400/10 text-cyan-100">Status Active Member</span>
                  </div>
                  <h3 className="text-5xl max-sm:text-4xl font-black mt-3 text-white tracking-tight">{idCard.name || profile.name || 'Member'}</h3>
                  <p className="mt-2 text-slate-300 max-w-xl">Digital identity card for CICR Connect member access and verification.</p>

                  <div className="mt-5 grid grid-cols-1 md:grid-cols-12 gap-3">
                    <div className="md:col-span-3 rounded-3xl border border-cyan-500/35 bg-gradient-to-br from-cyan-500/20 to-indigo-500/20 min-h-[140px] flex items-center justify-center text-6xl font-black text-cyan-100 overflow-hidden">
                      {cardHasAvatar ? (
                        <img
                          src={cardAvatarUrl}
                          alt={idCard.name || profile.name || 'Profile'}
                          className="h-full w-full object-cover"
                          onError={() => setAvatarFailed(true)}
                        />
                      ) : (
                        <span>{(idCard.name || profile.name || 'C')[0]}</span>
                      )}
                    </div>
                    <div className="md:col-span-9 grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="rounded-2xl border border-slate-700/60 bg-white/[0.04] px-4 py-3"><p className="text-[10px] tracking-widest uppercase text-slate-400">Year</p><p className="text-2xl font-black mt-1">{idCard.year || profile.year || 'N/A'}</p></div>
                      <div className="rounded-2xl border border-slate-700/60 bg-white/[0.04] px-4 py-3"><p className="text-[10px] tracking-widest uppercase text-slate-400">Batch</p><p className="text-2xl font-black mt-1">{idCard.batch || profile.batch || 'N/A'}</p></div>
                      <div className="rounded-2xl border border-slate-700/60 bg-white/[0.04] px-4 py-3"><p className="text-[10px] tracking-widest uppercase text-slate-400">Role</p><p className="text-2xl font-black mt-1">{idCard.role || profile.role || 'N/A'}</p></div>
                      <div className="rounded-2xl border border-slate-700/60 bg-white/[0.04] px-4 py-3"><p className="text-[10px] tracking-widest uppercase text-slate-400">Branch</p><p className="text-2xl font-black mt-1">{(idCard.branch || profile.branch || 'N/A').toUpperCase()}</p></div>
                    </div>
                  </div>

                  <div className="mt-4 rounded-2xl border border-cyan-500/25 bg-black/15 px-4 py-3 text-sm text-slate-200 flex flex-wrap gap-x-5 gap-y-1">
                    <span>College ID: {idCard.collegeId || profile.collegeId || 'N/A'}</span>
                    <span>Email ID: {idCard.email || 'N/A'}</span>
                  </div>

                </div>

                <div className="w-full lg:w-[18rem] xl:w-[19.5rem] rounded-3xl border border-cyan-500/25 bg-white/[0.06] p-4 shrink-0">
                  <p className="text-[11px] uppercase tracking-[0.24em] text-cyan-200 font-black">Scan To Verify</p>
                  <img src={publicQrUrl} alt="Public ID QR" className="mt-3 w-full max-w-[260px] rounded-2xl bg-white p-2 border border-cyan-500/30 mx-auto" />
                  <div className="mt-4 text-xs text-slate-300">
                    <div className="flex items-center justify-between"><span>CICR Member Card</span><span>{idCard.role || profile.role || 'Member'}</span></div>
                    <div className="h-2 rounded-full bg-white/10 overflow-hidden mt-2"><div className="h-full w-full bg-gradient-to-r from-cyan-400 to-blue-300" /></div>
                    <p className="mt-2 break-all text-slate-400">{typeof window !== 'undefined' ? window.location.href : ''}</p>
                  </div>
                </div>
              </div>
            </div>

            {!showIdCard && (
              <div className="absolute inset-0 flex items-center justify-center p-6">
                <div className="rounded-2xl border border-rose-500/35 bg-[#2a1130]/85 px-6 py-5 text-center max-w-md">
                  <BadgeCheck size={22} className="mx-auto text-rose-300" />
                  <p className="mt-3 text-4xl font-black text-white tracking-tight">DigiCard Unavailable</p>
                  <p className="mt-2 text-slate-200">This member's ID card is currently deactivated by an administrator and cannot be used for verification.</p>
                </div>
              </div>
            )}
          </div>
        </motion.section>

        <motion.section
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.25 }}
          variants={sectionVariants}
          transition={{ duration: 0.42 }}
          className="py-9 border-b border-slate-700/55"
        >
          <SectionTitle icon={User} title="Identity and Presence" />
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-x-8 gap-y-3 text-sm">
            <IdentityLine icon={IdCard} text={profile.collegeId || 'College ID unavailable'} accent="text-cyan-300" />
            <IdentityLine
              icon={GraduationCap}
              text={
                isAlumni
                  ? `Graduation Year ${alumniProfile.graduationYear || 'N/A'}`
                  : profile.year
                  ? `Academic Year ${profile.year}`
                  : 'Academic year unavailable'
              }
              accent="text-amber-300"
            />
            <IdentityLine
              icon={FolderKanban}
              text={`${profile.branch || 'Branch N/A'}${profile.batch ? ` • Batch ${profile.batch}` : ''}`}
              accent="text-indigo-300"
            />
            {isAlumni ? (
              <>
                <IdentityLine
                  icon={Building2}
                  text={alumniProfile.currentOrganization || 'Organization unavailable'}
                  accent="text-cyan-300"
                />
                <IdentityLine
                  icon={Workflow}
                  text={alumniProfile.currentDesignation || 'Designation unavailable'}
                  accent="text-violet-300"
                />
                <IdentityLine
                  icon={MapPin}
                  text={alumniProfile.location || 'Location unavailable'}
                  accent="text-emerald-300"
                />
              </>
            ) : null}
          </div>
        </motion.section>

        <motion.section
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.25 }}
          variants={sectionVariants}
          transition={{ duration: 0.42 }}
          className="py-9 border-b border-slate-700/55"
        >
          <SectionTitle icon={Sparkles} title="Skill Constellation" />
          <div className="mt-4">
            {skills.length === 0 ? (
              <p className="text-sm text-slate-500">No skills listed yet.</p>
            ) : (
              <motion.div
                initial="hidden"
                whileInView="show"
                viewport={{ once: true, amount: 0.2 }}
                variants={{ show: { transition: { staggerChildren: 0.05 } } }}
                className="flex flex-wrap gap-2.5"
              >
                {skills.map((skill) => (
                  <motion.span
                    key={skill}
                    variants={sectionVariants}
                    whileHover={{ y: -2, scale: 1.03 }}
                    className="rounded-full border border-cyan-500/35 bg-cyan-500/[0.08] px-3.5 py-1.5 text-xs font-semibold text-cyan-100"
                  >
                    {skill}
                  </motion.span>
                ))}
              </motion.div>
            )}
          </div>
        </motion.section>

        <motion.section
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.25 }}
          variants={sectionVariants}
          transition={{ duration: 0.42 }}
          className="py-9 border-b border-slate-700/55"
        >
          <SectionTitle icon={Trophy} title="Achievement Timeline" />
          <div className="mt-5">
            {achievements.length === 0 ? (
              <p className="text-sm text-slate-500">No achievements listed yet.</p>
            ) : (
              <div className="relative pl-6">
                <div className="absolute left-[7px] top-1 bottom-1 w-px bg-gradient-to-b from-cyan-400/70 via-indigo-400/45 to-transparent" />
                <motion.div
                  initial="hidden"
                  whileInView="show"
                  viewport={{ once: true, amount: 0.2 }}
                  variants={{ show: { transition: { staggerChildren: 0.08 } } }}
                  className="space-y-5"
                >
                  {achievements.map((item, idx) => (
                    <motion.article key={`${item}-${idx}`} variants={sectionVariants} className="relative">
                      <span className="absolute -left-6 top-1.5 h-3 w-3 rounded-full bg-cyan-300 shadow-[0_0_18px_rgba(56,189,248,0.65)]" />
                      <p className="text-[10px] uppercase tracking-[0.18em] text-cyan-300 font-black">Milestone {idx + 1}</p>
                      <p className="mt-1 text-sm md:text-[15px] text-slate-200 leading-relaxed">{item}</p>
                    </motion.article>
                  ))}
                </motion.div>
              </div>
            )}
          </div>
        </motion.section>

        {isAlumni && (
          <motion.section
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.25 }}
            variants={sectionVariants}
            transition={{ duration: 0.42 }}
            className="py-9 border-b border-slate-700/55"
          >
            <SectionTitle icon={CalendarDays} title="CICR Leadership Continuum" />
            <div className="mt-5">
              {alumniTenures.length === 0 ? (
                <p className="text-sm text-slate-500">No leadership timeline published.</p>
              ) : (
                <div className="relative pl-6">
                  <div className="absolute left-[7px] top-1 bottom-1 w-px bg-gradient-to-b from-emerald-400/70 via-cyan-400/40 to-transparent" />
                  <motion.div
                    initial="hidden"
                    whileInView="show"
                    viewport={{ once: true, amount: 0.2 }}
                    variants={{ show: { transition: { staggerChildren: 0.08 } } }}
                    className="space-y-5"
                  >
                    {alumniTenures.map((row, idx) => (
                      <motion.article key={`${row.position}-${idx}`} variants={sectionVariants} className="relative">
                        <span className="absolute -left-6 top-1.5 h-3 w-3 rounded-full bg-emerald-300 shadow-[0_0_18px_rgba(52,211,153,0.65)]" />
                        <p className="text-sm md:text-base text-emerald-100 font-semibold">{row.position || 'Role'}</p>
                        <p className="mt-1 text-xs text-slate-400">
                          {row.fromYear || 'N/A'} - {row.toYear || 'N/A'}
                        </p>
                      </motion.article>
                    ))}
                  </motion.div>
                </div>
              )}
            </div>
          </motion.section>
        )}

        <motion.section
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.25 }}
          variants={sectionVariants}
          transition={{ duration: 0.42 }}
          className="pt-9"
        >
          <SectionTitle icon={LinkIcon} title="Digital Footprint" />
          <div className="mt-4">
            {socialItems.length === 0 ? (
              <p className="text-sm text-slate-500">No public links available.</p>
            ) : (
              <motion.div
                initial="hidden"
                whileInView="show"
                viewport={{ once: true, amount: 0.2 }}
                variants={{ show: { transition: { staggerChildren: 0.07 } } }}
                className="divide-y divide-slate-800"
              >
                {socialItems.map((item) => (
                  <motion.a
                    key={item.id}
                    variants={sectionVariants}
                    href={item.href}
                    target="_blank"
                    rel="noreferrer"
                    className="group flex items-center justify-between py-3 text-sm text-slate-200 hover:text-cyan-100 transition-colors"
                  >
                    <span className="inline-flex items-center gap-2">
                      <item.icon size={14} className="text-cyan-300" />
                      {item.label}
                    </span>
                    <ExternalLink size={13} className="text-slate-500 group-hover:text-cyan-200" />
                  </motion.a>
                ))}
              </motion.div>
            )}
          </div>
        </motion.section>
      </main>
    </div>
  );
}

function SectionTitle({ icon: Icon, title }) {
  return (
    <h2 className="text-sm md:text-base font-black uppercase tracking-[0.18em] text-slate-200 inline-flex items-center gap-2">
      <Icon size={15} className="text-cyan-300" />
      {title}
    </h2>
  );
}

function IdentityLine({ icon: Icon, text, accent = 'text-cyan-300' }) {
  return (
    <p className="text-slate-300 inline-flex items-center gap-2">
      <Icon size={14} className={accent} />
      {text}
    </p>
  );
}
