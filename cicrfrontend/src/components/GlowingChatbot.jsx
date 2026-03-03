import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Bot, ChevronDown, ExternalLink, Loader2, MessageCircle, Send, Sparkles, X, ArrowRight, Zap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { askCicrAssistant } from '../api';

/* ─── Quick suggestion chips shown at start ─── */
const QUICK_SUGGESTIONS = [
  { label: '📊 Dashboard overview', question: 'What can I see on the dashboard?' },
  { label: '🚀 Create a project', question: 'How do I create a new project?' },
  { label: '📅 Schedule meeting', question: 'How can I schedule a meeting?' },
  { label: '📦 Browse inventory', question: 'Show me the hardware inventory' },
  { label: '🎓 Learning tracks', question: 'What learning resources are available?' },
  { label: '🏆 Programs & quests', question: 'Tell me about programs, quests and badges' },
  { label: '👥 Community feed', question: 'How does the community section work?' },
  { label: '🎪 Upcoming events', question: 'What events are happening?' },
  { label: '🧭 Navigate anywhere', question: 'Show me all pages I can visit' },
];

/* ─── Parse markdown-lite for bot messages ─── */
function parseMessageContent(text) {
  if (!text) return text;
  // Bold
  let parsed = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  // Bullet lists
  parsed = parsed.replace(/^[-•]\s+(.+)$/gm, '<li>$1</li>');
  parsed = parsed.replace(/(<li>.*<\/li>\n?)+/g, (match) => `<ul class="chatbot-list">${match}</ul>`);
  // Line breaks
  parsed = parsed.replace(/\n/g, '<br/>');
  return parsed;
}

