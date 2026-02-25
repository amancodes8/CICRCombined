import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle,
  CalendarDays,
  ChevronRight,
  Clock4,
  ExternalLink,
  Filter,
  Fingerprint,
  Globe,
  GraduationCap,
  Hash,
  Heart,
  Loader2,
  Mail,
  MessageSquare,
  RotateCcw,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Trash2,
  Users,
} from 'lucide-react';
import { createPost, deletePost, fetchDirectoryMembers, fetchPosts, likePost, warnPostUser } from '../api';

const getOrdinal = (n) => {
  const value = Number(n);
  if (!Number.isFinite(value)) return '';
  const s = ['th', 'st', 'nd', 'rd'];
  const v = value % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
};

const dispatchToast = (message, type = 'info') => {
  try {
    window.dispatchEvent(new CustomEvent('app:toast', { detail: { message, type } }));
  } catch {
    window.alert(message);
  }
};

export default function Community() {
  const [activeTab, setActiveTab] = useState('feed');
  const [posts, setPosts] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);

  const [content, setContent] = useState('');
  const [postType, setPostType] = useState('Announcement');
  const [postTopic, setPostTopic] = useState('');

  const [searchTerm, setSearchTerm] = useState('');
  const [filterBranch, setFilterBranch] = useState('All');
  const [filterYear, setFilterYear] = useState('All');
  const [filterRole, setFilterRole] = useState('All');

  const user = JSON.parse(localStorage.getItem('profile') || '{}');
  const userData = user.result || user;
  const isPrivileged = ['admin', 'head'].includes(String(userData.role || '').toLowerCase());

  useEffect(() => {
    const loadData = async () => {
      try {
        const [postsRes, membersRes] = await Promise.all([
          fetchPosts().catch(() => ({ data: [] })),
          fetchDirectoryMembers().catch(() => ({ data: [] })),
        ]);
        setPosts(Array.isArray(postsRes.data) ? postsRes.data : []);
        setMembers(Array.isArray(membersRes.data) ? membersRes.data : []);
      } catch (err) {
        console.error('Community load error:', err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const branchOptions = useMemo(() => {
    const values = new Set(
      members
        .map((m) => String(m.branch || '').toUpperCase())
        .filter(Boolean)
    );
    return ['All', ...Array.from(values).sort((a, b) => a.localeCompare(b))];
  }, [members]);

  const yearOptions = useMemo(() => {
    const years = new Set();
    let hasAlumni = false;

    members.forEach((m) => {
      if (String(m.role || '').toLowerCase() === 'alumni') {
        hasAlumni = true;
        return;
      }
      if (m.year !== null && m.year !== undefined && String(m.year).trim() !== '') {
        years.add(String(m.year));
      }
    });

    const sortedYears = Array.from(years).sort((a, b) => Number(a) - Number(b));
    return ['All', ...sortedYears, ...(hasAlumni ? ['Alumni'] : [])];
  }, [members]);

  const roleOptions = useMemo(() => {
    const values = new Set(members.map((m) => String(m.role || '').trim()).filter(Boolean));
    const order = ['Admin', 'Head', 'User', 'Alumni'];
    const sorted = Array.from(values).sort((a, b) => {
      const ia = order.indexOf(a);
      const ib = order.indexOf(b);
      if (ia === -1 && ib === -1) return a.localeCompare(b);
      if (ia === -1) return 1;
      if (ib === -1) return -1;
      return ia - ib;
    });
    return ['All', ...sorted];
  }, [members]);

  const filteredMembers = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();

    const rows = members.filter((m) => {
      const role = String(m.role || '');
      const roleLower = role.toLowerCase();
      const branch = String(m.branch || '').toUpperCase();
      const year = m.year !== null && m.year !== undefined ? String(m.year) : '';

      const searchable = [m.name, m.collegeId, m.email, branch, role]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      const matchesSearch = !query || searchable.includes(query);
      const matchesBranch = filterBranch === 'All' || branch === filterBranch;
      const matchesRole = filterRole === 'All' || role === filterRole;
      const matchesYear =
        filterYear === 'All' ||
        (filterYear === 'Alumni' ? roleLower === 'alumni' : year === filterYear);

      return matchesSearch && matchesBranch && matchesRole && matchesYear;
    });

    const roleOrder = { Admin: 0, Head: 1, User: 2, Alumni: 3 };
    return rows.sort((a, b) => {
      const ra = roleOrder[a.role] ?? 99;
      const rb = roleOrder[b.role] ?? 99;
      if (ra !== rb) return ra - rb;
      return String(a.name || '').localeCompare(String(b.name || ''));
    });
  }, [members, searchTerm, filterBranch, filterRole, filterYear]);

  const directoryStats = useMemo(() => {
    const alumni = members.filter((m) => String(m.role || '').toLowerCase() === 'alumni').length;
    return {
      total: members.length,
      visible: filteredMembers.length,
      alumni,
    };
  }, [members, filteredMembers.length]);

  const resetDirectoryFilters = () => {
    setSearchTerm('');
    setFilterBranch('All');
    setFilterYear('All');
    setFilterRole('All');
  };

  const handlePostSubmit = async (e) => {
    e.preventDefault();
    if (!content.trim()) return;
    try {
      const { data } = await createPost({ content, type: postType, topic: postTopic });
      setPosts((prev) => [data, ...prev]);
      setContent('');
      setPostTopic('');
      dispatchToast('Post published.', 'success');
    } catch (err) {
      dispatchToast(err.response?.data?.message || 'Failed to post.', 'error');
    }
  };

  const handleDelete = async (postId) => {
    if (!window.confirm('Delete this post?')) return;
    try {
      await deletePost(postId);
      setPosts((prev) => prev.filter((p) => p._id !== postId));
      dispatchToast('Post deleted.', 'success');
    } catch (err) {
      dispatchToast(err.response?.data?.message || 'Error deleting post.', 'error');
    }
  };

  const handleWarn = async (postId) => {
    const reason = window.prompt('Enter warning reason for this user:');
    if (!reason) return;
    try {
      await warnPostUser(postId, reason);
      dispatchToast('Warning sent to user.', 'success');
    } catch (err) {
      dispatchToast(err.response?.data?.message || 'Failed to warn user.', 'error');
    }
  };

  const handleLike = async (postId) => {
    try {
      const { data } = await likePost(postId);
      setPosts((prev) => prev.map((p) => (p._id === postId ? data : p)));
    } catch (err) {
      dispatchToast(err.response?.data?.message || 'Unable to react to this post.', 'error');
    }
  };

  if (loading) {
    return (
      <div className="h-[80vh] flex flex-col items-center justify-center gap-4">
        <Loader2 className="animate-spin text-blue-500 w-12 h-12" />
        <p className="text-gray-500 font-black tracking-[0.2em] uppercase text-[10px]">Synchronizing Hub...</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 md:py-8 space-y-8 md:space-y-12 min-h-screen overflow-x-hidden">
      <header className="relative p-6 md:p-10 rounded-[2rem] md:rounded-[2.5rem] overflow-hidden shadow-2xl">
        <div className="absolute top-0 right-0 w-48 h-48 md:w-64 md:h-64 bg-blue-600/10 blur-[80px] md:blur-[100px] rounded-full -mr-10 -mt-10" />
        <div className="relative flex flex-col md:flex-row justify-between items-center gap-6 md:gap-8">
          <div className="space-y-2 text-center md:text-left">
            <div className="flex items-center justify-center md:justify-start gap-3">
              <span className="bg-blue-600/20 text-blue-500 p-2 rounded-xl">
                <Globe size={20} />
              </span>
              <h2 className="text-2xl md:text-2xl font-black tracking-tighter text-white">Hub Network</h2>
            </div>
            <p className="text-gray-500 text-xs md:text-sm font-medium">CICR updates, collaboration, and people directory.</p>
          </div>

          <div className="flex w-full md:w-auto bg-[#0a0a0c] p-1 rounded-2xl border border-gray-800 shadow-inner">
            {[{ id: 'feed', icon: MessageSquare, label: 'Feed' }, { id: 'directory', icon: Users, label: 'Directory' }].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 md:flex-none px-4 md:px-8 py-3 rounded-xl text-[10px] md:text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all ${
                  activeTab === tab.id ? 'bg-blue-600 text-white shadow-xl shadow-blue-600/20' : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                <tab.icon size={14} /> {tab.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      <AnimatePresence mode="wait">
        {activeTab === 'feed' ? (
          <motion.div key="feed" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-8 space-y-6 md:space-y-8">
              <form onSubmit={handlePostSubmit} className="bg-[#141417] border border-gray-800 p-5 md:p-8 rounded-[1.5rem] md:rounded-[2rem] shadow-xl">
                <div className="flex gap-4">
                  <div className="hidden sm:flex w-12 h-12 rounded-2xl bg-gray-800 flex-shrink-0 items-center justify-center font-black text-blue-500 text-xl border border-gray-700">
                    {userData.name?.[0]}
                  </div>
                  <textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="Share a thread or requirement..."
                    className="w-full bg-transparent border-none text-white placeholder:text-gray-600 text-base md:text-lg py-2 resize-none outline-none"
                    rows={3}
                  />
                </div>
                <div className="flex flex-col sm:flex-row justify-between items-center mt-4 pt-4 border-t border-gray-800 gap-4">
                  <div className="flex gap-2 overflow-x-auto w-full sm:w-auto pb-2 scrollbar-hide">
                    {['Announcement', 'Requirement', 'Idea', ...(isPrivileged ? ['Event'] : [])].map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setPostType(type)}
                        className={`whitespace-nowrap px-3 md:px-4 py-2 rounded-xl text-[9px] md:text-[10px] font-black uppercase border transition-all ${
                          postType === type ? 'bg-blue-600/20 border-blue-500 text-blue-500' : 'border-gray-800 text-gray-500'
                        }`}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                  <input
                    value={postTopic}
                    onChange={(e) => setPostTopic(e.target.value)}
                    placeholder="Topic (AI, Robotics, Placement, Event...)"
                    className="w-full sm:w-64 bg-[#0a0a0c] border border-gray-800 rounded-xl px-3 py-2 text-xs text-white outline-none"
                  />
                  <button className="w-full sm:w-auto bg-blue-600 text-white px-8 py-3 rounded-xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2">
                    <Send size={16} /> Post
                  </button>
                </div>
              </form>

              <div className="space-y-6">
                {posts.map((post, idx) => (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: idx * 0.05 }}
                    key={post._id}
                    className="bg-[#141417] border border-gray-800 p-6 md:p-8 rounded-[1.5rem] md:rounded-[2rem] group"
                  >
                    <div className="flex justify-between items-start gap-4">
                      <div className="flex gap-4 min-w-0">
                        <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center font-black text-white shrink-0">
                          {post.user?.name?.[0]}
                        </div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h4 className="text-white font-bold text-sm md:text-base">{post.user?.name}</h4>
                            <span className="text-blue-500 bg-blue-500/10 px-2 py-0.5 rounded-lg text-[8px] font-black uppercase">{post.type}</span>
                          </div>
                          <p className="text-[9px] text-gray-500 font-bold uppercase mt-1 flex flex-wrap items-center gap-2">
                            <span className="inline-flex items-center gap-1">
                              <Hash size={10} className="text-blue-500" /> {post.topic || post.type}
                            </span>
                            <span className="inline-flex items-center gap-1">
                              <CalendarDays size={10} className="text-amber-500" /> {new Date(post.createdAt).toLocaleDateString()}
                            </span>
                            <span className="inline-flex items-center gap-1">
                              <Clock4 size={10} className="text-emerald-500" /> {new Date(post.createdAt).toLocaleTimeString()}
                            </span>
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {(isPrivileged || post.user?._id === userData._id || post.user?._id === userData.id) && (
                          <button onClick={() => handleDelete(post._id)} className="text-gray-600 hover:text-red-500 p-2">
                            <Trash2 size={18} />
                          </button>
                        )}
                        {isPrivileged && post.user?._id !== userData._id && (
                          <button onClick={() => handleWarn(post._id)} className="text-gray-600 hover:text-amber-500 p-2">
                            <AlertTriangle size={18} />
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="mt-4 md:mt-6 text-gray-300 text-sm md:text-base leading-relaxed">{post.content}</div>
                    <div className="mt-4 flex items-center gap-3">
                      <button
                        onClick={() => handleLike(post._id)}
                        className="inline-flex items-center gap-2 text-xs px-3 py-1.5 rounded-xl bg-[#0a0a0c] border border-gray-800 text-gray-300 hover:text-pink-400"
                      >
                        <Heart size={14} /> {post.likes?.length || 0} Reactions
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>

            <div className="lg:col-span-4 space-y-8">
              <div className="bg-[#141417] border border-gray-800 p-8 rounded-[2rem]">
                <h3 className="font-black mb-6 flex items-center gap-3 text-white uppercase italic tracking-widest text-sm">
                  <Sparkles size={18} className="text-blue-500" /> Lab Trending
                </h3>
                <div className="space-y-3">
                  {['Server Upgrade', 'Weekend Hackathon', 'New Components'].map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between p-4 rounded-xl bg-[#0a0a0c] border border-gray-800 text-[10px] text-gray-400 font-bold uppercase tracking-widest">
                      {item} <ChevronRight size={14} />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div key="directory" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-7">
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
              <div>
                <p className="text-[10px] uppercase tracking-[0.22em] text-blue-400 font-black">CICR Directory</p>
                <h3 className="text-2xl md:text-3xl font-black text-white mt-1">Member Index</h3>
                <p className="text-gray-500 text-sm mt-2">All verified members are visible here, including alumni.</p>
              </div>
              <div className="grid grid-cols-3 gap-2 md:gap-3">
                <div className="bg-[#141417] border border-gray-800 rounded-xl px-3 py-2">
                  <p className="text-[9px] uppercase tracking-widest text-gray-500 font-black">Total</p>
                  <p className="text-lg font-black text-white">{directoryStats.total}</p>
                </div>
                <div className="bg-[#141417] border border-gray-800 rounded-xl px-3 py-2">
                  <p className="text-[9px] uppercase tracking-widest text-gray-500 font-black">Alumni</p>
                  <p className="text-lg font-black text-emerald-300">{directoryStats.alumni}</p>
                </div>
                <div className="bg-[#141417] border border-gray-800 rounded-xl px-3 py-2">
                  <p className="text-[9px] uppercase tracking-widest text-gray-500 font-black">Visible</p>
                  <p className="text-lg font-black text-cyan-300">{directoryStats.visible}</p>
                </div>
              </div>
            </div>

            <div className="bg-[#141417] p-5 rounded-[1.8rem] border border-gray-800">
              <div className="flex items-center gap-2 text-gray-400 text-xs font-black uppercase tracking-widest mb-3">
                <Filter size={14} /> Directory Filters
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
                <div className="xl:col-span-2 relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                  <input
                    type="text"
                    placeholder="Search by name, ID, email..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-[#0a0a0c] border border-gray-800 p-3.5 pl-12 rounded-xl text-white text-sm outline-none focus:border-blue-500"
                  />
                </div>

                <select value={filterBranch} onChange={(e) => setFilterBranch(e.target.value)} className="bg-[#0a0a0c] border border-gray-800 p-3.5 rounded-xl text-xs font-black uppercase tracking-widest text-gray-400">
                  {branchOptions.map((b) => (
                    <option key={b} value={b}>
                      {b === 'All' ? 'All Branches' : b}
                    </option>
                  ))}
                </select>

                <select value={filterYear} onChange={(e) => setFilterYear(e.target.value)} className="bg-[#0a0a0c] border border-gray-800 p-3.5 rounded-xl text-xs font-black uppercase tracking-widest text-gray-400">
                  {yearOptions.map((y) => (
                    <option key={y} value={y}>
                      {y === 'All' ? 'All Years' : y === 'Alumni' ? 'Alumni' : `${y} Year`}
                    </option>
                  ))}
                </select>

                <div className="flex gap-2">
                  <select value={filterRole} onChange={(e) => setFilterRole(e.target.value)} className="flex-1 bg-[#0a0a0c] border border-gray-800 p-3.5 rounded-xl text-xs font-black uppercase tracking-widest text-gray-400">
                    {roleOptions.map((role) => (
                      <option key={role} value={role}>
                        {role === 'All' ? 'All Roles' : role}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={resetDirectoryFilters}
                    className="inline-flex items-center justify-center bg-[#0a0a0c] border border-gray-800 rounded-xl px-3 text-gray-400 hover:text-white hover:border-blue-500/40"
                    title="Reset filters"
                  >
                    <RotateCcw size={16} />
                  </button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
              {filteredMembers.map((member) => {
                const roleLower = String(member.role || '').toLowerCase();
                const isAlumni = roleLower === 'alumni';
                const yearLabel = isAlumni
                  ? 'Alumni'
                  : member.year
                  ? `${member.year}${getOrdinal(member.year)} Year`
                  : 'Year N/A';
                const hasProfile = Boolean(member.collegeId);

                return (
                  <article key={member._id} className="bg-[#141417] border border-gray-800 p-5 rounded-[1.6rem] hover:border-blue-500/45 transition-all group">
                    <div className="flex items-start justify-between gap-3">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center font-black text-white text-xl">
                        {member.name?.[0] || 'M'}
                      </div>
                      <div className="flex flex-wrap justify-end gap-1.5">
                        <span className={`text-[9px] px-2 py-1 rounded-md font-black uppercase tracking-widest ${isAlumni ? 'bg-emerald-500/15 text-emerald-300' : 'bg-blue-500/15 text-blue-300'}`}>
                          {member.role || 'User'}
                        </span>
                        {member.role === 'Admin' && <ShieldCheck size={14} className="text-red-400 mt-1" />}
                      </div>
                    </div>

                    <h4 className="text-white font-black text-lg mt-4 truncate">{member.name || 'Member'}</h4>

                    <div className="mt-3 space-y-1.5">
                      <p className="text-gray-400 text-[11px] font-bold uppercase tracking-widest inline-flex items-center gap-1.5">
                        <Fingerprint size={12} className="text-blue-500" />
                        {member.collegeId || 'NO-ID'}
                      </p>
                      <p className="text-gray-500 text-[10px] font-black uppercase tracking-widest inline-flex items-center gap-1.5">
                        <GraduationCap size={12} className="text-amber-400" />
                        {yearLabel}
                      </p>
                      <p className="text-gray-500 text-[10px] font-black uppercase tracking-widest">
                        {member.branch || 'GENERAL'} {member.batch ? `• ${member.batch}` : ''}
                      </p>
                    </div>

                    <div className="mt-4 pt-3 border-t border-gray-800 space-y-2">
                      <p className="text-gray-400 text-[11px] inline-flex items-center gap-2 w-full">
                        <Mail size={12} className="text-blue-500 shrink-0" />
                        <span className="truncate">{member.email || 'No email'}</span>
                      </p>
                    </div>

                    {hasProfile ? (
                      <Link
                        to={`/profile/${encodeURIComponent(member.collegeId)}`}
                        className="w-full mt-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-black uppercase tracking-widest inline-flex items-center justify-center gap-2 transition-all"
                      >
                        Open Profile <ExternalLink size={12} />
                      </Link>
                    ) : (
                      <button disabled className="w-full mt-4 py-2.5 rounded-xl bg-gray-800 text-gray-500 text-[10px] font-black uppercase tracking-widest">
                        Profile Unavailable
                      </button>
                    )}
                  </article>
                );
              })}
            </div>

            {filteredMembers.length === 0 && (
              <div className="text-center py-16 bg-[#141417]/40 rounded-[2rem] border border-dashed border-gray-800">
                <Users className="mx-auto text-gray-700 mb-3" size={44} />
                <h4 className="text-lg font-black text-gray-300">No members found</h4>
                <p className="text-gray-500 mt-1 text-sm">Try changing filters or clearing search.</p>
                <button onClick={resetDirectoryFilters} className="mt-4 text-blue-400 font-semibold hover:text-blue-300">
                  Reset all filters
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
