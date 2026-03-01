'use strict'

const express         = require('express')
const AlertController = require('../controllers/AlertController')

const router = express.Router()

/**
 * POST /api/v1/alerts/sos
 * Legacy Twilio SOS phone call
 * Body: { elderlyName: string }
 */
router.post('/sos', AlertController.triggerSOS)

/**
 * POST /api/v1/alerts/detect
 * Analyse a message for emergency signals.
 * Body: { userId, message, context?, location?, userMeta? }
 */
router.post('/detect', AlertController.detectEmergency)

/**
 * POST /api/v1/alerts/confirm
 * Process user's YES/NO confirmation reply.
 * Body: { userId, reply, userMeta? }
 */
router.post('/confirm', AlertController.confirmEmergency)

/**
 * GET /api/v1/alerts
 * List all emergency alerts from MongoDB.
 * Query: limit, status, severity
 */
router.get('/', AlertController.getAlerts)

/**
 * PATCH /api/v1/alerts/:id/resolve
 * Mark an alert as resolved or false alarm.
 * Body: { notes?, falseAlarm? }
 */
router.patch('/:id/resolve', AlertController.resolveAlert)

/**
 * POST /api/v1/alerts/trigger
 * Manually trigger a Telegram alert (from dashboard / panic button).
 * Body: { userId?, severity?, message?, location?, userMeta? }
 */
router.post('/trigger', AlertController.manualTrigger)

/**
 * GET /api/v1/alerts/status/:userId
 * Get current confirmation state + cooldown for a user.
 */
router.get('/status/:userId', AlertController.getStatus)

module.exports = router
