const ProgramConfig = require('../models/ProgramConfig');
const WeeklyQuest = require('../models/WeeklyQuest');
const QuestSubmission = require('../models/QuestSubmission');
const MentorRequest = require('../models/MentorRequest');
const BadgeRule = require('../models/BadgeRule');
const BadgeAward = require('../models/BadgeAward');
const ProjectIdea = require('../models/ProjectIdea');
const OfficeHourSlot = require('../models/OfficeHourSlot');
const OfficeHourBooking = require('../models/OfficeHourBooking');
const Contest = require('../models/Contest');
const ContestAttempt = require('../models/ContestAttempt');
const Project = require('../models/Project');
const User = require('../models/User');
const LearningSubmission = require('../models/LearningSubmission');
const { createNotifications } = require('../utils/notificationService');
const { logAudit } = require('../utils/auditLogger');

const ADMIN_ROLES = new Set(['admin', 'head']);
const QUEST_AUDIENCES = ['AllMembers', 'FirstYear', 'SecondYear', 'FirstAndSecond'];
const QUEST_CATEGORIES = ['Technical', 'Design', 'Communication', 'Operations', 'Community'];
const QUEST_STATUSES = ['Draft', 'Active', 'Closed', 'Archived'];
const CONTEST_STATUSES = ['Draft', 'Active', 'Closed'];
const IDEA_STATUSES = ['UnderReview', 'Approved', 'Rejected', 'Converted'];
const BADGE_CRITERIA_TYPES = ['PointsThreshold', 'QuestCompletions', 'IdeasConverted', 'MentorResolutions'];

const LEVELS = [
  { min: 0, label: 'Explorer' },
  { min: 120, label: 'Builder' },
  { min: 260, label: 'Contributor' },
  { min: 450, label: 'Specialist' },
  { min: 700, label: 'Lead Contributor' },
  { min: 1000, label: 'Impact Mentor' },
  { min: 1400, label: 'CICR Pillar' },
];

const DEFAULT_BADGE_RULES = [
  {
    name: 'Pathfinder',
    description: 'Cross 120 contribution points.',
    icon: 'Compass',
    criteriaType: 'PointsThreshold',
    criteriaValue: 120,
    order: 10,
  },
  {
    name: 'Weekly Sprint Finisher',
    description: 'Get 3 weekly quests approved.',
    icon: 'Rocket',
    criteriaType: 'QuestCompletions',
    criteriaValue: 3,
    order: 20,
  },
  {
    name: 'Idea Catalyst',
    description: 'Convert at least one idea into a project.',
    icon: 'Lightbulb',
    criteriaType: 'IdeasConverted',
    criteriaValue: 1,
    order: 30,
  },
  {
    name: 'Mentor Backbone',
    description: 'Resolve three mentor requests for juniors.',
    icon: 'Handshake',
    criteriaType: 'MentorResolutions',
    criteriaValue: 3,
    order: 40,
  },
];

const sanitize = (value) => String(value || '').trim();

const parseInteger = (value, fallback = null) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.trunc(n);
};

const parseDate = (value) => {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
};

const parseBool = (value, fallback = false) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const raw = value.trim().toLowerCase();
    if (raw === 'true' || raw === '1') return true;
    if (raw === 'false' || raw === '0') return false;
  }
  return fallback;
};

const normalizeEnum = (value, allowed, fallback = '') => {
  const raw = sanitize(value);
  if (!raw) return fallback;
  const match = allowed.find((item) => item.toLowerCase() === raw.toLowerCase());
  return match || fallback;
};

const isAdminOrHead = (user) => ADMIN_ROLES.has(String(user?.role || '').toLowerCase());

const userYear = (user) => {
  const n = Number(user?.year);
  return Number.isFinite(n) ? n : null;
};

const isSeniorMentor = (user) => {
  if (isAdminOrHead(user)) return true;
  const role = String(user?.role || '').toLowerCase();
  if (role === 'alumni') return true;
  if (role !== 'user') return false;
  const year = userYear(user);
  return !!year && year >= 2;
};

const audienceForUser = (user) => {
  const year = userYear(user);
  if (year === 1) return ['AllMembers', 'FirstYear', 'FirstAndSecond'];
  if (year === 2) return ['AllMembers', 'SecondYear', 'FirstAndSecond'];
  return ['AllMembers'];
};

const userCanAccessAudience = (user, audience) => {
  if (isAdminOrHead(user)) return true;
  return audienceForUser(user).includes(audience);
};

const getConfig = async () =>
  ProgramConfig.findOneAndUpdate(
    { key: 'default' },
    { $setOnInsert: { key: 'default' } },
    { new: true, upsert: true }
  );

const ensureDefaultBadgeRules = async (actorId = null) => {
  try {
    await Promise.all(
      DEFAULT_BADGE_RULES.map((rule) =>
        BadgeRule.findOneAndUpdate(
          { name: rule.name },
          {
            $setOnInsert: {
              ...rule,
              createdBy: actorId,
              updatedBy: actorId,
            },
          },
          { upsert: true, new: true }
        )
      )
    );
  } catch (err) {
    // default rules should never break business flow
  }
};

const calculateLevel = (points) => {
  const safePoints = Math.max(0, Number(points || 0));
  let current = LEVELS[0];
  let next = null;

  for (let i = 0; i < LEVELS.length; i += 1) {
    if (safePoints >= LEVELS[i].min) {
      current = LEVELS[i];
      next = LEVELS[i + 1] || null;
    }
  }

  return {
    currentLabel: current.label,
    currentMin: current.min,
    nextLabel: next?.label || 'Max Tier',
    nextMin: next?.min || current.min,
    toNext: next ? Math.max(0, next.min - safePoints) : 0,
  };
};

const refreshSlotBookedCount = async (slotId) => {
  if (!slotId) return;
  const count = await OfficeHourBooking.countDocuments({ slot: slotId, status: 'Booked' });
  await OfficeHourSlot.findByIdAndUpdate(slotId, { $set: { bookedCount: count } });
};

const collectMemberMetrics = async (memberId) => {
  const [questRows, learningRows, ideasConverted, mentorResolved] = await Promise.all([
    QuestSubmission.aggregate([
      { $match: { member: memberId, status: 'Approved' } },
      {
        $group: {
          _id: '$member',
          count: { $sum: 1 },
          points: { $sum: '$pointsAwarded' },
        },
      },
    ]),
    LearningSubmission.aggregate([
      { $match: { member: memberId, status: 'Approved' } },
      {
        $group: {
          _id: '$member',
          count: { $sum: 1 },
          points: { $sum: '$pointsAwarded' },
        },
      },
    ]),
    ProjectIdea.countDocuments({ createdBy: memberId, status: 'Converted' }),
    MentorRequest.countDocuments({ assignedMentor: memberId, status: 'Resolved' }),
  ]);

  const questCount = Number(questRows?.[0]?.count || 0);
  const questPoints = Number(questRows?.[0]?.points || 0);
  const learningCount = Number(learningRows?.[0]?.count || 0);
  const learningPoints = Number(learningRows?.[0]?.points || 0);
  const ideaBonus = Number(ideasConverted || 0) * 80;
  const mentorBonus = Number(mentorResolved || 0) * 35;
  const totalPoints = questPoints + learningPoints + ideaBonus + mentorBonus;

  return {
    questCount,
    questPoints,
    learningCount,
    learningPoints,
    ideasConverted: Number(ideasConverted || 0),
    mentorResolved: Number(mentorResolved || 0),
    totalPoints,
  };
};

const syncBadgesForMember = async (memberId, actorId = null) => {
  const config = await getConfig();
  if (!config.badgeSystemEnabled) return [];

  await ensureDefaultBadgeRules(actorId || memberId);

  const [rules, metrics, existingAwards] = await Promise.all([
    BadgeRule.find({ isEnabled: true }).sort({ order: 1, createdAt: 1 }).lean(),
    collectMemberMetrics(memberId),
    BadgeAward.find({ member: memberId }).select('badgeRule').lean(),
  ]);

  const existingSet = new Set(existingAwards.map((row) => String(row.badgeRule)));
  const granted = [];

  for (const rule of rules) {
    let qualifies = false;
    const threshold = Number(rule.criteriaValue || 0);

    if (rule.criteriaType === 'PointsThreshold') qualifies = metrics.totalPoints >= threshold;
    if (rule.criteriaType === 'QuestCompletions') qualifies = metrics.questCount >= threshold;
    if (rule.criteriaType === 'IdeasConverted') qualifies = metrics.ideasConverted >= threshold;
    if (rule.criteriaType === 'MentorResolutions') qualifies = metrics.mentorResolved >= threshold;

    if (!qualifies || existingSet.has(String(rule._id))) continue;

    try {
      const award = await BadgeAward.create({
        member: memberId,
        badgeRule: rule._id,
        pointsSnapshot: metrics.totalPoints,
        source: 'system',
      });
      granted.push({ awardId: award._id, name: rule.name, icon: rule.icon });
      existingSet.add(String(rule._id));
    } catch (err) {
      // ignore duplicate race
    }
  }

  if (granted.length) {
    await createNotifications({
      userIds: [memberId],
      title: 'New Badge Unlocked',
      message: `You unlocked ${granted.length} new badge${granted.length > 1 ? 's' : ''}.`,
      type: 'success',
      link: '/programs?tab=badges',
      meta: { badges: granted.map((item) => item.name) },
      createdBy: actorId || memberId,
    });
  }

  return granted;
};

