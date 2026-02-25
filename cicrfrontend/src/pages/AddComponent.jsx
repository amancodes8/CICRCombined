import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Save, Loader2, Package, 
  MapPin, Hash, Layers 
} from 'lucide-react';
import { addInventoryItem } from '../api';

export default function AddComponent() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    itemName: '',
    category: 'Electronics',
    totalQuantity: '',
    location: '',
    specifications: ''
  });

  const categories = ['Electronics', 'Motors', 'Sensors', 'Power', 'Tools', 'Mechanical'];

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      // Logic: availableQuantity is set to totalQuantity on creation in the backend
      await addInventoryItem(formData);
      alert("Component added to inventory successfully!");
      navigate('/inventory');
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || "Failed to add component. Check if you are an Admin.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 page-motion-a">
      {/* Back Button */}
      <button 
        onClick={() => navigate('/inventory')} 
        className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors group section-motion section-motion-delay-1"
      >
        <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" /> 
        Back to Inventory
      </button>

      <div className="border border-gray-800 rounded-3xl overflow-hidden shadow-2xl section-motion section-motion-delay-2 pro-hover-lift">
        <div className="bg-blue-600 p-6 flex items-center gap-4">
          <div className="bg-white/20 p-3 rounded-xl">
            <Package className="text-white" size={24} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Add New Robotics Component</h2>
            <p className="text-blue-100 text-xs">Fill in the details to update the lab stock</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          {/* Item Name */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-500 uppercase flex items-center gap-2">
              <Package size={14} /> Component Name
            </label>
            <input 
              required
              type="text"
              placeholder="e.g. Arduino Uno R3 or MG995 Servo"
              className="w-full bg-[#0a0a0c] border border-gray-800 p-4 rounded-xl outline-none focus:border-blue-500 transition-all"
              onChange={(e) => setFormData({...formData, itemName: e.target.value})}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Category Selection */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-500 uppercase flex items-center gap-2">
                <Layers size={14} /> Category
              </label>
              <select 
                className="w-full bg-[#0a0a0c] border border-gray-800 p-4 rounded-xl outline-none focus:border-blue-500 appearance-none"
                value={formData.category}
                onChange={(e) => setFormData({...formData, category: e.target.value})}
              >
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            {/* Total Quantity */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-500 uppercase flex items-center gap-2">
                <Hash size={14} /> Total Stock Units
              </label>
              <input 
                required
                type="number"
                min="1"
                placeholder="0"
                className="w-full bg-[#0a0a0c] border border-gray-800 p-4 rounded-xl outline-none focus:border-blue-500"
                onChange={(e) => setFormData({...formData, totalQuantity: e.target.value})}
              />
            </div>
          </div>

          {/* Lab Location */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-500 uppercase flex items-center gap-2">
              <MapPin size={14} /> Storage Location
            </label>
            <input 
              required
              type="text"
              placeholder="e.g. Cabinet A, Drawer 3"
              className="w-full bg-[#0a0a0c] border border-gray-800 p-4 rounded-xl outline-none focus:border-blue-500"
              onChange={(e) => setFormData({...formData, location: e.target.value})}
            />
          </div>

          {/* Specifications (Optional) */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-500 uppercase flex items-center gap-2">
              Specifications (Optional)
            </label>
            <textarea 
              placeholder="e.g. 5V Operating Voltage, 60 degrees rotation"
              rows="3"
              className="w-full bg-[#0a0a0c] border border-gray-800 p-4 rounded-xl outline-none focus:border-blue-500 resize-none"
              onChange={(e) => setFormData({...formData, specifications: e.target.value})}
            />
          </div>

          {/* Submit Button */}
          <button 
            disabled={loading}
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-700 py-4 rounded-xl font-bold text-white flex justify-center items-center gap-2 transition-all shadow-lg shadow-blue-600/30 disabled:opacity-50"
          >
            {loading ? <Loader2 className="animate-spin" /> : <><Save size={18} /> Register Component</>}
          </button>
        </form>
      </div>
    </div>
  );
}
