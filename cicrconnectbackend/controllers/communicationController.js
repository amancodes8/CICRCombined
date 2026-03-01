const CommunicationMessage = require('../models/CommunicationMessage');
const User = require('../models/User');
const Project = require('../models/Project');
const mongoose = require('mongoose');
const { geminiGenerate } = require('../utils/geminiClient');
const { createNotifications } = require('../utils/notificationService');
const { normalizeCollegeId } = require('../utils/fieldCrypto');

const sseClients = new Map();
const userLastMessageAt = new Map();
const AI_MENTION_TOKEN = '@cicrai';
const DEFAULT_CONVERSATION_ID = 'admin-stream';
const DOMAIN_SCOPE_HINT =
  'You must answer only CICR-related topics and technology domains: robotics, programming, software, hardware, AI/ML, cybersecurity, IoT, embedded, electronics, networking, product building, and project workflows. If question is outside this scope or nonsense, refuse briefly and ask a relevant CICR/tech question instead.';
const REACTION_EMOJI_REGEX = /^(?:\p{Emoji_Presentation}|\p{Emoji}\uFE0F)$/u;
const CONVERSATION_ID_REGEX = /^[a-zA-Z0-9:_-]{2,80}$/;
const sanitizeConversationId = (value) => {
  const normalized = String(value || '').trim();
  if (!normalized) return DEFAULT_CONVERSATION_ID;
  return CONVERSATION_ID_REGEX.test(normalized) ? normalized : DEFAULT_CONVERSATION_ID;
};
const buildConversationFilter = (conversationId) => {
  const normalizedConversationId = sanitizeConversationId(conversationId);
  if (normalizedConversationId !== DEFAULT_CONVERSATION_ID) {
    return { conversationId: normalizedConversationId };
  }
  // Backward compatibility for legacy messages created before conversationId was introduced.
  return {
    $or: [
      { conversationId: normalizedConversationId },
      { conversationId: { $exists: false } },
      { conversationId: null },
      { conversationId: '' },
    ],
  };
};
const buildCursor = (message) => {
  if (!message?.createdAt || !message?._id) return null;
  const millis = new Date(message.createdAt).getTime();
  if (!Number.isFinite(millis)) return null;
  return `${millis}_${String(message._id)}`;
};
const parseCursor = async (rawCursor) => {
  const raw = String(rawCursor || '').trim();
  if (!raw) return null;

  const [millisRaw, idRaw] = raw.split('_');
  const millis = Number(millisRaw);
  if (Number.isFinite(millis) && mongoose.Types.ObjectId.isValid(idRaw)) {
    const createdAt = new Date(millis);
    if (!Number.isNaN(createdAt.getTime())) {
      return {
        createdAt,
        _id: new mongoose.Types.ObjectId(idRaw),
      };
    }
  }

  if (mongoose.Types.ObjectId.isValid(raw)) {
    const doc = await CommunicationMessage.findById(raw).select('_id createdAt').lean();
    if (doc?._id && doc?.createdAt) {
      return {
        createdAt: new Date(doc.createdAt),
        _id: doc._id,
      };
    }
  }

  const asDate = new Date(raw);
  if (!Number.isNaN(asDate.getTime())) {
    return { createdAt: asDate };
  }

  return null;
};

const readDoc = (doc, path, fallback = null) => {
  if (!doc) return fallback;
  if (typeof doc.get === 'function') {
    const value = doc.get(path);
    return value === undefined ? fallback : value;
  }
  const value = path
    .split('.')
    .reduce((acc, key) => (acc && acc[key] !== undefined ? acc[key] : undefined), doc);
  return value === undefined ? fallback : value;
};

const sanitizeReactionEmoji = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (raw.length > 16) return '';
  if (!REACTION_EMOJI_REGEX.test(raw)) return '';
  return raw;
};

const isPrivilegedRole = (role) => {
  const normalized = String(role || '').toLowerCase();
  return normalized === 'admin' || normalized === 'head';
};

const canManageMessage = (actor, message) => {
  const senderId = readDoc(message, 'sender._id') || readDoc(message, 'sender');
  const isOwner = senderId && String(senderId) === String(actor?._id || actor?.id || '');
  return isOwner || isPrivilegedRole(actor?.role);
};

