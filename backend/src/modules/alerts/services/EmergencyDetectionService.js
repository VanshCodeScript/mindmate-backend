'use strict'

/**
 * EmergencyDetectionService.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Main orchestrator for the emergency detection & escalation engine.
 *
 * Flow:
 *  1. RiskScoringService analyses the incoming message + context.
 *  2. Based on severity level:
 *     LEVEL_0  → ignored
 *     LEVEL_1  → logged only
 *     LEVEL_2  → confirmation prompt returned to caller
 *     LEVEL_3  → instant Telegram alert + confirmation prompt
 *  3. When user replies, processConfirmationReply() routes the response.
 *  4. Cooldown prevents repeated alerts within the configured window.
 *
 * This service is stateless in the HTTP sense – all per-user state lives in
 * ConfirmationStateMachine (in-memory Map).
 * ─────────────────────────────────────────────────────────────────────────────
 */

const RiskScoringService       = require('./RiskScoringService')
const ConfirmationStateMachine = require('./ConfirmationStateMachine')
const TelegramService          = require('./TelegramService')
const TwilioSOSService         = require('./TwilioSOSService')
const EmergencyLog             = require('../../../models/EmergencyLog')

/** Canned confirmation message returned to the user */
const CONFIRMATION_PROMPT =
  "I noticed something in what you said that concerns me. 🙏\n\n" +
  "Should I notify your caregiver right away?\n\n" +
  "Reply **YES** to alert them now, or **NO** if everything is okay."

/** Canned message for LEVEL_3 (critical) – auto-alert but still ask */
const CRITICAL_PROMPT =
  "⚠️ This sounds like a serious emergency.\n\n" +
  "I have already alerted your caregiver.\n\n" +
  "Reply **NO** if this was a false alarm and I'll let them know."

/**
 * @typedef {Object} DetectionResult
 * @property {boolean}       emergency          – Is this an actionable emergency?
 * @property {string}        severity           – 'LEVEL_0' – 'LEVEL_3'
 * @property {number}        severityLevel      – 0–3
 * @property {number}        score              – Risk score
 * @property {string[]}      matchedKeywords    – Categories matched
 * @property {string}        [confirmationMessage] – Message to show user
 * @property {boolean}       [telegramSent]     – Whether Telegram was notified
 * @property {string}        [action]           – 'log'|'confirm'|'escalate'|'cooldown'
 */

