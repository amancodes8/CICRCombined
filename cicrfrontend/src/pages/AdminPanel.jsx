import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { fetchMembers, updateUserByAdmin, deleteUser, generateInvite, sendInviteEmail, fetchPendingAdminActions, approveAdminAction } from '../api';
import CicrAssistant from '../components/CicrAssistant';
import { 
  Shield, Trash2, UserPlus, Copy, Check, 
  Search, Mail, Send, Loader2, UserCheck, GraduationCap, Fingerprint 
} from 'lucide-react';

export default function AdminPanel() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [copied, setCopied] = useState(false);
  const [pendingActions, setPendingActions] = useState([]);

  useEffect(() => {
    loadUsers();
    loadPendingActions();
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

  const handleApproveAction = async (actionId) => {
    try {
      const { data } = await approveAdminAction(actionId);
      alert(data.message || 'Approval recorded');
      await Promise.all([loadPendingActions(), loadUsers()]);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to approve action');
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

  return (
    <div className="space-y-6 md:space-y-10 max-w-7xl mx-auto pb-20 px-4 sm:px-6 lg:px-8 overflow-x-hidden">
      
    
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-600/20 rounded-lg">
              <Shield size={24} className="text-blue-500" />
            </div>
            <h2 className="text-3xl md:text-3xl font-black tracking-tighter text-white">Amdin</h2>
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
            className="bg-[#141417] border border-blue-500/30 p-6 md:p-10 rounded-[2rem] md:rounded-[3rem] shadow-2xl overflow-hidden relative"
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

      {pendingActions.length > 0 && (
        <div className="bg-[#141417]/50 border border-amber-500/30 rounded-[2rem] p-6 md:p-8">
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

      {/* --- MEMBER DIRECTORY --- */}
      <div className="bg-[#141417]/50 backdrop-blur-xl border border-gray-800 rounded-[2.5rem] md:rounded-[3.5rem] overflow-hidden shadow-2xl">
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
                    <button 
                      onClick={() => handleDelete(u._id)}
                      className="p-4 text-gray-600 hover:text-red-500 hover:bg-red-500/10 rounded-2xl transition-all"
                    >
                      <Trash2 size={22} />
                    </button>
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
