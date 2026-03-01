const mongoose = require('mongoose');

const healthRecordSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true,
        },
        recordDate: {
            type: Date,
            default: Date.now,
            required: true,
        },

        // Vital Signs
        vitals: {
            bloodPressure: {
                systolic: { type: Number, min: 60, max: 300 },
                diastolic: { type: Number, min: 30, max: 150 },
                timestamp: Date,
            },
            heartRate: {
                value: { type: Number, min: 30, max: 200 },
                unit: { type: String, default: 'bpm' },
                timestamp: Date,
            },
            temperature: {
                value: { type: Number, min: 35, max: 43 },
                unit: { type: String, default: 'C' },
                timestamp: Date,
            },
            glucose: {
                value: { type: Number, min: 40, max: 500 },
                unit: { type: String, default: 'mg/dL' },
                timestamp: Date,
            },
            spO2: {
                value: { type: Number, min: 70, max: 100 },
                unit: { type: String, default: '%' },
                timestamp: Date,
            },
        },

        // Activity & Sleep
        activity: {
            level: {
                type: String,
                enum: ['sedentary', 'light', 'moderate', 'vigorous'],
            },
            stepsToday: Number,
            caloriesBurned: Number,
            exerciseDuration: Number, // in minutes
        },
        sleep: {
            hoursSlept: Number,
            quality: {
                type: String,
                enum: ['poor', 'fair', 'good', 'excellent'],
            },
            notes: String,
        },

        // Mood & Mental Health
        mood: {
            score: { type: Number, min: 1, max: 10 },
            label: {
                type: String,
                enum: ['very_sad', 'sad', 'neutral', 'happy', 'very_happy'],
            },
            lonelinessIndex: { type: Number, min: 0, max: 100 },
        },

        // Nutrition
        nutrition: {
            mealsLogged: [
                {
                    mealType: String, // breakfast, lunch, dinner, snack
                    description: String,
                    calories: Number,
                    timestamp: Date,
                },
            ],
            waterIntake: Number, // in glasses
            notes: String,
        },

        // Medications Taken
        medicationsTaken: [
            {
                medicationId: String,
                name: String,
                dosage: String,
                time: Date,
                confirmed: Boolean,
            },
        ],

        // Symptoms
        symptoms: [
            {
                symptom: String,
                severity: { type: String, enum: ['mild', 'moderate', 'severe'] },
                duration: String,
            },
        ],

        // Medical Notes
        notes: String,
        recordedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
        },
        reviewedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
        },
        attachments: [
            {
                url: String,
                type: String,
                name: String,
                publicId: String,
            },
        ],
    },
    {
        timestamps: true,
        indexes: [{ userId: 1, recordDate: -1 }, { 'mood.lonelinessIndex': 1 }],
    }
);

module.exports = mongoose.model('HealthRecord', healthRecordSchema);
