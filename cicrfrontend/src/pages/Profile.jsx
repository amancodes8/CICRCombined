import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  User, Phone, BookOpen, Calendar, Save, 
  Edit2, X, Hash, Mail, Loader2, Award, Briefcase, Link as LinkIcon 
} from 'lucide-react';
import { acknowledgeWarnings, getMe, updateProfile } from '../api';

export default function Profile() {
  // Get initial data from localStorage
  const profileData = JSON.parse(localStorage.getItem('profile') || '{}');
  const userData = profileData.result || profileData;

  const dateToInput = (value) => {
    if (!value) return '';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    return d.toISOString().slice(0, 10);
  };

  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [warnings, setWarnings] = useState(userData.warnings || []);

  const [formData, setFormData] = useState({
    name: userData.name || '',
    phone: userData.phone || '',
    year: userData.year || '',
    // UI displays in UPPERCASE
    branch: (userData.branch || '').toUpperCase(),
    batch: userData.batch || '',
    joinedAt: dateToInput(userData.joinedAt),
    bio: userData.bio || '',
    skillsText: (userData.skills || []).join(', '),
    achievementsText: (userData.achievements || []).join('\n'),
    social: {
      linkedin: userData.social?.linkedin || '',
      github: userData.social?.github || '',
      portfolio: userData.social?.portfolio || '',
    },
  });

  const handleUpdate = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = {
        ...formData,
        // STORE and COMPARE in lowercase
        branch: formData.branch.toLowerCase(),
        skills: formData.skillsText.split(',').map((v) => v.trim()).filter(Boolean),
        achievements: formData.achievementsText.split('\n').map((v) => v.trim()).filter(Boolean),
      };
      delete payload.skillsText;
      delete payload.achievementsText;

      const { data } = await updateProfile(payload);
      
      const normalized = { ...(profileData.result || profileData), ...data };
      localStorage.setItem('profile', JSON.stringify(normalized));
      
      setFormData((prev) => ({
        ...prev,
        name: data.name || '',
        phone: data.phone || '',
        year: data.year || '',
        // Format for UI after save
        branch: (data.branch || '').toUpperCase(),
        batch: data.batch || '',
        joinedAt: dateToInput(data.joinedAt),
        bio: data.bio || '',
        skillsText: (data.skills || []).join(', '),
        achievementsText: (data.achievements || []).join('\n'),
        social: {
          linkedin: data.social?.linkedin || '',
          github: data.social?.github || '',
          portfolio: data.social?.portfolio || '',
        },
      }));
      
      setIsEditing(false);
      alert('Profile updated successfully!');
    } catch (err) {
      alert(err.response?.data?.message || 'Update failed');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const loadProfileAndWarnings = async () => {
      try {
        const { data } = await getMe();
        setFormData((prev) => ({
          ...prev,
          name: data.name || '',
          phone: data.phone || '',
          year: data.year || '',
          // Ensure display is UPPERCASE on load
          branch: (data.branch || '').toUpperCase(),
          batch: data.batch || '',
          joinedAt: dateToInput(data.joinedAt),
          bio: data.bio || '',
          skillsText: (data.skills || []).join(', '),
          achievementsText: (data.achievements || []).join('\n'),
          social: {
            linkedin: data.social?.linkedin || '',
            github: data.social?.github || '',
            portfolio: data.social?.portfolio || '',
          },
        }));
        setWarnings(data.warnings || []);
        const existing = JSON.parse(localStorage.getItem('profile') || '{}');
        const merged = { ...(existing.result || existing), ...data };
        if (data.hasUnreadWarning) {
          await acknowledgeWarnings();
          merged.hasUnreadWarning = false;
        }
        localStorage.setItem('profile', JSON.stringify(merged));
      } catch (err) {
        // ignore
      }
    };
    loadProfileAndWarnings();
  }, []);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-[#141417] border border-gray-800 rounded-[2.5rem] overflow-hidden shadow-2xl"
      >
        <div className="h-32 bg-gradient-to-r from-blue-600 to-purple-600 relative">
          <div className="absolute -bottom-12 left-10">
            <div className="w-24 h-24 rounded-3xl bg-[#0a0a0c] border-4 border-[#141417] flex items-center justify-center text-3xl font-black text-blue-500 shadow-xl">
              {formData.name ? formData.name[0] : 'U'}
            </div>
          </div>
        </div>

        <div className="pt-16 pb-10 px-10">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-3xl font-black text-white">{formData.name}</h2>
              <div className="flex items-center gap-3 mt-1">
                <p className="text-gray-500 text-sm flex items-center gap-1"><Mail size={14}/> {userData.email}</p>
                <span className="text-[10px] bg-blue-600/20 text-blue-500 px-2 py-0.5 rounded font-black uppercase tracking-tighter">
                    {userData.role}
                </span>
              </div>
            </div>
            <button 
              onClick={() => setIsEditing(!isEditing)}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all ${
                isEditing ? 'bg-gray-800 text-white' : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              {isEditing ? <><X size={16} /> Cancel</> : <><Edit2 size={16} /> Edit Profile</>}
            </button>
          </div>

          <form onSubmit={handleUpdate} className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Full Name</label>
              <div className="relative">
                <User className={`absolute left-4 top-1/2 -translate-y-1/2 transition-colors ${isEditing ? 'text-blue-500' : 'text-gray-600'}`} size={18} />
                <input 
                  disabled={!isEditing}
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className="w-full bg-[#0a0a0c] border border-gray-800 p-4 pl-12 rounded-2xl outline-none focus:border-blue-500 disabled:opacity-50 transition-all text-white"
                />
              </div>
            </div>

            <div className="space-y-2 md:col-span-2">
              <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Professional Bio</label>
              <textarea
                disabled={!isEditing}
                value={formData.bio}
                onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                rows={3}
                className="w-full bg-[#0a0a0c] border border-gray-800 p-4 rounded-2xl outline-none focus:border-blue-500 disabled:opacity-50 transition-all text-white"
                placeholder="Write your CICR journey, core skills, and interests."
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1 flex items-center gap-2"><Briefcase size={12}/> Skills</label>
              <input
                disabled={!isEditing}
                value={formData.skillsText}
                onChange={(e) => setFormData({ ...formData, skillsText: e.target.value })}
                className="w-full bg-[#0a0a0c] border border-gray-800 p-4 rounded-2xl outline-none focus:border-blue-500 disabled:opacity-50 transition-all text-white"
                placeholder="React, Node.js, Research, Embedded Systems"
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1 flex items-center gap-2"><Award size={12}/> Achievements (one per line)</label>
              <textarea
                disabled={!isEditing}
                value={formData.achievementsText}
                onChange={(e) => setFormData({ ...formData, achievementsText: e.target.value })}
                rows={4}
                className="w-full bg-[#0a0a0c] border border-gray-800 p-4 rounded-2xl outline-none focus:border-blue-500 disabled:opacity-50 transition-all text-white"
                placeholder="Won XYZ hackathon&#10;Published ABC paper"
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">LinkedIn URL</label>
              <div className="relative">
                <LinkIcon className={`absolute left-4 top-1/2 -translate-y-1/2 transition-colors ${isEditing ? 'text-blue-500' : 'text-gray-600'}`} size={18} />
                <input
                  disabled={!isEditing}
                  value={formData.social.linkedin}
                  onChange={(e) => setFormData({ ...formData, social: { ...formData.social, linkedin: e.target.value } })}
                  className="w-full bg-[#0a0a0c] border border-gray-800 p-4 pl-12 rounded-2xl outline-none focus:border-blue-500 disabled:opacity-50 transition-all text-white"
                  placeholder="https://linkedin.com/in/username"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">GitHub URL</label>
              <div className="relative">
                <LinkIcon className={`absolute left-4 top-1/2 -translate-y-1/2 transition-colors ${isEditing ? 'text-blue-500' : 'text-gray-600'}`} size={18} />
                <input
                  disabled={!isEditing}
                  value={formData.social.github}
                  onChange={(e) => setFormData({ ...formData, social: { ...formData.social, github: e.target.value } })}
                  className="w-full bg-[#0a0a0c] border border-gray-800 p-4 pl-12 rounded-2xl outline-none focus:border-blue-500 disabled:opacity-50 transition-all text-white"
                  placeholder="https://github.com/username"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Phone Number</label>
              <div className="relative">
                <Phone className={`absolute left-4 top-1/2 -translate-y-1/2 transition-colors ${isEditing ? 'text-blue-500' : 'text-gray-600'}`} size={18} />
                <input 
                  disabled={!isEditing}
                  value={formData.phone}
                  onChange={(e) => setFormData({...formData, phone: e.target.value})}
                  className="w-full bg-[#0a0a0c] border border-gray-800 p-4 pl-12 rounded-2xl outline-none focus:border-blue-500 disabled:opacity-50 transition-all text-white"
                  placeholder="+91 00000 00000"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Joined CICR Date</label>
              <div className="relative">
                <Calendar className={`absolute left-4 top-1/2 -translate-y-1/2 transition-colors ${isEditing ? 'text-blue-500' : 'text-gray-600'}`} size={18} />
                <input
                  type="date"
                  disabled={!isEditing}
                  value={formData.joinedAt}
                  onChange={(e) => setFormData({ ...formData, joinedAt: e.target.value })}
                  className="w-full bg-[#0a0a0c] border border-gray-800 p-4 pl-12 rounded-2xl outline-none focus:border-blue-500 disabled:opacity-50 transition-all text-white"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Year</label>
              <div className="relative">
                <Calendar className={`absolute left-4 top-1/2 -translate-y-1/2 transition-colors ${isEditing ? 'text-blue-500' : 'text-gray-600'}`} size={18} />
                <input 
                  disabled={!isEditing}
                  value={formData.year}
                  onChange={(e) => setFormData({...formData, year: e.target.value})}
                  className="w-full bg-[#0a0a0c] border border-gray-800 p-4 pl-12 rounded-2xl outline-none focus:border-blue-500 disabled:opacity-50 transition-all text-white"
                  placeholder="e.g. 3"
                />
              </div>
            </div>

            {/* BRANCH FIELD - AUTOMATIC UPPERCASE */}
            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Branch</label>
              <div className="relative">
                <BookOpen className={`absolute left-4 top-1/2 -translate-y-1/2 transition-colors ${isEditing ? 'text-blue-500' : 'text-gray-600'}`} size={18} />
                <input 
                  disabled={!isEditing}
                  value={formData.branch}
                  onChange={(e) => setFormData({...formData, branch: e.target.value.toUpperCase()})}
                  className="w-full bg-[#0a0a0c] border border-gray-800 p-4 pl-12 rounded-2xl outline-none focus:border-blue-500 disabled:opacity-50 transition-all text-white"
                  placeholder="e.g. CSE"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Batch</label>
              <div className="relative">
                <Hash className={`absolute left-4 top-1/2 -translate-y-1/2 transition-colors ${isEditing ? 'text-blue-500' : 'text-gray-600'}`} size={18} />
                <input 
                  disabled={!isEditing}
                  value={formData.batch}
                  onChange={(e) => setFormData({...formData, batch: e.target.value})}
                  className="w-full bg-[#0a0a0c] border border-gray-800 p-4 pl-12 rounded-2xl outline-none focus:border-blue-500 disabled:opacity-50 transition-all text-white"
                  placeholder="e.g. E16, F5"
                />
              </div>
            </div>

            <AnimatePresence>
              {isEditing && (
                <motion.button 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  disabled={loading}
                  className="md:col-span-2 bg-blue-600 hover:bg-blue-700 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all mt-4 flex items-center justify-center gap-2"
                >
                  {loading ? <Loader2 className="animate-spin" /> : <><Save size={18} /> Save Changes</>}
                </motion.button>
              )}
            </AnimatePresence>
          </form>
        </div>
      </motion.div>

      {warnings.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-[#1a0f12] border border-red-500/30 rounded-[2rem] p-6"
        >
          <h3 className="text-sm font-black uppercase tracking-widest text-red-300 mb-4">Admin Warnings</h3>
          <div className="space-y-3">
            {warnings.slice(0, 5).map((warning, idx) => (
              <div key={idx} className="bg-black/20 border border-red-500/20 rounded-xl p-4">
                <p className="text-red-100 text-sm">{warning.reason}</p>
                <p className="text-[10px] text-red-300/70 mt-2 uppercase tracking-widest">
                  {warning.issuedBy?.name || 'Admin'} • {new Date(warning.issuedAt).toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
}