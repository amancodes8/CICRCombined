const express = require('express');
const { body } = require('express-validator');
const validateRequest = require('../middleware/validateRequest');
const {
  registerUser,
  loginUser,
  getMe,
  verifyEmail,
  sendPasswordResetOtp,
  resetPasswordWithOtp,
  updateProfile
} = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');
const { authLimiter, passwordLimiter } = require('../middleware/securityMiddleware');

const router = express.Router();

router.post(
  '/register',
  authLimiter,
  [
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('email').isEmail().withMessage('Valid email is required'),
    body('collegeId').trim().notEmpty().withMessage('College ID is required'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    body('inviteCode').trim().notEmpty().withMessage('Invite code is required'),
  ],
  validateRequest,
  registerUser
);

router.post(
  '/login',
  authLimiter,
  [
    body('email').isEmail().withMessage('Valid email is required'),
    body('password').notEmpty().withMessage('Password is required'),
  ],
  validateRequest,
  loginUser
);

router.get('/verifyemail/:token', verifyEmail);
router.post(
  '/password/send-otp',
  passwordLimiter,
  [
    body('email').isEmail().withMessage('Valid email is required'),
    body('collegeId').trim().notEmpty().withMessage('College ID is required'),
  ],
  validateRequest,
  sendPasswordResetOtp
);
router.post(
  '/password/reset-with-otp',
  passwordLimiter,
  [
    body('email').isEmail().withMessage('Valid email is required'),
    body('collegeId').trim().notEmpty().withMessage('College ID is required'),
    body('otp').trim().isLength({ min: 6, max: 6 }).withMessage('OTP must be 6 digits'),
    body('newPassword').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  ],
  validateRequest,
  resetPasswordWithOtp
);
router.get('/me', protect, getMe);
router.put('/profile', protect, updateProfile);

module.exports = router;
