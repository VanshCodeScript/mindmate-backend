'use strict'

const mongoose                 = require('mongoose')
const ChatbotService            = require('../services/ChatbotService')
const EmergencyDetectionService = require('../../alerts/services/EmergencyDetectionService')
const ConfirmationStateMachine  = require('../../alerts/services/ConfirmationStateMachine')
const Conversation              = require('../../../models/Conversation')

// ── Fallback userId used when the client hasn't authenticated ─────────────────
const SYSTEM_USER_ID = new mongoose.Types.ObjectId('000000000000000000000001')

/**
 * In-memory context store: conversationId → last 5 user messages (strings).
 * Used to boost emergency risk scoring with recent symptom mentions.
 * @type {Map<string, string[]>}
 */
const sessionContexts = new Map()
const CONTEXT_WINDOW = 5

function pushContext(conversationId, message) {
  if (!conversationId) return
  const buf = sessionContexts.get(conversationId) || []
  buf.push(message)
  if (buf.length > CONTEXT_WINDOW) buf.shift()
  sessionContexts.set(conversationId, buf)
}

function getContext(conversationId) {
  return conversationId ? (sessionContexts.get(conversationId) || []) : []
}

/** Parse a userId from a string/object, falling back to SYSTEM_USER_ID. */
function resolveUserId(rawId) {
  if (!rawId) return SYSTEM_USER_ID
  try {
    return new mongoose.Types.ObjectId(rawId)
  } catch {
    return SYSTEM_USER_ID
  }
}

/**
 * Derive a mood label and short topic summary from an array of messages.
 * Runs entirely in-process — no LLM call needed.
 */
function deriveInsight(messages = []) {
  const userMsgs = messages.filter((m) => m.sender === 'user').map((m) => m.text.toLowerCase())
  if (!userMsgs.length) return { mood: 'No data', moodColor: 'gray', summary: 'No messages recorded yet.' }

  const positiveWords = ['good', 'great', 'happy', 'wonderful', 'fine', 'better', 'love', 'nice', 'thank', 'glad', 'lovely', 'well', 'excited', 'cheerful']
  const negativeWords = ['pain', 'hurt', 'sad', 'worried', 'scared', 'lonely', 'confused', 'lost', 'bad', 'terrible', 'sick', 'unwell', 'ache', 'dizzy', 'tired', 'anxious', 'upset', 'cry', 'afraid', 'help me']

  let posScore = 0, negScore = 0
  userMsgs.forEach((t) => {
    positiveWords.forEach((w) => { if (t.includes(w)) posScore++ })
    negativeWords.forEach((w) => { if (t.includes(w)) negScore++ })
  })

  let mood, moodColor
  if      (negScore >= posScore + 2) { mood = 'Distressed'; moodColor = 'red'    }
  else if (negScore > posScore)      { mood = 'Concerned';  moodColor = 'orange' }
  else if (posScore >= negScore + 2) { mood = 'Positive';   moodColor = 'green'  }
  else if (posScore > negScore)      { mood = 'Content';    moodColor = 'blue'   }
  else                               { mood = 'Neutral';    moodColor = 'gray'   }

  // Topic detection
  const topicMap = [
    { label: 'family',       words: ['family', 'son', 'daughter', 'wife', 'husband', 'grandchild', 'child', 'brother', 'sister', 'mother', 'father'] },
    { label: 'health',       words: ['pain', 'medication', 'medicine', 'doctor', 'sick', 'hurt', 'ache', 'dizzy', 'symptom', 'hospital'] },
    { label: 'memory',       words: ['remember', 'forget', 'memory', 'forgot', 'recall'] },
    { label: 'wellbeing',    words: ['lonely', 'tired', 'worried', 'anxious', 'sad', 'scared'] },
    { label: 'daily life',   words: ['eat', 'sleep', 'exercise', 'walk', 'morning', 'night', 'food', 'breakfast', 'lunch', 'dinner'] },
    { label: 'general chat', words: ['how are you', 'your day', 'hello', 'hi', 'weather', 'tell me', 'what do you'] },
  ]

  const allText = userMsgs.join(' ')
  const detectedTopics = topicMap
    .filter(({ words }) => words.some((w) => allText.includes(w)))
    .map(({ label }) => label)

  let summary
  if (detectedTopics.length === 0) {
    summary = `Short conversation with ${userMsgs.length} message${userMsgs.length > 1 ? 's' : ''}.`
  } else if (detectedTopics.length === 1) {
    summary = `Conversation centred around ${detectedTopics[0]}.`
  } else {
    const last = detectedTopics.pop()
    summary = `Discussed ${detectedTopics.join(', ')} and ${last}.`
  }

  return { mood, moodColor, summary }
}

