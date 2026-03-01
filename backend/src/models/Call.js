const mongoose = require('mongoose');

const callSchema = new mongoose.Schema(
  {
    callerId: {
      type: String,
      required: true,
    },
    callerName: {
      type: String,
      required: true,
    },
    callerRole: {
      type: String,
      enum: ['elderly', 'caregiver'],
      required: true,
    },
    calleeId: {
      type: String,
      required: true,
    },
    calleeName: {
      type: String,
      default: 'Unknown',
    },
    calleeRole: {
      type: String,
      enum: ['elderly', 'caregiver'],
      required: true,
    },
    roomName: {
      type: String,
      required: true,
      unique: true,
    },
    status: {
      type: String,
      enum: ['ringing', 'accepted', 'rejected', 'ended', 'missed', 'cancelled'],
      default: 'ringing',
    },
    startedAt: Date,
    endedAt: Date,
    duration: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Auto-expire ringing calls after 60 seconds
callSchema.index({ createdAt: 1 }, { expireAfterSeconds: 3600 });

module.exports = mongoose.model('Call', callSchema);
