const mongoose = require('mongoose');
const Project = require('../models/Project');
const Event = require('../models/Event');
const User = require('../models/User');
const { createNotifications } = require('../utils/notificationService');
const { logAudit } = require('../utils/auditLogger');

const PROJECT_STATUS_OPTIONS = ['Planning', 'Active', 'On-Hold', 'Delayed', 'Awaiting Review', 'Completed', 'Archived', 'Ongoing'];
const PROJECT_STAGE_OPTIONS = ['Planning', 'Execution', 'Testing', 'Review', 'Deployment'];
const PROJECT_UPDATE_TYPES = ['Comment', 'Blocker', 'Achievement', 'Status'];

const sanitize = (value) => String(value || '').trim();
const toObjectIdString = (value) => sanitize(value);
const resolveId = (value) => {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'object') {
    if (value._id) return String(value._id);
    if (value.id) return String(value.id);
  }
  return String(value);
};
const parseDate = (value) => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};
const normalizeIdList = (input) => {
  if (Array.isArray(input)) {
    return [...new Set(input.map((item) => toObjectIdString(item)).filter(Boolean))];
  }
  if (typeof input === 'string') {
    return [...new Set(input.split(',').map((item) => toObjectIdString(item)).filter(Boolean))];
  }
  return [];
};

const getActorId = (req) => String(req.user?.id || req.user?._id || '');
const isAdmin = (user) => String(user?.role || '').toLowerCase() === 'admin';

const canViewProject = (user, project) => {
  if (!user || !project) return false;
  if (isAdmin(user)) return true;

  const userId = String(user.id || user._id || '');
  if (!userId) return false;

  if (resolveId(project.lead) === userId) return true;
  if (resolveId(project.guide) === userId) return true;

  return (project.team || []).some((memberId) => resolveId(memberId) === userId);
};

const canManageProject = (user, project) => {
  if (!user || !project) return false;
  if (isAdmin(user)) return true;

  const userId = String(user.id || user._id || '');
  return resolveId(project.lead) === userId;
};

const requireAdmin = (req, res) => {
  if (!isAdmin(req.user)) {
    res.status(403).json({ message: 'Only administrators can perform this action.' });
    return false;
  }
  return true;
};

const fetchUsersByIds = async (ids) => {
  if (!ids.length) return [];
  return User.find({ _id: { $in: ids } }).select('_id name role email');
};

const validateStakeholders = async ({ leadId, guideId, teamIds }) => {
  if (!leadId) {
    return { ok: false, message: 'Project lead is required.' };
  }
  if (!guideId) {
    return { ok: false, message: 'Project guide is required.' };
  }
  if (!teamIds.length) {
    return { ok: false, message: 'At least one initial team member is required.' };
  }

  const allIds = [...new Set([leadId, guideId, ...teamIds])];
  const users = await fetchUsersByIds(allIds);
  if (users.length !== allIds.length) {
    return { ok: false, message: 'Some selected stakeholders were not found.' };
  }

  return { ok: true, users };
};

const normalizeProjectPayload = async (payload) => {
  const title = sanitize(payload.title);
  const description = sanitize(payload.description);
  const domain = sanitize(payload.domain) || 'Tech';
  const components = Array.isArray(payload.components)
    ? payload.components.map((item) => sanitize(item)).filter(Boolean)
    : sanitize(payload.components)
        .split(',')
        .map((item) => sanitize(item))
        .filter(Boolean);

  const startTime = parseDate(payload.startTime);
  const deadline = parseDate(payload.deadline);

  const leadId = toObjectIdString(payload.lead);
  const guideId = toObjectIdString(payload.guide);
  const teamIds = normalizeIdList(payload.team);

  if (!title || title.length < 4) {
    return { ok: false, message: 'Project name must be at least 4 characters.' };
  }
  if (!description || description.length < 20) {
    return { ok: false, message: 'Project description must be at least 20 characters.' };
  }
  if (!components.length) {
    return { ok: false, message: 'At least one required component/resource is mandatory.' };
  }
  if (!startTime || !deadline) {
    return { ok: false, message: 'Project start time and deadline are required.' };
  }
  if (deadline <= startTime) {
    return { ok: false, message: 'Project deadline must be later than start time.' };
  }
  if (domain && !['Tech', 'Management', 'PR'].includes(domain)) {
    return { ok: false, message: 'Invalid domain value.' };
  }

  const stakeholderValidation = await validateStakeholders({ leadId, guideId, teamIds });
  if (!stakeholderValidation.ok) {
    return stakeholderValidation;
  }

  const normalizedTeam = [...new Set([...teamIds, leadId])];

  return {
    ok: true,
    project: {
      title,
      description,
      domain,
      components,
      startTime,
      deadline,
      lead: leadId,
      guide: guideId,
      team: normalizedTeam,
      stage: PROJECT_STAGE_OPTIONS.includes(sanitize(payload.stage)) ? sanitize(payload.stage) : 'Planning',
      progress: 0,
      status: 'Planning',
    },
  };
};

