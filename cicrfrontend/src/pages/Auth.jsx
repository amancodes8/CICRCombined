import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { login, register, sendPasswordResetOtp, resetPasswordWithOtp } from '../api';
import { 
  AlertCircle, Loader2, User, Mail, 
  Lock, Fingerprint, Ticket, ArrowRight 
} from 'lucide-react';

export default function Auth() {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);

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

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let width = 0;
    let height = 0;
    let frameId = null;
    let pointerX = 0;
    let pointerY = 0;

    const particleCount = 280;
    const particles = Array.from({ length: particleCount }, () => ({
      x: (Math.random() - 0.5) * 22,
      y: (Math.random() - 0.5) * 14,
      z: Math.random() * 22 - 11,
      speed: 0.03 + Math.random() * 0.05,
      size: 0.6 + Math.random() * 1.2,
      seed: Math.random() * Math.PI * 2,
    }));

    const project = (point) => {
      const depth = 22;
      const scale = depth / (depth + point.z + 12);
      return {
        x: point.x * scale * 44 + width / 2,
        y: point.y * scale * 44 + height / 2,
        scale,
      };
    };

    const drawParticles = (t) => {
      for (let i = 0; i < particles.length; i += 1) {
        const p = particles[i];
        p.z += p.speed;
        if (p.z > 11) {
          p.z = -11;
          p.x = (Math.random() - 0.5) * 22;
          p.y = (Math.random() - 0.5) * 14;
        }

        const depthFactor = 1 - (p.z + 11) / 22;
        const driftX = Math.sin(t * 0.45 + p.seed) * 0.35;
        const driftY = Math.cos(t * 0.37 + p.seed) * 0.28;
        const parallaxX = pointerX * (0.9 + depthFactor * 1.9);
        const parallaxY = pointerY * (0.8 + depthFactor * 1.6);
        const pt = project({
          x: p.x + driftX + parallaxX,
          y: p.y + driftY + parallaxY,
          z: p.z,
        });

        if (pt.x < -40 || pt.x > width + 40 || pt.y < -40 || pt.y > height + 40) continue;

        const alpha = Math.max(0.08, Math.min(0.85, 0.12 + pt.scale * 0.6));
        ctx.fillStyle = `rgba(148, 197, 253, ${alpha})`;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, p.size * (0.55 + pt.scale * 1.6), 0, Math.PI * 2);
        ctx.fill();
      }
    };

    const draw = (timeMs) => {
      const t = timeMs * 0.001;
      ctx.clearRect(0, 0, width, height);
      drawParticles(t);
    };

    const resize = () => {
      width = container.clientWidth;
      height = container.clientHeight;
      canvas.width = Math.max(1, Math.floor(width * dpr));
      canvas.height = Math.max(1, Math.floor(height * dpr));
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(container);

    const onPointerMove = (e) => {
      const rect = container.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      pointerX = ((e.clientX - rect.left) / rect.width - 0.5) * 1.4;
      pointerY = ((e.clientY - rect.top) / rect.height - 0.5) * 1.1;
    };
    const onPointerLeave = () => {
      pointerX = 0;
      pointerY = 0;
    };
    container.addEventListener('pointermove', onPointerMove);
    container.addEventListener('pointerleave', onPointerLeave);

    const animate = (timeMs) => {
      draw(timeMs);
      frameId = window.requestAnimationFrame(animate);
    };

    if (prefersReduced) {
      draw(0);
    } else {
      frameId = window.requestAnimationFrame(animate);
    }

    return () => {
      if (frameId) cancelAnimationFrame(frameId);
      observer.disconnect();
      container.removeEventListener('pointermove', onPointerMove);
      container.removeEventListener('pointerleave', onPointerLeave);
    };
  }, []);

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
    <div ref={containerRef} className="min-h-screen flex items-center justify-center bg-[#050505] p-6 relative overflow-hidden font-sans page-motion-c">
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />
      <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/55 to-black/75" />

      <motion.div 
        layout
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative w-full max-w-md z-10 section-motion section-motion-delay-1"
      >
        <div className="relative bg-transparent p-10 rounded-[2.5rem] shadow-[0_30px_90px_rgba(0,0,0,0.6)] backdrop-blur-none">
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
