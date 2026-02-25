import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle,
  Bug,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  CircleDashed,
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
  ShieldQuestion,
  Sparkles,
  Trash2,
  Users,
  XCircle,
} from 'lucide-react';
import {
  createIssueTicket,
  createPost,
  deletePost,
  fetchAdminIssues,
  fetchDirectoryMembers,
  fetchMyIssues,
  fetchPosts,
  likePost,
  updateIssueTicket,
  warnPostUser,
} from '../api';

const ISSUE_CATEGORIES = ['General', 'Technical', 'Infrastructure', 'Event', 'Academic', 'Safety'];
const ISSUE_PRIORITIES = ['Low', 'Medium', 'High', 'Critical'];
const ISSUE_STATUSES = ['Open', 'InReview', 'Resolved', 'Rejected'];

const getOrdinal = (n) => {
  const value = Number(n);
  if (!Number.isFinite(value)) return '';
  const s = ['th', 'st', 'nd', 'rd'];
  const v = value % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
};

const prettyIssueStatus = (value) => {
  if (value === 'InReview') return 'In Review';
  return value || 'Open';
};

const fmtDateTime = (value) => {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return 'N/A';
  return d.toLocaleString();
};

const dispatchToast = (message, type = 'info') => {
  try {
    window.dispatchEvent(new CustomEvent('app:toast', { detail: { message, type } }));
  } catch {
    window.alert(message);
  }
};

const statusClassName = (status) => {
  if (status === 'Resolved') return 'text-emerald-300 border-emerald-500/40 bg-emerald-500/10';
  if (status === 'Rejected') return 'text-rose-300 border-rose-500/40 bg-rose-500/10';
  if (status === 'InReview') return 'text-amber-300 border-amber-500/40 bg-amber-500/10';
  return 'text-cyan-300 border-cyan-500/40 bg-cyan-500/10';
};

const priorityClassName = (priority) => {
  if (priority === 'Critical') return 'text-rose-300 border-rose-500/35';
  if (priority === 'High') return 'text-orange-300 border-orange-500/35';
  if (priority === 'Medium') return 'text-amber-300 border-amber-500/35';
  return 'text-gray-300 border-gray-600';
};

