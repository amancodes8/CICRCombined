const IssueTicket = require('../models/IssueTicket');
const User = require('../models/User');
const { createNotifications } = require('../utils/notificationService');
const { logAudit } = require('../utils/auditLogger');

const CATEGORY_OPTIONS = ['General', 'Technical', 'Infrastructure', 'Event', 'Academic', 'Safety'];
const PRIORITY_OPTIONS = ['Low', 'Medium', 'High', 'Critical'];
const STATUS_OPTIONS = ['Open', 'InReview', 'Resolved', 'Rejected'];

const normalizeEnum = (value, allowed, fallback) => {
  if (!value) return fallback;
  const input = String(value).trim().toLowerCase();
  const match = allowed.find((item) => item.toLowerCase() === input);
  return match || fallback;
};

const sanitizeTitle = (value) => String(value || '').replace(/\s+/g, ' ').trim();
const sanitizeDescription = (value) => String(value || '').trim();

// @desc    Create issue ticket (member submits to admin)
// @route   POST /api/issues
// @access  Private
const createIssue = async (req, res) => {
  try {
    const title = sanitizeTitle(req.body.title);
    const description = sanitizeDescription(req.body.description);

    if (title.length < 4) {
      return res.status(400).json({ message: 'Issue title should be at least 4 characters.' });
    }
    if (description.length < 10) {
      return res.status(400).json({ message: 'Issue description should be at least 10 characters.' });
    }

    const category = normalizeEnum(req.body.category, CATEGORY_OPTIONS, 'General');
    const priority = normalizeEnum(req.body.priority, PRIORITY_OPTIONS, 'Medium');

    const issue = await IssueTicket.create({
      title,
      description,
      category,
      priority,
      createdBy: req.user.id,
    });

    const populated = await issue.populate('createdBy', 'name email collegeId role');

    const admins = await User.find({
      role: { $in: ['Admin', 'Head'] },
      $or: [{ isVerified: true }, { approvalStatus: 'Approved' }],
    }).select('_id');
    await createNotifications({
      userIds: admins.map((u) => u._id),
      title: 'New Issue Ticket',
      message: `${req.user.name || 'A member'} submitted: ${title}`,
      type: 'action',
      link: '/community',
      meta: { issueId: issue._id, category, priority },
      createdBy: req.user.id,
    });

    await logAudit({
      actor: req.user.id,
      action: 'ISSUE_CREATED',
      entityType: 'IssueTicket',
      entityId: issue._id,
      after: {
        title,
        category,
        priority,
        status: issue.status,
      },
      req,
    });

    res.status(201).json(populated);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// @desc    Get issues created by the logged-in user
// @route   GET /api/issues/mine
// @access  Private
const getMyIssues = async (req, res) => {
  try {
    const rows = await IssueTicket.find({ createdBy: req.user.id })
      .populate('resolvedBy', 'name role')
      .sort({ createdAt: -1 });
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// @desc    Get all issue tickets for admin inbox
// @route   GET /api/issues
// @access  Private/Admin
const getAdminIssues = async (req, res) => {
  try {
    const statusFilter = normalizeEnum(req.query.status, STATUS_OPTIONS, '');
    const query = statusFilter ? { status: statusFilter } : {};

    const rows = await IssueTicket.find(query)
      .populate('createdBy', 'name email collegeId role branch year')
      .populate('resolvedBy', 'name role')
      .sort({ createdAt: -1 });

    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// @desc    Update issue status/admin note (admin only)
// @route   PATCH /api/issues/:id
// @access  Private/Admin
const updateIssue = async (req, res) => {
  try {
    const issue = await IssueTicket.findById(req.params.id);
    if (!issue) {
      return res.status(404).json({ message: 'Issue not found' });
    }

    const before = {
      status: issue.status,
      priority: issue.priority,
      adminNote: issue.adminNote,
      resolvedBy: issue.resolvedBy ? String(issue.resolvedBy) : null,
      resolvedAt: issue.resolvedAt || null,
    };

    if (Object.prototype.hasOwnProperty.call(req.body, 'status')) {
      const status = normalizeEnum(req.body.status, STATUS_OPTIONS, '');
      if (!status) {
        return res.status(400).json({ message: 'Invalid issue status' });
      }
      issue.status = status;
      if (status === 'Resolved' || status === 'Rejected') {
        const note = Object.prototype.hasOwnProperty.call(req.body, 'adminNote')
          ? sanitizeDescription(req.body.adminNote)
          : issue.adminNote;
        if (!note) {
          return res.status(400).json({ message: 'Admin note is required when resolving or rejecting an issue.' });
        }
        issue.adminNote = note;
        issue.resolvedBy = req.user.id;
        issue.resolvedAt = new Date();
      } else {
        issue.resolvedBy = null;
        issue.resolvedAt = null;
      }
    }

    if (Object.prototype.hasOwnProperty.call(req.body, 'priority')) {
      const priority = normalizeEnum(req.body.priority, PRIORITY_OPTIONS, '');
      if (!priority) {
        return res.status(400).json({ message: 'Invalid issue priority' });
      }
      issue.priority = priority;
    }

    if (Object.prototype.hasOwnProperty.call(req.body, 'adminNote')) {
      issue.adminNote = sanitizeDescription(req.body.adminNote);
    }

    const updated = await issue.save();
    const populated = await updated.populate([
      { path: 'createdBy', select: 'name email collegeId role branch year' },
      { path: 'resolvedBy', select: 'name role' },
    ]);

    await createNotifications({
      userIds: [issue.createdBy],
      title: 'Issue Ticket Updated',
      message: `Your ticket "${issue.title}" is now ${issue.status}.`,
      type: issue.status === 'Resolved' ? 'success' : issue.status === 'Rejected' ? 'warning' : 'info',
      link: '/community',
      meta: { issueId: issue._id, status: issue.status },
      createdBy: req.user.id,
    });

    await logAudit({
      actor: req.user.id,
      action: 'ISSUE_UPDATED',
      entityType: 'IssueTicket',
      entityId: issue._id,
      before,
      after: {
        status: issue.status,
        priority: issue.priority,
        adminNote: issue.adminNote,
        resolvedBy: issue.resolvedBy ? String(issue.resolvedBy) : null,
        resolvedAt: issue.resolvedAt || null,
      },
      req,
    });

    res.json(populated);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

module.exports = {
  createIssue,
  getMyIssues,
  getAdminIssues,
  updateIssue,
};
