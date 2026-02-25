const express = require('express');
const { body } = require('express-validator');
const validateRequest = require('../middleware/validateRequest');
const {
  createApplication,
  getApplications,
  updateApplication,
  sendApplicationInvite,
} = require('../controllers/applicationController');
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');
const { applicationLimiter } = require('../middleware/securityMiddleware');

const router = express.Router();

router.post(
  '/',
  applicationLimiter,
  [
    body('fullName').trim().notEmpty().withMessage('Full name is required'),
    body('email').isEmail().withMessage('Valid email is required'),
    body('phone').trim().notEmpty().withMessage('Phone number is required'),
    body('motivation').trim().isLength({ min: 20 }).withMessage('Motivation should be at least 20 characters'),
  ],
  validateRequest,
  createApplication
);

router.get('/', protect, authorize('Admin', 'Head'), getApplications);
router.patch('/:id', protect, authorize('Admin', 'Head'), updateApplication);
router.post('/:id/send-invite', protect, authorize('Admin', 'Head'), sendApplicationInvite);

module.exports = router;
