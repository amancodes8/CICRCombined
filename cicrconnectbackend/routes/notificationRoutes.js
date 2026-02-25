const express = require('express');
const {
  listNotifications,
  markNotificationRead,
  markAllRead,
  broadcastNotification,
} = require('../controllers/notificationController');
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');

const router = express.Router();

router.get('/', protect, listNotifications);
router.post('/read-all', protect, markAllRead);
router.post('/:id/read', protect, markNotificationRead);
router.post('/broadcast', protect, authorize('Admin', 'Head'), broadcastNotification);

module.exports = router;
