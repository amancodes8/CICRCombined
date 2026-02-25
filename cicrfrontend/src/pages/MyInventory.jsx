import { useEffect, useState } from 'react';
import { Package, Clock, RotateCcw } from 'lucide-react';
import { fetchInventory } from '../api';

export default function MyInventory() {
  const [myItems, setMyItems] = useState([]);
  const profile = JSON.parse(localStorage.getItem('profile') || '{}');
  const user = profile.result || profile;
  const userId = user?._id || '';

  useEffect(() => {
    if (!userId) {
      setMyItems([]);
      return;
    }
    fetchInventory().then(res => {
      const filtered = res.data.filter(item => 
        item.issuedTo.some(log => String(log.user?._id) === String(userId))
      );
      setMyItems(filtered);
    });
  }, [userId]);

  return (
    <div className="space-y-8 max-w-6xl mx-auto page-motion-a pro-stagger">
      <header className="section-motion section-motion-delay-1">
        <h2 className="text-3xl font-bold">My Borrowed Items</h2>
        <p className="text-gray-400">Components currently assigned to your projects</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 section-motion section-motion-delay-2">
        {myItems.map(item => {
          const myLog = item.issuedTo.find((l) => String(l.user?._id) === String(userId));
          return (
            <div key={item._id} className="border border-gray-800 p-6 rounded-2xl flex justify-between items-center pro-hover-lift">
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
