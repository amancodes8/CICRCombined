const express = require('express');
const {
  listMessages,
  streamMessages,
  createMessage,
  listMentionCandidates,
  deleteMessage,
  updateMessage,
  toggleReaction,
  setPinned,
  reportTyping,
} = require('../controllers/communicationController');
const { protect, authorize } = require('../middleware/authMiddleware');
const { communicationLimiter, buildRateLimiter } = require('../middleware/securityMiddleware');

const router = express.Router();

const attachQueryTokenAsBearer = (req, _res, next) => {
  if (!req.headers.authorization && req.query.token) {
    req.headers.authorization = `Bearer ${req.query.token}`;
  }
  next();
};

const streamLimiter = buildRateLimiter({
  name: 'communication-stream',
  windowMs: 60 * 1000,
  max: 20,
  keyGenerator: (req) => req.user?._id || req.ip || 'unknown',
});

router.get('/messages', protect, authorize('Admin', 'Head'), communicationLimiter, listMessages);
router.get('/stream', attachQueryTokenAsBearer, protect, authorize('Admin', 'Head'), streamLimiter, streamMessages);
router.get('/mentions', protect, authorize('Admin', 'Head'), communicationLimiter, listMentionCandidates);
router.post('/typing', protect, authorize('Admin', 'Head'), communicationLimiter, reportTyping);
router.post('/messages', protect, authorize('Admin', 'Head'), communicationLimiter, createMessage);
router.patch('/messages/:id', protect, authorize('Admin', 'Head'), communicationLimiter, updateMessage);
router.post('/messages/:id/reactions', protect, authorize('Admin', 'Head'), communicationLimiter, toggleReaction);
router.post('/messages/:id/pin', protect, authorize('Admin', 'Head'), communicationLimiter, setPinned);
router.delete('/messages/:id', protect, authorize('Admin', 'Head'), communicationLimiter, deleteMessage);
// Backward-compatible alias for environments where DELETE may be blocked/misrouted.
router.post('/messages/:id/delete', protect, authorize('Admin', 'Head'), communicationLimiter, deleteMessage);
router.post('/delete/:id', protect, authorize('Admin', 'Head'), communicationLimiter, deleteMessage);
router.delete('/:id', protect, authorize('Admin', 'Head'), communicationLimiter, deleteMessage);
router.post('/:id/remove', protect, authorize('Admin', 'Head'), communicationLimiter, deleteMessage);

module.exports = router;
