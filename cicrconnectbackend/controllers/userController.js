const User = require('../models/User');
const mongoose = require('mongoose');
const { buildUserInsights } = require('../utils/userInsights');

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
        };

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
    acknowledgeWarnings,
};