const populateProject = (query) =>
  query
    .populate('event', 'title type startTime endTime status')
    .populate('lead', 'name email role collegeId')
    .populate('guide', 'name email role collegeId')
    .populate('team', 'name email role collegeId year branch')
    .populate('updates.createdBy', 'name role collegeId')
    .populate('statusHistory.changedBy', 'name role collegeId')
    .populate('suggestions.author', 'name role collegeId');

/**
 * @desc    Create a project (Admin only)
 * @route   POST /api/projects
 * @access  Private (Admin)
 */
const createProject = async (req, res) => {
  try {
    if (!requireAdmin(req, res)) return;

    const eventId = sanitize(req.body.eventId);
    if (!eventId || !mongoose.Types.ObjectId.isValid(eventId)) {
      return res.status(400).json({ message: 'A valid event is required to create a project.' });
    }

    const event = await Event.findById(eventId).select('_id title projects');
    if (!event) {
      return res.status(404).json({ message: 'Event not found.' });
    }

    const normalized = await normalizeProjectPayload(req.body);
    if (!normalized.ok) {
      return res.status(400).json({ message: normalized.message });
    }

    const actorId = getActorId(req);
    const project = await Project.create({
      ...normalized.project,
      event: event._id,
      statusHistory: [
        {
          status: 'Planning',
          changedBy: actorId,
          note: 'Project initialized under event.',
          changedAt: new Date(),
        },
      ],
      lastStatusChangedAt: new Date(),
    });

    event.projects = [...new Set([...(event.projects || []).map((id) => String(id)), String(project._id)])];
    await event.save();

    const notifyUsers = [...new Set([normalized.project.lead, normalized.project.guide, ...normalized.project.team])]
      .filter((id) => String(id) !== actorId);

    if (notifyUsers.length) {
      await createNotifications({
        userIds: notifyUsers,
        title: 'New Project Assignment',
        message: `You were assigned to project "${project.title}" under event "${event.title}".`,
        type: 'action',
        link: `/projects/${project._id}`,
        meta: { projectId: project._id, eventId: event._id },
        createdBy: actorId,
      });
    }

    await logAudit({
      actor: actorId,
      action: 'PROJECT_CREATED',
      entityType: 'Project',
      entityId: project._id,
      after: {
        title: project.title,
        event: String(event._id),
        lead: String(project.lead),
        guide: String(project.guide),
        teamCount: project.team.length,
      },
      req,
    });

    const populated = await populateProject(Project.findById(project._id));
    return res.status(201).json(populated);
  } catch (err) {
    return res.status(400).json({ message: err.message });
  }
};

/**
 * @desc    Get all projects visible to current user
 * @route   GET /api/projects
 * @access  Private
 */
