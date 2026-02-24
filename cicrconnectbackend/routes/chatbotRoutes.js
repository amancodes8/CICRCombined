const express = require('express');
const router = express.Router();
const { summarizePage, askCicrAssistant } = require('../controllers/chatbotController');
const { protect } = require('../middleware/authMiddleware');

router.post('/summarize', protect, summarizePage);
router.post('/query', protect, askCicrAssistant);
router.post('/ask', protect, askCicrAssistant);
router.post('/assistant/query', protect, askCicrAssistant);

module.exports = router;
