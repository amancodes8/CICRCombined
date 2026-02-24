import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Cpu, History, User, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { fetchInventory, issueInventoryItem } from '../api';

export default function InventoryDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [issueData, setIssueData] = useState({ quantity: 1, project: '' });

  useEffect(() => {
    getItemDetails();
  }, [id]);

  const getItemDetails = async () => {
    try {
      const { data } = await fetchInventory(); // Usually you'd have fetchInventoryById
      const found = data.find(i => i._id === id);
      setItem(found);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const handleIssue = async (e) => {
    e.preventDefault();
    try {
      await issueInventoryItem({ itemId: id, ...issueData });
      alert("Item issued successfully!");
      getItemDetails(); // Refresh data
    } catch (err) { alert(err.response?.data?.message || "Error issuing item"); }
  };

  if (loading) return <div className="h-96 flex items-center justify-center"><Loader2 className="animate-spin text-blue-500" /></div>;

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <button onClick={() => navigate('/inventory')} className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors">
        <ArrowLeft size={18} /> Back to Inventory
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left: Specs & Info */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-[#141417] border border-gray-800 p-8 rounded-3xl">
            <div className="flex items-center gap-4 mb-6">
              <div className="p-4 bg-blue-600/10 rounded-2xl text-blue-500"><Cpu size={32} /></div>
              <div>
                <h2 className="text-3xl font-bold">{item.itemName}</h2>
                <p className="text-gray-400">{item.category} • Location: {item.location}</p>
              </div>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 py-6 border-y border-gray-800">
              <div>
                <p className="text-xs text-gray-500 uppercase font-bold">Total Stock</p>
                <p className="text-xl font-bold">{item.totalQuantity}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase font-bold">Available</p>
                <p className="text-xl font-bold text-green-500">{item.availableQuantity}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase font-bold">In Use</p>
                <p className="text-xl font-bold text-blue-500">{item.totalQuantity - item.availableQuantity}</p>
              </div>
            </div>
          </div>

          {/* Borrowing History */}
          <div className="bg-[#141417] border border-gray-800 rounded-3xl p-6">
            <h3 className="text-xl font-bold mb-4 flex items-center gap-2"><History size={20} /> Issuance History</h3>
            <div className="space-y-4">
              {item.issuedTo?.length > 0 ? item.issuedTo.map((log, idx) => (
                <div key={idx} className="flex items-center justify-between p-4 bg-[#0a0a0c] rounded-2xl border border-gray-800">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center text-xs font-bold">{log.user?.name[0]}</div>
                    <div>
                      <p className="text-sm font-bold">{log.user?.name}</p>
                      <p className="text-[10px] text-gray-500 uppercase tracking-widest">{log.project || 'Personal Project'}</p>
                    </div>
                  </div>
                  <div className="text-right text-[10px] text-gray-500">
                    <p>Qty: {log.quantity}</p>
                    <p>{new Date(log.issueDate).toLocaleDateString()}</p>
                  </div>
                </div>
              )) : <p className="text-gray-500 italic text-sm">No one has borrowed this item yet.</p>}
            </div>
          </div>
        </div>

        {/* Right: Issue Form */}
        <div className="space-y-6">
          <div className="bg-blue-600/5 border border-blue-500/20 p-8 rounded-3xl">
            <h3 className="text-xl font-bold mb-4">Issue Component</h3>
            <form onSubmit={handleIssue} className="space-y-4">
              <div>
                <label className="text-xs text-gray-400 font-bold mb-2 block uppercase">Quantity to take</label>
                <input 
                  type="number" 
                  min="1" 
                  max={item.availableQuantity}
                  value={issueData.quantity}
                  onChange={e => setIssueData({...issueData, quantity: parseInt(e.target.value)})}
                  className="w-full bg-[#0a0a0c] border border-gray-800 p-4 rounded-xl outline-none focus:border-blue-500" 
                />
              </div>
              <div>
                <label className="text-xs text-gray-400 font-bold mb-2 block uppercase">Project Name</label>
                <input 
                  type="text" 
                  placeholder="e.g., Drone Alpha"
                  value={issueData.project}
                  onChange={e => setIssueData({...issueData, project: e.target.value})}
                  className="w-full bg-[#0a0a0c] border border-gray-800 p-4 rounded-xl outline-none focus:border-blue-500" 
                />
              </div>
              <button 
                disabled={item.availableQuantity === 0}
                className="w-full bg-blue-600 hover:bg-blue-700 py-4 rounded-xl font-bold transition-all disabled:opacity-50"
              >
                Confirm Issuance
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}