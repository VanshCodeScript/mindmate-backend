const mongoose = require('mongoose');

const documentSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true,
        },
        
        title: {
            type: String,
            required: true,
        },
        description: String,
        type: {
            type: String,
            enum: ['prescription', 'lab_report', 'discharge', 'medical_certificate', 'x_ray', 'scan', 'test_result', 'insurance', 'other'],
            required: true,
        },
        
        // File Information
        fileUrl: {
            type: String,
            required: true,
        },
        publicId: String, // Cloudinary public ID
        fileName: String,
        fileSize: Number,
        fileType: String,
        
        // Metadata
        issuedDate: Date,
        expiryDate: Date,
        issuedBy: String,
        issuingInstitution: String,
        
        // Access Control
        isPublic: {
            type: Boolean,
            default: false,
        },
        sharedWith: [
            {
                userId: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: 'User',
                },
                accessLevel: {
                    type: String,
                    enum: ['view', 'edit', 'comment'],
                    default: 'view',
                },
            },
        ],
        
        // Status
        isVerified: Boolean,
        verifiedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
        },
        verifiedAt: Date,
        
        // Organization
        category: String,
        tags: [String],
        notes: String,
    },
    {
        timestamps: true,
        indexes: [{ userId: 1, type: 1 }, { uploadDate: -1 }],
    }
);

module.exports = mongoose.model('Document', documentSchema);
