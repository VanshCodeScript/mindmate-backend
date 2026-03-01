'use strict'

/**
 * ConfirmationStateMachine.js
 * ─────────────────────────────────────────────────────────────────────────────
 * In-memory state machine that manages the "Did you mean to alert your
 * caregiver?" confirmation flow for LEVEL_2 and LEVEL_3 emergencies.
 *
 * States for each user session:
 *   idle               – No pending confirmation
 *   awaiting_confirm   – Confirmation message sent; waiting for user reply
 *   confirmed          – User replied "yes"; escalation in progress
 *   denied             – User replied "no"; alert cancelled
 *   auto_escalated     – Timeout elapsed without response; auto-escalated
 *
 * Cooldown protection: prevents re-alerting the same user within
 * COOLDOWN_MS milliseconds of the last sent alert.
 * ─────────────────────────────────────────────────────────────────────────────
 */

/** ms until an unanswered confirmation auto-escalates (default 60 s) */
const CONFIRMATION_TIMEOUT_MS = (parseInt(process.env.EMERGENCY_CONFIRM_TIMEOUT_SEC, 10) || 60) * 1_000

/** ms cooldown between consecutive alerts for the same user (default 5 min) */
const COOLDOWN_MS = (parseInt(process.env.EMERGENCY_COOLDOWN_MIN, 10) || 5) * 60_000

/**
 * @typedef {'idle'|'awaiting_confirm'|'confirmed'|'denied'|'auto_escalated'} ConfirmState
 *
 * @typedef {Object} SessionEntry
 * @property {ConfirmState} state
 * @property {string}       severity
 * @property {string}       originalMessage
 * @property {string[]}     [matchedKeywords]
 * @property {number}       [location.lat]
 * @property {number}       [location.lng]
 * @property {number}       createdAt        – Unix ms when confirmation started
 * @property {number}       [lastAlertAt]    – Unix ms of last sent alert
 */

/** @type {Map<string, SessionEntry>} */
const sessions = new Map()

class ConfirmationStateMachine {
  // ── Queries ──────────────────────────────────────────────────────────────

  /**
   * Return current session state for a user (or 'idle').
   * @param {string} userId
   * @returns {ConfirmState}
   */
  static getState(userId) {
    return sessions.get(userId)?.state || 'idle'
  }

  /**
   * Return full session entry, or null if none exists.
   * @param {string} userId
   * @returns {SessionEntry|null}
   */
  static getSession(userId) {
    return sessions.get(userId) || null
  }

  /**
   * Check whether the user is in cooldown (recently received an alert).
   * @param {string} userId
   * @returns {boolean}
   */
  static isOnCooldown(userId) {
    const entry = sessions.get(userId)
    if (!entry?.lastAlertAt) return false
    return Date.now() - entry.lastAlertAt < COOLDOWN_MS
  }

  /**
   * Remaining cooldown in seconds (0 if not on cooldown).
   * @param {string} userId
   * @returns {number}
   */
  static cooldownRemainingSeconds(userId) {
    const entry = sessions.get(userId)
    if (!entry?.lastAlertAt) return 0
    const remaining = COOLDOWN_MS - (Date.now() - entry.lastAlertAt)
    return remaining > 0 ? Math.ceil(remaining / 1_000) : 0
  }

  // ── Transitions ──────────────────────────────────────────────────────────

  /**
   * Begin a confirmation flow for LEVEL_2 / LEVEL_3 emergencies.
   * Stores state and schedules the auto-escalation timeout.
   *
   * @param {string}   userId
   * @param {string}   severity        – e.g. 'LEVEL_2' or 'LEVEL_3'
   * @param {string}   originalMessage – The triggering user message
   * @param {string[]} [matchedKeywords]
   * @param {{ lat: number, lng: number }|null} [location]
   * @returns {number} Timeout handle (can be used to cancel)
   */
  static initiateConfirmation(userId, severity, originalMessage, matchedKeywords = [], location = null) {
    const prev = sessions.get(userId)
    sessions.set(userId, {
      state: 'awaiting_confirm',
      severity,
      originalMessage,
      matchedKeywords,
      location,
      createdAt: Date.now(),
      lastAlertAt: prev?.lastAlertAt || null,
    })

    // Schedule auto-escalation
    const handle = setTimeout(() => {
      const current = sessions.get(userId)
      if (current?.state === 'awaiting_confirm') {
        sessions.set(userId, { ...current, state: 'auto_escalated', lastAlertAt: Date.now() })
        console.warn(`[Emergency] Auto-escalated for user ${userId} after ${CONFIRMATION_TIMEOUT_MS / 1000}s silence.`)
        // The EmergencyDetectionService polls / handles the escalation asynchronously
      }
    }, CONFIRMATION_TIMEOUT_MS)

    return handle
  }

  /**
   * Process the user's text reply to the confirmation prompt.
   *
   * @param {string} userId
   * @param {string} reply – Raw user message
   * @returns {{ action: 'escalate'|'cancel'|'still_pending'|'no_session' }}
   */
  static processReply(userId, reply) {
    const entry = sessions.get(userId)

    if (!entry || entry.state !== 'awaiting_confirm') {
      return { action: 'no_session' }
    }

    const lowered = (reply || '').toLowerCase().trim()

    const positive = /\b(yes|yeah|yep|yup|sure|ok|okay|please|do\s*it|notify|call|help|go ahead|affirmative|confirm)\b/i.test(lowered)
    const negative = /\b(no|nope|nah|don[''']?t|stop|cancel|never\s*mind|forget\s*it|false\s*alarm)\b/i.test(lowered)

    if (positive) {
      sessions.set(userId, { ...entry, state: 'confirmed', lastAlertAt: Date.now() })
      return { action: 'escalate' }
    }

    if (negative) {
      sessions.set(userId, { ...entry, state: 'denied' })
      return { action: 'cancel' }
    }

    // Ambiguous reply – remain in awaiting state
    return { action: 'still_pending' }
  }

  /**
   * Mark a direct LEVEL_3 alert as sent (no confirmation needed).
   * @param {string} userId
   * @param {string} severity
   * @param {string} originalMessage
   */
  static markDirectEscalation(userId, severity, originalMessage) {
    const prev = sessions.get(userId)
    sessions.set(userId, {
      state: 'confirmed',
      severity,
      originalMessage,
      matchedKeywords: [],
      location: null,
      createdAt: Date.now(),
      lastAlertAt: Date.now(),
      ...(prev || {}),
      // Override the important fields:
      state: 'confirmed',
      lastAlertAt: Date.now(),
    })
  }

  /**
   * Clear session state for a user (call after escalation completes).
   * Preserves the `lastAlertAt` timestamp for cooldown logic.
   * @param {string} userId
   */
  static clearSession(userId) {
    const entry = sessions.get(userId)
    if (entry) {
      sessions.set(userId, { state: 'idle', lastAlertAt: entry.lastAlertAt || null })
    }
  }

  /**
   * Check whether there are any sessions that timed out and need escalation.
   * Call this periodically (e.g. from EmergencyDetectionService) if you
   * need to process auto-escalations server-side.
   *
   * @returns {Array<{ userId: string, entry: SessionEntry }>}
   */
  static drainAutoEscalated() {
    const ready = []
    for (const [userId, entry] of sessions.entries()) {
      if (entry.state === 'auto_escalated') {
        ready.push({ userId, entry })
      }
    }
    return ready
  }

  // ── Debug ────────────────────────────────────────────────────────────────

  /** @returns {Object} snapshot of all active sessions (for debugging) */
  static dump() {
    return Object.fromEntries(sessions.entries())
  }
}

module.exports = ConfirmationStateMachine
