'use strict'

/**
 * TelegramService.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Sends emergency alerts to a Telegram bot chat using the Telegram Bot API.
 *
 * Required environment variables:
 *   TELEGRAM_BOT_TOKEN  – Bot token from @BotFather
 *   TELEGRAM_CHAT_ID    – Chat / group ID to receive alerts
 *
 * Optional:
 *   TELEGRAM_CAREGIVER_CHAT_ID – A second chat ID (e.g. caregiver's private chat)
 * ─────────────────────────────────────────────────────────────────────────────
 */

const https = require('https')

/** Telegram Bot API base URL */
const BASE_URL = (token) => `https://api.telegram.org/bot${token}`

const SEVERITY_EMOJI = {
  LEVEL_0: 'ℹ️',
  LEVEL_1: '🟡',
  LEVEL_2: '🟠',
  LEVEL_3: '🔴',
}

const SEVERITY_LABEL = {
  LEVEL_0: 'Normal',
  LEVEL_1: 'Mild Concern',
  LEVEL_2: 'High Concern',
  LEVEL_3: '🚨 CRITICAL EMERGENCY',
}

class TelegramService {
  /**
   * Send a formatted emergency alert to the configured Telegram chat.
   *
   * @param {{ name?: string, id?: string }}  user      – The elderly user
   * @param {string}                          severity  – 'LEVEL_1' | 'LEVEL_2' | 'LEVEL_3'
   * @param {string}                          message   – Original triggering message
   * @param {{ lat: number, lng: number }|null} [location] – Optional GPS coords
   * @param {string[]}                        [keywords] – Matched keyword categories
   * @returns {Promise<{ ok: boolean, messageId?: number, error?: string }>}
   */
  static async sendEmergencyAlert(user, severity, message, location = null, keywords = []) {
    const token = process.env.TELEGRAM_BOT_TOKEN
    const chatId = process.env.TELEGRAM_CHAT_ID

    if (!token || !chatId) {
      console.warn('[TelegramService] TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID not configured. Skipping alert.')
      return { ok: false, error: 'Telegram not configured' }
    }

    const emoji   = SEVERITY_EMOJI[severity] || '⚠️'
    const label   = SEVERITY_LABEL[severity] || severity
    const ts      = new Date().toLocaleString('en-GB', { timeZone: 'UTC', hour12: false })
    const userName = user?.name || 'MindBridge User'
    const userId   = user?.id  || 'unknown'
    const keywordStr = keywords.length ? keywords.join(', ') : 'general distress'

    const text = [
      `${emoji} *${label}*`,
      ``,
      `👤 *User:* ${TelegramService._escape(userName)} (ID: ${TelegramService._escape(userId)})`,
      `🕐 *Time:* ${ts} UTC`,
      `🏷️ *Detected:* ${TelegramService._escape(keywordStr)}`,
      ``,
      `💬 *Message:*`,
      `_"${TelegramService._escape(message)}"_`,
      ``,
      location
        ? `📍 *Location:* [Open Map](https://maps.google.com/?q=${location.lat},${location.lng})`
        : `📍 *Location:* Not available`,
      ``,
      `━━━━━━━━━━━━━━━━━━━━`,
      `_MindBridge Emergency Engine_`,
    ].join('\n')

    try {
      // Send text alert
      const textResult = await TelegramService._post(token, 'sendMessage', {
        chat_id: chatId,
        text,
        parse_mode: 'Markdown',
        disable_web_page_preview: true,
      })

      // Also send location pin if available
      if (location?.lat && location?.lng) {
        await TelegramService._post(token, 'sendLocation', {
          chat_id: chatId,
          latitude: location.lat,
          longitude: location.lng,
        }).catch(() => {}) // Don't fail the whole alert if location pin fails
      }

      // If a separate caregiver chat ID is configured, send there too
      const caregiverChatId = process.env.TELEGRAM_CAREGIVER_CHAT_ID
      if (caregiverChatId && caregiverChatId !== chatId) {
        await TelegramService._post(token, 'sendMessage', {
          chat_id: caregiverChatId,
          text,
          parse_mode: 'Markdown',
          disable_web_page_preview: true,
        }).catch(() => {})
      }

      console.log(`[TelegramService] Alert sent for user ${userId} (${severity})`)
      return { ok: true, messageId: textResult?.result?.message_id }
    } catch (err) {
      console.error('[TelegramService] Failed to send alert:', err.message)
      return { ok: false, error: err.message }
    }
  }

  /**
   * Send a plain text notification (for non-emergency updates).
   * @param {string} text
   * @returns {Promise<{ ok: boolean }>}
   */
  static async sendNotification(text) {
    const token  = process.env.TELEGRAM_BOT_TOKEN
    const chatId = process.env.TELEGRAM_CHAT_ID
    if (!token || !chatId) return { ok: false }

    try {
      await TelegramService._post(token, 'sendMessage', { chat_id: chatId, text })
      return { ok: true }
    } catch {
      return { ok: false }
    }
  }

  // ── Private ──────────────────────────────────────────────────────────────

  /**
   * Make an HTTPS POST to the Telegram Bot API.
   * @private
   */
  static _post(token, method, body) {
    return new Promise((resolve, reject) => {
      const payload = JSON.stringify(body)
      const options = {
        hostname: 'api.telegram.org',
        path: `/bot${token}/${method}`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
        },
      }

      const req = https.request(options, (res) => {
        let data = ''
        res.on('data', (chunk) => { data += chunk })
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data)
            if (!parsed.ok) reject(new Error(parsed.description || 'Telegram API error'))
            else resolve(parsed)
          } catch (e) {
            reject(e)
          }
        })
      })

      req.on('error', reject)
      req.write(payload)
      req.end()
    })
  }

  /**
   * Escape Markdown special chars for Telegram's legacy Markdown mode.
   * @private
   */
  static _escape(str) {
    return (str || '').replace(/[_*[\]()~`>#+=|{}.!-]/g, '\\$&')
  }
}

module.exports = TelegramService
