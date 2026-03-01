const TwilioVerifyService = require('../services/TwilioVerifyService');
const User = require('../../../models/User');
const jwt = require('jsonwebtoken');

class AuthController {
  /**
   * Sign up - Create new user account
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async signup(req, res) {
    try {
      const { name, email, password, role = 'elderly', phoneNumber } = req.body;

      // Validate required fields
      if (!name || !email || !password) {
        return res.status(400).json({
          success: false,
          message: 'Name, email, and password are required',
        });
      }

      // Validate role
      const validRoles = ['elderly', 'caregiver'];
      if (role && !validRoles.includes(role)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid role. Must be either "elderly" or "caregiver"',
        });
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid email format',
        });
      }

      // Validate password strength
      if (password.length < 6) {
        return res.status(400).json({
          success: false,
          message: 'Password must be at least 6 characters',
        });
      }

      // Validate phone if provided
      if (phoneNumber && !/^\+\d{1,15}$/.test(phoneNumber)) {
        return res.status(400).json({
          success: false,
          message: 'Phone number must be in E.164 format',
        });
      }

      // Check if user already exists
      let existingUser = await User.findOne({ $or: [{ email }] });
      if (existingUser) {
        return res.status(409).json({
          success: false,
          message: 'User with this email already exists',
        });
      }

      // If phone provided, check if it exists
      if (phoneNumber) {
        existingUser = await User.findOne({ phoneNumber });
        if (existingUser) {
          return res.status(409).json({
            success: false,
            message: 'Phone number already registered',
          });
        }
      }

      // Create new user
      const user = await User.create({
        name,
        email,
        password,
        role,
        phoneNumber: phoneNumber || null,
        isPhoneVerified: !!phoneNumber, // Only mark as verified if phone is provided
        avatar: {
          url: null,
          publicId: null,
        },
      });

      console.log('✅ New user created:', user._id, email);

      // Generate JWT token
      const jwtSecret = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
      const token = jwt.sign(
        {
          id: user._id.toString(),
          email: user.email,
          role: user.role,
        },
        jwtSecret,
        { expiresIn: '7d' }
      );

      return res.status(201).json({
        success: true,
        data: {
          token,
          user: {
            _id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
            phoneNumber: user.phoneNumber || null,
            isPhoneVerified: user.isPhoneVerified,
          },
        },
        message: 'Account created successfully',
      });
    } catch (error) {
      console.error('Error in signup:', error.message);
      return res.status(500).json({
        success: false,
        message: error.message || 'Failed to create account',
      });
    }
  }
  /**
   * Development/Debug - Get bypass token
   * @param {Object} req - Express request
   * @param {Object} res - Express response
   */
  static async getDebugToken(req, res) {
    try {
      const { role = 'elderly', userId = 'debug_user_123' } = req.query;

      // Generate JWT token
      const jwtSecret = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
      const token = jwt.sign(
        {
          id: userId,
          phoneNumber: '+919082087674',
          role: role,
        },
        jwtSecret,
        { expiresIn: '7d' }
      );

      console.log(`🔓 DEBUG: Token generated for role=${role}, userId=${userId}`);

      return res.status(200).json({
        success: true,
        data: {
          token,
          user: {
            _id: userId,
            phoneNumber: '+919082087674',
            name: `Debug User - ${role}`,
            role: role,
            email: `debug_${role}@mindbridge.local`,
          },
        },
        message: 'Debug token generated - for development only',
      });
    } catch (error) {
      console.error('Error in getDebugToken:', error.message);
      return res.status(500).json({
        success: false,
        message: error.message || 'Failed to generate debug token',
      });
    }
  }

  /**
   * Send OTP to the user's phone number
   * @param {Object} req - Express request object
   * @param {string} req.body.phoneNumber - Phone number in E.164 format
   * @param {Object} res - Express response object
   */
  static async sendOTP(req, res) {
    try {
      const { phoneNumber } = req.body;

      // Validate phone number
      if (!phoneNumber || typeof phoneNumber !== 'string') {
        return res.status(400).json({
          success: false,
          message: 'Missing or invalid phoneNumber in request body',
        });
      }

      // Validate E.164 format
      if (!/^\+\d{1,15}$/.test(phoneNumber)) {
        return res.status(400).json({
          success: false,
          message: 'Phone number must be in E.164 format (e.g., +1234567890)',
        });
      }

      // Send OTP via Twilio Verify
      const result = await TwilioVerifyService.sendOTP(phoneNumber);

      return res.status(200).json({
        success: true,
        data: result,
        message: `OTP sent to ${phoneNumber}`,
      });
    } catch (error) {
      console.error('Error in sendOTP:', error.message);
      return res.status(500).json({
        success: false,
        message: error.message || 'Failed to send OTP',
      });
    }
  }

  /**
   * Verify OTP and authenticate user
   * @param {Object} req - Express request object
   * @param {string} req.body.phoneNumber - Phone number
   * @param {string} req.body.code - 6-digit OTP code
   * @param {Object} res - Express response object
   */
  static async verifyOTP(req, res) {
    try {
      const { phoneNumber, code } = req.body;

      // Validate inputs
      if (!phoneNumber || !code) {
        return res.status(400).json({
          success: false,
          message: 'Missing phoneNumber or code in request body',
        });
      }

      if (!/^\d{6}$/.test(code)) {
        return res.status(400).json({
          success: false,
          message: 'Code must be a 6-digit number',
        });
      }

      // Verify OTP
      const verificationResult = await TwilioVerifyService.verifyOTP(phoneNumber, code);

      if (!verificationResult.success) {
        return res.status(401).json({
          success: false,
          message: verificationResult.message,
        });
      }

      // Create or update user in database
      let user = await User.findOne({ phoneNumber });

      if (!user) {
        // Create new user
        user = await User.create({
          phoneNumber,
          name: `User ${phoneNumber.slice(-4)}`, // Generate name from phone number
          role: 'elderly',
          email: `user_${phoneNumber.replace(/\D/g, '')}@mindbridge.local`,
          isPhoneVerified: true,
          lastLogin: new Date(),
        });
        console.log('✅ New user created:', user._id, phoneNumber);
      } else {
        // Update existing user
        user.lastLogin = new Date();
        user.isPhoneVerified = true;
        await user.save();
        console.log('✅ User logged in:', user._id, phoneNumber);
      }

      // Generate JWT token
      const jwtSecret = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
      const token = jwt.sign(
        {
          id: user._id.toString(),
          phoneNumber: user.phoneNumber,
          role: user.role,
        },
        jwtSecret,
        { expiresIn: '7d' }
      );

      // Return success with token and user info
      return res.status(200).json({
        success: true,
        data: {
          token,
          user: {
            _id: user._id,
            phoneNumber: user.phoneNumber,
            name: user.name,
            role: user.role,
            email: user.email,
          },
        },
        message: 'Authentication successful',
      });
    } catch (error) {
      console.error('Error in verifyOTP:', error.message);
      return res.status(500).json({
        success: false,
        message: error.message || 'Failed to verify OTP',
      });
    }
  }
}

module.exports = AuthController;
