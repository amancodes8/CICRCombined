const mongoose = require('mongoose');
const LearningTrack = require('../models/LearningTrack');
const LearningSubmission = require('../models/LearningSubmission');
const EngagementConfig = require('../models/EngagementConfig');
const User = require('../models/User');
const { createNotifications } = require('../utils/notificationService');
const { logAudit } = require('../utils/auditLogger');

const ADMIN_ROLES = new Set(['admin', 'head']);
const AUDIENCES = ['AllMembers', 'FirstYear', 'SecondYear', 'FirstAndSecond'];
const LEVELS = ['Foundation', 'Intermediate', 'Applied'];
const REVIEW_STATUSES = ['UnderReview', 'Approved', 'NeedsRevision'];

const sanitize = (value) => String(value || '').trim();

const parseBool = (value, fallback = false) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true' || normalized === '1') return true;
    if (normalized === 'false' || normalized === '0') return false;
  }
  return fallback;
};

const parseInteger = (value, fallback = null) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.trunc(n);
};

const normalizeEnum = (value, allowed, fallback = '') => {
  const raw = sanitize(value);
  if (!raw) return fallback;
  const match = allowed.find((item) => item.toLowerCase() === raw.toLowerCase());
  return match || fallback;
};

const isAdminOrHead = (user) => ADMIN_ROLES.has(String(user?.role || '').toLowerCase());

const getUserYear = (user) => {
  const n = Number(user?.year);
  return Number.isFinite(n) ? n : null;
};

const audienceForMember = (user) => {
  const year = getUserYear(user);
  if (year === 1) return ['AllMembers', 'FirstYear', 'FirstAndSecond'];
  if (year === 2) return ['AllMembers', 'SecondYear', 'FirstAndSecond'];
  return ['AllMembers'];
};

const isEligibleAudience = (user, audience = 'AllMembers') => {
  if (isAdminOrHead(user)) return true;
  return audienceForMember(user).includes(audience);
};

const totalTrackTasks = (track) =>
  (Array.isArray(track?.modules) ? track.modules : []).reduce(
    (sum, module) => sum + (Array.isArray(module?.tasks) ? module.tasks.length : 0),
    0
  );

const toIdString = (value) => (value ? String(value) : '');

const getConfig = async () => {
  const row = await EngagementConfig.findOneAndUpdate(
    { key: 'default' },
    { $setOnInsert: { key: 'default' } },
    { new: true, upsert: true }
  );
  return row;
};

const canAccessByConfig = (user, config) => {
  if (isAdminOrHead(user)) return { allowed: true, reason: '' };
  const year = getUserYear(user);
  if (year === 1 && !config.allowFirstYear) {
    return { allowed: false, reason: 'Learning Hub is currently disabled for first-year members.' };
  }
  if (year === 2 && !config.allowSecondYear) {
    return { allowed: false, reason: 'Learning Hub is currently disabled for second-year members.' };
  }
  return { allowed: true, reason: '' };
};

const buildModules = (value, { required = false } = {}) => {
  const source = Array.isArray(value) ? value : [];
  const modules = source
    .map((module) => {
      const title = sanitize(module?.title);
      const description = sanitize(module?.description);

      const resources = Array.isArray(module?.resources)
        ? module.resources
            .map((item) => {
              const label = sanitize(item?.label);
              const url = sanitize(item?.url);
              if (!label || !url) return null;
              const type = normalizeEnum(item?.type, ['Doc', 'Video', 'Repo', 'Practice', 'Other'], 'Doc');
              return { label: label.slice(0, 80), url: url.slice(0, 280), type };
            })
            .filter(Boolean)
        : [];

      const tasks = Array.isArray(module?.tasks)
        ? module.tasks
            .map((task) => {
              const taskTitle = sanitize(task?.title);
              if (!taskTitle) return null;
              return {
                title: taskTitle.slice(0, 120),
                description: sanitize(task?.description).slice(0, 1200),
                points: Math.min(Math.max(parseInteger(task?.points, 10), 0), 300),
                isRequired: parseBool(task?.isRequired, true),
              };
            })
            .filter(Boolean)
        : [];

      if (!title) return null;
      return {
        title: title.slice(0, 100),
        description: description.slice(0, 1200),
        resources,
        tasks,
      };
    })
    .filter(Boolean);

  if (required && !modules.length) {
    return { modules: [], error: 'At least one module is required.' };
  }

  const hasTask = modules.some((module) => Array.isArray(module.tasks) && module.tasks.length > 0);
  if (required && !hasTask) {
    return { modules: [], error: 'Each track must include at least one task.' };
  }

  return { modules, error: '' };
};

