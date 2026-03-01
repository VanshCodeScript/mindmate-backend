import mongoose from "mongoose";

const prescriptionSchema = new mongoose.Schema({
    appointment: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Appointment",
        required: false
    },
    doctor: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    patient: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    diagnosis: {
        type: String,
        required: true
    },
    severity: {
        type: String,
        enum: ["mild", "moderate", "severe"],
        default: "mild"
    },
    medicines: [
        {
            name: { type: String, required: true },
            dosage: { type: String, required: true },
            frequency: { type: String },
            duration: { type: String, required: true },
            notes: { type: String }
        }
    ],
    advice: String,
    testsRecommended: [
        {
            name: String,
            reason: String
        }
    ],
    followUpDate: Date,
    status: {
        type: String,
        enum: ["active", "completed"],
        default: "active"
    },
    pdfUrl: {
        type: String
    }
}, { timestamps: true });

export default mongoose.model("Prescription", prescriptionSchema);
