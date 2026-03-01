import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDown,
  Bot,
  Check,
  CheckCheck,
  Circle,
  Copy,
  CornerUpLeft,
  Loader2,
  MessageCircle,
  Pencil,
  Pin,
  Search,
  Send,
  SmilePlus,
  Sparkles,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  createCommunicationMessage,
  createCommunicationStream,
  deleteCommunicationMessage,
  fetchCommunicationMessages,
  fetchMentionCandidates,
  sendCommunicationTyping,
  setCommunicationPin,
  toggleCommunicationReaction,
  updateCommunicationMessage,
} from '../api';

const COMMUNICATION_CONVERSATION_ID = 'admin-stream';
const STREAM_FALLBACK_POLL_MS = 6000;
const MAX_RENDERED_MESSAGES = 400;
const MAX_MESSAGE_LEN = 1000;
const OFFLINE_QUEUE_KEY = `communication_offline_queue_${COMMUNICATION_CONVERSATION_ID}`;
const QUICK_REACTIONS = ['👍', '🔥', '👏', '❤️', '🎯', '😂'];
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

const pruneMessages = (rows = []) => {
  if (!Array.isArray(rows) || rows.length <= MAX_RENDERED_MESSAGES) return rows;
  return rows.slice(rows.length - MAX_RENDERED_MESSAGES);
};

