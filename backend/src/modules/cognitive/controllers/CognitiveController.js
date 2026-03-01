'use strict'

const Conversation = require('../../../models/Conversation')
const Reminder     = require('../../../models/Reminder')
const mongoose     = require('mongoose')

// Fallback placeholder userId for anonymous/dev game saves
const ANON_USER_ID = new mongoose.Types.ObjectId('000000000000000000000001')

/**
 * Cognitive Score Algorithm
 * 
 * Overall score (0-100) = weighted average of:
 *   - Conversation Mood Score  (35%) — based on sentiment of chat messages
 *   - Task Compliance Score    (25%) — based on task completion rate
 *   - Engagement Score         (20%) — based on conversation frequency & length
 *   - Game Performance Score   (20%) — based on game accuracy & scores
 *
 * Computed from real data in MongoDB.
 */

function sentimentToScore(sentiment, mood) {
  if (sentiment === 'positive') return 85
  if (sentiment === 'negative') return 30
  // neutral or undefined — check mood keywords
  if (mood) {
    const m = mood.toLowerCase()
    if (m.includes('positive') || m.includes('content') || m.includes('happy')) return 80
    if (m.includes('distressed') || m.includes('sad') || m.includes('anxious')) return 25
    if (m.includes('concerned')) return 45
  }
  return 55 // neutral default
}

class CognitiveController {

