const express = require('express');
const router = express.Router();
const { 
    generateInviteCode, 
    sendInviteEmail, // Ensure this matches the controller export
    getAllUsers, 
    deleteUser, 
    updateUserByAdmin 
} = require('../controllers/adminController');

const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');

// Security: Applied to all routes below
router.use(protect, authorize('Admin', 'Head'));

/* --- Invitation Routes --- */
router.post('/invite', generateInviteCode);

// This creates: POST http://localhost:4000/api/admin/send-invite
router.post('/send-invite', sendInviteEmail); 

/* --- User Management --- */
router.get('/users', getAllUsers);
router.route('/users/:id')
    .put(updateUserByAdmin)
    .delete(deleteUser);

module.exports = router;