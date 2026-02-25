const Event = require('../models/Event');
const User = require('../models/User');
const { createNotifications } = require('../utils/notificationService');
const { logAudit } = require('../utils/auditLogger');

const sanitize = (value) => String(value || '').trim();
const parseDate = (value) => {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
};
const EVENT_STATUSES = ['Scheduled', 'Completed', 'Cancelled'];

const createEvent = async (req, res) => {
  try {
    const title = sanitize(req.body.title);
    const location = sanitize(req.body.location);
    const description = sanitize(req.body.description);
    const type = sanitize(req.body.type) || 'Internal';
    const requestedStatus = sanitize(req.body.status);
    const status = requestedStatus || 'Scheduled';
    const startTime = parseDate(req.body.startTime);
    const endTime = parseDate(req.body.endTime);
    const allowApplications = !!req.body.allowApplications;
    const applicationDeadline = parseDate(req.body.applicationDeadline);
    const capacity = req.body.capacity ? Number(req.body.capacity) : null;

    if (!title || !location || !startTime || !endTime) {
      return res.status(400).json({ message: 'Title, location, start time, and end time are required.' });
    }
    if (endTime < startTime) {
      return res.status(400).json({ message: 'End time must be after start time.' });
    }
    if (!EVENT_STATUSES.includes(status)) {
      return res.status(400).json({ message: 'Invalid event status value.' });
    }
    if (capacity !== null && (!Number.isInteger(capacity) || capacity < 1)) {
      return res.status(400).json({ message: 'Capacity must be a positive integer.' });
    }
    if (allowApplications && !applicationDeadline) {
      return res.status(400).json({ message: 'Application deadline is required when applications are enabled.' });
    }
    if (applicationDeadline && applicationDeadline > startTime) {
      return res.status(400).json({ message: 'Application deadline must be on or before event start time.' });
    }

    const event = await Event.create({
      title,
      description,
      type,
      location,
      startTime,
      endTime,
      status,
      capacity,
      allowApplications,
      applicationDeadline: allowApplications ? applicationDeadline : null,
      createdBy: req.user.id,
    });

    const populated = await event.populate('createdBy', 'name role');

    const recipients = await User.find({
      $or: [{ isVerified: true }, { approvalStatus: 'Approved' }],
    }).select('_id');
    await createNotifications({
      userIds: recipients.map((u) => u._id),
      title: 'New CICR Event',
      message: `${title} is now scheduled at ${location}.`,
      type: allowApplications ? 'action' : 'info',
      link: '/events',
      meta: { eventId: event._id, allowApplications },
      createdBy: req.user.id,
    });

    await logAudit({
      actor: req.user.id,
      action: 'EVENT_CREATED',
      entityType: 'Event',
      entityId: event._id,
      after: {
        title,
        type,
        status,
        startTime,
        endTime,
      },
      req,
    });

    res.status(201).json(populated);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

const getEvents = async (req, res) => {
  try {
    const query = {};
    if (req.query.status) {
      query.status = req.query.status;
    }
    if (req.query.allowApplications) {
      query.allowApplications = req.query.allowApplications === 'true';
    }

    const events = await Event.find(query)
      .populate('createdBy', 'name role')
      .sort({ startTime: 1 });
    res.json(events);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getEventById = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id).populate('createdBy', 'name role');
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }
    res.json(event);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const updateEvent = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    const before = {
      title: event.title,
      status: event.status,
      allowApplications: event.allowApplications,
      startTime: event.startTime,
      endTime: event.endTime,
    };

    if (Object.prototype.hasOwnProperty.call(req.body, 'title')) {
      event.title = sanitize(req.body.title);
    }
    if (Object.prototype.hasOwnProperty.call(req.body, 'description')) {
      event.description = sanitize(req.body.description);
    }
    if (Object.prototype.hasOwnProperty.call(req.body, 'type')) {
      event.type = sanitize(req.body.type);
    }
    if (Object.prototype.hasOwnProperty.call(req.body, 'location')) {
      event.location = sanitize(req.body.location);
    }
    if (Object.prototype.hasOwnProperty.call(req.body, 'status')) {
      const status = sanitize(req.body.status);
      if (!EVENT_STATUSES.includes(status)) {
        return res.status(400).json({ message: 'Invalid event status value.' });
      }
      event.status = status;
    }
    if (Object.prototype.hasOwnProperty.call(req.body, 'capacity')) {
      if (!req.body.capacity) {
        event.capacity = null;
      } else {
        const capacity = Number(req.body.capacity);
        if (!Number.isInteger(capacity) || capacity < 1) {
          return res.status(400).json({ message: 'Capacity must be a positive integer.' });
        }
        event.capacity = capacity;
      }
    }
    if (Object.prototype.hasOwnProperty.call(req.body, 'allowApplications')) {
      event.allowApplications = !!req.body.allowApplications;
    }
    if (Object.prototype.hasOwnProperty.call(req.body, 'applicationDeadline')) {
      const deadline = parseDate(req.body.applicationDeadline);
      if (req.body.applicationDeadline && !deadline) {
        return res.status(400).json({ message: 'Invalid application deadline value.' });
      }
      event.applicationDeadline = deadline;
    }
    if (Object.prototype.hasOwnProperty.call(req.body, 'startTime')) {
      const parsed = parseDate(req.body.startTime);
      if (!parsed) {
        return res.status(400).json({ message: 'Invalid start time value.' });
      }
      event.startTime = parsed;
    }
    if (Object.prototype.hasOwnProperty.call(req.body, 'endTime')) {
      const parsed = parseDate(req.body.endTime);
      if (!parsed) {
        return res.status(400).json({ message: 'Invalid end time value.' });
      }
      event.endTime = parsed;
    }

    if (event.endTime < event.startTime) {
      return res.status(400).json({ message: 'End time must be after start time.' });
    }
    if (event.allowApplications && !event.applicationDeadline) {
      return res.status(400).json({ message: 'Application deadline is required when applications are enabled.' });
    }
    if (event.applicationDeadline && event.applicationDeadline > event.startTime) {
      return res.status(400).json({ message: 'Application deadline must be on or before event start time.' });
    }
    if (!event.allowApplications) {
      event.applicationDeadline = null;
    }

    const updated = await event.save();
    const populated = await updated.populate('createdBy', 'name role');

    await logAudit({
      actor: req.user.id,
      action: 'EVENT_UPDATED',
      entityType: 'Event',
      entityId: event._id,
      before,
      after: {
        title: event.title,
        status: event.status,
        allowApplications: event.allowApplications,
        startTime: event.startTime,
        endTime: event.endTime,
      },
      req,
    });

    res.json(populated);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

const deleteEvent = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }
    const before = {
      title: event.title,
      status: event.status,
      startTime: event.startTime,
      endTime: event.endTime,
    };
    await event.deleteOne();

    await logAudit({
      actor: req.user.id,
      action: 'EVENT_DELETED',
      entityType: 'Event',
      entityId: req.params.id,
      before,
      req,
    });

    res.json({ success: true, message: 'Event deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = {
  createEvent,
  getEvents,
  getEventById,
  updateEvent,
  deleteEvent,
};
