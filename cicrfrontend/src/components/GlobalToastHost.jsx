import { useEffect, useRef, useState } from 'react';
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
    wrapper: 'border-red-500/30 bg-red-500/10 text-red-200',
    iconColor: 'text-red-300',
  },
  success: {
    icon: CheckCircle2,
    wrapper: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-100',
    iconColor: 'text-emerald-300',
  },
  info: {
    icon: Info,
    wrapper: 'border-cyan-400/30 bg-cyan-500/10 text-cyan-100',
    iconColor: 'text-cyan-300',
  },
};

export default function GlobalToastHost() {
  const [toasts, setToasts] = useState([]);
  const originalAlertRef = useRef(window.alert);

  useEffect(() => {
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
      window.alert = originalAlertRef.current;
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
              initial={{ opacity: 0, y: -10, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.97 }}
              transition={{ duration: 0.2 }}
              className={`pointer-events-auto rounded-xl border backdrop-blur-md px-3 py-2.5 shadow-xl ${palette.wrapper}`}
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
