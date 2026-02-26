const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const {
  listTracks,
  getTrackById,
  createTrack,
  updateTrack,
  setTrackPublish,
  setTrackArchive,
  submitTask,
  listMySubmissions,
  listAllSubmissions,
  reviewSubmission,
  getOverview,
  getEngagementConfig,
  updateEngagementConfig,
} = require('../controllers/learningController');

const router = express.Router();

router.get('/overview', protect, getOverview);
router.get('/config', protect, getEngagementConfig);
router.put('/config', protect, updateEngagementConfig);

router.get('/tracks', protect, listTracks);
router.post('/tracks', protect, createTrack);
router.get('/tracks/:id', protect, getTrackById);
router.put('/tracks/:id', protect, updateTrack);
router.patch('/tracks/:id/publish', protect, setTrackPublish);
router.patch('/tracks/:id/archive', protect, setTrackArchive);
router.post('/tracks/:id/submissions', protect, submitTask);

router.get('/submissions/mine', protect, listMySubmissions);
router.get('/submissions', protect, listAllSubmissions);
router.patch('/submissions/:id/review', protect, reviewSubmission);

module.exports = router;
