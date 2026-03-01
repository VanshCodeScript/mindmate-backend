const express = require('express');
const AdminController = require('../controllers/AdminController');

const router = express.Router();

/**
 * GET /users
 * Get all users (for testing/admin only)
 */
router.get('/users', AdminController.getAllUsers);

/**
 * GET /users/:userId
 * Get specific user by ID
 */
router.get('/users/:userId', AdminController.getUserById);

/**
 * GET /stats
 * Get database statistics
 */
router.get('/stats', AdminController.getStats);

module.exports = router;
