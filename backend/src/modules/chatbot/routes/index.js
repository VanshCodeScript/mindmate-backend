const express = require('express')
const ChatbotController = require('../controllers/ChatbotController')

const router = express.Router()

/** POST /api/chatbot/send – Send a text message */
router.post('/send', ChatbotController.sendMessage)

/** POST /api/chatbot/voice – Send a voice message */
router.post('/voice', ChatbotController.sendVoiceMessage)

/** POST /api/chatbot/conversation – Create a new conversation */
router.post('/conversation', ChatbotController.createConversation)

/** GET /api/chatbot/conversations – List all conversations */
router.get('/conversations', ChatbotController.getConversations)

/** GET /api/chatbot/conversation/:conversationId – Get one conversation with messages */
router.get('/conversation/:conversationId', ChatbotController.getConversation)

module.exports = router

