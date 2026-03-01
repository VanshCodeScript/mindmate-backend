const mongoose = require('mongoose');

const reminderSchema = new mongoose.Schema(
    {
        userId: {
            type: String,
            required: true,
            index: true,
        },
        type: {
            type: String,
            enum: ['medication', 'appointment', 'exercise', 'meal', 'activity', 'health_check', 'custom'],
            required: true,
        },
        title: {
            type: String,
            required: true,
        },
        description: String,
        
        // Schedule
        scheduledTime: Date,
        recurrence: {
            type: String,
            enum: ['once', 'daily', 'weekly', 'monthly', 'custom'],
            default: 'once',
        },
        recurrencePattern: String, // for custom patterns
        
        // Related Data
        medicationId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Medication',
        },
        appointmentId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Appointment',
        },
        
        // Status
        isActive: {
            type: Boolean,
            default: true,
        },
        isCompleted: Boolean,
        completedAt: Date,
        
        // Notification
        notificationMethod: {
            type: [String],
            enum: ['push', 'sms', 'email', 'voice_call'],
            default: ['push'],
        },
        notificationSent: Boolean,
        notificationSentAt: Date,
        
        // Timeline
        startDate: Date,
        endDate: Date,
        
        priority: {
            type: String,
            enum: ['low', 'medium', 'high'],
            default: 'medium',
        },
        
        notes: String,
    },
    {
        timestamps: true,
        indexes: [{ userId: 1, scheduledTime: 1 }, { isActive: 1, isCompleted: 1 }],
    }
);

module.exports = mongoose.model('Reminder', reminderSchema);
