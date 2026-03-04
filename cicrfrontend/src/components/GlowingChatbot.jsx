import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ExternalLink, Loader2, Send, X, Zap, Bot, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { askCicrAssistant } from '../api';

/* AI brain-circuit icon for the FAB */
function AiBrainIcon({ size = 24, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M12 3c-1.8 0-3.4.8-4.4 2A5 5 0 0 0 3 10c0 1.7.8 3.2 2 4.2-.2.6-.3 1.2-.3 1.8a5 5 0 0 0 3.5 4.8c.8.5 1.8.7 2.8.7V3Z"
        fill="url(#aiBrainL)" opacity="0.85" />
      <path d="M12 3c1.8 0 3.4.8 4.4 2A5 5 0 0 1 21 10c0 1.7-.8 3.2-2 4.2.2.6.3 1.2.3 1.8a5 5 0 0 1-3.5 4.8c-.8.5-1.8.7-2.8.7V3Z"
        fill="url(#aiBrainR)" opacity="0.85" />
      <circle cx="9" cy="9" r="1.2" fill="#fff" />
      <circle cx="15" cy="9" r="1.2" fill="#fff" />
      <circle cx="12" cy="14" r="1.2" fill="#fff" />
      <line x1="9" y1="9" x2="12" y2="14" stroke="#fff" strokeWidth="0.8" strokeLinecap="round" opacity="0.7" />
      <line x1="15" y1="9" x2="12" y2="14" stroke="#fff" strokeWidth="0.8" strokeLinecap="round" opacity="0.7" />
      <line x1="9" y1="9" x2="15" y2="9" stroke="#fff" strokeWidth="0.8" strokeLinecap="round" opacity="0.7" />
      <defs>
        <linearGradient id="aiBrainL" x1="3" y1="3" x2="12" y2="21">
          <stop offset="0%" stopColor="#818cf8" />
          <stop offset="100%" stopColor="#6366f1" />
        </linearGradient>
        <linearGradient id="aiBrainR" x1="12" y1="3" x2="21" y2="21">
          <stop offset="0%" stopColor="#22d3ee" />
          <stop offset="100%" stopColor="#06b6d4" />
        </linearGradient>
      </defs>
    </svg>
  );
}

const FAB_STYLE = {
  position: 'fixed', bottom: 24, right: 24, zIndex: 99999,
  width: 56, height: 56, borderRadius: '50%', border: 'none',
  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
};

const PANEL_STYLE = { position: 'fixed', bottom: 16, right: 16, zIndex: 99999 };

const SUGGESTIONS = [
  { label: 'What is CICR?', q: 'What is CICR and what does this platform do?' },
  { label: 'Dashboard overview', q: 'Give me an overview of the dashboard' },
  { label: 'Start a project', q: 'How do I create a new project?' },
  { label: 'Browse inventory', q: 'What is the inventory section?' },
  { label: 'Learning tracks', q: 'What learning tracks are available?' },
  { label: 'Programs & contests', q: 'Explain programs hub — quests, badges, contests' },
  { label: 'Upcoming events', q: 'What events are coming up?' },
  { label: 'All features', q: 'List every feature on CICR Connect with links' },
];

