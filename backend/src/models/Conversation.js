const mongoose = require('mongoose');

const conversationSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: false,
            default: () => new mongoose.Types.ObjectId('000000000000000000000001'),
            index: true,
        },
        title: String,
        summary: String,
        emotionalTrend: String,
        
        messages: [
            {
                sender: {
                    type: String,
                    enum: ['user', 'ai'],
                    required: true,
                },
                text: {
                    type: String,
                    required: true,
                },
                audioUrl: String,
                audioPublicId: String,
                mood: String,
                sentiment: {
                    type: String,
                    enum: ['positive', 'neutral', 'negative'],
                },
                confidence: Number,
                timestamp: {
                    type: Date,
                    default: Date.now,
                },
                metadata: {
                    duration: Number,
                    language: String,
                },
            },
        ],
        
        status: {
            type: String,
            enum: ['active', 'archived'],
            default: 'active',
            index: true,
        },
        
        // Analytics
        messageCount: Number,
        averageMoodScore: Number,
        primaryThemes: [String],
        
        // Conversation Quality
        aiModel: String,
        contextUsed: [String],
        
        startedAt: {
            type: Date,
            default: Date.now,
        },
        endedAt: Date,
        duration: Number, // in minutes
        
        reviewedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
        },
        notes: String,
    },
    {
        timestamps: true,
        indexes: [{ userId: 1, startedAt: -1 }, { status: 1 }],
    }
);

module.exports = mongoose.model('Conversation', conversationSchema);
