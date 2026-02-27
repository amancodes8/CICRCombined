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
router.get('/:id', protect, authorize('Admin'), getEventById);
router.post('/', protect, authorize('Admin'), createEvent);
router.put('/:id', protect, authorize('Admin'), updateEvent);
router.delete('/:id', protect, authorize('Admin'), deleteEvent);

module.exports = router;