const trackSnapshot = (track) => ({
  _id: track?._id || null,
  title: track?.title || '',
  targetAudience: track?.targetAudience || '',
  level: track?.level || '',
  isPublished: !!track?.isPublished,
  isArchived: !!track?.isArchived,
  featured: !!track?.featured,
  totalTasks: totalTrackTasks(track),
});

const enrichTracksWithProgress = (tracks, submissions) => {
  const submissionMap = new Map();
  for (const row of submissions) {
    const key = `${toIdString(row.track)}::${row.moduleIndex}::${row.taskIndex}`;
    submissionMap.set(key, row);
  }

  return tracks.map((track) => {
    const totalTasks = totalTrackTasks(track);
    let approvedCount = 0;
    let submittedCount = 0;
    let needsRevisionCount = 0;

    const modules = (track.modules || []).map((module, moduleIndex) => {
      const tasks = (module.tasks || []).map((task, taskIndex) => {
        const key = `${toIdString(track._id)}::${moduleIndex}::${taskIndex}`;
        const submission = submissionMap.get(key);
        const status = submission?.status || 'NotStarted';

        if (submission) submittedCount += 1;
        if (status === 'Approved') approvedCount += 1;
        if (status === 'NeedsRevision') needsRevisionCount += 1;

        return {
          index: taskIndex,
          title: task.title,
          description: task.description,
          points: task.points,
          isRequired: task.isRequired,
          status,
          submissionId: submission?._id || null,
          reviewedAt: submission?.reviewedAt || null,
          pointsAwarded: submission?.pointsAwarded || 0,
        };
      });

      return {
        index: moduleIndex,
        title: module.title,
        description: module.description,
        resources: module.resources || [],
        tasks,
      };
    });

    const progressPercent = totalTasks > 0 ? Math.round((approvedCount / totalTasks) * 100) : 0;

    return {
      _id: track._id,
      title: track.title,
      summary: track.summary,
      targetAudience: track.targetAudience,
      level: track.level,
      estimatedHours: track.estimatedHours,
      tags: track.tags || [],
      featured: !!track.featured,
      isPublished: !!track.isPublished,
      isArchived: !!track.isArchived,
      createdAt: track.createdAt,
      updatedAt: track.updatedAt,
      totalModules: modules.length,
      totalTasks,
      approvedCount,
      submittedCount,
      needsRevisionCount,
      progressPercent,
      modules,
    };
  });
};

