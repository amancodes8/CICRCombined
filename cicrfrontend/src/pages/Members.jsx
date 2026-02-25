import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

import { 
  Search, Mail, Phone, GraduationCap, Filter, 
  X, RotateCcw, Briefcase, Users, ShieldCheck 
} from 'lucide-react';
import { fetchMembers } from '../api';

export default function Members() {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // States for search and filters
  const [searchTerm, setSearchTerm] = useState('');
  const [filterYear, setFilterYear] = useState('All');
  const [filterBranch, setFilterBranch] = useState('All');
  const [filterRole, setFilterRole] = useState('All');

  useEffect(() => {
    fetchMembers()
      .then((res) => {
        setMembers(res.data);
        setLoading(false);
      })
      .catch((err) => console.error(err));
  }, []);

  // Filter Categories
  const branches = ['All', 'CSE', 'ECE', 'ECS',  'ECM', 'BCA', 'MCA' ,'Other'];
  const years = ['All', '1', '2', '3', '4', 'Alumni'];

  
  const filteredMembers = members.filter((m) => {
    const matchesSearch = m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         m.collegeId.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesYear = filterYear === 'All' || m.year === filterYear;
    const matchesBranch = filterBranch === 'All' || m.branch === filterBranch;
    const matchesRole = filterRole === 'All' || m.role === filterRole;

    return matchesSearch && matchesYear && matchesBranch && matchesRole;
  });

  const resetFilters = () => {
    setSearchTerm('');
    setFilterYear('All');
    setFilterBranch('All');
    setFilterRole('All');
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto page-motion-c">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 section-motion section-motion-delay-1">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Community Directory</h2>
          <p className="text-gray-400">Discover innovators across the CICR network</p>
        </div>
        
        {/* Quick Stats Summary */}
        <div className="flex gap-4">
            <div className="bg-blue-600/10 border border-blue-500/20 px-4 py-2 rounded-2xl">
                <p className="text-[10px] uppercase font-black text-blue-500 tracking-widest">Total</p>
                <p className="text-xl font-bold">{filteredMembers.length}</p>
            </div>
            <div className="bg-purple-600/10 border border-purple-500/20 px-4 py-2 rounded-2xl">
                <p className="text-[10px] uppercase font-black text-purple-500 tracking-widest">Admins</p>
                <p className="text-xl font-bold">{filteredMembers.filter(m => m.role === 'Admin').length}</p>
            </div>
        </div>
      </header>

      {/* Advanced Filter Bar */}
      <div className="border border-gray-800 p-5 rounded-3xl shadow-xl space-y-4 section-motion section-motion-delay-2">
        <div className="flex items-center gap-2 text-gray-400 text-xs font-bold uppercase tracking-widest px-1">
            <Filter size={14} /> Advanced Filtering
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-3">
          {/* Search Input */}
          <div className="lg:col-span-2 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
            <input
              type="text"
              value={searchTerm}
              placeholder="Search by name or ID..."
              className="w-full bg-[#0a0a0c] border border-gray-800 rounded-xl py-3 pl-12 pr-4 outline-none focus:border-blue-500 transition-all text-sm"
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <select 
            value={filterBranch}
            onChange={(e) => setFilterBranch(e.target.value)}
            className="bg-[#0a0a0c] border border-gray-800 rounded-xl py-3 px-4 outline-none focus:border-blue-500 text-sm cursor-pointer appearance-none"
          >
            <option value="All">All Branches</option>
            {branches.filter(b => b !== 'All').map(b => <option key={b} value={b}>{b}</option>)}
          </select>

          <select 
            value={filterYear}
            onChange={(e) => setFilterYear(e.target.value)}
            className="bg-[#0a0a0c] border border-gray-800 rounded-xl py-3 px-4 outline-none focus:border-blue-500 text-sm cursor-pointer appearance-none"
          >
            <option value="All">All Years</option>
            {years.filter(y => y !== 'All').map(y => <option key={y} value={y}>{y} Year</option>)}
          </select>

          <button 
            onClick={resetFilters}
            className="flex items-center justify-center gap-2 bg-gray-800 hover:bg-red-500/10 hover:text-red-500 hover:border-red-500/20 border border-transparent rounded-xl py-3 px-4 transition-all text-sm font-bold"
          >
            <RotateCcw size={16} /> Reset
          </button>
        </div>
      </div>

      {/* Status Bar - Uses the 'Users' icon fixed above */}
      <div className="flex items-center gap-2 text-sm text-gray-500 px-2 section-motion section-motion-delay-2">
        <Users size={16} className="text-blue-500" />
        <span>Found {filteredMembers.length} members matching your criteria</span>
      </div>

      <AnimatePresence mode='popLayout'>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-20 section-motion section-motion-delay-3 pro-stagger">
          {filteredMembers.map((member) => (
            <motion.div
              layout
              key={member._id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="border border-gray-800 rounded-3xl p-6 hover:border-blue-500/50 transition-all group relative overflow-hidden flex flex-col pro-hover-lift"
            >
              <div className="flex items-start justify-between mb-6">
                <div className="w-14 h-14 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-2xl flex items-center justify-center text-xl font-bold uppercase shadow-lg">
                  {member.name.charAt(0)}
                </div>
                <div className="flex flex-col items-end gap-2">
                    <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest ${
                    member.role === 'Admin' ? 'bg-red-500/10 text-red-500 border border-red-500/20' : 'bg-blue-500/10 text-blue-500 border border-blue-500/20'
                    }`}>
                    {member.role}
                    </span>
                    {member.role === 'Admin' && <ShieldCheck size={16} className="text-red-500/50" />}
                </div>
              </div>

              <h3 className="text-xl font-bold group-hover:text-blue-400 transition-colors">
                {member.name}
              </h3>
              <p className="text-gray-500 text-xs font-mono mb-6 uppercase">{member.collegeId}</p>

              <div className="space-y-3 mt-auto pt-6 border-t border-gray-800/50">
                <div className="flex items-center gap-3 text-gray-400 text-sm">
                  <Mail size={16} className="text-blue-500" />
                  <span className="truncate">{member.email}</span>
                </div>
                <div className="flex items-center gap-3 text-gray-400 text-sm">
                  <Briefcase size={16} className="text-purple-500" />
                  <span>{member.branch || 'General'}</span>
                </div>
                <div className="flex items-center gap-3 text-gray-400 text-sm">
                  <GraduationCap size={16} className="text-amber-500" />
                  <span>{member.year ? `${member.year} Year` : 'Batch N/A'}</span>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </AnimatePresence>

      {/* Empty State */}
      {filteredMembers.length === 0 && !loading && (
        <div className="text-center py-24 rounded-[40px] border border-dashed border-gray-800 section-motion section-motion-delay-3">
          <Users className="mx-auto text-gray-700 mb-4" size={48} />
          <h3 className="text-xl font-bold text-gray-300">No matches found</h3>
          <p className="text-gray-500 mt-2">Try changing your filters or search keywords.</p>
          <button onClick={resetFilters} className="mt-6 text-blue-500 font-bold hover:underline">Clear all filters</button>
        </div>
      )}
    </div>
  );
}
