const express = require('express');
const {
  createTask,
  listTasks,
  updateTask,
  deleteTask,
} = require('../controllers/hierarchyController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

router.get('/tasks', protect, listTasks);
router.post('/tasks', protect, createTask);
router.patch('/tasks/:id', protect, updateTask);
router.delete('/tasks/:id', protect, deleteTask);

module.exports = router;