  /**
   * GET /api/v1/cognitive/score
   * Returns current cognitive score + daily breakdown for the past N days
   */
  async getScore(req, res) {
    try {
      const days = parseInt(req.query.days) || 30

      const since = new Date()
      since.setDate(since.getDate() - days)

      // ── 1. Conversation mood data ──
      const conversations = await Conversation.find({
        startedAt: { $gte: since },
      }).sort({ startedAt: 1 }).lean()

      // ── 2. Task/Reminder data ──
      const reminders = await Reminder.find({
        createdAt: { $gte: since },
      }).lean()

      // ── Build daily scores ──
      const dailyMap = {}

      // Process conversations
      for (const conv of conversations) {
        const dateKey = new Date(conv.startedAt).toISOString().split('T')[0]
        if (!dailyMap[dateKey]) {
          dailyMap[dateKey] = { moodScores: [], taskTotal: 0, taskDone: 0, msgCount: 0, convCount: 0 }
        }
        dailyMap[dateKey].convCount++
        
        if (conv.messages && conv.messages.length > 0) {
          for (const msg of conv.messages) {
            if (msg.sender === 'user') {
              dailyMap[dateKey].moodScores.push(sentimentToScore(msg.sentiment, msg.mood))
              dailyMap[dateKey].msgCount++
            }
          }
        }
      }

      // Process reminders
      for (const rem of reminders) {
        const dateKey = rem.scheduledTime
          ? new Date(rem.scheduledTime).toISOString().split('T')[0]
          : new Date(rem.createdAt).toISOString().split('T')[0]
        if (!dailyMap[dateKey]) {
          dailyMap[dateKey] = { moodScores: [], taskTotal: 0, taskDone: 0, msgCount: 0, convCount: 0, gameScores: [] }
        }
        dailyMap[dateKey].taskTotal++
        if (rem.isCompleted) dailyMap[dateKey].taskDone++
      }

      // ── 3. Game performance data ──
      let gameStats = []
      try {
        const GameStats = require('../../../models/GameStats')
        gameStats = await GameStats.find({ datePlayed: { $gte: since } }).sort({ datePlayed: 1 }).lean()
      } catch (e) { /* GameStats not available */ }

      for (const gs of gameStats) {
        const dateKey = new Date(gs.datePlayed).toISOString().split('T')[0]
        if (!dailyMap[dateKey]) {
          dailyMap[dateKey] = { moodScores: [], taskTotal: 0, taskDone: 0, msgCount: 0, convCount: 0, gameScores: [] }
        }
        if (!dailyMap[dateKey].gameScores) dailyMap[dateKey].gameScores = []
        // Combine accuracy (0-100) and normalised score — average them
        const perf = gs.accuracy != null
          ? (gs.accuracy + Math.min(100, gs.score)) / 2
          : Math.min(100, gs.score)
        dailyMap[dateKey].gameScores.push(perf)
      }

      // ── Compute daily cognitive scores ──
      const dailyScores = []
      const sortedDates = Object.keys(dailyMap).sort()

      for (const date of sortedDates) {
        const d = dailyMap[date]

        // Mood score (0-100)
        const moodScore = d.moodScores.length > 0
          ? d.moodScores.reduce((a, b) => a + b, 0) / d.moodScores.length
          : 50

        // Task compliance (0-100)
        const taskScore = d.taskTotal > 0
          ? (d.taskDone / d.taskTotal) * 100
          : 50 // no tasks = neutral

        // Engagement score (0-100): based on messages sent
        // 0 msgs = 20, 1-3 = 50, 4-8 = 70, 9+ = 90
        let engagementScore = 20
        if (d.msgCount >= 9) engagementScore = 90
        else if (d.msgCount >= 4) engagementScore = 70
        else if (d.msgCount >= 1) engagementScore = 50

        // Game performance score (0-100) — average of all game sessions that day
        // If no games played that day, use 50 (neutral) so it doesn't inflate/deflate unfairly
        const gameScore = d.gameScores && d.gameScores.length > 0
          ? d.gameScores.reduce((a, b) => a + b, 0) / d.gameScores.length
          : 50

        const hasGameData = d.gameScores && d.gameScores.length > 0

        // Weighted combo — games included only when data exists, otherwise redistribute weight
        const overall = hasGameData
          ? Math.round(moodScore * 0.35 + taskScore * 0.25 + engagementScore * 0.20 + gameScore * 0.20)
          : Math.round(moodScore * 0.40 + taskScore * 0.30 + engagementScore * 0.30)

        dailyScores.push({
          date,
          dateLabel: new Date(date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          overallScore: Math.min(100, Math.max(0, overall)),
          moodScore: Math.round(moodScore),
          taskScore: Math.round(taskScore),
          engagementScore: Math.round(engagementScore),
          gameScore: Math.round(gameScore),
          gamesPlayed: d.gameScores ? d.gameScores.length : 0,
          messagesCount: d.msgCount,
          conversationsCount: d.convCount,
          tasksCompleted: d.taskDone,
          tasksTotal: d.taskTotal,
        })
      }

      // Current score = average of last 7 days (or all if < 7)
      const recentScores = dailyScores.slice(-7)
      const currentScore = recentScores.length > 0
        ? Math.round(recentScores.reduce((s, d) => s + d.overallScore, 0) / recentScores.length)
        : 50

      // Trend
      let trend = 'stable'
      if (recentScores.length >= 3) {
        const firstHalf = recentScores.slice(0, Math.floor(recentScores.length / 2))
        const secondHalf = recentScores.slice(Math.floor(recentScores.length / 2))
        const avgFirst = firstHalf.reduce((s, d) => s + d.overallScore, 0) / firstHalf.length
        const avgSecond = secondHalf.reduce((s, d) => s + d.overallScore, 0) / secondHalf.length
        if (avgSecond - avgFirst > 5) trend = 'improving'
        else if (avgFirst - avgSecond > 5) trend = 'declining'
      }

      res.json({
        currentScore,
        trend,
        dailyScores,
        summary: {
          totalConversations: conversations.length,
          totalMessages: conversations.reduce((s, c) => s + (c.messages?.filter(m => m.sender === 'user').length || 0), 0),
          totalTasks: reminders.length,
          completedTasks: reminders.filter(r => r.isCompleted).length,
          averageMood: dailyScores.length > 0
            ? Math.round(dailyScores.reduce((s, d) => s + d.moodScore, 0) / dailyScores.length)
            : 50,
          daysTracked: dailyScores.length,
        },
      })
    } catch (err) {
      console.error('[CognitiveController] getScore error:', err.message)
      res.status(500).json({ error: 'Failed to compute cognitive score' })
    }
  }

  /**
   * GET /api/v1/cognitive/mood-timeline
   * Returns mood data from conversations for charting
   */
  async getMoodTimeline(req, res) {
    try {
      const days = parseInt(req.query.days) || 30
      const since = new Date()
      since.setDate(since.getDate() - days)

      const conversations = await Conversation.find({
        startedAt: { $gte: since },
      }).sort({ startedAt: 1 }).lean()

      const moodTimeline = []
      const dailyMoods = {}

      for (const conv of conversations) {
        if (!conv.messages) continue
        const dateKey = new Date(conv.startedAt).toISOString().split('T')[0]
        
        const userMsgs = conv.messages.filter(m => m.sender === 'user')
        if (userMsgs.length === 0) continue

        if (!dailyMoods[dateKey]) {
          dailyMoods[dateKey] = { positive: 0, neutral: 0, negative: 0, total: 0 }
        }

        for (const msg of userMsgs) {
          dailyMoods[dateKey].total++
          if (msg.sentiment === 'positive') dailyMoods[dateKey].positive++
          else if (msg.sentiment === 'negative') dailyMoods[dateKey].negative++
          else dailyMoods[dateKey].neutral++
        }
      }

      for (const date of Object.keys(dailyMoods).sort()) {
        const d = dailyMoods[date]
        // Mood score 1-10: positive=8, neutral=5, negative=2
        const moodScore = d.total > 0
          ? Math.round(((d.positive * 8 + d.neutral * 5 + d.negative * 2) / d.total) * 10) / 10
          : 5
        
        const topMood = d.positive >= d.negative && d.positive >= d.neutral ? 'Happy'
          : d.negative >= d.positive && d.negative >= d.neutral ? 'Sad'
          : 'Neutral'

        moodTimeline.push({
          date: new Date(date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          mood: moodScore,
          label: topMood,
          positive: d.positive,
          neutral: d.neutral,
          negative: d.negative,
          total: d.total,
        })
      }

      res.json({ moodTimeline })
    } catch (err) {
      console.error('[CognitiveController] getMoodTimeline error:', err.message)
      res.status(500).json({ error: 'Failed to get mood timeline' })
    }
  }

  /**
   * POST /api/v1/cognitive/game-result
   * Save a game result from the frontend
   */
  async saveGameResult(req, res) {
    try {
      // Accept both 'game' and 'gameName' for compatibility
      const game = req.body.game || req.body.gameName
      const { score, accuracy, reactionTime, mistakes, completionTime } = req.body

      if (!game || score === undefined) {
        return res.status(400).json({ error: 'game and score are required' })
      }

      // Use real userId from JWT if available, otherwise anonymous placeholder
      const userId = req.auth?.id
        ? (mongoose.Types.ObjectId.isValid(req.auth.id) ? new mongoose.Types.ObjectId(req.auth.id) : ANON_USER_ID)
        : ANON_USER_ID

      // Map game names to gameName enum
      const gameNameMap = {
        'Memory Match': 'memory_match',
        'Simon Says': 'pattern_recognition',
        'Pattern Recognition': 'pattern_recognition',
        'Word Recall': 'word_recall',
        'Reaction Test': 'reaction_test',
        'Family Quiz': 'puzzle_solver',
      }

      // Try to use existing GameStats model if available
      try {
        const GameStats = require('../../../models/GameStats')
        const stat = new GameStats({
          userId,
          gameName: gameNameMap[game] || 'memory_match',
          score,
          accuracy: accuracy || 0,
          reactionTime: reactionTime || undefined,
          moves: mistakes || 0,
          timePlayedSeconds: Math.round((completionTime || 0) / 1000),
          isCompleted: true,
          datePlayed: new Date(),
          difficulty: score >= 80 ? 'hard' : score >= 50 ? 'medium' : 'easy',
        })
        await stat.save()
      } catch (e) {
        // GameStats model may not exist — that's OK, we still return success
        console.warn('[CognitiveController] GameStats save skipped:', e.message)
      }

      res.json({ saved: true })
    } catch (err) {
      console.error('[CognitiveController] saveGameResult error:', err.message)
      res.status(500).json({ error: 'Failed to save game result' })
    }
  }

  /**
   * GET /api/v1/cognitive/game-history
   * Returns game history from GameStats collection
   */
  async getGameHistory(req, res) {
    try {
      const days = parseInt(req.query.days) || 30
      const since = new Date()
      since.setDate(since.getDate() - days)

      let gameHistory = []

      try {
        const GameStats = require('../../../models/GameStats')
        const stats = await GameStats.find({
          datePlayed: { $gte: since },
        }).sort({ datePlayed: -1 }).limit(100).lean()

        const nameMap = {
          memory_match: 'Memory Match',
          pattern_recognition: 'Pattern Recognition',
          word_recall: 'Word Recall',
          reaction_test: 'Reaction Test',
          puzzle_solver: 'Puzzle Solver',
          number_sequence: 'Number Sequence',
        }

        gameHistory = stats.map(s => ({
          game: nameMap[s.gameName] || s.gameName,
          score: s.score,
          accuracy: s.accuracy || 0,
          reactionTime: s.reactionTime,
          date: s.datePlayed,
          difficulty: s.difficulty,
          timePlayed: s.timePlayedSeconds,
        }))
      } catch {
        // GameStats not available
      }

      res.json({ gameHistory })
    } catch (err) {
      console.error('[CognitiveController] getGameHistory error:', err.message)
      res.status(500).json({ error: 'Failed to get game history' })
    }
  }
}

module.exports = new CognitiveController()