class EmergencyDetectionService {
  /**
   * Analyse a user message and decide what to do.
   *
   * @param {string}   userId          – Unique user identifier (or 'anonymous')
   * @param {string}   message         – The user's current message
   * @param {string[]} [context=[]]    – Last N messages from the same session
   * @param {{ lat: number, lng: number }|null} [location] – Optional GPS
   * @param {{ name?: string, id?: string }} [userMeta] – Display name / id
   * @returns {Promise<DetectionResult>}
   */
  static async detectAndProcess(userId, message, context = [], location = null, userMeta = {}) {
    const safeId = userId || 'anonymous'

    // ── 0. Score the message ────────────────────────────────────────────────
    const scoring = RiskScoringService.score(message, context)
    const { severity, severityLevel, score, matchedKeywords, summary } = scoring

    console.log(`[Emergency] User=${safeId} score=${score} severity=${severity} summary="${summary}"`)

    // ── LEVEL_0 – normal conversation ──────────────────────────────────────
    if (severityLevel === 0) {
      return EmergencyDetectionService._result(false, severity, score, matchedKeywords, 'log')
    }

    // ── LEVEL_1 – mild concern, just log ──────────────────────────────────
    if (severityLevel === 1) {
      console.info(`[Emergency][LEVEL_1] Logged mild concern for ${safeId}: ${summary}`)
      return EmergencyDetectionService._result(false, severity, score, matchedKeywords, 'log')
    }

    // ── Cooldown check (LEVEL_2+) ─────────────────────────────────────────
    if (ConfirmationStateMachine.isOnCooldown(safeId)) {
      const remaining = ConfirmationStateMachine.cooldownRemainingSeconds(safeId)
      console.info(`[Emergency] User ${safeId} is on cooldown (${remaining}s remaining).`)
      return EmergencyDetectionService._result(false, severity, score, matchedKeywords, 'cooldown')
    }

    // ── Check if a confirmation is already awaiting ────────────────────────
    const currentState = ConfirmationStateMachine.getState(safeId)
    if (currentState === 'awaiting_confirm') {
      // User might be replying to the earlier prompt – let caller handle via processConfirmationReply
      return EmergencyDetectionService._result(true, severity, score, matchedKeywords, 'confirm', null)
    }

    // ── LEVEL_3 – Critical: alert immediately, then prompt ─────────────────
    if (severityLevel === 3) {
      let telegramSent = false
      let callMade     = false

      // Fire Telegram + Twilio in parallel
      const userName = userMeta?.name || 'the resident'
      const reason   = matchedKeywords.length ? matchedKeywords.join(', ') : summary

      const [tResult, callResult] = await Promise.allSettled([
        TelegramService.sendEmergencyAlert(
          { ...userMeta, id: safeId },
          severity,
          message,
          location,
          matchedKeywords
        ),
        TwilioSOSService.triggerEmergencyCall(userName, reason),
      ])

      if (tResult.status === 'fulfilled') telegramSent = tResult.value?.ok ?? false
      else console.error('[Emergency] Telegram send failed:', tResult.reason?.message)

      if (callResult.status === 'fulfilled') callMade = callResult.value?.success ?? false
      else console.error('[Emergency] Twilio call failed:', callResult.reason?.message)

      console.log(`[Emergency][LEVEL_3] telegramSent=${telegramSent} callMade=${callMade}`)

      // Persist to MongoDB
      EmergencyDetectionService._saveLog({
        alertType: 'distress_phrase',
        severity:  'critical',
        message,
        matchedKeywords,
        location,
        status: 'triggered',
        emergencyServicesNotified: telegramSent,
        ambulanceRequested: callMade,
      })

      // Also initiate confirmation (user can cancel if false alarm)
      ConfirmationStateMachine.initiateConfirmation(
        safeId, severity, message, matchedKeywords, location
      )

      // Immediately mark last-alert time so cooldown starts
      ConfirmationStateMachine.markDirectEscalation(safeId, severity, message)

      return {
        ...EmergencyDetectionService._result(true, severity, score, matchedKeywords, 'escalate'),
        confirmationMessage: CRITICAL_PROMPT,
        telegramSent,
        callMade,
      }
    }

    // ── LEVEL_2 – High: ask for confirmation ──────────────────────────────
    ConfirmationStateMachine.initiateConfirmation(
      safeId, severity, message, matchedKeywords, location
    )

    // Persist to MongoDB
    EmergencyDetectionService._saveLog({
      alertType: 'distress_phrase',
      severity:  'high',
      message,
      matchedKeywords,
      location,
      status: 'triggered',
    })

    return {
      ...EmergencyDetectionService._result(true, severity, score, matchedKeywords, 'confirm'),
      confirmationMessage: CONFIRMATION_PROMPT,
      telegramSent: false,
    }
  }

