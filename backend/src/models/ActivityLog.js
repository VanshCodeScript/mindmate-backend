const mongoose = require('mongoose');

const activityLogSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true,
        },
        
        activityType: {
            type: String,
            enum: ['game_played', 'chat_conversation', 'health_update', 'medication_taken', 'exercise', 'appointment', 'emergency_alert', 'document_view', 'profile_update', 'login'],
            required: true,
        },
        
        description: String,
        
        // Related Entities
        relatedEntity: {
            type: String,
            enum: ['game', 'conversation', 'health_record', 'medication', 'document', 'appointment', 'emergency'],
        },
        relatedEntityId: mongoose.Schema.Types.ObjectId,
        
        // Metrics
        duration: Number, // in seconds
        intensity: {
            type: String,
            enum: ['low', 'medium', 'high'],
        },
        caloriesBurned: Number,
        
        // Outcomes
        outcome: String,
        score: Number,
        notes: String,
        
        // Status
        isPrivate: {
            type: Boolean,
            default: true,
        },
        
        timestamp: {
            type: Date,
            default: Date.now,
            index: true,
        },
        
        metadata: mongoose.Schema.Types.Mixed,
    },
    {
        timestamps: true,
        indexes: [{ userId: 1, timestamp: -1 }, { activityType: 1 }, { timestamp: -1 }],
    }
);

module.exports = mongoose.model('ActivityLog', activityLogSchema);