const summarizeReactions = (messageDoc) => {
  const reactions = Array.isArray(readDoc(messageDoc, 'reactions'))
    ? readDoc(messageDoc, 'reactions')
    : [];

  return reactions
    .map((row) => {
      const reactorIds = Array.isArray(readDoc(row, 'users'))
        ? readDoc(row, 'users').map((id) => String(readDoc(id, '_id') || id)).filter(Boolean)
        : [];
      return {
        emoji: readDoc(row, 'emoji', ''),
        count: reactorIds.length,
        reactorIds,
      };
    })
    .filter((row) => row.emoji && row.count > 0);
};

const serializeMessage = (messageDoc) => ({
  _id: readDoc(messageDoc, '_id'),
  conversationId: sanitizeConversationId(readDoc(messageDoc, 'conversationId')),
  text: readDoc(messageDoc, 'text', ''),
  sender:
    readDoc(messageDoc, 'sender')
      ? {
          _id: readDoc(messageDoc, 'sender._id'),
          name: readDoc(messageDoc, 'sender.name', ''),
          collegeId: readDoc(messageDoc, 'sender.collegeId', ''),
          role: readDoc(messageDoc, 'sender.role', ''),
          isAI: false,
        }
      : readDoc(messageDoc, 'senderMeta')
      ? {
          _id: null,
          name: readDoc(messageDoc, 'senderMeta.name', ''),
          collegeId: readDoc(messageDoc, 'senderMeta.collegeId', ''),
          role: readDoc(messageDoc, 'senderMeta.role', ''),
          isAI: !!readDoc(messageDoc, 'senderMeta.isAI', false),
        }
      : null,
  replyTo: readDoc(messageDoc, 'replyTo', null),
  mentions: Array.isArray(readDoc(messageDoc, 'mentions'))
    ? readDoc(messageDoc, 'mentions').map((m) => ({
        _id: readDoc(m, '_id'),
        name: readDoc(m, 'name', ''),
        collegeId: readDoc(m, 'collegeId', ''),
      }))
    : [],
  editedAt: readDoc(messageDoc, 'editedAt', null),
  editedBy: readDoc(messageDoc, 'editedBy._id') || readDoc(messageDoc, 'editedBy') || null,
  pinned: {
    isPinned: !!readDoc(messageDoc, 'pinned.isPinned', false),
    pinnedBy: readDoc(messageDoc, 'pinned.pinnedBy._id') || readDoc(messageDoc, 'pinned.pinnedBy') || null,
    pinnedAt: readDoc(messageDoc, 'pinned.pinnedAt', null),
  },
  reactions: summarizeReactions(messageDoc),
  createdAt: readDoc(messageDoc, 'createdAt'),
});

