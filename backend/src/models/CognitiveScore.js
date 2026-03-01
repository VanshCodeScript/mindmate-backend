const mongoose = require('mongoose');

const cognitiveScoreSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true,
        },
        overallScore: {
            type: Number,
            required: true,
            min: 0,
            max: 100,
        },
        testDate: {
            type: Date,
            default: Date.now,
            required: true,
        },
        metrics: {
            memory: { type: Number, min: 0, max: 100 },
            attention: { type: Number, min: 0, max: 100 },
            language: { type: Number, min: 0, max: 100 },
            visuospatial: { type: Number, min: 0, max: 100 },
            executiveFunction: { type: Number, min: 0, max: 100 },
            processing: { type: Number, min: 0, max: 100 },
        },
        category: {
            type: String,
            enum: ['memory', 'attention', 'language', 'visuospatial', 'general'],
            required: true,
        },
        testType: {
            type: String,
            enum: ['mmse', 'moca', 'cactus', 'game_based', 'custom'],
            default: 'game_based',
        },
        trend: {
            type: String,
            enum: ['improving', 'stable', 'declining'],
        },
        assessmentNotes: String,
        flag: {
            type: Boolean,
            default: false,
        },
        flagReason: String,
        reviewedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
        },
    },
    {
        timestamps: true,
        indexes: [{ userId: 1, testDate: -1 }, { category: 1 }],
    }
);

module.exports = mongoose.model('CognitiveScore', cognitiveScoreSchema);