class ChatbotController {
  // ── POST /api/chatbot/send ──────────────────────────────────────────────────
  static async sendMessage(req, res) {
    try {
      const { message, conversationId, userId, location, userMeta, language } = req.body

      if (!message || typeof message !== 'string') {
        return res.status(400).json({ error: 'Message is required' })
      }

      if (!ChatbotService.isConfigured()) {
        return res.status(503).json({ error: 'AI service not configured' })
      }

      // ── Context ──
      const context = getContext(conversationId)
      pushContext(conversationId, message)

      // ── Emergency confirmation check ──
      const sessionUserId = userId || conversationId || 'anonymous'
      const pendingState  = ConfirmationStateMachine.getState(sessionUserId)
      let confirmationResult = null

      if (pendingState === 'awaiting_confirm') {
        confirmationResult = await EmergencyDetectionService.processConfirmationReply(
          sessionUserId, message, userMeta || {}
        )
      }

      // ── AI + Emergency in parallel ──
      const model = ChatbotService.getConfiguredModel()
      const [aiResult, emergencyResult] = await Promise.all([
        model === 'gemini'
          ? ChatbotService.sendToGemini(message, language)
          : ChatbotService.sendToGroq(message, language),
        pendingState !== 'awaiting_confirm'
          ? EmergencyDetectionService.detectAndProcess(
              sessionUserId, message, context, location || null, userMeta || {}
            )
          : Promise.resolve(null),
      ])

      EmergencyDetectionService.processAutoEscalations().catch(() => {})

      // ── Persist both messages to MongoDB ──
      if (conversationId && mongoose.Types.ObjectId.isValid(conversationId)) {
        try {
          await Conversation.findByIdAndUpdate(
            conversationId,
            {
              $push: {
                messages: {
                  $each: [
                    { sender: 'user', text: message,        timestamp: new Date() },
                    { sender: 'ai',   text: aiResult.reply, timestamp: new Date(), mood: 'caring' },
                  ],
                },
              },
              $inc: { messageCount: 2 },
              $set: { aiModel: aiResult.model },
            },
            { new: true }
          )
        } catch (dbErr) {
          console.error('[ChatbotController] MongoDB push failed:', dbErr.message)
        }
      }

      // ── Build emergency payload ──
      const emergency = emergencyResult?.emergency
        ? emergencyResult
        : confirmationResult?.action === 'escalated'
          ? { ...confirmationResult, emergency: true }
          : null

      return res.json({
        success: true,
        conversationId,
        reply: aiResult.reply,
        model: aiResult.model,
        context: aiResult.context || [],
        metadata: { timestamp: new Date(), tokens: aiResult.tokens },
        emergency: emergency
          ? {
              detected:            true,
              severity:            emergency.severity || 'LEVEL_2',
              severityLevel:       emergency.severityLevel,
              score:               emergency.score,
              matchedKeywords:     emergency.matchedKeywords || [],
              action:              emergency.action,
              confirmationMessage: emergency.confirmationMessage || null,
              telegramSent:        emergency.telegramSent || false,
              userMessage:         confirmationResult?.message || emergency.confirmationMessage || null,
            }
          : null,
      })
    } catch (error) {
      console.error('Chatbot error:', error)
      res.status(500).json({
        error: error.message || 'Failed to process message',
        details: process.env.NODE_ENV === 'development' ? error.toString() : undefined,
      })
    }
  }

