const Notification = require('../models/Notification');

const uniqueIds = (items = []) => {
  const set = new Set();
  for (const value of items) {
    if (!value) continue;
    set.add(String(value));
  }
  return Array.from(set);
};

const createNotifications = async ({ userIds, title, message, type = 'info', link = '', meta = null, createdBy = null }) => {
  try {
    const ids = uniqueIds(userIds);
    if (!ids.length || !title || !message) return;
    await Notification.insertMany(
      ids.map((id) => ({
        user: id,
        title: String(title).trim(),
        message: String(message).trim(),
        type,
        link,
        meta,
        createdBy: createdBy || null,
      }))
    );
  } catch (err) {
    // Notifications should not break core business flows.
    console.error('notification create failed:', err.message);
  }
};

module.exports = { createNotifications };
