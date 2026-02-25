const CommunicationMessage = require('../models/CommunicationMessage');
const User = require('../models/User');
const Project = require('../models/Project');
const { geminiGenerate } = require('../utils/geminiClient');

const sseClients = new Set();
const userLastMessageAt = new Map();
const AI_MENTION_TOKEN = '@cicrai';
const DOMAIN_SCOPE_HINT =
  'You must answer only CICR-related topics and technology domains: robotics, programming, software, hardware, AI/ML, cybersecurity, IoT, embedded, electronics, networking, product building, and project workflows. If question is outside this scope or nonsense, refuse briefly and ask a relevant CICR/tech question instead.';
const escapeRegex = (value) => String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const serializeMessage = (messageDoc) => ({
  _id: messageDoc._id,
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

const broadcast = (event, payload) => {
  const data = `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
  for (const res of sseClients) {
    res.write(data);
  }
};

const parseMentionCollegeIds = (text) => {
  const ids = new Set();
  const matches = String(text).match(/@([a-zA-Z0-9._-]{3,40})/g) || [];
  for (const token of matches) {
    ids.add(token.slice(1));
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
    const lower = String(message.text || '').toLowerCase();
    if (!lower.includes(AI_MENTION_TOKEN)) return;

    const question = String(message.text || '')
      .replace(/@cicrai/gi, '')
      .trim();

    if (!question) return;

    const recent = await CommunicationMessage.find({})
      .sort({ createdAt: -1 })
      .limit(12)
      .populate('sender', 'name collegeId role')
      .lean();
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
    broadcast('new-message', payload);
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
  broadcast('delete-message', { _id: String(message._id) });
  return { success: true, _id: String(message._id) };
};

const listMessages = async (req, res) => {
  const limitRaw = Number(req.query.limit || 100);
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 200) : 100;

  const messages = await CommunicationMessage.find({})
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate('sender', 'name collegeId role')
    .populate('mentions', 'name collegeId')
    .lean();

  res.json(messages.reverse().map(serializeMessage));
};

const streamMessages = async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();
  res.write('retry: 10000\n\n');

  sseClients.add(res);
  req.on('close', () => {
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
    ? await User.find({ collegeId: { $in: mentionCollegeIds } }).select('_id')
    : [];

  let replyTo = undefined;
  if (req.body.replyToId) {
    const parent = await CommunicationMessage.findById(req.body.replyToId)
      .populate('sender', 'name collegeId')
      .lean();
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
    text,
    sender: req.user._id,
    mentions: mentionUsers.map((u) => u._id),
    replyTo,
  });

  const fullMessage = await CommunicationMessage.findById(created._id)
    .populate('sender', 'name collegeId role')
    .populate('mentions', 'name collegeId');

  const payload = serializeMessage(fullMessage);
  broadcast('new-message', payload);
  queueAiReply(fullMessage);

  res.status(201).json(payload);
};

const listMentionCandidates = async (req, res) => {
  const q = String(req.query.q || '').trim();
  const safeQuery = escapeRegex(q);
  const filter = q
    ? {
        $or: [
          { collegeId: { $regex: safeQuery, $options: 'i' } },
          { name: { $regex: safeQuery, $options: 'i' } },
        ],
      }
    : {};

  const users = await User.find(filter)
    .select('name collegeId role')
    .sort({ name: 1 })
    .limit(20)
    .lean();

  const aiCandidate =
    !q || 'cicrai'.includes(q.toLowerCase())
      ? [{ _id: 'cicrai-bot', name: 'CICR AI', collegeId: 'cicrai', role: 'Assistant' }]
      : [];

  res.json([...aiCandidate, ...users]);
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
