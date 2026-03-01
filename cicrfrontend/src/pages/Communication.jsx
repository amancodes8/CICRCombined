import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDown,
  Bot,
  Check,
  CheckCheck,
  Circle,
  CornerUpLeft,
  Loader2,
  MessageCircle,
  Send,
  Trash2,
  Users,
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
        <span key={idx} className="text-[#53bdeb] font-semibold">
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

const generateOptimisticId = () => `optimistic-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

export default function Communication() {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState('');
  const [loadingMore, setLoadingMore] = useState(false);
  const [deletingId, setDeletingId] = useState('');
  const [text, setText] = useState('');
  const [mentionOptions, setMentionOptions] = useState([]);
  const [serverError, setServerError] = useState('');
  const [replyTarget, setReplyTarget] = useState(null);
  const [actionError, setActionError] = useState('');
  const [showScrollDown, setShowScrollDown] = useState(false);
  const [newMsgCount, setNewMsgCount] = useState(0);
  const [selectedMsgId, setSelectedMsgId] = useState(null);

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
          const withoutOptimistic = prev.filter((m) => {
            if (!m._optimistic) return true;
            if (m._optimisticText !== payload.text) return true;
            if (String(m.sender?._id) !== String(payload.sender?._id)) return true;
            const optimisticTs = new Date(m.createdAt).getTime();
            const payloadTs = new Date(payload.createdAt).getTime();
            if (Number.isFinite(optimisticTs) && Number.isFinite(payloadTs) && Math.abs(payloadTs - optimisticTs) > 30000) return true;
            return false;
          });
          if (withoutOptimistic.some((m) => m._id === payload._id)) return withoutOptimistic;
          markCommunicationRead(
            payload?.createdAt ? new Date(payload.createdAt).getTime() : Date.now(),
            COMMUNICATION_CONVERSATION_ID
          );
          return [...withoutOptimistic, payload];
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

    const optimisticId = generateOptimisticId();
    const optimisticMsg = {
      _id: optimisticId,
      _optimistic: true,
      _optimisticText: body,
      text: body,
      sender: {
        _id: currentUserId,
        name: user?.name || 'You',
        collegeId: user?.collegeId || '',
        role: user?.role || '',
        isAI: false,
      },
      replyTo: replyTarget ? {
        messageId: replyTarget._id,
        text: String(replyTarget.text || '').slice(0, 180),
        senderName: replyTarget.sender?.name || 'Member',
        senderCollegeId: replyTarget.sender?.collegeId || '',
      } : null,
      mentions: [],
      createdAt: new Date().toISOString(),
      conversationId: COMMUNICATION_CONVERSATION_ID,
    };

    setMessages((prev) => [...prev, optimisticMsg]);
    setText('');
    setReplyTarget(null);
    setMentionOptions([]);
    setActionError('');

    try {
      const { data } = await createCommunicationMessage({
        text: body,
        replyToId: replyTarget?._id,
        conversationId: COMMUNICATION_CONVERSATION_ID,
      });

      setMessages((prev) => {
        const withoutOptimistic = prev.filter((m) => m._id !== optimisticId);
        if (withoutOptimistic.some((m) => m._id === data._id)) return withoutOptimistic;
        return [...withoutOptimistic, data];
      });
      markCommunicationRead(
        data?.createdAt ? new Date(data.createdAt).getTime() : Date.now(),
        COMMUNICATION_CONVERSATION_ID
      );
    } catch (err) {
      setMessages((prev) => prev.filter((m) => m._id !== optimisticId));
      setActionError(err.response?.data?.message || 'Unable to send message');
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
    <div className="wa-chat-page">
      <header className="wa-chat-header">
        <div className="wa-chat-header-left">
          <div className="wa-chat-avatar-group">
            <MessageCircle size={20} />
          </div>
          <div>
            <h1 className="wa-chat-title">Admin Conversation Hub</h1>
            <p className="wa-chat-subtitle">
              <Circle size={6} className="wa-live-dot" />
              <span>{streamStats.participants} participant{streamStats.participants !== 1 ? 's' : ''}</span>
              <span className="wa-chat-dot">·</span>
              <span>{streamStats.totalMessages} message{streamStats.totalMessages !== 1 ? 's' : ''}</span>
            </p>
          </div>
        </div>
        <div className="wa-chat-header-right">
          <Users size={18} className="wa-header-icon" />
        </div>
      </header>

      {serverError ? (
        <div className="wa-error-banner">
          {serverError}
        </div>
      ) : null}

      {loading ? (
        <div className="wa-chat-loading">
          <div className="wa-loading-spinner">
            <Loader2 size={28} className="animate-spin" />
            <p>Loading messages...</p>
          </div>
        </div>
      ) : (
        <div
          ref={scrollContainerRef}
          className="wa-chat-body"
        >
          {hasMore ? (
            <div className="wa-load-more">
              <button
                type="button"
                onClick={loadOlderMessages}
                disabled={loadingMore}
                className="wa-load-more-btn"
              >
                {loadingMore ? <Loader2 size={14} className="animate-spin" /> : null}
                {loadingMore ? 'Loading...' : 'Load older messages'}
              </button>
            </div>
          ) : null}

          {sortedMessages.length === 0 ? (
            <div className="wa-empty-state">
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 200, damping: 20 }}
                className="wa-empty-icon"
              >
                <MessageCircle size={32} />
              </motion.div>
              <p className="wa-empty-title">No messages yet</p>
              <p className="wa-empty-hint">
                Start the conversation! Use @collegeId to mention team members or @cicrai for AI.
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
              const isOptimistic = Boolean(message._optimistic);
              const isAI = Boolean(message.sender?.isAI);

              return (
                <div key={message._id}>
                  {showDayDivider ? (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="wa-day-divider"
                    >
                      <span className="wa-day-pill">
                        {dayLabel(message.createdAt)}
                      </span>
                    </motion.div>
                  ) : null}

                  <motion.div
                    initial={{ opacity: 0, y: 16, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                    className={`wa-msg-row ${own ? 'wa-msg-own' : 'wa-msg-other'} ${grouped ? 'wa-msg-grouped' : ''}`}
                  >
                    <div className={`wa-bubble-wrap ${own ? 'wa-bubble-wrap-own' : ''}`}>
                      {!own && !grouped ? (
                        <div
                          className={`wa-avatar ${isAI ? 'wa-avatar-ai' : ''}`}
                          style={isAI ? undefined : { backgroundColor: `${senderColor}30`, color: senderColor }}
                        >
                          {isAI ? <Bot size={14} /> : userInitials(message.sender?.name)}
                        </div>
                      ) : !own && grouped ? (
                        <div className="wa-avatar-spacer" />
                      ) : null}

                      <motion.article
                        whileHover={{ scale: 1.005 }}
                        onTouchStart={(e) => onBubbleTouchStart(message._id, e)}
                        onTouchEnd={(e) => onBubbleTouchEnd(message, e)}
                        className={`wa-bubble group ${
                          own
                            ? 'wa-bubble-out'
                            : isAI
                            ? 'wa-bubble-ai'
                            : 'wa-bubble-in'
                        } ${isOptimistic ? 'wa-bubble-sending' : ''} ${!grouped ? 'wa-bubble-tail' : ''}`}
                      >
                        {!grouped && !own ? (
                          <div className="wa-bubble-sender">
                            {isAI ? (
                              <span className="wa-ai-badge">
                                <Bot size={10} /> AI
                              </span>
                            ) : null}
                            <span className="wa-sender-name" style={{ color: senderColor }}>
                              {message.sender?.name || 'Member'}
                            </span>
                            <span className="wa-sender-id">@{message.sender?.collegeId || 'N/A'}</span>
                          </div>
                        ) : null}

                        {message.replyTo?.text ? (
                          <div className={`wa-reply-preview ${own ? 'wa-reply-preview-own' : ''}`}>
                            <p className="wa-reply-name">
                              {message.replyTo.senderName} @{message.replyTo.senderCollegeId}
                            </p>
                            <p className="wa-reply-text">{message.replyTo.text}</p>
                          </div>
                        ) : null}

                        <p className="wa-bubble-text">
                          {decorateMentions(message.text)}
                        </p>

                        <div
                          className="wa-bubble-meta"
                          onClick={() => setSelectedMsgId((prev) => (prev === message._id ? null : message._id))}
                          style={{ cursor: 'pointer' }}
                        >
                          <span className="wa-bubble-time" title={fullTimestamp(message.createdAt)}>
                            {timeLabel(message.createdAt)}
                          </span>
                          {own ? (
                            <span className="wa-bubble-status">
                              {isOptimistic ? (
                                <Check size={12} className="wa-tick-pending" />
                              ) : (
                                <CheckCheck size={12} className="wa-tick-sent" />
                              )}
                            </span>
                          ) : null}
                        </div>

                        <AnimatePresence>
                          {selectedMsgId === message._id ? (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.2 }}
                              className="wa-msg-details"
                            >
                              <p className="wa-msg-detail-row">
                                <span className="wa-msg-detail-label">From</span>
                                <span className="wa-msg-detail-value">{message.sender?.name || 'Member'}{message.sender?.collegeId ? ` (@${message.sender.collegeId})` : ''}</span>
                              </p>
                              {message.sender?.role ? (
                                <p className="wa-msg-detail-row">
                                  <span className="wa-msg-detail-label">Role</span>
                                  <span className="wa-msg-detail-value">{message.sender.role}</span>
                                </p>
                              ) : null}
                              <p className="wa-msg-detail-row">
                                <span className="wa-msg-detail-label">Sent</span>
                                <span className="wa-msg-detail-value">{fullTimestamp(message.createdAt)}</span>
                              </p>
                              <p className="wa-msg-detail-row">
                                <span className="wa-msg-detail-label">Status</span>
                                <span className="wa-msg-detail-value">
                                  {isOptimistic ? (
                                    <span className="wa-detail-status wa-detail-sending"><Check size={10} /> Sending</span>
                                  ) : own ? (
                                    <span className="wa-detail-status wa-detail-delivered"><CheckCheck size={10} /> Delivered</span>
                                  ) : (
                                    <span className="wa-detail-status wa-detail-received"><CheckCheck size={10} /> Received</span>
                                  )}
                                </span>
                              </p>
                            </motion.div>
                          ) : null}
                        </AnimatePresence>

                        <div className="wa-bubble-actions">
                          <button
                            type="button"
                            onClick={() => setReplyTarget(message)}
                            className="wa-action-btn"
                            title="Reply"
                          >
                            <CornerUpLeft size={13} />
                          </button>
                          {canDelete ? (
                            <button
                              type="button"
                              onClick={() => removeMessage(message._id)}
                              disabled={deletingId === message._id}
                              className="wa-action-btn wa-action-delete"
                              title="Delete"
                            >
                              {deletingId === message._id ? (
                                <Loader2 size={13} className="animate-spin" />
                              ) : (
                                <Trash2 size={13} />
                              )}
                            </button>
                          ) : null}
                        </div>
                      </motion.article>
                    </div>
                  </motion.div>
                </div>
              );
            })}
          </AnimatePresence>
          <div ref={endRef} />

          <AnimatePresence>
            {showScrollDown ? (
              <motion.button
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                type="button"
                onClick={scrollToBottom}
                className="wa-scroll-down"
              >
                <ArrowDown size={16} />
                {newMsgCount > 0 ? <span className="wa-new-badge">{newMsgCount}</span> : null}
              </motion.button>
            ) : null}
          </AnimatePresence>
        </div>
      )}

      <footer className="wa-chat-footer">
        <AnimatePresence>
          {replyTarget ? (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="wa-reply-bar"
            >
              <div className="wa-reply-bar-inner">
                <div className="wa-reply-bar-content">
                  <p className="wa-reply-bar-name">
                    {replyTarget.sender?.name || 'Member'}
                  </p>
                  <p className="wa-reply-bar-text">{replyTarget.text}</p>
                </div>
                <button
                  type="button"
                  className="wa-reply-bar-close"
                  onClick={() => setReplyTarget(null)}
                  title="Cancel reply"
                  aria-label="Cancel reply"
                >
                  <X size={16} />
                </button>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>

        <AnimatePresence>
          {actionError ? (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="wa-error-toast"
            >
              {actionError}
            </motion.div>
          ) : null}
        </AnimatePresence>

        <AnimatePresence>
          {mentionOptions.length > 0 ? (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="wa-mention-list"
            >
              {mentionOptions.map((candidate) => (
                <button
                  key={candidate._id}
                  type="button"
                  onClick={() => replaceCurrentMention(candidate.collegeId)}
                  className="wa-mention-item"
                >
                  <span className="wa-mention-name">{candidate.name}</span>
                  <span className="wa-mention-id">@{candidate.collegeId}</span>
                </button>
              ))}
            </motion.div>
          ) : null}
        </AnimatePresence>

        <form onSubmit={send} className="wa-input-row">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={onInputKeyDown}
            rows={1}
            placeholder={canSend ? 'Type a message...' : 'Sign in to send messages'}
            disabled={!canSend}
            className="wa-input"
          />

          <motion.button
            type="submit"
            whileTap={{ scale: 0.9 }}
            disabled={!canSend || !text.trim()}
            className="wa-send-btn"
            title="Send"
          >
            <Send size={18} />
          </motion.button>
        </form>

        <div className="wa-input-hints">
          <p>Enter to send · Shift+Enter for newline · @collegeId to mention</p>
          {text.length > 1500 ? (
            <p className={text.length > 1900 ? 'wa-char-danger' : text.length > 1800 ? 'wa-char-warn' : 'wa-char-soft'}>
              {text.length}/2000
            </p>
          ) : null}
        </div>
      </footer>
    </div>
  );
}
