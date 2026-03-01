import twilio from 'twilio';
import dotenv from 'dotenv';

dotenv.config();

const AccessToken = twilio.jwt.AccessToken;
const { VideoGrant } = AccessToken;

const videoToken = (identity, room) => {
    const apiKey = process.env.TWILIO_API_KEY?.trim();
    const apiSecret = process.env.TWILIO_API_SECRET?.trim();
    const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim();

    if (!apiKey || !apiSecret || !accountSid) {
        console.error('❌ Missing Twilio credentials in environment');
        return null;
    }

    console.log(`🎟️ Generating token - Identity: ${identity}, Room: ${room}`);

    // Create access token
    const token = new AccessToken(
        accountSid,
        apiKey,
        apiSecret,
        {
            identity: identity,
            ttl: 3600 // 1 hour
        }
    );

    // Create and add video grant
    const videoGrant = new VideoGrant({ room: room });
    token.addGrant(videoGrant);

    return token.toJwt();
};

export const getVideoToken = async (req, res) => {
    try {
        const { identity, room } = req.body;

        if (!identity || !room) {
            return res.status(400).json({
                success: false,
                message: 'Identity and room are required'
            });
        }

        const token = videoToken(identity, room);

        if (!token) {
            return res.status(500).json({
                success: false,
                message: 'Failed to generate token: Missing credentials'
            });
        }

        res.status(200).json({
            success: true,
            token: token
        });
    } catch (error) {
        console.error('Error generating video token:', error);
        res.status(500).json({
            success: false,
            message: 'Error generating video token'
        });
    }
};

export const validateRoom = async (req, res) => {
    try {
        const { room } = req.params;
        // Simple validation: check if room exists or follows pattern
        if (room && room.startsWith('consultation-')) {
            return res.status(200).json({
                success: true,
                valid: true
            });
        }

        res.status(200).json({
            success: true,
            valid: false
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error validating room'
        });
    }
};
