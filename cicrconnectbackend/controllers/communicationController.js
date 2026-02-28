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

const serializeMessage = (messageDoc) => ({
  _id: messageDoc._id,
  conversationId: sanitizeConversationId(messageDoc.conversationId),
  text: messageDoc.text,
  sender:
    messageDoc.sender
      ? {
          _id: messageDoc.sender._id,
          name: messageDoc.sender.name,
          collegeId: messageDoc.sender.collegeId,
          role: messageDoc.sender.role,
          isAI: false,
        }
      : messageDoc.senderMeta
      ? {
          _id: null,
          name: messageDoc.senderMeta.name,
          collegeId: messageDoc.senderMeta.collegeId,
          role: messageDoc.senderMeta.role,
          isAI: !!messageDoc.senderMeta.isAI,
        }
      : null,
  replyTo: messageDoc.replyTo || null,
  mentions: Array.isArray(messageDoc.mentions)
    ? messageDoc.mentions.map((m) => ({
        _id: m._id,
        name: m.name,
        collegeId: m.collegeId,
      }))
    : [],
  createdAt: messageDoc.createdAt,
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
        const name = m.sender?.name || m.senderMeta?.name || 'Member';
        return `${name}: ${m.text}`;
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

  const role = String(req.user.role || '').toLowerCase();
  const isPrivileged = role === 'admin' || role === 'head';
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
    .populate('mentions', 'name collegeId');

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
        text: String(parent.text || '').slice(0, 180),
        senderName: parent.sender?.name || parent.senderMeta?.name || 'Member',
        senderCollegeId: parent.sender?.collegeId || parent.senderMeta?.collegeId || '',
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
    .populate('mentions', 'name collegeId');

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
      title: `Mentioned by ${req.user.name || 'Member'}`,
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
      const name = String(row.name || '').toLowerCase();
      const collegeId = String(row.collegeId || '').toLowerCase();
      return name.includes(q) || collegeId.includes(q);
    })
    .sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')))
    .slice(0, 20)
    .map((row) => ({
      _id: row._id,
      name: row.name,
      collegeId: row.collegeId,
      role: row.role,
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

module.exports = {
  listMessages,
  streamMessages,
  createMessage,
  listMentionCandidates,
  deleteMessage,
};
