import { useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, MessageCircle, Send, Trash2, UserRound } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  createCommunicationMessage,
  createCommunicationStream,
  deleteCommunicationMessage,
  fetchCommunicationMessages,
  fetchMentionCandidates,
} from '../api';

const fmtDayDateTime = (d) =>
  new Date(d).toLocaleString([], { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

const decorateMentions = (text) =>
  text.split(/(@[a-zA-Z0-9._-]{3,40})/g).map((part, idx) =>
    part.startsWith('@') ? (
      <span key={idx} className="text-blue-400 font-semibold">{part}</span>
    ) : (
      <span key={idx}>{part}</span>
    )
  );

const userColor = (seed) => {
  const raw = String(seed || 'member');
  let hash = 0;
  for (let i = 0; i < raw.length; i += 1) hash = raw.charCodeAt(i) + ((hash << 5) - hash);
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue} 80% 65%)`;
};

const markCommunicationRead = (timestamp = Date.now()) => {
  localStorage.setItem('communication_last_seen_at', String(timestamp));
  window.dispatchEvent(new Event('communication-read-updated'));
};

export default function Communication() {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [deletingId, setDeletingId] = useState('');
  const [text, setText] = useState('');
  const [mentionOptions, setMentionOptions] = useState([]);
  const [serverError, setServerError] = useState('');
  const [replyTarget, setReplyTarget] = useState(null);
  const endRef = useRef(null);
  const swipeStartXRef = useRef({});

  const profile = JSON.parse(localStorage.getItem('profile') || '{}');
  const user = profile.result || profile;
  const currentUserId = user?._id || '';
  const currentRole = String(user?.role || '').toLowerCase();
  const canSend = Boolean(localStorage.getItem('token'));
  const canModerate = currentRole === 'admin' || currentRole === 'head';

  const sortedMessages = useMemo(
    () => [...messages].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)),
    [messages]
  );

  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await fetchCommunicationMessages(120);
        const normalized = Array.isArray(data) ? data : [];
        setMessages(normalized);
        const latest = normalized[normalized.length - 1];
        markCommunicationRead(latest?.createdAt ? new Date(latest.createdAt).getTime() : Date.now());
        setServerError('');
      } catch (err) {
        const status = err?.response?.status;
        if (status === 404) {
          setServerError('Communication API is not available on backend yet. Restart/deploy backend with latest routes.');
        } else {
          setServerError(err?.response?.data?.message || 'Failed to load communication stream.');
        }
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [sortedMessages.length]);

  useEffect(() => {
    markCommunicationRead();
  }, []);

  useEffect(() => {
    const es = createCommunicationStream();
    const handler = (evt) => {
      try {
        const payload = JSON.parse(evt.data);
        setMessages((prev) => {
          if (prev.some((m) => m._id === payload._id)) return prev;
          markCommunicationRead(payload?.createdAt ? new Date(payload.createdAt).getTime() : Date.now());
          return [...prev, payload];
        });
      } catch {
        // ignore parse errors
      }
    };
    const deleteHandler = (evt) => {
      try {
        const payload = JSON.parse(evt.data);
        setMessages((prev) => prev.filter((m) => m._id !== payload._id));
      } catch {
        // ignore parse errors
      }
    };
    es.addEventListener('new-message', handler);
    es.addEventListener('delete-message', deleteHandler);
    es.onerror = () => {
      // Keep UI stable; SSE reconnect is automatic.
    };
    return () => es.close();
  }, []);

  useEffect(() => {
    const match = text.match(/@([a-zA-Z0-9._-]{1,40})$/);
    const query = match?.[1] || '';
    if (!query) {
      setMentionOptions([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const { data } = await fetchMentionCandidates(query);
        setMentionOptions(Array.isArray(data) ? data : []);
      } catch {
        setMentionOptions([]);
      }
    }, 180);
    return () => clearTimeout(timer);
  }, [text]);

  const replaceCurrentMention = (collegeId) => {
    setText((prev) => prev.replace(/@([a-zA-Z0-9._-]{1,40})$/, `@${collegeId} `));
    setMentionOptions([]);
  };

  const send = async (e) => {
    e.preventDefault();
    if (!canSend) return;
    const body = text.trim();
    if (!body) return;
    setSending(true);
    try {
      const { data } = await createCommunicationMessage({
        text: body,
        replyToId: replyTarget?._id,
      });
      setMessages((prev) => (prev.some((m) => m._id === data._id) ? prev : [...prev, data]));
      markCommunicationRead(data?.createdAt ? new Date(data.createdAt).getTime() : Date.now());
      setText('');
      setReplyTarget(null);
      setMentionOptions([]);
    } catch (err) {
      alert(err.response?.data?.message || 'Unable to send message');
    } finally {
      setSending(false);
    }
  };

  const removeMessage = async (id) => {
    setDeletingId(id);
    try {
      await deleteCommunicationMessage(id);
      setMessages((prev) => prev.filter((m) => m._id !== id));
    } catch (err) {
      if (err?.response?.status === 404) {
        // If already removed/expired, sync UI instead of blocking user with a hard error.
        setMessages((prev) => prev.filter((m) => m._id !== id));
      } else {
        alert(err.response?.data?.message || 'Unable to delete message');
      }
    } finally {
      setDeletingId('');
    }
  };

  const onBubbleTouchStart = (id, e) => {
    swipeStartXRef.current[id] = e.changedTouches?.[0]?.clientX || 0;
  };

  const onBubbleTouchEnd = (msg, e) => {
    const start = swipeStartXRef.current[msg._id] || 0;
    const end = e.changedTouches?.[0]?.clientX || 0;
    const delta = end - start;
    if (delta > 55) {
      setReplyTarget(msg);
    }
  };

  const onInputKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send(e);
    }
  };

  return (
    <div className="max-w-5xl mx-auto pb-4 md:pb-8">
      <section className="px-1 py-2 md:py-3">
        <p className="text-xs uppercase tracking-widest text-blue-400 font-black">Collab Stream</p>
        {/* <h1 className="text-2xl md:text-3xl font-black text-white mt-2"></h1> */}
        <p className="text-gray-400 text-sm mt-2">Live team chat. Messages auto-expire after 3 days.</p>
      </section>

      <section className="flex flex-col h-[calc(100vh-190px)] md:h-[calc(100vh-180px)] min-h-[460px]">
        <h2 className="text-sm md:text-base font-black text-white inline-flex items-center gap-2 px-1">
          <MessageCircle size={16} className="text-amber-400" /> Conversation
        </h2>
        {serverError && (
          <div className="mt-3 bg-red-500/10 border border-red-500/30 text-red-300 text-xs md:text-sm rounded-xl p-3">
            {serverError}
          </div>
        )}
        {loading ? (
          <div className="h-32 flex items-center justify-center flex-1">
            <Loader2 className="animate-spin text-blue-500" />
          </div>
        ) : (
          <div className="mt-3 flex-1 min-h-0 overflow-y-auto pr-0.5 space-y-2.5 md:space-y-3">
            {sortedMessages.length === 0 && <p className="text-sm text-gray-500">No messages yet.</p>}
            <AnimatePresence initial={false}>
              {sortedMessages.map((m) => (
                <motion.div
                  key={m._id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className={`flex ${String(m.sender?._id) === String(currentUserId) ? 'justify-end' : 'justify-start'}`}
                >
                  <motion.div
                    whileHover={{ y: -1 }}
                    onTouchStart={(e) => onBubbleTouchStart(m._id, e)}
                    onTouchEnd={(e) => onBubbleTouchEnd(m, e)}
                    className={`max-w-[94%] sm:max-w-[88%] md:max-w-[72%] rounded-2xl px-3 py-2.5 md:p-4 border shadow-sm ${
                      String(m.sender?._id) === String(currentUserId)
                        ? 'bg-blue-600/14 border-blue-500/25'
                        : m.sender?.isAI
                        ? 'bg-emerald-600/10 border-emerald-500/25'
                        : 'bg-[#111217] border-gray-700/70'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-1.5 sm:gap-2 md:gap-3">
                      <p className="text-xs md:text-sm text-gray-100 inline-flex items-center gap-1 min-w-0">
                        <UserRound size={13} className={`${m.sender?.isAI ? 'text-emerald-400' : 'text-blue-400'} shrink-0 mt-[1px]`} />
                        <span className="font-semibold break-all" style={{ color: userColor(m.sender?.collegeId || m.sender?.name) }}>
                          {m.sender?.name || 'Member'}
                        </span>
                        <span className="text-gray-500 break-all truncate">@{m.sender?.collegeId || 'N/A'}</span>
                      </p>
                      <div className="flex items-center gap-1.5 md:gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => setReplyTarget(m)}
                          className="text-[10px] md:text-xs text-gray-500 hover:text-blue-400"
                          title="Reply"
                        >
                          Reply
                        </button>
                        <p className="text-[10px] md:text-xs text-gray-500">{fmtDayDateTime(m.createdAt)}</p>
                        {(canModerate ||
                          String(m.sender?._id) === String(currentUserId) ||
                          (m.sender?.isAI && String(m.replyTo?.senderCollegeId || '') === String(user?.collegeId || ''))) && (
                          <button
                            type="button"
                            onClick={() => removeMessage(m._id)}
                            disabled={deletingId === m._id}
                            className="text-gray-500 hover:text-red-400 disabled:opacity-50"
                            title="Delete message"
                          >
                            {deletingId === m._id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                          </button>
                        )}
                      </div>
                    </div>
                    {m.replyTo?.text && (
                      <div className="mt-2 rounded-xl border border-gray-700/70 bg-black/25 px-2.5 py-1.5">
                        <p className="text-[10px] text-blue-300 font-semibold">
                          Reply to {m.replyTo.senderName} @{m.replyTo.senderCollegeId}
                        </p>
                        <p className="text-xs text-gray-400 line-clamp-2">{m.replyTo.text}</p>
                      </div>
                    )}
                    <p className="text-sm md:text-[15px] text-gray-200 mt-1.5 md:mt-2 break-words">{decorateMentions(m.text)}</p>
                  </motion.div>
                </motion.div>
              ))}
            </AnimatePresence>
            <div ref={endRef} />
          </div>
        )}

        <div className="mt-2.5 md:mt-3 pt-2.5 border-t border-gray-800 sticky bottom-0 bg-[#0a0a0c]">
          <form onSubmit={send} className="space-y-2">
            {replyTarget && (
              <div className="bg-blue-600/10 border border-blue-500/30 rounded-xl px-3 py-2 flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] text-blue-300 font-semibold">
                    Replying to {replyTarget.sender?.name || 'Member'} @{replyTarget.sender?.collegeId || 'N/A'}
                  </p>
                  <p className="text-xs text-gray-300 line-clamp-2">{replyTarget.text}</p>
                </div>
                <button
                  type="button"
                  className="text-xs text-gray-400 hover:text-white"
                  onClick={() => setReplyTarget(null)}
                >
                  Cancel
                </button>
              </div>
            )}
            {mentionOptions.length > 0 && (
              <div className="bg-[#0a0a0c] border border-gray-800 rounded-xl p-2 max-h-32 md:max-h-36 overflow-auto">
                {mentionOptions.map((u) => (
                  <button
                    key={u._id}
                    type="button"
                    onClick={() => replaceCurrentMention(u.collegeId)}
                    className="w-full text-left px-3 py-2 rounded-lg hover:bg-gray-800 text-xs md:text-sm"
                  >
                    <span className="text-white">{u.name}</span>
                    <span className="text-gray-500 ml-2">@{u.collegeId}</span>
                  </button>
                ))}
              </div>
            )}
            <div className="flex items-end gap-2">
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={onInputKeyDown}
                rows={1}
                placeholder={canSend ? 'Type a message... use @collegeId to tag' : 'Sign in to send messages'}
                disabled={!canSend || sending}
                className="flex-1 resize-none bg-[#0f1015] border border-gray-700/80 rounded-2xl px-3 py-2.5 md:p-3 text-sm md:text-base text-white outline-none focus:border-blue-500 disabled:opacity-60 min-h-[42px] max-h-28 md:max-h-32 overflow-y-auto"
              />
              <button
                disabled={!canSend || sending}
                className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white px-3.5 md:px-4 py-2.5 md:py-3 rounded-xl text-sm font-bold shrink-0 shadow-lg shadow-blue-600/25"
              >
                {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              </button>
            </div>
          </form>
        </div>
      </section>
    </div>
  );
}
