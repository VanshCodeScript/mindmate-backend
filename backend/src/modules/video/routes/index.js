const express = require('express');
const VideoController = require('../controllers/VideoController');

const router = express.Router();

/**
 * POST /token
 * Generate Twilio video call access token
 * Body: { identity: string, room: string }
 */
router.post('/token', VideoController.generateToken);

module.exports = router;
