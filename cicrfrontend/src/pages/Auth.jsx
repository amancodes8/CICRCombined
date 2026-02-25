import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { login, register, sendPasswordResetOtp, resetPasswordWithOtp } from '../api';
import { 
  AlertCircle, Loader2, User, Mail, 
  Lock, Fingerprint, Ticket, ArrowRight 
} from 'lucide-react';

export default function Auth() {
  const [mode, setMode] = useState('login');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const isLogin = mode === 'login';
  const isForgot = mode === 'forgot';
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    collegeId: '',
    inviteCode: '',
    otp: '',
    newPassword: ''
  });

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    if (error) setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setNotice('');

    try {
      if (isForgot) {
        if (!otpSent) {
          await sendPasswordResetOtp({
            email: formData.email,
            collegeId: formData.collegeId,
          });
          setOtpSent(true);
          setNotice('OTP sent. Check your email.');
          return;
        }

        await resetPasswordWithOtp({
          email: formData.email,
          collegeId: formData.collegeId,
          otp: formData.otp,
          newPassword: formData.newPassword,
        });
        setNotice('Password changed successfully. Please sign in.');
        setMode('login');
        setOtpSent(false);
        setFormData({
          name: '',
          email: formData.email,
          password: '',
          collegeId: '',
          inviteCode: '',
          otp: '',
          newPassword: ''
        });
      } else if (isLogin) {
        const response = await login({ email: formData.email, password: formData.password });
        localStorage.setItem('token', response.data.token);
        localStorage.setItem('profile', JSON.stringify(response.data));
        window.location.href = '/dashboard';
      } else {
        await register(formData);
        setNotice('Registration submitted. Wait for admin approval, then sign in.');
        setMode('login');
        setFormData({
          name: '',
          email: formData.email,
          password: '',
          collegeId: '',
          inviteCode: '',
          otp: '',
          newPassword: ''
        });
      }
    } catch (err) {
      const fieldError = err.response?.data?.errors?.[0]?.message;
      const message = fieldError || err.response?.data?.message || "Connection failed. Please check your network.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#050505] p-6 relative overflow-hidden font-sans">
      {/* Dynamic Background Elements */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-600/10 blur-[150px] rounded-full animate-pulse" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-purple-600/10 blur-[150px] rounded-full animate-pulse" style={{ animationDelay: '2s' }} />

      <motion.div 
        layout
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative w-full max-w-md"
      >
        {/* Animated Outer Glow */}
        <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-600 to-purple-600 rounded-[2.5rem] blur opacity-20" />
        
        <div className="relative bg-[#0d0d10] border border-white/10 p-10 rounded-[2.5rem] shadow-3xl backdrop-blur-xl">
          <header className="text-center mb-10">
            <motion.div 
              initial={{ scale: 0 }} animate={{ scale: 1 }}
              className="w-14 h-14 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-blue-600/40"
            >
              <Fingerprint className="text-white" size={32} />
            </motion.div>
            <h2 className="text-4xl text-white font-black tracking-tighter">
              {isForgot ? (otpSent ? 'Set Password' : 'Reset Password') : (isLogin ? 'Sign In' : 'Join CICR')}
            </h2>
            <p className="text-gray-500 mt-3 text-sm font-medium tracking-wide uppercase">
              {isForgot
                ? (otpSent ? 'Enter OTP and new password' : 'Get OTP on your email')
                : (isLogin ? 'Welcome to CICR' : 'Create your CICR profile')}
            </p>
          </header>

          <AnimatePresence mode="wait">
            {error && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-2xl mb-8 flex items-center gap-3 text-xs font-semibold"
              >
                <AlertCircle size={18} />
                {error}
              </motion.div>
            )}
            {!error && notice && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 p-4 rounded-2xl mb-8 flex items-center gap-3 text-xs font-semibold"
              >
                <AlertCircle size={18} />
                {notice}
              </motion.div>
            )}
          </AnimatePresence>

          <form onSubmit={handleSubmit} className="space-y-5">
            <AnimatePresence mode="popLayout">
              {!isLogin && !isForgot && (
                <motion.div 
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="space-y-5"
                >
                  <InputGroup icon={User} name="name" placeholder="Full Name" value={formData.name} onChange={handleChange} />
                  <InputGroup icon={Hash} name="collegeId" placeholder="College ID" value={formData.collegeId} onChange={handleChange} />
                  <InputGroup icon={Ticket} name="inviteCode" placeholder="Access Code*" value={formData.inviteCode} onChange={handleChange} />
                </motion.div>
              )}
            </AnimatePresence>

            <InputGroup icon={Mail} name="email" type="email" placeholder="Email Address" value={formData.email} onChange={handleChange} />
            {isForgot && (
              <InputGroup icon={Hash} name="collegeId" placeholder="College ID" value={formData.collegeId} onChange={handleChange} />
            )}

            {!isForgot && (
              <InputGroup icon={Lock} name="password" type="password" placeholder="Password" value={formData.password} onChange={handleChange} />
            )}

            {isForgot && otpSent && (
              <>
                <InputGroup icon={Ticket} name="otp" placeholder="6-digit OTP" value={formData.otp} onChange={handleChange} />
                <InputGroup icon={Lock} name="newPassword" type="password" placeholder="New Password" value={formData.newPassword} onChange={handleChange} />
              </>
            )}

            <motion.button 
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white py-5 rounded-2xl font-black text-sm uppercase tracking-widest transition-all flex justify-center items-center gap-2 shadow-xl shadow-blue-600/20 mt-8"
            >
              {loading ? (
                <Loader2 className="animate-spin" />
              ) : (
                <>
                  {isForgot
                    ? (otpSent ? 'Change Password' : 'Send OTP')
                    : (isLogin ? 'Authenticate' : 'Complete Entry')}
                  <ArrowRight size={18} />
                </>
              )}
            </motion.button>
          </form>

          <div className="text-center mt-10">
            {isLogin && (
              <button
                onClick={() => { setMode('forgot'); setOtpSent(false); setError(''); setNotice(''); }}
                className="text-xs font-black uppercase tracking-[0.2em] text-gray-600 hover:text-blue-500 transition-all mr-6"
              >
                Change Password (OTP)
              </button>
            )}
            <button
              onClick={() => {
                if (isForgot) {
                  setMode('login');
                  setOtpSent(false);
                } else {
                  setMode(isLogin ? 'signup' : 'login');
                }
                setError('');
                setNotice('');
              }}
              className="text-lg mt-2 font-serif uppercase tracking-[0.2em] text-white hover:text-blue-500 transition-all"
            >
              {isForgot ? 'Return to Sign In' : (isLogin ? 'Join CICR' : 'Return to Sign In')}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

// Sub-component for Inputs to keep the main return clean
function InputGroup({ icon: Icon, ...props }) {
  return (
    <div className="relative group">
      <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600 group-focus-within:text-blue-500 transition-colors">
        <Icon size={18} />
      </div>
      <input 
        required
        {...props}
        className="w-full bg-[#08080a] border border-white/5 p-4 pl-12 rounded-2xl text-white text-sm outline-none focus:border-blue-600/50 focus:ring-4 focus:ring-blue-600/5 transition-all placeholder:text-gray-700"
      />
    </div>
  );
}

// Simple Hash Icon since lucide-react might not export it directly as Hash in all versions
const Hash = ({ size, className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <line x1="4" y1="9" x2="20" y2="9"></line>
    <line x1="4" y1="15" x2="20" y2="15"></line>
    <line x1="10" y1="3" x2="8" y2="21"></line>
    <line x1="16" y1="3" x2="14" y2="21"></line>
  </svg>
);
