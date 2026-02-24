import { useEffect, useState } from 'react';
import { Package, Clock, RotateCcw } from 'lucide-react';
import { fetchInventory } from '../api';

export default function MyInventory() {
  const [myItems, setMyItems] = useState([]);
  const user = JSON.parse(localStorage.getItem('profile') || '{}');

  useEffect(() => {
    fetchInventory().then(res => {
      const filtered = res.data.filter(item => 
        item.issuedTo.some(log => log.user?._id === user._id)
      );
      setMyItems(filtered);
    });
  }, []);

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      <header>
        <h2 className="text-3xl font-bold">My Borrowed Items</h2>
        <p className="text-gray-400">Components currently assigned to your projects</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {myItems.map(item => {
          const myLog = item.issuedTo.find(l => l.user?._id === user._id);
          return (
            <div key={item._id} className="bg-[#141417] border border-gray-800 p-6 rounded-2xl flex justify-between items-center">
              <div className="flex gap-4 items-center">
                <div className="p-3 bg-purple-500/10 rounded-xl text-purple-500"><Package size={24} /></div>
                <div>
                  <h4 className="font-bold text-lg">{item.itemName}</h4>
                  <p className="text-sm text-gray-500">Borrowed for: <span className="text-blue-400">{myLog.project}</span></p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xl font-black">{myLog.quantity}</p>
                <p className="text-[10px] text-gray-500 uppercase tracking-widest flex items-center gap-1">
                  <Clock size={10} /> {new Date(myLog.issueDate).toLocaleDateString()}
                </p>
              </div>
            </div>
          );
        })}
        {myItems.length === 0 && <p className="text-gray-500 italic text-center col-span-2 py-20">You haven't borrowed any components yet.</p>}
      </div>
    </div>
  );
}