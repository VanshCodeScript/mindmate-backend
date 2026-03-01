import Prescription from "../../../models/Prescription.js";

export const createPrescription = async (req, res) => {
    try {
        const { patientId, diagnosis, severity, medicines, advice } = req.body;

        // In a real app, doctor ID comes from auth middleware (req.user.id)
        // For now, using a placeholder if not provided
        const doctorId = req.user?.id || req.body.doctorId || '651234567890abcdef123456';

        const prescription = new Prescription({
            doctor: doctorId,
            patient: patientId,
            diagnosis,
            severity,
            medicines,
            advice
        });

        await prescription.save();

        res.status(201).json({
            success: true,
            data: prescription
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
};

export const getPatientPrescriptions = async (req, res) => {
    try {
        const prescriptions = await Prescription.find({ patient: req.params.patientId })
            .populate('doctor', 'name')
            .sort({ createdAt: -1 });

        res.json({ success: true, data: prescriptions });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
};

export const updatePrescription = async (req, res) => {
    try {
        const prescription = await Prescription.findById(req.params.id);

        if (!prescription) return res.status(404).json({ message: "Prescription not found" });

        // Check ownership if auth exists
        if (req.user && prescription.doctor.toString() !== req.user.id) {
            return res.status(403).json({ message: "Unauthorized" });
        }

        Object.assign(prescription, req.body);
        await prescription.save();

        const populated = await Prescription.findById(prescription._id)
            .populate("patient", "name age gender phone")
            .populate("doctor", "name");

        res.json({ success: true, data: populated });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
};
