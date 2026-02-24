const express = require('express');
const router = express.Router();
const { createProject, getAllProjects, getProjectById, addSuggestion } = require('../controllers/projectController');
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');

// Get all projects and create a new project
router.route('/')
    .get(protect, getAllProjects)
    .post(protect, authorize('Admin', 'Head'), createProject);

// Get a single project by ID
router.route('/:id')
    .get(protect, getProjectById);

// Add a suggestion to a project
router.route('/:id/suggestions')
    .post(protect, authorize('Admin', 'Head', 'Alumni'), addSuggestion);

module.exports = router;
