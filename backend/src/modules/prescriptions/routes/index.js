import express from 'express';
import { createPrescription, getPatientPrescriptions, updatePrescription } from '../controllers/prescription.controller.js';

const router = express.Router();

// Note: Add auth middleware here when authentication is fully integrated
router.post('/', createPrescription);
router.get('/patient/:patientId', getPatientPrescriptions);
router.patch('/:id', updatePrescription);

export default router;
