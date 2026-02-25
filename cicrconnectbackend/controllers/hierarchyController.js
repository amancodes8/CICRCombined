const MentorshipTask = require('../models/MentorshipTask');
const User = require('../models/User');
const { isAdminOrHead, parseYear, canManageJunior } = require('../utils/hierarchy');
const { createNotifications } = require('../utils/notificationService');
const { logAudit } = require('../utils/auditLogger');

const CATEGORY_OPTIONS = ['Project', 'Meeting', 'Learning', 'Operations'];
const PRIORITY_OPTIONS = ['Low', 'Medium', 'High'];
const STATUS_OPTIONS = ['Open', 'InProgress', 'Blocked', 'Completed'];

const sanitize = (value) => String(value || '').trim();
const parseDate = (value) => {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
};

const normalizeEnum = (value, allowed, fallback = null) => {
  const raw = sanitize(value);
  if (!raw) return fallback;
  const match = allowed.find((item) => item.toLowerCase() === raw.toLowerCase());
  return match || fallback;
};

const isApprovedMember = (user) => {
  const approval = String(user?.approvalStatus || '').toLowerCase();
  return !!user?.isVerified || approval === 'approved';
};

const taskSnapshot = (task) => ({
  _id: task?._id || null,
  title: task?.title || '',
  status: task?.status || '',
  category: task?.category || '',
  priority: task?.priority || '',
  assignedBy: task?.assignedBy ? String(task.assignedBy) : '',
  assignedTo: task?.assignedTo ? String(task.assignedTo) : '',
  dueDate: task?.dueDate || null,
  completedAt: task?.completedAt || null,
});

const assertHierarchyEligibility = (actor, targetUser) => {
  if (isAdminOrHead(actor)) return '';

  const actorYear = parseYear(actor?.year);
  if (!actorYear || actorYear < 2) {
    return 'Only seniors (2nd year and above) can assign hierarchy tasks.';
  }

  if (!canManageJunior(actor, targetUser)) {
    return 'You can assign tasks only to your year or junior members.';
  }

  return '';
};

const populateTask = (query) =>
  query
    .populate('assignedBy', 'name role year collegeId')
    .populate('assignedTo', 'name role year collegeId')
    .populate('updates.updatedBy', 'name role');

const createTask = async (req, res) => {
  try {
    const title = sanitize(req.body.title);
    const description = sanitize(req.body.description);
    const assignedToId = sanitize(req.body.assignedTo);
    const dueDate = parseDate(req.body.dueDate);

    if (title.length < 4) {
      return res.status(400).json({ message: 'Task title should be at least 4 characters.' });
    }
    if (!assignedToId) {
      return res.status(400).json({ message: 'Assigned member is required.' });
    }
    if (req.body.dueDate && !dueDate) {
      return res.status(400).json({ message: 'Invalid due date value.' });
    }

    const assignee = await User.findById(assignedToId).select('name role year isVerified approvalStatus');
    if (!assignee) {
      return res.status(404).json({ message: 'Assigned member not found.' });
    }
    if (!isApprovedMember(assignee)) {
      return res.status(400).json({ message: 'Assigned member account is not approved yet.' });
    }

    const hierarchyError = assertHierarchyEligibility(req.user, assignee);
    if (hierarchyError) {
      return res.status(403).json({ message: hierarchyError });
    }

    const category = normalizeEnum(req.body.category, CATEGORY_OPTIONS, 'Project');
    const priority = normalizeEnum(req.body.priority, PRIORITY_OPTIONS, 'Medium');

    const task = await MentorshipTask.create({
      title,
      description,
      category,
      priority,
      assignedBy: req.user.id,
      assignedTo: assignee._id,
      dueDate,
      updates: [
        {
          status: 'Open',
          note: sanitize(req.body.note) || 'Task created.',
          updatedBy: req.user.id,
          updatedAt: new Date(),
        },
      ],
    });

    const populated = await populateTask(MentorshipTask.findById(task._id));

    await createNotifications({
      userIds: [assignee._id],
      title: 'New Hierarchy Task Assigned',
      message: `${req.user.name || 'A senior'} assigned: ${title}`,
      type: 'action',
      link: '/hierarchy',
      meta: { taskId: task._id, category },
      createdBy: req.user.id,
    });

    await logAudit({
      actor: req.user.id,
      action: 'HIERARCHY_TASK_CREATED',
      entityType: 'MentorshipTask',
      entityId: task._id,
      after: taskSnapshot(task),
      meta: { assignee: String(assignee._id), category, priority },
      req,
    });

    return res.status(201).json(populated);
  } catch (err) {
    return res.status(400).json({ message: err.message });
  }
};

