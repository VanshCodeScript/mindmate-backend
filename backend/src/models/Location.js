const mongoose = require('mongoose');

const locationSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: true,
      index: true,
    },
    latitude: {
      type: Number,
      required: true,
    },
    longitude: {
      type: Number,
      required: true,
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Keep only the latest N entries per user (auto-cleanup via TTL or manual)
locationSchema.index({ userId: 1, timestamp: -1 });

module.exports = mongoose.model('Location', locationSchema);
