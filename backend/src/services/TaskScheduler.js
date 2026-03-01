'use strict'

const Reminder     = require('../models/Reminder')
const WhatsAppService = require('./EmailService')  // WhatsApp via CallMeBot

/**
 * Periodically checks for overdue reminders (30 min past scheduledTime,
 * not completed, still active) and emails the caregiver.
 *
 * To avoid spamming, we mark notified reminders with `notificationSent = true`.
 */
const OVERDUE_THRESHOLD_MS = 30 * 60 * 1000   // 30 minutes
const CHECK_INTERVAL_MS    = 5  * 60 * 1000   // run every 5 minutes

let intervalHandle = null

async function checkOverdueTasks() {
  try {
    const now = new Date()
    const threshold = new Date(now.getTime() - OVERDUE_THRESHOLD_MS)

    // Find active, uncompleted reminders whose scheduledTime is > 30 min ago
    // and that we haven't already emailed about
    const overdue = await Reminder.find({
      isActive: true,
      isCompleted: { $ne: true },
      scheduledTime: { $lte: threshold },
      notificationSent: { $ne: true },
    }).lean()

    if (overdue.length === 0) return

    console.log(`⏰ Found ${overdue.length} overdue task(s) — sending WhatsApp alerts`)

    for (const reminder of overdue) {
      const result = await WhatsAppService.sendOverdueAlert(reminder)

      // Mark as notified so we don't re-send
      if (result.sent) {
        await Reminder.findByIdAndUpdate(reminder._id, {
          notificationSent: true,
          notificationSentAt: new Date(),
        })
      }
    }
  } catch (err) {
    console.error('[TaskScheduler] Error checking overdue tasks:', err.message)
  }
}

function start() {
  console.log('⏰ Task overdue scheduler started (checks every 5 min, 30-min threshold)')
  // Run once immediately, then on interval
  checkOverdueTasks()
  intervalHandle = setInterval(checkOverdueTasks, CHECK_INTERVAL_MS)
}

function stop() {
  if (intervalHandle) {
    clearInterval(intervalHandle)
    intervalHandle = null
    console.log('⏰ Task overdue scheduler stopped')
  }
}

module.exports = { start, stop }
