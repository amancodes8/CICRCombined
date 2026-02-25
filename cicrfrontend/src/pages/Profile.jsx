import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Award,
  BookOpen,
  Briefcase,
  Calendar,
  Copy,
  Edit2,
  ExternalLink,
  Facebook,
  Github,
  Hash,
  Instagram,
  Link as LinkIcon,
  Loader2,
  LogOut,
  Lock,
  Mail,
  Phone,
  Save,
  ShieldAlert,
  SquareUser,
  User,
  X,
} from 'lucide-react';
import { acknowledgeWarnings, changePassword, getMe, updateProfile } from '../api';

const dateToInput = (value) => {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
};

const fmtDate = (value) => {
  if (!value) return 'Not set';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return 'Not set';
  return d.toLocaleDateString();
};

const yearsInCicr = (joinedAt) => {
  if (!joinedAt) return 0;
  const start = new Date(joinedAt);
  if (Number.isNaN(start.getTime())) return 0;
  const now = new Date();
  let years = now.getFullYear() - start.getFullYear();
  const monthDiff = now.getMonth() - start.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < start.getDate())) years -= 1;
  return Math.max(0, years);
};

const buildFormData = (user = {}) => ({
  name: user.name || '',
  phone: user.phone || '',
  year: user.year || '',
  branch: (user.branch || '').toUpperCase(),
  batch: user.batch || '',
  joinedAt: dateToInput(user.joinedAt),
  bio: user.bio || '',
  skillsText: (user.skills || []).join(', '),
  achievementsText: (user.achievements || []).join('\n'),
  social: {
    linkedin: user.social?.linkedin || '',
    github: user.social?.github || '',
    portfolio: user.social?.portfolio || '',
    instagram: user.social?.instagram || '',
    facebook: user.social?.facebook || '',
  },
});

const resolveSocialUrl = (kind, rawValue) => {
  const raw = String(rawValue || '').trim();
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw)) return raw;

  const handle = raw.replace(/^@/, '');
  if (!handle) return '';

  if (kind === 'instagram') return `https://instagram.com/${handle}`;
  if (kind === 'facebook') return `https://facebook.com/${handle}`;
  if (kind === 'github') return `https://github.com/${handle}`;
  if (kind === 'linkedin') return `https://linkedin.com/in/${handle}`;
  return `https://${handle}`;
};

const dispatchToast = (message, type = 'info') => {
  try {
    window.dispatchEvent(new CustomEvent('app:toast', { detail: { message, type } }));
  } catch {
    // fallback if event dispatch is unavailable
    window.alert(message);
  }
};

const MetricCard = ({ label, value, helper }) => (
  <article className="py-2">
    <p className="text-[10px] uppercase tracking-[0.2em] text-gray-500 font-black">{label}</p>
    <p className="profile-value-flow text-3xl font-black mt-2">{value}</p>
    {helper && <p className="text-xs text-gray-500 mt-1">{helper}</p>}
  </article>
);

const ProfileRow = ({ icon: Icon, label, value }) => (
  <div className="flex items-start gap-3 py-1.5">
    <Icon size={15} className="text-cyan-300 mt-[2px]" />
    <div className="min-w-0">
      <p className="text-[10px] uppercase tracking-widest text-gray-500 font-black">{label}</p>
      <p className="text-sm text-gray-200 break-words">{value || 'Not added'}</p>
    </div>
  </div>
);

const InputField = ({ icon: Icon, label, value, onChange, placeholder, type = 'text', disabled = false }) => (
  <div className="space-y-2">
    <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">{label}</label>
    <div className="relative">
      <Icon className={`absolute left-4 top-1/2 -translate-y-1/2 ${disabled ? 'text-gray-600' : 'text-cyan-400'}`} size={17} />
      <input
        type={type}
        disabled={disabled}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="w-full bg-[#0a0f16]/85 p-3.5 pl-11 rounded-xl outline-none focus:ring-2 focus:ring-cyan-400/55 disabled:opacity-60 transition-all text-white placeholder:text-gray-600"
      />
    </div>
  </div>
);