const getAllProjects = async (req, res) => {
  try {
    const query = {};
    const eventId = sanitize(req.query.eventId);
    const status = sanitize(req.query.status);

    if (eventId && mongoose.Types.ObjectId.isValid(eventId)) {
      query.event = eventId;
    }
    if (status) {
      query.status = status;
    }

    if (!isAdmin(req.user)) {
      const actorId = getActorId(req);
      query.$or = [{ lead: actorId }, { guide: actorId }, { team: actorId }];
    }

    const projects = await populateProject(
      Project.find(query).sort({ deadline: 1, createdAt: -1 })
    );

    return res.json(projects);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

/**
 * @desc    Get project by id
 * @route   GET /api/projects/:id
 * @access  Private
 */
const getProjectById = async (req, res) => {
  try {
    const project = await populateProject(Project.findById(req.params.id));
    if (!project) {
      return res.status(404).json({ message: 'Project not found.' });
    }

    if (!canViewProject(req.user, project)) {
      return res.status(403).json({ message: 'You do not have access to this project.' });
    }

    return res.json(project);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

/**
 * @desc    Update team members for a project
 * @route   PATCH /api/projects/:id/team
 * @access  Private (Lead/Admin)
 */
const updateProjectTeam = async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) {
      return res.status(404).json({ message: 'Project not found.' });
    }

    if (!canManageProject(req.user, project)) {
      return res.status(403).json({ message: 'Only project lead or admin can update team composition.' });
    }

    const addMemberIds = normalizeIdList(req.body.addMemberIds);
    const removeMemberIds = normalizeIdList(req.body.removeMemberIds);

    const allIncoming = [...new Set([...addMemberIds, ...removeMemberIds])];
    if (allIncoming.length) {
      const members = await fetchUsersByIds(allIncoming);
      if (members.length !== allIncoming.length) {
        return res.status(400).json({ message: 'One or more selected members were not found.' });
      }
    }

    let nextTeam = [...new Set((project.team || []).map((id) => String(id)))];

    if (addMemberIds.length) {
      nextTeam = [...new Set([...nextTeam, ...addMemberIds])];
    }

    if (removeMemberIds.length) {
      nextTeam = nextTeam.filter((id) => !removeMemberIds.includes(String(id)));
    }

    // Keep lead in team at all times.
    const leadId = String(project.lead || '');
    if (leadId && !nextTeam.includes(leadId)) {
      nextTeam.push(leadId);
    }

    project.team = nextTeam;
    await project.save();

    if (addMemberIds.length) {
      await createNotifications({
        userIds: addMemberIds,
        title: 'Project Team Updated',
        message: `You were added to project "${project.title}".`,
        type: 'action',
        link: `/projects/${project._id}`,
        meta: { projectId: project._id },
        createdBy: getActorId(req),
      });
    }

    await logAudit({
      actor: getActorId(req),
      action: 'PROJECT_TEAM_UPDATED',
      entityType: 'Project',
      entityId: project._id,
      after: {
        added: addMemberIds,
        removed: removeMemberIds,
        teamCount: project.team.length,
      },
      req,
    });

    const populated = await populateProject(Project.findById(project._id));
    return res.json(populated);
  } catch (err) {
    return res.status(400).json({ message: err.message });
  }
};

/**
 * @desc    Update project progress/stage
 * @route   PATCH /api/projects/:id/progress
 * @access  Private (Lead/Admin)
 */
const updateProjectProgress = async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) {
      return res.status(404).json({ message: 'Project not found.' });
    }

    if (!canManageProject(req.user, project)) {
      return res.status(403).json({ message: 'Only project lead or admin can update progress.' });
    }

    const nextProgress = Number(req.body.progress);
    if (!Number.isFinite(nextProgress) || nextProgress < 0 || nextProgress > 100) {
      return res.status(400).json({ message: 'Progress must be between 0 and 100.' });
    }

    const stage = sanitize(req.body.stage);
    if (stage && !PROJECT_STAGE_OPTIONS.includes(stage)) {
      return res.status(400).json({ message: 'Invalid stage value.' });
    }

    project.progress = Math.round(nextProgress);
    if (stage) {
      project.stage = stage;
    }

    const actorId = getActorId(req);
    const note = sanitize(req.body.note);

    if (project.progress === 100 && project.status !== 'Completed') {
      project.status = 'Awaiting Review';
      project.lastStatusChangedAt = new Date();
      project.statusHistory.unshift({
        status: 'Awaiting Review',
        changedBy: actorId,
        note: note || 'Progress reached 100% and moved for admin review.',
        changedAt: new Date(),
      });
    }

    if (note) {
      const type = PROJECT_UPDATE_TYPES.includes(sanitize(req.body.type)) ? sanitize(req.body.type) : 'Status';
      project.updates.unshift({
        type,
        text: note,
        createdBy: actorId,
        createdAt: new Date(),
      });
    }

    await project.save();

    await logAudit({
      actor: actorId,
      action: 'PROJECT_PROGRESS_UPDATED',
      entityType: 'Project',
      entityId: project._id,
      after: {
        progress: project.progress,
        stage: project.stage,
        status: project.status,
      },
      req,
    });

    const populated = await populateProject(Project.findById(project._id));
    return res.json(populated);
  } catch (err) {
    return res.status(400).json({ message: err.message });
  }
};

/**
 * @desc    Update project status (admin global control)
 * @route   PATCH /api/projects/:id/status
 * @access  Private (Admin)
 */
