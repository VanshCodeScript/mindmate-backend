const mongoose = require('mongoose');

const emergencyLogSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: false,
            default: '000000000000000000000001',
            index: true,
        },
        alertType: {
            type: String,
            enum: ['panic_button', 'fall_detected', 'inactivity', 'distress_phrase', 'unusual_vitals', 'medication_missed', 'other'],
            required: true,
        },
        severity: {
            type: String,
            enum: ['low', 'medium', 'high', 'critical'],
            default: 'high',
        },
        message: String,
        status: {
            type: String,
            enum: ['triggered', 'acknowledged', 'in_progress', 'resolved', 'false_alarm'],
            default: 'triggered',
            index: true,
        },
        priority: {
            type: Number,
            min: 1,
            max: 5,
            default: 5,
        },

        // Location Information
        location: {
            latitude: Number,
            longitude: Number,
            address: String,
            accuracy: Number,
        },

        // Action Timeline
        triggeredAt: {
            type: Date,
            default: Date.now,
        },
        acknowledgedAt: Date,
        resolvedAt: Date,
        resolvedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
        },

        // Contact Log
        contactsMade: [
            {
                contactId: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: 'User',
                },
                contactType: { type: String, enum: ['phone_call', 'sms', 'email', 'in_person'] },
                status: { type: String, enum: ['attempted', 'successful', 'failed'] },
                timestamp: Date,
                notes: String,
            },
        ],

        // Resolution Details
        resolutionNotes: String,
        isVerified: Boolean,
        isFalseAlarm: Boolean,
        actionTaken: String,

        // Automated Response
        emergencyServicesNotified: Boolean,
        ambulanceRequested: Boolean,

        // Media
        attachments: [
            {
                url: String,
                type: String,
                publicId: String,
            },
        ],
    },
    {
        timestamps: true,
        indexes: [{ userId: 1, triggeredAt: -1 }, { status: 1 }, { severity: 1 }],
    }
);

module.exports = mongoose.model('EmergencyLog', emergencyLogSchema);