/* lightweight markdown → html */
function md(text) {
  if (!text) return '';
  let s = text;
  s = s.replace(/```(\w*)\n([\s\S]*?)```/g, '<pre class="cb-code"><code>$2</code></pre>');
  s = s.replace(/`([^`]+)`/g, '<code class="cb-inline-code">$1</code>');
  s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '<em>$1</em>');
  s = s.replace(/^\d+\.\s+(.+)$/gm, '<li class="cb-oli">$1</li>');
  s = s.replace(/^[-•]\s+(.+)$/gm, '<li class="cb-li">$1</li>');
  s = s.replace(/(<li class="cb-(?:li|oli)">[\s\S]*?<\/li>(?:\n|<br\/?>)?)+/g, (m) => `<ul class="cb-list">${m}</ul>`);
  s = s.replace(/\n/g, '<br/>');
  return s;
}

/* ── Typewriter component ── */
function Typewriter({ text, speed = 12, onDone }) {
  const [displayed, setDisplayed] = useState('');
  const idx = useRef(0);
  const full = useRef(text);

  useEffect(() => {
    full.current = text;
    idx.current = 0;
    setDisplayed('');
    const timer = setInterval(() => {
      idx.current += 1;
      const chunk = full.current.slice(0, idx.current);
      setDisplayed(chunk);
      if (idx.current >= full.current.length) {
        clearInterval(timer);
        if (onDone) onDone();
      }
    }, speed);
    return () => clearInterval(timer);
  }, [text, speed, onDone]);

  return <div className="cb-msg cb-font cb-typewriter" dangerouslySetInnerHTML={{ __html: md(displayed) }} />;
}

export default function GlowingChatbot() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [typing, setTyping] = useState(false);
  const [animatingIdx, setAnimatingIdx] = useState(-1);
  const [msgs, setMsgs] = useState([
    { role: 'bot', text: "Hey! I'm your **CICR Connect Assistant** ✨\n\nAsk me anything about CICR — navigate pages, explore features, check stats, or learn how things work.", nav: [], acts: [], done: true },
  ]);
  const endRef = useRef(null);
  const inputRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs, typing, animatingIdx]);
  useEffect(() => { if (open) setTimeout(() => inputRef.current?.focus(), 280); }, [open]);

  const go = useCallback((path) => { if (path) { navigate(path); setOpen(false); } }, [navigate]);

  const send = async (override) => {
    const q = (override || input).trim();
    if (!q || busy) return;
    setMsgs((p) => [...p, { role: 'user', text: q, done: true }]);
    setInput('');
    setBusy(true);
    setTyping(true);
    try {
      const { data } = await askCicrAssistant({ question: q });
      setTyping(false);
      const newIdx = msgs.length + 1; // index of the new bot message
      setAnimatingIdx(newIdx);
      setMsgs((p) => [...p, { role: 'bot', text: data.answer || 'Hmm, I didn\'t get a response. Try rephrasing?', nav: data.navigation || [], acts: data.actions || [], done: false }]);
    } catch (err) {
      setTyping(false);
      setMsgs((p) => [...p, { role: 'bot', text: err.response?.data?.answer || err.response?.data?.message || 'Something went wrong — please try again.', nav: [], acts: [], done: true }]);
    } finally { setBusy(false); }
  };

  const markDone = useCallback((idx) => {
    setMsgs((p) => p.map((m, i) => i === idx ? { ...m, done: true } : m));
    setAnimatingIdx(-1);
  }, []);

  const fresh = msgs.length <= 1 && !busy;

  return createPortal(
    <>
      {/* ── floating icon ── */}
      <AnimatePresence>
        {!open && (
          <motion.button
            initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}
            whileHover={{ scale: 1.08 }}
            onClick={() => setOpen(true)}
            style={FAB_STYLE}
            className="cb-fab"
            aria-label="Open CICR Assistant"
          >
            <span className="cb-wave-wrap">
              <span className="cb-wave cb-wave-1" />
              <span className="cb-wave cb-wave-2" />
            </span>
            <span className="cb-ring" />
            <AiBrainIcon size={28} className="relative z-10 drop-shadow-[0_0_8px_rgba(99,102,241,0.5)]" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* ── chat panel ── */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.97 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            style={PANEL_STYLE}
            className="w-[min(420px,calc(100vw-2rem))] h-[min(640px,calc(100vh-2rem))] flex flex-col rounded-2xl overflow-hidden cb-panel"
          >
            {/* header */}
            <div className="flex items-center gap-3 px-4 py-3 cb-header">
              <div className="w-9 h-9 rounded-xl cb-header-icon flex items-center justify-center">
                <Sparkles size={17} className="text-white" strokeWidth={2.2} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-bold text-white leading-tight cb-font">CICR Assistant</p>
                <p className="text-[10px] cb-header-sub leading-tight cb-font">Only answers CICR-related questions</p>
              </div>
              <button onClick={() => setOpen(false)} className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-white/5 transition-colors" aria-label="Close">
                <X size={16} />
              </button>
            </div>

            {/* messages */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4 cb-scroll">
              {msgs.map((m, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25 }}
                  className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`flex gap-2.5 max-w-[92%] ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
                    {m.role === 'bot' && (
                      <div className="w-7 h-7 rounded-lg cb-avatar flex items-center justify-center shrink-0 mt-0.5">
                        <Sparkles size={13} className="text-indigo-300" strokeWidth={2.4} />
                      </div>
                    )}
                    <div className="space-y-2">
                      <div className={m.role === 'bot' ? 'cb-bubble-bot' : 'cb-bubble-user'}>
                        {m.role === 'bot' && !m.done && i === animatingIdx ? (
                          <Typewriter text={m.text} speed={10} onDone={() => markDone(i)} />
                        ) : (
                          <div className="cb-msg cb-font" dangerouslySetInnerHTML={{ __html: md(m.text) }} />
                        )}
                      </div>
                      {m.done && m.nav?.length > 0 && (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }} className="flex flex-wrap gap-1">
                          {m.nav.map((n, j) => (
                            <button key={j} onClick={() => go(n.path)} className="cb-chip cb-chip-link cb-font">
                              <ExternalLink size={9} /> {n.label}
                            </button>
                          ))}
                        </motion.div>
                      )}
                      {m.done && m.acts?.length > 0 && (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} className="flex flex-wrap gap-1">
                          {m.acts.map((a, j) => (
                            <button key={j} onClick={() => go(a.navigateTo)} className="cb-chip cb-chip-action cb-font">
                              <Zap size={9} /> {a.action}
                            </button>
                          ))}
                        </motion.div>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}

              {typing && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg cb-avatar flex items-center justify-center">
                    <Sparkles size={13} className="text-indigo-300 animate-pulse" strokeWidth={2.4} />
                  </div>
                  <div className="cb-bubble-bot">
                    <span className="flex gap-1.5 items-center py-1 px-1">
                      <span className="cb-dot" style={{ animationDelay: '0ms' }} />
                      <span className="cb-dot" style={{ animationDelay: '160ms' }} />
                      <span className="cb-dot" style={{ animationDelay: '320ms' }} />
                    </span>
                  </div>
                </motion.div>
              )}

              {fresh && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.25 }} className="pt-1 space-y-2">
                  <p className="text-[9px] uppercase tracking-[0.14em] text-gray-600 font-bold px-0.5 cb-font">Try asking</p>
                  <div className="flex flex-wrap gap-1.5">
                    {SUGGESTIONS.map((s, i) => (
                      <button key={i} onClick={() => send(s.q)} className="cb-chip cb-chip-sug cb-font">{s.label}</button>
                    ))}
                  </div>
                </motion.div>
              )}
              <div ref={endRef} />
            </div>

            {/* input */}
            <form onSubmit={(e) => { e.preventDefault(); send(); }} className="flex items-center gap-2 px-3 py-3 cb-input-bar">
              <input
                ref={inputRef} value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about CICR…"
                disabled={busy}
                className="flex-1 bg-transparent border-0 outline-none text-[13px] text-white placeholder-gray-600 cb-font disabled:opacity-40"
              />
              <button type="submit" disabled={busy || !input.trim()} className="cb-send-btn" aria-label="Send">
                {busy ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </>,
    document.body
  );
}
