import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  fetchMembers,
  updateUserByAdmin,
  deleteUser,
  generateInvite,
  sendInviteEmail,
  fetchPendingAdminActions,
  approveAdminAction,
  fetchApplications,
  updateApplication,
  sendApplicationInvite,
  generatePasswordResetCode,
  fetchAuditLogs,
  broadcastNotification,
} from '../api';
import CicrAssistant from '../components/CicrAssistant';
import PageHeader from '../components/PageHeader';
import { 
  Shield, Trash2, UserPlus, Copy, Check, 
  Search, Mail, Send, Loader2, UserCheck, GraduationCap, Fingerprint,
  ClipboardCheck, Crown, KeyRound, Megaphone, ScrollText, Download, ArrowUpDown, UserCog, GripVertical, ShieldAlert, X
} from 'lucide-react';

const APPLICATION_STATUSES = ['New', 'InReview', 'Interview', 'Accepted', 'Selected', 'Rejected'];
const USER_TABLE_COLUMNS = [
  { id: 'member', label: 'Member' },
  { id: 'role', label: 'Role' },
  { id: 'year', label: 'Year' },
  { id: 'approval', label: 'Approval' },
  { id: 'actions', label: 'Actions' },
];
const DEFAULT_VISIBLE_COLUMNS = USER_TABLE_COLUMNS.map((column) => column.id);
const RECRUITMENT_LANES = [
  { id: 'Applied', label: 'Applied', status: 'New', stage: 'Applied' },
  { id: 'Shortlisted', label: 'Shortlisted', status: 'InReview', stage: 'Shortlisted' },
  { id: 'Interview', label: 'Interview', status: 'Interview', stage: 'Interview' },
  { id: 'Selected', label: 'Selected', status: 'Selected', stage: 'Selected' },
  { id: 'Joined', label: 'Joined', status: 'Selected', stage: 'Joined' },
];
const FILTER_PRESET_KEY = 'admin_user_saved_views';

const normalizeAppStage = (app = {}) => {
  const stage = String(app.stage || '').trim().toLowerCase();
  const status = String(app.status || '').trim().toLowerCase();
  if (stage === 'joined') return 'Joined';
  if (status === 'selected' && stage === 'joined') return 'Joined';
  if (status === 'accepted') return 'Selected';
  if (status === 'selected') return 'Selected';
  if (status === 'interview') return 'Interview';
  if (status === 'inreview') return 'Shortlisted';
  return 'Applied';
};

const statusBadgeClass = (status) => {
  if (status === 'Selected') return 'text-emerald-300 border-emerald-500/40 bg-emerald-500/10';
  if (status === 'Accepted') return 'text-cyan-300 border-cyan-500/40 bg-cyan-500/10';
  if (status === 'Interview') return 'text-amber-300 border-amber-500/40 bg-amber-500/10';
  if (status === 'Rejected') return 'text-rose-300 border-rose-500/40 bg-rose-500/10';
  return 'text-gray-300 border-gray-700 bg-gray-800/30';
};

const dispatchToast = (message, type = 'info') => {
  try {
    window.dispatchEvent(new CustomEvent('app:toast', { detail: { message, type } }));
  } catch {
    window.alert(message);
  }
};