const updateProjectStatus = async (req, res) => {
  try {
    if (!requireAdmin(req, res)) return;

    const project = await Project.findById(req.params.id);
    if (!project) {
      return res.status(404).json({ message: 'Project not found.' });
    }

    const status = sanitize(req.body.status);
    if (!PROJECT_STATUS_OPTIONS.includes(status)) {
      return res.status(400).json({ message: 'Invalid project status.' });
    }

    if (status !== project.status) {
      project.status = status;
      project.lastStatusChangedAt = new Date();
      project.statusHistory.unshift({
        status,
        changedBy: getActorId(req),
        note: sanitize(req.body.note),
        changedAt: new Date(),
      });

      if (status === 'Completed') {
        project.completedAt = new Date();
        if (project.progress < 100) {
          project.progress = 100;
        }
      } else if (project.completedAt) {
        project.completedAt = null;
      }
    }

    const note = sanitize(req.body.note);
    if (note) {
      project.updates.unshift({
        type: 'Status',
        text: note,
        createdBy: getActorId(req),
        createdAt: new Date(),
      });
    }

    await project.save();

    await logAudit({
      actor: getActorId(req),
      action: 'PROJECT_STATUS_UPDATED',
      entityType: 'Project',
      entityId: project._id,
      after: {
        status: project.status,
        progress: project.progress,
      },
      req,
    });

    const populated = await populateProject(Project.findById(project._id));
    return res.json(populated);
  } catch (err) {
    return res.status(400).json({ message: err.message });
  }
};

/**
 * @desc    Delete a project
 * @route   DELETE /api/projects/:id
 * @access  Private (Admin)
 */
const deleteProject = async (req, res) => {
  try {
    if (!requireAdmin(req, res)) return;

    const project = await Project.findById(req.params.id);
    if (!project) {
      return res.status(404).json({ message: 'Project not found.' });
    }

    const before = {
      title: project.title,
      event: project.event ? String(project.event) : null,
      lead: String(project.lead || ''),
      guide: String(project.guide || ''),
      teamCount: Array.isArray(project.team) ? project.team.length : 0,
      status: project.status,
      progress: project.progress,
    };

    if (project.event) {
      await Event.findByIdAndUpdate(project.event, { $pull: { projects: project._id } });
    }

    await project.deleteOne();

    await logAudit({
      actor: getActorId(req),
      action: 'PROJECT_DELETED',
      entityType: 'Project',
      entityId: req.params.id,
      before,
      req,
    });

    return res.json({ success: true, message: 'Project deleted.' });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

/**
 * @desc    Add an operational project update
 * @route   POST /api/projects/:id/updates
 * @access  Private (Lead/Admin)
 */
const addProjectUpdate = async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) {
      return res.status(404).json({ message: 'Project not found.' });
    }

    if (!canManageProject(req.user, project)) {
      return res.status(403).json({ message: 'Only project lead or admin can publish updates.' });
    }

    const text = sanitize(req.body.text);
    if (!text) {
      return res.status(400).json({ message: 'Update text is required.' });
    }

    const type = PROJECT_UPDATE_TYPES.includes(sanitize(req.body.type)) ? sanitize(req.body.type) : 'Comment';

    project.updates.unshift({
      type,
      text,
      createdBy: getActorId(req),
      createdAt: new Date(),
    });

    await project.save();

    await logAudit({
      actor: getActorId(req),
      action: 'PROJECT_UPDATE_ADDED',
      entityType: 'Project',
      entityId: project._id,
      after: {
        type,
        text,
      },
      req,
    });

    const populated = await populateProject(Project.findById(project._id));
    return res.status(201).json(populated);
  } catch (err) {
    return res.status(400).json({ message: err.message });
  }
};

/**
 * @desc    Legacy suggestions (kept for compatibility)
 * @route   POST /api/projects/:id/suggestions
 * @access  Private
 */
const addSuggestion = async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) {
      return res.status(404).json({ message: 'Project not found.' });
    }

    if (!canManageProject(req.user, project)) {
      return res.status(403).json({ message: 'Only project lead or admin can add suggestions.' });
    }

    const text = sanitize(req.body.text);
    if (!text) {
      return res.status(400).json({ message: 'Suggestion text is required.' });
    }

    project.suggestions.unshift({
      text,
      author: getActorId(req),
      createdAt: new Date(),
    });

    await project.save();
    return res.status(201).json(project.suggestions);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

module.exports = {
  createProject,
  getAllProjects,
  getProjectById,
  updateProjectTeam,
  updateProjectProgress,
  updateProjectStatus,
  deleteProject,
  addProjectUpdate,
  addSuggestion,
};