const listTracks = async (req, res) => {
  try {
    const config = await getConfig();
    if (!config.learningHubEnabled && !isAdminOrHead(req.user)) {
      return res.status(403).json({ message: 'Learning Hub is disabled by admin settings.' });
    }

    const configGate = canAccessByConfig(req.user, config);
    if (!configGate.allowed) {
      return res.status(403).json({ message: configGate.reason });
    }

    const includeArchived = String(req.query.includeArchived || '').toLowerCase() === 'true';
    const privileged = isAdminOrHead(req.user);

    const query = {};
    if (!privileged) {
      query.isPublished = true;
      query.isArchived = false;
      query.targetAudience = { $in: audienceForMember(req.user) };
    } else if (!includeArchived) {
      query.isArchived = false;
    }

    const tracks = await LearningTrack.find(query)
      .sort({ featured: -1, order: 1, createdAt: -1 })
      .populate('createdBy', 'name role')
      .lean();

    const trackIds = tracks.map((track) => track._id);
    const submissions = trackIds.length
      ? await LearningSubmission.find({
          track: { $in: trackIds },
          member: req.user.id,
        }).lean()
      : [];

    const rows = enrichTracksWithProgress(tracks, submissions);
    return res.json({
      items: rows,
      config: {
        learningHubEnabled: config.learningHubEnabled,
        allowSubmissions: config.allowSubmissions,
        showLeaderboard: config.showLeaderboard,
        spotlightTitle: config.spotlightTitle,
        spotlightMessage: config.spotlightMessage,
      },
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

const getTrackById = async (req, res) => {
  try {
    const config = await getConfig();
    if (!config.learningHubEnabled && !isAdminOrHead(req.user)) {
      return res.status(403).json({ message: 'Learning Hub is disabled by admin settings.' });
    }

    const track = await LearningTrack.findById(req.params.id).lean();
    if (!track) {
      return res.status(404).json({ message: 'Track not found.' });
    }

    const privileged = isAdminOrHead(req.user);
    if (!privileged) {
      if (track.isArchived || !track.isPublished) {
        return res.status(403).json({ message: 'Track is not available for members.' });
      }
      if (!isEligibleAudience(req.user, track.targetAudience)) {
        return res.status(403).json({ message: 'This track is not available for your year.' });
      }
    }

    const submissions = await LearningSubmission.find({
      track: track._id,
      member: req.user.id,
    }).lean();

    const [row] = enrichTracksWithProgress([track], submissions);
    return res.json(row);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

const createTrack = async (req, res) => {
  try {
    if (!isAdminOrHead(req.user)) {
      return res.status(403).json({ message: 'Only Admin/Head can create tracks.' });
    }

    const title = sanitize(req.body.title);
    if (title.length < 4) {
      return res.status(400).json({ message: 'Track title should be at least 4 characters.' });
    }

    const targetAudience = normalizeEnum(req.body.targetAudience, AUDIENCES, 'FirstAndSecond');
    const level = normalizeEnum(req.body.level, LEVELS, 'Foundation');
    const summary = sanitize(req.body.summary).slice(0, 1200);
    const estimatedHours = Math.min(Math.max(parseInteger(req.body.estimatedHours, 8), 1), 300);
    const order = Math.max(parseInteger(req.body.order, 0), 0);
    const featured = parseBool(req.body.featured, false);
    const isPublished = parseBool(req.body.isPublished, false);
    const tags = Array.isArray(req.body.tags)
      ? req.body.tags.map((tag) => sanitize(tag)).filter(Boolean).slice(0, 12)
      : sanitize(req.body.tags)
          .split(',')
          .map((tag) => sanitize(tag))
          .filter(Boolean)
          .slice(0, 12);

    const { modules, error: moduleError } = buildModules(req.body.modules, { required: true });
    if (moduleError) {
      return res.status(400).json({ message: moduleError });
    }

    const now = new Date();
    const track = await LearningTrack.create({
      title: title.slice(0, 120),
      summary,
      targetAudience,
      level,
      estimatedHours,
      tags,
      modules,
      featured,
      order,
      isPublished,
      publishedAt: isPublished ? now : null,
      createdBy: req.user.id,
      updatedBy: req.user.id,
    });

    await logAudit({
      actor: req.user.id,
      action: 'LEARNING_TRACK_CREATED',
      entityType: 'LearningTrack',
      entityId: track._id,
      after: trackSnapshot(track),
      req,
    });

    return res.status(201).json(track);
  } catch (err) {
    return res.status(400).json({ message: err.message });
  }
};

const updateTrack = async (req, res) => {
  try {
    if (!isAdminOrHead(req.user)) {
      return res.status(403).json({ message: 'Only Admin/Head can update tracks.' });
    }

    const track = await LearningTrack.findById(req.params.id);
    if (!track) {
      return res.status(404).json({ message: 'Track not found.' });
    }

    const before = trackSnapshot(track);

    if (Object.prototype.hasOwnProperty.call(req.body, 'title')) {
      const title = sanitize(req.body.title);
      if (title.length < 4) {
        return res.status(400).json({ message: 'Track title should be at least 4 characters.' });
      }
      track.title = title.slice(0, 120);
    }

    if (Object.prototype.hasOwnProperty.call(req.body, 'summary')) {
      track.summary = sanitize(req.body.summary).slice(0, 1200);
    }

    if (Object.prototype.hasOwnProperty.call(req.body, 'targetAudience')) {
      const value = normalizeEnum(req.body.targetAudience, AUDIENCES, '');
      if (!value) return res.status(400).json({ message: 'Invalid target audience.' });
      track.targetAudience = value;
    }

    if (Object.prototype.hasOwnProperty.call(req.body, 'level')) {
      const value = normalizeEnum(req.body.level, LEVELS, '');
      if (!value) return res.status(400).json({ message: 'Invalid level.' });
      track.level = value;
    }

    if (Object.prototype.hasOwnProperty.call(req.body, 'estimatedHours')) {
      track.estimatedHours = Math.min(Math.max(parseInteger(req.body.estimatedHours, 8), 1), 300);
    }

    if (Object.prototype.hasOwnProperty.call(req.body, 'order')) {
      track.order = Math.max(parseInteger(req.body.order, 0), 0);
    }

    if (Object.prototype.hasOwnProperty.call(req.body, 'featured')) {
      track.featured = parseBool(req.body.featured, false);
    }

    if (Object.prototype.hasOwnProperty.call(req.body, 'tags')) {
      track.tags = Array.isArray(req.body.tags)
        ? req.body.tags.map((tag) => sanitize(tag)).filter(Boolean).slice(0, 12)
        : sanitize(req.body.tags)
            .split(',')
            .map((tag) => sanitize(tag))
            .filter(Boolean)
            .slice(0, 12);
    }

    if (Object.prototype.hasOwnProperty.call(req.body, 'modules')) {
      const { modules, error: moduleError } = buildModules(req.body.modules, { required: true });
      if (moduleError) return res.status(400).json({ message: moduleError });
      track.modules = modules;
    }

    if (Object.prototype.hasOwnProperty.call(req.body, 'isPublished')) {
      const next = parseBool(req.body.isPublished, false);
      track.isPublished = next;
      track.publishedAt = next ? track.publishedAt || new Date() : null;
    }

    if (Object.prototype.hasOwnProperty.call(req.body, 'isArchived')) {
      const next = parseBool(req.body.isArchived, false);
      track.isArchived = next;
      track.archivedAt = next ? new Date() : null;
    }

    track.updatedBy = req.user.id;
    await track.save();

    await logAudit({
      actor: req.user.id,
      action: 'LEARNING_TRACK_UPDATED',
      entityType: 'LearningTrack',
      entityId: track._id,
      before,
      after: trackSnapshot(track),
      req,
    });

    return res.json(track);
  } catch (err) {
    return res.status(400).json({ message: err.message });
  }
};

const setTrackPublish = async (req, res) => {
  try {
    if (!isAdminOrHead(req.user)) {
      return res.status(403).json({ message: 'Only Admin/Head can manage publish state.' });
    }

    const track = await LearningTrack.findById(req.params.id);
    if (!track) {
      return res.status(404).json({ message: 'Track not found.' });
    }

    const before = trackSnapshot(track);
    const nextPublished = parseBool(req.body.isPublished, track.isPublished);
    track.isPublished = nextPublished;
    track.publishedAt = nextPublished ? track.publishedAt || new Date() : null;
    track.updatedBy = req.user.id;
    await track.save();

    await logAudit({
      actor: req.user.id,
      action: 'LEARNING_TRACK_PUBLISH_UPDATED',
      entityType: 'LearningTrack',
      entityId: track._id,
      before,
      after: trackSnapshot(track),
      req,
    });

    return res.json(track);
  } catch (err) {
    return res.status(400).json({ message: err.message });
  }
};

const setTrackArchive = async (req, res) => {
  try {
    if (!isAdminOrHead(req.user)) {
      return res.status(403).json({ message: 'Only Admin/Head can manage archive state.' });
    }

    const track = await LearningTrack.findById(req.params.id);
    if (!track) {
      return res.status(404).json({ message: 'Track not found.' });
    }

    const before = trackSnapshot(track);
    const nextArchived = parseBool(req.body.isArchived, true);
    track.isArchived = nextArchived;
    track.archivedAt = nextArchived ? new Date() : null;
    if (nextArchived) {
      track.isPublished = false;
      track.publishedAt = null;
    }
    track.updatedBy = req.user.id;
    await track.save();

    await logAudit({
      actor: req.user.id,
      action: 'LEARNING_TRACK_ARCHIVE_UPDATED',
      entityType: 'LearningTrack',
      entityId: track._id,
      before,
      after: trackSnapshot(track),
      req,
    });

    return res.json(track);
  } catch (err) {
    return res.status(400).json({ message: err.message });
  }
};

const submitTask = async (req, res) => {
  try {
    const config = await getConfig();
    if (!config.learningHubEnabled && !isAdminOrHead(req.user)) {
      return res.status(403).json({ message: 'Learning Hub is disabled by admin settings.' });
    }

    const configGate = canAccessByConfig(req.user, config);
    if (!configGate.allowed) {
      return res.status(403).json({ message: configGate.reason });
    }

    if (!config.allowSubmissions && !isAdminOrHead(req.user)) {
      return res.status(403).json({ message: 'Task submissions are currently paused by admins.' });
    }

    const track = await LearningTrack.findById(req.params.id).lean();
    if (!track) {
      return res.status(404).json({ message: 'Track not found.' });
    }

    if (!isAdminOrHead(req.user)) {
      if (track.isArchived || !track.isPublished) {
        return res.status(403).json({ message: 'Track is not currently accepting submissions.' });
      }
      if (!isEligibleAudience(req.user, track.targetAudience)) {
        return res.status(403).json({ message: 'This track is not available for your year.' });
      }
    }

    const moduleIndex = parseInteger(req.body.moduleIndex, -1);
    const taskIndex = parseInteger(req.body.taskIndex, -1);
    if (moduleIndex < 0 || taskIndex < 0) {
      return res.status(400).json({ message: 'Invalid module/task index.' });
    }

    const module = track.modules?.[moduleIndex];
    const task = module?.tasks?.[taskIndex];
    if (!module || !task) {
      return res.status(400).json({ message: 'Task reference not found in this track.' });
    }

    const evidenceText = sanitize(req.body.evidenceText).slice(0, 2000);
    const evidenceLink = sanitize(req.body.evidenceLink).slice(0, 280);
    if (!evidenceText && !evidenceLink) {
      return res.status(400).json({ message: 'Provide evidence text or evidence link.' });
    }

    const now = new Date();
    let submission = await LearningSubmission.findOne({
      track: track._id,
      member: req.user.id,
      moduleIndex,
      taskIndex,
    });

    const isResubmit = !!submission;
    if (!submission) {
      submission = new LearningSubmission({
        track: track._id,
        member: req.user.id,
        moduleIndex,
        taskIndex,
        taskTitle: task.title,
        taskPoints: task.points,
        evidenceText,
        evidenceLink,
        status: 'Submitted',
        submittedAt: now,
        events: [
          {
            action: 'Submitted',
            note: evidenceText || evidenceLink,
            actor: req.user.id,
            createdAt: now,
          },
        ],
      });
    } else {
      submission.evidenceText = evidenceText;
      submission.evidenceLink = evidenceLink;
      submission.status = 'Submitted';
      submission.reviewer = null;
      submission.reviewNote = '';
      submission.reviewedAt = null;
      submission.pointsAwarded = 0;
      submission.submittedAt = now;
      submission.events.unshift({
        action: isResubmit ? 'Resubmitted' : 'Submitted',
        note: evidenceText || evidenceLink,
        actor: req.user.id,
        createdAt: now,
      });
    }

    await submission.save();

    const reviewers = await User.find({
      role: { $in: ['Admin', 'Head'] },
      $or: [{ isVerified: true }, { approvalStatus: 'Approved' }],
    }).select('_id');

    await createNotifications({
      userIds: reviewers.map((row) => row._id),
      title: 'New Learning Submission',
      message: `${req.user.name || 'A member'} submitted work for ${track.title}.`,
      type: 'action',
      link: '/learning?tab=reviews',
      meta: {
        trackId: String(track._id),
        submissionId: String(submission._id),
      },
      createdBy: req.user.id,
    });

    await logAudit({
      actor: req.user.id,
      action: isResubmit ? 'LEARNING_TASK_RESUBMITTED' : 'LEARNING_TASK_SUBMITTED',
      entityType: 'LearningSubmission',
      entityId: submission._id,
      after: {
        trackId: String(track._id),
        moduleIndex,
        taskIndex,
        status: submission.status,
      },
      req,
    });

    return res.status(isResubmit ? 200 : 201).json(submission);
  } catch (err) {
    const status = err instanceof mongoose.Error.ValidationError ? 400 : 500;
    return res.status(status).json({ message: err.message });
  }
};

const listMySubmissions = async (req, res) => {
  try {
    const rows = await LearningSubmission.find({ member: req.user.id })
      .sort({ updatedAt: -1 })
      .populate('track', 'title targetAudience level')
      .populate('reviewer', 'name role')
      .lean();

    return res.json(rows);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

const listAllSubmissions = async (req, res) => {
  try {
    if (!isAdminOrHead(req.user)) {
      return res.status(403).json({ message: 'Only Admin/Head can view all submissions.' });
    }

    const query = {};
    const status = normalizeEnum(req.query.status, ['Submitted', 'UnderReview', 'Approved', 'NeedsRevision'], '');
    if (status) query.status = status;

    const trackId = sanitize(req.query.trackId);
    if (trackId) query.track = trackId;

    const memberId = sanitize(req.query.memberId);
    if (memberId) query.member = memberId;

    const rows = await LearningSubmission.find(query)
      .sort({ updatedAt: -1 })
      .limit(300)
      .populate('member', 'name collegeId year role')
      .populate('track', 'title level targetAudience')
      .populate('reviewer', 'name role')
      .lean();

    return res.json(rows);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

const reviewSubmission = async (req, res) => {
  try {
    if (!isAdminOrHead(req.user)) {
      return res.status(403).json({ message: 'Only Admin/Head can review submissions.' });
    }

    const submission = await LearningSubmission.findById(req.params.id).populate('track', 'title');
    if (!submission) {
      return res.status(404).json({ message: 'Submission not found.' });
    }

    const status = normalizeEnum(req.body.status, REVIEW_STATUSES, '');
    if (!status) {
      return res.status(400).json({ message: 'Invalid review status.' });
    }

    const reviewNote = sanitize(req.body.reviewNote).slice(0, 1200);
    if (status === 'NeedsRevision' && reviewNote.length < 8) {
      return res.status(400).json({ message: 'Review note should explain revision in at least 8 characters.' });
    }

    const pointsRaw = parseInteger(req.body.pointsAwarded, submission.taskPoints || 0);
    const pointsAwarded = status === 'Approved' ? Math.min(Math.max(pointsRaw, 0), 500) : 0;

    const before = {
      status: submission.status,
      pointsAwarded: submission.pointsAwarded,
      reviewer: submission.reviewer,
    };

    submission.status = status;
    submission.reviewNote = reviewNote;
    submission.reviewer = req.user.id;
    submission.reviewedAt = new Date();
    submission.pointsAwarded = pointsAwarded;
    submission.events.unshift({
      action: status,
      note: reviewNote,
      actor: req.user.id,
      createdAt: new Date(),
    });

    await submission.save();

    await createNotifications({
      userIds: [submission.member],
      title: 'Learning Submission Reviewed',
      message: `${submission.track?.title || 'Track'} update: ${status}.`,
      type: status === 'Approved' ? 'success' : status === 'NeedsRevision' ? 'warning' : 'info',
      link: '/learning',
      meta: {
        submissionId: String(submission._id),
        status,
      },
      createdBy: req.user.id,
    });

    await logAudit({
      actor: req.user.id,
      action: 'LEARNING_SUBMISSION_REVIEWED',
      entityType: 'LearningSubmission',
      entityId: submission._id,
      before,
      after: {
        status: submission.status,
        pointsAwarded: submission.pointsAwarded,
      },
      req,
    });

    return res.json(submission);
  } catch (err) {
    return res.status(400).json({ message: err.message });
  }
};

const getOverview = async (req, res) => {
  try {
    const config = await getConfig();
    const privileged = isAdminOrHead(req.user);

    if (!config.learningHubEnabled && !privileged) {
      return res.status(403).json({ message: 'Learning Hub is disabled by admin settings.' });
    }

    const configGate = canAccessByConfig(req.user, config);
    if (!configGate.allowed) {
      return res.status(403).json({ message: configGate.reason });
    }

    const trackQuery = privileged
      ? { isArchived: false }
      : {
          isPublished: true,
          isArchived: false,
          targetAudience: { $in: audienceForMember(req.user) },
        };

    const [tracks, mySubmissions, pendingReviews] = await Promise.all([
      LearningTrack.find(trackQuery).sort({ featured: -1, order: 1, createdAt: -1 }).lean(),
      LearningSubmission.find({ member: req.user.id }).lean(),
      privileged ? LearningSubmission.countDocuments({ status: { $in: ['Submitted', 'UnderReview'] } }) : Promise.resolve(0),
    ]);

    const visibleTrackIdSet = new Set(tracks.map((row) => toIdString(row._id)));
    const scopedSubmissions = mySubmissions.filter((row) => visibleTrackIdSet.has(toIdString(row.track)));
    const approved = scopedSubmissions.filter((row) => row.status === 'Approved');

    const totalTasks = tracks.reduce((sum, row) => sum + totalTrackTasks(row), 0);
    const pointsEarned = approved.reduce((sum, row) => sum + Number(row.pointsAwarded || 0), 0);

    const submissionMap = new Map();
    scopedSubmissions.forEach((row) => {
      submissionMap.set(`${toIdString(row.track)}::${row.moduleIndex}::${row.taskIndex}`, row.status);
    });

    const recommendedTasks = [];
    for (const track of tracks) {
      for (let m = 0; m < (track.modules || []).length; m += 1) {
        const module = track.modules[m];
        for (let t = 0; t < (module.tasks || []).length; t += 1) {
          const task = module.tasks[t];
          const key = `${toIdString(track._id)}::${m}::${t}`;
          const status = submissionMap.get(key) || 'NotStarted';
          if (status !== 'Approved') {
            recommendedTasks.push({
              trackId: track._id,
              trackTitle: track.title,
              moduleIndex: m,
              taskIndex: t,
              moduleTitle: module.title,
              taskTitle: task.title,
              points: task.points || 0,
              status,
            });
          }
          if (recommendedTasks.length >= 8) break;
        }
        if (recommendedTasks.length >= 8) break;
      }
      if (recommendedTasks.length >= 8) break;
    }

    let leaderboard = [];
    if (config.showLeaderboard) {
      const aggregate = await LearningSubmission.aggregate([
        {
          $match: {
            status: 'Approved',
          },
        },
        {
          $group: {
            _id: '$member',
            points: { $sum: '$pointsAwarded' },
            tasks: { $sum: 1 },
            lastActivityAt: { $max: '$updatedAt' },
          },
        },
        { $sort: { points: -1, tasks: -1, lastActivityAt: -1 } },
        { $limit: 12 },
      ]);

      const memberIds = aggregate.map((row) => row._id);
      const members = await User.find({ _id: { $in: memberIds } }).select('name collegeId year role').lean();
      const memberMap = new Map(members.map((row) => [toIdString(row._id), row]));

      leaderboard = aggregate
        .map((row, idx) => {
          const member = memberMap.get(toIdString(row._id));
          if (!member) return null;
          return {
            rank: idx + 1,
            member: {
              _id: member._id,
              name: member.name,
              collegeId: member.collegeId,
              year: member.year,
              role: member.role,
            },
            points: row.points,
            tasks: row.tasks,
            lastActivityAt: row.lastActivityAt,
          };
        })
        .filter(Boolean);
    }

    return res.json({
      config: {
        learningHubEnabled: config.learningHubEnabled,
        allowSubmissions: config.allowSubmissions,
        allowFirstYear: config.allowFirstYear,
        allowSecondYear: config.allowSecondYear,
        showLeaderboard: config.showLeaderboard,
        spotlightTitle: config.spotlightTitle,
        spotlightMessage: config.spotlightMessage,
      },
      stats: {
        activeTracks: tracks.length,
        totalTasks,
        mySubmittedTasks: scopedSubmissions.length,
        myApprovedTasks: approved.length,
        myPoints: pointsEarned,
        pendingReviews,
      },
      recommendedTasks,
      featuredTracks: tracks.filter((row) => row.featured).slice(0, 6),
      leaderboard,
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

const getEngagementConfig = async (req, res) => {
  try {
    const config = await getConfig();
    return res.json(config);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

const updateEngagementConfig = async (req, res) => {
  try {
    if (!isAdminOrHead(req.user)) {
      return res.status(403).json({ message: 'Only Admin/Head can update engagement config.' });
    }

    const config = await getConfig();
    const before = {
      learningHubEnabled: config.learningHubEnabled,
      allowFirstYear: config.allowFirstYear,
      allowSecondYear: config.allowSecondYear,
      allowSubmissions: config.allowSubmissions,
      showLeaderboard: config.showLeaderboard,
      spotlightTitle: config.spotlightTitle,
      spotlightMessage: config.spotlightMessage,
    };

    if (Object.prototype.hasOwnProperty.call(req.body, 'learningHubEnabled')) {
      config.learningHubEnabled = parseBool(req.body.learningHubEnabled, config.learningHubEnabled);
    }
    if (Object.prototype.hasOwnProperty.call(req.body, 'allowFirstYear')) {
      config.allowFirstYear = parseBool(req.body.allowFirstYear, config.allowFirstYear);
    }
    if (Object.prototype.hasOwnProperty.call(req.body, 'allowSecondYear')) {
      config.allowSecondYear = parseBool(req.body.allowSecondYear, config.allowSecondYear);
    }
    if (Object.prototype.hasOwnProperty.call(req.body, 'allowSubmissions')) {
      config.allowSubmissions = parseBool(req.body.allowSubmissions, config.allowSubmissions);
    }
    if (Object.prototype.hasOwnProperty.call(req.body, 'showLeaderboard')) {
      config.showLeaderboard = parseBool(req.body.showLeaderboard, config.showLeaderboard);
    }
    if (Object.prototype.hasOwnProperty.call(req.body, 'spotlightTitle')) {
      config.spotlightTitle = sanitize(req.body.spotlightTitle).slice(0, 80) || config.spotlightTitle;
    }
    if (Object.prototype.hasOwnProperty.call(req.body, 'spotlightMessage')) {
      config.spotlightMessage = sanitize(req.body.spotlightMessage).slice(0, 320) || config.spotlightMessage;
    }

    config.updatedBy = req.user.id;
    await config.save();

    await logAudit({
      actor: req.user.id,
      action: 'LEARNING_CONFIG_UPDATED',
      entityType: 'EngagementConfig',
      entityId: config._id,
      before,
      after: {
        learningHubEnabled: config.learningHubEnabled,
        allowFirstYear: config.allowFirstYear,
        allowSecondYear: config.allowSecondYear,
        allowSubmissions: config.allowSubmissions,
        showLeaderboard: config.showLeaderboard,
        spotlightTitle: config.spotlightTitle,
        spotlightMessage: config.spotlightMessage,
      },
      req,
    });

    return res.json(config);
  } catch (err) {
    return res.status(400).json({ message: err.message });
  }
};

module.exports = {
  listTracks,
  getTrackById,
  createTrack,
  updateTrack,
  setTrackPublish,
  setTrackArchive,
  submitTask,
  listMySubmissions,
  listAllSubmissions,
  reviewSubmission,
  getOverview,
  getEngagementConfig,
  updateEngagementConfig,
};
