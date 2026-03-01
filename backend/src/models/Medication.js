const mongoose = require('mongoose');

const medicationSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true,
        },
        name: {
            type: String,
            required: true,
        },
        dosage: String,
        unit: String,
        frequency: {
            type: String,
            enum: ['once_daily', 'twice_daily', 'three_times', 'four_times', 'as_needed', 'weekly', 'monthly'],
            required: true,
        },
        scheduleTimes: [String], // e.g., ["08:00", "20:00"]
        prescribedBy: {
            doctorName: String,
            hospitalName: String,
            licenseNumber: String,
        },
        purpose: String,
        sideEffects: [String],
        interactions: [String],
        
        // Timeline
        startDate: {
            type: Date,
            required: true,
        },
        endDate: Date,
        isActive: {
            type: Boolean,
            default: true,
        },
        
        // Adherence Tracking
        adherenceRate: Number, // 0-100%
        missedDoses: Number,
        totalDoses: Number,
        
        notes: String,
    },
    {
        timestamps: true,
        indexes: [{ userId: 1, isActive: 1 }, { startDate: 1 }],
    }
);

module.exports = mongoose.model('Medication', medicationSchema);
