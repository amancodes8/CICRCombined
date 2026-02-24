import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Plus, Search, ChevronRight, Star, 
  Users, Target, Loader2, Rocket, Zap
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { fetchProjects } from '../api';

export default function Projects() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); 
  const [searchTerm, setSearchTerm] = useState('');

  const user = JSON.parse(localStorage.getItem('profile') || '{}');
  const userData = user.result || user;

  useEffect(() => {
    const loadProjects = async () => {
      try {
        const { data } = await fetchProjects();
        // Handle both array response and nested object response
        const projectData = Array.isArray(data) ? data : (data.projects || []);
        setProjects(projectData);
      } catch (err) {
        console.error("Error fetching projects:", err);
      } finally {
        setLoading(false);
      }
    };
    loadProjects();
  }, []);

  const filteredProjects = projects.filter(p => {
    const matchesSearch = p.title?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          p.domain?.toLowerCase().includes(searchTerm.toLowerCase());
    const isMine = p.lead?._id === userData._id || p.team?.some(member => member._id === userData._id);
    
    if (filter === 'mine') return matchesSearch && isMine;
    return matchesSearch;
  });

  if (loading) return (
    <div className="h-[70vh] flex flex-col items-center justify-center gap-4">
      <Loader2 className="animate-spin text-blue-500" size={40} />
      <p className="text-gray-500 font-black text-[10px] uppercase tracking-widest">Loading Mission Data...</p>
    </div>
  );

  return (
    <div className="space-y-8 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-20">
      
      {/* GLOSS HEADER */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 pt-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Rocket className="text-blue-500" size={24} />
            <h2 className="text-3xl md:text-3xl font-black tracking-tighter text-white ">Projects</h2>
          </div>
          <p className="text-gray-500 font-medium text-sm md:text-base">Track lab innovations and team deployments</p>
        </div>
        
        <Link 
          to="/create-project" 
          className="w-full md:w-auto bg-blue-600 hover:bg-blue-500 text-white px-8 py-4 rounded-2xl flex items-center justify-center gap-3 font-black text-xs uppercase tracking-widest transition-all shadow-xl shadow-blue-600/20 active:scale-95"
        >
          <Plus size={18} /> Initiate Project
        </Link>
      </header>

      {/* FILTER TERMINAL */}
      <div className="flex flex-col lg:flex-row gap-4 items-center justify-between bg-[#141417] p-3 md:p-4 rounded-[1.5rem] md:rounded-[2rem] border border-gray-800 shadow-2xl">
        <div className="relative w-full lg:w-96 group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-blue-500 transition-colors" size={18} />
          <input 
            type="text"
            placeholder="Search missions..."
            className="w-full bg-[#0a0a0c] border border-gray-800 rounded-xl md:rounded-2xl py-3 pl-12 pr-4 outline-none focus:border-blue-500 transition-all text-white text-sm"
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="w-full lg:w-auto">
          {[
            { id: 'all', label: 'All Missions' },
            { id: 'mine', label: 'My Deployments' }
          ].map(btn => (
            <button 
              key={btn.id}
              onClick={() => setFilter(btn.id)}
              className={`flex-1 md:px-8 py-3 rounded-lg md:rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                filter === btn.id ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              {btn.label}
            </button>
          ))}
        </div>
      </div>

      {/* MISSION GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <AnimatePresence>
          {filteredProjects.map((project, idx) => (
            <motion.div 
              layout
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              key={project._id}
              className="bg-[#141417] border border-gray-800 rounded-[2rem] p-8 flex flex-col hover:bg-[#1a1a1f] hover:border-blue-500/50 transition-all group relative overflow-hidden shadow-xl"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600/5 blur-3xl" />
              
              <div className="flex justify-between items-start mb-6 relative z-10">
                <span className="bg-[#0a0a0c] border border-gray-800 text-blue-500 text-[9px] font-black px-3 py-1.5 rounded-lg uppercase tracking-widest group-hover:border-blue-500/30 transition-all">
                  {project.domain || 'General'}
                </span>
                <div className="flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${project.status === 'Completed' ? 'bg-green-500' : 'bg-blue-500 animate-pulse'}`} />
                  <span className="text-gray-500 text-[9px] font-black uppercase tracking-tighter">{project.status || 'Active'}</span>
                </div>
              </div>

              <Link to={`/projects/${project._id}`} className="flex-1">
                <h3 className="text-2xl font-black mb-3 text-white tracking-tight group-hover:text-blue-400 transition-colors">
                  {project.title}
                </h3>
                <p className="text-gray-500 text-sm font-medium leading-relaxed line-clamp-3 mb-8">
                  {project.description}
                </p>
              </Link>

              <div className="pt-6 border-t border-gray-800 flex items-center justify-between mt-auto">
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <div className="w-10 h-10 rounded-xl bg-blue-600/10 border border-blue-500/20 flex items-center justify-center text-blue-500 font-black">
                      {project.lead?.name?.charAt(0)}
                    </div>
                  </div>
                  <div>
                    <p className="text-gray-200 text-xs font-black tracking-tight">{project.lead?.name || 'Unknown Lead'}</p>
                    <div className="flex items-center gap-1 text-[9px] text-gray-500 font-bold uppercase mt-0.5">
                      <Users size={10} className="text-blue-500" />
                      <span>{project.team?.length || 0} Members</span>
                    </div>
                  </div>
                </div>
                
                <Link 
                  to={`/projects/${project._id}`}
                  className="w-10 h-10 rounded-full bg-[#0a0a0c] border border-gray-800 flex items-center justify-center text-gray-600 group-hover:bg-blue-600 group-hover:text-white transition-all shadow-lg"
                >
                  <ChevronRight size={20} />
                </Link>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* EMPTY STATE */}
      {filteredProjects.length === 0 && !loading && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center py-20 bg-[#141417]/50 rounded-[2.5rem] border-2 border-dashed border-gray-800"
        >
          <Target className="mx-auto text-gray-800 mb-4" size={48} />
          <p className="text-gray-500 font-black uppercase text-xs tracking-[0.3em]">No projects found in this sector</p>
        </motion.div>
      )}
    </div>
  );
}