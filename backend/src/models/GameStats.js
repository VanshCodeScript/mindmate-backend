const mongoose = require('mongoose');

const gameStatsSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true,
        },
        gameName: {
            type: String,
            enum: ['memory_match', 'pattern_recognition', 'word_recall', 'reaction_test', 'puzzle_solver', 'number_sequence'],
            required: true,
        },
        score: {
            type: Number,
            required: true,
        },
        accuracy: {
            type: Number,
            min: 0,
            max: 100,
        },
        level: {
            type: Number,
            default: 1,
        },
        difficulty: {
            type: String,
            enum: ['easy', 'medium', 'hard'],
            default: 'medium',
        },
        timePlayedSeconds: Number,
        reactionTime: Number,
        moves: Number,
        actualMoves: Number,
        isCompleted: Boolean,
        datePlayed: {
            type: Date,
            default: Date.now,
            index: true,
        },
        performance: {
            improved: Boolean,
            improvement: Number,
            personalBest: Boolean,
        },
        playerFeedback: String,
    },
    {
        timestamps: true,
        indexes: [{ userId: 1, datePlayed: -1 }, { gameName: 1 }],
    }
);

module.exports = mongoose.model('GameStats', gameStatsSchema);