const broadcast = (event, payload, conversationId = DEFAULT_CONVERSATION_ID) => {
  const data = `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
  const targetConversationId = sanitizeConversationId(conversationId);
  for (const [res, clientConversationId] of sseClients.entries()) {
    if (clientConversationId !== targetConversationId) continue;
    try {
      res.write(data);
    } catch {
      sseClients.delete(res);
    }
  }
};

const parseMentionCollegeIds = (text) => {
  const ids = new Set();
  const matches = String(text).match(/@([a-zA-Z0-9._-]{3,40})/g) || [];
  for (const token of matches) {
    ids.add(normalizeCollegeId(token.slice(1)));
  }
  return Array.from(ids);
};

const askGemini = async (prompt) => {
  const result = await geminiGenerate(prompt);
  if (!result.ok) {
    return `AI temporarily unavailable (${result.error}).`;
  }
  return result.text || 'No response generated.';
};

const queueAiReply = async (message) => {
  try {
    const conversationId = sanitizeConversationId(message.conversationId);
    const lower = String(message.text || '').toLowerCase();
    if (!lower.includes(AI_MENTION_TOKEN)) return;

    const question = String(message.text || '')
      .replace(/@cicrai/gi, '')
      .trim();

    if (!question) return;

    const recent = await CommunicationMessage.find(buildConversationFilter(conversationId))
      .sort({ createdAt: -1 })
      .limit(12)
      .populate('sender', 'name collegeId role');
    const projects = await Project.find({})
      .sort({ updatedAt: -1 })
      .limit(10)
      .select('title domain status description')
      .lean();

    const context = recent
      .reverse()
      .map((m) => {
        const name = readDoc(m, 'sender.name') || readDoc(m, 'senderMeta.name') || 'Member';
        const text = readDoc(m, 'text', '');
        return `${name}: ${text}`;
      })
      .join('\n');
    const projectContext = projects
      .map((p) => `- ${p.title} [${p.domain}] (${p.status}): ${String(p.description || '').slice(0, 220)}`)
      .join('\n');

    const prompt = [
      'You are CICR AI chat assistant for internal communication.',
      DOMAIN_SCOPE_HINT,
      'Respond concisely, practically, and in plain English.',
      'When asked for project summary/details, use project context below.',
      `Recent CICR projects:\n${projectContext || 'No project data available.'}`,
      `Conversation context:\n${context}`,
      `User question:\n${question}`,
    ].join('\n\n');

    const answer = await askGemini(prompt);
    const aiMsg = await CommunicationMessage.create({
      conversationId,
      text: `@cicrai ${answer}`,
      senderMeta: {
        name: 'CICR AI',
        collegeId: 'cicrai',
        role: 'Assistant',
        isAI: true,
      },
      replyTo: {
        messageId: message._id,
        text: String(message.text || '').slice(0, 180),
        senderName: message.sender?.name || 'Member',
        senderCollegeId: message.sender?.collegeId || '',
      },
    });

    const payload = serializeMessage(aiMsg);
    broadcast('new-message', payload, conversationId);
  } catch (err) {
    // Avoid crashing user chat flow for AI failures.
    console.error('queueAiReply error:', err.message);
  }
};

const performDelete = async (req, id) => {
  const message = await CommunicationMessage.findById(id).populate('sender', 'name collegeId role');
  if (!message) {
    return { success: true, _id: String(id), alreadyDeleted: true };
  }

  const isPrivileged = isPrivilegedRole(req.user?.role);
  const senderId =
    message.sender && typeof message.sender === 'object' ? message.sender._id : message.sender;
  const isOwner = !!senderId && String(senderId) === String(req.user._id);
  const isTargetedAiReply =
    !!message.senderMeta?.isAI &&
    String(message.replyTo?.senderCollegeId || '') === String(req.user.collegeId || '');

  if (!isOwner && !isPrivileged && !isTargetedAiReply) {
    return { error: { status: 403, message: 'Not authorized to delete this message' } };
  }

  await CommunicationMessage.findByIdAndDelete(message._id);
  broadcast('delete-message', { _id: String(message._id) }, sanitizeConversationId(message.conversationId));
  return { success: true, _id: String(message._id) };
};

const listMessages = async (req, res) => {
  const conversationId = sanitizeConversationId(req.query.conversationId);
  const limitRaw = Number(req.query.limit || 100);
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 200) : 100;
  const cursor = await parseCursor(req.query.before);

  const filter = { $and: [buildConversationFilter(conversationId)] };
  if (cursor?.createdAt && cursor?._id) {
    filter.$and.push({
      $or: [
        { createdAt: { $lt: cursor.createdAt } },
        { createdAt: cursor.createdAt, _id: { $lt: cursor._id } },
      ],
    });
  } else if (cursor?.createdAt) {
    filter.$and.push({ createdAt: { $lt: cursor.createdAt } });
  }

  const rows = await CommunicationMessage.find(filter)
    .sort({ createdAt: -1, _id: -1 })
    .limit(limit + 1)
    .populate('sender', 'name collegeId role')
    .populate('mentions', 'name collegeId')
    .populate('editedBy', 'name collegeId role')
    .populate('pinned.pinnedBy', 'name collegeId role');

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore ? buildCursor(page[page.length - 1]) : null;

  res.json({
    conversationId,
    items: page.reverse().map(serializeMessage),
    hasMore,
    nextCursor,
  });
};

const streamMessages = async (req, res) => {
  const conversationId = sanitizeConversationId(req.query.conversationId);
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();
  res.write('retry: 10000\n\n');
  res.write(`event: ready\ndata: ${JSON.stringify({ conversationId })}\n\n`);

  sseClients.set(res, conversationId);
  const heartbeat = setInterval(() => {
    try {
      res.write('event: ping\ndata: {}\n\n');
    } catch {
      clearInterval(heartbeat);
      sseClients.delete(res);
    }
  }, 25000);

  req.on('close', () => {
    clearInterval(heartbeat);
    sseClients.delete(res);
  });
};

const createMessage = async (req, res) => {
  if (req.body.action === 'delete' && req.body.id) {
    const result = await performDelete(req, req.body.id);
    if (result.error) {
      return res.status(result.error.status).json({ message: result.error.message });
    }
    return res.json(result);
  }

  const text = String(req.body.text || '').trim();
  if (!text) {
    return res.status(400).json({ message: 'Message text is required' });
  }
  if (text.length > 1000) {
    return res.status(400).json({ message: 'Message must be 1000 characters or less' });
  }
  const conversationId = sanitizeConversationId(req.body.conversationId);

  // Basic spam guard to reduce server load and feed abuse.
  const now = Date.now();
  const key = String(req.user._id);
  const last = userLastMessageAt.get(key) || 0;
  if (now - last < 1200) {
    return res.status(429).json({ message: 'You are sending messages too quickly' });
  }
  userLastMessageAt.set(key, now);

  const mentionCollegeIds = parseMentionCollegeIds(text);
  const mentionUsers = mentionCollegeIds.length
    ? await User.findByCollegeIds(mentionCollegeIds).select('_id role')
    : [];

  let replyTo = undefined;
  if (req.body.replyToId) {
    const parent = await CommunicationMessage.findOne({
      _id: req.body.replyToId,
      ...buildConversationFilter(conversationId),
    })
      .populate('sender', 'name collegeId');
    if (parent) {
      replyTo = {
        messageId: parent._id,
        text: String(readDoc(parent, 'text', '') || '').slice(0, 180),
        senderName: readDoc(parent, 'sender.name') || readDoc(parent, 'senderMeta.name') || 'Member',
        senderCollegeId: readDoc(parent, 'sender.collegeId') || readDoc(parent, 'senderMeta.collegeId') || '',
      };
    }
  }

  const created = await CommunicationMessage.create({
    conversationId,
    text,
    sender: req.user._id,
    mentions: mentionUsers.map((u) => u._id),
    replyTo,
  });

  const fullMessage = await CommunicationMessage.findById(created._id)
    .populate('sender', 'name collegeId role')
    .populate('mentions', 'name collegeId')
    .populate('editedBy', 'name collegeId role')
    .populate('pinned.pinnedBy', 'name collegeId role');

  const mentionRecipientIds = mentionUsers
    .filter((row) => {
      const role = String(row.role || '').toLowerCase();
      return role === 'admin' || role === 'head';
    })
    .map((row) => String(row._id))
    .filter((id) => id && id !== String(req.user._id));
  if (mentionRecipientIds.length > 0) {
    await createNotifications({
      userIds: mentionRecipientIds,
      title: `Mentioned by ${readDoc(req.user, 'name') || 'Member'}`,
      message: String(text).slice(0, 220),
      type: 'action',
      link: '/communication',
      meta: {
        mention: true,
        conversationId,
        messageId: created._id,
      },
      createdBy: req.user._id,
    });
  }

  const payload = serializeMessage(fullMessage);
  broadcast('new-message', payload, conversationId);
  queueAiReply(fullMessage);

  res.status(201).json(payload);
};

const listMentionCandidates = async (req, res) => {
  const q = String(req.query.q || '').trim().toLowerCase();
  const users = await User.find({
    $or: [{ approvalStatus: 'Approved' }, { isVerified: true }],
  })
    .select('name collegeId role')
    .sort({ createdAt: -1 })
    .limit(600);

  const filteredUsers = users
    .filter((row) => {
      if (!q) return true;
      const name = String(readDoc(row, 'name', '') || '').toLowerCase();
      const collegeId = String(readDoc(row, 'collegeId', '') || '').toLowerCase();
      return name.includes(q) || collegeId.includes(q);
    })
    .sort((a, b) => String(readDoc(a, 'name', '') || '').localeCompare(String(readDoc(b, 'name', '') || '')))
    .slice(0, 20)
    .map((row) => ({
      _id: readDoc(row, '_id'),
      name: readDoc(row, 'name', ''),
      collegeId: readDoc(row, 'collegeId', ''),
      role: readDoc(row, 'role', ''),
    }));

  const aiCandidate =
    !q || 'cicrai'.includes(q.toLowerCase())
      ? [{ _id: 'cicrai-bot', name: 'CICR AI', collegeId: 'cicrai', role: 'Assistant' }]
      : [];

  res.json([...aiCandidate, ...filteredUsers]);
};

const deleteMessage = async (req, res) => {
  const result = await performDelete(req, req.params.id);
  if (result.error) {
    return res.status(result.error.status).json({ message: result.error.message });
  }
  return res.json(result);
};

const updateMessage = async (req, res) => {
  const id = req.params.id;
  const nextText = String(req.body?.text || '').trim();
  if (!nextText) {
    return res.status(400).json({ message: 'Message text is required' });
  }
  if (nextText.length > 1000) {
    return res.status(400).json({ message: 'Message must be 1000 characters or less' });
  }

  const message = await CommunicationMessage.findById(id).populate('sender', 'name collegeId role');
  if (!message) {
    return res.status(404).json({ message: 'Message not found' });
  }

  if (!canManageMessage(req.user, message)) {
    return res.status(403).json({ message: 'Not authorized to edit this message' });
  }

  if (readDoc(message, 'senderMeta.isAI')) {
    return res.status(400).json({ message: 'AI-generated messages cannot be edited' });
  }

  message.text = nextText;
  message.editedAt = new Date();
  message.editedBy = req.user._id;
  await message.save();

  const fullMessage = await CommunicationMessage.findById(id)
    .populate('sender', 'name collegeId role')
    .populate('mentions', 'name collegeId')
    .populate('editedBy', 'name collegeId role')
    .populate('pinned.pinnedBy', 'name collegeId role');

  const payload = serializeMessage(fullMessage);
  broadcast('update-message', payload, sanitizeConversationId(message.conversationId));
  return res.json(payload);
};

const toggleReaction = async (req, res) => {
  const id = req.params.id;
  const emoji = sanitizeReactionEmoji(req.body?.emoji);
  if (!emoji) {
    return res.status(400).json({ message: 'A valid emoji is required' });
  }

  const message = await CommunicationMessage.findById(id);
  if (!message) {
    return res.status(404).json({ message: 'Message not found' });
  }

  const actorId = String(req.user._id);
  const current = Array.isArray(message.reactions) ? message.reactions : [];
  const idx = current.findIndex((row) => String(row.emoji || '') === emoji);
  if (idx === -1) {
    current.push({ emoji, users: [req.user._id] });
  } else {
    const users = Array.isArray(current[idx].users) ? current[idx].users : [];
    const has = users.some((row) => String(row) === actorId);
    current[idx].users = has
      ? users.filter((row) => String(row) !== actorId)
      : [...users, req.user._id];
    if (current[idx].users.length === 0) {
      current.splice(idx, 1);
    }
  }

  message.reactions = current;
  await message.save();

  const fullMessage = await CommunicationMessage.findById(id)
    .populate('sender', 'name collegeId role')
    .populate('mentions', 'name collegeId')
    .populate('editedBy', 'name collegeId role')
    .populate('pinned.pinnedBy', 'name collegeId role');
  const payload = serializeMessage(fullMessage);
  broadcast('update-message', payload, sanitizeConversationId(message.conversationId));
  return res.json(payload);
};

const setPinned = async (req, res) => {
  if (!isPrivilegedRole(req.user?.role)) {
    return res.status(403).json({ message: 'Only Admin/Head can pin messages' });
  }

  const id = req.params.id;
  const desired = req.body?.pinned;
  const message = await CommunicationMessage.findById(id);
  if (!message) {
    return res.status(404).json({ message: 'Message not found' });
  }

  const nextPinned =
    typeof desired === 'boolean' ? desired : !Boolean(readDoc(message, 'pinned.isPinned', false));

  message.pinned = {
    isPinned: nextPinned,
    pinnedBy: nextPinned ? req.user._id : null,
    pinnedAt: nextPinned ? new Date() : null,
  };
  await message.save();

  const fullMessage = await CommunicationMessage.findById(id)
    .populate('sender', 'name collegeId role')
    .populate('mentions', 'name collegeId')
    .populate('editedBy', 'name collegeId role')
    .populate('pinned.pinnedBy', 'name collegeId role');
  const payload = serializeMessage(fullMessage);
  broadcast('update-message', payload, sanitizeConversationId(message.conversationId));
  return res.json(payload);
};

const reportTyping = async (req, res) => {
  const conversationId = sanitizeConversationId(req.body?.conversationId || req.query?.conversationId);
  const isTyping = !!req.body?.isTyping;
  const payload = {
    conversationId,
    user: {
      _id: String(req.user?._id || ''),
      name: String(req.user?.name || ''),
      collegeId: String(req.user?.collegeId || ''),
      role: String(req.user?.role || ''),
    },
    isTyping,
    at: new Date().toISOString(),
  };
  broadcast('typing', payload, conversationId);
  return res.json({ success: true });
};

module.exports = {
  listMessages,
  streamMessages,
  createMessage,
  listMentionCandidates,
  deleteMessage,
  updateMessage,
  toggleReaction,
  setPinned,
  reportTyping,
};
