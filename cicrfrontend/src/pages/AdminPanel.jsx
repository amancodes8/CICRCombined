import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { fetchMembers, updateUserByAdmin, deleteUser, generateInvite, sendInviteEmail, fetchPendingAdminActions, approveAdminAction, fetchApplications, updateApplication, sendApplicationInvite, generatePasswordResetCode } from '../api';
import CicrAssistant from '../components/CicrAssistant';
import { 
  Shield, Trash2, UserPlus, Copy, Check, 
  Search, Mail, Send, Loader2, UserCheck, GraduationCap, Fingerprint,
  Briefcase, ClipboardCheck, Crown, FileText, Flag, KeyRound
} from 'lucide-react';

const APPLICATION_STATUSES = ['New', 'InReview', 'Interview', 'Accepted', 'Selected', 'Rejected'];

const statusBadgeClass = (status) => {
  if (status === 'Selected') return 'text-emerald-300 border-emerald-500/40 bg-emerald-500/10';
  if (status === 'Accepted') return 'text-cyan-300 border-cyan-500/40 bg-cyan-500/10';
  if (status === 'Interview') return 'text-amber-300 border-amber-500/40 bg-amber-500/10';
  if (status === 'Rejected') return 'text-rose-300 border-rose-500/40 bg-rose-500/10';
  return 'text-gray-300 border-gray-700 bg-gray-800/30';
};

