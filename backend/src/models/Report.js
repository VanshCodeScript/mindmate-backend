const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true,
        },
        
        generatedFor: {
            type: String,
            enum: ['elderly', 'caregiver', 'admin'],
        },
        
        reportType: {
            type: String,
            enum: ['cognitive_assessment', 'health_summary', 'medication_adherence', 'activity_summary', 'emergency_report', 'caregiver_update', 'monthly_health', 'quarterly_cognitive'],
            required: true,
        },
        
        title: String,
        description: String,
        
        // Date Range
        startDate: {
            type: Date,
            required: true,
        },
        endDate: {
            type: Date,
            required: true,
        },
        
        // Content
        sections: [
            {
                sectionName: String,
                content: String,
                charts: [String],
                insights: [String],
            },
        ],
        
        // Metrics Summary
        summary: {
            averageCognitiveScore: Number,
            averageMoodScore: Number,
            medicationAdherenceRate: Number,
            activityLevel: String,
            emergencyCount: Number,
            hospitalizations: Number,
            appointmentsAttended: Number,
        },
        
        // Recommendations
        recommendations: [String],
        concerns: [String],
        positiveNotes: [String],
        
        // File
        pdfUrl: String,
        pdfPublicId: String,
        
        // Status
        status: {
            type: String,
            enum: ['draft', 'generated', 'reviewed', 'sent'],
            default: 'draft',
        },
        
        reviewedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
        },
        reviewedAt: Date,
        sentTo: [
            {
                userId: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: 'User',
                },
                sentAt: Date,
            },
        ],
        
        isArchived: Boolean,
        notes: String,
    },
    {
        timestamps: true,
        indexes: [{ userId: 1, startDate: -1 }, { reportType: 1 }, { status: 1 }],
    }
);

module.exports = mongoose.model('Report', reportSchema);