const listTasks = async (req, res) => {
  try {
    const role = String(req.user.role || '').toLowerCase();
    const scope = sanitize(req.query.scope).toLowerCase();
    const status = normalizeEnum(req.query.status, STATUS_OPTIONS, '');

    const query = {};
    if (status) {
      query.status = status;
    }

    if (role === 'admin' || role === 'head') {
      if (scope === 'created') query.assignedBy = req.user.id;
      if (scope === 'assigned') query.assignedTo = req.user.id;
    } else if (scope === 'created') {
      query.assignedBy = req.user.id;
    } else if (scope === 'assigned') {
      query.assignedTo = req.user.id;
    } else {
      query.$or = [{ assignedBy: req.user.id }, { assignedTo: req.user.id }];
    }

    const rows = await populateTask(
      MentorshipTask.find(query).sort({ createdAt: -1, dueDate: 1 })
    );

    return res.json(rows);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

const updateTask = async (req, res) => {
  try {
    const task = await MentorshipTask.findById(req.params.id);
    if (!task) {
      return res.status(404).json({ message: 'Task not found.' });
    }

    const isPrivileged = isAdminOrHead(req.user);
    const isCreator = String(task.assignedBy) === String(req.user.id);
    const isAssignee = String(task.assignedTo) === String(req.user.id);
    if (!isPrivileged && !isCreator && !isAssignee) {
      return res.status(403).json({ message: 'Not authorized to update this task.' });
    }

    const before = taskSnapshot(task);

    if (Object.prototype.hasOwnProperty.call(req.body, 'assignedTo')) {
      if (!isPrivileged && !isCreator) {
        return res.status(403).json({ message: 'Only task owner can reassign this task.' });
      }

      const nextAssigneeId = sanitize(req.body.assignedTo);
      if (!nextAssigneeId) {
        return res.status(400).json({ message: 'Assigned member is required.' });
      }

      const nextAssignee = await User.findById(nextAssigneeId).select('name role year isVerified approvalStatus');
      if (!nextAssignee) {
        return res.status(404).json({ message: 'Assigned member not found.' });
      }
      if (!isApprovedMember(nextAssignee)) {
        return res.status(400).json({ message: 'Assigned member account is not approved yet.' });
      }

      if (!isPrivileged) {
        const hierarchyError = assertHierarchyEligibility(req.user, nextAssignee);
        if (hierarchyError) {
          return res.status(403).json({ message: hierarchyError });
        }
      }

      task.assignedTo = nextAssignee._id;
    }

    const canEditCore = isPrivileged || isCreator;
    if (Object.prototype.hasOwnProperty.call(req.body, 'title')) {
      if (!canEditCore) return res.status(403).json({ message: 'Only task owner can edit title.' });
      const title = sanitize(req.body.title);
      if (title.length < 4) {
        return res.status(400).json({ message: 'Task title should be at least 4 characters.' });
      }
      task.title = title;
    }

    if (Object.prototype.hasOwnProperty.call(req.body, 'description')) {
      if (!canEditCore) return res.status(403).json({ message: 'Only task owner can edit description.' });
      task.description = sanitize(req.body.description);
    }

    if (Object.prototype.hasOwnProperty.call(req.body, 'category')) {
      if (!canEditCore) return res.status(403).json({ message: 'Only task owner can edit category.' });
      const category = normalizeEnum(req.body.category, CATEGORY_OPTIONS, '');
      if (!category) return res.status(400).json({ message: 'Invalid task category.' });
      task.category = category;
    }

    if (Object.prototype.hasOwnProperty.call(req.body, 'priority')) {
      if (!canEditCore) return res.status(403).json({ message: 'Only task owner can edit priority.' });
      const priority = normalizeEnum(req.body.priority, PRIORITY_OPTIONS, '');
      if (!priority) return res.status(400).json({ message: 'Invalid task priority.' });
      task.priority = priority;
    }

    if (Object.prototype.hasOwnProperty.call(req.body, 'dueDate')) {
      if (!canEditCore) return res.status(403).json({ message: 'Only task owner can edit due date.' });
      if (!req.body.dueDate) {
        task.dueDate = null;
      } else {
        const dueDate = parseDate(req.body.dueDate);
        if (!dueDate) return res.status(400).json({ message: 'Invalid due date value.' });
        task.dueDate = dueDate;
      }
    }

    const requestedStatus = Object.prototype.hasOwnProperty.call(req.body, 'status')
      ? normalizeEnum(req.body.status, STATUS_OPTIONS, '')
      : null;
    if (Object.prototype.hasOwnProperty.call(req.body, 'status') && !requestedStatus) {
      return res.status(400).json({ message: 'Invalid task status.' });
    }

    const note = sanitize(req.body.note);
    const statusChanged = !!requestedStatus && requestedStatus !== task.status;
    if (statusChanged) {
      task.status = requestedStatus;
      if (requestedStatus === 'Completed') {
        task.completedAt = new Date();
        task.completedBy = req.user.id;
      } else if (before.status === 'Completed') {
        task.completedAt = null;
        task.completedBy = null;
      }
    }

    if (statusChanged || note) {
      task.updates.unshift({
        status: task.status,
        note,
        updatedBy: req.user.id,
        updatedAt: new Date(),
      });
    }

    const updated = await task.save();
    const populated = await populateTask(MentorshipTask.findById(updated._id));

    const counterpartId = isAssignee ? task.assignedBy : task.assignedTo;
    if (String(counterpartId) !== String(req.user.id)) {
      await createNotifications({
        userIds: [counterpartId],
        title: 'Hierarchy Task Updated',
        message: `${req.user.name || 'A member'} updated "${task.title}" to ${task.status}.`,
        type: 'info',
        link: '/hierarchy',
        meta: { taskId: task._id, status: task.status },
        createdBy: req.user.id,
      });
    }

    await logAudit({
      actor: req.user.id,
      action: 'HIERARCHY_TASK_UPDATED',
      entityType: 'MentorshipTask',
      entityId: task._id,
      before,
      after: taskSnapshot(task),
      meta: { note: note || null },
      req,
    });

    return res.json(populated);
  } catch (err) {
    return res.status(400).json({ message: err.message });
  }
};

const deleteTask = async (req, res) => {
  try {
    const task = await MentorshipTask.findById(req.params.id);
    if (!task) {
      return res.status(404).json({ message: 'Task not found.' });
    }

    const isPrivileged = isAdminOrHead(req.user);
    const isCreator = String(task.assignedBy) === String(req.user.id);
    if (!isPrivileged && !isCreator) {
      return res.status(403).json({ message: 'Only task owner can delete this task.' });
    }

    const before = taskSnapshot(task);
    await task.deleteOne();

    if (String(task.assignedTo) !== String(req.user.id)) {
      await createNotifications({
        userIds: [task.assignedTo],
        title: 'Hierarchy Task Removed',
        message: `"${task.title}" was removed from your queue.`,
        type: 'warning',
        link: '/hierarchy',
        meta: { taskId: task._id },
        createdBy: req.user.id,
      });
    }

    await logAudit({
      actor: req.user.id,
      action: 'HIERARCHY_TASK_DELETED',
      entityType: 'MentorshipTask',
      entityId: req.params.id,
      before,
      req,
    });

    return res.json({ success: true, message: 'Task deleted.' });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

module.exports = {
  createTask,
  listTasks,
  updateTask,
  deleteTask,
};
