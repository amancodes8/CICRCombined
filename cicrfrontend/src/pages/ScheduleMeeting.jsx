import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Calendar as CalendarIcon, MapPin, Video, Users as UsersIcon, 
  Clock, ArrowLeft, Check, Loader2, Info, Globe
} from 'lucide-react';
import { fetchMembers, scheduleMeeting } from '../api';

export default function ScheduleMeeting() {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    title: '',
    meetingType: 'Online',
    topic: '',
    location: '',
    startTime: '',
    endTime: '',
    participants: []
  });

  useEffect(() => {
    const loadUsers = async () => {
      try {
        const { data } = await fetchMembers();
        setUsers(data);
      } catch (err) {
        console.error("Could not load users", err);
      }
    };
    loadUsers();
  }, []);

  const toggleParticipant = (userId) => {
    setFormData(prev => ({
      ...prev,
      participants: prev.participants.includes(userId)
        ? prev.participants.filter(id => id !== userId)
        : [...prev.participants, userId]
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = {
        ...formData,
        details: { topic: formData.topic, location: formData.location }
      };
      await scheduleMeeting(payload);
      navigate('/meetings');
    } catch (err) {
      alert(err.response?.data?.message || "Failed to schedule meeting");
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-5xl mx-auto pb-20 px-4"
    >
      {/* Header Section */}
      <div className="flex items-center justify-between mb-10">
        <button 
          onClick={() => navigate('/meetings')}
          className="group flex items-center gap-2 text-gray-400 hover:text-white transition-all bg-[#141417] px-4 py-2 rounded-full border border-gray-800"
        >
          <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" /> 
          <span className="text-sm font-medium">Back</span>
        </button>
        
        <div className="text-right">
          <h2 className="text-3xl font-black tracking-tight text-white">Create Event</h2>
          <p className="text-gray-500 text-sm">Fill in the details to sync with the community</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column: Form Inputs */}
        <div className="lg:col-span-2 space-y-6">
          <section className="bg-[#141417]/50 backdrop-blur-xl border border-gray-800 p-8 rounded-[2rem] shadow-2xl space-y-8">
            <div className="flex items-center gap-3 border-b border-gray-800 pb-5">
              <div className="p-2 bg-blue-600/20 rounded-lg text-blue-500">
                <Info size={20} />
              </div>
              <h3 className="font-bold text-lg">General Information</h3>
            </div>

            <div className="space-y-6">
              <div className="group space-y-2">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-widest ml-1">Event Title</label>
                <input 
                  required
                  className="w-full bg-[#0a0a0c] border border-gray-800 p-4 rounded-2xl outline-none focus:ring-2 focus:ring-blue-600/50 focus:border-blue-600 transition-all text-white placeholder:text-gray-700"
                  placeholder="What is this meeting about?"
                  onChange={e => setFormData({...formData, title: e.target.value})}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-widest ml-1">Meeting Type</label>
                  <div className="flex p-1 bg-[#0a0a0c] border border-gray-800 rounded-2xl">
                    <button 
                      type="button"
                      onClick={() => setFormData({...formData, meetingType: 'Online'})}
                      className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm transition-all ${formData.meetingType === 'Online' ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'text-gray-500 hover:text-gray-300'}`}
                    >
                      <Globe size={16} /> Online
                    </button>
                    <button 
                      type="button"
                      onClick={() => setFormData({...formData, meetingType: 'Offline'})}
                      className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm transition-all ${formData.meetingType === 'Offline' ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'text-gray-500 hover:text-gray-300'}`}
                    >
                      <MapPin size={16} /> In-Person
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-widest ml-1">Topic</label>
                  <input 
                    required
                    className="w-full bg-[#0a0a0c] border border-gray-800 p-4 rounded-2xl outline-none focus:ring-2 focus:ring-blue-600/50 focus:border-blue-600 transition-all text-white placeholder:text-gray-700"
                    placeholder="Core agenda topic"
                    onChange={e => setFormData({...formData, topic: e.target.value})}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-widest ml-1">
                  {formData.meetingType === 'Online' ? 'Meeting Link' : 'Venue / Room Name'}
                </label>
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600">
                    {formData.meetingType === 'Online' ? <Video size={18} /> : <MapPin size={18} />}
                  </div>
                  <input 
                    required
                    className="w-full bg-[#0a0a0c] border border-gray-800 p-4 pl-12 rounded-2xl outline-none focus:ring-2 focus:ring-blue-600/50 focus:border-blue-600 transition-all text-white"
                    placeholder={formData.meetingType === 'Online' ? 'https://zoom.us/j/...' : 'Hall A, 2nd Floor'}
                    onChange={e => setFormData({...formData, location: e.target.value})}
                  />
                </div>
              </div>
            </div>
          </section>

          <section className="bg-[#141417]/50 backdrop-blur-xl border border-gray-800 p-8 rounded-[2rem] shadow-2xl space-y-6">
            <div className="flex items-center gap-3 border-b border-gray-800 pb-5">
              <div className="p-2 bg-purple-600/20 rounded-lg text-purple-500">
                <CalendarIcon size={20} />
              </div>
              <h3 className="font-bold text-lg">Schedule & Time</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-3">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-widest ml-1 flex items-center gap-2">
                  <Clock size={14} className="text-purple-500" /> Starts
                </label>
                <div className="relative group">
                  <input 
                    type="datetime-local"
                    required
                    className="w-full bg-[#0a0a0c] border border-gray-800 p-4 rounded-2xl outline-none focus:ring-2 focus:ring-purple-600/50 focus:border-purple-600 transition-all text-white [color-scheme:dark]"
                    onChange={e => setFormData({...formData, startTime: e.target.value})}
                  />
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-widest ml-1 flex items-center gap-2">
                  <Clock size={14} className="text-purple-500" /> Ends
                </label>
                <input 
                  type="datetime-local"
                  required
                  className="w-full bg-[#0a0a0c] border border-gray-800 p-4 rounded-2xl outline-none focus:ring-2 focus:ring-purple-600/50 focus:border-purple-600 transition-all text-white [color-scheme:dark]"
                  onChange={e => setFormData({...formData, endTime: e.target.value})}
                />
              </div>
            </div>
            <p className="text-[10px] text-gray-600 italic mt-2">* Selecting dates via the calendar icon in the input field ensures better accuracy.</p>
          </section>
        </div>

        {/* Right Column: Participant Selection */}
        <div className="lg:col-span-1 space-y-6">
          <section className="bg-[#141417]/50 backdrop-blur-xl border border-gray-800 p-6 rounded-[2rem] h-full flex flex-col">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-bold text-lg flex items-center gap-2">
                <UsersIcon className="text-blue-500" size={20} /> Guests
              </h3>
              <span className="bg-blue-600/20 text-blue-500 text-[10px] font-black px-2 py-1 rounded-md">
                {formData.participants.length} SELECTED
              </span>
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto pr-2 custom-scrollbar" style={{maxHeight: '480px'}}>
              {users.map((u, index) => (
                <motion.div 
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  key={u._id}
                  onClick={() => toggleParticipant(u._id)}
                  className={`group flex items-center justify-between p-4 rounded-2xl border cursor-pointer transition-all ${
                    formData.participants.includes(u._id) 
                    ? 'border-blue-600 bg-blue-600/10 shadow-[0_0_15px_rgba(37,99,235,0.1)]' 
                    : 'border-gray-800 bg-[#0a0a0c] hover:border-gray-600'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${formData.participants.includes(u._id) ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400'}`}>
                      {u.name.charAt(0)}
                    </div>
                    <div>
                      <p className={`text-sm font-bold transition-colors ${formData.participants.includes(u._id) ? 'text-white' : 'text-gray-400'}`}>{u.name}</p>
                      <p className="text-[10px] text-gray-600 uppercase tracking-tighter">{u.role}</p>
                    </div>
                  </div>
                  <AnimatePresence>
                    {formData.participants.includes(u._id) && (
                      <motion.div 
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        exit={{ scale: 0 }}
                      >
                        <Check size={16} className="text-blue-500" />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              ))}
            </div>

            <button 
              disabled={loading}
              className="mt-8 w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-800 disabled:text-gray-500 text-white py-4 rounded-2xl font-black text-sm uppercase tracking-widest transition-all shadow-xl shadow-blue-600/20 flex justify-center items-center gap-3"
            >
              {loading ? <Loader2 className="animate-spin" /> : "Confirm Schedule"}
            </button>
          </section>
        </div>
      </form>
    </motion.div>
  );
}