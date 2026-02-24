const Project = require('../models/Project');
const Meeting = require('../models/Meeting');
const Post = require('../models/Post');

const yearsSince = (dateValue) => {
  const start = new Date(dateValue);
  const now = new Date();
  const years = now.getFullYear() - start.getFullYear();
  const hasNotCompletedYear =
    now.getMonth() < start.getMonth() ||
    (now.getMonth() === start.getMonth() && now.getDate() < start.getDate());
  return Math.max(0, years - (hasNotCompletedYear ? 1 : 0));
};

const buildUserInsights = async (user) => {
  const userId = user._id;

  const [projectsLed, projectsInTeam, meetingsOrganized, meetingsJoined, postsCreated] = await Promise.all([
    Project.countDocuments({ lead: userId }),
    Project.countDocuments({ team: userId }),
    Meeting.countDocuments({ organizedBy: userId }),
    Meeting.countDocuments({ participants: userId }),
    Post.countDocuments({ user: userId }),
  ]);

  const suggestionAgg = await Project.aggregate([
    { $unwind: '$suggestions' },
    { $match: { 'suggestions.author': userId } },
    { $count: 'count' },
  ]);
  const suggestionsAdded = suggestionAgg[0]?.count || 0;

  const contributedProjects = await Project.find({
    $or: [{ lead: userId }, { team: userId }],
  })
    .select('title status domain')
    .sort({ updatedAt: -1 })
    .limit(8)
    .lean();

  const events = await Meeting.find({
    $or: [{ organizedBy: userId }, { participants: userId }],
  })
    .select('title startTime meetingType details.topic')
    .sort({ startTime: -1 })
    .limit(8)
    .lean();

  const effectiveJoinedAt = user.joinedAt || user.createdAt;
  const yearsInCICR = yearsSince(effectiveJoinedAt);

  return {
    member: {
      _id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone || '',
      collegeId: user.collegeId,
      role: user.role,
      branch: user.branch || null,
      year: user.year || null,
      batch: user.batch || null,
      approvalStatus: user.approvalStatus || (user.isVerified ? 'Approved' : 'Pending'),
      joinedAt: effectiveJoinedAt,
      yearsInCICR,
      bio: user.bio || '',
      achievements: Array.isArray(user.achievements) ? user.achievements : [],
      skills: Array.isArray(user.skills) ? user.skills : [],
      social: user.social || {},
    },
    metrics: {
      projectsLed,
      projectsInTeam,
      totalProjectContributions: projectsLed + projectsInTeam + suggestionsAdded,
      suggestionsAdded,
      meetingsOrganized,
      meetingsJoined,
      totalEvents: meetingsOrganized + meetingsJoined,
      postsCreated,
      totalAchievements: Array.isArray(user.achievements) ? user.achievements.length : 0,
    },
    contributedProjects,
    events,
  };
};

module.exports = { buildUserInsights };