  // ── POST /api/chatbot/voice ─────────────────────────────────────────────────
  static async sendVoiceMessage(req, res) {
    try {
      const { audio, conversationId, userId, location, userMeta } = req.body

      if (!audio) return res.status(400).json({ error: 'Audio data is required' })
      if (!ChatbotService.isConfigured()) return res.status(503).json({ error: 'AI service not configured' })

      const model = ChatbotService.getConfiguredModel()
      const transcriptionResult = await ChatbotService.transcribeAudio(audio)
      const transcription = transcriptionResult.transcription

      const sessionUserId = userId || conversationId || 'anonymous'
      const context = getContext(conversationId)
      pushContext(conversationId, transcription)

      const [aiResult, emergencyResult] = await Promise.all([
        model === 'gemini'
          ? ChatbotService.sendToGemini(transcription)
          : ChatbotService.sendToGroq(transcription),
        EmergencyDetectionService.detectAndProcess(
          sessionUserId, transcription, context, location || null, userMeta || {}
        ),
      ])

      // ── Persist to MongoDB ──
      if (conversationId && mongoose.Types.ObjectId.isValid(conversationId)) {
        try {
          await Conversation.findByIdAndUpdate(
            conversationId,
            {
              $push: {
                messages: {
                  $each: [
                    { sender: 'user', text: transcription,  timestamp: new Date() },
                    { sender: 'ai',   text: aiResult.reply, timestamp: new Date(), mood: 'caring' },
                  ],
                },
              },
              $inc: { messageCount: 2 },
              $set: { aiModel: aiResult.model },
            }
          )
        } catch (dbErr) {
          console.error('[ChatbotController] MongoDB voice push failed:', dbErr.message)
        }
      }

      return res.json({
        success: true,
        conversationId,
        transcription,
        reply: aiResult.reply,
        model: aiResult.model,
        emergency: emergencyResult?.emergency
          ? {
              detected:            true,
              severity:            emergencyResult.severity,
              severityLevel:       emergencyResult.severityLevel,
              score:               emergencyResult.score,
              matchedKeywords:     emergencyResult.matchedKeywords || [],
              action:              emergencyResult.action,
              confirmationMessage: emergencyResult.confirmationMessage || null,
              telegramSent:        emergencyResult.telegramSent || false,
            }
          : null,
      })
    } catch (error) {
      console.error('Voice message error:', error)
      res.status(500).json({ error: error.message || 'Failed to process voice message' })
    }
  }

  // ── POST /api/chatbot/conversation ─────────────────────────────────────────
  static async createConversation(req, res) {
    try {
      if (!ChatbotService.isConfigured()) {
        return res.status(503).json({ success: false, error: 'AI service not configured' })
      }

      const { title, userId } = req.body
      const model = ChatbotService.getConfiguredModel()

      const conversation = await Conversation.create({
        userId:       resolveUserId(userId),
        title:        title || `Chat – ${new Date().toLocaleString()}`,
        status:       'active',
        messageCount: 0,
        aiModel:      model,
        startedAt:    new Date(),
      })

      return res.json({
        success:        true,
        conversationId: conversation._id.toString(),
        model,
        createdAt:      conversation.startedAt,
      })
    } catch (error) {
      console.error('Conversation creation error:', error)
      res.status(500).json({ error: 'Failed to create conversation' })
    }
  }

  // ── GET /api/chatbot/conversation/:conversationId ─────────────────────────
  static async getConversation(req, res) {
    try {
      const { conversationId } = req.params

      if (!mongoose.Types.ObjectId.isValid(conversationId)) {
        return res.status(400).json({ error: 'Invalid conversationId' })
      }

      const conversation = await Conversation.findById(conversationId).lean()
      if (!conversation) {
        return res.status(404).json({ error: 'Conversation not found' })
      }

      return res.json({
        success:        true,
        conversationId: conversation._id.toString(),
        title:          conversation.title,
        status:         conversation.status,
        messageCount:   conversation.messages?.length || 0,
        messages:       conversation.messages || [],
        startedAt:      conversation.startedAt,
      })
    } catch (error) {
      console.error('Get conversation error:', error)
      res.status(500).json({ error: 'Failed to retrieve conversation' })
    }
  }

  // ── GET /api/chatbot/conversations ────────────────────────────────────────
  static async getConversations(req, res) {
    try {
      const conversations = await Conversation.find()
        .sort({ startedAt: -1 })
        .limit(50)
        .select('_id title status messageCount aiModel startedAt messages')
        .lean()

      return res.json({
        success: true,
        total:   conversations.length,
        conversations: conversations.map((c) => {
          const insight = deriveInsight(c.messages || [])
          return {
            id:           c._id.toString(),
            title:        c.title,
            status:       c.status,
            messageCount: c.messages?.length || c.messageCount || 0,
            aiModel:      c.aiModel,
            startedAt:    c.startedAt,
            lastMessage:  c.messages?.length
              ? c.messages[c.messages.length - 1]?.text?.substring(0, 80)
              : null,
            mood:         insight.mood,
            moodColor:    insight.moodColor,
            summary:      insight.summary,
          }
        }),
      })
    } catch (error) {
      console.error('Get conversations error:', error)
      res.status(500).json({ error: 'Failed to retrieve conversations' })
    }
  }
}

module.exports = ChatbotController
