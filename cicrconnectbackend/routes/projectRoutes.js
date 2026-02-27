const express = require('express');
const router = express.Router();
const {
  createProject,
  getAllProjects,
  getProjectById,
  updateProjectTeam,
  updateProjectProgress,
  updateProjectStatus,
  deleteProject,
  addProjectUpdate,
  addSuggestion,
} = require('../controllers/projectController');
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');

// Get all projects and create a new project
router.route('/')
  .get(protect, getAllProjects)
  .post(protect, authorize('Admin'), createProject);

// Get a single project by ID
router.route('/:id')
  .get(protect, getProjectById)
  .delete(protect, authorize('Admin'), deleteProject);

router.patch('/:id/team', protect, updateProjectTeam);
router.patch('/:id/progress', protect, updateProjectProgress);
router.patch('/:id/status', protect, authorize('Admin'), updateProjectStatus);
router.post('/:id/updates', protect, addProjectUpdate);

// Add a suggestion to a project
router.route('/:id/suggestions')
  .post(protect, addSuggestion);

module.exports = router;
