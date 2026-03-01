'use strict'

const { Router } = require('express')
const ctrl = require('../controllers/CognitiveController')
const optionalAuth = require('../../../middleware/optionalAuth')

const router = Router()

router.get('/score',          (req, res) => ctrl.getScore(req, res))
router.get('/mood-timeline',  (req, res) => ctrl.getMoodTimeline(req, res))
router.get('/game-history',   (req, res) => ctrl.getGameHistory(req, res))
router.post('/game-result',   optionalAuth, (req, res) => ctrl.saveGameResult(req, res))

module.exports = router
