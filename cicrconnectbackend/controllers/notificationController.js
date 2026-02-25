const Notification = require('../models/Notification');
const User = require('../models/User');
const { createNotifications } = require('../utils/notificationService');
const { logAudit } = require('../utils/auditLogger');

const listNotifications = async (req, res) => {
  try {
    const limitRaw = Number(req.query.limit || 50);
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 200) : 50;
    const onlyUnread = String(req.query.unread || '').toLowerCase() === 'true';

    const query = { user: req.user.id };
    if (onlyUnread) query.isRead = false;

    const rows = await Notification.find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate('createdBy', 'name role');

    const unreadCount = await Notification.countDocuments({ user: req.user.id, isRead: false });

    return res.json({ unreadCount, items: rows });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

const markNotificationRead = async (req, res) => {
  try {
    const row = await Notification.findOne({ _id: req.params.id, user: req.user.id });
    if (!row) {
      return res.status(404).json({ message: 'Notification not found' });
    }
    row.isRead = true;
    row.readAt = new Date();
    await row.save();
    return res.json({ success: true });
  } catch (err) {
    return res.status(400).json({ message: err.message });
  }
};

const markAllRead = async (req, res) => {
  try {
    await Notification.updateMany(
      { user: req.user.id, isRead: false },
      { $set: { isRead: true, readAt: new Date() } }
    );
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

const broadcastNotification = async (req, res) => {
  try {
    const title = String(req.body.title || '').trim();
    const message = String(req.body.message || '').trim();
    const type = String(req.body.type || 'info').trim().toLowerCase();
    const role = String(req.body.role || 'all').trim();
    const link = String(req.body.link || '').trim();

    if (!title || !message) {
      return res.status(400).json({ message: 'Title and message are required.' });
    }

    const allowedTypes = new Set(['info', 'success', 'warning', 'error', 'action']);
    if (!allowedTypes.has(type)) {
      return res.status(400).json({ message: 'Invalid notification type.' });
    }

    const query = { $or: [{ isVerified: true }, { approvalStatus: 'Approved' }] };
    if (role && role.toLowerCase() !== 'all') {
      query.role = role;
    }

    const recipients = await User.find(query).select('_id');
    const recipientIds = recipients.map((u) => u._id);
    if (!recipientIds.length) {
      return res.status(400).json({ message: 'No recipients matched this broadcast target.' });
    }

    await createNotifications({
      userIds: recipientIds,
      title,
      message,
      type,
      link,
      meta: {
        broadcast: true,
        targetRole: role || 'all',
      },
      createdBy: req.user.id,
    });

    await logAudit({
      actor: req.user.id,
      action: 'NOTIFICATION_BROADCAST_SENT',
      entityType: 'Notification',
      entityId: '',
      after: {
        title,
        type,
        targetRole: role || 'all',
        recipientCount: recipientIds.length,
      },
      req,
    });

    return res.json({
      success: true,
      recipientCount: recipientIds.length,
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

module.exports = {
  listNotifications,
  markNotificationRead,
  markAllRead,
  broadcastNotification,
};