  /**
   * Process the user's reply to a pending confirmation prompt.
   *
   * @param {string}   userId
   * @param {string}   reply    – The user's raw reply message
   * @param {{ name?: string, id?: string }} [userMeta]
   * @returns {Promise<{ action: string, telegramSent?: boolean, message?: string }>}
   */
  static async processConfirmationReply(userId, reply, userMeta = {}) {
    const safeId = userId || 'anonymous'
    const { action } = ConfirmationStateMachine.processReply(safeId, reply)

    if (action === 'escalate') {
      const session = ConfirmationStateMachine.getSession(safeId)

      let telegramSent = false
      let callMade     = false

      const userName = userMeta?.name || session?.userMeta?.name || 'the resident'
      const reason   = (session?.matchedKeywords || []).join(', ') || 'user confirmed emergency'

      const [tResult, callResult] = await Promise.allSettled([
        TelegramService.sendEmergencyAlert(
          { ...userMeta, id: safeId },
          session?.severity || 'LEVEL_2',
          session?.originalMessage || reply,
          session?.location || null,
          session?.matchedKeywords || []
        ),
        TwilioSOSService.triggerEmergencyCall(userName, reason),
      ])

      if (tResult.status === 'fulfilled') telegramSent = tResult.value?.ok ?? false
      else console.error('[Emergency] Telegram send failed during confirmation:', tResult.reason?.message)

      if (callResult.status === 'fulfilled') callMade = callResult.value?.success ?? false
      else console.error('[Emergency] Twilio call failed during confirmation:', callResult.reason?.message)

      console.log(`[Emergency][Confirmed] telegramSent=${telegramSent} callMade=${callMade}`)

      // Persist to MongoDB
      EmergencyDetectionService._saveLog({
        alertType: 'distress_phrase',
        severity:  'critical',
        message:   session?.originalMessage || reply,
        matchedKeywords: session?.matchedKeywords || [],
        location:  session?.location || null,
        status:    'triggered',
        emergencyServicesNotified: telegramSent,
        ambulanceRequested: callMade,
      })

      ConfirmationStateMachine.clearSession(safeId)
      return {
        action: 'escalated',
        telegramSent,
        callMade,
        message: telegramSent || callMade
          ? "✅ Your caregiver has been notified and a call has been placed. Help is on the way. 💙"
          : "⚠️ I tried to notify your caregiver but the notification service is unavailable. Please call for help directly.",
      }
    }

    if (action === 'cancel') {
      ConfirmationStateMachine.clearSession(safeId)
      return {
        action: 'cancelled',
        message: "Okay, I won't alert your caregiver. Stay safe – I'm here if you need me. 💙",
      }
    }

    if (action === 'still_pending') {
      return {
        action: 'pending',
        message: "I didn't quite catch that. Please reply **YES** to notify your caregiver, or **NO** to cancel.",
      }
    }

    // no_session
    return { action: 'no_session' }
  }

  /**
   * Process any sessions that auto-escalated due to timeout.
   * Call this from a periodic job or middleware if needed.
   *
   * @returns {Promise<void>}
   */
  static async processAutoEscalations() {
    const pending = ConfirmationStateMachine.drainAutoEscalated()

    for (const { userId, entry } of pending) {
      console.warn(`[Emergency] Processing auto-escalation for user ${userId}`)
      try {
        const reason = (entry.matchedKeywords || []).join(', ') || 'auto-escalation timeout'
        await Promise.allSettled([
          TelegramService.sendEmergencyAlert(
            { id: userId },
            entry.severity,
            entry.originalMessage,
            entry.location,
            entry.matchedKeywords
          ),
          TwilioSOSService.triggerEmergencyCall('the resident', reason),
        ])
      } catch (err) {
        console.error(`[Emergency] Auto-escalation failed for ${userId}:`, err.message)
      }
      ConfirmationStateMachine.clearSession(userId)
    }
  }

  // ── Private ──────────────────────────────────────────────────────────────

  /** @private – fire-and-forget: persist alert to MongoDB */
  static _saveLog({ alertType = 'distress_phrase', severity = 'high', message = '', matchedKeywords = [], location = null, status = 'triggered', emergencyServicesNotified = false, ambulanceRequested = false } = {}) {
    const dbSeverity = severity === 'critical' ? 'critical' : severity === 'high' ? 'high' : 'medium'
    const keywords   = Array.isArray(matchedKeywords) ? matchedKeywords.join(', ') : ''
    EmergencyLog.create({
      alertType,
      severity: dbSeverity,
      message:  message ? message.slice(0, 500) : 'Emergency detected',
      actionTaken: keywords || undefined,
      status,
      emergencyServicesNotified,
      ambulanceRequested,
      triggeredAt: new Date(),
      ...(location ? { location: { latitude: location.lat, longitude: location.lng } } : {}),
    }).catch(err => console.error('[Emergency] Failed to save EmergencyLog:', err.message))
  }

  /** @private */
  static _result(emergency, severity, score, matchedKeywords, action, confirmationMessage = undefined) {
    return {
      emergency,
      severity,
      severityLevel: parseInt(severity.replace('LEVEL_', ''), 10) || 0,
      score,
      matchedKeywords,
      action,
      ...(confirmationMessage !== undefined ? { confirmationMessage } : {}),
    }
  }
}

module.exports = EmergencyDetectionService
