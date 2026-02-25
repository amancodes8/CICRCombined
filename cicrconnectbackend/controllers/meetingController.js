const Meeting = require('../models/Meeting');
const User = require('../models/User');
const { isAdminOrHead, validateHierarchyTeam, parseYear } = require('../utils/hierarchy');

/**
 * @desc    Schedule a new meeting
 * @route   POST /api/meetings
 * @access  Private
 */
exports.scheduleMeeting = async (req, res) => {
    try {
        const { title, meetingType, details, startTime, endTime, participants } = req.body;

        // 1. Double check required fields match your Schema
        if (!title || !meetingType || !details?.topic || !details?.location || !startTime || !endTime) {
            return res.status(400).json({ message: "Please provide all required fields." });
        }

        // 2. Enforce hierarchy rules for non-admin roles
        if (!isAdminOrHead(req.user)) {
            const actorYear = parseYear(req.user.year);
            if (!actorYear || actorYear < 2) {
                return res.status(403).json({ message: 'Only seniors (2nd year and above) can schedule meetings.' });
            }
        }

        const participantIds = Array.isArray(participants) ? [...new Set(participants.filter(Boolean))] : [];
        const participantUsers = participantIds.length
            ? await User.find({ _id: { $in: participantIds } }).select('year role')
            : [];

        if (participantIds.length && participantUsers.length !== participantIds.length) {
            return res.status(400).json({ message: 'Some participants could not be found.' });
        }

        if (!isAdminOrHead(req.user) && participantUsers.length) {
            const validation = validateHierarchyTeam(req.user, participantUsers);
            if (!validation.allowed) {
                return res.status(403).json({ message: validation.reason });
            }
        }

        // 3. Create meeting using 'organizedBy' (matching your Schema)
        const newMeeting = new Meeting({
            title,
            meetingType,
            details, // This contains topic, location, and optionally agenda
            startTime,
            endTime,
            participants: participantIds,
            organizedBy: req.user.id // Taken from the 'protect' middleware
        });

        // 3. Save to MongoDB
        const savedMeeting = await newMeeting.save();
        
        // 4. Populate for the response
        const populatedMeeting = await Meeting.findById(savedMeeting._id)
            .populate('organizedBy', 'name role')
            .populate('participants', 'name branch');

        res.status(201).json(populatedMeeting);
    } catch (err) {
        console.error("Meeting Save Error:", err.message);
        res.status(500).json({ message: "Server error: " + err.message });
    }
};

/**
 * @desc    Get all meetings for the user
 * @route   GET /api/meetings
 */
exports.getMeetings = async (req, res) => {
    try {
        const meetings = await Meeting.find({
            $or: [
                { organizedBy: req.user.id },
                { participants: req.user.id }
            ]
        })
        .populate('organizedBy', 'name')
        .sort({ startTime: 1 });

        res.status(200).json(meetings);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};
