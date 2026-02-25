import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Plus, Search, Box, Loader2, X, 
  Layers, MapPin, ArrowRight, AlertCircle,
  Cpu, Zap, Radio, Database, Pencil, Minus, Check
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { adjustInventoryStock, adjustInventoryStockById, fetchInventory, issueInventoryItem } from '../api';

export default function Inventory() {
  const [items, setItems] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState(null);
  const [issueData, setIssueData] = useState({ quantity: 1, project: '' });
  const [isIssuing, setIsIssuing] = useState(false);
  const [editingItemId, setEditingItemId] = useState(null);
  const [adjustMode, setAdjustMode] = useState('add');
  const [adjustQty, setAdjustQty] = useState(1);
  const [adjusting, setAdjusting] = useState(false);

  const profileData = JSON.parse(localStorage.getItem('profile') || '{}');
  const userData = profileData.result || profileData;
  const isAdmin = userData.role?.toLowerCase() === 'admin' || userData.role?.toLowerCase() === 'head';

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const { data } = await fetchInventory();
      setItems(data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const getCategoryIcon = (category) => {
    const cat = category?.toLowerCase();
    if (cat?.includes('micro')) return <Cpu size={20} />;
    if (cat?.includes('sensor')) return <Zap size={20} />;
    if (cat?.includes('wire') || cat?.includes('comm')) return <Radio size={20} />;
    return <Box size={20} />;
  };

  const handleIssueSubmit = async (e) => {
    e.preventDefault();
    setIsIssuing(true);
    try {
      await issueInventoryItem({
        itemId: selectedItem._id,
        quantity: issueData.quantity,
        project: issueData.project
      });
      setSelectedItem(null);
      setIssueData({ quantity: 1, project: '' });
      loadData();
    } catch (err) { alert(err.response?.data?.message || "Failed to issue item"); }
    finally { setIsIssuing(false); }
  };

  const filteredItems = items.filter(i => 
    i.itemName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    i.category?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const openEdit = (itemId) => {
    setEditingItemId(itemId);
    setAdjustMode('add');
    setAdjustQty(1);
  };

  const closeEdit = () => {
    setEditingItemId(null);
    setAdjustQty(1);
  };

  const submitAdjust = async (itemId) => {
    setAdjusting(true);
    try {
      const payload = { itemId, mode: adjustMode, quantity: Number(adjustQty) };
      try {
        await adjustInventoryStock(payload);
      } catch (primaryErr) {
        // fallback to compatibility route
        await adjustInventoryStockById(itemId, { mode: adjustMode, quantity: Number(adjustQty) });
      }
      await loadData();
      closeEdit();
    } catch (err) {
      const status = err.response?.status;
      const message =
        err.response?.data?.message ||
        (status === 404 ? 'Adjust API not found. Restart backend and try again.' : null) ||
        `Failed to adjust stock${status ? ` (HTTP ${status})` : ''}`;
      alert(message);
    } finally {
      setAdjusting(false);
    }
  };

  if (loading) return (
    <div className="h-[70vh] flex flex-col items-center justify-center gap-4">
      <Loader2 className="animate-spin text-blue-500" size={48} />
      <p className="text-gray-500 font-black text-xs  tracking-widest">Inventory Online...</p>
    </div>
  );

  return (
    <div className="space-y-10 max-w-7xl mx-auto pb-20">
      {/* GLOSS HEADER */}
      <header className="flex flex-col md:flex-row justify-between items-end md:items-center  p-8 rounded-[2.5rem] border border-gray-800 relative overflow-hidden shadow-2xl">
        <div className="absolute top-0 left-0 w-64 h-64 bg-blue-600/5 blur-[100px] rounded-full" />
        <div className="relative z-10">
          <h2 className="text-3xl font-black tracking-tighter text-white">Lab Inventory</h2>
          <p className="text-gray-500 font-medium">Manage society components and shared robotics resources</p>
        </div>

        {isAdmin && (
          <Link 
            to="/inventory/add" 
            className="bg-blue-600 hover:bg-blue-500 text-white px-8 py-4 rounded-2xl flex items-center gap-3 font-black text-xs uppercase tracking-widest transition-all shadow-xl shadow-blue-600/20 active:scale-95"
          >
            <Plus size={18} /> Add Part
          </Link>
        )}
      </header>

      {/* NEURAL SEARCH */}
      <div className="relative group">
        <div className="absolute inset-y-0 left-5 flex items-center text-gray-500 group-focus-within:text-blue-500 transition-colors">
          <Search size={22} />
        </div>
        <input 
          type="text" 
          placeholder="Search Parts (e.g. Ultrasonic, STM32, Lipo)..." 
          className="w-full bg-[#141417]/50 backdrop-blur-md border border-gray-800 p-5 pl-14 rounded-3xl outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-600/5 transition-all text-white placeholder:text-gray-600 font-medium shadow-inner"
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* PARTS BENTO GRID */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {filteredItems.map((item, idx) => (
          <motion.div 
            key={item._id} 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.05 }}
            whileHover={{ y: -8 }} 
            className="bg-[#141417] border border-gray-800 p-8 rounded-[2rem] relative overflow-hidden group shadow-2xl transition-all hover:border-blue-500/40"
          >
            {/* Stock Pulse Indicator */}
            {item.availableQuantity < 5 && item.availableQuantity > 0 && (
              <div className="absolute top-4 right-4 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-orange-500"></span>
              </div>
            )}

            <div className="flex justify-between items-start mb-8">
              <div className="p-4 bg-[#0a0a0c] border border-gray-800 rounded-2xl text-blue-500 group-hover:bg-blue-600 group-hover:text-white transition-all duration-500">
                {getCategoryIcon(item.category)}
              </div>
              <div className="text-right flex items-start gap-2">
                <div>
                  <p className="text-[9px] font-black text-gray-600 uppercase tracking-widest mb-1">Stock</p>
                  <p className={`text-2xl font-black ${item.availableQuantity < 5 ? 'text-orange-500' : 'text-white'}`}>
                    {item.availableQuantity}
                  </p>
                </div>
                {isAdmin && (
                  <button
                    onClick={() => openEdit(item._id)}
                    className="p-2 rounded-xl bg-[#0a0a0c] border border-gray-800 text-gray-400 hover:text-blue-400 hover:border-blue-500/40 transition-all"
                    title="Edit stock"
                  >
                    <Pencil size={14} />
                  </button>
                )}
              </div>
            </div>
            
            <h3 className="text-lg font-black text-gray-100 mb-2 truncate group-hover:text-blue-400 transition-colors tracking-tight">{item.itemName}</h3>
            
            <div className="flex flex-wrap gap-2 mb-8">
              <span className="text-[10px] bg-[#0a0a0c] border border-gray-800 text-gray-500 px-3 py-1 rounded-lg font-bold uppercase tracking-tighter">
                {item.category || 'General'}
              </span>
              <span className="text-[10px] bg-blue-600/10 text-blue-500 px-3 py-1 rounded-lg font-bold uppercase flex items-center gap-1">
                <MapPin size={10} /> {item.location || 'Lab'}
              </span>
            </div>

            <button 
              onClick={() => setSelectedItem(item)}
              disabled={item.availableQuantity === 0}
              className={`w-full py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${
                item.availableQuantity > 0 
                ? 'bg-[#0a0a0c] border border-gray-800 text-gray-400 hover:bg-blue-600 hover:text-white hover:border-transparent' 
                : 'bg-red-500/10 text-red-500/50 cursor-not-allowed border border-red-500/20'
              }`}
            >
              {item.availableQuantity > 0 ? (
                <>Issue Part <ArrowRight size={14} /></>
              ) : 'Unavailable'}
            </button>

            <AnimatePresence>
              {isAdmin && editingItemId === item._id && (
                <motion.form
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  onSubmit={(e) => {
                    e.preventDefault();
                    submitAdjust(item._id);
                  }}
                  className="mt-4 bg-[#0a0a0c] border border-gray-800 rounded-2xl p-4 space-y-4"
                >
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setAdjustMode('subtract')}
                      className={`px-3 py-2 rounded-xl border text-[10px] font-black uppercase tracking-widest ${adjustMode === 'subtract' ? 'border-red-500/40 bg-red-500/10 text-red-400' : 'border-gray-800 text-gray-500'}`}
                      title="Subtract stock"
                    >
                      <Minus size={12} className="inline mr-1" /> Subtract
                    </button>
                    <button
                      type="button"
                      onClick={() => setAdjustMode('add')}
                      className={`px-3 py-2 rounded-xl border text-[10px] font-black uppercase tracking-widest ${adjustMode === 'add' ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400' : 'border-gray-800 text-gray-500'}`}
                      title="Add stock"
                    >
                      <Plus size={12} className="inline mr-1" /> Add
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setAdjustQty((q) => Math.max(1, Number(q) - 1))}
                      className="p-2 rounded-xl border border-gray-800 text-gray-400 hover:text-white"
                      title="Decrease quantity"
                    >
                      <Minus size={12} />
                    </button>
                    <input
                      type="number"
                      min="1"
                      value={adjustQty}
                      onChange={(e) => setAdjustQty(Math.max(1, Number(e.target.value) || 1))}
                      className="w-20 bg-black/30 border border-gray-800 rounded-xl px-2 py-2 text-center text-sm text-white"
                    />
                    <button
                      type="button"
                      onClick={() => setAdjustQty((q) => Number(q) + 1)}
                      className="p-2 rounded-xl border border-gray-800 text-gray-400 hover:text-white"
                      title="Increase quantity"
                    >
                      <Plus size={12} />
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="submit"
                      disabled={adjusting}
                      className="flex-1 px-3 py-2 rounded-xl border border-blue-500/40 bg-blue-600 text-white text-[10px] font-black uppercase tracking-widest disabled:opacity-50 flex items-center justify-center gap-1"
                      title="Save updated stock"
                    >
                      <Check size={12} /> Save Updated Stock
                    </button>
                    <button
                      type="button"
                      onClick={closeEdit}
                      className="px-3 py-2 rounded-xl border border-gray-800 text-gray-500 hover:text-white text-[10px] font-black uppercase tracking-widest"
                      title="Cancel"
                    >
                      Cancel
                    </button>
                  </div>
                </motion.form>
              )}
            </AnimatePresence>

            {/* PROGRESS TRACKER */}
            <div className="absolute bottom-0 left-0 h-1.5 bg-[#0a0a0c] w-full">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${Math.min((item.availableQuantity / (item.totalQuantity || 1)) * 100, 100)}%` }}
                className={`h-full transition-all duration-1000 ${item.availableQuantity < 5 ? 'bg-orange-500' : 'bg-blue-600'}`}
              />
            </div>
          </motion.div>
        ))}
      </div>

      {/* EMPTY STATE */}
      {filteredItems.length === 0 && !loading && (
        <div className="text-center py-32 bg-[#141417]/50 rounded-[3rem] border-2 border-dashed border-gray-800 space-y-4">
          <Database className="mx-auto text-gray-800" size={64} />
          <p className="text-gray-500 font-bold tracking-widest uppercase text-xs italic">Cache empty. No parts found.</p>
        </div>
      )}

      {/* MODERN ISSUANCE MODAL */}
      <AnimatePresence>
        {selectedItem && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setSelectedItem(null)}
              className="absolute inset-0 bg-[#050505]/90 backdrop-blur-xl"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative bg-[#141417] border border-gray-800 w-full max-w-lg p-10 rounded-[2.5rem] shadow-3xl overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600/10 blur-[60px] rounded-full -mr-16 -mt-16" />
              
              <button onClick={() => setSelectedItem(null)} className="absolute top-6 right-6 text-gray-600 hover:text-white transition-colors">
                <X size={24} />
              </button>
              
              <div className="flex items-center gap-4 mb-10">
                <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-blue-600/20">
                  {getCategoryIcon(selectedItem.category)}
                </div>
                <div>
                  <h3 className="text-2xl font-black tracking-tight text-white">Issue {selectedItem.itemName}</h3>
                  <p className="text-gray-500 text-xs font-bold uppercase tracking-widest">Available Units: {selectedItem.availableQuantity}</p>
                </div>
              </div>

              <form onSubmit={handleIssueSubmit} className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Quantity</label>
                    <input 
                      type="number" min="1" max={selectedItem.availableQuantity} required
                      className="w-full bg-[#0a0a0c] border border-gray-800 p-4 rounded-2xl outline-none focus:border-blue-500 text-white font-bold transition-all"
                      value={issueData.quantity}
                      onChange={(e) => setIssueData({...issueData, quantity: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Project ID / Name</label>
                    <input 
                      type="text" required placeholder="e.g. LAB-09-DRONE"
                      className="w-full bg-[#0a0a0c] border border-gray-800 p-4 rounded-2xl outline-none focus:border-blue-500 text-white font-bold transition-all"
                      value={issueData.project}
                      onChange={(e) => setIssueData({...issueData, project: e.target.value})}
                    />
                  </div>
                </div>

                <div className="bg-orange-500/10 border border-orange-500/20 p-5 rounded-2xl flex items-start gap-4">
                  <AlertCircle className="text-orange-500 flex-shrink-0" size={20} />
                  <p className="text-[10px] text-orange-400 font-bold uppercase leading-relaxed tracking-widest">
                    Confirming this will deduct items from the active stock. Please ensure items are returned after the mission.
                  </p>
                </div>

                <button 
                  disabled={isIssuing}
                  className="w-full bg-blue-600 hover:bg-blue-500 text-white py-5 rounded-2xl font-black text-xs uppercase tracking-widest flex justify-center items-center gap-3 transition-all shadow-xl shadow-blue-600/20 active:scale-95"
                >
                  {isIssuing ? <Loader2 className="animate-spin" /> : "Authorize Transaction"}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
