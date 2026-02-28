import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';

const inferToastType = (message) => {
  const text = String(message || '').toLowerCase();
  if (/error|failed|unable|invalid|denied|rejected/.test(text)) return 'error';
  if (/success|updated|created|sent|approved|scheduled/.test(text)) return 'success';
  return 'info';
};

const toastPalette = {
  error: {
    icon: AlertCircle,
    wrapper: 'border-red-500/25 text-red-200',
    iconColor: 'text-red-400',
    bg: 'rgba(127,29,29,0.55)',
    glow: '0 0 20px rgba(239,68,68,0.15)',
  },
  success: {
    icon: CheckCircle2,
    wrapper: 'border-emerald-500/25 text-emerald-100',
    iconColor: 'text-emerald-400',
    bg: 'rgba(6,78,59,0.55)',
    glow: '0 0 20px rgba(16,185,129,0.15)',
  },
  info: {
    icon: Info,
    wrapper: 'border-cyan-400/25 text-cyan-100',
    iconColor: 'text-cyan-400',
    bg: 'rgba(8,51,68,0.55)',
    glow: '0 0 20px rgba(34,211,238,0.15)',
  },
};

export default function GlobalToastHost() {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    const originalAlert = window.alert;

    const pushToast = (message, type) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      const toastType = type || inferToastType(message);
      setToasts((prev) => [...prev, { id, message: String(message || ''), type: toastType }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((item) => item.id !== id));
      }, 4400);
    };

    const onToast = (evt) => {
      const detail = evt?.detail || {};
      pushToast(detail.message, detail.type);
    };

    window.alert = (message) => {
      pushToast(message, undefined);
    };

    window.addEventListener('app:toast', onToast);

    return () => {
      window.removeEventListener('app:toast', onToast);
      window.alert = originalAlert;
    };
  }, []);

  return (
    <div className="fixed top-4 right-4 z-[120] w-[min(90vw,26rem)] space-y-2 pointer-events-none">
      <AnimatePresence>
        {toasts.map((toast) => {
          const palette = toastPalette[toast.type] || toastPalette.info;
          const Icon = palette.icon;
          return (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, x: 40, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 40, scale: 0.95 }}
              transition={{ type: 'spring', damping: 20, stiffness: 300 }}
              className={`pointer-events-auto rounded-2xl border backdrop-blur-xl px-4 py-3 ${palette.wrapper}`}
              style={{ background: palette.bg, boxShadow: `0 8px 32px rgba(0,0,0,0.4), ${palette.glow}` }}
            >
              <div className="flex items-start gap-2.5">
                <Icon size={16} className={`mt-0.5 shrink-0 ${palette.iconColor}`} />
                <p className="text-sm leading-relaxed break-words flex-1">{toast.message}</p>
                <button
                  type="button"
                  onClick={() => setToasts((prev) => prev.filter((item) => item.id !== toast.id))}
                  className="rounded-md p-0.5 text-white/60 hover:text-white hover:bg-white/10 transition-colors"
                  aria-label="Dismiss notification"
                  title="Dismiss"
                >
                  <X size={14} />
                </button>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