export default function GlowingChatbot() {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState([
    {
      role: 'bot',
      text: "Hey! I'm your CICR Connect Assistant ✨\n\nI can help you navigate anywhere, answer questions, find features, and guide you through everything on the platform. Ask me anything!",
      navigation: [],
      actions: [],
    },
  ]);
  const [isTyping, setIsTyping] = useState(false);
  const [pulseCount, setPulseCount] = useState(0);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const navigate = useNavigate();

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [isOpen]);

  // Pulse animation for the floating button
  useEffect(() => {
    const interval = setInterval(() => {
      setPulseCount((prev) => prev + 1);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  const handleNavigate = useCallback(
    (path) => {
      if (!path) return;
      navigate(path);
      setIsOpen(false);
    },
    [navigate]
  );

  const handleSend = async (questionOverride) => {
    const question = (questionOverride || input).trim();
    if (!question || loading) return;

    setMessages((prev) => [...prev, { role: 'user', text: question }]);
    setInput('');
    setLoading(true);
    setIsTyping(true);

    try {
      const { data } = await askCicrAssistant({ question });
      setIsTyping(false);
      setMessages((prev) => [
        ...prev,
        {
          role: 'bot',
          text: data.answer || 'I couldn\'t generate a response. Please try again!',
          navigation: data.navigation || [],
          actions: data.actions || [],
        },
      ]);
    } catch (err) {
      setIsTyping(false);
      setMessages((prev) => [
        ...prev,
        {
          role: 'bot',
          text: err.response?.data?.answer || err.response?.data?.message || 'Something went wrong. Please try again!',
          navigation: [],
          actions: [],
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const showSuggestions = messages.length <= 1 && !loading;

  return (
    <>
      {/* ─── Floating Action Button ─── */}
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setIsOpen(true)}
            className="fixed bottom-6 right-6 z-[100] group"
            aria-label="Open CICR Assistant"
          >
            {/* Outer glow rings */}
            <span className="absolute inset-0 rounded-full bg-gradient-to-r from-blue-500 via-purple-500 to-cyan-500 opacity-60 blur-lg group-hover:opacity-80 transition-opacity duration-500 animate-glow-spin" />
            <span className="absolute -inset-1 rounded-full bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600 opacity-40 blur-xl animate-glow-pulse" />

            {/* Button body */}
            <span className="relative flex items-center justify-center w-14 h-14 rounded-full bg-gradient-to-br from-blue-600 via-blue-700 to-purple-700 shadow-[0_0_30px_rgba(59,130,246,0.5),0_0_60px_rgba(139,92,246,0.3)] border border-blue-400/30">
              <Sparkles size={24} className="text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.6)]" />
            </span>

            {/* Notification dot */}
            <motion.span
              key={pulseCount}
              initial={{ scale: 0.8, opacity: 1 }}
              animate={{ scale: 2, opacity: 0 }}
              transition={{ duration: 1.5, ease: 'easeOut' }}
              className="absolute top-0 right-0 w-3 h-3 rounded-full bg-cyan-400"
            />
            <span className="absolute top-0 right-0 w-3 h-3 rounded-full bg-cyan-400 border-2 border-[#070a0f]" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* ─── Chat Window ─── */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="fixed bottom-4 right-4 z-[100] w-[min(440px,calc(100vw-2rem))] h-[min(680px,calc(100vh-2rem))] flex flex-col rounded-3xl overflow-hidden chatbot-window"
          >
            {/* Animated border glow */}
            <div className="absolute -inset-[1px] rounded-3xl bg-gradient-to-br from-blue-500/50 via-purple-500/30 to-cyan-500/50 animate-glow-border -z-10" />
            <div className="absolute -inset-[2px] rounded-3xl bg-gradient-to-br from-blue-500/20 via-purple-500/10 to-cyan-500/20 blur-md -z-20" />

            {/* ─── Header ─── */}
            <div className="relative px-5 py-4 flex items-center gap-3 border-b border-white/[0.06] bg-gradient-to-r from-[#0c101a] via-[#0f1320] to-[#0c101a]">
              {/* Header glow */}
              <div className="absolute inset-0 bg-gradient-to-r from-blue-600/10 via-purple-600/5 to-cyan-600/10 pointer-events-none" />

              <div className="relative">
                <span className="absolute inset-0 rounded-xl bg-blue-500/30 blur-md animate-glow-pulse" />
                <div className="relative w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-[0_0_20px_rgba(59,130,246,0.4)]">
                  <Bot size={20} className="text-white" />
                </div>
              </div>

              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  CICR Assistant
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-bold uppercase tracking-wider">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Live
                  </span>
                </h3>
                <p className="text-[11px] text-gray-500 truncate">Your one-stop guide to everything CICR</p>
              </div>

              <button
                onClick={() => setIsOpen(false)}
                className="relative p-2 rounded-xl text-gray-400 hover:text-white hover:bg-white/5 transition-all duration-200"
                aria-label="Close assistant"
              >
                <X size={18} />
              </button>
            </div>

            {/* ─── Messages ─── */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 chatbot-messages">
              {messages.map((msg, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: idx === messages.length - 1 ? 0.1 : 0 }}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`flex gap-2.5 max-w-[88%] ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                    {/* Avatar */}
                    {msg.role === 'bot' && (
                      <div className="relative shrink-0 mt-0.5">
                        <span className="absolute inset-0 rounded-lg bg-blue-500/25 blur-sm" />
                        <div className="relative w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500/80 to-purple-600/80 flex items-center justify-center">
                          <Bot size={14} className="text-white" />
                        </div>
                      </div>
                    )}

                    <div className="space-y-2">
                      {/* Message bubble */}
                      <div
                        className={`px-4 py-3 text-[13px] leading-relaxed ${
                          msg.role === 'bot'
                            ? 'bg-[#13161f] border border-white/[0.06] text-gray-200 rounded-2xl rounded-tl-md shadow-[0_2px_12px_rgba(0,0,0,0.3)]'
                            : 'bg-gradient-to-br from-blue-600 to-blue-700 text-white rounded-2xl rounded-tr-md shadow-[0_2px_16px_rgba(59,130,246,0.3)]'
                        }`}
                      >
                        <div
                          className="chatbot-msg-content"
                          dangerouslySetInnerHTML={{ __html: parseMessageContent(msg.text) }}
                        />
                      </div>

                      {/* Navigation links */}
                      {msg.navigation?.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {msg.navigation.map((nav, i) => (
                            <button
                              key={i}
                              onClick={() => handleNavigate(nav.path)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-300 hover:bg-blue-500/20 hover:border-blue-500/40 hover:text-blue-200 transition-all duration-200 hover:shadow-[0_0_12px_rgba(59,130,246,0.2)]"
                            >
                              <ExternalLink size={10} />
                              {nav.label}
                            </button>
                          ))}
                        </div>
                      )}

                      {/* Action buttons */}
                      {msg.actions?.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {msg.actions.map((act, i) => (
                            <button
                              key={i}
                              onClick={() => handleNavigate(act.navigateTo)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-300 hover:bg-purple-500/20 hover:border-purple-500/40 hover:text-purple-200 transition-all duration-200 hover:shadow-[0_0_12px_rgba(139,92,246,0.2)]"
                            >
                              <Zap size={10} />
                              {act.action}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}

              {/* Typing indicator */}
              {isTyping && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-start gap-2.5"
                >
                  <div className="relative shrink-0">
                    <span className="absolute inset-0 rounded-lg bg-blue-500/25 blur-sm animate-pulse" />
                    <div className="relative w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500/80 to-purple-600/80 flex items-center justify-center">
                      <Bot size={14} className="text-white" />
                    </div>
                  </div>
                  <div className="bg-[#13161f] border border-white/[0.06] px-4 py-3 rounded-2xl rounded-tl-md">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-2 h-2 rounded-full bg-purple-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-2 h-2 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Quick suggestions */}
              {showSuggestions && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3, duration: 0.4 }}
                  className="pt-2 space-y-2"
                >
                  <p className="text-[10px] uppercase tracking-widest text-gray-500 font-bold px-1">
                    Quick suggestions
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {QUICK_SUGGESTIONS.map((s, i) => (
                      <motion.button
                        key={i}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.4 + i * 0.05 }}
                        onClick={() => handleSend(s.question)}
                        className="px-3 py-1.5 text-[11px] font-medium rounded-xl bg-white/[0.03] border border-white/[0.06] text-gray-300 hover:bg-white/[0.06] hover:border-blue-500/30 hover:text-blue-200 transition-all duration-200 hover:shadow-[0_0_8px_rgba(59,130,246,0.15)]"
                      >
                        {s.label}
                      </motion.button>
                    ))}
                  </div>
                </motion.div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* ─── Input ─── */}
            <div className="relative px-4 py-3 border-t border-white/[0.06] bg-[#0a0d14]/80 backdrop-blur-sm">
              {/* Input glow line */}
              <div className="absolute top-0 left-4 right-4 h-[1px] bg-gradient-to-r from-transparent via-blue-500/30 to-transparent" />

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSend();
                }}
                className="flex items-center gap-2"
              >
                <div className="flex-1 relative group">
                  <input
                    ref={inputRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Ask anything about CICR..."
                    disabled={loading}
                    className="w-full bg-[#0e1119] border border-white/[0.08] rounded-2xl px-4 py-3 text-[13px] text-white placeholder-gray-500 outline-none transition-all duration-300 focus:border-blue-500/40 focus:shadow-[0_0_16px_rgba(59,130,246,0.15)] disabled:opacity-50"
                  />
                  {/* Input focus glow */}
                  <div className="absolute -inset-[1px] rounded-2xl bg-gradient-to-r from-blue-500/0 via-blue-500/0 to-purple-500/0 opacity-0 group-focus-within:opacity-100 group-focus-within:from-blue-500/20 group-focus-within:via-purple-500/10 group-focus-within:to-cyan-500/20 blur-sm transition-all duration-500 -z-10" />
                </div>

                <button
                  type="submit"
                  disabled={loading || !input.trim()}
                  className="relative p-3 rounded-2xl bg-gradient-to-br from-blue-600 to-purple-700 text-white shadow-[0_0_20px_rgba(59,130,246,0.3)] hover:shadow-[0_0_28px_rgba(59,130,246,0.5)] transition-all duration-300 disabled:opacity-40 disabled:shadow-none active:scale-95"
                >
                  {loading ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : (
                    <Send size={18} />
                  )}
                </button>
              </form>

              <div className="flex items-center justify-center gap-1 mt-2">
                <Sparkles size={8} className="text-gray-600" />
                <p className="text-[9px] text-gray-600 tracking-wider">Powered by Gemini AI • CICR Connect</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
