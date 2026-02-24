const express = require('express');
const router = express.Router();
const { scheduleMeeting, getMeetings } = require('../controllers/meetingController');
const { protect } = require('../middleware/authMiddleware');

// Standard REST path: POST /api/meetings
router.post('/', protect, scheduleMeeting);
router.get('/', protect, getMeetings);

module.exports = router;