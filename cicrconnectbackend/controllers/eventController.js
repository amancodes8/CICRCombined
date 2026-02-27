const Event = require('../models/Event');
const Project = require('../models/Project');
const User = require('../models/User');
const { createNotifications } = require('../utils/notificationService');
const { logAudit } = require('../utils/auditLogger');

const sanitize = (value) => String(value || '').trim();
const parseDate = (value) => {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
};

const normalizeIdList = (input) => {
  if (Array.isArray(input)) {
    return [...new Set(input.map((item) => sanitize(item)).filter(Boolean))];
  }
  if (typeof input === 'string') {
    return [...new Set(input.split(',').map((item) => sanitize(item)).filter(Boolean))];
  }
  return [];
};

const EVENT_STATUSES = ['Scheduled', 'Completed', 'Cancelled'];
const PROJECT_STAGES = ['Planning', 'Execution', 'Testing', 'Review', 'Deployment'];
const PROJECT_DOMAINS = ['Tech', 'Management', 'PR'];

const normalizeProjectSeed = (seed, index = 0) => {
  const title = sanitize(seed?.title);
  const description = sanitize(seed?.description);
  const domain = sanitize(seed?.domain) || 'Tech';
  const components = Array.isArray(seed?.components)
    ? seed.components.map((item) => sanitize(item)).filter(Boolean)
    : sanitize(seed?.components)
        .split(',')
        .map((item) => sanitize(item))
        .filter(Boolean);

  const startTime = parseDate(seed?.startTime);
  const deadline = parseDate(seed?.deadline);
  const lead = sanitize(seed?.lead);
  const guide = sanitize(seed?.guide);
  const team = normalizeIdList(seed?.team);
  const stage = sanitize(seed?.stage);

  const row = index + 1;

  if (!title || title.length < 4) {
    return { ok: false, message: `Project ${row}: title must be at least 4 characters.` };
  }
  if (!description || description.length < 20) {
    return { ok: false, message: `Project ${row}: description must be at least 20 characters.` };
  }
  if (!components.length) {
    return { ok: false, message: `Project ${row}: at least one component/resource is required.` };
  }
  if (!startTime || !deadline) {
    return { ok: false, message: `Project ${row}: start time and deadline are required.` };
  }
  if (deadline <= startTime) {
    return { ok: false, message: `Project ${row}: deadline must be after start time.` };
  }
  if (!lead || !guide) {
    return { ok: false, message: `Project ${row}: both lead and guide are required.` };
  }
  if (!team.length) {
    return { ok: false, message: `Project ${row}: at least one team member is required.` };
  }
  if (!PROJECT_DOMAINS.includes(domain)) {
    return { ok: false, message: `Project ${row}: invalid domain value.` };
  }
  if (stage && !PROJECT_STAGES.includes(stage)) {
    return { ok: false, message: `Project ${row}: invalid stage value.` };
  }

  const normalizedTeam = [...new Set([...team, lead])];

  return {
    ok: true,
    project: {
      title,
      description,
      domain,
      components,
      startTime,
      deadline,
      lead,
      guide,
      team: normalizedTeam,
      stage: stage || 'Planning',
      progress: 0,
      status: 'Planning',
    },
  };
};

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

    const seedRows = Array.isArray(req.body.projects) ? req.body.projects : [];
    const normalizedSeeds = [];

    for (let i = 0; i < seedRows.length; i += 1) {
      const normalized = normalizeProjectSeed(seedRows[i], i);
      if (!normalized.ok) {
        return res.status(400).json({ message: normalized.message });
      }
      normalizedSeeds.push(normalized.project);
    }

    if (normalizedSeeds.length) {
      const requiredUserIds = [
        ...new Set(
          normalizedSeeds.flatMap((row) => [row.lead, row.guide, ...(row.team || [])])
        ),
      ];
      const users = await User.find({ _id: { $in: requiredUserIds } }).select('_id');
      if (users.length !== requiredUserIds.length) {
        return res.status(400).json({ message: 'One or more selected project stakeholders were not found.' });
      }
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
      projects: [],
    });

    let createdProjects = [];
    if (normalizedSeeds.length) {
      const actorId = String(req.user.id);
      createdProjects = await Project.insertMany(
        normalizedSeeds.map((row) => ({
          ...row,
          event: event._id,
          lastEditedBy: actorId,
          lastEditedAt: new Date(),
          lastEditedAction: 'Initialized by admin',
          statusHistory: [
            {
              status: 'Planning',
              changedBy: actorId,
              note: 'Project initialized while creating event.',
              changedAt: new Date(),
            },
          ],
          lastStatusChangedAt: new Date(),
        }))
      );

      event.projects = createdProjects.map((row) => row._id);
      await event.save();

      const assignedUsers = [
        ...new Set(
          createdProjects.flatMap((row) => [
            String(row.lead || ''),
            String(row.guide || ''),
            ...(row.team || []).map((memberId) => String(memberId)),
          ])
        ),
      ].filter((id) => id && id !== actorId);

      if (assignedUsers.length) {
        await createNotifications({
          userIds: assignedUsers,
          title: 'Event Projects Assigned',
          message: `You were assigned to a project under event "${title}".`,
          type: 'action',
          link: '/projects',
          meta: { eventId: event._id, projectCount: createdProjects.length },
          createdBy: req.user.id,
        });
      }
    }

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
      meta: { eventId: event._id, allowApplications, projectCount: createdProjects.length },
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
        projectCount: createdProjects.length,
      },
      req,
    });

    return res.status(201).json({
      ...populated.toObject(),
      projectCount: createdProjects.length,
    });
  } catch (err) {
    return res.status(400).json({ message: err.message });
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

    const payload = events.map((row) => ({
      ...row.toObject(),
      projectCount: Array.isArray(row.projects) ? row.projects.length : 0,
    }));

    return res.json(payload);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

const getEventById = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id)
      .populate('createdBy', 'name role')
      .populate({
        path: 'projects',
        select:
          'title description domain components startTime deadline status progress stage lead guide team updates statusHistory lastEditedBy lastEditedAt lastEditedAction createdAt updatedAt completedAt',
        populate: [
          { path: 'lead', select: 'name role email collegeId year branch' },
          { path: 'guide', select: 'name role email collegeId year branch' },
          { path: 'team', select: 'name role email collegeId year branch batch phone' },
          { path: 'lastEditedBy', select: 'name role email collegeId' },
          { path: 'updates.createdBy', select: 'name role email collegeId' },
          { path: 'statusHistory.changedBy', select: 'name role email collegeId' },
        ],
      });

    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    return res.json({
      ...event.toObject(),
      projectCount: Array.isArray(event.projects) ? event.projects.length : 0,
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
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
        const parsedCapacity = Number(req.body.capacity);
        if (!Number.isInteger(parsedCapacity) || parsedCapacity < 1) {
          return res.status(400).json({ message: 'Capacity must be a positive integer.' });
        }
        event.capacity = parsedCapacity;
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
      const parsedStart = parseDate(req.body.startTime);
      if (!parsedStart) {
        return res.status(400).json({ message: 'Invalid start time value.' });
      }
      event.startTime = parsedStart;
    }
    if (Object.prototype.hasOwnProperty.call(req.body, 'endTime')) {
      const parsedEnd = parseDate(req.body.endTime);
      if (!parsedEnd) {
        return res.status(400).json({ message: 'Invalid end time value.' });
      }
      event.endTime = parsedEnd;
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

    return res.json({
      ...populated.toObject(),
      projectCount: Array.isArray(populated.projects) ? populated.projects.length : 0,
    });
  } catch (err) {
    return res.status(400).json({ message: err.message });
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
      projectCount: Array.isArray(event.projects) ? event.projects.length : 0,
    };

    const deletedProjects = await Project.deleteMany({ event: event._id });
    await event.deleteOne();

    await logAudit({
      actor: req.user.id,
      action: 'EVENT_DELETED',
      entityType: 'Event',
      entityId: req.params.id,
      before,
      after: {
        deletedProjects: deletedProjects.deletedCount || 0,
      },
      req,
    });

    return res.json({
      success: true,
      message: 'Event deleted',
      deletedProjects: deletedProjects.deletedCount || 0,
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

module.exports = {
  createEvent,
  getEvents,
  getEventById,
  updateEvent,
  deleteEvent,
};
