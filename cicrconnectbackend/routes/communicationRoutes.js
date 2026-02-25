const express = require('express');
const {
  listMessages,
  streamMessages,
  createMessage,
  listMentionCandidates,
  deleteMessage,
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

router.get('/messages', protect, authorize('Admin'), communicationLimiter, listMessages);
router.get('/stream', attachQueryTokenAsBearer, protect, authorize('Admin'), streamLimiter, streamMessages);
router.get('/mentions', protect, authorize('Admin'), communicationLimiter, listMentionCandidates);
router.post('/messages', protect, authorize('Admin'), communicationLimiter, createMessage);
router.delete('/messages/:id', protect, authorize('Admin'), communicationLimiter, deleteMessage);
// Backward-compatible alias for environments where DELETE may be blocked/misrouted.
router.post('/messages/:id/delete', protect, authorize('Admin'), communicationLimiter, deleteMessage);
router.post('/delete/:id', protect, authorize('Admin'), communicationLimiter, deleteMessage);
router.delete('/:id', protect, authorize('Admin'), communicationLimiter, deleteMessage);
router.post('/:id/remove', protect, authorize('Admin'), communicationLimiter, deleteMessage);

module.exports = router;
