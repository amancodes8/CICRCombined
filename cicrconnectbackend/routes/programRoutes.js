const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const {
  listProgramOverview,
  getProgramConfig,
  updateProgramConfig,
  listQuests,
  createQuest,
  updateQuest,
  submitQuest,
  listMyQuestSubmissions,
  listQuestSubmissions,
  reviewQuestSubmission,
  createMentorRequest,
  listMentorRequests,
  updateMentorRequest,
  listBadgeRules,
  createBadgeRule,
  updateBadgeRule,
  getBadgeOverview,
  createIdea,
  listIdeas,
  toggleIdeaJoin,
  updateIdea,
  convertIdeaToProject,
  createOfficeHourSlot,
  listOfficeHourSlots,
  updateOfficeHourSlot,
  bookOfficeHourSlot,
  listMyOfficeHourBookings,
  updateOfficeHourBooking,
  listContests,
  createContest,
  updateContest,
  startContestAttempt,
  submitContestAttempt,
  listMyContestAttempts,
} = require('../controllers/programController');

const router = express.Router();

router.get('/overview', protect, listProgramOverview);
router.get('/config', protect, getProgramConfig);
router.put('/config', protect, updateProgramConfig);

router.get('/quests', protect, listQuests);
router.post('/quests', protect, createQuest);
router.patch('/quests/:id', protect, updateQuest);
router.post('/quests/:id/submit', protect, submitQuest);
router.get('/quests/submissions/mine', protect, listMyQuestSubmissions);
router.get('/quests/submissions', protect, listQuestSubmissions);
router.patch('/quests/submissions/:id/review', protect, reviewQuestSubmission);

router.get('/mentor-requests', protect, listMentorRequests);
router.post('/mentor-requests', protect, createMentorRequest);
router.patch('/mentor-requests/:id', protect, updateMentorRequest);

router.get('/badges/rules', protect, listBadgeRules);
router.post('/badges/rules', protect, createBadgeRule);
router.patch('/badges/rules/:id', protect, updateBadgeRule);
router.get('/badges/overview', protect, getBadgeOverview);

router.get('/ideas', protect, listIdeas);
router.post('/ideas', protect, createIdea);
router.patch('/ideas/:id', protect, updateIdea);
router.post('/ideas/:id/join', protect, toggleIdeaJoin);
router.post('/ideas/:id/convert', protect, convertIdeaToProject);

router.get('/office-hours/slots', protect, listOfficeHourSlots);
router.post('/office-hours/slots', protect, createOfficeHourSlot);
router.patch('/office-hours/slots/:id', protect, updateOfficeHourSlot);
router.post('/office-hours/slots/:id/book', protect, bookOfficeHourSlot);
router.get('/office-hours/bookings/mine', protect, listMyOfficeHourBookings);
router.patch('/office-hours/bookings/:id', protect, updateOfficeHourBooking);

router.get('/contests', protect, listContests);
router.get('/contests/attempts/mine', protect, listMyContestAttempts);
router.post('/contests', protect, createContest);
router.patch('/contests/:id', protect, updateContest);
router.post('/contests/:id/attempt', protect, startContestAttempt);
router.post('/contests/:id/submit', protect, submitContestAttempt);

module.exports = router;
