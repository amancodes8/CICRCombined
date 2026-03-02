import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { login, register, sendPasswordResetOtp, resetPasswordWithOtp, resetPasswordWithCode } from '../api';
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
  const [forgotMethod, setForgotMethod] = useState('emailOtp');
  const isLogin = mode === 'login';
  const isForgot = mode === 'forgot';
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    collegeId: '',
    inviteCode: '',
    otp: '',
    resetCode: '',
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

    const particleCount = 140;
    const particles = Array.from({ length: particleCount }, () => ({
      x: (Math.random() - 0.5) * 22,
      y: (Math.random() - 0.5) * 14,
      z: Math.random() * 22 - 11,
      speed: 0.02 + Math.random() * 0.035,
      size: 0.5 + Math.random() * 0.95,
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
        const driftX = Math.sin(t * 0.4 + p.seed) * 0.22;
        const driftY = Math.cos(t * 0.32 + p.seed) * 0.2;
        const parallaxX = pointerX * (0.45 + depthFactor * 1.05);
        const parallaxY = pointerY * (0.4 + depthFactor * 0.9);
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
      pointerX = ((e.clientX - rect.left) / rect.width - 0.5) * 0.9;
      pointerY = ((e.clientY - rect.top) / rect.height - 0.5) * 0.75;
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
        if (forgotMethod === 'emailOtp') {
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
          setForgotMethod('emailOtp');
          setFormData({
            name: '',
            email: formData.email,
            password: '',
            collegeId: '',
            inviteCode: '',
            otp: '',
            resetCode: '',
            newPassword: ''
          });
        } else {
          await resetPasswordWithCode({
            collegeId: formData.collegeId,
            resetCode: formData.resetCode,
            newPassword: formData.newPassword,
          });
          setNotice('Password changed successfully. Please sign in.');
          setMode('login');
          setOtpSent(false);
          setForgotMethod('emailOtp');
          setFormData({
            name: '',
            email: '',
            password: '',
            collegeId: '',
            inviteCode: '',
            otp: '',
            resetCode: '',
            newPassword: ''
          });
        }
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
          resetCode: '',
          newPassword: ''
        });
      }
    } catch (err) {
      const fieldError = err.response?.data?.errors?.[0]?.message;
      const code = String(err.response?.data?.code || '').trim();
      const message = fieldError || err.response?.data?.message || "Connection failed. Please check your network.";
      if (isLogin && code === 'ACCOUNT_PENDING_APPROVAL') {
        setError('');
        setNotice('Account created successfully but pending admin approval. Ask Admin/Head to approve your profile, then sign in.');
      } else {
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div ref={containerRef} className="min-h-screen flex items-center justify-center p-6 relative overflow-hidden font-sans page-motion-c auth-bg">
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />
      <div className="absolute inset-0 bg-linear-to-b from-black/30 via-black/55 to-black/75" />

      <motion.div 
        layout
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative w-full max-w-md z-10 section-motion section-motion-delay-1"
      >
        <div className="relative p-10 rounded-[2.5rem] shadow-[0_30px_90px_rgba(0,0,0,0.8)] glass-strong">
          <header className="text-center mb-10">
            <motion.div 
              initial={{ scale: 0, rotate: -10 }} animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', damping: 15, stiffness: 200 }}
              className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6 gradient-blue-purple-icon"
            >
              <Fingerprint className="text-white" size={32} />
            </motion.div>
            <h2 className="text-4xl text-white font-black tracking-tighter">
              {isForgot ? (otpSent ? 'Set Password' : 'Reset Password') : (isLogin ? 'Sign In' : 'Join CICR')}
            </h2>
            <p className="text-gray-300 mt-3 text-sm font-medium tracking-wide uppercase">
              {isForgot
                ? (
                    forgotMethod === 'emailOtp'
                      ? (otpSent ? 'Enter OTP and new password' : 'Get OTP on your email')
                      : 'Use admin-issued reset code'
                  )
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
                  <InputGroup icon={User} name="name" label="Full Name" placeholder="Full Name" value={formData.name} onChange={handleChange} />
                  <InputGroup icon={Hash} name="collegeId" label="College ID" placeholder="College ID" value={formData.collegeId} onChange={handleChange} />
                  <InputGroup icon={Ticket} name="inviteCode" label="Access Code" placeholder="Access Code*" value={formData.inviteCode} onChange={handleChange} />
                </motion.div>
              )}
            </AnimatePresence>

            {(!isForgot || forgotMethod === 'emailOtp') && (
              <InputGroup
                icon={Mail}
                name="email"
                label={isLogin ? 'Email or College ID' : 'Email Address'}
                type="text"
                placeholder={isLogin ? "Email or College ID" : "Email Address"}
                value={formData.email}
                onChange={handleChange}
              />
            )}
            {isForgot && (
              <>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setForgotMethod('emailOtp');
                      setOtpSent(false);
                      setNotice('');
                      setError('');
                    }}
                    className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border ${
                      forgotMethod === 'emailOtp'
                        ? 'border-blue-500/50 text-blue-200 bg-blue-500/10'
                        : 'border-white/10 text-gray-300'
                    }`}
                  >
                    Email OTP
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setForgotMethod('resetCode');
                      setOtpSent(false);
                      setNotice('');
                      setError('');
                    }}
                    className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border ${
                      forgotMethod === 'resetCode'
                        ? 'border-blue-500/50 text-blue-200 bg-blue-500/10'
                        : 'border-white/10 text-gray-300'
                    }`}
                  >
                    Reset Code
                  </button>
                </div>
                {forgotMethod === 'emailOtp' && (
                  <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2">
                    <p className="text-xs font-black uppercase tracking-widest text-amber-200">
                      Warning: Email OTP not available. Please use Reset Code.
                    </p>
                  </div>
                )}
                <InputGroup icon={Hash} name="collegeId" label="College ID" placeholder="College ID" value={formData.collegeId} onChange={handleChange} />
              </>
            )}

            {!isForgot && (
              <InputGroup icon={Lock} name="password" label="Password" type="password" placeholder="Password" value={formData.password} onChange={handleChange} />
            )}

            {isForgot && forgotMethod === 'emailOtp' && otpSent && (
              <>
                <InputGroup icon={Ticket} name="otp" label="OTP" placeholder="6-digit OTP" value={formData.otp} onChange={handleChange} />
                <InputGroup icon={Lock} name="newPassword" label="New Password" type="password" placeholder="New Password" value={formData.newPassword} onChange={handleChange} />
              </>
            )}

            {isForgot && forgotMethod === 'resetCode' && (
              <>
                <InputGroup icon={Ticket} name="resetCode" label="Reset Code" placeholder="Admin-issued reset code" value={formData.resetCode} onChange={handleChange} />
                <InputGroup icon={Lock} name="newPassword" label="New Password" type="password" placeholder="New Password" value={formData.newPassword} onChange={handleChange} />
              </>
            )}

            <motion.button 
              whileHover={{ scale: 1.005 }}
              whileTap={{ scale: 0.992 }}
              type="submit"
              disabled={loading}
              className="w-full text-white py-5 rounded-2xl font-black text-sm uppercase tracking-widest transition-all flex justify-center items-center gap-2 mt-8 gradient-blue-purple"
            >
              {loading ? (
                <Loader2 className="animate-spin" />
              ) : (
                <>
                  {isForgot
                    ? (
                        forgotMethod === 'emailOtp'
                          ? (otpSent ? 'Change Password' : 'Send OTP')
                          : 'Reset Password'
                      )
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
                className="text-xs font-black uppercase tracking-[0.2em] text-gray-300 hover:text-blue-500 transition-all mr-6"
              >
                Forgot Password
              </button>
            )}
            <button
              onClick={() => {
                if (isForgot) {
                  setMode('login');
                  setOtpSent(false);
                  setForgotMethod('emailOtp');
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
function InputGroup({ icon: Icon, label, required = true, ...props }) {
  const fieldId = props.id || props.name;

  return (
    <div className="space-y-1.5">
      {label ? (
        <label htmlFor={fieldId} className="block text-xs font-semibold text-gray-300 tracking-wide">
          {label}
          {required ? <span className="text-rose-300"> *</span> : null}
        </label>
      ) : null}
      <div className="relative group">
        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-500 transition-colors">
          <Icon size={18} />
        </div>
        <input
          required={required}
          id={fieldId}
          {...props}
          className="w-full border border-white/8 p-4 pl-12 rounded-2xl text-white text-sm outline-none focus:border-blue-500/50 focus:ring-4 focus:ring-blue-600/10 transition-all placeholder:text-gray-400 glass"
        />
      </div>
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
