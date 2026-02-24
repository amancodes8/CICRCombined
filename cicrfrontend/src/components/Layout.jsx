import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  LayoutDashboard, Users, FolderKanban, 
  Calendar, MessageSquare, LogOut, ShieldCheck, FileText, UserSquare2,
  Package, Menu, X 
} from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { getMe } from '../api';

export default function Layout({ children }) {
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  
  const profile = JSON.parse(localStorage.getItem('profile') || '{}');
  const [user, setUser] = useState(profile.result || profile);

  useEffect(() => {
    const syncProfile = async () => {
      try {
        const { data } = await getMe();
        const existing = JSON.parse(localStorage.getItem('profile') || '{}');
        const merged = { ...existing, ...data };
        localStorage.setItem('profile', JSON.stringify(merged));
        setUser(merged.result || merged);
      } catch (err) {
        // ignore periodic sync errors
      }
    };
    syncProfile();
  }, []);

  const handleLogout = () => {
    localStorage.clear();
    window.location.href = '/login';
  };

  // Profile icon removed from here as requested
  const navLinks = [
    { icon: LayoutDashboard, label: "Dashboard", path: "/dashboard" },
    { icon: FolderKanban, label: "Projects", path: "/projects" },
    { icon: Calendar, label: "Meetings", path: "/meetings" },
    { icon: Package, label: "Inventory", path: "/inventory" },
    { icon: MessageSquare, label: "AI Assistant", path: "/ai" },
    { icon: Users, label: "Community", path: "/community" },
    { icon: UserSquare2, label: "Profile", path: "/profile" },
    { icon: FileText, label: "Guidelines", path: "/guidelines" },
  ];

  const SidebarContent = () => (
    <>
      {/* Brand Logo */}
      <div className="flex items-center space-x-3 mb-10 px-2">
        <img className='w-10 h-8' src="logo.png" alt="logo"/>
        {/* <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center font-bold italic shadow-lg shadow-blue-600/20 text-white"><img src="./logo.png" alt="" /></div> */}
        <h1 className="text-xl font-bold tracking-tight text-white">CICR Connect</h1>
      </div>
      
      {/* Main Navigation */}
      <nav className="flex-1 space-y-2">
        {navLinks.map((link) => (
          <Link key={link.path} to={link.path} onClick={() => setIsMobileOpen(false)}>
            <motion.div
              whileHover={{ x: 5 }}
              className={`flex items-center space-x-3 p-3 rounded-xl transition-colors ${
                location.pathname === link.path ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-400 hover:bg-gray-800'
              }`}
            >
              <link.icon size={20} />
              <span className="font-medium">{link.label}</span>
            </motion.div>
          </Link>
        ))}

        {/* Admin Link (Conditional) */}
        {(user.role?.toLowerCase() === 'admin' || user.role?.toLowerCase() === 'head') && (
          <div className="pt-4 mt-4 border-t border-gray-800/50">
            <Link to="/admin" onClick={() => setIsMobileOpen(false)}>
              <div className={`flex items-center space-x-3 p-3 rounded-xl transition-colors ${
                location.pathname === '/admin' ? 'bg-purple-600 text-white shadow-lg' : 'text-gray-500 hover:bg-gray-800'
              }`}>
                <ShieldCheck size={20} />
                <span className="font-medium">Admin Panel</span>
              </div>
            </Link>
          </div>
        )}
      </nav>

      {/* Footer Profile Section (This acts as the link to /profile) */}
      <div className="mt-auto pt-6 border-t border-gray-800 space-y-4">
        <div className="group px-2 py-2 rounded-xl border border-gray-800/70 bg-[#0a0a0c]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-blue-600/10 border border-blue-500/20 rounded-lg flex items-center justify-center text-blue-500 font-black">
              {user.name?.[0] || 'M'}
            </div>
            <div className="overflow-hidden">
              <p className="text-sm font-bold truncate text-gray-100 flex items-center gap-2">
                {user.name || 'Member'}
                {user.hasUnreadWarning && <span className="inline-block w-2 h-2 bg-red-500 rounded-full" />}
              </p>
              <p className="text-[10px] text-blue-500 font-bold uppercase tracking-widest">{user.role || 'User'}</p>
            </div>
          </div>
        </div>

        {/* Logout Button */}
        <button onClick={handleLogout} className="flex items-center space-x-3 p-3 text-red-400 hover:bg-red-500/10 rounded-xl w-full group transition-all">
          <LogOut size={20} className="group-hover:translate-x-1 transition-transform" />
          <span className="font-medium">Logout</span>
        </button>
      </div>
    </>
  );

  return (
    <div className="flex min-h-screen bg-[#0a0a0c] text-white">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex w-64 border-r border-gray-800 p-6 flex-col fixed h-full bg-[#0a0a0c] z-20">
        <SidebarContent />
      </aside>

      {/* Mobile Top Nav */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-[#0a0a0c]/80 backdrop-blur-md border-b border-gray-800 flex items-center justify-between px-6 z-30">
        <span className="font-bold text-blue-500">CICR Connect</span>
        <button onClick={() => setIsMobileOpen(!isMobileOpen)} className="p-2 text-gray-400">
          {isMobileOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Mobile Sidebar Drawer */}
      <AnimatePresence>
        {isMobileOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setIsMobileOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
            />
            <motion.aside 
              initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }}
              className="fixed top-0 left-0 bottom-0 w-72 bg-[#0a0a0c] p-6 z-50 flex flex-col border-r border-gray-800 lg:hidden"
            >
              <SidebarContent />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main Content Area */}
      <main className="flex-1 lg:ml-64 p-4 md:p-8 pt-24 lg:pt-8 min-h-screen relative overflow-x-hidden">
        {/* Aesthetic Background Glow */}
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-600/5 blur-[120px] rounded-full -z-10 pointer-events-none" />
        
        <motion.div
          key={location.pathname}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          {children}
        </motion.div>
      </main>
    </div>
  );
}
