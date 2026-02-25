const express = require('express');
const {
  listMessages,
  streamMessages,
  createMessage,
  listMentionCandidates,
  deleteMessage,
} = require('../controllers/communicationController');
const { protect, authorize } = require('../middleware/authMiddleware');

const router = express.Router();

const attachQueryTokenAsBearer = (req, _res, next) => {
  if (!req.headers.authorization && req.query.token) {
    req.headers.authorization = `Bearer ${req.query.token}`;
  }
  next();
};

router.get('/messages', protect, authorize('Admin'), listMessages);
router.get('/stream', attachQueryTokenAsBearer, protect, authorize('Admin'), streamMessages);
router.get('/mentions', protect, authorize('Admin'), listMentionCandidates);
router.post('/messages', protect, authorize('Admin'), createMessage);
router.delete('/messages/:id', protect, authorize('Admin'), deleteMessage);
// Backward-compatible alias for environments where DELETE may be blocked/misrouted.
router.post('/messages/:id/delete', protect, authorize('Admin'), deleteMessage);
router.post('/delete/:id', protect, authorize('Admin'), deleteMessage);
router.delete('/:id', protect, authorize('Admin'), deleteMessage);
router.post('/:id/remove', protect, authorize('Admin'), deleteMessage);

module.exports = router;
