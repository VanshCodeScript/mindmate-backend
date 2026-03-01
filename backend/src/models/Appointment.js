const mongoose = require('mongoose');

const appointmentSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true,
        },
        doctorId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
        },
        
        title: {
            type: String,
            required: true,
        },
        type: {
            type: String,
            enum: ['general_checkup', 'specialist', 'lab_test', 'therapy', 'surgery', 'follow_up', 'other'],
            required: true,
        },
        
        // Details
        description: String,
        concerns: [String],
        
        // Location
        location: {
            hospitalName: String,
            address: String,
            city: String,
            phone: String,
        },
        
        // Schedule
        scheduledDateTime: {
            type: Date,
            required: true,
            index: true,
        },
        estimatedDuration: Number, // in minutes
        actualDuration: Number,
        
        // Status
        status: {
            type: String,
            enum: ['scheduled', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show'],
            default: 'scheduled',
            index: true,
        },
        
        // Outcomes
        notes: String,
        prescription: String,
        testResults: [
            {
                testName: String,
                result: String,
                url: String,
                publicId: String,
            },
        ],
        followUpRequired: Boolean,
        followUpDate: Date,
        
        // Reminders
        reminderSent: Boolean,
        reminderSentAt: Date,
        
        // Documents
        attachments: [
            {
                url: String,
                name: String,
                type: String,
                publicId: String,
            },
        ],
        
        cancellationReason: String,
        cancelledAt: Date,
    },
    {
        timestamps: true,
        indexes: [{ userId: 1, scheduledDateTime: 1 }, { status: 1 }, { doctorId: 1 }],
    }
);

module.exports = mongoose.model('Appointment', appointmentSchema);
