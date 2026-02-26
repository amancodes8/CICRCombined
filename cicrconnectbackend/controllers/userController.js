const User = require('../models/User');
const mongoose = require('mongoose');
const { buildUserInsights } = require('../utils/userInsights');
const {
    YEAR_MIN,
    YEAR_MAX,
    normalizeAlumniProfile,
    validateTenures,
} = require('../utils/alumniProfile');

const normalizeHandle = (value) => {
    if (!value) return '';
    const raw = String(value).trim();
    if (!raw) return '';

    if (raw.startsWith('http://') || raw.startsWith('https://')) {
        try {
            const u = new URL(raw);
            const path = u.pathname.replace(/^\/+|\/+$/g, '');
            return path.split('/')[0] || '';
        } catch {
            return raw.replace(/^@+/, '');
        }
    }

    return raw.replace(/^@+/, '');
};

/**
 * @desc    Get logged in user's profile
 * @route   GET /api/users/profile
 * @access  Private
 */
const getUserProfile = async (req, res) => {
    // req.user is attached from the auth middleware, so this finds the logged-in user
    const user = await User.findById(req.user.id).select('-password');

    if (user) {
        res.json(user);
    } else {
        res.status(404);
        throw new Error('User not found');
    }
};

/**
 * @desc    Update user profile
 * @route   PUT /api/users/profile
 * @access  Private
 */
const updateUserProfile = async (req, res) => {
    const user = await User.findById(req.user.id);

    if (user) {
        user.name = req.body.name || user.name;
        user.phone = req.body.phone || user.phone;
        user.year = req.body.year || user.year;
        user.branch = req.body.branch || user.branch;
        user.batch = req.body.batch || user.batch;
        user.joinedAt = req.body.joinedAt ? new Date(req.body.joinedAt) : user.joinedAt;
        user.projectIdeas = req.body.projectIdeas || user.projectIdeas;
        user.bio = req.body.bio ?? user.bio;
        user.achievements = Array.isArray(req.body.achievements) ? req.body.achievements : user.achievements;
        user.skills = Array.isArray(req.body.skills) ? req.body.skills : user.skills;
        user.social = {
            linkedin: req.body.social?.linkedin ?? user.social?.linkedin ?? '',
            github: req.body.social?.github ?? user.social?.github ?? '',
            portfolio: req.body.social?.portfolio ?? user.social?.portfolio ?? '',
            instagram: normalizeHandle(req.body.social?.instagram ?? user.social?.instagram ?? ''),
            facebook: normalizeHandle(req.body.social?.facebook ?? user.social?.facebook ?? ''),
        };

        if (Object.prototype.hasOwnProperty.call(req.body, 'alumniProfile')) {
            const normalizedAlumniProfile = normalizeAlumniProfile(req.body.alumniProfile, user.alumniProfile || {});
            const tenureValidation = validateTenures(normalizedAlumniProfile.tenures);
            if (!tenureValidation.ok) {
                return res.status(400).json({ message: tenureValidation.message });
            }
            if (
                Number.isFinite(normalizedAlumniProfile.graduationYear) &&
                (normalizedAlumniProfile.graduationYear < YEAR_MIN || normalizedAlumniProfile.graduationYear > YEAR_MAX)
            ) {
                return res
                    .status(400)
                    .json({ message: `Graduation year must be between ${YEAR_MIN} and ${YEAR_MAX}.` });
            }
            user.alumniProfile = normalizedAlumniProfile;
        }

        const updatedUser = await user.save();
        
        // Return the full updated user object (excluding password)
        const userResponse = updatedUser.toObject();
        delete userResponse.password;

        res.json(userResponse);
    } else {
        res.status(404);
        throw new Error('User not found');
    }
};

const resolveUserByIdentifier = async (identifier) => {
    if (mongoose.Types.ObjectId.isValid(identifier)) {
        return User.findById(identifier).select('-password');
    }
    if (identifier.includes('@')) {
        return User.findOne({ email: identifier }).select('-password');
    }
    return User.findOne({ collegeId: identifier }).select('-password');
};

const getMyInsights = async (req, res) => {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) {
        return res.status(404).json({ message: 'User not found' });
    }
    const insights = await buildUserInsights(user);
    res.json(insights);
};

const getMemberInsights = async (req, res) => {
    const user = await resolveUserByIdentifier(req.params.identifier);
    if (!user) {
        return res.status(404).json({ message: 'Member not found' });
    }
    const insights = await buildUserInsights(user);
    res.json(insights);
};

const getDirectoryMembers = async (_req, res) => {
    const users = await User.find({
        $or: [{ approvalStatus: 'Approved' }, { isVerified: true }],
    })
        .select('name email collegeId role branch year batch joinedAt')
        .sort({ name: 1 })
        .lean();

    const directory = users.map((u) => ({
        _id: u._id,
        name: u.name || '',
        email: u.email || '',
        collegeId: u.collegeId || '',
        role: u.role || 'User',
        branch: String(u.branch || '').toUpperCase(),
        year: u.year ?? null,
        batch: u.batch || '',
        joinedAt: u.joinedAt || null,
    }));

    res.json(directory);
};

const getPublicProfileByCollegeId = async (req, res) => {
    const collegeId = String(req.params.collegeId || '').trim();
    if (!collegeId) {
        return res.status(400).json({ message: 'College ID is required' });
    }

    const user = await User.findOne({ collegeId }).select(
        'name collegeId role branch year batch joinedAt bio achievements skills social alumniProfile createdAt'
    );

    if (!user) {
        return res.status(404).json({ message: 'Profile not found' });
    }

    const insights = await buildUserInsights(user);
    const member = insights.member || {};
    const metrics = insights.metrics || {};

    res.json({
        profile: {
            name: member.name || user.name,
            collegeId: member.collegeId || user.collegeId,
            role: member.role || user.role,
            branch: member.branch || user.branch || '',
            year: member.year || user.year || null,
            batch: member.batch || user.batch || '',
            joinedAt: member.joinedAt || user.joinedAt || user.createdAt,
            yearsInCICR: member.yearsInCICR || 0,
            bio: member.bio || '',
            achievements: member.achievements || [],
            skills: member.skills || [],
            social: member.social || {},
            alumniProfile: member.alumniProfile || user.alumniProfile || {},
        },
        metrics: {
            totalProjectContributions: metrics.totalProjectContributions || 0,
            totalEvents: metrics.totalEvents || 0,
            postsCreated: metrics.postsCreated || 0,
            alumniTenureYears: metrics.alumniTenureYears || 0,
        },
    });
};

const acknowledgeWarnings = async (req, res) => {
    const user = await User.findById(req.user.id);
    if (!user) {
        return res.status(404).json({ message: 'User not found' });
    }
    user.hasUnreadWarning = false;
    await user.save();
    res.json({ success: true });
};

module.exports = {
    getUserProfile,
    updateUserProfile,
    getMyInsights,
    getMemberInsights,
    getDirectoryMembers,
    getPublicProfileByCollegeId,
    acknowledgeWarnings,
};
