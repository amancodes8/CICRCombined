import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Command, Search } from 'lucide-react';

const normalize = (value) => String(value || '').toLowerCase();

export default function CommandPalette({ open, onClose, commands = [] }) {
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setActiveIndex(0);
  }, [open]);

  const filtered = useMemo(() => {
    const q = normalize(query).trim();
    if (!q) return commands.slice(0, 14);
    return commands
      .filter((item) => {
        const hay = [item.label, item.subtitle, item.keywords]
          .map((v) => normalize(v))
          .join(' ');
        return hay.includes(q);
      })
      .slice(0, 14);
  }, [commands, query]);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose?.();
        return;
      }

      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setActiveIndex((prev) => Math.min(prev + 1, Math.max(0, filtered.length - 1)));
        return;
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setActiveIndex((prev) => Math.max(prev - 1, 0));
        return;
      }

      if (event.key === 'Enter') {
        if (!filtered[activeIndex]) return;
        event.preventDefault();
        filtered[activeIndex].onSelect?.();
        onClose?.();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeIndex, filtered, onClose, open]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[80]"
            onClick={onClose}
          />

          <motion.div
            initial={{ opacity: 0, y: 14, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 14, scale: 0.98 }}
            transition={{ duration: 0.2 }}
            className="fixed left-1/2 top-[13vh] -translate-x-1/2 w-[min(700px,94vw)] z-[90] ui-surface"
          >
            <div className="p-3 border-b border-gray-800/90 flex items-center gap-2">
              <Search size={14} className="text-gray-500" />
              <input
                autoFocus
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search pages and actions..."
                className="flex-1 bg-transparent text-sm text-gray-100 outline-none"
              />
              <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-widest text-gray-500">
                <Command size={11} /> Enter
              </span>
            </div>

            <div className="max-h-[58vh] overflow-auto p-2">
              {filtered.length === 0 ? (
                <div className="ui-empty text-xs">No command found for this query.</div>
              ) : (
                filtered.map((item, index) => (
                  <button
                    key={item.id || `${item.label}-${index}`}
                    type="button"
                    onClick={() => {
                      item.onSelect?.();
                      onClose?.();
                    }}
                    className={`w-full text-left rounded-xl px-3 py-2.5 border mb-1 transition-colors ${
                      activeIndex === index
                        ? 'border-blue-500/45 bg-blue-500/10 text-blue-100'
                        : 'border-transparent text-gray-200 hover:border-gray-700 hover:bg-white/[0.03]'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="h-7 w-7 rounded-lg border border-gray-700/70 flex items-center justify-center shrink-0 mt-0.5">
                        {item.icon ? <item.icon size={13} className="text-cyan-300" /> : <Command size={13} className="text-cyan-300" />}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold truncate">{item.label}</p>
                        {item.subtitle ? <p className="text-xs text-gray-500 mt-0.5 truncate">{item.subtitle}</p> : null}
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
