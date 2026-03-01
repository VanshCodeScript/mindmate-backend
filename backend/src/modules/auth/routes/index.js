const express = require('express');
const AuthController = require('../controllers/AuthController');

const router = express.Router();

/**
 * GET /debug-token
 * Development/Debug - Get bypass token without OTP
 * Query: ?role=elderly&userId=debug_user (optional)
 */
router.get('/debug-token', AuthController.getDebugToken);

/**
 * POST /signup
 * Creates a new user account with email/password and optional phone
 * Body: { name, email, password, role, phoneNumber? }
 */
router.post('/signup', AuthController.signup);

/**
 * POST /send-otp
 * Sends an OTP code to the provided phone number
 * Body: { phoneNumber: string (E.164 format) }
 */
router.post('/send-otp', AuthController.sendOTP);

/**
 * POST /verify-otp
 * Verifies the OTP code and authenticates the user
 * Body: { phoneNumber: string, code: string (6 digits) }
 */
router.post('/verify-otp', AuthController.verifyOTP);

module.exports = router;
