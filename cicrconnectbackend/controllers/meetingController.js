const Meeting = require('../models/Meeting');

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

        // 2. Create meeting using 'organizedBy' (matching your Schema)
        const newMeeting = new Meeting({
            title,
            meetingType,
            details, // This contains topic, location, and optionally agenda
            startTime,
            endTime,
            participants,
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