const mongoose = require('mongoose');
const bcryptjs = require('bcryptjs');

const userSchema = new mongoose.Schema(
    {
        // Basic Information
        name: {
            type: String,
            required: true,
            trim: true,
        },
        email: {
            type: String,
            required: true,
            unique: true,
            trim: true,
            lowercase: true,
            sparse: true,
        },
        phoneNumber: {
            type: String,
            unique: true,
            sparse: true,
            trim: true,
        },
        password: {
            type: String,
        },
        role: {
            type: String,
            enum: ['elderly', 'caregiver'],
            default: 'elderly',
        },

        // Profile Information
        age: {
            type: Number,
            min: 0,
            max: 150,
        },
        gender: {
            type: String,
            enum: ['male', 'female', 'other', 'prefer_not_to_say'],
        },
        avatar: {
            url: String,
            publicId: String, // Cloudinary public ID
        },
        dateOfBirth: Date,
        address: String,
        city: String,
        country: String,
        postalCode: String,

        // Medical Information (for elderly users)
        medicalHistory: [String],
        medications: [
            {
                name: String,
                dosage: String,
                frequency: String,
                prescribedBy: String,
                startDate: Date,
                endDate: Date,
                notes: String,
            },
        ],
        allergies: [String],
        bloodType: String,
        primaryPhysician: {
            name: String,
            phone: String,
            email: String,
        },

        // Emergency Contacts
        emergencyContacts: [
            {
                name: String,
                relationship: String,
                phone: String,
                email: String,
                isPrimary: Boolean,
            },
        ],

        // Caregiver-specific
        assignedElderly: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'User',
            },
        ],
        caregiverSince: Date,

        // Location Tracking (for elderly users)
        currentLocation: {
            latitude: { type: Number },
            longitude: { type: Number },
        },
        homeLocation: {
            latitude: { type: Number },
            longitude: { type: Number },
        },
        safeRadiusInMeters: {
            type: Number,
            default: 200,
        },
        alertActive: {
            type: Boolean,
            default: false,
        },

        // Account Settings
        isPhoneVerified: {
            type: Boolean,
            default: false,
        },
        isEmailVerified: {
            type: Boolean,
            default: false,
        },
        isActive: {
            type: Boolean,
            default: true,
        },
        lastLogin: Date,
        preferredLanguage: {
            type: String,
            default: 'en',
        },
        notificationPreferences: {
            emailNotifications: { type: Boolean, default: true },
            smsNotifications: { type: Boolean, default: true },
            panicAlerts: { type: Boolean, default: true },
        },
    },
    {
        timestamps: true,
        indexes: [{ phoneNumber: 1 }, { email: 1 }, { role: 1 }],
    }
);

// Hash password before saving
userSchema.pre('save', async function (next) {
    if (this.isModified('password') && this.password) {
        this.password = await bcryptjs.hash(this.password, 10);
    }
    next();
});

// Compare password method
userSchema.methods.comparePassword = async function (password) {
    return bcryptjs.compare(password, this.password);
};

module.exports = mongoose.model('User', userSchema);