const listProgramOverview = async (req, res) => {
  try {
    const config = await getConfig();
    const actorIsAdmin = isAdminOrHead(req.user);

    const now = new Date();
    const questQuery = actorIsAdmin
      ? { status: { $in: ['Active', 'Closed'] } }
      : {
          status: { $in: ['Active', 'Closed'] },
          audience: { $in: audienceForUser(req.user) },
        };

    const [quests, myQuestSubmissions, myMentorRequests, myIdeas, myBookings, metrics] = await Promise.all([
      WeeklyQuest.find(questQuery).sort({ startsAt: -1 }).limit(20).lean(),
      QuestSubmission.find({ member: req.user.id }).select('quest status pointsAwarded').lean(),
      MentorRequest.find({ requester: req.user.id }).select('status').lean(),
      ProjectIdea.find({ createdBy: req.user.id }).select('status').lean(),
      OfficeHourBooking.find({ member: req.user.id, status: 'Booked' })
        .populate('slot', 'title startTime status')
        .sort({ createdAt: -1 })
        .lean(),
      collectMemberMetrics(req.user.id),
    ]);

    const level = calculateLevel(metrics.totalPoints);
    const upcomingQuests = quests.filter((quest) => quest.status === 'Active' && new Date(quest.endsAt) >= now).slice(0, 6);
    const approvedQuestCount = myQuestSubmissions.filter((row) => row.status === 'Approved').length;

    let leaderboard = [];
    if (config.showProgramLeaderboard) {
      const [questAgg, learningAgg, ideasAgg, mentorAgg] = await Promise.all([
        QuestSubmission.aggregate([
          { $match: { status: 'Approved' } },
          {
            $group: {
              _id: '$member',
              points: { $sum: '$pointsAwarded' },
              quests: { $sum: 1 },
            },
          },
        ]),
        LearningSubmission.aggregate([
          { $match: { status: 'Approved' } },
          {
            $group: {
              _id: '$member',
              points: { $sum: '$pointsAwarded' },
            },
          },
        ]),
        ProjectIdea.aggregate([
          { $match: { status: 'Converted' } },
          { $group: { _id: '$createdBy', converted: { $sum: 1 } } },
        ]),
        MentorRequest.aggregate([
          { $match: { status: 'Resolved', assignedMentor: { $ne: null } } },
          { $group: { _id: '$assignedMentor', resolved: { $sum: 1 } } },
        ]),
      ]);

      const board = new Map();
      const upsert = (memberId) => {
        const key = String(memberId);
        if (!board.has(key)) {
          board.set(key, {
            memberId: key,
            points: 0,
            quests: 0,
            resolvedMentors: 0,
            convertedIdeas: 0,
          });
        }
        return board.get(key);
      };

      questAgg.forEach((row) => {
        const item = upsert(row._id);
        item.points += Number(row.points || 0);
        item.quests += Number(row.quests || 0);
      });
      learningAgg.forEach((row) => {
        const item = upsert(row._id);
        item.points += Number(row.points || 0);
      });
      ideasAgg.forEach((row) => {
        const item = upsert(row._id);
        const converted = Number(row.converted || 0);
        item.convertedIdeas += converted;
        item.points += converted * 80;
      });
      mentorAgg.forEach((row) => {
        const item = upsert(row._id);
        const resolved = Number(row.resolved || 0);
        item.resolvedMentors += resolved;
        item.points += resolved * 35;
      });

      const sorted = [...board.values()].sort((a, b) => b.points - a.points).slice(0, 12);
      const userIds = sorted.map((row) => row.memberId);
      const members = await User.find({ _id: { $in: userIds } }).select('name collegeId year role');
      const memberMap = new Map(members.map((row) => [String(row._id), row]));

      leaderboard = sorted
        .map((row, index) => {
          const member = memberMap.get(row.memberId);
          if (!member) return null;
          return {
            rank: index + 1,
            member,
            points: row.points,
            quests: row.quests,
            resolvedMentors: row.resolvedMentors,
            convertedIdeas: row.convertedIdeas,
          };
        })
        .filter(Boolean);
    }

    return res.json({
      config,
      stats: {
        activeQuests: quests.filter((quest) => quest.status === 'Active').length,
        upcomingQuests: upcomingQuests.length,
        myQuestApprovals: approvedQuestCount,
        myMentorOpen: myMentorRequests.filter((row) => row.status === 'Open' || row.status === 'Accepted').length,
        myIdeas: myIdeas.length,
        myBookings: myBookings.length,
        myPoints: metrics.totalPoints,
        myLevel: level.currentLabel,
        pointsToNextLevel: level.toNext,
      },
      upcomingQuests,
      myUpcomingBookings: myBookings
        .filter((row) => row.slot && new Date(row.slot.startTime) >= now)
        .slice(0, 5),
      leaderboard,
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

const getProgramConfig = async (req, res) => {
  try {
    const config = await getConfig();
    return res.json(config);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

const updateProgramConfig = async (req, res) => {
  try {
    if (!isAdminOrHead(req.user)) {
      return res.status(403).json({ message: 'Only Admin/Head can update program config.' });
    }

    const config = await getConfig();
    const before = config.toObject();

    if (Object.prototype.hasOwnProperty.call(req.body, 'weeklyQuestsEnabled')) {
      config.weeklyQuestsEnabled = parseBool(req.body.weeklyQuestsEnabled, config.weeklyQuestsEnabled);
    }
    if (Object.prototype.hasOwnProperty.call(req.body, 'mentorDeskEnabled')) {
      config.mentorDeskEnabled = parseBool(req.body.mentorDeskEnabled, config.mentorDeskEnabled);
    }
    if (Object.prototype.hasOwnProperty.call(req.body, 'badgeSystemEnabled')) {
      config.badgeSystemEnabled = parseBool(req.body.badgeSystemEnabled, config.badgeSystemEnabled);
    }
    if (Object.prototype.hasOwnProperty.call(req.body, 'ideaIncubatorEnabled')) {
      config.ideaIncubatorEnabled = parseBool(req.body.ideaIncubatorEnabled, config.ideaIncubatorEnabled);
    }
    if (Object.prototype.hasOwnProperty.call(req.body, 'officeHoursEnabled')) {
      config.officeHoursEnabled = parseBool(req.body.officeHoursEnabled, config.officeHoursEnabled);
    }
    if (Object.prototype.hasOwnProperty.call(req.body, 'contestsEnabled')) {
      config.contestsEnabled = parseBool(req.body.contestsEnabled, config.contestsEnabled);
    }
    if (Object.prototype.hasOwnProperty.call(req.body, 'showProgramLeaderboard')) {
      config.showProgramLeaderboard = parseBool(req.body.showProgramLeaderboard, config.showProgramLeaderboard);
    }

    config.updatedBy = req.user.id;
    await config.save();

    await logAudit({
      actor: req.user.id,
      action: 'PROGRAM_CONFIG_UPDATED',
      entityType: 'ProgramConfig',
      entityId: config._id,
      before,
      after: config.toObject(),
      req,
    });

    return res.json(config);
  } catch (err) {
    return res.status(400).json({ message: err.message });
  }
};

const listQuests = async (req, res) => {
  try {
    const config = await getConfig();
    if (!config.weeklyQuestsEnabled && !isAdminOrHead(req.user)) {
      return res.status(403).json({ message: 'Weekly quests are currently disabled by admin.' });
    }

    const includeArchived = String(req.query.includeArchived || '').toLowerCase() === 'true';
    const isPrivileged = isAdminOrHead(req.user);

    const query = {};
    if (!isPrivileged) {
      query.status = { $in: ['Active', 'Closed'] };
      query.audience = { $in: audienceForUser(req.user) };
    } else if (!includeArchived) {
      query.status = { $ne: 'Archived' };
    }

    const rows = await WeeklyQuest.find(query)
      .sort({ startsAt: -1, createdAt: -1 })
      .populate('createdBy', 'name role')
      .lean();

    const submissions = await QuestSubmission.find({ member: req.user.id })
      .select('quest status pointsAwarded updatedAt')
      .lean();
    const subMap = new Map(submissions.map((row) => [String(row.quest), row]));

    const items = rows.map((quest) => {
      const mine = subMap.get(String(quest._id));
      return {
        ...quest,
        mySubmissionStatus: mine?.status || 'NotSubmitted',
        myPointsAwarded: mine?.pointsAwarded || 0,
        mySubmissionUpdatedAt: mine?.updatedAt || null,
      };
    });

    return res.json(items);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

const createQuest = async (req, res) => {
  try {
    if (!isAdminOrHead(req.user)) {
      return res.status(403).json({ message: 'Only Admin/Head can create quests.' });
    }

    const title = sanitize(req.body.title);
    if (title.length < 4) {
      return res.status(400).json({ message: 'Quest title must be at least 4 characters.' });
    }

    const startsAt = parseDate(req.body.startsAt);
    const endsAt = parseDate(req.body.endsAt);
    if (!startsAt || !endsAt || endsAt <= startsAt) {
      return res.status(400).json({ message: 'Quest start/end time is invalid.' });
    }

    const quest = await WeeklyQuest.create({
      title: title.slice(0, 120),
      summary: sanitize(req.body.summary).slice(0, 1200),
      category: normalizeEnum(req.body.category, QUEST_CATEGORIES, 'Technical'),
      points: Math.min(Math.max(parseInteger(req.body.points, 40), 1), 500),
      audience: normalizeEnum(req.body.audience, QUEST_AUDIENCES, 'FirstAndSecond'),
      status: normalizeEnum(req.body.status, QUEST_STATUSES, 'Active'),
      startsAt,
      endsAt,
      createdBy: req.user.id,
      updatedBy: req.user.id,
    });

    await logAudit({
      actor: req.user.id,
      action: 'PROGRAM_QUEST_CREATED',
      entityType: 'WeeklyQuest',
      entityId: quest._id,
      after: {
        title: quest.title,
        audience: quest.audience,
        points: quest.points,
        status: quest.status,
      },
      req,
    });

    return res.status(201).json(quest);
  } catch (err) {
    return res.status(400).json({ message: err.message });
  }
};

const updateQuest = async (req, res) => {
  try {
    if (!isAdminOrHead(req.user)) {
      return res.status(403).json({ message: 'Only Admin/Head can update quests.' });
    }

    const quest = await WeeklyQuest.findById(req.params.id);
    if (!quest) {
      return res.status(404).json({ message: 'Quest not found.' });
    }

    const before = {
      title: quest.title,
      status: quest.status,
      points: quest.points,
      audience: quest.audience,
      startsAt: quest.startsAt,
      endsAt: quest.endsAt,
    };

    if (Object.prototype.hasOwnProperty.call(req.body, 'title')) {
      const title = sanitize(req.body.title);
      if (title.length < 4) return res.status(400).json({ message: 'Quest title must be at least 4 characters.' });
      quest.title = title.slice(0, 120);
    }
    if (Object.prototype.hasOwnProperty.call(req.body, 'summary')) {
      quest.summary = sanitize(req.body.summary).slice(0, 1200);
    }
    if (Object.prototype.hasOwnProperty.call(req.body, 'category')) {
      const value = normalizeEnum(req.body.category, QUEST_CATEGORIES, '');
      if (!value) return res.status(400).json({ message: 'Invalid quest category.' });
      quest.category = value;
    }
    if (Object.prototype.hasOwnProperty.call(req.body, 'points')) {
      quest.points = Math.min(Math.max(parseInteger(req.body.points, quest.points), 1), 500);
    }
    if (Object.prototype.hasOwnProperty.call(req.body, 'audience')) {
      const value = normalizeEnum(req.body.audience, QUEST_AUDIENCES, '');
      if (!value) return res.status(400).json({ message: 'Invalid quest audience.' });
      quest.audience = value;
    }
    if (Object.prototype.hasOwnProperty.call(req.body, 'status')) {
      const value = normalizeEnum(req.body.status, QUEST_STATUSES, '');
      if (!value) return res.status(400).json({ message: 'Invalid quest status.' });
      quest.status = value;
    }
    if (Object.prototype.hasOwnProperty.call(req.body, 'startsAt')) {
      const startsAt = parseDate(req.body.startsAt);
      if (!startsAt) return res.status(400).json({ message: 'Invalid quest start date.' });
      quest.startsAt = startsAt;
    }
    if (Object.prototype.hasOwnProperty.call(req.body, 'endsAt')) {
      const endsAt = parseDate(req.body.endsAt);
      if (!endsAt) return res.status(400).json({ message: 'Invalid quest end date.' });
      quest.endsAt = endsAt;
    }

    if (quest.endsAt <= quest.startsAt) {
      return res.status(400).json({ message: 'Quest end date must be after start date.' });
    }

    quest.updatedBy = req.user.id;
    await quest.save();

    await logAudit({
      actor: req.user.id,
      action: 'PROGRAM_QUEST_UPDATED',
      entityType: 'WeeklyQuest',
      entityId: quest._id,
      before,
      after: {
        title: quest.title,
        status: quest.status,
        points: quest.points,
        audience: quest.audience,
        startsAt: quest.startsAt,
        endsAt: quest.endsAt,
      },
      req,
    });

    return res.json(quest);
  } catch (err) {
    return res.status(400).json({ message: err.message });
  }
};

const submitQuest = async (req, res) => {
  try {
    const config = await getConfig();
    if (!config.weeklyQuestsEnabled && !isAdminOrHead(req.user)) {
      return res.status(403).json({ message: 'Weekly quests are currently disabled by admin.' });
    }

    const quest = await WeeklyQuest.findById(req.params.id);
    if (!quest) {
      return res.status(404).json({ message: 'Quest not found.' });
    }

    if (!userCanAccessAudience(req.user, quest.audience)) {
      return res.status(403).json({ message: 'This quest is not available for your year.' });
    }

    if (!isAdminOrHead(req.user)) {
      const now = new Date();
      if (quest.status !== 'Active') {
        return res.status(403).json({ message: 'Quest is not active.' });
      }
      if (now < quest.startsAt || now > quest.endsAt) {
        return res.status(403).json({ message: 'Quest submissions are currently closed for this schedule.' });
      }
    }

    const evidenceText = sanitize(req.body.evidenceText).slice(0, 2000);
    const evidenceLink = sanitize(req.body.evidenceLink).slice(0, 280);
    if (!evidenceText && !evidenceLink) {
      return res.status(400).json({ message: 'Add evidence text or link.' });
    }

    const existing = await QuestSubmission.findOne({ quest: quest._id, member: req.user.id });
    const now = new Date();
    let row;
    if (!existing) {
      row = await QuestSubmission.create({
        quest: quest._id,
        member: req.user.id,
        evidenceText,
        evidenceLink,
        status: 'Submitted',
        pointsAwarded: 0,
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
      existing.evidenceText = evidenceText;
      existing.evidenceLink = evidenceLink;
      existing.status = 'Submitted';
      existing.pointsAwarded = 0;
      existing.reviewer = null;
      existing.reviewNote = '';
      existing.reviewedAt = null;
      existing.submittedAt = now;
      existing.events.unshift({
        action: 'Resubmitted',
        note: evidenceText || evidenceLink,
        actor: req.user.id,
        createdAt: now,
      });
      row = await existing.save();
    }

    const reviewers = await User.find({ role: { $in: ['Admin', 'Head'] } }).select('_id');
    await createNotifications({
      userIds: reviewers.map((item) => item._id),
      title: 'New Quest Submission',
      message: `${req.user.name || 'A member'} submitted quest: ${quest.title}.`,
      type: 'action',
      link: '/programs?tab=quests',
      meta: { questId: quest._id, submissionId: row._id },
      createdBy: req.user.id,
    });

    return res.status(existing ? 200 : 201).json(row);
  } catch (err) {
    return res.status(400).json({ message: err.message });
  }
};

const listMyQuestSubmissions = async (req, res) => {
  try {
    const rows = await QuestSubmission.find({ member: req.user.id })
      .sort({ updatedAt: -1 })
      .populate('quest', 'title points category audience status')
      .populate('reviewer', 'name role')
      .lean();

    return res.json(rows);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

const listQuestSubmissions = async (req, res) => {
  try {
    if (!isAdminOrHead(req.user)) {
      return res.status(403).json({ message: 'Only Admin/Head can review all quest submissions.' });
    }

    const query = {};
    const status = normalizeEnum(req.query.status, ['Submitted', 'Approved', 'Rejected', 'NeedsRevision'], '');
    if (status) query.status = status;

    const questId = sanitize(req.query.questId);
    if (questId) query.quest = questId;

    const rows = await QuestSubmission.find(query)
      .sort({ updatedAt: -1 })
      .limit(400)
      .populate('member', 'name collegeId year role')
      .populate('quest', 'title points category audience')
      .populate('reviewer', 'name role')
      .lean();

    return res.json(rows);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

const reviewQuestSubmission = async (req, res) => {
  try {
    if (!isAdminOrHead(req.user)) {
      return res.status(403).json({ message: 'Only Admin/Head can review quest submissions.' });
    }

    const row = await QuestSubmission.findById(req.params.id).populate('quest', 'title points');
    if (!row) {
      return res.status(404).json({ message: 'Quest submission not found.' });
    }

    const status = normalizeEnum(req.body.status, ['Approved', 'Rejected', 'NeedsRevision'], '');
    if (!status) {
      return res.status(400).json({ message: 'Invalid review status.' });
    }

    const note = sanitize(req.body.reviewNote).slice(0, 1200);
    if (status === 'NeedsRevision' && note.length < 8) {
      return res.status(400).json({ message: 'Revision note must be at least 8 characters.' });
    }

    const pointsAwarded =
      status === 'Approved'
        ? Math.min(Math.max(parseInteger(req.body.pointsAwarded, row.quest?.points || 0), 0), 500)
        : 0;

    row.status = status;
    row.reviewer = req.user.id;
    row.reviewedAt = new Date();
    row.reviewNote = note;
    row.pointsAwarded = pointsAwarded;
    row.events.unshift({
      action: status,
      note,
      actor: req.user.id,
      createdAt: new Date(),
    });

    await row.save();

    if (status === 'Approved') {
      await syncBadgesForMember(row.member, req.user.id);
    }

    await createNotifications({
      userIds: [row.member],
      title: 'Quest Submission Reviewed',
      message: `${row.quest?.title || 'Quest'} marked as ${status}.`,
      type: status === 'Approved' ? 'success' : status === 'Rejected' ? 'error' : 'warning',
      link: '/programs?tab=quests',
      meta: { submissionId: row._id, status },
      createdBy: req.user.id,
    });

    return res.json(row);
  } catch (err) {
    return res.status(400).json({ message: err.message });
  }
};

const createMentorRequest = async (req, res) => {
  try {
    const config = await getConfig();
    if (!config.mentorDeskEnabled && !isAdminOrHead(req.user)) {
      return res.status(403).json({ message: 'Mentor desk is currently disabled by admin.' });
    }

    const topic = sanitize(req.body.topic);
    const description = sanitize(req.body.description);
    if (topic.length < 4 || description.length < 12) {
      return res.status(400).json({ message: 'Topic/description are too short for mentor request.' });
    }

    const row = await MentorRequest.create({
      requester: req.user.id,
      topic: topic.slice(0, 120),
      description: description.slice(0, 1800),
      urgency: normalizeEnum(req.body.urgency, ['Low', 'Medium', 'High', 'Critical'], 'Medium'),
      preferredMode: normalizeEnum(req.body.preferredMode, ['Online', 'Offline', 'Either'], 'Either'),
      status: 'Open',
      events: [
        {
          action: 'Created',
          note: description.slice(0, 200),
          actor: req.user.id,
          createdAt: new Date(),
        },
      ],
    });

    const potentialMentors = await User.find({
      $or: [{ role: { $in: ['Admin', 'Head', 'Alumni'] } }, { role: 'User', year: { $gte: 2 } }],
      _id: { $ne: req.user.id },
      $or: [{ isVerified: true }, { approvalStatus: 'Approved' }],
    }).select('_id');

    await createNotifications({
      userIds: potentialMentors.map((item) => item._id),
      title: 'New Mentor Request',
      message: `${req.user.name || 'A member'} requested help on ${topic}.`,
      type: 'action',
      link: '/programs?tab=mentor',
      meta: { mentorRequestId: row._id },
      createdBy: req.user.id,
    });

    return res.status(201).json(row);
  } catch (err) {
    return res.status(400).json({ message: err.message });
  }
};

const listMentorRequests = async (req, res) => {
  try {
    const config = await getConfig();
    if (!config.mentorDeskEnabled && !isAdminOrHead(req.user)) {
      return res.status(403).json({ message: 'Mentor desk is currently disabled by admin.' });
    }

    const query = {};
    if (isAdminOrHead(req.user)) {
      // full visibility
    } else if (isSeniorMentor(req.user)) {
      query.$or = [
        { requester: req.user.id },
        { assignedMentor: req.user.id },
        { status: { $in: ['Open', 'Accepted'] } },
      ];
    } else {
      query.$or = [{ requester: req.user.id }, { assignedMentor: req.user.id }];
    }

    const status = normalizeEnum(req.query.status, ['Open', 'Accepted', 'Resolved', 'Closed'], '');
    if (status) {
      query.status = status;
    }

    const rows = await MentorRequest.find(query)
      .sort({ updatedAt: -1 })
      .limit(300)
      .populate('requester', 'name collegeId year role')
      .populate('assignedMentor', 'name collegeId year role')
      .lean();

    return res.json(rows);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

const updateMentorRequest = async (req, res) => {
  try {
    const row = await MentorRequest.findById(req.params.id);
    if (!row) {
      return res.status(404).json({ message: 'Mentor request not found.' });
    }

    const actorIsAdmin = isAdminOrHead(req.user);
    const actorIsRequester = String(row.requester) === String(req.user.id);
    const actorIsMentor = String(row.assignedMentor || '') === String(req.user.id);
    const actorIsSenior = isSeniorMentor(req.user);

    const targetStatus = Object.prototype.hasOwnProperty.call(req.body, 'status')
      ? normalizeEnum(req.body.status, ['Open', 'Accepted', 'Resolved', 'Closed'], '')
      : '';
    if (Object.prototype.hasOwnProperty.call(req.body, 'status') && !targetStatus) {
      return res.status(400).json({ message: 'Invalid mentor request status.' });
    }

    const previousStatus = row.status;

    if (targetStatus === 'Accepted') {
      if (!actorIsAdmin && !actorIsSenior) {
        return res.status(403).json({ message: 'Only mentors/seniors can accept this request.' });
      }
      row.status = 'Accepted';
      row.assignedMentor = req.user.id;
      row.events.unshift({
        action: 'Accepted',
        note: sanitize(req.body.note).slice(0, 200),
        actor: req.user.id,
        createdAt: new Date(),
      });
    }

    if (targetStatus === 'Resolved') {
      if (!actorIsAdmin && !actorIsMentor) {
        return res.status(403).json({ message: 'Only assigned mentor or Admin/Head can resolve this request.' });
      }
      const resolutionNote = sanitize(req.body.resolutionNote).slice(0, 1200);
      if (resolutionNote.length < 8) {
        return res.status(400).json({ message: 'Resolution note should be at least 8 characters.' });
      }
      row.status = 'Resolved';
      row.resolutionNote = resolutionNote;
      row.resolvedAt = new Date();
      row.events.unshift({
        action: 'Resolved',
        note: resolutionNote,
        actor: req.user.id,
        createdAt: new Date(),
      });
      if (row.assignedMentor) {
        await syncBadgesForMember(row.assignedMentor, req.user.id);
      }
    }

    if (targetStatus === 'Closed') {
      if (!actorIsAdmin && !actorIsMentor && !actorIsRequester) {
        return res.status(403).json({ message: 'Not authorized to close this request.' });
      }
      row.status = 'Closed';
      row.events.unshift({
        action: 'Closed',
        note: sanitize(req.body.note).slice(0, 200),
        actor: req.user.id,
        createdAt: new Date(),
      });
    }

    if (targetStatus === 'Open') {
      if (!actorIsAdmin && !actorIsRequester) {
        return res.status(403).json({ message: 'Only requester or Admin/Head can reopen request.' });
      }
      row.status = 'Open';
      row.resolvedAt = null;
      row.events.unshift({
        action: 'Reopened',
        note: sanitize(req.body.note).slice(0, 200),
        actor: req.user.id,
        createdAt: new Date(),
      });
    }

    const wantsMetaEdit =
      Object.prototype.hasOwnProperty.call(req.body, 'topic') ||
      Object.prototype.hasOwnProperty.call(req.body, 'description') ||
      Object.prototype.hasOwnProperty.call(req.body, 'urgency') ||
      Object.prototype.hasOwnProperty.call(req.body, 'preferredMode');

    if (wantsMetaEdit) {
      if (!actorIsAdmin && !actorIsRequester) {
        return res.status(403).json({ message: 'Only requester or Admin/Head can update request details.' });
      }
      if (!actorIsAdmin && row.status !== 'Open') {
        return res.status(400).json({ message: 'Request details can only be edited while request is open.' });
      }

      if (Object.prototype.hasOwnProperty.call(req.body, 'topic')) {
        const topic = sanitize(req.body.topic);
        if (topic.length < 4) return res.status(400).json({ message: 'Topic is too short.' });
        row.topic = topic.slice(0, 120);
      }
      if (Object.prototype.hasOwnProperty.call(req.body, 'description')) {
        const description = sanitize(req.body.description);
        if (description.length < 12) return res.status(400).json({ message: 'Description is too short.' });
        row.description = description.slice(0, 1800);
      }
      if (Object.prototype.hasOwnProperty.call(req.body, 'urgency')) {
        const urgency = normalizeEnum(req.body.urgency, ['Low', 'Medium', 'High', 'Critical'], '');
        if (!urgency) return res.status(400).json({ message: 'Invalid urgency.' });
        row.urgency = urgency;
      }
      if (Object.prototype.hasOwnProperty.call(req.body, 'preferredMode')) {
        const preferredMode = normalizeEnum(req.body.preferredMode, ['Online', 'Offline', 'Either'], '');
        if (!preferredMode) return res.status(400).json({ message: 'Invalid preferred mode.' });
        row.preferredMode = preferredMode;
      }
      row.events.unshift({
        action: 'Updated',
        note: 'Request details updated.',
        actor: req.user.id,
        createdAt: new Date(),
      });
    }

    await row.save();

    if (previousStatus !== row.status || wantsMetaEdit) {
      const recipients = new Set([String(row.requester)]);
      if (row.assignedMentor) recipients.add(String(row.assignedMentor));
      recipients.delete(String(req.user.id));

      await createNotifications({
        userIds: Array.from(recipients),
        title: 'Mentor Request Updated',
        message: `${row.topic} moved to ${row.status}.`,
        type: 'info',
        link: '/programs?tab=mentor',
        meta: { mentorRequestId: row._id, status: row.status },
        createdBy: req.user.id,
      });
    }

    return res.json(row);
  } catch (err) {
    return res.status(400).json({ message: err.message });
  }
};

const listBadgeRules = async (req, res) => {
  try {
    await ensureDefaultBadgeRules(req.user.id);

    const rows = isAdminOrHead(req.user)
      ? await BadgeRule.find({}).sort({ order: 1, createdAt: 1 }).lean()
      : await BadgeRule.find({ isEnabled: true }).sort({ order: 1, createdAt: 1 }).lean();

    return res.json(rows);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

const createBadgeRule = async (req, res) => {
  try {
    if (!isAdminOrHead(req.user)) {
      return res.status(403).json({ message: 'Only Admin/Head can create badge rules.' });
    }

    const name = sanitize(req.body.name);
    if (name.length < 3) {
      return res.status(400).json({ message: 'Badge name must be at least 3 characters.' });
    }

    const criteriaType = normalizeEnum(req.body.criteriaType, BADGE_CRITERIA_TYPES, '');
    if (!criteriaType) {
      return res.status(400).json({ message: 'Invalid badge criteria type.' });
    }

    const criteriaValue = Math.min(Math.max(parseInteger(req.body.criteriaValue, 1), 1), 100000);

    const rule = await BadgeRule.create({
      name: name.slice(0, 80),
      description: sanitize(req.body.description).slice(0, 400),
      icon: sanitize(req.body.icon).slice(0, 30) || 'Medal',
      criteriaType,
      criteriaValue,
      isEnabled: parseBool(req.body.isEnabled, true),
      order: Math.max(parseInteger(req.body.order, 0), 0),
      createdBy: req.user.id,
      updatedBy: req.user.id,
    });

    return res.status(201).json(rule);
  } catch (err) {
    return res.status(400).json({ message: err.message });
  }
};

const updateBadgeRule = async (req, res) => {
  try {
    if (!isAdminOrHead(req.user)) {
      return res.status(403).json({ message: 'Only Admin/Head can update badge rules.' });
    }

    const rule = await BadgeRule.findById(req.params.id);
    if (!rule) {
      return res.status(404).json({ message: 'Badge rule not found.' });
    }

    if (Object.prototype.hasOwnProperty.call(req.body, 'name')) {
      const name = sanitize(req.body.name);
      if (name.length < 3) return res.status(400).json({ message: 'Badge name must be at least 3 characters.' });
      rule.name = name.slice(0, 80);
    }
    if (Object.prototype.hasOwnProperty.call(req.body, 'description')) {
      rule.description = sanitize(req.body.description).slice(0, 400);
    }
    if (Object.prototype.hasOwnProperty.call(req.body, 'icon')) {
      rule.icon = sanitize(req.body.icon).slice(0, 30) || rule.icon;
    }
    if (Object.prototype.hasOwnProperty.call(req.body, 'criteriaType')) {
      const criteriaType = normalizeEnum(req.body.criteriaType, BADGE_CRITERIA_TYPES, '');
      if (!criteriaType) return res.status(400).json({ message: 'Invalid badge criteria type.' });
      rule.criteriaType = criteriaType;
    }
    if (Object.prototype.hasOwnProperty.call(req.body, 'criteriaValue')) {
      rule.criteriaValue = Math.min(Math.max(parseInteger(req.body.criteriaValue, rule.criteriaValue), 1), 100000);
    }
    if (Object.prototype.hasOwnProperty.call(req.body, 'isEnabled')) {
      rule.isEnabled = parseBool(req.body.isEnabled, rule.isEnabled);
    }
    if (Object.prototype.hasOwnProperty.call(req.body, 'order')) {
      rule.order = Math.max(parseInteger(req.body.order, rule.order), 0);
    }

    rule.updatedBy = req.user.id;
    await rule.save();

    return res.json(rule);
  } catch (err) {
    return res.status(400).json({ message: err.message });
  }
};

const getBadgeOverview = async (req, res) => {
  try {
    const config = await getConfig();
    if (!config.badgeSystemEnabled && !isAdminOrHead(req.user)) {
      return res.status(403).json({ message: 'Badge system is disabled by admin.' });
    }

    await ensureDefaultBadgeRules(req.user.id);
    await syncBadgesForMember(req.user.id, req.user.id);

    const [metrics, awards, rules] = await Promise.all([
      collectMemberMetrics(req.user.id),
      BadgeAward.find({ member: req.user.id })
        .populate('badgeRule', 'name description icon criteriaType criteriaValue')
        .sort({ awardedAt: -1 })
        .lean(),
      BadgeRule.find({ isEnabled: true }).sort({ order: 1, createdAt: 1 }).lean(),
    ]);

    const level = calculateLevel(metrics.totalPoints);

    return res.json({
      metrics,
      level,
      earnedBadges: awards,
      availableRules: rules,
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

const createIdea = async (req, res) => {
  try {
    const config = await getConfig();
    if (!config.ideaIncubatorEnabled && !isAdminOrHead(req.user)) {
      return res.status(403).json({ message: 'Idea incubator is currently disabled by admin.' });
    }

    const title = sanitize(req.body.title);
    const summary = sanitize(req.body.summary);
    if (title.length < 4 || summary.length < 12) {
      return res.status(400).json({ message: 'Idea title/summary are too short.' });
    }

    const tags = Array.isArray(req.body.tags)
      ? req.body.tags.map((tag) => sanitize(tag)).filter(Boolean).slice(0, 12)
      : sanitize(req.body.tags)
          .split(',')
          .map((tag) => sanitize(tag))
          .filter(Boolean)
          .slice(0, 12);

    const row = await ProjectIdea.create({
      title: title.slice(0, 120),
      summary: summary.slice(0, 1400),
      problemStatement: sanitize(req.body.problemStatement).slice(0, 1800),
      proposedStack: sanitize(req.body.proposedStack).slice(0, 900),
      tags,
      createdBy: req.user.id,
      team: [req.user.id],
      status: 'UnderReview',
    });

    const reviewers = await User.find({ role: { $in: ['Admin', 'Head'] } }).select('_id');
    await createNotifications({
      userIds: reviewers.map((item) => item._id),
      title: 'New Project Idea Submitted',
      message: `${req.user.name || 'A member'} submitted idea: ${row.title}.`,
      type: 'action',
      link: '/programs?tab=ideas',
      meta: { ideaId: row._id },
      createdBy: req.user.id,
    });

    return res.status(201).json(row);
  } catch (err) {
    return res.status(400).json({ message: err.message });
  }
};

const listIdeas = async (req, res) => {
  try {
    const config = await getConfig();
    if (!config.ideaIncubatorEnabled && !isAdminOrHead(req.user)) {
      return res.status(403).json({ message: 'Idea incubator is currently disabled by admin.' });
    }

    const query = {};
    if (!isAdminOrHead(req.user)) {
      query.$or = [
        { createdBy: req.user.id },
        { team: req.user.id },
        { status: { $in: ['Approved', 'Converted'] } },
      ];
    }

    const status = normalizeEnum(req.query.status, IDEA_STATUSES, '');
    if (status) query.status = status;

    const rows = await ProjectIdea.find(query)
      .sort({ updatedAt: -1 })
      .limit(400)
      .populate('createdBy', 'name collegeId year role')
      .populate('team', 'name collegeId year role')
      .populate('reviewedBy', 'name role')
      .populate('convertedProject', 'title status')
      .lean();

    return res.json(rows);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

const toggleIdeaJoin = async (req, res) => {
  try {
    const row = await ProjectIdea.findById(req.params.id);
    if (!row) {
      return res.status(404).json({ message: 'Idea not found.' });
    }

    if (row.status === 'Rejected') {
      return res.status(400).json({ message: 'Rejected ideas cannot be joined.' });
    }

    const idx = row.team.findIndex((item) => String(item) === String(req.user.id));
    if (idx >= 0) {
      row.team.splice(idx, 1);
    } else {
      row.team.push(req.user.id);
    }

    if (!row.team.some((item) => String(item) === String(row.createdBy))) {
      row.team.unshift(row.createdBy);
    }

    await row.save();

    return res.json({ success: true, joined: idx < 0, teamCount: row.team.length });
  } catch (err) {
    return res.status(400).json({ message: err.message });
  }
};

const updateIdea = async (req, res) => {
  try {
    const row = await ProjectIdea.findById(req.params.id);
    if (!row) {
      return res.status(404).json({ message: 'Idea not found.' });
    }

    const actorIsAdmin = isAdminOrHead(req.user);
    const actorIsOwner = String(row.createdBy) === String(req.user.id);

    const wantsReview = Object.prototype.hasOwnProperty.call(req.body, 'status');
    if (wantsReview) {
      if (!actorIsAdmin) {
        return res.status(403).json({ message: 'Only Admin/Head can review ideas.' });
      }
      const status = normalizeEnum(req.body.status, ['UnderReview', 'Approved', 'Rejected'], '');
      if (!status) return res.status(400).json({ message: 'Invalid idea status update.' });
      row.status = status;
      row.reviewNote = sanitize(req.body.reviewNote).slice(0, 1200);
      row.reviewedBy = req.user.id;
      row.reviewedAt = new Date();

      await createNotifications({
        userIds: [row.createdBy],
        title: 'Idea Review Updated',
        message: `${row.title} is now ${status}.`,
        type: status === 'Approved' ? 'success' : status === 'Rejected' ? 'error' : 'info',
        link: '/programs?tab=ideas',
        meta: { ideaId: row._id, status },
        createdBy: req.user.id,
      });
    }

    const wantsContentEdit =
      Object.prototype.hasOwnProperty.call(req.body, 'title') ||
      Object.prototype.hasOwnProperty.call(req.body, 'summary') ||
      Object.prototype.hasOwnProperty.call(req.body, 'problemStatement') ||
      Object.prototype.hasOwnProperty.call(req.body, 'proposedStack') ||
      Object.prototype.hasOwnProperty.call(req.body, 'tags');

    if (wantsContentEdit) {
      if (!actorIsAdmin && !actorIsOwner) {
        return res.status(403).json({ message: 'Only owner or Admin/Head can edit idea content.' });
      }
      if (!actorIsAdmin && row.status !== 'UnderReview') {
        return res.status(400).json({ message: 'Idea content can only be edited while under review.' });
      }

      if (Object.prototype.hasOwnProperty.call(req.body, 'title')) {
        const title = sanitize(req.body.title);
        if (title.length < 4) return res.status(400).json({ message: 'Idea title is too short.' });
        row.title = title.slice(0, 120);
      }
      if (Object.prototype.hasOwnProperty.call(req.body, 'summary')) {
        const summary = sanitize(req.body.summary);
        if (summary.length < 12) return res.status(400).json({ message: 'Idea summary is too short.' });
        row.summary = summary.slice(0, 1400);
      }
      if (Object.prototype.hasOwnProperty.call(req.body, 'problemStatement')) {
        row.problemStatement = sanitize(req.body.problemStatement).slice(0, 1800);
      }
      if (Object.prototype.hasOwnProperty.call(req.body, 'proposedStack')) {
        row.proposedStack = sanitize(req.body.proposedStack).slice(0, 900);
      }
      if (Object.prototype.hasOwnProperty.call(req.body, 'tags')) {
        row.tags = Array.isArray(req.body.tags)
          ? req.body.tags.map((item) => sanitize(item)).filter(Boolean).slice(0, 12)
          : sanitize(req.body.tags)
              .split(',')
              .map((item) => sanitize(item))
              .filter(Boolean)
              .slice(0, 12);
      }
    }

    await row.save();

    return res.json(row);
  } catch (err) {
    return res.status(400).json({ message: err.message });
  }
};

const convertIdeaToProject = async (req, res) => {
  try {
    if (!isAdminOrHead(req.user)) {
      return res.status(403).json({ message: 'Only Admin/Head can convert ideas to projects.' });
    }

    const idea = await ProjectIdea.findById(req.params.id);
    if (!idea) {
      return res.status(404).json({ message: 'Idea not found.' });
    }
    if (idea.status !== 'Approved') {
      return res.status(400).json({ message: 'Only approved ideas can be converted to projects.' });
    }

    const domain = normalizeEnum(req.body.domain, ['Tech', 'Management', 'PR'], 'Tech');
    const lead = sanitize(req.body.lead) || String(idea.createdBy);

    const memberIds = new Set((idea.team || []).map((item) => String(item)));
    memberIds.add(String(idea.createdBy));
    memberIds.add(String(lead));

    let title = sanitize(req.body.title) || idea.title;
    title = title.slice(0, 120);

    const duplicate = await Project.findOne({ title });
    if (duplicate) {
      title = `${title} (${String(idea._id).slice(-4)})`;
    }

    const description =
      sanitize(req.body.description) ||
      `${idea.summary}\n\nProblem: ${idea.problemStatement || 'N/A'}\n\nStack: ${idea.proposedStack || 'N/A'}`;

    const project = await Project.create({
      title,
      description: description.slice(0, 4000),
      domain,
      team: Array.from(memberIds),
      lead,
      status: 'Ongoing',
    });

    idea.status = 'Converted';
    idea.convertedProject = project._id;
    idea.convertedAt = new Date();
    idea.reviewedBy = req.user.id;
    idea.reviewedAt = new Date();
    idea.reviewNote = sanitize(req.body.reviewNote).slice(0, 1200) || idea.reviewNote;
    await idea.save();

    await syncBadgesForMember(idea.createdBy, req.user.id);

    await createNotifications({
      userIds: Array.from(memberIds),
      title: 'Idea Converted To Project',
      message: `${idea.title} is now an active project.`,
      type: 'success',
      link: '/projects',
      meta: { projectId: project._id, ideaId: idea._id },
      createdBy: req.user.id,
    });

    await logAudit({
      actor: req.user.id,
      action: 'PROGRAM_IDEA_CONVERTED',
      entityType: 'ProjectIdea',
      entityId: idea._id,
      after: {
        ideaId: idea._id,
        projectId: project._id,
        title: idea.title,
      },
      req,
    });

    return res.status(201).json({
      success: true,
      idea,
      project,
    });
  } catch (err) {
    return res.status(400).json({ message: err.message });
  }
};

const createOfficeHourSlot = async (req, res) => {
  try {
    const config = await getConfig();
    if (!config.officeHoursEnabled && !isAdminOrHead(req.user)) {
      return res.status(403).json({ message: 'Office hours are currently disabled by admin.' });
    }

    if (!isAdminOrHead(req.user)) {
      return res.status(403).json({ message: 'Only Admin/Head can create office-hour slots.' });
    }

    const title = sanitize(req.body.title);
    if (title.length < 4) {
      return res.status(400).json({ message: 'Slot title should be at least 4 characters.' });
    }

    const startTime = parseDate(req.body.startTime);
    const endTime = parseDate(req.body.endTime);
    if (!startTime || !endTime || endTime <= startTime) {
      return res.status(400).json({ message: 'Invalid office-hour schedule window.' });
    }

    const mentorId = sanitize(req.body.mentor) || req.user.id;
    const mentor = await User.findById(mentorId).select('_id name role year');
    if (!mentor) {
      return res.status(404).json({ message: 'Mentor account not found.' });
    }
    if (!isSeniorMentor(mentor)) {
      return res.status(400).json({ message: 'Selected mentor must be senior/admin/head/alumni.' });
    }

    const row = await OfficeHourSlot.create({
      title: title.slice(0, 120),
      topic: sanitize(req.body.topic).slice(0, 400),
      mode: normalizeEnum(req.body.mode, ['Online', 'Offline', 'Hybrid'], 'Online'),
      locationOrLink: sanitize(req.body.locationOrLink).slice(0, 240),
      mentor: mentorId,
      capacity: Math.min(Math.max(parseInteger(req.body.capacity, 8), 1), 500),
      startTime,
      endTime,
      status: normalizeEnum(req.body.status, ['Open', 'Closed', 'Cancelled'], 'Open'),
      createdBy: req.user.id,
      updatedBy: req.user.id,
    });

    return res.status(201).json(row);
  } catch (err) {
    if (err.message) {
      return res.status(400).json({ message: err.message });
    }
    return res.status(500).json({ message: 'Failed to create office-hour slot.' });
  }
};

const listOfficeHourSlots = async (req, res) => {
  try {
    const config = await getConfig();
    if (!config.officeHoursEnabled && !isAdminOrHead(req.user)) {
      return res.status(403).json({ message: 'Office hours are currently disabled by admin.' });
    }

    const includePast = String(req.query.includePast || '').toLowerCase() === 'true';
    const actorIsAdmin = isAdminOrHead(req.user);

    const query = {};
    if (!actorIsAdmin) {
      query.status = { $ne: 'Cancelled' };
      if (!includePast) {
        query.startTime = { $gte: new Date(Date.now() - 2 * 60 * 60 * 1000) };
      }
    }

    const slots = await OfficeHourSlot.find(query)
      .sort({ startTime: 1 })
      .limit(300)
      .populate('mentor', 'name collegeId role year')
      .lean();

    const slotIds = slots.map((row) => row._id);
    const myBookings = slotIds.length
      ? await OfficeHourBooking.find({ slot: { $in: slotIds }, member: req.user.id })
          .select('slot status bookedAt note')
          .lean()
      : [];

    const bookingMap = new Map(myBookings.map((row) => [String(row.slot), row]));
    const bookedCountsAgg = slotIds.length
      ? await OfficeHourBooking.aggregate([
          { $match: { slot: { $in: slotIds }, status: 'Booked' } },
          { $group: { _id: '$slot', count: { $sum: 1 } } },
        ])
      : [];
    const countMap = new Map(bookedCountsAgg.map((row) => [String(row._id), Number(row.count || 0)]));

    const rows = slots.map((slot) => {
      const activeCount = countMap.get(String(slot._id)) ?? Number(slot.bookedCount || 0);
      const mine = bookingMap.get(String(slot._id));
      return {
        ...slot,
        bookedCount: activeCount,
        seatsLeft: Math.max(0, Number(slot.capacity || 0) - activeCount),
        isBookedByMe: !!mine && mine.status === 'Booked',
        myBookingStatus: mine?.status || 'NotBooked',
        myBookingNote: mine?.note || '',
      };
    });

    return res.json(rows);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

const updateOfficeHourSlot = async (req, res) => {
  try {
    if (!isAdminOrHead(req.user)) {
      return res.status(403).json({ message: 'Only Admin/Head can update office-hour slots.' });
    }

    const slot = await OfficeHourSlot.findById(req.params.id);
    if (!slot) {
      return res.status(404).json({ message: 'Office-hour slot not found.' });
    }

    if (Object.prototype.hasOwnProperty.call(req.body, 'title')) {
      const title = sanitize(req.body.title);
      if (title.length < 4) return res.status(400).json({ message: 'Slot title should be at least 4 characters.' });
      slot.title = title.slice(0, 120);
    }
    if (Object.prototype.hasOwnProperty.call(req.body, 'topic')) {
      slot.topic = sanitize(req.body.topic).slice(0, 400);
    }
    if (Object.prototype.hasOwnProperty.call(req.body, 'mode')) {
      const mode = normalizeEnum(req.body.mode, ['Online', 'Offline', 'Hybrid'], '');
      if (!mode) return res.status(400).json({ message: 'Invalid office-hour mode.' });
      slot.mode = mode;
    }
    if (Object.prototype.hasOwnProperty.call(req.body, 'locationOrLink')) {
      slot.locationOrLink = sanitize(req.body.locationOrLink).slice(0, 240);
    }
    if (Object.prototype.hasOwnProperty.call(req.body, 'capacity')) {
      slot.capacity = Math.min(Math.max(parseInteger(req.body.capacity, slot.capacity), 1), 500);
    }
    if (Object.prototype.hasOwnProperty.call(req.body, 'status')) {
      const status = normalizeEnum(req.body.status, ['Open', 'Closed', 'Cancelled'], '');
      if (!status) return res.status(400).json({ message: 'Invalid slot status.' });
      slot.status = status;
    }
    if (Object.prototype.hasOwnProperty.call(req.body, 'startTime')) {
      const startTime = parseDate(req.body.startTime);
      if (!startTime) return res.status(400).json({ message: 'Invalid slot start time.' });
      slot.startTime = startTime;
    }
    if (Object.prototype.hasOwnProperty.call(req.body, 'endTime')) {
      const endTime = parseDate(req.body.endTime);
      if (!endTime) return res.status(400).json({ message: 'Invalid slot end time.' });
      slot.endTime = endTime;
    }
    if (slot.endTime <= slot.startTime) {
      return res.status(400).json({ message: 'Slot end time must be after start time.' });
    }

    slot.updatedBy = req.user.id;
    await slot.save();
    await refreshSlotBookedCount(slot._id);

    return res.json(slot);
  } catch (err) {
    return res.status(400).json({ message: err.message });
  }
};

const bookOfficeHourSlot = async (req, res) => {
  try {
    const config = await getConfig();
    if (!config.officeHoursEnabled && !isAdminOrHead(req.user)) {
      return res.status(403).json({ message: 'Office hours are currently disabled by admin.' });
    }

    const slot = await OfficeHourSlot.findById(req.params.id);
    if (!slot) {
      return res.status(404).json({ message: 'Office-hour slot not found.' });
    }

    if (slot.status !== 'Open') {
      return res.status(400).json({ message: 'This office-hour slot is not open for bookings.' });
    }
    if (new Date(slot.endTime) <= new Date()) {
      return res.status(400).json({ message: 'Cannot book a completed office-hour slot.' });
    }

    const bookedCount = await OfficeHourBooking.countDocuments({ slot: slot._id, status: 'Booked' });
    if (bookedCount >= Number(slot.capacity || 0)) {
      return res.status(400).json({ message: 'This office-hour slot is fully booked.' });
    }

    const note = sanitize(req.body.note).slice(0, 1200);

    let booking = await OfficeHourBooking.findOne({ slot: slot._id, member: req.user.id });
    if (!booking) {
      booking = await OfficeHourBooking.create({
        slot: slot._id,
        member: req.user.id,
        note,
        status: 'Booked',
        bookedAt: new Date(),
        updatedBy: req.user.id,
      });
    } else {
      if (booking.status === 'Booked') {
        return res.status(400).json({ message: 'You already booked this slot.' });
      }
      booking.status = 'Booked';
      booking.note = note;
      booking.bookedAt = new Date();
      booking.updatedBy = req.user.id;
      await booking.save();
    }

    await refreshSlotBookedCount(slot._id);

    await createNotifications({
      userIds: [slot.mentor],
      title: 'New Office-Hour Booking',
      message: `${req.user.name || 'A member'} booked your office-hour slot: ${slot.title}.`,
      type: 'action',
      link: '/programs?tab=office-hours',
      meta: { slotId: slot._id, bookingId: booking._id },
      createdBy: req.user.id,
    });

    return res.status(201).json(booking);
  } catch (err) {
    return res.status(400).json({ message: err.message });
  }
};

const listMyOfficeHourBookings = async (req, res) => {
  try {
    const rows = await OfficeHourBooking.find({ member: req.user.id })
      .sort({ updatedAt: -1 })
      .populate({
        path: 'slot',
        populate: { path: 'mentor', select: 'name role collegeId year' },
      })
      .lean();

    return res.json(rows);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

const updateOfficeHourBooking = async (req, res) => {
  try {
    const booking = await OfficeHourBooking.findById(req.params.id).populate('slot');
    if (!booking) {
      return res.status(404).json({ message: 'Office-hour booking not found.' });
    }

    const action = normalizeEnum(req.body.action, ['Cancel', 'Complete', 'NoShow'], '');
    if (!action) {
      return res.status(400).json({ message: 'Invalid booking action.' });
    }

    const actorIsAdmin = isAdminOrHead(req.user);
    const actorIsOwner = String(booking.member) === String(req.user.id);
    const actorIsMentor = String(booking.slot?.mentor || '') === String(req.user.id);

    if (action === 'Cancel') {
      if (!actorIsAdmin && !actorIsOwner) {
        return res.status(403).json({ message: 'Only booking owner or Admin/Head can cancel booking.' });
      }
      booking.status = 'Cancelled';
    }
    if (action === 'Complete') {
      if (!actorIsAdmin && !actorIsMentor) {
        return res.status(403).json({ message: 'Only mentor or Admin/Head can mark booking completed.' });
      }
      booking.status = 'Completed';
    }
    if (action === 'NoShow') {
      if (!actorIsAdmin && !actorIsMentor) {
        return res.status(403).json({ message: 'Only mentor or Admin/Head can mark no-show.' });
      }
      booking.status = 'NoShow';
    }

    booking.updatedBy = req.user.id;
    await booking.save();
    await refreshSlotBookedCount(booking.slot?._id || booking.slot);

    if (action === 'Complete' || action === 'NoShow') {
      await createNotifications({
        userIds: [booking.member],
        title: 'Office-Hour Booking Updated',
        message: `${booking.slot?.title || 'Slot'} marked as ${booking.status}.`,
        type: action === 'Complete' ? 'success' : 'warning',
        link: '/programs?tab=office-hours',
        meta: { bookingId: booking._id, status: booking.status },
        createdBy: req.user.id,
      });
    }

    return res.json(booking);
  } catch (err) {
    return res.status(400).json({ message: err.message });
  }
};

/* ─────────── Contests ─────────── */

const listContests = async (req, res) => {
  try {
    const config = await getConfig();
    if (!config.contestsEnabled && !isAdminOrHead(req.user)) {
      return res.status(403).json({ message: 'Contests are currently disabled by admin.' });
    }

    const filter = {};
    if (!isAdminOrHead(req.user)) {
      filter.status = 'Active';
      filter.audience = { $in: audienceForUser(req.user) };
    } else if (!parseBool(req.query.includeAll, false)) {
      filter.status = { $in: ['Active', 'Draft'] };
    }

    const rows = await Contest.find(filter).sort({ startsAt: -1 }).populate('createdBy', 'name collegeId');
    return res.json(rows);
  } catch (err) {
    return res.status(400).json({ message: err.message });
  }
};

const createContest = async (req, res) => {
  try {
    if (!isAdminOrHead(req.user)) {
      return res.status(403).json({ message: 'Only Admin/Head can create contests.' });
    }

    const { title, description, questions, duration, audience, status, startsAt, endsAt } = req.body;

    if (!sanitize(title)) return res.status(400).json({ message: 'Title is required.' });
    if (!Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({ message: 'At least one question is required.' });
    }

    const parsedQuestions = questions.map((q) => {
      const qt = sanitize(q.questionText);
      if (!qt) throw new Error('Each question needs question text.');
      const ca = sanitize(q.correctAnswer);
      if (!ca) throw new Error('Each question needs a correct answer.');
      return {
        questionText: qt.slice(0, 1000),
        questionType: normalizeEnum(q.questionType, ['MCQ', 'Text'], 'MCQ'),
        options: Array.isArray(q.options) ? q.options.map((o) => sanitize(o).slice(0, 300)).filter(Boolean) : [],
        correctAnswer: ca.slice(0, 300),
        points: parseInteger(q.points, 10),
      };
    });

    const start = parseDate(startsAt);
    const end = parseDate(endsAt);
    if (!start || !end) return res.status(400).json({ message: 'Valid start and end dates are required.' });

    const contest = await Contest.create({
      title: sanitize(title).slice(0, 150),
      description: sanitize(description).slice(0, 2000),
      questions: parsedQuestions,
      duration: parseInteger(duration, 30),
      audience: normalizeEnum(audience, QUEST_AUDIENCES, 'AllMembers'),
      status: normalizeEnum(status, CONTEST_STATUSES, 'Draft'),
      startsAt: start,
      endsAt: end,
      createdBy: req.user.id,
    });

    return res.status(201).json(contest);
  } catch (err) {
    return res.status(400).json({ message: err.message });
  }
};

const updateContest = async (req, res) => {
  try {
    if (!isAdminOrHead(req.user)) {
      return res.status(403).json({ message: 'Only Admin/Head can update contests.' });
    }

    const contest = await Contest.findById(req.params.id);
    if (!contest) return res.status(404).json({ message: 'Contest not found.' });

    const allowed = ['title', 'description', 'questions', 'duration', 'audience', 'status', 'startsAt', 'endsAt'];
    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        if (key === 'status') {
          contest.status = normalizeEnum(req.body.status, CONTEST_STATUSES, contest.status);
        } else if (key === 'audience') {
          contest.audience = normalizeEnum(req.body.audience, QUEST_AUDIENCES, contest.audience);
        } else if (key === 'startsAt' || key === 'endsAt') {
          const d = parseDate(req.body[key]);
          if (d) contest[key] = d;
        } else if (key === 'questions' && Array.isArray(req.body.questions)) {
          contest.questions = req.body.questions.map((q) => ({
            questionText: sanitize(q.questionText).slice(0, 1000),
            questionType: normalizeEnum(q.questionType, ['MCQ', 'Text'], 'MCQ'),
            options: Array.isArray(q.options) ? q.options.map((o) => sanitize(o).slice(0, 300)).filter(Boolean) : [],
            correctAnswer: sanitize(q.correctAnswer).slice(0, 300),
            points: parseInteger(q.points, 10),
          }));
        } else if (key === 'duration') {
          contest.duration = parseInteger(req.body.duration, contest.duration);
        } else {
          contest[key] = sanitize(req.body[key]).slice(0, key === 'description' ? 2000 : 150);
        }
      }
    }

    contest.updatedBy = req.user.id;
    await contest.save();
    return res.json(contest);
  } catch (err) {
    return res.status(400).json({ message: err.message });
  }
};

const startContestAttempt = async (req, res) => {
  try {
    const config = await getConfig();
    if (!config.contestsEnabled && !isAdminOrHead(req.user)) {
      return res.status(403).json({ message: 'Contests are currently disabled by admin.' });
    }

    const contest = await Contest.findById(req.params.id);
    if (!contest) return res.status(404).json({ message: 'Contest not found.' });

    if (!userCanAccessAudience(req.user, contest.audience)) {
      return res.status(403).json({ message: 'This contest is not available for your year.' });
    }

    if (!isAdminOrHead(req.user)) {
      const now = new Date();
      if (contest.status !== 'Active') return res.status(403).json({ message: 'Contest is not active.' });
      if (now < contest.startsAt || now > contest.endsAt) {
        return res.status(403).json({ message: 'Contest is not within the open window.' });
      }
    }

    const existing = await ContestAttempt.findOne({ contest: contest._id, member: req.user.id });
    if (existing) {
      const questions = contest.questions.map((q) => ({
        _id: q._id,
        questionText: q.questionText,
        questionType: q.questionType,
        options: q.options,
        points: q.points,
      }));
      return res.json({ attempt: existing, questions });
    }

    const totalPoints = contest.questions.reduce((sum, q) => sum + (q.points || 10), 0);
    const attempt = await ContestAttempt.create({
      contest: contest._id,
      member: req.user.id,
      answers: [],
      score: 0,
      totalPoints,
      status: 'InProgress',
      startedAt: new Date(),
    });

    const questions = contest.questions.map((q) => ({
      _id: q._id,
      questionText: q.questionText,
      questionType: q.questionType,
      options: q.options,
      points: q.points,
    }));

    return res.status(201).json({ attempt, questions });
  } catch (err) {
    return res.status(400).json({ message: err.message });
  }
};

const submitContestAttempt = async (req, res) => {
  try {
    const contest = await Contest.findById(req.params.id);
    if (!contest) return res.status(404).json({ message: 'Contest not found.' });

    const attempt = await ContestAttempt.findOne({ contest: contest._id, member: req.user.id });
    if (!attempt) return res.status(404).json({ message: 'No attempt found. Start the contest first.' });
    if (attempt.status === 'Submitted') {
      return res.status(400).json({ message: 'You have already submitted this contest.' });
    }

    const { answers } = req.body;
    if (!Array.isArray(answers)) return res.status(400).json({ message: 'Answers array is required.' });

    let score = 0;
    const gradedAnswers = answers.map((a) => {
      const question = contest.questions.id(a.questionId);
      if (!question) return { questionId: a.questionId, selectedAnswer: sanitize(a.selectedAnswer).slice(0, 500) };
      const selected = sanitize(a.selectedAnswer).slice(0, 500);
      if (selected.toLowerCase() === question.correctAnswer.toLowerCase()) {
        score += question.points || 10;
      }
      return { questionId: a.questionId, selectedAnswer: selected };
    });

    attempt.answers = gradedAnswers;
    attempt.score = score;
    attempt.status = 'Submitted';
    attempt.submittedAt = new Date();
    await attempt.save();

    return res.json(attempt);
  } catch (err) {
    return res.status(400).json({ message: err.message });
  }
};

const listMyContestAttempts = async (req, res) => {
  try {
    const rows = await ContestAttempt.find({ member: req.user.id })
      .sort({ createdAt: -1 })
      .populate('contest', 'title description duration status startsAt endsAt');
    return res.json(rows);
  } catch (err) {
    return res.status(400).json({ message: err.message });
  }
};

module.exports = {
  listProgramOverview,
  getProgramConfig,
  updateProgramConfig,
  listQuests,
  createQuest,
  updateQuest,
  submitQuest,
  listMyQuestSubmissions,
  listQuestSubmissions,
  reviewQuestSubmission,
  createMentorRequest,
  listMentorRequests,
  updateMentorRequest,
  listBadgeRules,
  createBadgeRule,
  updateBadgeRule,
  getBadgeOverview,
  createIdea,
  listIdeas,
  toggleIdeaJoin,
  updateIdea,
  convertIdeaToProject,
  createOfficeHourSlot,
  listOfficeHourSlots,
  updateOfficeHourSlot,
  bookOfficeHourSlot,
  listMyOfficeHourBookings,
  updateOfficeHourBooking,
  listContests,
  createContest,
  updateContest,
  startContestAttempt,
  submitContestAttempt,
  listMyContestAttempts,
};