export default function AdminPanel() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState(localStorage.getItem('admin_users_search') || '');
  const [adminTab, setAdminTab] = useState(localStorage.getItem('admin_panel_tab') || 'users');
  const [sortBy, setSortBy] = useState(localStorage.getItem('admin_users_sort') || 'name_asc');
  const [userQuickFilter, setUserQuickFilter] = useState(localStorage.getItem('admin_users_quick_filter') || 'all');
  const [visibleColumns, setVisibleColumns] = useState(() => {
    const cached = localStorage.getItem('admin_users_columns');
    if (!cached) return DEFAULT_VISIBLE_COLUMNS;
    try {
      const parsed = JSON.parse(cached);
      if (!Array.isArray(parsed)) return DEFAULT_VISIBLE_COLUMNS;
      const next = parsed.filter((column) => DEFAULT_VISIBLE_COLUMNS.includes(column));
      return next.length ? next : DEFAULT_VISIBLE_COLUMNS;
    } catch {
      return DEFAULT_VISIBLE_COLUMNS;
    }
  });
  const [savedViews, setSavedViews] = useState(() => {
    const cached = localStorage.getItem(FILTER_PRESET_KEY);
    if (!cached) return [];
    try {
      const parsed = JSON.parse(cached);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });
  const [newViewName, setNewViewName] = useState('');
  const [columnChooserOpen, setColumnChooserOpen] = useState(false);
  const [selectedUserIds, setSelectedUserIds] = useState([]);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [inviteCode, setInviteCode] = useState('');
  const [inviteMaxUses, setInviteMaxUses] = useState(1);
  const [inviteMeta, setInviteMeta] = useState(null);
  const [recipientEmail, setRecipientEmail] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [copied, setCopied] = useState(false);
  const [resetCopied, setResetCopied] = useState(false);
  const [selectedResetUserId, setSelectedResetUserId] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetCodeData, setResetCodeData] = useState(null);
  const [pendingActions, setPendingActions] = useState([]);
  const [applications, setApplications] = useState([]);
  const [appFilter, setAppFilter] = useState('All');
  const [appSearch, setAppSearch] = useState('');
  const [appLoading, setAppLoading] = useState(true);
  const [selectedApplicationIds, setSelectedApplicationIds] = useState([]);
  const [draggingAppId, setDraggingAppId] = useState('');
  const [bulkRecruitmentBusy, setBulkRecruitmentBusy] = useState(false);
  const [auditRows, setAuditRows] = useState([]);
  const [auditLoading, setAuditLoading] = useState(true);
  const [broadcastBusy, setBroadcastBusy] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState({
    open: false,
    user: null,
    typedPhrase: '',
    submitting: false,
    error: '',
  });
  const [broadcastForm, setBroadcastForm] = useState({
    title: '',
    message: '',
    role: 'all',
    type: 'info',
    link: '/dashboard',
  });

  useEffect(() => {
    loadUsers();
    loadPendingActions();
    loadApplications();
    loadAuditLogs();
  }, []);

  useEffect(() => {
    localStorage.setItem('admin_users_search', searchTerm);
  }, [searchTerm]);

  useEffect(() => {
    localStorage.setItem('admin_panel_tab', adminTab);
  }, [adminTab]);

  useEffect(() => {
    localStorage.setItem('admin_users_sort', sortBy);
  }, [sortBy]);

  useEffect(() => {
    localStorage.setItem('admin_users_quick_filter', userQuickFilter);
  }, [userQuickFilter]);

  useEffect(() => {
    localStorage.setItem('admin_users_columns', JSON.stringify(visibleColumns));
  }, [visibleColumns]);

  useEffect(() => {
    localStorage.setItem(FILTER_PRESET_KEY, JSON.stringify(savedViews));
  }, [savedViews]);

  useEffect(() => {
    if (!deleteDialog.open) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeDeleteDialog();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [deleteDialog.open]);

  const profile = JSON.parse(localStorage.getItem('profile') || '{}');
  const currentUser = profile.result || profile;
  const currentUserId = String(currentUser?._id || '');
  const requiredDeletePhrase = useMemo(() => {
    const targetName = String(deleteDialog.user?.name || '').trim();
    return targetName ? `remove ${targetName}` : '';
  }, [deleteDialog.user]);
  const isDeletePhraseValid = useMemo(
    () =>
      String(deleteDialog.typedPhrase || '').trim() === String(requiredDeletePhrase || ''),
    [deleteDialog.typedPhrase, requiredDeletePhrase]
  );

  const loadUsers = async () => {
    try {
      const { data } = await fetchMembers();
      setUsers(data);
    } catch (err) { 
      console.error("Failed to load users", err); 
    } finally { 
      setLoading(false); 
    }
  };

  const loadPendingActions = async () => {
    try {
      const { data } = await fetchPendingAdminActions();
      setPendingActions(Array.isArray(data) ? data : []);
    } catch (err) {
      // ignore
    }
  };

  const loadApplications = async () => {
    setAppLoading(true);
    try {
      const { data } = await fetchApplications();
      setApplications(Array.isArray(data) ? data : []);
    } catch (err) {
      setApplications([]);
    } finally {
      setAppLoading(false);
    }
  };

  const loadAuditLogs = async () => {
    setAuditLoading(true);
    try {
      const { data } = await fetchAuditLogs({ limit: 60 });
      setAuditRows(Array.isArray(data) ? data : []);
    } catch (err) {
      setAuditRows([]);
    } finally {
      setAuditLoading(false);
    }
  };

  const handleRoleChange = async (userId, newRole) => {
    if (!window.confirm(`Change user role to ${newRole}?`)) return;
    try {
      const { data } = await updateUserByAdmin(userId, { role: newRole });
      if (data?.requiresApproval) {
        alert(data.message);
        loadPendingActions();
        return;
      }
      setUsers(users.map(u => u._id === userId ? { ...u, role: newRole } : u));
    } catch (err) {
      alert(err.response?.data?.message || "Error updating role");
    }
  };

  const handleApprovalChange = async (userId, approvalStatus) => {
    const confirmMsg = approvalStatus === 'Approved'
      ? 'Approve this account?'
      : 'Reject this account?';
    if (!window.confirm(confirmMsg)) return;
    try {
      const isVerified = approvalStatus === 'Approved';
      await updateUserByAdmin(userId, { approvalStatus, isVerified });
      setUsers(users.map(u => (
        u._id === userId ? { ...u, approvalStatus, isVerified } : u
      )));
    } catch (err) {
      alert('Error updating approval status');
    }
  };

  const openDeleteDialog = (targetUser) => {
    if (!targetUser?._id) return;
    if (String(targetUser._id) === currentUserId) {
      dispatchToast('You cannot delete your own account from admin panel.', 'error');
      return;
    }

    setDeleteDialog({
      open: true,
      user: targetUser,
      typedPhrase: '',
      submitting: false,
      error: '',
    });
  };

  const closeDeleteDialog = (force = false) => {
    setDeleteDialog((prev) => {
      if (prev.submitting && !force) return prev;
      return {
        open: false,
        user: null,
        typedPhrase: '',
        submitting: false,
        error: '',
      };
    });
  };

  const confirmDeleteFromDialog = async () => {
    const target = deleteDialog.user;
    if (!target?._id) return;

    if (!isDeletePhraseValid) {
      setDeleteDialog((prev) => ({
        ...prev,
        error: `Type "${requiredDeletePhrase}" exactly to continue.`,
      }));
      return;
    }

    setDeleteDialog((prev) => ({ ...prev, submitting: true, error: '' }));
    try {
      const { data } = await deleteUser(target._id);
      if (data?.requiresApproval) {
        dispatchToast(data.message || 'Delete request requires approval.', 'info');
        await loadPendingActions();
      } else {
        setUsers((prev) => prev.filter((u) => String(u._id) !== String(target._id)));
        dispatchToast(`Removed ${target.name || 'user'} successfully.`, 'success');
      }
      closeDeleteDialog(true);
    } catch (err) {
      setDeleteDialog((prev) => ({
        ...prev,
        submitting: false,
        error: err.response?.data?.message || 'Unable to delete user.',
      }));
    }
  };

  const handleGenerateResetCode = async (userId, displayName) => {
    if (!userId) return;
    setResetLoading(true);
    try {
      const { data } = await generatePasswordResetCode(userId);
      setSelectedResetUserId(userId);
      setResetCodeData({
        resetCode: data?.resetCode || '',
        validForMinutes: data?.validForMinutes || 15,
        userName: displayName || data?.user?.name || 'Member',
        collegeId: data?.user?.collegeId || '',
      });
      setResetCopied(false);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to generate reset code');
    } finally {
      setResetLoading(false);
    }
  };

  const copyResetCode = async () => {
    if (!resetCodeData?.resetCode) return;
    try {
      await navigator.clipboard.writeText(resetCodeData.resetCode);
      setResetCopied(true);
      setTimeout(() => setResetCopied(false), 1600);
    } catch (err) {
      alert('Unable to copy reset code');
    }
  };

  const handleApproveAction = async (actionId) => {
    try {
      const { data } = await approveAdminAction(actionId);
      alert(data.message || 'Approval recorded');
      await Promise.all([loadPendingActions(), loadUsers()]);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to approve action');
    }
  };

  const handleAppStatusChange = async (applicationId, status) => {
    try {
      const note = window.prompt('Add a status note (optional):');
      const payload = { status };
      if (note) payload.note = note;
      const { data } = await updateApplication(applicationId, payload);
      setApplications(applications.map((app) => (app._id === data._id ? data : app)));
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update application status');
    }
  };

  const handleAppAssign = async (applicationId, assignedTo) => {
    try {
      const { data } = await updateApplication(applicationId, { assignedTo });
      setApplications(applications.map((app) => (app._id === data._id ? data : app)));
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to assign application');
    }
  };

  const handleAppNote = async (applicationId) => {
    const note = window.prompt('Add internal note for this applicant:');
    if (!note) return;
    try {
      const { data } = await updateApplication(applicationId, { note });
      setApplications(applications.map((app) => (app._id === data._id ? data : app)));
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to add note');
    }
  };

  const handleSendAppInvite = async (applicationId) => {
    if (!window.confirm('Send invite to this applicant?')) return;
    try {
      const { data } = await sendApplicationInvite(applicationId);
      alert(`Invite sent. Code: ${data.inviteCode}`);
      loadApplications();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to send invite');
    }
  };

  const handleGenerateInvite = async () => {
    const normalizedMaxUses = Math.max(1, Math.min(100, Number(inviteMaxUses) || 1));
    try {
      const { data } = await generateInvite({ maxUses: normalizedMaxUses });
      setInviteCode(data?.code || '');
      setInviteMaxUses(normalizedMaxUses);
      setInviteMeta({
        maxUses: Number(data?.maxUses || normalizedMaxUses),
        currentUses: Number(data?.currentUses || 0),
        remainingUses: Number(
          data?.remainingUses ?? data?.maxUses ?? normalizedMaxUses
        ),
        expiresAt: data?.expiresAt || '',
      });
      setCopied(false);
    } catch (err) { 
      alert(err.response?.data?.message || "Error generating code"); 
    }
  };

  const handleSendInvite = async () => {
    if (!inviteCode) return alert("Generate an access code first");
    if (!recipientEmail) return alert("Please enter an email address");
    setIsSending(true);
    try {
      await sendInviteEmail({ email: recipientEmail, inviteCode });
      alert(`Success! Invite sent to ${recipientEmail}`);
      setRecipientEmail('');
    } catch (err) {
      alert(err.response?.data?.message || "Failed to send email");
    } finally { 
      setIsSending(false); 
    }
  };

  const handleBroadcast = async (e) => {
    e.preventDefault();
    const payload = {
      title: broadcastForm.title.trim(),
      message: broadcastForm.message.trim(),
      role: broadcastForm.role,
      type: broadcastForm.type,
      link: broadcastForm.link.trim(),
    };
    if (!payload.title || !payload.message) {
      alert('Broadcast title and message are required.');
      return;
    }

    setBroadcastBusy(true);
    try {
      const { data } = await broadcastNotification(payload);
      alert(`Broadcast sent to ${data?.recipientCount || 0} members.`);
      setBroadcastForm((prev) => ({ ...prev, title: '', message: '' }));
      loadAuditLogs();
    } catch (err) {
      alert(err.response?.data?.message || 'Unable to send broadcast.');
    } finally {
      setBroadcastBusy(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(inviteCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const filteredUsers = users.filter((u) => {
    const query = searchTerm.trim().toLowerCase();
    const matchesQuery =
      !query ||
      u.name?.toLowerCase().includes(query) ||
      u.collegeId?.toLowerCase().includes(query) ||
      u.email?.toLowerCase().includes(query);

    const approval = String(u.approvalStatus || (u.isVerified ? 'Approved' : 'Pending')).toLowerCase();
    const role = String(u.role || '').toLowerCase();
    const year = Number(u.year || 0);
    const matchesQuickFilter =
      userQuickFilter === 'all' ||
      (userQuickFilter === 'pending' && approval === 'pending') ||
      (userQuickFilter === 'approved' && approval === 'approved') ||
      (userQuickFilter === 'admins' && (role === 'admin' || role === 'head')) ||
      (userQuickFilter === 'alumni' && role === 'alumni') ||
      (userQuickFilter === 'freshers' && year === 1) ||
      (userQuickFilter === 'seniors' && year >= 2);

    return matchesQuery && matchesQuickFilter;
  });

  const sortedUsers = useMemo(() => {
    const [key, dir] = String(sortBy || 'name_asc').split('_');
    const factor = dir === 'desc' ? -1 : 1;

    const read = (row) => {
      if (key === 'role') return String(row.role || '');
      if (key === 'year') return Number(row.year || 0);
      if (key === 'approval') return String(row.approvalStatus || (row.isVerified ? 'Approved' : 'Pending'));
      return String(row.name || '');
    };

    return [...filteredUsers].sort((a, b) => {
      const va = read(a);
      const vb = read(b);
      if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * factor;
      return String(va).localeCompare(String(vb)) * factor;
    });
  }, [filteredUsers, sortBy]);

  useEffect(() => {
    setSelectedUserIds((prev) => prev.filter((id) => sortedUsers.some((row) => String(row._id) === String(id))));
  }, [sortedUsers]);

  const allVisibleSelected =
    sortedUsers.length > 0 && sortedUsers.every((row) => selectedUserIds.includes(String(row._id)));

  const toggleSort = (field) => {
    setSortBy((prev) => {
      const [currentField, currentDir] = String(prev || 'name_asc').split('_');
      if (currentField === field) return `${field}_${currentDir === 'asc' ? 'desc' : 'asc'}`;
      return `${field}_asc`;
    });
  };

  const sortIndicator = (field) => {
    const [currentField, currentDir] = String(sortBy || 'name_asc').split('_');
    if (currentField !== field) return '↕';
    return currentDir === 'asc' ? '↑' : '↓';
  };

  const toggleSelectAllUsers = () => {
    if (allVisibleSelected) {
      setSelectedUserIds([]);
      return;
    }
    setSelectedUserIds(sortedUsers.map((row) => String(row._id)));
  };

  const toggleSelectUser = (userId) => {
    const id = String(userId);
    setSelectedUserIds((prev) => (prev.includes(id) ? prev.filter((row) => row !== id) : [...prev, id]));
  };

  const handleBulkApproveUsers = async () => {
    if (selectedUserIds.length === 0) return;
    if (!window.confirm(`Approve ${selectedUserIds.length} selected user(s)?`)) return;

    setBulkBusy(true);
    try {
      for (const userId of selectedUserIds) {
        await updateUserByAdmin(userId, { approvalStatus: 'Approved', isVerified: true });
      }
      await loadUsers();
      setSelectedUserIds([]);
      alert('Selected users approved.');
    } catch (err) {
      alert(err.response?.data?.message || 'Bulk approval failed for one or more users.');
    } finally {
      setBulkBusy(false);
    }
  };

  const handleExportUsers = () => {
    const headers = ['Name', 'College ID', 'Email ID', 'Year', 'Batch', 'Branch', 'Contact Number'];
    const rows = sortedUsers.map((row) => [
      row.name || '',
      row.collegeId || '',
      row.email || '',
      row.year || '',
      row.batch || '',
      row.branch || '',
      row.phone || '',
    ]);
    const csv = [headers, ...rows]
      .map((line) => line.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `cicr-users-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(link.href);
  };

  const adminUsers = users.filter(
    (u) =>
      (String(u.role || '').toLowerCase() === 'admin' || String(u.role || '').toLowerCase() === 'head') &&
      (u.isVerified || String(u.approvalStatus || '').toLowerCase() === 'approved')
  );

  const resetEligibleUsers = users.filter((u) => String(u.approvalStatus || '').toLowerCase() !== 'rejected');
  const inviteExpiryLabel = useMemo(() => {
    const raw = inviteMeta?.expiresAt;
    if (!raw) return '';
    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) return '';
    return parsed.toLocaleString();
  }, [inviteMeta?.expiresAt]);

  const filteredApplications = applications.filter((app) => {
    const matchesStatus = appFilter === 'All' || app.status === appFilter;
    const query = appSearch.trim().toLowerCase();
    const matchesSearch =
      !query ||
      app.fullName?.toLowerCase().includes(query) ||
      app.email?.toLowerCase().includes(query) ||
      app.phone?.toLowerCase().includes(query);
    return matchesStatus && matchesSearch;
  });

  const applicationsByLane = useMemo(() => {
    const map = {};
    RECRUITMENT_LANES.forEach((lane) => {
      map[lane.id] = [];
    });

    for (const app of filteredApplications) {
      if (String(app.status || '') === 'Rejected') continue;
      const laneId = normalizeAppStage(app);
      if (map[laneId]) map[laneId].push(app);
    }
    return map;
  }, [filteredApplications]);

  const rejectedApplications = useMemo(
    () => filteredApplications.filter((app) => String(app.status || '') === 'Rejected'),
    [filteredApplications]
  );

  useEffect(() => {
    setSelectedApplicationIds((prev) =>
      prev.filter((id) => filteredApplications.some((row) => String(row._id) === String(id)))
    );
  }, [filteredApplications]);

  const toggleColumnVisibility = (columnId) => {
    setVisibleColumns((prev) => {
      if (prev.includes(columnId)) {
        if (prev.length === 1) return prev;
        return prev.filter((id) => id !== columnId);
      }
      return [...prev, columnId];
    });
  };

  const saveCurrentUserView = () => {
    const name = String(newViewName || '').trim();
    if (!name) return;
    const view = {
      id: `${Date.now()}_${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
      name,
      searchTerm,
      sortBy,
      userQuickFilter,
      visibleColumns,
    };
    setSavedViews((prev) => {
      const deduped = prev.filter((item) => String(item.name || '').toLowerCase() !== name.toLowerCase());
      return [view, ...deduped].slice(0, 8);
    });
    setNewViewName('');
  };

  const applyUserView = (view) => {
    setSearchTerm(view.searchTerm || '');
    setSortBy(view.sortBy || 'name_asc');
    setUserQuickFilter(view.userQuickFilter || 'all');
    if (Array.isArray(view.visibleColumns) && view.visibleColumns.length > 0) {
      setVisibleColumns(view.visibleColumns.filter((id) => DEFAULT_VISIBLE_COLUMNS.includes(id)));
    }
  };

  const deleteUserView = (id) => {
    setSavedViews((prev) => prev.filter((view) => String(view.id) !== String(id)));
  };

  const toggleApplicationSelection = (applicationId) => {
    const id = String(applicationId);
    setSelectedApplicationIds((prev) => (prev.includes(id) ? prev.filter((row) => row !== id) : [...prev, id]));
  };

  const allFilteredApplicationsSelected =
    filteredApplications.length > 0 &&
    filteredApplications.every((row) => selectedApplicationIds.includes(String(row._id)));

  const toggleSelectAllApplications = () => {
    if (allFilteredApplicationsSelected) {
      setSelectedApplicationIds([]);
      return;
    }
    setSelectedApplicationIds(filteredApplications.map((row) => String(row._id)));
  };

  const moveApplicationToLane = async (applicationId, laneId) => {
    const lane = RECRUITMENT_LANES.find((row) => row.id === laneId);
    if (!lane) return;
    try {
      const { data } = await updateApplication(applicationId, {
        status: lane.status,
        stage: lane.stage,
      });
      setApplications((prev) => prev.map((app) => (app._id === data._id ? data : app)));
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to move application.');
    }
  };

  const handleBulkMoveApplications = async (laneId) => {
    const lane = RECRUITMENT_LANES.find((row) => row.id === laneId);
    if (!lane || selectedApplicationIds.length === 0) return;
    if (!window.confirm(`Move ${selectedApplicationIds.length} selected applicant(s) to ${lane.label}?`)) return;

    setBulkRecruitmentBusy(true);
    try {
      for (const id of selectedApplicationIds) {
        await updateApplication(id, { status: lane.status, stage: lane.stage });
      }
      await loadApplications();
      setSelectedApplicationIds([]);
    } catch (err) {
      alert(err.response?.data?.message || 'Bulk move failed.');
    } finally {
      setBulkRecruitmentBusy(false);
    }
  };

  return (
    <div className="ui-page space-y-6 md:space-y-10 max-w-7xl pb-20 px-4 sm:px-6 lg:px-8 overflow-x-hidden page-motion-d">
      <div className="section-motion section-motion-delay-1">
        <PageHeader
          eyebrow="Admin Operations"
          title="Admin Control Center"
          subtitle="Authorization, recruitment workflow, auditability, and organization-wide communication controls."
          icon={Shield}
          actions={
            <div className="flex items-center gap-2">
              <label className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-800 bg-[#0a0a0c]">
                <span className="text-[10px] uppercase tracking-widest text-gray-500 font-black">Uses</span>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={inviteMaxUses}
                  onChange={(e) => setInviteMaxUses(e.target.value)}
                  className="w-14 bg-transparent text-sm text-white outline-none"
                />
              </label>
              <button onClick={handleGenerateInvite} className="btn btn-primary">
                <UserPlus size={14} /> Generate Access Key
              </button>
            </div>
          }
        />
      </div>

      <div className="inline-flex items-center gap-2 rounded-2xl border border-gray-800 p-1 section-motion section-motion-delay-1">
        {[
          { id: 'users', label: 'Users', icon: UserCog },
          { id: 'recruitment', label: 'Recruitment', icon: ClipboardCheck },
          { id: 'broadcast', label: 'Broadcast', icon: Megaphone },
          { id: 'audit', label: 'Audit', icon: ScrollText },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setAdminTab(tab.id)}
            className={`px-4 py-2 rounded-xl text-[10px] md:text-xs font-black uppercase tracking-[0.16em] inline-flex items-center gap-2 ${
              adminTab === tab.id
                ? 'text-white border border-blue-500/45 bg-blue-500/10'
                : 'text-gray-500 hover:text-gray-200'
            }`}
          >
            <tab.icon size={13} />
            {tab.label}
          </button>
        ))}
      </div>

      {adminTab === 'users' && (
        <AnimatePresence>
          {inviteCode && (
            <motion.div 
              initial={{ height: 0, opacity: 0, y: -20 }}
              animate={{ height: 'auto', opacity: 1, y: 0 }}
              exit={{ height: 0, opacity: 0, y: -20 }}
              className="border border-blue-500/30 p-6 md:p-10 rounded-[2rem] md:rounded-[3rem] shadow-2xl overflow-hidden relative"
            >
              <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/5 blur-[100px] -mr-20 -mt-20" />
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center relative z-10">
                <div className="text-center lg:text-left space-y-2">
                  <span className="text-[10px] font-black text-blue-500 uppercase tracking-[0.3em]">Key Authorized</span>
                  <div className="flex items-center justify-center lg:justify-start gap-5">
                    <h3 className="text-4xl md:text-6xl font-black font-mono tracking-[0.2em] text-white italic">{inviteCode}</h3>
                    <button onClick={copyToClipboard} className="p-3 bg-[#0a0a0c] border border-gray-800 rounded-xl hover:border-blue-500 transition-all">
                      {copied ? <Check size={20} className="text-green-500" /> : <Copy size={20} className="text-gray-400" />}
                    </button>
                  </div>
                  <p className="text-xs text-gray-400">
                    Usage limit: <span className="text-white font-semibold">{inviteMeta?.maxUses || 1}</span> • Remaining:{' '}
                    <span className="text-cyan-200 font-semibold">{inviteMeta?.remainingUses ?? inviteMeta?.maxUses ?? 1}</span>
                  </p>
                  <p className="text-[11px] text-amber-200">
                    Expires in 24 hours{inviteExpiryLabel ? ` (${inviteExpiryLabel})` : ''}
                  </p>
                </div>

                <div className="space-y-4">
                  <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest text-center lg:text-left">Dispatch encrypted code to email</p>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <div className="relative flex-1">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600" size={20} />
                      <input 
                        type="email"
                        placeholder="recipient@college.edu"
                        value={recipientEmail}
                        onChange={(e) => setRecipientEmail(e.target.value)}
                        className="w-full bg-[#0a0a0c] border border-gray-800 p-5 pl-12 rounded-2xl outline-none focus:border-blue-500 transition-all text-white font-bold"
                      />
                    </div>
                    <button 
                      onClick={handleSendInvite}
                      disabled={isSending}
                      className="bg-white text-black hover:bg-blue-600 hover:text-white px-10 py-5 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                    >
                      {isSending ? <Loader2 className="animate-spin" size={18} /> : <><Send size={18} /> Dispatch</>}
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      )}

      {adminTab === 'users' && (
      <>
      <section className="border border-cyan-500/25 rounded-[2rem] p-6 md:p-8 section-motion section-motion-delay-2">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl border border-cyan-500/40">
              <KeyRound size={18} className="text-cyan-300" />
            </div>
            <div>
              <h3 className="text-lg md:text-xl font-black text-white">Password Reset Code Generator</h3>
              <p className="text-xs text-gray-400 mt-1">
                Use when email OTP is unavailable. Generates a one-time code valid for 15 minutes.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3">
          <select
            value={selectedResetUserId}
            onChange={(e) => setSelectedResetUserId(e.target.value)}
            className="w-full bg-[#0a0a0c] border border-gray-800 rounded-xl px-4 py-3 text-sm text-gray-200 outline-none focus:border-cyan-400/60"
          >
            <option value="">Select user for reset code</option>
            {resetEligibleUsers.map((u) => (
              <option key={u._id} value={u._id}>
                {u.name} ({u.collegeId || 'NO-ID'})
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => {
              const selected = resetEligibleUsers.find((u) => String(u._id) === String(selectedResetUserId));
              handleGenerateResetCode(selectedResetUserId, selected?.name);
            }}
            disabled={!selectedResetUserId || resetLoading}
            className="px-5 py-3 rounded-xl border border-cyan-500/45 bg-cyan-500/10 text-cyan-100 text-xs font-black uppercase tracking-widest disabled:opacity-50 inline-flex items-center justify-center gap-2"
          >
            {resetLoading ? <Loader2 size={14} className="animate-spin" /> : <KeyRound size={14} />}
            Generate Reset Code
          </button>
        </div>

        {resetCodeData?.resetCode && (
          <div className="mt-4 border border-gray-800 rounded-xl p-4 bg-[#0a0a0c]/60">
            <p className="text-[10px] uppercase tracking-widest text-gray-500 font-black">
              Reset code for {resetCodeData.userName}
              {resetCodeData.collegeId ? ` (${resetCodeData.collegeId})` : ''}
            </p>
            <div className="mt-2 flex items-center gap-2">
              <code className="px-3 py-2 rounded-lg bg-black/40 border border-gray-700 text-cyan-200 font-mono text-lg tracking-[0.25em]">
                {resetCodeData.resetCode}
              </code>
              <button
                type="button"
                onClick={copyResetCode}
                className="p-2 rounded-lg border border-gray-700 text-gray-300 hover:text-white hover:border-cyan-500/40"
                title="Copy reset code"
              >
                {resetCopied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
              </button>
            </div>
            <p className="mt-2 text-[10px] uppercase tracking-widest text-amber-300">
              Valid for {resetCodeData.validForMinutes} minutes. Share securely with the user.
            </p>
          </div>
        )}
      </section>

      {pendingActions.length > 0 && (
        <div className="border border-amber-500/30 rounded-[2rem] p-6 md:p-8 section-motion section-motion-delay-2">
          <h3 className="text-lg font-black text-amber-300 uppercase tracking-widest mb-4">Pending Admin Approvals</h3>
          <div className="space-y-3">
            {pendingActions.map((action) => (
              <div key={action._id} className="bg-[#0a0a0c] border border-gray-800 rounded-xl p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-white">
                    {action.type === 'ADMIN_DELETE' ? 'Delete Admin Account' : `Demote Admin to ${action.payload?.newRole || 'User'}`}
                  </p>
                  <p className="text-xs text-gray-400">
                    Target: {action.targetUser?.name} ({action.targetUser?.email}) • Approvals: {action.approvals?.length || 0}/3
                  </p>
                </div>
                <button
                  onClick={() => handleApproveAction(action._id)}
                  className="px-4 py-2 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-black uppercase tracking-wider"
                >
                  Approve
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
      </>
      )}

      {adminTab === 'recruitment' && (
      <section className="border border-gray-800 rounded-[2.5rem] p-6 md:p-8 space-y-5 section-motion section-motion-delay-2">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 border border-blue-500/40 rounded-xl">
              <ClipboardCheck size={20} className="text-blue-400" />
            </div>
            <div>
              <h3 className="text-xl font-black text-white">Recruitment Pipeline</h3>
              <p className="text-gray-500 text-sm">Kanban workflow for Applied to Shortlisted to Interview to Selected to Joined.</p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <select
              value={appFilter}
              onChange={(e) => setAppFilter(e.target.value)}
              className="border border-gray-800 rounded-xl px-3 py-2 text-xs text-gray-300 bg-[#0a0a0c]"
            >
              <option value="All">All Statuses</option>
              {APPLICATION_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                value={appSearch}
                onChange={(e) => setAppSearch(e.target.value)}
                placeholder="Search applicants..."
                className="border border-gray-800 rounded-xl pl-10 pr-3 py-2 text-xs text-gray-300 bg-[#0a0a0c] w-56"
              />
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={toggleSelectAllApplications}
            className="btn btn-ghost !px-3 !py-1.5"
          >
            {allFilteredApplicationsSelected ? 'Unselect All' : 'Select All'}
          </button>
          <span className="text-[11px] text-gray-500 uppercase tracking-widest">
            {selectedApplicationIds.length} selected
          </span>
        </div>

        {appLoading ? (
          <div className="text-sm text-gray-500">Loading applications...</div>
        ) : (
          <div className="overflow-x-auto">
            <div className="grid grid-cols-1 xl:grid-cols-5 gap-4 min-w-[1180px] xl:min-w-0">
              {RECRUITMENT_LANES.map((lane) => (
                <article
                  key={lane.id}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (draggingAppId) moveApplicationToLane(draggingAppId, lane.id);
                    setDraggingAppId('');
                  }}
                  className="border border-gray-800 rounded-[1.2rem] p-3 flex flex-col min-h-[560px]"
                >
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.16em] text-gray-500 font-black">{lane.label}</p>
                      <p className="text-xs text-gray-400 mt-1">{applicationsByLane[lane.id]?.length || 0} candidates</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleBulkMoveApplications(lane.id)}
                      disabled={selectedApplicationIds.length === 0 || bulkRecruitmentBusy}
                      className="text-[10px] uppercase tracking-widest border border-cyan-500/35 text-cyan-200 px-2 py-1 rounded-lg disabled:opacity-50"
                    >
                      {bulkRecruitmentBusy ? 'Moving...' : 'Move Selected'}
                    </button>
                  </div>

                  <div className="space-y-3 overflow-y-auto pr-1 flex-1">
                    {(applicationsByLane[lane.id] || []).map((app) => (
                      <div
                        key={app._id}
                        draggable
                        onDragStart={() => setDraggingAppId(String(app._id))}
                        onDragEnd={() => setDraggingAppId('')}
                        className="border border-gray-800 rounded-xl p-3 space-y-2 bg-[#090d13]/70 cursor-grab active:cursor-grabbing"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <label className="inline-flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={selectedApplicationIds.includes(String(app._id))}
                              onChange={() => toggleApplicationSelection(app._id)}
                            />
                            <GripVertical size={13} className="text-gray-600" />
                          </label>
                          <span className={`text-[10px] uppercase tracking-widest px-2 py-1 rounded-lg border ${statusBadgeClass(app.status)}`}>
                            {app.status}
                          </span>
                        </div>

                        <div>
                          <p className="text-sm font-bold text-white">{app.fullName}</p>
                          <p className="text-[11px] text-gray-500">{app.email}</p>
                          <p className="text-[11px] text-gray-600">{app.phone}</p>
                        </div>

                        <div className="text-[10px] text-gray-500 uppercase tracking-wider flex flex-wrap gap-2">
                          <span>Stage {app.stage || lane.stage}</span>
                          <span>•</span>
                          <span>Year {app.year || 'N/A'}</span>
                          {app.assignedTo?.name ? (
                            <>
                              <span>•</span>
                              <span className="inline-flex items-center gap-1"><Crown size={10} className="text-blue-400" /> {app.assignedTo.name}</span>
                            </>
                          ) : null}
                        </div>

                        <div className="grid grid-cols-1 gap-2">
                          <select
                            value={app.assignedTo?._id || ''}
                            onChange={(e) => handleAppAssign(app._id, e.target.value || null)}
                            className="border border-gray-800 rounded-lg px-2.5 py-2 text-[10px] uppercase tracking-widest text-gray-300 bg-[#0a0a0c]"
                          >
                            <option value="">Unassigned</option>
                            {adminUsers.map((u) => (
                              <option key={u._id} value={u._id}>
                                {u.name}
                              </option>
                            ))}
                          </select>
                          <select
                            value={app.status}
                            onChange={(e) => handleAppStatusChange(app._id, e.target.value)}
                            className="border border-gray-800 rounded-lg px-2.5 py-2 text-[10px] uppercase tracking-widest text-gray-300 bg-[#0a0a0c]"
                          >
                            {APPLICATION_STATUSES.map((status) => (
                              <option key={status} value={status}>
                                {status}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={() => handleAppNote(app._id)}
                            className="text-[10px] uppercase tracking-widest border border-gray-700 text-gray-300 px-2.5 py-1 rounded-lg"
                          >
                            Note
                          </button>
                          <button
                            onClick={() => handleSendAppInvite(app._id)}
                            className="text-[10px] uppercase tracking-widest border border-emerald-500/40 text-emerald-200 px-2.5 py-1 rounded-lg"
                          >
                            Invite
                          </button>
                        </div>
                      </div>
                    ))}
                    {(applicationsByLane[lane.id] || []).length === 0 && (
                      <div className="text-[11px] text-gray-600 border border-dashed border-gray-800 rounded-lg p-3 text-center">
                        No candidates in this lane.
                      </div>
                    )}
                  </div>
                </article>
              ))}
            </div>
          </div>
        )}

        {!appLoading && rejectedApplications.length > 0 && (
          <div className="border border-rose-500/25 rounded-xl p-3">
            <p className="text-xs uppercase tracking-[0.16em] text-rose-300 font-black mb-2">Rejected Candidates</p>
            <div className="flex flex-wrap gap-2">
              {rejectedApplications.map((app) => (
                <span key={app._id} className="text-[11px] border border-rose-500/30 text-rose-200 px-2.5 py-1 rounded-lg">
                  {app.fullName}
                </span>
              ))}
            </div>
          </div>
        )}

        {!appLoading && filteredApplications.length === 0 && (
          <div className="border border-dashed border-gray-800 rounded-xl p-6 text-sm text-gray-500">
            No applications found for the selected filter.
          </div>
        )}
      </section>

      )}

      {adminTab === 'broadcast' && (
      <section className="grid grid-cols-1 gap-5 section-motion section-motion-delay-3">
        <article className="border border-gray-800 rounded-[1.8rem] p-6 space-y-4 max-w-4xl">
          <div className="flex items-center gap-3">
            <Megaphone size={18} className="text-cyan-300" />
            <div>
              <h3 className="text-lg font-black text-white">Admin Broadcast</h3>
              <p className="text-xs text-gray-500">Send a system-wide notification to selected member groups.</p>
            </div>
          </div>

          <form onSubmit={handleBroadcast} className="space-y-3">
            <input
              value={broadcastForm.title}
              onChange={(e) => setBroadcastForm((prev) => ({ ...prev, title: e.target.value }))}
              placeholder="Announcement title"
              className="w-full border border-gray-800 rounded-xl px-3 py-2.5 bg-[#0a0a0c] text-sm text-white outline-none focus:border-cyan-500/60"
              maxLength={140}
            />
            <textarea
              value={broadcastForm.message}
              onChange={(e) => setBroadcastForm((prev) => ({ ...prev, message: e.target.value }))}
              placeholder="Announcement message"
              rows={4}
              className="w-full border border-gray-800 rounded-xl px-3 py-2.5 bg-[#0a0a0c] text-sm text-white outline-none focus:border-cyan-500/60 resize-none"
              maxLength={1600}
            />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <select
                value={broadcastForm.role}
                onChange={(e) => setBroadcastForm((prev) => ({ ...prev, role: e.target.value }))}
                className="border border-gray-800 rounded-xl px-3 py-2 bg-[#0a0a0c] text-xs text-gray-300"
              >
                <option value="all">All Members</option>
                <option value="Admin">Admins</option>
                <option value="Head">Heads</option>
                <option value="User">Users</option>
                <option value="Alumni">Alumni</option>
              </select>
              <select
                value={broadcastForm.type}
                onChange={(e) => setBroadcastForm((prev) => ({ ...prev, type: e.target.value }))}
                className="border border-gray-800 rounded-xl px-3 py-2 bg-[#0a0a0c] text-xs text-gray-300"
              >
                <option value="info">Info</option>
                <option value="success">Success</option>
                <option value="warning">Warning</option>
                <option value="error">Error</option>
                <option value="action">Action</option>
              </select>
              <input
                value={broadcastForm.link}
                onChange={(e) => setBroadcastForm((prev) => ({ ...prev, link: e.target.value }))}
                placeholder="/dashboard"
                className="border border-gray-800 rounded-xl px-3 py-2 bg-[#0a0a0c] text-xs text-gray-300 outline-none focus:border-cyan-500/60"
              />
            </div>
            <button
              type="submit"
              disabled={broadcastBusy}
              className="inline-flex items-center gap-2 border border-cyan-500/40 text-cyan-100 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-cyan-500/10 disabled:opacity-60"
            >
              {broadcastBusy ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
              Send Broadcast
            </button>
          </form>
        </article>
      </section>
      )}

      {adminTab === 'audit' && (
      <section className="grid grid-cols-1 gap-5 section-motion section-motion-delay-3">
        <article className="border border-gray-800 rounded-[1.8rem] p-6 space-y-4 max-w-4xl">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <ScrollText size={18} className="text-amber-300" />
              <div>
                <h3 className="text-lg font-black text-white">Audit Trail</h3>
                <p className="text-xs text-gray-500">Recent privileged actions across admin operations.</p>
              </div>
            </div>
            <button
              type="button"
              onClick={loadAuditLogs}
              className="text-[10px] uppercase tracking-widest border border-gray-700 text-gray-300 px-3 py-1.5 rounded-lg"
            >
              Refresh
            </button>
          </div>

          {auditLoading ? (
            <div className="text-sm text-gray-500">Loading audit log...</div>
          ) : (
            <div className="max-h-[360px] overflow-auto space-y-2 pr-1">
              {auditRows.map((row) => (
                <div key={row._id} className="border border-gray-800 rounded-xl px-3 py-2.5">
                  <p className="text-xs text-white font-semibold">{row.action}</p>
                  <p className="text-[11px] text-gray-500 mt-1">
                    {row.actor?.name || 'System'} ({row.actor?.role || 'N/A'}) • {new Date(row.createdAt).toLocaleString()}
                  </p>
                  <p className="text-[10px] text-gray-600 uppercase tracking-widest mt-1">
                    {row.entityType} {row.entityId ? `• ${row.entityId}` : ''}
                  </p>
                </div>
              ))}
              {auditRows.length === 0 && (
                <div className="border border-dashed border-gray-800 rounded-xl px-3 py-8 text-center text-sm text-gray-500">
                  No audit entries found.
                </div>
              )}
            </div>
          )}
        </article>
      </section>
      )}

      {adminTab === 'users' && (
        <>
          <div className="ui-table-shell section-motion section-motion-delay-3">
            <div className="p-5 md:p-6 border-b border-gray-800 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <UserCheck className="text-blue-500" size={22} />
                <div>
                  <h3 className="text-xl font-black text-white">Member Directory</h3>
                  <p className="text-xs text-gray-500">Sortable table with approval and role controls.</p>
                </div>
              </div>

              <div className="w-full xl:w-auto flex flex-col gap-2">
                <div className="flex flex-col sm:flex-row gap-2">
                  <div className="relative min-w-[280px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
                    <input
                      type="text"
                      placeholder="Search name, reg no, email..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="ui-input pl-10"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleBulkApproveUsers}
                    disabled={bulkBusy || selectedUserIds.length === 0}
                    className="btn btn-secondary"
                  >
                    {bulkBusy ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                    Approve Selected
                  </button>
                  <button type="button" onClick={handleExportUsers} className="btn btn-ghost">
                    <Download size={13} />
                    Export CSV
                  </button>
                  <button
                    type="button"
                    onClick={() => setColumnChooserOpen((prev) => !prev)}
                    className="btn btn-ghost"
                  >
                    Columns
                  </button>
                </div>

                <div className="flex flex-wrap gap-2">
                  {[
                    ['all', 'All'],
                    ['pending', 'Pending'],
                    ['approved', 'Approved'],
                    ['admins', 'Admins/Heads'],
                    ['freshers', '1st Year'],
                    ['seniors', '2nd+ Year'],
                    ['alumni', 'Alumni'],
                  ].map(([id, label]) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setUserQuickFilter(id)}
                      className={`px-2.5 py-1.5 rounded-lg text-[10px] uppercase tracking-widest border ${
                        userQuickFilter === id
                          ? 'border-cyan-500/50 text-cyan-100 bg-cyan-500/10'
                          : 'border-gray-700 text-gray-400 hover:text-gray-200'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {columnChooserOpen && (
                  <div className="border border-gray-800 rounded-xl p-3 bg-[#0a0a0c]/70 space-y-3">
                    <p className="text-[10px] uppercase tracking-[0.18em] text-gray-500 font-black">Column Chooser</p>
                    <div className="flex flex-wrap gap-2">
                      {USER_TABLE_COLUMNS.map((column) => (
                        <label
                          key={column.id}
                          className="inline-flex items-center gap-2 border border-gray-700 rounded-lg px-2.5 py-1.5 text-xs text-gray-300"
                        >
                          <input
                            type="checkbox"
                            checked={visibleColumns.includes(column.id)}
                            onChange={() => toggleColumnVisibility(column.id)}
                          />
                          {column.label}
                        </label>
                      ))}
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <input
                        value={newViewName}
                        onChange={(e) => setNewViewName(e.target.value)}
                        placeholder="Save current view as..."
                        className="ui-input"
                      />
                      <button type="button" onClick={saveCurrentUserView} className="btn btn-secondary">
                        Save View
                      </button>
                    </div>
                    {savedViews.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {savedViews.map((view) => (
                          <div key={view.id} className="inline-flex items-center border border-gray-700 rounded-lg overflow-hidden">
                            <button
                              type="button"
                              onClick={() => applyUserView(view)}
                              className="px-2.5 py-1.5 text-xs text-gray-200 hover:bg-white/[0.04]"
                            >
                              {view.name}
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteUserView(view.id)}
                              className="px-2 py-1.5 text-xs text-gray-500 hover:text-rose-300 hover:bg-rose-500/10"
                              aria-label={`Delete view ${view.name}`}
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {selectedUserIds.length > 0 && (
              <div className="px-5 py-2 border-b border-gray-800 text-xs text-cyan-200 uppercase tracking-widest">
                {selectedUserIds.length} user(s) selected
              </div>
            )}

            <div className="overflow-x-auto max-h-[72vh]">
              <table className="w-full text-left border-collapse min-w-[860px]">
                <thead className="ui-table-head sticky top-0 z-10">
                  <tr>
                    <th className="p-4 w-10 text-center">
                      <input type="checkbox" checked={allVisibleSelected} onChange={toggleSelectAllUsers} />
                    </th>
                    {visibleColumns.includes('member') && (
                      <th className="p-4">
                        <button type="button" onClick={() => toggleSort('name')} className="inline-flex items-center gap-1">
                          Member <ArrowUpDown size={11} /> {sortIndicator('name')}
                        </button>
                      </th>
                    )}
                    {visibleColumns.includes('role') && (
                      <th className="p-4 text-center">
                        <button type="button" onClick={() => toggleSort('role')} className="inline-flex items-center gap-1">
                          Role <ArrowUpDown size={11} /> {sortIndicator('role')}
                        </button>
                      </th>
                    )}
                    {visibleColumns.includes('year') && (
                      <th className="p-4 text-center">
                        <button type="button" onClick={() => toggleSort('year')} className="inline-flex items-center gap-1">
                          Year <ArrowUpDown size={11} /> {sortIndicator('year')}
                        </button>
                      </th>
                    )}
                    {visibleColumns.includes('approval') && (
                      <th className="p-4 text-center">
                        <button type="button" onClick={() => toggleSort('approval')} className="inline-flex items-center gap-1">
                          Approval <ArrowUpDown size={11} /> {sortIndicator('approval')}
                        </button>
                      </th>
                    )}
                    {visibleColumns.includes('actions') && <th className="p-4 text-right">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/50">
                  {sortedUsers.map((u) => (
                    <tr key={u._id} className="hover:bg-white/[0.02] transition-colors group">
                      <td className="p-4 text-center align-top">
                        <input
                          type="checkbox"
                          checked={selectedUserIds.includes(String(u._id))}
                          onChange={() => toggleSelectUser(u._id)}
                        />
                      </td>
                      {visibleColumns.includes('member') && (
                        <td className="p-4">
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-xl bg-[#0a0a0c] border border-gray-800 flex items-center justify-center font-black text-blue-500">
                              {u.name ? u.name[0] : '?'}
                            </div>
                            <div className="space-y-1">
                              <p className="font-black text-gray-100 text-sm tracking-tight">{u.name}</p>
                              <div className="flex items-center gap-2">
                                <span className="inline-flex items-center gap-1 text-[10px] text-gray-500 font-bold uppercase tracking-wider">
                                  <Fingerprint size={10} className="text-blue-500" /> {u.collegeId || 'NO-REG'}
                                </span>
                                <span className="text-[10px] text-gray-600">{u.email || 'No email'}</span>
                              </div>
                            </div>
                          </div>
                        </td>
                      )}
                      {visibleColumns.includes('role') && (
                        <td className="p-4 text-center">
                          <select
                            value={u.role}
                            onChange={(e) => handleRoleChange(u._id, e.target.value)}
                            className="bg-[#0a0a0c] border border-gray-800 text-[10px] font-black uppercase tracking-[0.2em] rounded-xl px-3 py-2 outline-none focus:border-blue-500 text-blue-300"
                          >
                            <option value="User">User</option>
                            <option value="Head">Head</option>
                            <option value="Admin">Admin</option>
                            <option value="Alumni">Alumni</option>
                          </select>
                        </td>
                      )}
                      {visibleColumns.includes('year') && (
                        <td className="p-4 text-center">
                          <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-gray-400">
                            <GraduationCap size={12} className="text-amber-400" /> {u.year || 'N/A'}
                          </span>
                        </td>
                      )}
                      {visibleColumns.includes('approval') && (
                        <td className="p-4 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <span className={`text-[10px] font-black uppercase tracking-[0.18em] px-2.5 py-1.5 rounded-xl border ${
                              u.approvalStatus === 'Approved'
                                ? 'text-emerald-400 border-emerald-500/40 bg-emerald-500/10'
                                : u.approvalStatus === 'Rejected'
                                  ? 'text-red-400 border-red-500/40 bg-red-500/10'
                                  : 'text-amber-400 border-amber-500/40 bg-amber-500/10'
                            }`}>
                              {u.approvalStatus || (u.isVerified ? 'Approved' : 'Pending')}
                            </span>
                            <button onClick={() => handleApprovalChange(u._id, 'Approved')} className="btn btn-ghost !px-2 !py-1">Approve</button>
                            <button onClick={() => handleApprovalChange(u._id, 'Rejected')} className="btn btn-danger !px-2 !py-1">Reject</button>
                          </div>
                        </td>
                      )}
                      {visibleColumns.includes('actions') && (
                        <td className="p-4 text-right">
                          <div className="inline-flex items-center gap-1">
                            <button
                              onClick={() => handleGenerateResetCode(u._id, u.name)}
                              className="p-2 text-gray-500 hover:text-blue-300 hover:bg-blue-500/10 rounded-xl transition-all"
                              title="Generate password reset code"
                            >
                              <KeyRound size={16} />
                            </button>
                            {!['admin', 'head'].includes(String(u.role || '').toLowerCase()) && (
                              <button
                                onClick={() => openDeleteDialog(u)}
                                disabled={String(u._id) === currentUserId}
                                className="p-2.5 text-gray-600 hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all disabled:opacity-40"
                                title={String(u._id) === currentUserId ? 'Self-deletion is blocked' : 'Delete user'}
                              >
                                <Trash2 size={17} />
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>

              {sortedUsers.length === 0 && !loading && (
                <div className="p-20 text-center text-gray-600">
                  <Shield className="mx-auto mb-4 opacity-20" size={44} />
                  <p className="font-black uppercase tracking-[0.24em] text-[10px]">No users found for current filters</p>
                </div>
              )}
            </div>
          </div>

          <CicrAssistant
            title="Admin CICR Intelligence Console"
            placeholder="Ask member-level questions (college ID/email), roles, events, contributions..."
          />
        </>
      )}

      <AnimatePresence>
        {deleteDialog.open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[120] bg-[#03040a]/80 backdrop-blur-sm px-4 py-8 overflow-y-auto"
            onClick={() => closeDeleteDialog()}
          >
            <motion.div
              initial={{ opacity: 0, y: 18, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 14, scale: 0.98 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              onClick={(event) => event.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-labelledby="delete-user-title"
              className="mx-auto w-full max-w-2xl border border-red-500/25 bg-[#07090f] rounded-[1.75rem] shadow-[0_30px_80px_-30px_rgba(255,0,0,0.45)]"
            >
              <div className="flex items-center justify-between gap-3 px-6 md:px-8 py-5 border-b border-red-500/20">
                <div className="flex items-center gap-3">
                  <span className="inline-flex items-center justify-center w-10 h-10 rounded-xl border border-red-500/40 bg-red-500/10">
                    <ShieldAlert size={18} className="text-red-300" />
                  </span>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.22em] text-red-300/85">
                      Destructive action
                    </p>
                    <h3 id="delete-user-title" className="text-lg md:text-xl font-black tracking-tight text-white">
                      Confirm User Removal
                    </h3>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => closeDeleteDialog()}
                  disabled={deleteDialog.submitting}
                  className="p-2 rounded-lg text-gray-500 hover:text-white hover:bg-white/5 transition-colors disabled:opacity-40"
                  aria-label="Close delete dialog"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="px-6 md:px-8 py-6 space-y-5">
                <p className="text-sm leading-relaxed text-gray-300">
                  This permanently removes the member account and cannot be undone. To continue, type the exact
                  verification phrase below.
                </p>

                <div className="grid gap-3 sm:grid-cols-3 text-xs">
                  <div className="rounded-xl border border-gray-800 px-3 py-2">
                    <p className="text-[10px] uppercase tracking-[0.18em] text-gray-500">Name</p>
                    <p className="mt-1 font-bold text-gray-100">{deleteDialog.user?.name || 'Unknown User'}</p>
                  </div>
                  <div className="rounded-xl border border-gray-800 px-3 py-2">
                    <p className="text-[10px] uppercase tracking-[0.18em] text-gray-500">College ID</p>
                    <p className="mt-1 font-bold text-gray-100">{deleteDialog.user?.collegeId || 'N/A'}</p>
                  </div>
                  <div className="rounded-xl border border-gray-800 px-3 py-2">
                    <p className="text-[10px] uppercase tracking-[0.18em] text-gray-500">Role</p>
                    <p className="mt-1 font-bold text-gray-100">{deleteDialog.user?.role || 'User'}</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-[10px] uppercase tracking-[0.22em] text-gray-400">Required Phrase</p>
                  <div className="rounded-xl border border-gray-700 bg-[#05070c] px-4 py-3 text-sm font-mono text-red-200 break-all">
                    {requiredDeletePhrase || 'remove user'}
                  </div>
                </div>

                <div className="space-y-2">
                  <label htmlFor="delete-phrase-input" className="text-[10px] uppercase tracking-[0.22em] text-gray-400">
                    Type Phrase To Confirm
                  </label>
                  <input
                    id="delete-phrase-input"
                    type="text"
                    value={deleteDialog.typedPhrase}
                    onChange={(event) =>
                      setDeleteDialog((prev) => ({
                        ...prev,
                        typedPhrase: event.target.value,
                        error: '',
                      }))
                    }
                    placeholder={requiredDeletePhrase || 'remove username'}
                    className="w-full rounded-xl border border-gray-700 bg-transparent px-4 py-3 text-sm text-white outline-none transition-colors focus:border-red-400/60"
                    autoFocus
                  />
                  {deleteDialog.error && (
                    <p className="text-xs font-medium text-red-300">{deleteDialog.error}</p>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 px-6 md:px-8 py-5 border-t border-gray-800">
                <button
                  type="button"
                  onClick={() => closeDeleteDialog()}
                  disabled={deleteDialog.submitting}
                  className="px-4 py-2 rounded-xl border border-gray-700 text-xs font-black uppercase tracking-[0.18em] text-gray-300 hover:text-white hover:border-gray-500 transition-colors disabled:opacity-40"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmDeleteFromDialog}
                  disabled={deleteDialog.submitting || !isDeletePhraseValid}
                  className="px-5 py-2.5 rounded-xl border border-red-500/50 bg-red-500/15 text-xs font-black uppercase tracking-[0.18em] text-red-100 hover:bg-red-500/25 transition-colors disabled:opacity-40 inline-flex items-center gap-2"
                >
                  {deleteDialog.submitting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                  Remove User
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
