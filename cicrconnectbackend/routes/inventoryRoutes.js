const express = require('express');
const router = express.Router();
const { 
    getInventory, 
    addComponent, 
    issueComponent,
    adjustComponentStock,
    adjustComponentStockById,
} = require('../controllers/inventoryController');
const { protect, authorize } = require('../middleware/authMiddleware');

// Get all robotics components
router.get('/', protect, getInventory);

// Admin only: Add new components (like Servo - 10)
router.post('/add', protect, authorize('Admin'), addComponent);

// Members: Borrow/Issue components for projects
router.post('/issue', protect, issueComponent);
router.post('/adjust', protect, authorize('Admin', 'Head'), adjustComponentStock);
router.post('/:id/adjust', protect, authorize('Admin', 'Head'), adjustComponentStockById);

module.exports = router;
