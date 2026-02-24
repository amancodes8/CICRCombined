import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  FolderKanban, Users, Layout, 
  ArrowLeft, Check, Loader2 
} from 'lucide-react';
import { fetchMembers, createProject } from '../api';

export default function CreateProject() {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    domain: 'Tech',
    team: [],
    lead: ''
  });

  useEffect(() => {
    fetchMembers().then(res => setUsers(res.data));
  }, []);

  const toggleTeamMember = (userId) => {
    setFormData(prev => ({
      ...prev,
      team: prev.team.includes(userId)
        ? prev.team.filter(id => id !== userId)
        : [...prev.team, userId]
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await createProject(formData);
      alert("Project created successfully!");
      navigate('/projects');
    } catch (err) {
      alert(err.response?.data?.message || "Failed to create project");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <button onClick={() => navigate('/projects')} className="flex items-center gap-2 text-gray-400 hover:text-white">
        <ArrowLeft size={18} /> Back to Projects
      </button>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-[#141417] border border-gray-800 p-8 rounded-3xl space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-400">Project Title</label>
            <input required placeholder="Enter unique title" className="w-full bg-[#0a0a0c] border border-gray-800 p-4 rounded-xl outline-none" onChange={e => setFormData({...formData, title: e.target.value})} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-400">Domain</label>
              <select className="w-full bg-[#0a0a0c] border border-gray-800 p-4 rounded-xl outline-none" onChange={e => setFormData({...formData, domain: e.target.value})}>
                <option value="Tech">Tech</option>
                <option value="Management">Management</option>
                <option value="PR">PR</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-400">Project Lead</label>
              <select required className="w-full bg-[#0a0a0c] border border-gray-800 p-4 rounded-xl outline-none" onChange={e => setFormData({...formData, lead: e.target.value})}>
                <option value="">Select a lead</option>
                {users.map(u => <option key={u._id} value={u._id}>{u.name}</option>)}
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-400">Description</label>
            <textarea required rows="4" placeholder="What is this project about?" className="w-full bg-[#0a0a0c] border border-gray-800 p-4 rounded-xl outline-none" onChange={e => setFormData({...formData, description: e.target.value})} />
          </div>
        </div>

        <div className="bg-[#141417] border border-gray-800 p-8 rounded-3xl space-y-4">
          <h3 className="text-xl font-bold flex items-center gap-2"><Users size={20} className="text-blue-500" /> Assemble Team</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
            {users.map(u => (
              <div 
                key={u._id}
                onClick={() => toggleTeamMember(u._id)}
                className={`flex items-center justify-between p-4 rounded-xl border cursor-pointer transition-all ${formData.team.includes(u._id) ? 'border-blue-600 bg-blue-600/10' : 'border-gray-800 bg-[#0a0a0c]'}`}
              >
                <span className="text-sm font-bold">{u.name}</span>
                {formData.team.includes(u._id) && <Check size={18} className="text-blue-500" />}
              </div>
            ))}
          </div>
        </div>

        <button disabled={loading} className="w-full bg-blue-600 py-5 rounded-2xl font-bold text-lg hover:bg-blue-700 transition-all flex justify-center items-center gap-3">
          {loading ? <Loader2 className="animate-spin" /> : "Launch Project"}
        </button>
      </form>
    </div>
  );
}