export default function Community() {
  const [activeTab, setActiveTab] = useState('feed');
  const [loading, setLoading] = useState(true);

  const [posts, setPosts] = useState([]);
  const [members, setMembers] = useState([]);
  const [myIssues, setMyIssues] = useState([]);
  const [adminIssues, setAdminIssues] = useState([]);

  const [content, setContent] = useState('');
  const [postType, setPostType] = useState('Announcement');
  const [postTopic, setPostTopic] = useState('');

  const [searchTerm, setSearchTerm] = useState('');
  const [filterBranch, setFilterBranch] = useState('All');
  const [filterYear, setFilterYear] = useState('All');
  const [filterRole, setFilterRole] = useState('All');

  const [issueForm, setIssueForm] = useState({
    title: '',
    category: 'General',
    priority: 'Medium',
    description: '',
  });
  const [issueBusy, setIssueBusy] = useState(false);
  const [adminIssueFilter, setAdminIssueFilter] = useState('All');

  const user = JSON.parse(localStorage.getItem('profile') || '{}');
  const userData = user.result || user;
  const userRole = String(userData.role || '').toLowerCase();
  const isPrivileged = ['admin', 'head'].includes(userRole);
  const isStrictAdmin = userRole === 'admin';

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const [postsRes, membersRes, myIssuesRes, adminIssuesRes] = await Promise.all([
          fetchPosts().catch(() => ({ data: [] })),
          fetchDirectoryMembers().catch(() => ({ data: [] })),
          fetchMyIssues().catch(() => ({ data: [] })),
          isStrictAdmin ? fetchAdminIssues().catch(() => ({ data: [] })) : Promise.resolve({ data: [] }),
        ]);

        setPosts(Array.isArray(postsRes.data) ? postsRes.data : []);
        setMembers(Array.isArray(membersRes.data) ? membersRes.data : []);
        setMyIssues(Array.isArray(myIssuesRes.data) ? myIssuesRes.data : []);
        setAdminIssues(Array.isArray(adminIssuesRes.data) ? adminIssuesRes.data : []);
      } catch (err) {
        console.error('Community load error:', err);
        dispatchToast('Unable to load community data.', 'error');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [isStrictAdmin]);

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

  const adminVisibleIssues = useMemo(() => {
    if (adminIssueFilter === 'All') return adminIssues;
    return adminIssues.filter((issue) => issue.status === adminIssueFilter);
  }, [adminIssueFilter, adminIssues]);

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

  const handleIssueSubmit = async (e) => {
    e.preventDefault();
    if (issueBusy) return;

    setIssueBusy(true);
    try {
      const payload = {
        title: issueForm.title,
        category: issueForm.category,
        priority: issueForm.priority,
        description: issueForm.description,
      };

      const { data } = await createIssueTicket(payload);
      setMyIssues((prev) => [data, ...prev]);
      if (isStrictAdmin) {
        setAdminIssues((prev) => [data, ...prev]);
      }

      setIssueForm({
        title: '',
        category: 'General',
        priority: 'Medium',
        description: '',
      });
      dispatchToast('Issue submitted to admin successfully.', 'success');
    } catch (err) {
      dispatchToast(err.response?.data?.message || 'Unable to submit issue ticket.', 'error');
    } finally {
      setIssueBusy(false);
    }
  };

  const handleAdminIssueUpdate = async (issue, nextStatus) => {
    const notePrompt = window.prompt('Add/update admin note (optional):', issue.adminNote || '');
    if (notePrompt === null) return;

    try {
      const { data } = await updateIssueTicket(issue._id, {
        status: nextStatus,
        adminNote: notePrompt,
      });

      setAdminIssues((prev) => prev.map((row) => (row._id === data._id ? data : row)));
      setMyIssues((prev) => prev.map((row) => (row._id === data._id ? data : row)));
      dispatchToast(`Issue moved to ${prettyIssueStatus(nextStatus)}.`, 'success');
    } catch (err) {
      dispatchToast(err.response?.data?.message || 'Issue update failed.', 'error');
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
    <div className="max-w-7xl mx-auto px-4 py-6 md:py-8 space-y-8 md:space-y-10 min-h-screen overflow-x-hidden page-motion-a">
      <header className="space-y-5 section-motion section-motion-delay-1">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.24em] text-cyan-300 font-black">
              <Globe size={14} />
              Community Workspace
            </div>
            <h1 className="mt-2 text-3xl md:text-4xl font-black tracking-tight heading-flow">CICR Community</h1>
            <p className="mt-2 text-sm text-gray-400 max-w-2xl">
              Professional collaboration board, verified member directory, and issue reporting line to admin.
            </p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-2xl border border-gray-800 p-1 self-start md:self-auto">
            {[
              { id: 'feed', icon: MessageSquare, label: 'Feed' },
              { id: 'directory', icon: Users, label: 'Directory' },
              { id: 'issues', icon: Bug, label: 'Issues' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 md:px-5 py-2.5 rounded-xl text-[10px] md:text-xs font-black uppercase tracking-[0.18em] inline-flex items-center gap-2 transition-colors ${
                  activeTab === tab.id
                    ? 'text-white border border-blue-500/45 bg-blue-500/10'
                    : 'text-gray-500 hover:text-gray-200'
                }`}
              >
                <tab.icon size={14} />
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      <AnimatePresence mode="wait">
        {activeTab === 'feed' ? (
          <motion.div
            key="feed"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="grid grid-cols-1 lg:grid-cols-12 gap-8 section-motion section-motion-delay-2"
          >
            <div className="lg:col-span-8 space-y-6 md:space-y-7">
              <form onSubmit={handlePostSubmit} className="border border-gray-800 p-5 md:p-7 rounded-[1.5rem] space-y-4 pro-hover-lift">
                <div className="flex gap-4">
                  <div className="hidden sm:flex w-12 h-12 rounded-2xl border border-blue-500/30 flex-shrink-0 items-center justify-center font-black text-blue-400 text-xl">
                    {userData.name?.[0] || 'M'}
                  </div>
                  <textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="Share an update, idea, requirement, or event note..."
                    className="w-full border border-gray-800 rounded-2xl bg-[#0b0e13]/60 text-white placeholder:text-gray-600 text-sm md:text-base p-4 resize-none outline-none focus:border-blue-500"
                    rows={4}
                  />
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="flex gap-2 overflow-x-auto w-full sm:w-auto pb-1">
                    {['Announcement', 'Requirement', 'Idea', ...(isPrivileged ? ['Event'] : [])].map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setPostType(type)}
                        className={`whitespace-nowrap px-3 py-2 rounded-xl text-[9px] md:text-[10px] font-black uppercase border transition-colors ${
                          postType === type
                            ? 'text-blue-300 border-blue-500/45 bg-blue-500/10'
                            : 'border-gray-800 text-gray-500'
                        }`}
                      >
                        {type}
                      </button>
                    ))}
                  </div>

                  <input
                    value={postTopic}
                    onChange={(e) => setPostTopic(e.target.value)}
                    placeholder="Topic (AI, Robotics, Placement...)"
                    className="w-full sm:w-64 border border-gray-800 rounded-xl px-3 py-2 text-xs bg-[#0b0e13]/60 text-white outline-none focus:border-blue-500"
                  />

                  <button className="w-full sm:w-auto border border-blue-500/45 bg-blue-500/10 text-blue-100 px-6 py-2.5 rounded-xl font-black text-xs uppercase tracking-[0.16em] inline-flex items-center justify-center gap-2">
                    <Send size={14} />
                    Post
                  </button>
                </div>
              </form>

              <div className="space-y-5 pro-stagger">
                {posts.map((post, idx) => (
                  <motion.article
                    key={post._id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.04 }}
                    className="border border-gray-800 p-5 md:p-6 rounded-[1.4rem] pro-hover-lift"
                  >
                    <div className="flex justify-between items-start gap-4">
                      <div className="flex gap-4 min-w-0">
                        <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl border border-blue-500/35 flex items-center justify-center font-black text-blue-300 shrink-0">
                          {post.user?.name?.[0] || 'M'}
                        </div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h4 className="text-white font-bold text-sm md:text-base">{post.user?.name || 'Member'}</h4>
                            <span className="text-cyan-300 border border-cyan-500/40 px-2 py-0.5 rounded-lg text-[8px] font-black uppercase">
                              {post.type}
                            </span>
                          </div>
                          <p className="text-[9px] text-gray-500 font-bold uppercase mt-1 flex flex-wrap items-center gap-2">
                            <span className="inline-flex items-center gap-1">
                              <Hash size={10} className="text-blue-400" />
                              {post.topic || post.type}
                            </span>
                            <span className="inline-flex items-center gap-1">
                              <CalendarDays size={10} className="text-amber-400" />
                              {new Date(post.createdAt).toLocaleDateString()}
                            </span>
                            <span className="inline-flex items-center gap-1">
                              <Clock4 size={10} className="text-emerald-400" />
                              {new Date(post.createdAt).toLocaleTimeString()}
                            </span>
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        {(isPrivileged || post.user?._id === userData._id || post.user?._id === userData.id) && (
                          <button onClick={() => handleDelete(post._id)} className="text-gray-600 hover:text-red-400 p-2">
                            <Trash2 size={17} />
                          </button>
                        )}
                        {isPrivileged && post.user?._id !== userData._id && (
                          <button onClick={() => handleWarn(post._id)} className="text-gray-600 hover:text-amber-400 p-2">
                            <AlertTriangle size={17} />
                          </button>
                        )}
                      </div>
                    </div>

                    <p className="mt-4 text-gray-200 text-sm md:text-base leading-relaxed">{post.content}</p>

                    <div className="mt-4">
                      <button
                        onClick={() => handleLike(post._id)}
                        className="inline-flex items-center gap-2 text-xs px-3 py-1.5 rounded-xl border border-gray-800 text-gray-300 hover:text-pink-300"
                      >
                        <Heart size={14} />
                        {post.likes?.length || 0} Reactions
                      </button>
                    </div>
                  </motion.article>
                ))}

                {posts.length === 0 && (
                  <div className="text-center py-16 border border-dashed border-gray-800 rounded-[2rem]">
                    <MessageSquare className="mx-auto text-gray-600 mb-3" size={44} />
                    <h4 className="text-lg font-black text-gray-300">No posts yet</h4>
                    <p className="text-gray-500 mt-1 text-sm">Share the first update with your team.</p>
                  </div>
                )}
              </div>
            </div>

            <aside className="lg:col-span-4 border border-gray-800 rounded-[2rem] p-6 md:p-7 h-fit pro-hover-lift">
              <h3 className="font-black mb-6 flex items-center gap-3 text-white uppercase tracking-[0.18em] text-xs">
                <Sparkles size={16} className="text-cyan-300" />
                Community Standards
              </h3>
              <div className="space-y-3">
                {[
                  'Use clear technical context in updates.',
                  'Tag ownership and expected delivery date.',
                  'Escalate blockers early via issue ticket.',
                ].map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between rounded-xl border border-gray-800 px-3 py-3 text-[11px] text-gray-300"
                  >
                    {item}
                    <ChevronRight size={14} className="text-gray-500" />
                  </div>
                ))}
              </div>
            </aside>
          </motion.div>
        ) : activeTab === 'directory' ? (
          <motion.div key="directory" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-7 section-motion section-motion-delay-2">
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
              <div>
                <p className="text-[10px] uppercase tracking-[0.22em] text-blue-400 font-black">CICR Directory</p>
                <h3 className="text-2xl md:text-3xl font-black text-white mt-1">Member Index</h3>
                <p className="text-gray-500 text-sm mt-2">All verified members are visible here, including alumni.</p>
              </div>
              <div className="grid grid-cols-3 gap-2 md:gap-3">
                <div className="border border-gray-800 rounded-xl px-3 py-2">
                  <p className="text-[9px] uppercase tracking-widest text-gray-500 font-black">Total</p>
                  <p className="text-lg font-black text-white">{directoryStats.total}</p>
                </div>
                <div className="border border-gray-800 rounded-xl px-3 py-2">
                  <p className="text-[9px] uppercase tracking-widest text-gray-500 font-black">Alumni</p>
                  <p className="text-lg font-black text-emerald-300">{directoryStats.alumni}</p>
                </div>
                <div className="border border-gray-800 rounded-xl px-3 py-2">
                  <p className="text-[9px] uppercase tracking-widest text-gray-500 font-black">Visible</p>
                  <p className="text-lg font-black text-cyan-300">{directoryStats.visible}</p>
                </div>
              </div>
            </div>

            <section className="border border-gray-800 p-5 rounded-[1.8rem] pro-hover-lift">
              <div className="flex items-center gap-2 text-gray-400 text-xs font-black uppercase tracking-widest mb-3">
                <Filter size={14} />
                Directory Filters
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
                <div className="xl:col-span-2 relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                  <input
                    type="text"
                    placeholder="Search by name, ID, email..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full border border-gray-800 p-3.5 pl-12 rounded-xl bg-[#0b0e13]/60 text-white text-sm outline-none focus:border-blue-500"
                  />
                </div>

                <select
                  value={filterBranch}
                  onChange={(e) => setFilterBranch(e.target.value)}
                  className="border border-gray-800 p-3.5 rounded-xl text-xs font-black uppercase tracking-widest text-gray-300 bg-[#0b0e13]/60"
                >
                  {branchOptions.map((b) => (
                    <option key={b} value={b}>
                      {b === 'All' ? 'All Branches' : b}
                    </option>
                  ))}
                </select>

                <select
                  value={filterYear}
                  onChange={(e) => setFilterYear(e.target.value)}
                  className="border border-gray-800 p-3.5 rounded-xl text-xs font-black uppercase tracking-widest text-gray-300 bg-[#0b0e13]/60"
                >
                  {yearOptions.map((y) => (
                    <option key={y} value={y}>
                      {y === 'All' ? 'All Years' : y === 'Alumni' ? 'Alumni' : `${y} Year`}
                    </option>
                  ))}
                </select>

                <div className="flex gap-2">
                  <select
                    value={filterRole}
                    onChange={(e) => setFilterRole(e.target.value)}
                    className="flex-1 border border-gray-800 p-3.5 rounded-xl text-xs font-black uppercase tracking-widest text-gray-300 bg-[#0b0e13]/60"
                  >
                    {roleOptions.map((role) => (
                      <option key={role} value={role}>
                        {role === 'All' ? 'All Roles' : role}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={resetDirectoryFilters}
                    className="inline-flex items-center justify-center border border-gray-800 rounded-xl px-3 text-gray-400 hover:text-white hover:border-blue-500/40"
                    title="Reset filters"
                  >
                    <RotateCcw size={16} />
                  </button>
                </div>
              </div>
            </section>

            <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
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
                  <article
                    key={member._id}
                    className="border border-gray-800 p-5 rounded-[1.6rem] hover:border-blue-500/35 transition-colors pro-hover-lift"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="w-12 h-12 rounded-xl border border-blue-500/35 flex items-center justify-center font-black text-cyan-200 text-xl">
                        {member.name?.[0] || 'M'}
                      </div>
                      <div className="flex flex-wrap justify-end gap-1.5">
                        <span
                          className={`text-[9px] px-2 py-1 rounded-md font-black uppercase tracking-widest ${
                            isAlumni ? 'bg-emerald-500/15 text-emerald-300' : 'bg-blue-500/15 text-blue-300'
                          }`}
                        >
                          {member.role || 'User'}
                        </span>
                        {member.role === 'Admin' && <ShieldCheck size={14} className="text-red-400 mt-1" />}
                      </div>
                    </div>

                    <h4 className="text-white font-black text-lg mt-4 truncate">{member.name || 'Member'}</h4>

                    <div className="mt-3 space-y-1.5">
                      <p className="text-gray-400 text-[11px] font-bold uppercase tracking-widest inline-flex items-center gap-1.5">
                        <Fingerprint size={12} className="text-blue-400" />
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

                    <div className="mt-4 pt-3 border-t border-gray-800">
                      <p className="text-gray-400 text-[11px] inline-flex items-center gap-2 w-full">
                        <Mail size={12} className="text-blue-400 shrink-0" />
                        <span className="truncate">{member.email || 'No email'}</span>
                      </p>
                    </div>

                    {hasProfile ? (
                      <Link
                        to={`/profile/${encodeURIComponent(member.collegeId)}`}
                        className="w-full mt-4 py-2.5 rounded-xl border border-blue-500/40 text-blue-200 text-[10px] font-black uppercase tracking-widest inline-flex items-center justify-center gap-2 hover:bg-blue-500/10"
                      >
                        Open Profile <ExternalLink size={12} />
                      </Link>
                    ) : (
                      <button disabled className="w-full mt-4 py-2.5 rounded-xl border border-gray-700 text-gray-500 text-[10px] font-black uppercase tracking-widest">
                        Profile Unavailable
                      </button>
                    )}
                  </article>
                );
              })}
            </section>

            {filteredMembers.length === 0 && (
              <div className="text-center py-16 border border-dashed border-gray-800 rounded-[2rem]">
                <Users className="mx-auto text-gray-700 mb-3" size={44} />
                <h4 className="text-lg font-black text-gray-300">No members found</h4>
                <p className="text-gray-500 mt-1 text-sm">Try changing filters or clearing search.</p>
                <button onClick={resetDirectoryFilters} className="mt-4 text-blue-400 font-semibold hover:text-blue-300">
                  Reset all filters
                </button>
              </div>
            )}
          </motion.div>
        ) : (
          <motion.div key="issues" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-7 section-motion section-motion-delay-2">
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
              <div>
                <p className="text-[10px] uppercase tracking-[0.22em] text-rose-300 font-black">Issue Escalation</p>
                <h3 className="text-2xl md:text-3xl font-black text-white mt-1">Raise an Admin Ticket</h3>
                <p className="text-gray-500 text-sm mt-2">
                  Issues are private and routed directly to Admin. They are not visible in public feed.
                </p>
              </div>
              <div className="inline-flex items-center gap-2 border border-rose-500/35 text-rose-200 rounded-xl px-3 py-2 text-xs">
                <ShieldQuestion size={14} />
                Admin-handled workflow
              </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
              <section className="xl:col-span-5 border border-gray-800 rounded-[1.8rem] p-5 md:p-6 pro-hover-lift">
                <h4 className="text-sm font-black uppercase tracking-[0.18em] text-gray-200 inline-flex items-center gap-2">
                  <Bug size={14} className="text-rose-300" />
                  New Issue
                </h4>

                <form onSubmit={handleIssueSubmit} className="mt-4 space-y-3">
                  <input
                    value={issueForm.title}
                    onChange={(e) => setIssueForm((prev) => ({ ...prev, title: e.target.value }))}
                    placeholder="Issue title"
                    className="w-full border border-gray-800 rounded-xl px-3 py-2.5 bg-[#0b0e13]/60 text-sm text-white outline-none focus:border-rose-500/60"
                    required
                    minLength={4}
                    maxLength={160}
                  />

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <select
                      value={issueForm.category}
                      onChange={(e) => setIssueForm((prev) => ({ ...prev, category: e.target.value }))}
                      className="border border-gray-800 rounded-xl px-3 py-2.5 bg-[#0b0e13]/60 text-sm text-white outline-none focus:border-rose-500/60"
                    >
                      {ISSUE_CATEGORIES.map((category) => (
                        <option key={category} value={category}>
                          {category}
                        </option>
                      ))}
                    </select>

                    <select
                      value={issueForm.priority}
                      onChange={(e) => setIssueForm((prev) => ({ ...prev, priority: e.target.value }))}
                      className="border border-gray-800 rounded-xl px-3 py-2.5 bg-[#0b0e13]/60 text-sm text-white outline-none focus:border-rose-500/60"
                    >
                      {ISSUE_PRIORITIES.map((priority) => (
                        <option key={priority} value={priority}>
                          {priority}
                        </option>
                      ))}
                    </select>
                  </div>

                  <textarea
                    value={issueForm.description}
                    onChange={(e) => setIssueForm((prev) => ({ ...prev, description: e.target.value }))}
                    placeholder="Describe the issue in detail with impact and urgency."
                    className="w-full border border-gray-800 rounded-xl px-3 py-2.5 bg-[#0b0e13]/60 text-sm text-white outline-none focus:border-rose-500/60 resize-none"
                    rows={5}
                    required
                    minLength={10}
                    maxLength={3000}
                  />

                  <button
                    type="submit"
                    disabled={issueBusy}
                    className="w-full inline-flex items-center justify-center gap-2 border border-rose-500/40 text-rose-100 py-2.5 rounded-xl text-xs font-black uppercase tracking-[0.16em] hover:bg-rose-500/10 disabled:opacity-60"
                  >
                    {issueBusy ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                    Submit To Admin
                  </button>
                </form>

                <div className="mt-5 border-t border-gray-800 pt-4">
                  <h5 className="text-xs uppercase tracking-widest text-gray-400 font-black">My Ticket History</h5>
                  <div className="mt-3 space-y-3 max-h-[360px] overflow-auto pr-1">
                    {myIssues.map((issue) => (
                      <article key={issue._id} className="border border-gray-800 rounded-xl p-3">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-semibold text-white leading-snug">{issue.title}</p>
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded-md font-black border uppercase tracking-widest ${statusClassName(
                              issue.status
                            )}`}
                          >
                            {prettyIssueStatus(issue.status)}
                          </span>
                        </div>
                        <p className="text-xs text-gray-400 mt-2 line-clamp-3">{issue.description}</p>
                        <div className="mt-2 text-[10px] text-gray-500 uppercase tracking-widest flex flex-wrap gap-2">
                          <span>{issue.category}</span>
                          <span>•</span>
                          <span>{issue.priority}</span>
                          <span>•</span>
                          <span>{fmtDateTime(issue.createdAt)}</span>
                          {issue.resolvedAt ? (
                            <>
                              <span>•</span>
                              <span>Resolved {fmtDateTime(issue.resolvedAt)}</span>
                            </>
                          ) : null}
                        </div>
                        {issue.resolvedBy?.name ? (
                          <p className="mt-2 text-[10px] uppercase tracking-widest text-emerald-200">
                            Resolved by {issue.resolvedBy.name}
                          </p>
                        ) : null}
                        {issue.adminNote ? (
                          <p className="mt-2 text-xs text-amber-200 border border-amber-500/30 rounded-lg px-2.5 py-1.5">
                            Admin note: {issue.adminNote}
                          </p>
                        ) : null}
                      </article>
                    ))}

                    {myIssues.length === 0 && (
                      <p className="text-sm text-gray-500 border border-dashed border-gray-800 rounded-xl px-3 py-4 text-center">
                        No issues submitted yet.
                      </p>
                    )}
                  </div>
                </div>
              </section>

              {isStrictAdmin && (
                <section className="xl:col-span-7 border border-gray-800 rounded-[1.8rem] p-5 md:p-6 pro-hover-lift">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <h4 className="text-sm font-black uppercase tracking-[0.18em] text-gray-200 inline-flex items-center gap-2">
                      <ShieldCheck size={14} className="text-cyan-300" />
                      Admin Issue Inbox
                    </h4>
                    <select
                      value={adminIssueFilter}
                      onChange={(e) => setAdminIssueFilter(e.target.value)}
                      className="border border-gray-800 rounded-xl px-3 py-2 bg-[#0b0e13]/60 text-xs text-gray-300"
                    >
                      <option value="All">All Statuses</option>
                      {ISSUE_STATUSES.map((status) => (
                        <option key={status} value={status}>
                          {prettyIssueStatus(status)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="mt-4 space-y-3 max-h-[720px] overflow-auto pr-1">
                    {adminVisibleIssues.map((issue) => (
                      <article key={issue._id} className="border border-gray-800 rounded-xl p-4">
                        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm md:text-base font-bold text-white break-words">{issue.title}</p>
                            <p className="text-xs text-gray-500 mt-1 uppercase tracking-wider">
                              {issue.createdBy?.name || 'Unknown'} • {issue.createdBy?.collegeId || 'No-ID'}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span
                              className={`text-[10px] px-2 py-0.5 rounded-md font-black border uppercase tracking-widest ${priorityClassName(
                                issue.priority
                              )}`}
                            >
                              {issue.priority}
                            </span>
                            <span
                              className={`text-[10px] px-2 py-0.5 rounded-md font-black border uppercase tracking-widest ${statusClassName(
                                issue.status
                              )}`}
                            >
                              {prettyIssueStatus(issue.status)}
                            </span>
                          </div>
                        </div>

                        <p className="mt-3 text-sm text-gray-300 leading-relaxed">{issue.description}</p>

                        <div className="mt-3 text-[10px] uppercase tracking-widest text-gray-500 flex flex-wrap gap-2">
                          <span>{issue.category}</span>
                          <span>•</span>
                          <span>{fmtDateTime(issue.createdAt)}</span>
                          {issue.resolvedAt ? (
                            <>
                              <span>•</span>
                              <span>Resolved {fmtDateTime(issue.resolvedAt)}</span>
                            </>
                          ) : null}
                        </div>
                        {issue.resolvedBy?.name ? (
                          <p className="mt-2 text-[10px] uppercase tracking-widest text-emerald-200">
                            Resolved by {issue.resolvedBy.name}
                          </p>
                        ) : null}

                        {issue.adminNote ? (
                          <p className="mt-2 text-xs text-amber-200 border border-amber-500/30 rounded-lg px-2.5 py-1.5">
                            Admin note: {issue.adminNote}
                          </p>
                        ) : null}

                        <div className="mt-3 pt-3 border-t border-gray-800 flex flex-wrap gap-2">
                          <button
                            onClick={() => handleAdminIssueUpdate(issue, 'InReview')}
                            className="text-[10px] px-3 py-1.5 rounded-lg border border-amber-500/35 text-amber-200 inline-flex items-center gap-1"
                          >
                            <CircleDashed size={12} />
                            In Review
                          </button>
                          <button
                            onClick={() => handleAdminIssueUpdate(issue, 'Resolved')}
                            className="text-[10px] px-3 py-1.5 rounded-lg border border-emerald-500/35 text-emerald-200 inline-flex items-center gap-1"
                          >
                            <CheckCircle2 size={12} />
                            Resolve
                          </button>
                          <button
                            onClick={() => handleAdminIssueUpdate(issue, 'Rejected')}
                            className="text-[10px] px-3 py-1.5 rounded-lg border border-rose-500/35 text-rose-200 inline-flex items-center gap-1"
                          >
                            <XCircle size={12} />
                            Reject
                          </button>
                        </div>
                      </article>
                    ))}

                    {adminVisibleIssues.length === 0 && (
                      <div className="text-center py-12 border border-dashed border-gray-800 rounded-xl">
                        <ShieldCheck className="mx-auto text-gray-600 mb-3" size={34} />
                        <p className="text-sm font-semibold text-gray-300">No issues in this queue.</p>
                      </div>
                    )}
                  </div>
                </section>
              )}
            </div>

            {!isStrictAdmin && (
              <div className="border border-gray-800 rounded-xl p-4 text-sm text-gray-400 inline-flex items-start gap-2 section-motion section-motion-delay-3">
                <ShieldCheck size={15} className="text-cyan-300 mt-0.5" />
                Only admin can access full issue inbox and update statuses.
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
