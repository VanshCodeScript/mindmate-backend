const User = require('../../../models/User');
const HealthRecord = require('../../../models/HealthRecord');
const CognitiveScore = require('../../../models/CognitiveScore');

class AdminController {
  /**
   * Get all users
   */
  static async getAllUsers(req, res) {
    try {
      const users = await User.find({})
        .select('-password')
        .sort({ createdAt: -1 });

      return res.status(200).json({
        success: true,
        count: users.length,
        data: users,
      });
    } catch (error) {
      console.error('Error fetching users:', error.message);
      return res.status(500).json({
        success: false,
        message: error.message || 'Failed to fetch users',
      });
    }
  }

  /**
   * Get specific user by ID
   */
  static async getUserById(req, res) {
    try {
      const { userId } = req.params;

      const user = await User.findById(userId).select('-password');

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found',
        });
      }

      // Get related data
      const healthRecords = await HealthRecord.find({ userId }).sort({ recordDate: -1 }).limit(10);
      const cognitiveScores = await CognitiveScore.find({ userId }).sort({ testDate: -1 }).limit(5);

      return res.status(200).json({
        success: true,
        data: {
          user,
          healthRecords,
          cognitiveScores,
        },
      });
    } catch (error) {
      console.error('Error fetching user:', error.message);
      return res.status(500).json({
        success: false,
        message: error.message || 'Failed to fetch user',
      });
    }
  }

  /**
   * Get database statistics
   */
  static async getStats(req, res) {
    try {
      const userCount = await User.countDocuments();
      const healthRecordCount = await HealthRecord.countDocuments();
      const cognitiveScoreCount = await CognitiveScore.countDocuments();

      // Get users by role
      const usersByRole = await User.aggregate([
        { $group: { _id: '$role', count: { $sum: 1 } } },
      ]);

      // Get recent users (last 7 days)
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const recentUsers = await User.countDocuments({
        createdAt: { $gte: sevenDaysAgo },
      });

      return res.status(200).json({
        success: true,
        data: {
          totalUsers: userCount,
          totalHealthRecords: healthRecordCount,
          totalCognitiveScores: cognitiveScoreCount,
          usersByRole,
          recentUsers,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      console.error('Error fetching stats:', error.message);
      return res.status(500).json({
        success: false,
        message: error.message || 'Failed to fetch stats',
      });
    }
  }
}

module.exports = AdminController;
