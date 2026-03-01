const Location = require('../../../models/Location');

/**
 * Save or update the latest GPS coordinates for a user
 */
exports.updateLocation = async (req, res) => {
  try {
    const { userId, latitude, longitude } = req.body;

    // Allow authenticated requests (JWT) or dev-mode requests with userId in body
    const resolvedUserId = req.user?.id || userId;

    if (!resolvedUserId) {
      return res.status(400).json({ error: 'userId is required' });
    }
    if (latitude == null || longitude == null) {
      return res.status(400).json({ error: 'latitude and longitude are required' });
    }

    const location = await Location.findOneAndUpdate(
      { userId: String(resolvedUserId) },
      {
        userId: String(resolvedUserId),
        latitude,
        longitude,
        timestamp: new Date(),
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    return res.json({
      success: true,
      location: {
        userId: location.userId,
        latitude: location.latitude,
        longitude: location.longitude,
        timestamp: location.timestamp,
      },
    });
  } catch (error) {
    console.error('[Location] Update error:', error.message);
    return res.status(500).json({ error: 'Failed to update location' });
  }
};

/**
 * Get the latest GPS coordinates for a user
 */
exports.getLatestLocation = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    const location = await Location.findOne({ userId: String(userId) }).sort({
      timestamp: -1,
    });

    if (!location) {
      return res.status(404).json({ error: 'No location data found for this user' });
    }

    return res.json({
      userId: location.userId,
      latitude: location.latitude,
      longitude: location.longitude,
      timestamp: location.timestamp,
    });
  } catch (error) {
    console.error('[Location] Fetch error:', error.message);
    return res.status(500).json({ error: 'Failed to fetch location' });
  }
};

/**
 * Get location history for a user (last N entries)
 */
exports.getLocationHistory = async (req, res) => {
  try {
    const { userId } = req.params;
    const limit = parseInt(req.query.limit) || 50;

    const locations = await Location.find({ userId: String(userId) })
      .sort({ timestamp: -1 })
      .limit(limit);

    return res.json({ userId, locations });
  } catch (error) {
    console.error('[Location] History error:', error.message);
    return res.status(500).json({ error: 'Failed to fetch location history' });
  }
};
