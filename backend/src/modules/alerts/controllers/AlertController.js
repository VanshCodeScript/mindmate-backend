'use strict'

const TwilioSOSService         = require('../services/TwilioSOSService')
const EmergencyDetectionService = require('../services/EmergencyDetectionService')
const ConfirmationStateMachine  = require('../services/ConfirmationStateMachine')
const TelegramService           = require('../services/TelegramService')
const EmergencyLog              = require('../../../models/EmergencyLog')

class AlertController {
  // ── Existing SOS (Twilio phone call) ─────────────────────────────────────

  /**
   * POST /api/v1/alerts/sos
   * Triggers an automated SOS phone call via Twilio.
   * Body: { elderlyName: string }
   */
  static async triggerSOS(req, res) {
    try {
      const { elderlyName } = req.body

      if (!elderlyName || typeof elderlyName !== 'string') {
        return res.status(400).json({
          success: false,
          message: 'Missing or invalid elderlyName in request body',
        })
      }

      const result = await TwilioSOSService.triggerEmergencyCall(elderlyName)

      return res.status(200).json({
        success: true,
        data: result,
        message: `Emergency call triggered for ${elderlyName}`,
      })
    } catch (error) {
      console.error('Error in triggerSOS:', error.message)
      return res.status(500).json({
        success: false,
        message: error.message || 'Failed to trigger emergency call',
      })
    }
  }

  // ── AI-based Emergency Detection ─────────────────────────────────────────

  /**
   * POST /api/v1/alerts/detect
   * Analyses a chat message for emergency signals.
   *
   * Body: {
   *   userId:   string,          // user or session ID
   *   message:  string,          // the message to analyse
   *   context?: string[],        // last N messages (optional)
   *   location?: { lat, lng },   // optional GPS
   *   userMeta?: { name }        // optional display name
   * }
   */
  static async detectEmergency(req, res) {
    try {
      const { userId, message, context = [], location = null, userMeta = {} } = req.body

      if (!message || typeof message !== 'string') {
        return res.status(400).json({ success: false, error: 'message is required' })
      }

      const result = await EmergencyDetectionService.detectAndProcess(
        userId, message, context, location, userMeta
      )

      return res.json({ success: true, ...result })
    } catch (error) {
      console.error('[AlertController.detectEmergency]', error)
      return res.status(500).json({ success: false, error: error.message })
    }
  }

  /**
   * POST /api/v1/alerts/confirm
   * Processes the user's YES / NO reply to a pending confirmation prompt.
   *
   * Body: { userId: string, reply: string, userMeta?: { name } }
   */
  static async confirmEmergency(req, res) {
    try {
      const { userId, reply, userMeta = {} } = req.body

      if (!reply || typeof reply !== 'string') {
        return res.status(400).json({ success: false, error: 'reply is required' })
      }

      const result = await EmergencyDetectionService.processConfirmationReply(
        userId, reply, userMeta
      )

      return res.json({ success: true, ...result })
    } catch (error) {
      console.error('[AlertController.confirmEmergency]', error)
      return res.status(500).json({ success: false, error: error.message })
    }
  }

  /**
   * POST /api/v1/alerts/trigger
   * Manually trigger a Telegram alert from the dashboard / panic button.
   *
   * Body: {
   *   userId:    string,
   *   severity:  'LEVEL_2' | 'LEVEL_3',
   *   message?:  string,
   *   location?: { lat, lng },
   *   userMeta?: { name }
   * }
   */
  static async manualTrigger(req, res) {
    try {
      const {
        userId = 'manual',
        severity = 'LEVEL_3',
        message  = 'Manual emergency triggered from dashboard',
        location = null,
        userMeta = {},
      } = req.body

      const tResult = await TelegramService.sendEmergencyAlert(
        { ...userMeta, id: userId },
        severity,
        message,
        location,
        ['manual-trigger']
      )

      ConfirmationStateMachine.markDirectEscalation(userId, severity, message)

      // Persist to MongoDB
      EmergencyLog.create({
        alertType: 'panic_button',
        severity:  severity === 'LEVEL_3' ? 'critical' : 'high',
        message,
        status: 'triggered',
        emergencyServicesNotified: tResult.ok,
        triggeredAt: new Date(),
      }).catch(err => console.error('[AlertController] Failed to save EmergencyLog:', err.message))

      return res.json({
        success: true,
        telegramSent: tResult.ok,
        message: tResult.ok
          ? 'Caregiver has been notified via Telegram.'
          : 'Alert logged but Telegram notification failed.',
      })
    } catch (error) {
      console.error('[AlertController.manualTrigger]', error)
      return res.status(500).json({ success: false, error: error.message })
    }
  }

  /**
   * GET /api/v1/alerts
   * List all emergency alerts from MongoDB, newest first.
   * Query params: limit (default 50), status, severity
   */
  static async getAlerts(req, res) {
    try {
      const limit    = Math.min(parseInt(req.query.limit) || 50, 200)
      const filter   = {}
      if (req.query.status)   filter.status   = req.query.status
      if (req.query.severity) filter.severity = req.query.severity

      const alerts = await EmergencyLog.find(filter)
        .sort({ triggeredAt: -1 })
        .limit(limit)
        .lean()

      return res.json({
        success: true,
        total: alerts.length,
        alerts: alerts.map(a => ({
          id:           a._id,
          alertType:    a.alertType,
          severity:     a.severity,
          message:      a.message || '',
          keywords:     a.actionTaken || '',
          status:       a.status,
          resolved:     ['resolved', 'false_alarm', 'acknowledged'].includes(a.status),
          triggeredAt:  a.triggeredAt,
          resolvedAt:   a.resolvedAt,
          emergencyServicesNotified: !!a.emergencyServicesNotified,
          ambulanceRequested:        !!a.ambulanceRequested,
          location:     a.location || null,
        })),
      })
    } catch (error) {
      console.error('[AlertController.getAlerts]', error)
      return res.status(500).json({ success: false, error: error.message })
    }
  }

  /**
   * PATCH /api/v1/alerts/:id/resolve
   * Mark an alert as resolved.
   * Body: { notes?: string, falseAlarm?: boolean }
   */
  static async resolveAlert(req, res) {
    try {
      const { id } = req.params
      const { notes = '', falseAlarm = false } = req.body

      const updated = await EmergencyLog.findByIdAndUpdate(
        id,
        {
          status:          falseAlarm ? 'false_alarm' : 'resolved',
          resolvedAt:      new Date(),
          resolutionNotes: notes || undefined,
          isFalseAlarm:    falseAlarm,
        },
        { new: true }
      )

      if (!updated) return res.status(404).json({ success: false, error: 'Alert not found' })

      return res.json({ success: true, alert: updated })
    } catch (error) {
      console.error('[AlertController.resolveAlert]', error)
      return res.status(500).json({ success: false, error: error.message })
    }
  }

  /**
   * GET /api/v1/alerts/status/:userId
   * Returns the current confirmation state for a user session.
   */
  static getStatus(req, res) {
    const { userId } = req.params
    const state = ConfirmationStateMachine.getState(userId)
    const cooldown = ConfirmationStateMachine.cooldownRemainingSeconds(userId)

    return res.json({
      success: true,
      userId,
      state,
      onCooldown: cooldown > 0,
      cooldownRemainingSeconds: cooldown,
    })
  }
}

module.exports = AlertController