const mergeUniqueMessages = (current = [], incoming = []) => {
  const map = new Map();
  for (const row of current) {
    if (!row?._id) continue;
    map.set(String(row._id), row);
  }
  for (const row of incoming) {
    if (!row?._id) continue;
    const id = String(row._id);
    const prev = map.get(id);
    map.set(id, prev ? { ...prev, ...row } : row);
  }
  return Array.from(map.values()).sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const readOfflineQueue = () => {
  try {
    const raw = localStorage.getItem(OFFLINE_QUEUE_KEY);
    const rows = JSON.parse(raw || '[]');
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
};

const writeOfflineQueue = (rows) => {
  localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(Array.isArray(rows) ? rows : []));
};

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
  const [streamState, setStreamState] = useState('connecting');
  const [lastSyncAt, setLastSyncAt] = useState(0);
  const [typingMap, setTypingMap] = useState({});
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState('all');
  const [editingMessageId, setEditingMessageId] = useState('');
  const [editDraft, setEditDraft] = useState('');
  const [reactionBusyId, setReactionBusyId] = useState('');
  const [offlineQueue, setOfflineQueue] = useState(() => readOfflineQueue());

  const endRef = useRef(null);
  const scrollContainerRef = useRef(null);
  const prependScrollSnapshotRef = useRef(null);
  const swipeStartXRef = useRef({});
  const fallbackPollRef = useRef(null);
  const loadingRef = useRef(false);
  const composerRef = useRef(null);
  const flushQueueBusyRef = useRef(false);
  const typingPingTimerRef = useRef(null);
  const typingOffTimerRef = useRef(null);
  const incomingEventQueueRef = useRef([]);
  const flushFrameRef = useRef(0);

  const reduceMotion = useReducedMotion();

  const profile = JSON.parse(localStorage.getItem('profile') || '{}');
  const user = profile.result || profile;
  const currentUserId = user?._id || '';
  const currentRole = String(user?.role || '').toLowerCase();
  const canSend = Boolean(localStorage.getItem('token'));
  const canModerate = currentRole === 'admin' || currentRole === 'head';
  const canPin = canModerate;

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

  const pinnedMessage = useMemo(() => {
    const pinnedRows = sortedMessages.filter((row) => row?.pinned?.isPinned);
    if (!pinnedRows.length) return null;
    return [...pinnedRows].sort((a, b) => new Date(b?.pinned?.pinnedAt || 0) - new Date(a?.pinned?.pinnedAt || 0))[0];
  }, [sortedMessages]);

  const visibleMessages = useMemo(() => {
    const needle = String(searchQuery || '').trim().toLowerCase();
    return sortedMessages.filter((row) => {
      if (filterMode === 'pinned' && !row?.pinned?.isPinned) return false;
      if (filterMode === 'mine' && String(row?.sender?._id || '') !== String(currentUserId)) return false;
      if (!needle) return true;
      const haystack = [
        row?.text,
        row?.sender?.name,
        row?.sender?.collegeId,
        row?.replyTo?.text,
      ]
        .map((v) => String(v || '').toLowerCase())
        .join(' ');
      return haystack.includes(needle);
    });
  }, [sortedMessages, filterMode, searchQuery, currentUserId]);

  const unreadMarkerIndex = useMemo(() => {
    const seenRaw = Number(localStorage.getItem(getCommunicationSeenKey(COMMUNICATION_CONVERSATION_ID)) || 0);
    if (!Number.isFinite(seenRaw) || seenRaw <= 0) return -1;
    return visibleMessages.findIndex((row) => {
      const t = new Date(row?.createdAt).getTime();
      return Number.isFinite(t) && t > seenRaw;
    });
  }, [visibleMessages]);

  const typingUsers = useMemo(() => {
    const now = Date.now();
    return Object.values(typingMap)
      .filter((row) => row && row.expiresAt > now)
      .slice(0, 3);
  }, [typingMap]);

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

  const streamLabel = useMemo(() => {
    if (streamState === 'live') return { text: 'Live', className: 'wa-conn-live' };
    if (streamState === 'reconnecting') return { text: 'Reconnecting', className: 'wa-conn-reconnecting' };
    return { text: 'Connecting', className: 'wa-conn-connecting' };
  }, [streamState]);

  const refreshMessages = useCallback(async ({ before = '', silent = false, reason = 'manual' } = {}) => {
    if (loadingRef.current) return null;
    loadingRef.current = true;
    try {
      const { data } = await fetchCommunicationMessages({
        limit: 80,
        before: before || undefined,
        conversationId: COMMUNICATION_CONVERSATION_ID,
      });
      const normalized = Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : [];

      if (before) {
        setMessages((prev) => pruneMessages(mergeUniqueMessages(normalized, prev)));
      } else {
        setMessages((prev) => {
          const optimistic = prev.filter((row) => row?._optimistic);
          return pruneMessages(mergeUniqueMessages(normalized, optimistic));
        });
      }

      setHasMore(Boolean(data?.hasMore));
      setNextCursor(String(data?.nextCursor || ''));
      setLastSyncAt(Date.now());

      const latest = normalized[normalized.length - 1];
      markCommunicationRead(
        latest?.createdAt ? new Date(latest.createdAt).getTime() : Date.now(),
        COMMUNICATION_CONVERSATION_ID
      );

      if (reason !== 'initial') {
        setServerError('');
      }
      return data;
    } catch (err) {
      if (!silent) {
        const status = err?.response?.status;
        if (status === 404) {
          setServerError('Communication API is not available on backend yet. Deploy latest backend routes.');
        } else {
          setServerError(err?.response?.data?.message || 'Failed to load communication stream.');
        }
      }
      return null;
    } finally {
      loadingRef.current = false;
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshMessages({ reason: 'initial' });
  }, [refreshMessages]);

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

    const ensureFallbackPolling = () => {
      if (fallbackPollRef.current) return;
      fallbackPollRef.current = setInterval(() => {
        refreshMessages({ silent: true, reason: 'fallback-poll' });
      }, STREAM_FALLBACK_POLL_MS);
    };

    const clearFallbackPolling = () => {
      if (!fallbackPollRef.current) return;
      clearInterval(fallbackPollRef.current);
      fallbackPollRef.current = null;
    };

    const flushIncoming = () => {
      flushFrameRef.current = 0;
      const queue = incomingEventQueueRef.current.splice(0, incomingEventQueueRef.current.length);
      if (!queue.length) return;

      setMessages((prev) => {
        let next = [...prev];

        for (const event of queue) {
          if (event.type === 'delete') {
            next = next.filter((m) => String(m._id) !== String(event.payload?._id));
            continue;
          }

          if (event.type === 'typing') {
            continue;
          }

          const payload = event.payload;
          if (!payload?._id) continue;
          next = next.filter((m) => {
            if (!m?._optimistic) return true;
            if (m._optimisticText !== payload.text) return true;
            if (String(m.sender?._id) !== String(payload.sender?._id)) return true;
            const optimisticTs = new Date(m.createdAt).getTime();
            const payloadTs = new Date(payload.createdAt).getTime();
            if (Number.isFinite(optimisticTs) && Number.isFinite(payloadTs) && Math.abs(payloadTs - optimisticTs) > 30000) return true;
            return false;
          });
          const idx = next.findIndex((m) => String(m._id) === String(payload._id));
          if (idx >= 0) {
            next[idx] = { ...next[idx], ...payload };
          } else {
            next.push(payload);
          }
        }

        return pruneMessages(next.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)));
      });
    };

    const queueFlush = () => {
      if (flushFrameRef.current) return;
      flushFrameRef.current = window.requestAnimationFrame(flushIncoming);
    };

    const messageHandler = (evt) => {
      try {
        const payload = JSON.parse(evt.data);
        if (payload?.conversationId && payload.conversationId !== COMMUNICATION_CONVERSATION_ID) return;
        setStreamState('live');
        setLastSyncAt(Date.now());
        clearFallbackPolling();
        incomingEventQueueRef.current.push({ type: 'message', payload });
        queueFlush();
        markCommunicationRead(
          payload?.createdAt ? new Date(payload.createdAt).getTime() : Date.now(),
          COMMUNICATION_CONVERSATION_ID
        );
      } catch {
        // ignore malformed payload
      }
    };

    const updateHandler = (evt) => {
      try {
        const payload = JSON.parse(evt.data);
        if (payload?.conversationId && payload.conversationId !== COMMUNICATION_CONVERSATION_ID) return;
        incomingEventQueueRef.current.push({ type: 'message', payload });
        queueFlush();
      } catch {
        // ignore malformed payload
      }
    };

    const typingHandler = (evt) => {
      try {
        const payload = JSON.parse(evt.data);
        if (payload?.conversationId && payload.conversationId !== COMMUNICATION_CONVERSATION_ID) return;
        const actorId = String(payload?.user?._id || '');
        if (!actorId || actorId === String(currentUserId)) return;
        const expiresAt = Date.now() + 4200;
        setTypingMap((prev) => {
          if (!payload?.isTyping) {
            const next = { ...prev };
            delete next[actorId];
            return next;
          }
          return {
            ...prev,
            [actorId]: {
              _id: actorId,
              name: payload?.user?.name || 'Member',
              collegeId: payload?.user?.collegeId || '',
              expiresAt,
            },
          };
        });
      } catch {
        // ignore malformed payload
      }
    };

    const deleteHandler = (evt) => {
      try {
        const payload = JSON.parse(evt.data);
        incomingEventQueueRef.current.push({ type: 'delete', payload });
        queueFlush();
      } catch {
        // ignore malformed payload
      }
    };

    es.addEventListener('new-message', messageHandler);
    es.addEventListener('update-message', updateHandler);
    es.addEventListener('typing', typingHandler);
    es.addEventListener('delete-message', deleteHandler);
    es.onopen = () => {
      setStreamState('live');
      setLastSyncAt(Date.now());
      clearFallbackPolling();
    };
    es.onerror = () => {
      setStreamState('reconnecting');
      ensureFallbackPolling();
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        refreshMessages({ silent: true, reason: 'tab-focus' });
      }
    };
    window.addEventListener('visibilitychange', handleVisibility);

    return () => {
      es.close();
      clearFallbackPolling();
      window.removeEventListener('visibilitychange', handleVisibility);
      if (flushFrameRef.current) {
        window.cancelAnimationFrame(flushFrameRef.current);
        flushFrameRef.current = 0;
      }
    };
  }, [refreshMessages, currentUserId]);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key !== '/') return;
      const target = event.target;
      const isEditable =
        target instanceof HTMLElement &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
      if (isEditable) return;
      event.preventDefault();
      composerRef.current?.focus();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    const el = composerRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 192)}px`;
  }, [text]);

  useEffect(() => {
    const timer = setInterval(() => {
      const now = Date.now();
      setTypingMap((prev) => {
        const next = { ...prev };
        let changed = false;
        for (const [id, row] of Object.entries(next)) {
          if (!row || row.expiresAt <= now) {
            delete next[id];
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    }, 1200);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    writeOfflineQueue(offlineQueue);
  }, [offlineQueue]);

  useEffect(() => {
    const flushQueue = async () => {
      if (!offlineQueue.length || flushQueueBusyRef.current) return;
      flushQueueBusyRef.current = true;
      try {
        const snapshot = [...offlineQueue];
        const remaining = [];
        for (const item of snapshot) {
          try {
            await createCommunicationMessage({
              text: item.text,
              replyToId: item.replyToId || undefined,
              conversationId: COMMUNICATION_CONVERSATION_ID,
            });
          } catch {
            remaining.push(item);
          }
        }
        if (remaining.length !== snapshot.length) {
          setOfflineQueue(remaining);
          refreshMessages({ silent: true, reason: 'offline-queue-flush' });
          if (remaining.length === 0) {
            dispatchToast('Queued messages sent.', 'success');
          }
        }
      } finally {
        flushQueueBusyRef.current = false;
      }
    };

    flushQueue();
    const timer = setInterval(flushQueue, 8000);
    const onOnline = () => flushQueue();
    window.addEventListener('online', onOnline);
    return () => {
      clearInterval(timer);
      window.removeEventListener('online', onOnline);
    };
  }, [offlineQueue, refreshMessages]);

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
      await refreshMessages({ before: nextCursor, silent: true, reason: 'load-older' });
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

  const emitTyping = useCallback((isTyping) => {
    if (!canSend) return;
    sendCommunicationTyping({
      conversationId: COMMUNICATION_CONVERSATION_ID,
      isTyping: !!isTyping,
    }).catch(() => {});
  }, [canSend]);

  useEffect(() => {
    if (!canSend) return;
    const hasContent = String(text || '').trim().length > 0;
    if (typingPingTimerRef.current) clearTimeout(typingPingTimerRef.current);
    if (typingOffTimerRef.current) clearTimeout(typingOffTimerRef.current);

    if (hasContent) {
      emitTyping(true);
      typingPingTimerRef.current = setTimeout(() => emitTyping(true), 2500);
      typingOffTimerRef.current = setTimeout(() => emitTyping(false), 3800);
    } else {
      emitTyping(false);
    }

    return () => {
      if (typingPingTimerRef.current) clearTimeout(typingPingTimerRef.current);
      if (typingOffTimerRef.current) clearTimeout(typingOffTimerRef.current);
    };
  }, [text, emitTyping, canSend]);

  const parseSlashCommand = (rawText) => {
    const normalized = String(rawText || '').trim();
    if (!normalized.startsWith('/')) return { type: 'none', text: normalized };

    if (normalized === '/help') {
      return {
        type: 'help',
        text: '',
        help: 'Commands: /help · /poll Question | Option A | Option B · /shrug',
      };
    }

    if (normalized === '/shrug') {
      return { type: 'message', text: '¯\\_(ツ)_/¯' };
    }

    if (normalized.startsWith('/poll')) {
      const body = normalized.replace(/^\/poll\s*/i, '');
      const parts = body.split('|').map((part) => String(part || '').trim()).filter(Boolean);
      if (parts.length < 3) {
        return { type: 'error', error: 'Use: /poll Question | Option A | Option B' };
      }
      const [question, ...options] = parts;
      const bullets = options.slice(0, 6).map((opt, idx) => `${idx + 1}. ${opt}`).join('\n');
      return {
        type: 'message',
        text: `📊 Poll: ${question}\n${bullets}`,
      };
    }

    return { type: 'error', error: 'Unknown command. Try /help' };
  };

  const queueOfflineMessage = (payload) => {
    const queued = {
      id: generateOptimisticId(),
      text: payload.text,
      replyToId: payload.replyToId || '',
      createdAt: new Date().toISOString(),
    };
    setOfflineQueue((prev) => [...prev, queued]);
    dispatchToast('Offline: message queued and will auto-send.', 'warning');
  };

  const send = async (e) => {
    e.preventDefault();
    if (!canSend) return;
  
      if (editingMessageId) {
        await saveEdit(editingMessageId);
        return;
      }
  
    useEffect(() => {
      return () => {
        emitTyping(false);
      };
    }, [emitTyping]);

    const command = parseSlashCommand(text);
    if (command.type === 'help') {
      setActionError(command.help);
      return;
    }
    if (command.type === 'error') {
      setActionError(command.error);
      return;
    }

    const body = String(command.text || '').trim();
    if (!body) return;
    if (body.length > MAX_MESSAGE_LEN) {
      setActionError(`Message must be ${MAX_MESSAGE_LEN} characters or less`);
      return;
    }

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
    setStreamState((prev) => (prev === 'live' ? prev : 'reconnecting'));
    emitTyping(false);

    try {
      let response = null;
      for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
          response = await createCommunicationMessage({
            text: body,
            replyToId: replyTarget?._id,
            conversationId: COMMUNICATION_CONVERSATION_ID,
          });
          break;
        } catch (error) {
          const status = Number(error?.response?.status || 0);
          const shouldRetry = attempt === 0 && (status === 429 || status >= 500 || status === 0);
          if (!shouldRetry) throw error;
          await sleep(420);
        }
      }

      const data = response?.data;
      if (!data?._id) {
        await refreshMessages({ silent: true, reason: 'post-send-resync' });
        return;
      }

      setMessages((prev) => {
        const withoutOptimistic = prev.filter((m) => m._id !== optimisticId);
        if (withoutOptimistic.some((m) => m._id === data._id)) return withoutOptimistic;
        return pruneMessages([...withoutOptimistic, data]);
      });
      markCommunicationRead(
        data?.createdAt ? new Date(data.createdAt).getTime() : Date.now(),
        COMMUNICATION_CONVERSATION_ID
      );
      setLastSyncAt(Date.now());
    } catch (err) {
      setMessages((prev) => prev.filter((m) => m._id !== optimisticId));
      const status = Number(err?.response?.status || 0);
      if (status === 0 || status >= 500 || !navigator.onLine) {
        queueOfflineMessage({ text: body, replyToId: replyTarget?._id });
      } else {
        setActionError(err.response?.data?.message || 'Unable to send message');
      }
    }
  };

  const copyMessage = async (message) => {
    const content = String(message?.text || '').trim();
    if (!content) return;
    try {
      await navigator.clipboard.writeText(content);
      dispatchToast('Message copied.', 'success');
    } catch {
      setActionError('Unable to copy message');
    }
  };

  const beginEdit = (message) => {
    if (!message) return;
    setEditingMessageId(String(message._id || ''));
    setEditDraft(String(message.text || ''));
    composerRef.current?.focus();
  };

  const cancelEdit = () => {
    setEditingMessageId('');
    setEditDraft('');
  };

  const saveEdit = async (messageId) => {
    const value = String(editDraft || '').trim();
    if (!value) {
      setActionError('Edited message cannot be empty');
      return;
    }
    if (value.length > MAX_MESSAGE_LEN) {
      setActionError(`Edited message must be ${MAX_MESSAGE_LEN} characters or less`);
      return;
    }

    try {
      const { data } = await updateCommunicationMessage(messageId, { text: value });
      setMessages((prev) => prev.map((row) => (String(row._id) === String(messageId) ? { ...row, ...data } : row)));
      cancelEdit();
      dispatchToast('Message updated.', 'success');
    } catch (err) {
      setActionError(err?.response?.data?.message || 'Unable to edit message');
    }
  };

  const toggleReaction = async (messageId, emoji) => {
    setReactionBusyId(String(messageId));
    try {
      const { data } = await toggleCommunicationReaction(messageId, emoji);
      setMessages((prev) => prev.map((row) => (String(row._id) === String(messageId) ? { ...row, ...data } : row)));
    } catch (err) {
      setActionError(err?.response?.data?.message || 'Unable to react to this message');
    } finally {
      setReactionBusyId('');
    }
  };

  const togglePinMessage = async (message) => {
    if (!canPin || !message?._id) return;
    try {
      const { data } = await setCommunicationPin(message._id, !message?.pinned?.isPinned);
      setMessages((prev) => prev.map((row) => (String(row._id) === String(message._id) ? { ...row, ...data } : row)));
      dispatchToast(data?.pinned?.isPinned ? 'Message pinned.' : 'Message unpinned.', 'success');
    } catch (err) {
      setActionError(err?.response?.data?.message || 'Unable to pin message');
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
    if (e.key === 'Escape') {
      setMentionOptions([]);
      setReplyTarget(null);
      setSelectedMsgId(null);
      if (editingMessageId) cancelEdit();
      return;
    }

    if (e.key === 'ArrowUp' && !text.trim() && !editingMessageId) {
      const mine = [...sortedMessages]
        .reverse()
        .find((row) => String(row?.sender?._id || '') === String(currentUserId) && !row?.sender?.isAI);
      if (mine) {
        e.preventDefault();
        beginEdit(mine);
      }
      return;
    }

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
              <span className={`wa-conn-pill ${streamLabel.className}`}>{streamLabel.text}</span>
              <span className="wa-chat-dot">·</span>
              <span>{streamStats.participants} participant{streamStats.participants !== 1 ? 's' : ''}</span>
              <span className="wa-chat-dot">·</span>
              <span>{streamStats.totalMessages} message{streamStats.totalMessages !== 1 ? 's' : ''}</span>
            </p>
          </div>
        </div>
        <div className="wa-chat-header-right">
          <Users size={18} className="wa-header-icon" />
          <span className="wa-last-sync" title={lastSyncAt ? fullTimestamp(lastSyncAt) : 'Not synced yet'}>
            {lastSyncAt ? `Synced ${timeLabel(lastSyncAt)}` : 'Syncing...'}
          </span>
        </div>
      </header>

      <div className="wa-toolbar">
        <div className="wa-toolbar-search">
          <Search size={14} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search messages, names, @collegeId"
          />
        </div>
        <div className="wa-toolbar-filters">
          <button
            type="button"
            onClick={() => setFilterMode('all')}
            className={`wa-filter-btn ${filterMode === 'all' ? 'active' : ''}`}
          >
            All
          </button>
          <button
            type="button"
            onClick={() => setFilterMode('mine')}
            className={`wa-filter-btn ${filterMode === 'mine' ? 'active' : ''}`}
          >
            Mine
          </button>
          <button
            type="button"
            onClick={() => setFilterMode('pinned')}
            className={`wa-filter-btn ${filterMode === 'pinned' ? 'active' : ''}`}
          >
            Pinned
          </button>
          {offlineQueue.length > 0 ? <span className="wa-queue-badge">Queued {offlineQueue.length}</span> : null}
        </div>
      </div>

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

          {pinnedMessage ? (
            <div className="wa-pinned-banner" role="status" aria-live="polite">
              <Pin size={12} />
              <span className="wa-pinned-label">Pinned</span>
              <span className="wa-pinned-text">{String(pinnedMessage.text || '').slice(0, 140)}</span>
              <button type="button" onClick={() => setSelectedMsgId(pinnedMessage._id)} className="wa-pinned-jump">
                Open
              </button>
            </div>
          ) : null}

          {visibleMessages.length === 0 ? (
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
            {visibleMessages.map((message, index) => {
              const previous = visibleMessages[index - 1];
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
              const isEditing = editingMessageId && String(editingMessageId) === String(message._id);
              const canEdit = own && !isAI;
              const reactions = Array.isArray(message.reactions) ? message.reactions : [];

              return (
                <div key={message._id}>
                  {unreadMarkerIndex === index ? (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="wa-unread-divider">
                      <span>New messages</span>
                    </motion.div>
                  ) : null}

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
                    initial={reduceMotion ? false : { opacity: 0, y: 16, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={reduceMotion ? { duration: 0.12 } : { type: 'spring', stiffness: 400, damping: 30 }}
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
                        whileHover={reduceMotion ? undefined : { scale: 1.005 }}
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

                        {isEditing ? (
                          <div className="wa-edit-box">
                            <textarea
                              value={editDraft}
                              onChange={(event) => setEditDraft(event.target.value)}
                              className="wa-edit-input"
                              rows={2}
                              maxLength={MAX_MESSAGE_LEN}
                            />
                            <div className="wa-edit-actions">
                              <button type="button" className="wa-action-btn" onClick={cancelEdit} title="Cancel edit">
                                <X size={13} />
                              </button>
                              <button type="button" className="wa-action-btn" onClick={() => saveEdit(message._id)} title="Save edit">
                                <Check size={13} />
                              </button>
                            </div>
                          </div>
                        ) : (
                          <p className="wa-bubble-text">
                            {decorateMentions(message.text)}
                          </p>
                        )}

                        {reactions.length > 0 ? (
                          <div className="wa-reactions-row">
                            {reactions.map((reaction) => {
                              const reactorIds = Array.isArray(reaction.reactorIds) ? reaction.reactorIds : [];
                              const reacted = reactorIds.includes(String(currentUserId));
                              return (
                                <button
                                  key={`${message._id}-${reaction.emoji}`}
                                  type="button"
                                  onClick={() => toggleReaction(message._id, reaction.emoji)}
                                  className={`wa-reaction-chip ${reacted ? 'active' : ''}`}
                                  disabled={reactionBusyId === String(message._id)}
                                >
                                  <span>{reaction.emoji}</span>
                                  <span>{reaction.count}</span>
                                </button>
                              );
                            })}
                          </div>
                        ) : null}

                        <div
                          className="wa-bubble-meta"
                          onClick={() => setSelectedMsgId((prev) => (prev === message._id ? null : message._id))}
                          style={{ cursor: 'pointer' }}
                        >
                          <span className="wa-bubble-time" title={fullTimestamp(message.createdAt)}>
                            {timeLabel(message.createdAt)}
                          </span>
                          {message?.editedAt ? <span className="wa-edited-tag">edited</span> : null}
                          {message?.pinned?.isPinned ? <Pin size={11} className="wa-pin-tag" /> : null}
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
                            onClick={() => copyMessage(message)}
                            className="wa-action-btn"
                            title="Copy"
                          >
                            <Copy size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setReplyTarget(message)}
                            className="wa-action-btn"
                            title="Reply"
                          >
                            <CornerUpLeft size={13} />
                          </button>
                          {canEdit ? (
                            <button
                              type="button"
                              onClick={() => beginEdit(message)}
                              className="wa-action-btn"
                              title="Edit"
                            >
                              <Pencil size={13} />
                            </button>
                          ) : null}
                          {canPin ? (
                            <button
                              type="button"
                              onClick={() => togglePinMessage(message)}
                              className={`wa-action-btn ${message?.pinned?.isPinned ? 'wa-action-pin-active' : ''}`}
                              title={message?.pinned?.isPinned ? 'Unpin' : 'Pin'}
                            >
                              <Pin size={13} />
                            </button>
                          ) : null}
                          <div className="wa-reaction-picker">
                            <button type="button" className="wa-action-btn" title="React">
                              <SmilePlus size={13} />
                            </button>
                            <div className="wa-reaction-menu">
                              {QUICK_REACTIONS.map((emoji) => (
                                <button
                                  key={`${message._id}-${emoji}`}
                                  type="button"
                                  onClick={() => toggleReaction(message._id, emoji)}
                                  disabled={reactionBusyId === String(message._id)}
                                >
                                  {emoji}
                                </button>
                              ))}
                            </div>
                          </div>
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
          {typingUsers.length > 0 ? (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="wa-typing-bar"
            >
              <Sparkles size={12} />
              <span>
                {typingUsers.map((row) => row.name).join(', ')} {typingUsers.length > 1 ? 'are' : 'is'} typing...
              </span>
            </motion.div>
          ) : null}
        </AnimatePresence>

        <AnimatePresence>
          {editingMessageId ? (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="wa-editing-strip"
            >
              <Pencil size={12} />
              <span>Editing message</span>
              <button type="button" onClick={cancelEdit}>Cancel</button>
            </motion.div>
          ) : null}
        </AnimatePresence>

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
            ref={composerRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={onInputKeyDown}
            rows={1}
            placeholder={canSend ? 'Type a message...' : 'Sign in to send messages'}
            disabled={!canSend}
            className="wa-input"
            maxLength={MAX_MESSAGE_LEN}
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
          <p>Enter to send · Shift+Enter newline · Esc close · ↑ edit last · /help commands</p>
          {text.length > 760 ? (
            <p className={text.length > 940 ? 'wa-char-danger' : text.length > 860 ? 'wa-char-warn' : 'wa-char-soft'}>
              {text.length}/{MAX_MESSAGE_LEN}
            </p>
          ) : null}
        </div>
      </footer>
    </div>
  );
}