export default function AdminPanel() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [inviteCode, setInviteCode] = useState('');
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

  useEffect(() => {
    loadUsers();
    loadPendingActions();
    loadApplications();
  }, []);

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

  const handleDelete = async (userId) => {
    if (!window.confirm("Are you sure? This action is permanent.")) return;
    try {
      const { data } = await deleteUser(userId);
      if (data?.requiresApproval) {
        alert(data.message);
        loadPendingActions();
        return;
      }
      setUsers(users.filter(u => u._id !== userId));
    } catch (err) {
      alert(err.response?.data?.message || "Error deleting user");
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
    try {
      const { data } = await generateInvite();
      setInviteCode(data.code);
    } catch (err) { 
      alert("Error generating code"); 
    }
  };

  const handleSendInvite = async () => {
    if (!recipientEmail) return alert("Please enter an email address");
    setIsSending(true);
    try {
      await sendInviteEmail({ email: recipientEmail, inviteCode });
      alert(`Success! Invite sent to ${recipientEmail}`);
      setRecipientEmail('');
      setInviteCode(''); 
    } catch (err) {
      alert(err.response?.data?.message || "Failed to send email");
    } finally { 
      setIsSending(false); 
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(inviteCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const filteredUsers = users.filter(u => 
    u.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.collegeId?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const adminUsers = users.filter(
    (u) =>
      (String(u.role || '').toLowerCase() === 'admin' || String(u.role || '').toLowerCase() === 'head') &&
      (u.isVerified || String(u.approvalStatus || '').toLowerCase() === 'approved')
  );

  const resetEligibleUsers = users.filter((u) => String(u.approvalStatus || '').toLowerCase() !== 'rejected');

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

  return (
    <div className="space-y-6 md:space-y-10 max-w-7xl mx-auto pb-20 px-4 sm:px-6 lg:px-8 overflow-x-hidden page-motion-d">
      
    
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 section-motion section-motion-delay-1">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-600/20 rounded-lg">
              <Shield size={24} className="text-blue-500" />
            </div>
            <h2 className="text-3xl md:text-3xl font-black tracking-tighter text-white">Admin</h2>
          </div>
          <p className="text-gray-500 font-medium md:text-lg">Authorization & Member Lifecycle Management</p>
        </div>
        <button 
          onClick={handleGenerateInvite}
          className="bg-blue-600 hover:bg-blue-500 text-white px-8 py-4 rounded-2xl flex items-center justify-center gap-3 font-black text-xs uppercase tracking-widest transition-all shadow-xl shadow-blue-600/20 w-full sm:w-auto active:scale-95"
        >
          <UserPlus size={18} /> Generate Access Key
        </button>
      </div>

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

      <section className="border border-gray-800 rounded-[2.5rem] p-6 md:p-8 space-y-5 section-motion section-motion-delay-2">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 border border-blue-500/40 rounded-xl">
              <ClipboardCheck size={20} className="text-blue-400" />
            </div>
            <div>
              <h3 className="text-xl font-black text-white">Recruitment Pipeline</h3>
              <p className="text-gray-500 text-sm">Track applicants, interview rounds, and onboarding.</p>
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

        {appLoading ? (
          <div className="text-sm text-gray-500">Loading applications...</div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {filteredApplications.map((app) => (
              <article key={app._id} className="border border-gray-800 rounded-[1.4rem] p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-white font-bold text-base">{app.fullName}</p>
                    <p className="text-xs text-gray-500">{app.email} • {app.phone}</p>
                  </div>
                  <span className={`text-[10px] uppercase tracking-widest px-2 py-1 rounded-lg border ${statusBadgeClass(app.status)}`}>
                    {app.status}
                  </span>
                </div>

                <div className="text-xs text-gray-400 flex flex-wrap gap-2">
                  <span className="inline-flex items-center gap-1"><Briefcase size={12} className="text-blue-400" /> Year {app.year || 'N/A'}</span>
                  <span className="inline-flex items-center gap-1"><Flag size={12} className="text-amber-400" /> {app.branch || 'General'}</span>
                  {app.event?.title && (
                    <span className="inline-flex items-center gap-1"><FileText size={12} className="text-emerald-400" /> {app.event.title}</span>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2 text-[10px] text-gray-500 uppercase tracking-widest">
                  <span>Stage: {app.stage || 'Round 1'}</span>
                  {app.assignedTo?.name && (
                    <>
                      <span>•</span>
                      <span className="inline-flex items-center gap-1"><Crown size={10} className="text-blue-400" /> {app.assignedTo.name}</span>
                    </>
                  )}
                  {app.inviteCode && (
                    <>
                      <span>•</span>
                      <span className="inline-flex items-center gap-1"><ClipboardCheck size={10} className="text-emerald-400" /> Invite {app.inviteCode}</span>
                    </>
                  )}
                </div>

                {app.notes?.[0]?.text && (
                  <p className="text-xs text-gray-300 border border-gray-800 rounded-lg px-3 py-2">
                    Latest note: {app.notes[0].text}
                  </p>
                )}
                {app.history?.[0]?.status && (
                  <p className="text-[10px] text-gray-500 border border-gray-800/70 rounded-lg px-3 py-2 uppercase tracking-wider">
                    Last update: {app.history[0].status}
                    {app.history[0].changedBy?.name ? ` by ${app.history[0].changedBy.name}` : ''}
                    {app.history[0].changedAt ? ` • ${new Date(app.history[0].changedAt).toLocaleString()}` : ''}
                    {app.history[0].note ? ` • ${app.history[0].note}` : ''}
                  </p>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <select
                    value={app.status}
                    onChange={(e) => handleAppStatusChange(app._id, e.target.value)}
                    className="border border-gray-800 rounded-lg px-3 py-2 text-[10px] uppercase tracking-widest text-gray-300 bg-[#0a0a0c]"
                  >
                    {APPLICATION_STATUSES.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                  <select
                    value={app.assignedTo?._id || ''}
                    onChange={(e) => handleAppAssign(app._id, e.target.value || null)}
                    className="border border-gray-800 rounded-lg px-3 py-2 text-[10px] uppercase tracking-widest text-gray-300 bg-[#0a0a0c]"
                  >
                    <option value="">Unassigned</option>
                    {adminUsers.map((u) => (
                      <option key={u._id} value={u._id}>
                        {u.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => handleAppNote(app._id)}
                    className="text-[10px] uppercase tracking-widest border border-gray-700 text-gray-300 px-3 py-1.5 rounded-lg"
                  >
                    Add Note
                  </button>
                  <button
                    onClick={() => handleSendAppInvite(app._id)}
                    className="text-[10px] uppercase tracking-widest border border-emerald-500/40 text-emerald-200 px-3 py-1.5 rounded-lg"
                  >
                    Send Invite
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}

        {!appLoading && filteredApplications.length === 0 && (
          <div className="border border-dashed border-gray-800 rounded-xl p-6 text-sm text-gray-500">
            No applications found for the selected filter.
          </div>
        )}
      </section>

      {/* --- MEMBER DIRECTORY --- */}
      <div className="backdrop-blur-xl border border-gray-800 rounded-[2.5rem] md:rounded-[3.5rem] overflow-hidden shadow-2xl section-motion section-motion-delay-3">
        <div className="p-8 md:p-12 border-b border-gray-800 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
          <div className="flex items-center gap-4">
            <UserCheck className="text-blue-500" size={28} />
            <h3 className="text-2xl font-black text-white uppercase tracking-tight">Active Directory</h3>
          </div>
          <div className="relative w-full lg:w-96 group">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-blue-500 transition-colors" size={20} />
            <input 
              type="text" 
              placeholder="Search by name or Reg No..."
              className="w-full bg-[#0a0a0c] border border-gray-800 rounded-2xl py-4 pl-14 pr-6 text-sm outline-none focus:border-blue-500 transition-all text-white font-medium"
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[700px]">
            <thead className="text-[10px] text-gray-500 uppercase tracking-[0.3em] bg-[#0a0a0c]/80 font-black">
              <tr>
                <th className="p-8">Member Identity</th>
                <th className="p-8 text-center">Security Level</th>
                <th className="p-8 text-center">Approval</th>
                <th className="p-8 text-right">Operations</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/50">
              {filteredUsers.map((u) => (
                <tr key={u._id} className="hover:bg-white/[0.02] transition-colors group">
                  <td className="p-8">
                    <div className="flex items-center gap-6">
                      <div className="w-14 h-14 rounded-2xl bg-[#0a0a0c] border border-gray-800 flex items-center justify-center font-black text-blue-500 group-hover:bg-blue-600 group-hover:text-white transition-all duration-500 text-xl shadow-inner">
                        {u.name ? u.name[0] : '?'}
                      </div>
                      <div className="space-y-1">
                        <p className="font-black text-gray-100 text-lg tracking-tight group-hover:text-blue-400 transition-colors">{u.name}</p>
                        <div className="flex items-center gap-3">
                          <span className="flex items-center gap-1 text-[10px] text-gray-500 font-bold uppercase tracking-wider bg-gray-800/40 px-2 py-0.5 rounded">
                            <Fingerprint size={10} className="text-blue-500" /> {u.collegeId || 'NO-REG'}
                          </span>
                          <span className="flex items-center gap-1 text-[10px] text-gray-500 font-bold uppercase tracking-wider bg-gray-800/40 px-2 py-0.5 rounded">
                            <GraduationCap size={10} className="text-amber-500" /> Year {u.year || 'N/A'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="p-8 text-center">
                    <select 
                      value={u.role}
                      onChange={(e) => handleRoleChange(u._id, e.target.value)}
                      className="bg-[#0a0a0c] border border-gray-800 text-[10px] font-black uppercase tracking-[0.2em] rounded-xl px-5 py-3 outline-none focus:border-blue-500 transition-all text-blue-400 cursor-pointer hover:bg-gray-900"
                    >
                      <option value="User">User</option>
                      <option value="Head">Head</option>
                      <option value="Admin">Admin</option>
                      <option value="Alumni">Alumni</option>
                    </select>
                  </td>
                  <td className="p-8 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <span className={`text-[10px] font-black uppercase tracking-[0.2em] px-3 py-2 rounded-xl border ${
                        u.approvalStatus === 'Approved'
                          ? 'text-emerald-400 border-emerald-500/40 bg-emerald-500/10'
                          : u.approvalStatus === 'Rejected'
                            ? 'text-red-400 border-red-500/40 bg-red-500/10'
                            : 'text-amber-400 border-amber-500/40 bg-amber-500/10'
                      }`}>
                        {u.approvalStatus || (u.isVerified ? 'Approved' : 'Pending')}
                      </span>
                      <button
                        onClick={() => handleApprovalChange(u._id, 'Approved')}
                        className="px-3 py-2 text-[10px] font-black uppercase tracking-wider rounded-xl bg-emerald-600/20 text-emerald-300 hover:bg-emerald-600/30"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => handleApprovalChange(u._id, 'Rejected')}
                        className="px-3 py-2 text-[10px] font-black uppercase tracking-wider rounded-xl bg-red-600/20 text-red-300 hover:bg-red-600/30"
                      >
                        Reject
                      </button>
                    </div>
                  </td>
                  <td className="p-8 text-right">
                    <div className="inline-flex items-center gap-1">
                      <button
                        onClick={() => handleGenerateResetCode(u._id, u.name)}
                        className="p-3 text-gray-500 hover:text-blue-300 hover:bg-blue-500/10 rounded-xl transition-all"
                        title="Generate password reset code"
                      >
                        <KeyRound size={18} />
                      </button>
                      <button 
                        onClick={() => handleDelete(u._id)}
                        className="p-4 text-gray-600 hover:text-red-500 hover:bg-red-500/10 rounded-2xl transition-all"
                      >
                        <Trash2 size={22} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          
          {filteredUsers.length === 0 && !loading && (
            <div className="p-32 text-center text-gray-600">
              <Shield className="mx-auto mb-4 opacity-10" size={64} />
              <p className="font-black uppercase tracking-[0.3em] text-xs italic">No data records found in directory</p>
            </div>
          )}
        </div>
      </div>

      <CicrAssistant
        title="Admin CICR Intelligence Console"
        placeholder="Ask member-level questions (college ID/email), roles, events, contributions..."
      />
    </div>
  );
}
