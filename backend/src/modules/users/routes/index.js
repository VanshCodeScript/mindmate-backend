'use strict'

const { Router } = require('express')
const ctrl = require('../controllers/UserController')
const optionalAuth = require('../../../middleware/optionalAuth')

const router = Router()

// Public — used by QR code scans and health passport page
router.get('/passport/:userId',      (req, res) => ctrl.getPublicPassport(req, res))
router.get('/passport/:userId/pdf',  (req, res) => ctrl.downloadPassportPDF(req, res))

// Authenticated — update own medical info
router.put('/medical-info', optionalAuth, (req, res) => ctrl.updateMedicalInfo(req, res))

module.exports = router
