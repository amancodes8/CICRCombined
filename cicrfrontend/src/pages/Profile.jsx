import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Award,
  Building2,
  BookOpen,
  Briefcase,
  Calendar,
  CheckCircle2,
  Copy,
  Circle,
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
  MapPin,
  Phone,
  Plus,
  Save,
  ShieldAlert,
  SquareUser,
  Trash2,
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

const ALUMNI_AVAILABILITY_OPTIONS = ['Flexible', 'Weekends', 'Evenings', 'Limited', 'Unavailable'];

const createEmptyTenure = () => ({
  position: '',
  fromYear: '',
  toYear: '',
});

const buildFormData = (user = {}) => ({
  name: user.name || '',
  phone: user.phone || '',
  year: user.year || '',
  branch: (user.branch || '').toUpperCase(),
  batch: user.batch || '',
  joinedAt: dateToInput(user.joinedAt),
  bio: user.bio || '',
  avatarUrl: user.avatarUrl || '',
  skillsText: (user.skills || []).join(', '),
  achievementsText: (user.achievements || []).join('\n'),
  social: {
    linkedin: user.social?.linkedin || '',
    github: user.social?.github || '',
    portfolio: user.social?.portfolio || '',
    instagram: user.social?.instagram || '',
    facebook: user.social?.facebook || '',
  },
  alumniProfile: {
    graduationYear: user.alumniProfile?.graduationYear || '',
    currentOrganization: user.alumniProfile?.currentOrganization || '',
    currentDesignation: user.alumniProfile?.currentDesignation || '',
    location: user.alumniProfile?.location || '',
    willingToMentor:
      typeof user.alumniProfile?.willingToMentor === 'boolean'
        ? user.alumniProfile.willingToMentor
        : true,
    mentorshipAreasText: Array.isArray(user.alumniProfile?.mentorshipAreas)
      ? user.alumniProfile.mentorshipAreas.join(', ')
      : '',
    availabilityMode: user.alumniProfile?.availabilityMode || 'Flexible',
    notableProjects: user.alumniProfile?.notableProjects || '',
    tenures:
      Array.isArray(user.alumniProfile?.tenures) && user.alumniProfile.tenures.length > 0
        ? user.alumniProfile.tenures.map((row) => ({
            position: row?.position || '',
            fromYear: row?.fromYear || '',
            toYear: row?.toYear || '',
          }))
        : [createEmptyTenure()],
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
  const [avatarFailed, setAvatarFailed] = useState(false);
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
  const isAlumni = String(user.role || '').toLowerCase() === 'alumni';
  const alumniTenures = Array.isArray(user.alumniProfile?.tenures) ? user.alumniProfile.tenures : [];
  const alumniMentorshipAreas = Array.isArray(user.alumniProfile?.mentorshipAreas)
    ? user.alumniProfile.mentorshipAreas
    : [];

  const completionScore = useMemo(() => {
    const checks = isAlumni
      ? [
          !!user.name,
          !!user.phone,
          !!user.joinedAt,
          !!user.bio,
          skills.length > 0,
          achievements.length > 0,
          !!user.alumniProfile?.graduationYear,
          alumniTenures.length > 0,
          !!user.alumniProfile?.currentOrganization,
          Object.values(user.social || {}).some((v) => String(v || '').trim()),
        ]
      : [
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
  }, [
    achievements.length,
    alumniTenures.length,
    isAlumni,
    skills.length,
    user.alumniProfile?.currentOrganization,
    user.alumniProfile?.graduationYear,
    user.batch,
    user.bio,
    user.branch,
    user.joinedAt,
    user.name,
    user.phone,
    user.social,
    user.year,
  ]);

  const profileChecklist = useMemo(
    () =>
      isAlumni
        ? [
            { id: 'identity', label: 'Identity details', done: Boolean(user.name && user.phone && user.collegeId) },
            { id: 'timeline', label: 'CICR tenure timeline', done: alumniTenures.length > 0 },
            {
              id: 'alumni-role',
              label: 'Current professional role',
              done: Boolean(user.alumniProfile?.currentOrganization && user.alumniProfile?.currentDesignation),
            },
            { id: 'about', label: 'Professional bio', done: Boolean(user.bio) },
            { id: 'skills', label: 'Skills listed', done: skills.length > 0 },
            { id: 'achievements', label: 'Achievements listed', done: achievements.length > 0 },
            { id: 'social', label: 'Social links', done: Object.values(user.social || {}).some((v) => String(v || '').trim()) },
          ]
        : [
            { id: 'identity', label: 'Identity details', done: Boolean(user.name && user.phone && user.collegeId) },
            { id: 'academic', label: 'Academic context', done: Boolean(user.year && user.branch && user.batch) },
            { id: 'about', label: 'Professional bio', done: Boolean(user.bio) },
            { id: 'skills', label: 'Skills listed', done: skills.length > 0 },
            { id: 'achievements', label: 'Achievements listed', done: achievements.length > 0 },
            { id: 'social', label: 'Social links', done: Object.values(user.social || {}).some((v) => String(v || '').trim()) },
          ],
    [
      achievements.length,
      alumniTenures.length,
      isAlumni,
      skills.length,
      user.alumniProfile?.currentDesignation,
      user.alumniProfile?.currentOrganization,
      user.batch,
      user.bio,
      user.branch,
      user.collegeId,
      user.name,
      user.phone,
      user.social,
      user.year,
    ]
  );

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

  useEffect(() => {
    setAvatarFailed(false);
  }, [user.avatarUrl]);

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

  const updateAlumniFormField = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      alumniProfile: {
        ...prev.alumniProfile,
        [field]: value,
      },
    }));
  };

  const updateAlumniTenure = (index, field, value) => {
    setFormData((prev) => ({
      ...prev,
      alumniProfile: {
        ...prev.alumniProfile,
        tenures: prev.alumniProfile.tenures.map((row, rowIdx) =>
          rowIdx === index ? { ...row, [field]: value } : row
        ),
      },
    }));
  };

  const addAlumniTenure = () => {
    setFormData((prev) => ({
      ...prev,
      alumniProfile: {
        ...prev.alumniProfile,
        tenures: [...(prev.alumniProfile.tenures || []), createEmptyTenure()],
      },
    }));
  };

  const removeAlumniTenure = (index) => {
    setFormData((prev) => {
      const rows = (prev.alumniProfile.tenures || []).filter((_, rowIdx) => rowIdx !== index);
      return {
        ...prev,
        alumniProfile: {
          ...prev.alumniProfile,
          tenures: rows.length ? rows : [createEmptyTenure()],
        },
      };
    });
  };

  const handleUpdate = async (e) => {
    e.preventDefault();

    const name = String(formData.name || '').trim();
    const phone = String(formData.phone || '').trim();
    const yearRaw = String(formData.year || '').trim();
    const joinedAtRaw = String(formData.joinedAt || '').trim();

    if (!name) {
      dispatchToast('Name is required.', 'error');
      return;
    }

    if (!isAlumni && yearRaw) {
      const yearNum = Number(yearRaw);
      if (!Number.isFinite(yearNum) || yearNum < 1 || yearNum > 6) {
        dispatchToast('Year must be a number between 1 and 6.', 'error');
        return;
      }
    }

    if (joinedAtRaw) {
      const joinedDate = new Date(joinedAtRaw);
      if (Number.isNaN(joinedDate.getTime())) {
        dispatchToast('Joined date is invalid.', 'error');
        return;
      }
    }

    const alumniTenureRows = (formData.alumniProfile?.tenures || [])
      .map((row) => ({
        position: String(row.position || '').trim(),
        fromYear: String(row.fromYear || '').trim(),
        toYear: String(row.toYear || '').trim(),
      }))
      .filter((row) => row.position || row.fromYear || row.toYear);

    const parsedAlumniTenures = [];
    if (isAlumni) {
      for (let i = 0; i < alumniTenureRows.length; i += 1) {
        const row = alumniTenureRows[i];
        const rowLabel = `Tenure #${i + 1}`;
        if (!row.position) {
          dispatchToast(`${rowLabel}: position is required.`, 'error');
          return;
        }
        if (!row.fromYear || !row.toYear) {
          dispatchToast(`${rowLabel}: both start year and end year are required.`, 'error');
          return;
        }
        const fromYear = Number(row.fromYear);
        const toYear = Number(row.toYear);
        if (!Number.isFinite(fromYear) || !Number.isFinite(toYear)) {
          dispatchToast(`${rowLabel}: years must be valid numbers.`, 'error');
          return;
        }
        if (fromYear < 2000 || toYear > 2100) {
          dispatchToast(`${rowLabel}: year must be between 2000 and 2100.`, 'error');
          return;
        }
        if (toYear < fromYear) {
          dispatchToast(`${rowLabel}: end year cannot be earlier than start year.`, 'error');
          return;
        }
        if (toYear - fromYear > 3) {
          dispatchToast(`${rowLabel}: CICR tenure cannot exceed 4 years.`, 'error');
          return;
        }
        parsedAlumniTenures.push({
          position: row.position,
          fromYear,
          toYear,
        });
      }

      if (parsedAlumniTenures.length > 0) {
        const minFrom = Math.min(...parsedAlumniTenures.map((row) => row.fromYear));
        const maxTo = Math.max(...parsedAlumniTenures.map((row) => row.toYear));
        if (maxTo - minFrom > 3) {
          dispatchToast('Combined CICR timeline cannot exceed 4 years for one member.', 'error');
          return;
        }
      }
    }

    setLoading(true);
    try {
      const parsedYear = !isAlumni && yearRaw ? Number(yearRaw) : null;
      const graduationYearRaw = String(formData.alumniProfile?.graduationYear || '').trim();
      const graduationYear = graduationYearRaw ? Number(graduationYearRaw) : null;
      if (isAlumni && graduationYearRaw && (!Number.isFinite(graduationYear) || graduationYear < 2000 || graduationYear > 2100)) {
        dispatchToast('Graduation year must be between 2000 and 2100.', 'error');
        setLoading(false);
        return;
      }

      const payload = {
        name,
        phone,
        year: parsedYear,
        branch: formData.branch.trim().toUpperCase(),
        batch: formData.batch.trim(),
        joinedAt: formData.joinedAt || null,
        bio: formData.bio.trim(),
        avatarUrl: String(formData.avatarUrl || '').trim(),
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
      if (isAlumni) {
        payload.alumniProfile = {
          graduationYear,
          currentOrganization: String(formData.alumniProfile?.currentOrganization || '').trim(),
          currentDesignation: String(formData.alumniProfile?.currentDesignation || '').trim(),
          location: String(formData.alumniProfile?.location || '').trim(),
          willingToMentor: Boolean(formData.alumniProfile?.willingToMentor),
          mentorshipAreas: String(formData.alumniProfile?.mentorshipAreasText || '')
            .split(',')
            .map((v) => v.trim())
            .filter(Boolean),
          availabilityMode: ALUMNI_AVAILABILITY_OPTIONS.includes(String(formData.alumniProfile?.availabilityMode || ''))
            ? formData.alumniProfile.availabilityMode
            : 'Flexible',
          notableProjects: String(formData.alumniProfile?.notableProjects || '').trim(),
          tenures: parsedAlumniTenures,
        };
      }

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
      <motion.section id="about" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="pt-2 section-motion section-motion-delay-1">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
          <div className="flex items-start gap-3 sm:gap-4 min-w-0">
            <div className="h-16 w-16 sm:h-20 sm:w-20 rounded-2xl bg-gradient-to-br from-cyan-400 via-blue-500 to-indigo-500 flex items-center justify-center text-2xl md:text-3xl font-black text-white shrink-0 shadow-lg shadow-cyan-500/20 overflow-hidden">
              {user.avatarUrl && !avatarFailed ? (
                <img
                  src={user.avatarUrl}
                  alt={user.name || 'Profile'}
                  className="h-full w-full object-cover"
                  onError={() => setAvatarFailed(true)}
                />
              ) : (
                <span>{user.name ? user.name[0].toUpperCase() : 'U'}</span>
              )}
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

      <section className="grid grid-cols-1 xl:grid-cols-12 gap-5 section-motion section-motion-delay-2">
        <article className="xl:col-span-7 ui-surface-soft p-4 md:p-5">
          <p className="text-[10px] uppercase tracking-[0.18em] text-gray-500 font-black">Section Jump Links</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {[
              { id: 'about', label: 'About' },
              { id: 'snapshot', label: 'Snapshot' },
              ...(isAlumni ? [{ id: 'alumni', label: 'Alumni Portal' }] : []),
              { id: 'skills', label: 'Skills' },
              { id: 'achievements', label: 'Achievements' },
              { id: 'security', label: 'Security' },
            ].map((item) => (
              <a key={item.id} href={`#${item.id}`} className="btn btn-ghost !w-auto !px-3 !py-1.5">
                {item.label}
              </a>
            ))}
          </div>
        </article>

        <article className="xl:col-span-5 ui-surface-soft p-4 md:p-5">
          <p className="text-[10px] uppercase tracking-[0.18em] text-gray-500 font-black">Completion Checklist</p>
          <div className="mt-3 space-y-2">
            {profileChecklist.map((item) => (
              <div key={item.id} className="flex items-center justify-between text-sm">
                <span className={item.done ? 'text-gray-200' : 'text-gray-500'}>{item.label}</span>
                <span className={item.done ? 'text-emerald-300' : 'text-gray-600'}>
                  {item.done ? <CheckCircle2 size={14} /> : <Circle size={14} />}
                </span>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5 section-motion section-motion-delay-2 pro-stagger">
        <MetricCard label="Profile Completion" value={`${completionScore}%`} helper="Keep this above 85%" />
        <MetricCard label="Skills Listed" value={skills.length} helper="Technical + domain skills" />
        <MetricCard label="Achievements" value={achievements.length} helper="Credible accomplishments" />
        <MetricCard label="Years in CICR" value={yearsInCicr(user.joinedAt)} helper={`Joined ${fmtDate(user.joinedAt)}`} />
      </section>

      <section id="snapshot" className="grid grid-cols-1 xl:grid-cols-2 gap-8 section-motion section-motion-delay-2">
        <article>
          <h2 className="profile-section-flow text-xl font-black inline-flex items-center gap-2">
            <Briefcase size={17} className="text-cyan-300" />
            Professional Snapshot
          </h2>
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <ProfileRow icon={Phone} label="Phone" value={user.phone} />
            <ProfileRow icon={Calendar} label={isAlumni ? 'Graduation Year' : 'Year'} value={isAlumni ? user.alumniProfile?.graduationYear : user.year} />
            <ProfileRow icon={BookOpen} label="Branch" value={(user.branch || '').toUpperCase()} />
            <ProfileRow icon={Hash} label="Batch" value={user.batch} />
            {isAlumni && (
              <>
                <ProfileRow icon={Building2} label="Organization" value={user.alumniProfile?.currentOrganization} />
                <ProfileRow icon={Briefcase} label="Designation" value={user.alumniProfile?.currentDesignation} />
                <ProfileRow icon={MapPin} label="Location" value={user.alumniProfile?.location} />
                <ProfileRow icon={User} label="Mentorship" value={user.alumniProfile?.willingToMentor ? 'Available for mentorship' : 'Mentorship unavailable'} />
              </>
            )}
          </div>
        </article>

        <article id="social">
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

      {isAlumni && (
        <section id="alumni" className="grid grid-cols-1 xl:grid-cols-12 gap-8 section-motion section-motion-delay-3">
          <article className="xl:col-span-7">
            <h2 className="profile-section-flow text-xl font-black inline-flex items-center gap-2">
              <Briefcase size={17} className="text-cyan-300" />
              CICR Role Timeline
            </h2>
            <div className="mt-3 space-y-2.5">
              {alumniTenures.length === 0 && <p className="text-sm text-gray-500">No tenure history added yet.</p>}
              {alumniTenures.map((tenure, idx) => (
                <article key={`${tenure.position}-${idx}`} className="rounded-xl border border-gray-700/75 bg-[#0a0f16]/65 p-3">
                  <p className="text-sm font-bold text-cyan-100">{tenure.position}</p>
                  <p className="text-xs text-gray-400 mt-1">
                    {tenure.fromYear || 'N/A'} - {tenure.toYear || 'N/A'}
                  </p>
                </article>
              ))}
            </div>
          </article>

          <article className="xl:col-span-5">
            <h2 className="profile-section-flow text-xl font-black inline-flex items-center gap-2">
              <BookOpen size={17} className="text-cyan-300" />
              Alumni Contribution Focus
            </h2>
            <div className="mt-3 space-y-2.5">
              <p className="text-sm text-gray-300">
                {user.alumniProfile?.notableProjects || 'Add notable alumni support areas, talks, projects, or contributions.'}
              </p>
              <div className="flex flex-wrap gap-2">
                {alumniMentorshipAreas.length === 0 && <span className="text-xs text-gray-500">No mentorship areas listed.</span>}
                {alumniMentorshipAreas.map((area) => (
                  <span key={area} className="text-xs px-2.5 py-1 rounded-full border border-cyan-500/35 text-cyan-200">
                    {area}
                  </span>
                ))}
              </div>
              <p className="text-xs text-gray-500">
                Availability mode: <span className="text-gray-300">{user.alumniProfile?.availabilityMode || 'Flexible'}</span>
              </p>
            </div>
          </article>
        </section>
      )}

      <section className="grid grid-cols-1 xl:grid-cols-2 gap-8 section-motion section-motion-delay-3">
        <article id="skills">
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

        <article id="achievements">
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

      <section id="security" className="section-motion section-motion-delay-3">
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
                icon={LinkIcon}
                label="Profile Picture URL"
                value={formData.avatarUrl}
                onChange={(e) => setFormData({ ...formData, avatarUrl: e.target.value })}
                placeholder="https://.../your-photo.jpg"
                disabled={loading}
              />

              {!isAlumni && (
                <InputField
                  icon={Calendar}
                  label="Year"
                  value={formData.year}
                  onChange={(e) => setFormData({ ...formData, year: e.target.value })}
                  placeholder="e.g. 3"
                  disabled={loading}
                />
              )}

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

              {isAlumni && (
                <>
                  <InputField
                    icon={Calendar}
                    label="Graduation Year"
                    value={formData.alumniProfile.graduationYear}
                    onChange={(e) => updateAlumniFormField('graduationYear', e.target.value)}
                    placeholder="e.g. 2022"
                    disabled={loading}
                  />

                  <InputField
                    icon={Building2}
                    label="Current Organization"
                    value={formData.alumniProfile.currentOrganization}
                    onChange={(e) => updateAlumniFormField('currentOrganization', e.target.value)}
                    placeholder="Company / Institution"
                    disabled={loading}
                  />

                  <InputField
                    icon={Briefcase}
                    label="Current Designation"
                    value={formData.alumniProfile.currentDesignation}
                    onChange={(e) => updateAlumniFormField('currentDesignation', e.target.value)}
                    placeholder="Role / Title"
                    disabled={loading}
                  />

                  <InputField
                    icon={MapPin}
                    label="Location"
                    value={formData.alumniProfile.location}
                    onChange={(e) => updateAlumniFormField('location', e.target.value)}
                    placeholder="City, Country"
                    disabled={loading}
                  />

                  <div className="md:col-span-2 rounded-xl border border-gray-700/70 p-3 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[10px] uppercase tracking-widest text-gray-400 font-black">CICR Role Timeline</p>
                      <button
                        type="button"
                        onClick={addAlumniTenure}
                        className="inline-flex items-center gap-1 rounded-lg border border-cyan-500/40 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-cyan-200"
                      >
                        <Plus size={12} />
                        Add
                      </button>
                    </div>
                    <p className="text-[11px] text-gray-500">
                      Add position and years (max total 4 years, for example 2021-2022 for Head).
                    </p>
                    <div className="space-y-2">
                      {(formData.alumniProfile.tenures || []).map((row, idx) => (
                        <div key={`tenure-${idx}`} className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                          <input
                            value={row.position}
                            onChange={(e) => updateAlumniTenure(idx, 'position', e.target.value)}
                            placeholder="Position (Head, Coordinator...)"
                            className="sm:col-span-6 w-full bg-[#0a0f16]/85 p-2.5 rounded-xl outline-none focus:ring-2 focus:ring-cyan-400/55 text-sm text-white placeholder:text-gray-600"
                            disabled={loading}
                          />
                          <input
                            value={row.fromYear}
                            onChange={(e) => updateAlumniTenure(idx, 'fromYear', e.target.value)}
                            placeholder="From"
                            className="sm:col-span-2 w-full bg-[#0a0f16]/85 p-2.5 rounded-xl outline-none focus:ring-2 focus:ring-cyan-400/55 text-sm text-white placeholder:text-gray-600"
                            disabled={loading}
                          />
                          <input
                            value={row.toYear}
                            onChange={(e) => updateAlumniTenure(idx, 'toYear', e.target.value)}
                            placeholder="To"
                            className="sm:col-span-2 w-full bg-[#0a0f16]/85 p-2.5 rounded-xl outline-none focus:ring-2 focus:ring-cyan-400/55 text-sm text-white placeholder:text-gray-600"
                            disabled={loading}
                          />
                          <button
                            type="button"
                            onClick={() => removeAlumniTenure(idx)}
                            className="sm:col-span-2 inline-flex items-center justify-center rounded-xl border border-gray-700 px-2 py-2 text-gray-400 hover:text-red-300 hover:border-red-500/40"
                            disabled={loading}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Mentorship Areas</label>
                      <input
                        value={formData.alumniProfile.mentorshipAreasText}
                        onChange={(e) => updateAlumniFormField('mentorshipAreasText', e.target.value)}
                        disabled={loading}
                        placeholder="AI, Placements, Product, Startups"
                        className="w-full bg-[#0a0f16]/85 p-3.5 rounded-xl outline-none focus:ring-2 focus:ring-cyan-400/55 disabled:opacity-60 transition-all text-white placeholder:text-gray-600"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Availability</label>
                      <select
                        value={formData.alumniProfile.availabilityMode}
                        onChange={(e) => updateAlumniFormField('availabilityMode', e.target.value)}
                        className="w-full bg-[#0a0f16]/85 p-3.5 rounded-xl outline-none focus:ring-2 focus:ring-cyan-400/55 text-white"
                        disabled={loading}
                      >
                        {ALUMNI_AVAILABILITY_OPTIONS.map((mode) => (
                          <option key={mode} value={mode}>
                            {mode}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="md:col-span-2 flex items-center gap-2 rounded-xl border border-gray-700/70 px-3 py-2.5">
                    <input
                      id="willing-to-mentor"
                      type="checkbox"
                      checked={Boolean(formData.alumniProfile.willingToMentor)}
                      onChange={(e) => updateAlumniFormField('willingToMentor', e.target.checked)}
                      disabled={loading}
                      className="h-4 w-4 accent-cyan-500"
                    />
                    <label htmlFor="willing-to-mentor" className="text-sm text-gray-300">
                      Open to mentorship sessions with current members
                    </label>
                  </div>

                  <div className="md:col-span-2 space-y-2">
                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Notable Alumni Contributions</label>
                    <textarea
                      value={formData.alumniProfile.notableProjects}
                      onChange={(e) => updateAlumniFormField('notableProjects', e.target.value)}
                      rows={3}
                      disabled={loading}
                      placeholder="Workshops, talks, projects, referrals, industry collaborations..."
                      className="w-full bg-[#0a0f16]/85 p-3.5 rounded-xl outline-none focus:ring-2 focus:ring-cyan-400/55 disabled:opacity-60 transition-all text-white placeholder:text-gray-600"
                    />
                  </div>
                </>
              )}

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

      <section className="pt-1 section-motion section-motion-delay-3 mobile-sticky-action">
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
