const twilio = require('twilio');

class VideoController {
  /**
   * Generate video call access token
   * @param {Object} req - Express request
   * @param {Object} res - Express response
   */
  static async generateToken(req, res) {
    try {
      const { identity, room } = req.body;

      // Validate inputs
      if (!identity || !room) {
        return res.status(400).json({
          success: false,
          message: 'identity and room are required',
        });
      }

      // Get Twilio credentials
      const accountSid = process.env.TWILIO_ACCOUNT_SID;
      const apiKey = process.env.TWILIO_API_KEY;
      const apiSecret = process.env.TWILIO_API_SECRET;

      // For Video SDK, we need Account SID, API Key, and API Secret
      if (!accountSid || !apiKey || !apiSecret) {
        console.error('Missing credentials:', {
          accountSid: !!accountSid,
          apiKey: !!apiKey,
          apiSecret: !!apiSecret,
        });
        return res.status(500).json({
          success: false,
          message: 'Twilio credentials not fully configured (need TWILIO_ACCOUNT_SID, TWILIO_API_KEY, TWILIO_API_SECRET)',
        });
      }

      try {
        // Generate access token using Twilio SDK v5
        // For Video, we MUST use API Key and Secret, not Account SID and Auth Token
        const AccessToken = twilio.jwt.AccessToken;
        const VideoGrant = AccessToken.VideoGrant;

        // Twilio SDK v5 requires identity in constructor options
        const token = new AccessToken(
          accountSid,
          apiKey,
          apiSecret,
          { identity, ttl: 3600 }
        );

        // Add video grant
        token.addGrant(new VideoGrant({ room: room }));

        const jwtToken = token.toJwt();

        console.log(`✅ Video token generated for ${identity} in room: ${room}`);

        return res.status(200).json({
          success: true,
          token: jwtToken,
          data: {
            identity,
            room,
            expiresIn: 3600,
          },
          message: 'Video token generated successfully',
        });
      } catch (tokenError) {
        console.error('Token generation error:', tokenError.message, tokenError.stack);
        throw tokenError;
      }
    } catch (error) {
      console.error('Error generating video token:', error.message, error.stack);
      return res.status(500).json({
        success: false,
        message: error.message || 'Failed to generate video token',
        error: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      });
    }
  }
}

module.exports = VideoController;
