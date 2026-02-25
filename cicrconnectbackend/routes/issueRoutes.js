const express = require('express');
const router = express.Router();
const {
  createIssue,
  getMyIssues,
  getAdminIssues,
  updateIssue,
} = require('../controllers/issueController');
const { protect, authorize } = require('../middleware/authMiddleware');

router.post('/', protect, createIssue);
router.get('/mine', protect, getMyIssues);
router.get('/', protect, authorize('Admin'), getAdminIssues);
router.patch('/:id', protect, authorize('Admin'), updateIssue);

module.exports = router;
