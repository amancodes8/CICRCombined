const express = require('express');
const {
  listMessages,
  streamMessages,
  createMessage,
  listMentionCandidates,
  deleteMessage,
} = require('../controllers/communicationController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

router.get('/messages', listMessages);
router.get('/stream', streamMessages);
router.get('/mentions', protect, listMentionCandidates);
router.post('/messages', protect, createMessage);
router.delete('/messages/:id', protect, deleteMessage);
// Backward-compatible alias for environments where DELETE may be blocked/misrouted.
router.post('/messages/:id/delete', protect, deleteMessage);
router.post('/delete/:id', protect, deleteMessage);
router.delete('/:id', protect, deleteMessage);
router.post('/:id/remove', protect, deleteMessage);

module.exports = router;
