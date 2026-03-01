'use strict'

const Reminder = require('../../../models/Reminder')

class ReminderController {
  /**
   * POST /  — Create a new task / reminder
   * Body: { userId, type, title, description?, scheduledTime, recurrence?, priority?, notes? }
   */
  static async create(req, res) {
    try {
      const {
        userId, type = 'custom', title, description,
        scheduledTime, recurrence = 'once', priority = 'medium', notes,
      } = req.body

      if (!userId || !title) {
        return res.status(400).json({ success: false, error: 'userId and title are required' })
      }

      const reminder = await Reminder.create({
        userId, type, title, description,
        scheduledTime: scheduledTime ? new Date(scheduledTime) : undefined,
        recurrence, priority, notes,
        isActive: true, isCompleted: false,
        startDate: new Date(),
      })

      return res.status(201).json({ success: true, reminder })
    } catch (error) {
      console.error('[ReminderController.create]', error)
      return res.status(500).json({ success: false, error: error.message })
    }
  }

  /**
   * GET /  — List reminders (filter by userId, status, type)
   * Query: ?userId=&completed=&type=&active=&limit=&sort=
   */
  static async list(req, res) {
    try {
      const filter = {}
      if (req.query.userId) filter.userId = req.query.userId
      if (req.query.type) filter.type = req.query.type
      if (req.query.completed !== undefined) {
        filter.isCompleted = req.query.completed === 'true'
      }
      if (req.query.active !== undefined) {
        filter.isActive = req.query.active === 'true'
      }

      const limit = Math.min(parseInt(req.query.limit) || 100, 500)
      const sortField = req.query.sort || '-scheduledTime'

      const reminders = await Reminder.find(filter)
        .sort(sortField)
        .limit(limit)
        .lean()

      return res.json({
        success: true,
        total: reminders.length,
        reminders: reminders.map(r => ({
          id: r._id,
          userId: r.userId,
          type: r.type,
          title: r.title,
          description: r.description || '',
          scheduledTime: r.scheduledTime,
          recurrence: r.recurrence,
          priority: r.priority,
          isActive: r.isActive,
          isCompleted: !!r.isCompleted,
          completedAt: r.completedAt || null,
          notes: r.notes || '',
          createdAt: r.createdAt,
          updatedAt: r.updatedAt,
        })),
      })
    } catch (error) {
      console.error('[ReminderController.list]', error)
      return res.status(500).json({ success: false, error: error.message })
    }
  }

  /**
   * PATCH /:id  — Update a reminder (edit fields, mark complete, etc.)
   */
  static async update(req, res) {
    try {
      const { id } = req.params
      const updates = { ...req.body }

      // If marking as completed, set completedAt
      if (updates.isCompleted === true && !updates.completedAt) {
        updates.completedAt = new Date()
      }
      // If un-completing, clear completedAt
      if (updates.isCompleted === false) {
        updates.completedAt = null
      }

      // Parse scheduledTime if provided
      if (updates.scheduledTime) {
        updates.scheduledTime = new Date(updates.scheduledTime)
      }

      const reminder = await Reminder.findByIdAndUpdate(id, updates, { new: true }).lean()
      if (!reminder) {
        return res.status(404).json({ success: false, error: 'Reminder not found' })
      }

      return res.json({ success: true, reminder })
    } catch (error) {
      console.error('[ReminderController.update]', error)
      return res.status(500).json({ success: false, error: error.message })
    }
  }

  /**
   * DELETE /:id  — Remove a reminder permanently
   */
  static async remove(req, res) {
    try {
      const { id } = req.params
      const deleted = await Reminder.findByIdAndDelete(id)
      if (!deleted) {
        return res.status(404).json({ success: false, error: 'Reminder not found' })
      }
      return res.json({ success: true, message: 'Reminder deleted' })
    } catch (error) {
      console.error('[ReminderController.remove]', error)
      return res.status(500).json({ success: false, error: error.message })
    }
  }

  /**
   * PATCH /:id/complete — Quick toggle complete
   */
  static async toggleComplete(req, res) {
    try {
      const { id } = req.params
      const reminder = await Reminder.findById(id)
      if (!reminder) {
        return res.status(404).json({ success: false, error: 'Reminder not found' })
      }

      reminder.isCompleted = !reminder.isCompleted
      reminder.completedAt = reminder.isCompleted ? new Date() : null
      await reminder.save()

      return res.json({ success: true, reminder })
    } catch (error) {
      console.error('[ReminderController.toggleComplete]', error)
      return res.status(500).json({ success: false, error: error.message })
    }
  }
}

module.exports = ReminderController
