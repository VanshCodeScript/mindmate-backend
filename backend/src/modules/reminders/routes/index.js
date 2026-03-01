'use strict'

const express            = require('express')
const ReminderController = require('../controllers/ReminderController')

const router = express.Router()

router.post('/',               ReminderController.create)
router.get('/',                ReminderController.list)
router.patch('/:id',           ReminderController.update)
router.delete('/:id',          ReminderController.remove)
router.patch('/:id/complete',  ReminderController.toggleComplete)

module.exports = router