export default function Profile() {
  const initialRaw = JSON.parse(localStorage.getItem('profile') || '{}');
  const initialUser = initialRaw.result || initialRaw;

  const [user, setUser] = useState(initialUser);
  const [formData, setFormData] = useState(buildFormData(initialUser));
  const [warnings, setWarnings] = useState(initialUser.warnings || []);
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const publicProfileUrl = user.collegeId ? `${origin}/profile/${user.collegeId}` : '';
  const skills = Array.isArray(user.skills) ? user.skills : [];
  const achievements = Array.isArray(user.achievements) ? user.achievements : [];

  const completionScore = useMemo(() => {
    const checks = [
      !!user.name,
      !!user.phone,
      !!user.year,
      !!user.branch,
      !!user.batch,
      !!user.joinedAt,
      !!user.bio,
      skills.length > 0,
      achievements.length > 0,
      Object.values(user.social || {}).some((v) => String(v || '').trim()),
    ];
    const done = checks.filter(Boolean).length;
    return Math.round((done / checks.length) * 100);
  }, [achievements.length, skills.length, user.batch, user.bio, user.branch, user.joinedAt, user.name, user.phone, user.social, user.year]);

  const socialItems = useMemo(
    () => [
      { key: 'linkedin', label: 'LinkedIn', icon: LinkIcon, raw: user.social?.linkedin || '' },
      { key: 'github', label: 'GitHub', icon: Github, raw: user.social?.github || '' },
      { key: 'portfolio', label: 'Portfolio', icon: ExternalLink, raw: user.social?.portfolio || '' },
      { key: 'instagram', label: 'Instagram', icon: Instagram, raw: user.social?.instagram || '' },
      { key: 'facebook', label: 'Facebook', icon: Facebook, raw: user.social?.facebook || '' },
    ].map((s) => ({ ...s, href: resolveSocialUrl(s.key, s.raw) })),
    [user.social]
  );

  const persistProfile = (incoming) => {
    const existing = JSON.parse(localStorage.getItem('profile') || '{}');
    const merged = { ...(existing.result || existing), ...incoming };
    localStorage.setItem('profile', JSON.stringify(merged));
    return merged;
  };

  const closeEditor = () => {
    setFormData(buildFormData(user));
    setIsEditing(false);
  };

  const copyPublicProfileUrl = async () => {
    if (!publicProfileUrl) {
      dispatchToast('Public profile URL unavailable until college ID is set.', 'error');
      return;
    }

    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(publicProfileUrl);
      } else {
        const temp = document.createElement('textarea');
        temp.value = publicProfileUrl;
        document.body.appendChild(temp);
        temp.select();
        document.execCommand('copy');
        temp.remove();
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
      dispatchToast('Public profile URL copied.', 'success');
    } catch {
      dispatchToast('Unable to copy URL. Please copy manually.', 'error');
    }
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = {
        name: formData.name.trim(),
        phone: formData.phone.trim(),
        year: formData.year.trim(),
        branch: formData.branch.trim().toLowerCase(),
        batch: formData.batch.trim(),
        joinedAt: formData.joinedAt || null,
        bio: formData.bio.trim(),
        skills: formData.skillsText
          .split(',')
          .map((v) => v.trim())
          .filter(Boolean),
        achievements: formData.achievementsText
          .split('\n')
          .map((v) => v.trim())
          .filter(Boolean),
        social: {
          linkedin: formData.social.linkedin.trim(),
          github: formData.social.github.trim(),
          portfolio: formData.social.portfolio.trim(),
          instagram: formData.social.instagram.trim(),
          facebook: formData.social.facebook.trim(),
        },
      };

      const { data } = await updateProfile(payload);
      const merged = persistProfile(data);
      setUser(merged);
      setFormData(buildFormData(merged));
      setWarnings(Array.isArray(merged.warnings) ? merged.warnings : warnings);
      setIsEditing(false);
      dispatchToast('Profile updated successfully.', 'success');
    } catch (err) {
      dispatchToast(err.response?.data?.message || 'Profile update failed.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    const currentPassword = String(passwordForm.currentPassword || '').trim();
    const newPassword = String(passwordForm.newPassword || '').trim();
    const confirmPassword = String(passwordForm.confirmPassword || '').trim();

    if (!currentPassword || !newPassword || !confirmPassword) {
      dispatchToast('Please fill all password fields.', 'error');
      return;
    }
    if (newPassword.length < 6) {
      dispatchToast('New password must be at least 6 characters.', 'error');
      return;
    }
    if (newPassword !== confirmPassword) {
      dispatchToast('New password and confirm password do not match.', 'error');
      return;
    }

    setPasswordBusy(true);
    try {
      await changePassword({ currentPassword, newPassword });
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      dispatchToast('Password changed successfully.', 'success');
    } catch (err) {
      dispatchToast(err.response?.data?.message || 'Unable to change password.', 'error');
    } finally {
      setPasswordBusy(false);
    }
  };

  const handleLogout = () => {
    localStorage.clear();
    window.location.href = '/login';
  };

  useEffect(() => {
    let isActive = true;
    const loadProfile = async () => {
      try {
        const { data } = await getMe();
        if (!isActive) return;

        let merged = persistProfile(data);
        setWarnings(Array.isArray(data.warnings) ? data.warnings : []);

        if (data.hasUnreadWarning) {
          await acknowledgeWarnings().catch(() => {});
          merged = { ...merged, hasUnreadWarning: false };
          localStorage.setItem('profile', JSON.stringify(merged));
        }

        if (!isActive) return;
        setUser(merged);
        setFormData(buildFormData(merged));
      } catch {
        // keep cached profile data
      }
    };

    loadProfile();
    return () => {
      isActive = false;
    };
  }, []);

  return (
    <div className="max-w-6xl mx-auto pb-10 md:pb-16 space-y-8 px-1 sm:px-0 page-motion-c">
      <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="pt-2 section-motion section-motion-delay-1">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
          <div className="flex items-start gap-3 sm:gap-4 min-w-0">
            <div className="h-16 w-16 sm:h-20 sm:w-20 rounded-2xl bg-gradient-to-br from-cyan-400 via-blue-500 to-indigo-500 flex items-center justify-center text-2xl md:text-3xl font-black text-white shrink-0 shadow-lg shadow-cyan-500/20">
              {user.name ? user.name[0].toUpperCase() : 'U'}
            </div>
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-[0.24em] text-cyan-300/90 font-black">My Profile</p>
              <h1 className="profile-title-flow text-3xl md:text-4xl font-black tracking-tight break-words">{user.name || 'Member'}</h1>
              <div className="mt-2 space-y-1 text-xs text-gray-300">
                <p className="inline-flex items-center gap-1.5 break-all"><Mail size={12} className="text-cyan-300" /> {user.email || 'No email'}</p>
                <p className="inline-flex items-center gap-1.5"><SquareUser size={12} className="text-cyan-300" /> {user.role || 'Member'}</p>
                <p className="inline-flex items-center gap-1.5"><Hash size={12} className="text-cyan-300" /> {user.collegeId || 'No College ID'}</p>
              </div>
            </div>
          </div>

          <div className="w-full lg:w-auto flex flex-col sm:flex-row gap-2">
            <button
              type="button"
              onClick={copyPublicProfileUrl}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-500/20 px-3 py-2 text-sm text-cyan-100 hover:bg-cyan-500/30 transition-colors"
            >
              {copied ? <Save size={14} /> : <Copy size={14} />}
              {copied ? 'Copied' : 'Copy URL'}
            </button>
            {publicProfileUrl && (
              <a
                href={publicProfileUrl}
                target="_blank"
                rel="noreferrer"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-blue-500/20 px-3 py-2 text-sm text-blue-100 hover:bg-blue-500/30 transition-colors"
              >
                <ExternalLink size={14} />
                Public View
              </a>
            )}
          </div>
        </div>

        <p className="mt-5 text-sm md:text-base text-gray-300 leading-relaxed max-w-4xl">
          {user.bio || 'Add a professional bio to highlight your CICR journey, role interests, and technical strengths.'}
        </p>
        <p className="mt-2 text-sm text-cyan-200 break-all">{publicProfileUrl || 'Public profile URL unavailable'}</p>
      </motion.section>

      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5 section-motion section-motion-delay-2 pro-stagger">
        <MetricCard label="Profile Completion" value={`${completionScore}%`} helper="Keep this above 85%" />
        <MetricCard label="Skills Listed" value={skills.length} helper="Technical + domain skills" />
        <MetricCard label="Achievements" value={achievements.length} helper="Credible accomplishments" />
        <MetricCard label="Years in CICR" value={yearsInCicr(user.joinedAt)} helper={`Joined ${fmtDate(user.joinedAt)}`} />
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-2 gap-8 section-motion section-motion-delay-2">
        <article>
          <h2 className="profile-section-flow text-xl font-black inline-flex items-center gap-2">
            <Briefcase size={17} className="text-cyan-300" />
            Professional Snapshot
          </h2>
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <ProfileRow icon={Phone} label="Phone" value={user.phone} />
            <ProfileRow icon={Calendar} label="Year" value={user.year} />
            <ProfileRow icon={BookOpen} label="Branch" value={(user.branch || '').toUpperCase()} />
            <ProfileRow icon={Hash} label="Batch" value={user.batch} />
          </div>
        </article>

        <article>
          <h2 className="profile-section-flow text-xl font-black inline-flex items-center gap-2">
            <LinkIcon size={17} className="text-cyan-300" />
            Social Presence
          </h2>
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-y-2 gap-x-4">
            {socialItems.map(({ key, label, icon: Icon, raw, href }) => (
              <a
                key={key}
                href={href || undefined}
                target={href ? '_blank' : undefined}
                rel={href ? 'noreferrer' : undefined}
                className={`py-1 inline-flex flex-col min-w-0 ${href ? 'text-cyan-100 hover:text-cyan-300' : 'text-gray-500'}`}
              >
                <span className="text-[10px] uppercase tracking-widest font-black inline-flex items-center gap-1.5">
                  <Icon size={13} className={href ? 'text-cyan-300' : 'text-gray-500'} /> {label}
                </span>
                <span className="text-sm mt-1 break-all">{raw || 'Not added'}</span>
              </a>
            ))}
          </div>
        </article>
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-2 gap-8 section-motion section-motion-delay-3">
        <article>
          <h2 className="profile-section-flow text-xl font-black inline-flex items-center gap-2">
            <Briefcase size={17} className="text-cyan-300" />
            Skills
          </h2>
          <ul className="mt-3 space-y-1.5 text-sm">
            {skills.length === 0 && <li className="text-gray-500">No skills added yet.</li>}
            {skills.map((skill) => (
              <li key={skill} className="text-cyan-100 inline-flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-cyan-300" />
                {skill}
              </li>
            ))}
          </ul>
        </article>

        <article>
          <h2 className="profile-section-flow text-xl font-black inline-flex items-center gap-2">
            <Award size={17} className="text-cyan-300" />
            Achievements
          </h2>
          <ul className="mt-3 space-y-1.5 text-sm text-gray-200">
            {achievements.length === 0 && <li className="text-gray-500">No achievements added yet.</li>}
            {achievements.map((item, idx) => (
              <li key={`${item}-${idx}`} className="inline-flex items-start gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-blue-300 shrink-0" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </article>
      </section>

      {warnings.length > 0 && (
        <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="section-motion section-motion-delay-3">
          <h2 className="text-sm font-black uppercase tracking-widest text-red-300 mb-3 inline-flex items-center gap-2">
            <ShieldAlert size={15} />
            Admin Warnings
          </h2>
          <div className="space-y-3">
            {warnings.slice(0, 5).map((warning, idx) => (
              <article key={idx}>
                <p className="text-sm text-red-100">{warning.reason}</p>
                <p className="text-[10px] uppercase tracking-widest text-red-300/80 mt-1.5">
                  {warning.issuedBy?.name || 'Admin'} • {new Date(warning.issuedAt).toLocaleString()}
                </p>
              </article>
            ))}
          </div>
        </motion.section>
      )}

      <section className="section-motion section-motion-delay-3">
        <h2 className="profile-section-flow text-xl font-black inline-flex items-center gap-2">
          <Lock size={17} className="text-cyan-300" />
          Password & Security
        </h2>
        <p className="mt-2 text-xs text-gray-500">
          Change your password from here anytime. If you forget it and email OTP is unavailable, ask Admin/Head for a reset code.
        </p>
        <form onSubmit={handlePasswordChange} className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Current Password</label>
            <input
              type="password"
              value={passwordForm.currentPassword}
              onChange={(e) => setPasswordForm((prev) => ({ ...prev, currentPassword: e.target.value }))}
              className="w-full bg-[#0a0f16]/85 p-3.5 rounded-xl outline-none focus:ring-2 focus:ring-cyan-400/55 text-white placeholder:text-gray-600"
              placeholder="Current password"
              disabled={passwordBusy}
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">New Password</label>
            <input
              type="password"
              value={passwordForm.newPassword}
              onChange={(e) => setPasswordForm((prev) => ({ ...prev, newPassword: e.target.value }))}
              className="w-full bg-[#0a0f16]/85 p-3.5 rounded-xl outline-none focus:ring-2 focus:ring-cyan-400/55 text-white placeholder:text-gray-600"
              placeholder="Minimum 6 characters"
              disabled={passwordBusy}
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Confirm Password</label>
            <input
              type="password"
              value={passwordForm.confirmPassword}
              onChange={(e) => setPasswordForm((prev) => ({ ...prev, confirmPassword: e.target.value }))}
              className="w-full bg-[#0a0f16]/85 p-3.5 rounded-xl outline-none focus:ring-2 focus:ring-cyan-400/55 text-white placeholder:text-gray-600"
              placeholder="Re-enter new password"
              disabled={passwordBusy}
            />
          </div>
          <div className="md:col-span-3 flex justify-end">
            <button
              type="submit"
              disabled={passwordBusy}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-500/20 px-4 py-2.5 text-sm text-cyan-100 hover:bg-cyan-500/30 disabled:opacity-60"
            >
              {passwordBusy ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              Update Password
            </button>
          </div>
        </form>
      </section>

      <AnimatePresence>
        {isEditing && (
          <motion.section initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 14 }} className="section-motion section-motion-delay-3">
            <div className="flex items-center justify-between gap-3 mb-5">
              <h2 className="profile-section-flow text-xl font-black">Edit Profile Details</h2>
              <button
                type="button"
                onClick={closeEditor}
                className="inline-flex items-center gap-2 rounded-xl bg-gray-700/40 px-3 py-2 text-sm text-gray-300 hover:text-white"
              >
                <X size={14} />
                Close
              </button>
            </div>

            <form onSubmit={handleUpdate} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <InputField
                icon={User}
                label="Full Name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Your full name"
                disabled={loading}
              />

              <InputField
                icon={Phone}
                label="Phone"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="+91 00000 00000"
                disabled={loading}
              />

              <InputField
                icon={Calendar}
                label="Year"
                value={formData.year}
                onChange={(e) => setFormData({ ...formData, year: e.target.value })}
                placeholder="e.g. 3"
                disabled={loading}
              />

              <InputField
                icon={BookOpen}
                label="Branch"
                value={formData.branch}
                onChange={(e) => setFormData({ ...formData, branch: e.target.value.toUpperCase() })}
                placeholder="e.g. CSE"
                disabled={loading}
              />

              <InputField
                icon={Hash}
                label="Batch"
                value={formData.batch}
                onChange={(e) => setFormData({ ...formData, batch: e.target.value })}
                placeholder="e.g. E16, F5"
                disabled={loading}
              />

              <InputField
                icon={Calendar}
                label="Joined Date"
                type="date"
                value={formData.joinedAt}
                onChange={(e) => setFormData({ ...formData, joinedAt: e.target.value })}
                disabled={loading}
              />

              <div className="md:col-span-2 space-y-2">
                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Professional Bio</label>
                <textarea
                  value={formData.bio}
                  onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                  rows={3}
                  disabled={loading}
                  placeholder="Write your CICR journey, domain strengths, and current focus."
                  className="w-full bg-[#0a0f16]/85 p-3.5 rounded-xl outline-none focus:ring-2 focus:ring-cyan-400/55 disabled:opacity-60 transition-all text-white placeholder:text-gray-600"
                />
              </div>

              <div className="md:col-span-2 space-y-2">
                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Skills (comma-separated)</label>
                <input
                  value={formData.skillsText}
                  onChange={(e) => setFormData({ ...formData, skillsText: e.target.value })}
                  disabled={loading}
                  placeholder="React, Node.js, ML, Embedded Systems"
                  className="w-full bg-[#0a0f16]/85 p-3.5 rounded-xl outline-none focus:ring-2 focus:ring-cyan-400/55 disabled:opacity-60 transition-all text-white placeholder:text-gray-600"
                />
              </div>

              <div className="md:col-span-2 space-y-2">
                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Achievements (one per line)</label>
                <textarea
                  value={formData.achievementsText}
                  onChange={(e) => setFormData({ ...formData, achievementsText: e.target.value })}
                  rows={4}
                  disabled={loading}
                  placeholder="Won XYZ hackathon&#10;Published ABC paper"
                  className="w-full bg-[#0a0f16]/85 p-3.5 rounded-xl outline-none focus:ring-2 focus:ring-cyan-400/55 disabled:opacity-60 transition-all text-white placeholder:text-gray-600"
                />
              </div>

              <InputField
                icon={LinkIcon}
                label="LinkedIn"
                value={formData.social.linkedin}
                onChange={(e) => setFormData({ ...formData, social: { ...formData.social, linkedin: e.target.value } })}
                placeholder="linkedin.com/in/username"
                disabled={loading}
              />

              <InputField
                icon={Github}
                label="GitHub"
                value={formData.social.github}
                onChange={(e) => setFormData({ ...formData, social: { ...formData.social, github: e.target.value } })}
                placeholder="github.com/username"
                disabled={loading}
              />

              <InputField
                icon={ExternalLink}
                label="Portfolio"
                value={formData.social.portfolio}
                onChange={(e) => setFormData({ ...formData, social: { ...formData.social, portfolio: e.target.value } })}
                placeholder="yourdomain.com"
                disabled={loading}
              />

              <InputField
                icon={Instagram}
                label="Instagram"
                value={formData.social.instagram}
                onChange={(e) => setFormData({ ...formData, social: { ...formData.social, instagram: e.target.value } })}
                placeholder="@username"
                disabled={loading}
              />

              <div className="md:col-span-2">
                <InputField
                  icon={Facebook}
                  label="Facebook"
                  value={formData.social.facebook}
                  onChange={(e) => setFormData({ ...formData, social: { ...formData.social, facebook: e.target.value } })}
                  placeholder="@username"
                  disabled={loading}
                />
              </div>

              <div className="md:col-span-2 flex flex-col sm:flex-row sm:justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={closeEditor}
                  disabled={loading}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-gray-700/40 px-4 py-2.5 text-sm text-gray-300 hover:text-white disabled:opacity-60"
                >
                  <X size={14} />
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-500/20 px-4 py-2.5 text-sm text-cyan-100 hover:bg-cyan-500/30 disabled:opacity-60"
                >
                  {loading ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                  Save Changes
                </button>
              </div>
            </form>
          </motion.section>
        )}
      </AnimatePresence>

      <section className="pt-1 section-motion section-motion-delay-3">
        <p className="text-sm text-gray-300 leading-relaxed">
          Keep your profile current so collaborators can find your expertise quickly and contact you directly.
        </p>
        <div className="mt-4 flex flex-col sm:flex-row gap-2">
          <button
            type="button"
            onClick={() => setIsEditing((prev) => !prev)}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-500/20 px-4 py-2.5 text-sm text-cyan-100 hover:bg-cyan-500/30"
          >
            {isEditing ? <X size={14} /> : <Edit2 size={14} />}
            {isEditing ? 'Close Editor' : 'Edit Profile'}
          </button>
          <button
            type="button"
            onClick={copyPublicProfileUrl}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-blue-500/20 px-4 py-2.5 text-sm text-blue-100 hover:bg-blue-500/30"
          >
            <Copy size={14} />
            Copy Public URL
          </button>
          <button
            type="button"
            onClick={handleLogout}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-red-500/20 px-4 py-2.5 text-sm text-red-100 hover:bg-red-500/30"
          >
            <LogOut size={14} />
            Logout
          </button>
        </div>
      </section>
    </div>
  );
}
