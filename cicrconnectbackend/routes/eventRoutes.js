const express = require('express');
const router = express.Router();
const {
  createEvent,
  getEvents,
  getEventById,
  addEventParticipants,
  updateEvent,
  deleteEvent,
} = require('../controllers/eventController');
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');

router.get('/', getEvents);
router.get('/:id', protect, getEventById);
router.post('/', protect, authorize('Admin'), createEvent);
router.post('/:id/participants', protect, authorize('Admin'), addEventParticipants);
router.put('/:id', protect, authorize('Admin'), updateEvent);
router.delete('/:id', protect, authorize('Admin'), deleteEvent);

module.exports = router;
