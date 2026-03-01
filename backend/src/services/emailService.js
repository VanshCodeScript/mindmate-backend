'use strict'

const axios = require('axios')

/**
 * WhatsApp alert service using Green API (https://green-api.com).
 * FREE forever — 1 instance, no credit card.
 *
 * SETUP (3 minutes):
 *   1. Go to https://green-api.com → Sign up (free)
 *   2. Create an instance → Scan the QR code with your WhatsApp
 *   3. Copy your Instance ID and API Token from the dashboard
 *   4. Set in .env:
 *        GREEN_API_INSTANCE_ID=<your-instance-id>
 *        GREEN_API_TOKEN=<your-api-token>
 *        CAREGIVER_WHATSAPP_NUMBER=919136247237
 */
class WhatsAppService {
  constructor() {
    this.instanceId = process.env.GREEN_API_INSTANCE_ID
    this.apiToken   = process.env.GREEN_API_TOKEN
    this.phone      = process.env.CAREGIVER_WHATSAPP_NUMBER || '919136247237'

    if (!this.instanceId || !this.apiToken) {
      console.warn('⚠️  GREEN_API credentials not set — WhatsApp notifications disabled')
      console.warn('   → Sign up free at https://green-api.com')
      console.warn('   → Create instance, scan QR, set GREEN_API_INSTANCE_ID & GREEN_API_TOKEN in .env')
    } else {
      console.log(`📱 WhatsApp Service ready (Green API → ${this.phone})`)
    }
  }

  /**
   * Send a WhatsApp message via Green API.
   * @param {{ to: string, body: string }} opts
   */
  async send({ to, body }) {
    if (!this.instanceId || !this.apiToken) {
      console.warn('[WhatsAppService] Credentials not configured — skipping message')
      return { sent: false, reason: 'GREEN_API credentials not configured' }
    }

    // Normalise number: strip +, spaces, dashes. Ensure country code.
    let chatId = (to || this.phone).replace(/[\s+\-()]/g, '')
    if (/^\d{10}$/.test(chatId)) {
      chatId = '91' + chatId  // add India country code
    }
    // Green API wants format: 919136247237@c.us
    if (!chatId.endsWith('@c.us')) {
      chatId = chatId + '@c.us'
    }

    const url = `https://api.green-api.com/waInstance${this.instanceId}/sendMessage/${this.apiToken}`

    try {
      const { data } = await axios.post(url, {
        chatId,
        message: body,
      }, { timeout: 15000 })

      if (data.idMessage) {
        console.log(`📱 WhatsApp sent to ${chatId} — msgId: ${data.idMessage}`)
        return { sent: true, messageId: data.idMessage }
      } else {
        console.error(`[WhatsAppService] Green API error:`, JSON.stringify(data))
        return { sent: false, reason: JSON.stringify(data) }
      }
    } catch (err) {
      const errMsg = err.response?.data?.message || err.response?.data || err.message
      console.error(`[WhatsAppService] Failed to send to ${chatId}:`, errMsg)
      return { sent: false, reason: typeof errMsg === 'object' ? JSON.stringify(errMsg) : errMsg }
    }
  }

  /**
   * Send an overdue-task WhatsApp alert to the caregiver.
   * @param {object} reminder — Reminder document (lean)
   */
  async sendOverdueAlert(reminder) {
    const to = this.phone
    const scheduledStr = reminder.scheduledTime
      ? new Date(reminder.scheduledTime).toLocaleString()
      : 'N/A'

    const body =
      `🚨 *MindBridge ALERT*\n\n` +
      `⏰ *OVERDUE TASK:* ${reminder.title}\n` +
      `📋 Type: ${reminder.type || 'custom'}\n` +
      `🔴 Priority: ${(reminder.priority || 'medium').toUpperCase()}\n` +
      `🕐 Scheduled: ${scheduledStr}\n` +
      (reminder.description ? `📝 ${reminder.description}\n` : '') +
      `\n⚠️ The elderly person has not completed this task. Please follow up immediately.`

    return this.send({ to, body })
  }
}

// Singleton
module.exports = new WhatsAppService()
