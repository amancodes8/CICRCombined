import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
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
import { DataEmpty } from '../components/DataState';
import PageHeader from '../components/PageHeader';

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

const buildIssueTimeline = (issue = {}) => {
  const rows = [];
  rows.push({
    id: `created-${issue._id}`,
    label: 'Submitted',
    detail: issue.createdBy?.name ? `by ${issue.createdBy.name}` : 'by member',
    at: issue.createdAt,
  });

  if (issue.status && issue.status !== 'Open') {
    rows.push({
      id: `status-${issue._id}`,
      label: prettyIssueStatus(issue.status),
      detail: issue.resolvedBy?.name ? `by ${issue.resolvedBy.name}` : 'status updated',
      at: issue.resolvedAt || issue.updatedAt,
    });
  }

  if (issue.adminNote) {
    rows.push({
      id: `note-${issue._id}`,
      label: 'Admin Note',
      detail: issue.adminNote.slice(0, 90),
      at: issue.updatedAt,
    });
  }

  return rows
    .filter((item) => item.at)
    .sort((a, b) => new Date(a.at) - new Date(b.at))
    .slice(-4);
};

export default function Community() {
  const [searchParams] = useSearchParams();
  const issueSectionRef = useRef(null);
  const issueTitleRef = useRef(null);
  const initialTab = ['feed', 'directory', 'issues'].includes(searchParams.get('tab')) ? searchParams.get('tab') : 'feed';
  const [activeTab, setActiveTab] = useState(initialTab);
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

  useEffect(() => {
    const requestedTab = searchParams.get('tab');
    if (requestedTab && ['feed', 'directory', 'issues'].includes(requestedTab)) {
      setActiveTab(requestedTab);
    }
  }, [searchParams]);

  useEffect(() => {
    if (activeTab !== 'issues') return;
    if (searchParams.get('quick') !== 'create-issue') return;
    issueSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    window.setTimeout(() => issueTitleRef.current?.focus(), 180);
  }, [activeTab, searchParams]);

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

  const communitySnapshot = useMemo(() => {
    const issueSource = isStrictAdmin ? adminIssues : myIssues;
    const open = issueSource.filter((issue) => !['Resolved', 'Rejected'].includes(String(issue.status || 'Open'))).length;
    const resolved = issueSource.filter((issue) => String(issue.status || '') === 'Resolved').length;
    return {
      posts: posts.length,
      members: members.length,
      openIssues: open,
      resolvedIssues: resolved,
    };
  }, [adminIssues, isStrictAdmin, members.length, myIssues, posts.length]);

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
    <div className="ui-page max-w-7xl px-4 py-6 md:py-8 space-y-8 md:space-y-10 min-h-screen overflow-x-hidden page-motion-a">
      <header className="space-y-4 section-motion section-motion-delay-1">
        <PageHeader
          eyebrow="Community Workspace"
          title="CICR Community"
          subtitle="Professional collaboration board, verified member directory, and private issue reporting line to admin."
          icon={Globe}
        />
        <div className="inline-flex items-center gap-2 rounded-xl border border-gray-800 p-1 self-start md:self-auto overflow-x-auto max-w-full bg-black/20">
          {[
            { id: 'feed', icon: MessageSquare, label: 'Feed' },
            { id: 'directory', icon: Users, label: 'Directory' },
            { id: 'issues', icon: Bug, label: 'Issues' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 md:px-5 py-2 rounded-lg text-xs font-semibold inline-flex items-center gap-2 transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? 'text-cyan-100 border border-cyan-500/45 bg-cyan-500/10'
                  : 'text-gray-400 hover:text-gray-200 border border-transparent hover:border-gray-700'
              }`}
            >
              <tab.icon size={14} />
              {tab.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-5 gap-y-4 border-y border-gray-800/70 py-3">
          <SnapshotRail label="Posts" value={communitySnapshot.posts} tone="cyan" />
          <SnapshotRail label="Members" value={communitySnapshot.members} tone="blue" />
          <SnapshotRail label="Open Issues" value={communitySnapshot.openIssues} tone="amber" />
          <SnapshotRail label="Resolved Issues" value={communitySnapshot.resolvedIssues} tone="emerald" />
        </div>
      </header>

      <AnimatePresence mode="wait">
        {activeTab === 'feed' ? (
          <motion.div
            key="feed"
            initial={{ opacity: 0, y: 12, scale: 0.99 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.99 }}
            transition={{ duration: 0.24, ease: 'easeOut' }}
            className="grid grid-cols-1 lg:grid-cols-12 gap-8 section-motion section-motion-delay-2"
          >
            <div className="lg:col-span-8 space-y-6 md:space-y-7">
              <form
                onSubmit={handlePostSubmit}
                className="border-y border-gray-800/80 py-5 md:py-6 space-y-4"
              >
                <div className="flex gap-4">
                  <div className="hidden sm:flex w-11 h-11 rounded-xl border border-cyan-500/35 shrink-0 items-center justify-center font-semibold text-cyan-200 text-lg">
                    {userData.name?.[0] || 'M'}
                  </div>
                  <textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="Share an update, idea, requirement, or event note..."
                    className="ui-input min-h-30 resize-none"
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
                        className={`whitespace-nowrap px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                          postType === type
                            ? 'text-cyan-200 border-cyan-500/45 bg-cyan-500/10'
                            : 'border-gray-800 text-gray-500 hover:text-gray-300'
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
                    className="ui-input w-full sm:w-64 text-sm!"
                  />

                  <button className="btn btn-primary w-full sm:w-auto px-5! py-2.5! text-xs! inline-flex items-center justify-center gap-2">
                    <Send size={14} />
                    Post
                  </button>
                </div>
              </form>

              <div className="border-y border-gray-800/80 divide-y divide-gray-800/75">
                {posts.map((post, idx) => (
                  <motion.article
                    key={post._id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.04 }}
                    className="px-1 md:px-2 py-5 hover:bg-white/2 transition-colors"
                  >
                    <div className="flex justify-between items-start gap-4">
                      <div className="flex gap-4 min-w-0">
                        <div className="w-10 h-10 md:w-11 md:h-11 rounded-lg border border-cyan-500/35 flex items-center justify-center font-semibold text-cyan-200 shrink-0">
                          {post.user?.name?.[0] || 'M'}
                        </div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h4 className="text-white font-semibold text-sm md:text-base">{post.user?.name || 'Member'}</h4>
                            <span className="text-cyan-300 border border-cyan-500/40 px-2 py-0.5 rounded-md text-[10px] font-semibold">
                              {post.type}
                            </span>
                          </div>
                          <p className="text-[11px] text-gray-500 mt-1 flex flex-wrap items-center gap-2">
                            <span className="inline-flex items-center gap-1">
                              <Hash size={10} className="text-cyan-300" />
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
                          <button aria-label="Delete post" onClick={() => handleDelete(post._id)} className="text-gray-600 hover:text-red-400 p-2">
                            <Trash2 size={17} />
                          </button>
                        )}
                        {isPrivileged && post.user?._id !== userData._id && (
                          <button aria-label="Warn user" onClick={() => handleWarn(post._id)} className="text-gray-600 hover:text-amber-400 p-2">
                            <AlertTriangle size={17} />
                          </button>
                        )}
                      </div>
                    </div>

                    <p className="mt-4 text-gray-200 text-sm md:text-base leading-relaxed">{post.content}</p>

                    <div className="mt-4">
                      <button
                        onClick={() => handleLike(post._id)}
                        className="inline-flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg border border-gray-700 text-gray-300 hover:text-pink-300 hover:border-pink-400/35"
                      >
                        <Heart size={14} />
                        {post.likes?.length || 0} Reactions
                      </button>
                    </div>
                  </motion.article>
                ))}

                {posts.length === 0 && (
                  <div className="py-8">
                    <DataEmpty
                      title="No posts yet"
                      hint="Share the first update with your team."
                      actionLabel="Create first post"
                      onAction={() => {
                        const textarea = document.querySelector('textarea.ui-input');
                        textarea?.focus();
                      }}
                    />
                  </div>
                )}
              </div>
            </div>

            <aside className="lg:col-span-4 h-fit lg:border-l lg:border-gray-800/80 lg:pl-6 space-y-4">
              <h3 className="font-semibold mb-2 flex items-center gap-2 text-white text-sm">
                <Sparkles size={16} className="text-indigo-300" />
                Community Standards
              </h3>
              <div className="space-y-1 divide-y divide-gray-800/80 border-y border-gray-800/80">
                {[
                  'Use clear technical context in updates.',
                  'Tag ownership and expected delivery date.',
                  'Escalate blockers early via issue ticket.',
                ].map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between px-2 py-3 text-sm text-gray-300"
                  >
                    {item}
                    <ChevronRight size={14} className="text-gray-500" />
                  </div>
                ))}
              </div>
            </aside>
          </motion.div>
        ) : activeTab === 'directory' ? (
          <motion.div
            key="directory"
            initial={{ opacity: 0, y: 12, scale: 0.99 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.99 }}
            transition={{ duration: 0.24, ease: 'easeOut' }}
            className="space-y-7 section-motion section-motion-delay-2"
          >
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
              <div>
                <p className="text-xs text-cyan-300 font-semibold">CICR Directory</p>
                <h3 className="text-2xl md:text-3xl font-semibold text-white mt-1">Member Index</h3>
                <p className="text-gray-500 text-sm mt-2">All verified members are visible here, including alumni.</p>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <SnapshotRail label="Total" value={directoryStats.total} tone="blue" />
                <SnapshotRail label="Alumni" value={directoryStats.alumni} tone="emerald" />
                <SnapshotRail label="Visible" value={directoryStats.visible} tone="cyan" />
              </div>
            </div>

            <section className="border-y border-gray-800/80 py-4">
              <div className="flex items-center gap-2 text-gray-400 text-xs font-semibold mb-3">
                <Filter size={14} className="text-cyan-300" />
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
                    className="ui-input pl-12!"
                  />
                </div>

                <select
                  value={filterBranch}
                  onChange={(e) => setFilterBranch(e.target.value)}
                  className="ui-input text-sm!"
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
                  className="ui-input text-sm!"
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
                    className="ui-input flex-1 text-sm!"
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
                    aria-label="Reset directory filters"
                    className="inline-flex items-center justify-center border border-gray-700/80 rounded-lg px-3 text-gray-400 hover:text-white hover:border-cyan-500/45"
                    title="Reset filters"
                  >
                    <RotateCcw size={16} />
                  </button>
                </div>
              </div>
            </section>

            <section className="border-y border-gray-800/80 overflow-hidden hidden lg:block">
              <div className="overflow-x-auto max-h-[68vh]">
                <table className="w-full min-w-230 border-collapse">
                  <thead className="sticky top-0 z-10 bg-[#0a0f17]/95 backdrop-blur-sm border-b border-gray-800/80">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs text-gray-400 font-semibold">Member</th>
                      <th className="px-4 py-3 text-left text-xs text-gray-400 font-semibold">Academic</th>
                      <th className="px-4 py-3 text-left text-xs text-gray-400 font-semibold">Contact</th>
                      <th className="px-4 py-3 text-left text-xs text-gray-400 font-semibold">Role</th>
                      <th className="px-4 py-3 text-right text-xs text-gray-400 font-semibold">Profile</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800/60">
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
                        <tr key={member._id} className="hover:bg-white/2 transition-colors">
                          <td className="px-4 py-3.5 align-top">
                            <div className="flex items-start gap-3">
                              <div className="w-9 h-9 rounded-lg border border-blue-500/35 flex items-center justify-center font-semibold text-cyan-200 text-sm shrink-0">
                                {member.name?.[0] || 'M'}
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-semibold text-white truncate">{member.name || 'Member'}</p>
                                <p className="mt-1 text-[11px] text-gray-500 inline-flex items-center gap-1.5">
                                  <Fingerprint size={11} className="text-blue-400" />
                                  {member.collegeId || 'NO-ID'}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3.5 align-top">
                            <p className="text-xs text-gray-300 inline-flex items-center gap-1.5">
                              <GraduationCap size={12} className="text-amber-400" />
                              {yearLabel}
                            </p>
                            <p className="mt-1 text-[11px] uppercase tracking-wider text-gray-500">
                              {member.branch || 'GENERAL'} {member.batch ? `• ${member.batch}` : ''}
                            </p>
                          </td>
                          <td className="px-4 py-3.5 align-top">
                            <p className="text-xs text-gray-300 inline-flex items-center gap-1.5">
                              <Mail size={12} className="text-blue-400 shrink-0" />
                              <span className="truncate max-w-60 inline-block">{member.email || 'No email'}</span>
                            </p>
                          </td>
                          <td className="px-4 py-3.5 align-top">
                            <div className="inline-flex items-center gap-2">
                              <span
                                className={`text-[10px] px-2 py-1 rounded-md font-semibold ${
                                  isAlumni ? 'bg-emerald-500/15 text-emerald-300' : 'bg-blue-500/15 text-blue-300'
                                }`}
                              >
                                {member.role || 'User'}
                              </span>
                              {member.role === 'Admin' && <ShieldCheck size={14} className="text-red-400" />}
                            </div>
                          </td>
                          <td className="px-4 py-3.5 text-right align-top">
                            {hasProfile ? (
                              <Link
                                to={`/profile/${encodeURIComponent(member.collegeId)}`}
                                className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border border-blue-500/40 text-blue-200 text-xs font-semibold hover:bg-blue-500/10"
                              >
                                Open Profile <ExternalLink size={11} />
                              </Link>
                            ) : (
                              <span className="inline-flex items-center justify-center px-3 py-1.5 rounded-lg border border-gray-700 text-gray-500 text-xs font-semibold">
                                Unavailable
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="grid grid-cols-1 sm:grid-cols-2 gap-3 lg:hidden">
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
                    key={`mobile-${member._id}`}
                    className="border-b border-gray-800/70 pb-4 space-y-2.5"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl border border-cyan-500/35 flex items-center justify-center font-semibold text-cyan-200 shrink-0">
                        {member.name?.[0] || 'M'}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-white truncate">{member.name || 'Member'}</p>
                        <p className="mt-1 text-[11px] text-gray-500 inline-flex items-center gap-1.5">
                          <Fingerprint size={11} className="text-cyan-300" />
                          {member.collegeId || 'NO-ID'}
                        </p>
                      </div>
                    </div>

                    <p className="text-xs text-gray-300 inline-flex items-center gap-1.5">
                      <GraduationCap size={12} className="text-amber-400" />
                      {yearLabel} • {member.branch || 'GENERAL'} {member.batch ? `• ${member.batch}` : ''}
                    </p>

                    <p className="text-xs text-gray-300 inline-flex items-center gap-1.5 break-all">
                      <Mail size={12} className="text-cyan-300 shrink-0" />
                      {member.email || 'No email'}
                    </p>

                    <div className="flex items-center justify-between gap-2 pt-1">
                      <span
                        className={`text-[10px] px-2 py-1 rounded-md font-semibold ${
                          isAlumni ? 'bg-emerald-500/15 text-emerald-300' : 'bg-cyan-500/15 text-cyan-300'
                        }`}
                      >
                        {member.role || 'User'}
                      </span>
                      {hasProfile ? (
                        <Link
                          to={`/profile/${encodeURIComponent(member.collegeId)}`}
                          className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border border-cyan-500/40 text-cyan-200 text-xs font-semibold hover:bg-cyan-500/10"
                        >
                          Open Profile <ExternalLink size={11} />
                        </Link>
                      ) : (
                        <span className="inline-flex items-center justify-center px-3 py-1.5 rounded-lg border border-gray-700 text-gray-500 text-xs font-semibold">
                          Unavailable
                        </span>
                      )}
                    </div>
                  </article>
                );
              })}
            </section>

            {filteredMembers.length === 0 && (
              <div className="text-center py-16">
                <Users className="mx-auto text-gray-700 mb-3" size={44} />
                <h4 className="text-lg font-semibold text-gray-300">No members found</h4>
                <p className="text-gray-500 mt-1 text-sm">Try changing filters or clearing search.</p>
                <button onClick={resetDirectoryFilters} className="mt-4 text-blue-400 font-semibold hover:text-blue-300">
                  Reset all filters
                </button>
              </div>
            )}
          </motion.div>
        ) : (
          <motion.div
            key="issues"
            initial={{ opacity: 0, y: 12, scale: 0.99 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.99 }}
            transition={{ duration: 0.24, ease: 'easeOut' }}
            className="space-y-7 section-motion section-motion-delay-2"
          >
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
              <div>
                <p className="text-xs text-rose-300 font-semibold">Issue Escalation</p>
                <h3 className="text-2xl md:text-3xl font-semibold text-white mt-1">Raise an Admin Ticket</h3>
                <p className="text-gray-500 text-sm mt-2">
                  Issues are private and routed directly to Admin. They are not visible in public feed.
                </p>
              </div>
              <div className="inline-flex items-center gap-2 border border-rose-500/35 text-rose-200 rounded-lg px-3 py-2 text-xs">
                <ShieldQuestion size={14} />
                Admin-handled workflow
              </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,420px)_minmax(0,1fr)] gap-8">
              <section
                ref={issueSectionRef}
                className="border-y border-gray-800/80 py-4"
              >
                <h4 className="text-sm font-semibold text-gray-200 inline-flex items-center gap-2">
                  <Bug size={14} className="text-rose-300" />
                  New Issue
                </h4>

                <form onSubmit={handleIssueSubmit} className="mt-4 space-y-3">
                  <input
                    ref={issueTitleRef}
                    value={issueForm.title}
                    onChange={(e) => setIssueForm((prev) => ({ ...prev, title: e.target.value }))}
                    placeholder="Issue title"
                    className="ui-input"
                    required
                    minLength={4}
                    maxLength={160}
                  />
                  <p className="text-xs text-gray-400">Use a clear summary so Admin can triage quickly.</p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <select
                      value={issueForm.category}
                      onChange={(e) => setIssueForm((prev) => ({ ...prev, category: e.target.value }))}
                      className="ui-input"
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
                      className="ui-input"
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
                    className="ui-input resize-none"
                    rows={5}
                    required
                    minLength={10}
                    maxLength={3000}
                  />
                  <p className="text-xs text-gray-400">Include impact, urgency, and any blocker details.</p>

                  <button
                    type="submit"
                    disabled={issueBusy}
                    className="btn btn-secondary w-full text-xs! py-2.5! border-rose-500/40! text-rose-100! hover:bg-rose-500/10! disabled:opacity-60 inline-flex items-center justify-center gap-2"
                  >
                    {issueBusy ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                    Submit To Admin
                  </button>
                </form>

                <div className="mt-5 border-t border-gray-800/80 pt-4">
                  <h5 className="text-xs text-gray-400 font-semibold">My Ticket History</h5>
                  <div className="mt-3 space-y-3 max-h-90 overflow-auto pr-1">
                    {myIssues.map((issue) => (
                      <article key={issue._id} className="border-b border-gray-800/70 pb-3">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-semibold text-white leading-snug">{issue.title}</p>
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded-md font-semibold border ${statusClassName(
                              issue.status
                            )}`}
                          >
                            {prettyIssueStatus(issue.status)}
                          </span>
                        </div>
                        <p className="text-xs text-gray-400 mt-2 line-clamp-3">{issue.description}</p>
                        <div className="mt-2 text-[10px] text-gray-500 flex flex-wrap gap-2">
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
                        {issue.resolvedBy?.name ? <p className="mt-2 text-[10px] text-emerald-200">Resolved by {issue.resolvedBy.name}</p> : null}
                        {issue.adminNote ? (
                          <p className="mt-2 text-xs text-amber-200 border border-amber-500/30 rounded-lg px-2.5 py-1.5">
                            Admin note: {issue.adminNote}
                          </p>
                        ) : null}
                        <div className="mt-3 border-l border-gray-700/75 pl-2.5 py-1">
                          <p className="text-[10px] text-gray-500 font-semibold">Timeline</p>
                          <div className="mt-2 space-y-1.5">
                            {buildIssueTimeline(issue).map((step) => (
                              <div key={step.id} className="flex items-start gap-2 text-[10px]">
                                <CircleDashed size={11} className="text-blue-300 mt-0.5 shrink-0" />
                                <div className="min-w-0">
                                  <p className="text-gray-200">{step.label}</p>
                                  <p className="text-gray-500 truncate">{step.detail}</p>
                                  <p className="text-gray-600">{fmtDateTime(step.at)}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </article>
                    ))}

                    {myIssues.length === 0 && (
                      <p className="text-sm text-gray-500 px-3 py-4 text-center">
                        No issues submitted yet.
                      </p>
                    )}
                  </div>
                </div>
              </section>

              {isStrictAdmin && (
                <section className="border-y border-gray-800/80 py-4">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <h4 className="text-sm font-semibold text-gray-200 inline-flex items-center gap-2">
                      <ShieldCheck size={14} className="text-cyan-300" />
                      Admin Issue Inbox
                    </h4>
                    <select
                      value={adminIssueFilter}
                      onChange={(e) => setAdminIssueFilter(e.target.value)}
                      className="ui-input text-sm! max-w-45"
                    >
                      <option value="All">All Statuses</option>
                      {ISSUE_STATUSES.map((status) => (
                        <option key={status} value={status}>
                          {prettyIssueStatus(status)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="mt-4 divide-y divide-gray-800/70 max-h-180 overflow-auto pr-1">
                    {adminVisibleIssues.map((issue) => (
                      <article key={issue._id} className="py-4">
                        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm md:text-base font-semibold text-white wrap-break-word">{issue.title}</p>
                            <p className="text-xs text-gray-500 mt-1">
                              {issue.createdBy?.name || 'Unknown'} • {issue.createdBy?.collegeId || 'No-ID'}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span
                              className={`text-[10px] px-2 py-0.5 rounded-md font-semibold border ${priorityClassName(
                                issue.priority
                              )}`}
                            >
                              {issue.priority}
                            </span>
                            <span
                              className={`text-[10px] px-2 py-0.5 rounded-md font-semibold border ${statusClassName(
                                issue.status
                              )}`}
                            >
                              {prettyIssueStatus(issue.status)}
                            </span>
                          </div>
                        </div>

                        <p className="mt-3 text-sm text-gray-300 leading-relaxed">{issue.description}</p>

                        <div className="mt-3 text-[10px] text-gray-500 flex flex-wrap gap-2">
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
                        {issue.resolvedBy?.name ? <p className="mt-2 text-[10px] text-emerald-200">Resolved by {issue.resolvedBy.name}</p> : null}

                        {issue.adminNote ? (
                          <p className="mt-2 text-xs text-amber-200 border border-amber-500/30 rounded-lg px-2.5 py-1.5">
                            Admin note: {issue.adminNote}
                          </p>
                        ) : null}

                        <div className="mt-3 border-l border-gray-700/75 pl-2.5 py-1">
                          <p className="text-[10px] text-gray-500 font-semibold">Timeline</p>
                          <div className="mt-2 space-y-1.5">
                            {buildIssueTimeline(issue).map((step) => (
                              <div key={step.id} className="flex items-start gap-2 text-[10px]">
                                <CircleDashed size={11} className="text-blue-300 mt-0.5 shrink-0" />
                                <div className="min-w-0">
                                  <p className="text-gray-200">{step.label}</p>
                                  <p className="text-gray-500 truncate">{step.detail}</p>
                                  <p className="text-gray-600">{fmtDateTime(step.at)}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="mt-3 pt-3 border-t border-gray-800 flex flex-wrap gap-2">
                          <button
                            onClick={() => handleAdminIssueUpdate(issue, 'InReview')}
                            className="text-xs px-3 py-1.5 rounded-lg border border-amber-500/35 text-amber-200 inline-flex items-center gap-1"
                          >
                            <CircleDashed size={12} />
                            In Review
                          </button>
                          <button
                            onClick={() => handleAdminIssueUpdate(issue, 'Resolved')}
                            className="text-xs px-3 py-1.5 rounded-lg border border-emerald-500/35 text-emerald-200 inline-flex items-center gap-1"
                          >
                            <CheckCircle2 size={12} />
                            Resolve
                          </button>
                          <button
                            onClick={() => handleAdminIssueUpdate(issue, 'Rejected')}
                            className="text-xs px-3 py-1.5 rounded-lg border border-rose-500/35 text-rose-200 inline-flex items-center gap-1"
                          >
                            <XCircle size={12} />
                            Reject
                          </button>
                        </div>
                      </article>
                    ))}

                    {adminVisibleIssues.length === 0 && (
                      <div className="text-center py-12">
                        <ShieldCheck className="mx-auto text-gray-600 mb-3" size={34} />
                        <p className="text-sm font-semibold text-gray-300">No issues in this queue.</p>
                      </div>
                    )}
                  </div>
                </section>
              )}
            </div>

            {!isStrictAdmin && (
              <div className="border border-cyan-500/25 bg-cyan-500/5 rounded-xl p-4 text-sm text-gray-300 inline-flex items-start gap-2 section-motion section-motion-delay-3">
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

function SnapshotRail({ label, value, tone = 'cyan' }) {
  const toneClass =
    tone === 'blue'
      ? 'border-blue-500/40 text-blue-100'
      : tone === 'amber'
      ? 'border-amber-500/40 text-amber-100'
      : tone === 'emerald'
      ? 'border-emerald-500/40 text-emerald-100'
      : 'border-cyan-500/40 text-cyan-100';

  return (
    <article className={`border-l-2 pl-3 ${toneClass}`}>
      <p className="text-xs text-gray-400">{label}</p>
      <p className="text-lg font-semibold mt-1">{value}</p>
    </article>
  );
}
