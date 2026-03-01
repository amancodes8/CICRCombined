import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDown,
  Bot,
  Circle,
  CornerUpLeft,
  Loader2,
  MessageCircle,
  Send,
  Trash2,
  X,
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  createCommunicationMessage,
  createCommunicationStream,
  deleteCommunicationMessage,
  fetchCommunicationMessages,
  fetchMentionCandidates,
} from '../api';
import PageHeader from '../components/PageHeader';

const COMMUNICATION_CONVERSATION_ID = 'admin-stream';
const getCommunicationSeenKey = (conversationId = COMMUNICATION_CONVERSATION_ID) =>
  `communication_last_seen_at_${conversationId}`;

const dayKey = (value) => {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return 'unknown';
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
};

const timeLabel = (value) => {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '--:--';
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const dayLabel = (value) => {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return 'Unknown date';

  const now = new Date();
  const yesterday = new Date();
  yesterday.setDate(now.getDate() - 1);

  const isSame = (a, b) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

  if (isSame(d, now)) return 'Today';
  if (isSame(d, yesterday)) return 'Yesterday';
  return d.toLocaleDateString([], { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
};

const decorateMentions = (text) =>
  String(text || '')
    .split(/(@[a-zA-Z0-9._-]{3,40})/g)
    .map((part, idx) =>
      part.startsWith('@') ? (
        <span key={idx} className="text-blue-300 font-semibold">
          {part}
        </span>
      ) : (
        <span key={idx}>{part}</span>
      )
    );

const userColor = (seed) => {
  const raw = String(seed || 'member');
  let hash = 0;
  for (let i = 0; i < raw.length; i += 1) hash = raw.charCodeAt(i) + ((hash << 5) - hash);
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue} 76% 68%)`;
};

const userInitials = (name) => {
  const parts = String(name || '').trim().split(/\s+/);
  if (parts.length === 0 || !parts[0]) return '?';
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

const fullTimestamp = (value) => {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString([], {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const isGroupedMessage = (current, previous) => {
  if (!current || !previous) return false;
  if (String(current?.sender?._id || '') !== String(previous?.sender?._id || '')) return false;
  if (Boolean(current?.sender?.isAI) !== Boolean(previous?.sender?.isAI)) return false;
  if (dayKey(current.createdAt) !== dayKey(previous.createdAt)) return false;

  const currentTs = new Date(current.createdAt).getTime();
  const previousTs = new Date(previous.createdAt).getTime();
  if (!Number.isFinite(currentTs) || !Number.isFinite(previousTs)) return false;
  return currentTs - previousTs <= 5 * 60 * 1000;
};

const markCommunicationRead = (timestamp = Date.now(), conversationId = COMMUNICATION_CONVERSATION_ID) => {
  localStorage.setItem(getCommunicationSeenKey(conversationId), String(timestamp));
  localStorage.setItem('communication_last_seen_at', String(timestamp));
  window.dispatchEvent(new Event('communication-read-updated'));
};

const dispatchToast = (message, type = 'info') => {
  try {
    window.dispatchEvent(new CustomEvent('app:toast', { detail: { message, type } }));
  } catch {
    window.alert(message);
  }
};

export default function Communication() {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState('');
  const [loadingMore, setLoadingMore] = useState(false);
  const [sending, setSending] = useState(false);
  const [deletingId, setDeletingId] = useState('');
  const [text, setText] = useState('');
  const [mentionOptions, setMentionOptions] = useState([]);
  const [serverError, setServerError] = useState('');
  const [replyTarget, setReplyTarget] = useState(null);
  const [actionError, setActionError] = useState('');
  const [showScrollDown, setShowScrollDown] = useState(false);
  const [newMsgCount, setNewMsgCount] = useState(0);

  const endRef = useRef(null);
  const scrollContainerRef = useRef(null);
  const prependScrollSnapshotRef = useRef(null);
  const swipeStartXRef = useRef({});

  const profile = JSON.parse(localStorage.getItem('profile') || '{}');
  const user = profile.result || profile;
  const currentUserId = user?._id || '';
  const currentRole = String(user?.role || '').toLowerCase();
  const canSend = Boolean(localStorage.getItem('token'));
  const canModerate = currentRole === 'admin' || currentRole === 'head';

  const isNearBottom = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return true;
    return el.scrollHeight - el.scrollTop - el.clientHeight < 120;
  }, []);

  const scrollToBottom = useCallback(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
    setShowScrollDown(false);
    setNewMsgCount(0);
  }, []);

  const sortedMessages = useMemo(
    () => [...messages].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)),
    [messages]
  );

  const streamStats = useMemo(() => {
    const uniqueUsers = new Set(
      sortedMessages
        .map((row) => String(row?.sender?._id || ''))
        .filter(Boolean)
    );

    return {
      totalMessages: sortedMessages.length,
      participants: uniqueUsers.size,
    };
  }, [sortedMessages]);

  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await fetchCommunicationMessages({
          limit: 80,
          conversationId: COMMUNICATION_CONVERSATION_ID,
        });

        const normalized = Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : [];
        setMessages(normalized);
        setHasMore(Boolean(data?.hasMore));
        setNextCursor(String(data?.nextCursor || ''));

        const latest = normalized[normalized.length - 1];
        markCommunicationRead(
          latest?.createdAt ? new Date(latest.createdAt).getTime() : Date.now(),
          COMMUNICATION_CONVERSATION_ID
        );
        setServerError('');
      } catch (err) {
        const status = err?.response?.status;
        if (status === 404) {
          setServerError('Communication API is not available on backend yet. Deploy latest backend routes.');
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
    const container = scrollContainerRef.current;
    if (container && prependScrollSnapshotRef.current !== null) {
      const previousHeight = prependScrollSnapshotRef.current;
      prependScrollSnapshotRef.current = null;
      const nextHeight = container.scrollHeight;
      container.scrollTop += nextHeight - previousHeight;
      return;
    }

    if (isNearBottom()) {
      endRef.current?.scrollIntoView({ behavior: 'smooth' });
      setNewMsgCount(0);
    } else {
      setNewMsgCount((c) => c + 1);
      setShowScrollDown(true);
    }
  }, [sortedMessages.length, isNearBottom]);

  useEffect(() => {
    markCommunicationRead(Date.now(), COMMUNICATION_CONVERSATION_ID);
  }, []);

  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return undefined;
    const handleScroll = () => {
      const near = isNearBottom();
      setShowScrollDown(!near);
      if (near) setNewMsgCount(0);
    };
    el.addEventListener('scroll', handleScroll, { passive: true });
    return () => el.removeEventListener('scroll', handleScroll);
  }, [isNearBottom]);

  useEffect(() => {
    if (!actionError) return undefined;
    const timer = setTimeout(() => setActionError(''), 4200);
    return () => clearTimeout(timer);
  }, [actionError]);

  useEffect(() => {
    const es = createCommunicationStream(COMMUNICATION_CONVERSATION_ID);

    const handler = (evt) => {
      try {
        const payload = JSON.parse(evt.data);
        if (payload?.conversationId && payload.conversationId !== COMMUNICATION_CONVERSATION_ID) return;

        setMessages((prev) => {
          if (prev.some((m) => m._id === payload._id)) return prev;
          markCommunicationRead(
            payload?.createdAt ? new Date(payload.createdAt).getTime() : Date.now(),
            COMMUNICATION_CONVERSATION_ID
          );
          return [...prev, payload];
        });
      } catch {
        // ignore malformed payload
      }
    };

    const deleteHandler = (evt) => {
      try {
        const payload = JSON.parse(evt.data);
        setMessages((prev) => prev.filter((m) => m._id !== payload._id));
      } catch {
        // ignore malformed payload
      }
    };

    es.addEventListener('new-message', handler);
    es.addEventListener('delete-message', deleteHandler);
    es.onerror = () => {
      // SSE reconnect is automatic.
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

  const loadOlderMessages = async () => {
    if (!hasMore || loadingMore || !nextCursor) return;

    const scrollContainer = scrollContainerRef.current;
    if (scrollContainer) {
      prependScrollSnapshotRef.current = scrollContainer.scrollHeight;
    }

    setLoadingMore(true);
    try {
      const { data } = await fetchCommunicationMessages({
        limit: 80,
        before: nextCursor,
        conversationId: COMMUNICATION_CONVERSATION_ID,
      });

      const rows = Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : [];
      setMessages((prev) => {
        const existing = new Set(prev.map((row) => String(row._id)));
        const olderRows = rows.filter((row) => !existing.has(String(row._id)));
        return [...olderRows, ...prev];
      });
      setHasMore(Boolean(data?.hasMore));
      setNextCursor(String(data?.nextCursor || ''));
    } catch (err) {
      setActionError(err?.response?.data?.message || 'Unable to load older messages');
      prependScrollSnapshotRef.current = null;
    } finally {
      setLoadingMore(false);
    }
  };

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
        conversationId: COMMUNICATION_CONVERSATION_ID,
      });

      setMessages((prev) => (prev.some((m) => m._id === data._id) ? prev : [...prev, data]));
      markCommunicationRead(
        data?.createdAt ? new Date(data.createdAt).getTime() : Date.now(),
        COMMUNICATION_CONVERSATION_ID
      );

      setText('');
      setReplyTarget(null);
      setMentionOptions([]);
      setActionError('');
    } catch (err) {
      setActionError(err.response?.data?.message || 'Unable to send message');
    } finally {
      setSending(false);
    }
  };

  const removeMessage = async (id) => {
    setDeletingId(id);
    try {
      await deleteCommunicationMessage(id);
      setMessages((prev) => prev.filter((m) => m._id !== id));
      dispatchToast('Message deleted.', 'success');
    } catch (err) {
      if (err?.response?.status === 404) {
        setMessages((prev) => prev.filter((m) => m._id !== id));
      } else {
        setActionError(err.response?.data?.message || 'Unable to delete message');
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
    if (end - start > 55) {
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
    <div className="ui-page max-w-5xl pb-4 md:pb-8 page-motion-d">
      <section className="px-1 py-2 md:py-3 section-motion section-motion-delay-1">
        <PageHeader
          eyebrow="Collab Stream"
          title="Admin Conversation Hub"
          subtitle="Operational team chat with live sync, mentions, and moderation controls."
          icon={MessageCircle}
          badge={
            <>
              <Circle size={8} className="text-emerald-300 fill-emerald-300" /> Live Stream
            </>
          }
        />
      </section>

      <section className="grid grid-cols-2 gap-3 section-motion section-motion-delay-2">
        <Metric label="Messages" value={streamStats.totalMessages} hint="Conversation volume" />
        <Metric label="Participants" value={streamStats.participants} hint="Active contributors" tone="blue" />
      </section>

      <section className="mt-4 flex flex-col h-[calc(100vh-250px)] md:h-[calc(100vh-235px)] min-h-[480px] section-motion section-motion-delay-2 border border-gray-800/80 rounded-2xl overflow-hidden">
        <header className="px-4 py-3 border-b border-gray-800/80 flex items-center justify-between gap-3">
          <h2 className="text-sm md:text-base font-semibold text-white inline-flex items-center gap-2">
            <MessageCircle size={16} className="text-cyan-300" /> Conversation
          </h2>
          <p className="text-xs text-gray-500">Swipe right on mobile to reply</p>
        </header>

        {serverError ? (
          <div className="mx-4 mt-3 rounded-xl border border-red-500/35 bg-red-500/10 px-3 py-2 text-xs text-red-200">
            {serverError}
          </div>
        ) : null}

        {loading ? (
          <div className="h-32 flex items-center justify-center flex-1">
            <Loader2 className="animate-spin text-blue-500" />
          </div>
        ) : (
          <div
            ref={scrollContainerRef}
            className="mt-2 flex-1 min-h-0 overflow-y-auto px-2 md:px-3 space-y-1.5"
          >
            {hasMore ? (
              <div className="flex justify-center py-2">
                <button
                  type="button"
                  onClick={loadOlderMessages}
                  disabled={loadingMore}
                  className="btn btn-ghost !w-auto !px-3 !py-1.5"
                >
                  {loadingMore ? <Loader2 size={12} className="animate-spin" /> : null}
                  {loadingMore ? 'Loading older...' : 'Load older messages'}
                </button>
              </div>
            ) : null}

            {sortedMessages.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                <div className="w-14 h-14 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mb-4">
                  <MessageCircle size={24} className="text-blue-400" />
                </div>
                <p className="text-sm font-semibold text-gray-300">No messages yet</p>
                <p className="text-xs text-gray-500 mt-1 max-w-xs">
                  Start the conversation! Use @collegeId to mention team members or @cicrai for AI assistance.
                </p>
              </div>
            ) : null}

            <AnimatePresence initial={false}>
              {sortedMessages.map((message, index) => {
                const previous = sortedMessages[index - 1];
                const grouped = isGroupedMessage(message, previous);
                const own = String(message.sender?._id) === String(currentUserId);
                const showDayDivider = dayKey(message.createdAt) !== dayKey(previous?.createdAt);
                const canDelete =
                  canModerate ||
                  own ||
                  (message.sender?.isAI &&
                    String(message.replyTo?.senderCollegeId || '') === String(user?.collegeId || ''));
                const senderColor = userColor(message.sender?.collegeId || message.sender?.name);

                return (
                  <div key={message._id}>
                    {showDayDivider ? (
                      <div className="py-3 flex items-center justify-center">
                        <span className="text-[11px] uppercase tracking-[0.14em] text-gray-500 border border-gray-800/70 rounded-full px-3 py-1">
                          {dayLabel(message.createdAt)}
                        </span>
                      </div>
                    ) : null}

                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className={`flex ${own ? 'justify-end' : 'justify-start'} ${grouped ? 'mt-1' : 'mt-2.5'}`}
                    >
                      <div className={`flex gap-2 max-w-[94%] sm:max-w-[88%] md:max-w-[74%] ${own ? 'flex-row-reverse' : ''}`}>
                        {!grouped ? (
                          <div
                            className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-[11px] font-bold mt-0.5 ${
                              message.sender?.isAI
                                ? 'bg-emerald-500/20 border border-emerald-500/30'
                                : 'border border-gray-700/80'
                            }`}
                            style={
                              message.sender?.isAI
                                ? undefined
                                : { backgroundColor: `${senderColor}22`, color: senderColor }
                            }
                          >
                            {message.sender?.isAI ? (
                              <Bot size={14} className="text-emerald-400" />
                            ) : (
                              userInitials(message.sender?.name)
                            )}
                          </div>
                        ) : (
                          <div className="w-7 shrink-0" />
                        )}

                        <motion.article
                          whileHover={{ y: -1 }}
                          onTouchStart={(e) => onBubbleTouchStart(message._id, e)}
                          onTouchEnd={(e) => onBubbleTouchEnd(message, e)}
                          className={`group flex-1 min-w-0 rounded-2xl px-3 py-2.5 border ${
                            own
                              ? 'bg-blue-600/14 border-blue-500/25'
                              : message.sender?.isAI
                              ? 'bg-emerald-600/10 border-emerald-500/25'
                              : 'bg-[#0f1218] border-gray-700/75'
                          }`}
                        >
                          {!grouped ? (
                            <div className="flex items-start justify-between gap-2">
                              <p className="text-xs text-gray-100 inline-flex items-center gap-1.5 min-w-0">
                                {message.sender?.isAI ? (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 border border-emerald-500/25 rounded-full px-1.5 py-0.5">
                                    <Bot size={10} /> AI
                                  </span>
                                ) : null}
                                <span
                                  className="font-semibold break-all"
                                  style={{ color: senderColor }}
                                >
                                  {message.sender?.name || 'Member'}
                                </span>
                                <span className="text-gray-500 truncate">@{message.sender?.collegeId || 'N/A'}</span>
                              </p>

                              <div className="flex items-center gap-1.5 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => setReplyTarget(message)}
                                  className="opacity-90 md:opacity-0 md:group-hover:opacity-100 transition-opacity text-gray-500 hover:text-blue-300"
                                  title="Reply"
                                >
                                  <CornerUpLeft size={13} />
                                </button>

                                {canDelete ? (
                                  <button
                                    type="button"
                                    onClick={() => removeMessage(message._id)}
                                    disabled={deletingId === message._id}
                                    className="opacity-90 md:opacity-0 md:group-hover:opacity-100 transition-opacity text-gray-500 hover:text-red-400 disabled:opacity-40"
                                    title="Delete"
                                  >
                                    {deletingId === message._id ? (
                                      <Loader2 size={13} className="animate-spin" />
                                    ) : (
                                      <Trash2 size={13} />
                                    )}
                                  </button>
                                ) : null}

                                <p className="text-[10px] text-gray-500" title={fullTimestamp(message.createdAt)}>{timeLabel(message.createdAt)}</p>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center justify-end gap-1.5 mb-1">
                              <button
                                type="button"
                                onClick={() => setReplyTarget(message)}
                                className="text-gray-500 hover:text-blue-300"
                                title="Reply"
                              >
                                <CornerUpLeft size={12} />
                              </button>
                              {canDelete ? (
                                <button
                                  type="button"
                                  onClick={() => removeMessage(message._id)}
                                  disabled={deletingId === message._id}
                                  className="text-gray-500 hover:text-red-400 disabled:opacity-40"
                                  title="Delete"
                                >
                                  {deletingId === message._id ? (
                                    <Loader2 size={12} className="animate-spin" />
                                  ) : (
                                    <Trash2 size={12} />
                                  )}
                                </button>
                              ) : null}
                              <p className="text-[10px] text-gray-500" title={fullTimestamp(message.createdAt)}>{timeLabel(message.createdAt)}</p>
                            </div>
                          )}

                        {message.replyTo?.text ? (
                          <div className="mt-1.5 rounded-xl border border-gray-700/70 bg-black/25 px-2.5 py-1.5">
                            <p className="text-[10px] text-blue-300 font-semibold">
                              Reply to {message.replyTo.senderName} @{message.replyTo.senderCollegeId}
                            </p>
                            <p className="text-xs text-gray-400 line-clamp-2">{message.replyTo.text}</p>
                          </div>
                        ) : null}

                        <p className="text-sm md:text-[15px] text-gray-200 mt-1.5 break-words leading-relaxed">
                          {decorateMentions(message.text)}
                        </p>
                        </motion.article>
                      </div>
                    </motion.div>
                  </div>
                );
              })}
            </AnimatePresence>
            <div ref={endRef} />

            {showScrollDown ? (
              <button
                type="button"
                onClick={scrollToBottom}
                className="sticky bottom-3 left-1/2 -translate-x-1/2 ml-auto mr-auto w-fit flex items-center gap-1.5 bg-blue-600/90 hover:bg-blue-600 border border-blue-400/30 text-white text-xs font-semibold px-3 py-1.5 rounded-full shadow-lg transition-all z-10"
              >
                <ArrowDown size={13} />
                {newMsgCount > 0 ? `${newMsgCount} new` : 'Jump to latest'}
              </button>
            ) : null}
          </div>
        )}

        <footer className="border-t border-gray-800/80 bg-[#070b11] px-3 py-3 md:px-4 md:py-3">
          <form onSubmit={send} className="space-y-2">
            {replyTarget ? (
              <div className="bg-blue-600/10 border border-blue-500/30 rounded-xl px-3 py-2 flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] text-blue-300 font-semibold">
                    Replying to {replyTarget.sender?.name || 'Member'} @{replyTarget.sender?.collegeId || 'N/A'}
                  </p>
                  <p className="text-xs text-gray-300 line-clamp-2">{replyTarget.text}</p>
                </div>
                <button
                  type="button"
                  className="inline-flex items-center justify-center h-7 w-7 rounded-md text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
                  onClick={() => setReplyTarget(null)}
                  title="Cancel reply"
                  aria-label="Cancel reply"
                >
                  <X size={14} />
                </button>
              </div>
            ) : null}

            {actionError ? (
              <div className="bg-red-500/10 border border-red-500/30 text-red-300 text-xs rounded-xl px-3 py-2">
                {actionError}
              </div>
            ) : null}

            {mentionOptions.length > 0 ? (
              <div className="border border-gray-800/80 rounded-xl p-1.5 max-h-36 overflow-auto bg-[#0b1016]">
                {mentionOptions.map((candidate) => (
                  <button
                    key={candidate._id}
                    type="button"
                    onClick={() => replaceCurrentMention(candidate.collegeId)}
                    className="w-full text-left px-2.5 py-2 rounded-lg hover:bg-gray-800/70 text-xs md:text-sm"
                  >
                    <span className="text-white">{candidate.name}</span>
                    <span className="text-gray-500 ml-2">@{candidate.collegeId}</span>
                  </button>
                ))}
              </div>
            ) : null}

            <div className="flex items-end gap-2">
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={onInputKeyDown}
                rows={1}
                placeholder={canSend ? 'Type a message... use @collegeId to mention' : 'Sign in to send messages'}
                disabled={!canSend || sending}
                className="flex-1 resize-none bg-[#0f141b] border border-gray-700/80 rounded-2xl px-3 py-2.5 text-sm md:text-base text-white outline-none focus:border-blue-500 disabled:opacity-60 min-h-[42px] max-h-32 overflow-y-auto"
              />

              <button
                disabled={!canSend || sending}
                className="btn btn-primary !w-auto !px-4 !py-2.5"
                title="Send"
              >
                {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              </button>
            </div>

            <div className="flex items-center justify-between gap-2 text-[11px] text-gray-500 px-1">
              <p>Enter to send, Shift+Enter for newline.</p>
              <p className={text.length > 1900 ? 'text-red-400 font-semibold' : text.length > 1800 ? 'text-amber-300' : text.length > 1500 ? 'text-amber-400/60' : ''}>{text.length}/2000</p>
            </div>
          </form>
        </footer>
      </section>
    </div>
  );
}

function Metric({ label, value, hint, tone = 'slate' }) {
  const toneClass =
    tone === 'blue'
      ? 'border-blue-500/30'
      : tone === 'emerald'
      ? 'border-emerald-500/30'
      : 'border-gray-700/70';

  return (
    <article className={`px-3 py-3 border-y ${toneClass}`}>
      <p className="text-[11px] uppercase tracking-[0.14em] text-gray-500 font-semibold">{label}</p>
      <p className="mt-1 text-2xl font-black text-white">{value}</p>
      <p className="mt-1 text-xs text-gray-500">{hint}</p>
    </article>
  );
}
