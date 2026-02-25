const express = require('express');
const router = express.Router();
const {
  createEvent,
  getEvents,
  getEventById,
  updateEvent,
  deleteEvent,
} = require('../controllers/eventController');
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');

router.get('/', getEvents);
router.get('/:id', getEventById);
router.post('/', protect, authorize('Admin', 'Head'), createEvent);
router.put('/:id', protect, authorize('Admin', 'Head'), updateEvent);
router.delete('/:id', protect, authorize('Admin', 'Head'), deleteEvent);

module.exports = router;
