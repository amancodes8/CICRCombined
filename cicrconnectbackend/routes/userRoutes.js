const express = require('express');
const router = express.Router();
const {
  getUserProfile,
  updateUserProfile,
  getMyInsights,
  getMemberInsights,
  getPublicProfileByCollegeId,
  acknowledgeWarnings,
} = require('../controllers/userController');
const { protect, authorize } = require('../middleware/authMiddleware');

// The 'protect' middleware ensures only logged-in users can access these routes.

// This single route now handles two HTTP methods:
// GET will retrieve the user's profile using the getUserProfile controller function.
// PUT will update the user's profile using the updateUserProfile controller function.
router.route('/profile')
    .get(protect, getUserProfile)
    .put(protect, updateUserProfile);

router.get('/insights/me', protect, getMyInsights);
router.get('/insights/member/:identifier', protect, authorize('Admin', 'Head'), getMemberInsights);
router.get('/public/:collegeId', getPublicProfileByCollegeId);
router.post('/warnings/ack', protect, acknowledgeWarnings);

module.exports = router;
