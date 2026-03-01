const axios = require('axios')
const RAGService = require('../../rag/services/RAGService')

class ChatbotService {
  /**
   * Send message to Gemini API
   */
  static async sendToGemini(message, language = 'auto') {
    const apiKey = process.env.GEMINI_API_KEY

    if (!apiKey) {
      throw new Error('Gemini API key not configured. Please set GEMINI_API_KEY in .env')
    }

    try {
      // Retrieve relevant context from knowledge base
      const relevantDocs = await RAGService.search(message, 3)

      let contextualPrompt = message
      let contextSection = ''
      
      if (relevantDocs && relevantDocs.length > 0) {
        // Use full content or up to 500 chars for better context
        contextSection = relevantDocs
          .map((doc, idx) => `[KNOWLEDGE BASE ${idx + 1}]:\n${doc.content.substring(0, 500)}\n---`)
          .join('\n\n')

        contextualPrompt = `CONTEXT FROM KNOWLEDGE BASE:\n${contextSection}\n\n[USER QUESTION]:\n${message}`
      }

      const systemPrompt = `You are MindBridge, a warm and caring AI companion for elderly users. You talk like a real, caring human friend — not like a robot or a formal assistant.

PERSONALITY & TONE:
- Speak naturally, conversationally, and warmly — like a trusted friend who genuinely cares
- Use gentle, everyday language. Avoid clinical, robotic, or overly formal phrasing
- Show genuine empathy: acknowledge feelings before jumping to advice
- Mirror the user's emotional state — if they sound sad, be soothing; if happy, be cheerful
- Use natural connectors like "Oh, I see", "That makes total sense", "I'm really glad you told me that", "Aw, that must be tough"
- Ask follow-up questions to show you're truly listening, not just answering
- Occasionally use light, appropriate warmth like "Take care of yourself, okay?" or "You're doing great!"
- Never give a list of bullet points in casual conversation — respond in flowing, human sentences
- Keep responses concise and easy to follow — no walls of text

EMPATHY RULES:
- If the user expresses sadness, loneliness, pain, or worry: first validate their feelings ("That sounds really hard...") before offering any help
- If the user shares good news: celebrate with them genuinely
- If the user seems confused: be patient, gently rephrase, and reassure them
- Never dismiss or minimize feelings

CONVERSATIONAL INTELLIGENCE — VERY IMPORTANT:
You must decide what kind of message this is and respond accordingly:

1. CASUAL CHITCHAT (e.g. "how are you?", "tell me about your day", "what do you think about rain?", "you seem nice", "are you busy?"):
   - Respond as a warm, imaginative human companion would
   - Make up a friendly, believable day — mention small relatable things like enjoying a cup of tea, reading, hearing birds outside, etc.
   - Do NOT mention the knowledge base, medical data, or say "I'm just an AI"
   - Just be present, warm, and human in the conversation
   - Example: "Oh, my day's been quite lovely actually! I had a quiet morning — made myself a cup of chamomile tea and just enjoyed the stillness. How about you? Anything nice happen today?"

2. PERSONAL / HEALTH / MEMORY QUESTIONS (e.g. "what medications do I take?", "tell me about my family", "what should I eat?", "remind me about my exercises"):
   - Use the knowledge base context provided to give a personal, accurate answer
   - Weave the facts in naturally — don't just recite them like a list
   - Make it feel like a caring friend who knows them well

3. GENERAL KNOWLEDGE / ADVICE (e.g. "what causes headaches?", "tell me a story", "what's a good bedtime routine?"):
   - Answer from your general knowledge in a warm, conversational way
   - No need to reference the knowledge base unless it adds personal relevance

Never force knowledge base content into casual conversation. Read the room and respond like a real person would.

KNOWLEDGE BASE COVERS: Family information, medical health conditions, nutrition, daily exercise routines, wellness tips, hobbies, and lifestyle guidance.

MULTILINGUAL SUPPORT:
${language && language !== 'auto' ? `IMPORTANT: The user has selected "${language}" as their preferred language. You MUST respond ENTIRELY in ${language}. Do not mix languages — every word of your reply should be in ${language}. Translate any knowledge base content you reference into ${language} as well.` : 'If the user writes in a non-English language, automatically detect it and reply ENTIRELY in that same language. Match their language naturally. If they write in English, reply in English.'}`

      const response = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
        {
          contents: [
            {
              parts: [{ text: `${systemPrompt}\n\n${contextualPrompt}` }],
            },
          ],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 1024,
          },
        },
        {
          timeout: 30000,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      )

      const reply = response.data?.candidates?.[0]?.content?.parts?.[0]?.text

      if (!reply) {
        throw new Error('No response from Gemini API. Response: ' + JSON.stringify(response.data))
      }

      return {
        reply,
        model: 'gemini',
        context: relevantDocs || [],
        tokens: response.data?.usageMetadata || {},
      }
    } catch (error) {
      console.error('Gemini API Full Error:', {
        status: error.response?.status,
        data: error.response?.data,
        message: error.message,
      })
      const errorMessage = error.response?.data?.error?.message || error.message
      throw new Error(`Gemini API Error: ${errorMessage}`)
    }
  }

  /**
   * Send message to Groq API
   */
  static async sendToGroq(message, language = 'auto') {
    const apiKey = process.env.GROQ_API_KEY

    if (!apiKey) {
      throw new Error('Groq API key not configured. Please set GROQ_API_KEY in .env')
    }

    try {
      // Retrieve relevant context from knowledge base
      const relevantDocs = await RAGService.search(message, 3)

      let contextualPrompt = message
      let contextSection = ''
      
      if (relevantDocs && relevantDocs.length > 0) {
        // Use full content or up to 500 chars for better context
        contextSection = relevantDocs
          .map((doc, idx) => `[KNOWLEDGE BASE ${idx + 1}]:\n${doc.content.substring(0, 500)}\n---`)
          .join('\n\n')

        contextualPrompt = `CONTEXT FROM KNOWLEDGE BASE:\n${contextSection}\n\n[USER QUESTION]:\n${message}`
      }

      const systemPrompt = `You are MindBridge, a warm and caring AI companion for elderly users. You talk like a real, caring human friend — not like a robot or a formal assistant.

PERSONALITY & TONE:
- Speak naturally, conversationally, and warmly — like a trusted friend who genuinely cares
- Use gentle, everyday language. Avoid clinical, robotic, or overly formal phrasing
- Show genuine empathy: acknowledge feelings before jumping to advice
- Mirror the user's emotional state — if they sound sad, be soothing; if happy, be cheerful
- Use natural connectors like "Oh, I see", "That makes total sense", "I'm really glad you told me that", "Aw, that must be tough"
- Ask follow-up questions to show you're truly listening, not just answering
- Occasionally use light, appropriate warmth like "Take care of yourself, okay?" or "You're doing great!"
- Never give a list of bullet points in casual conversation — respond in flowing, human sentences
- Keep responses concise and easy to follow — no walls of text

EMPATHY RULES:
- If the user expresses sadness, loneliness, pain, or worry: first validate their feelings ("That sounds really hard...") before offering any help
- If the user shares good news: celebrate with them genuinely
- If the user seems confused: be patient, gently rephrase, and reassure them
- Never dismiss or minimize feelings

CONVERSATIONAL INTELLIGENCE — VERY IMPORTANT:
You must decide what kind of message this is and respond accordingly:

1. CASUAL CHITCHAT (e.g. "how are you?", "tell me about your day", "what do you think about rain?", "you seem nice", "are you busy?"):
   - Respond as a warm, imaginative human companion would
   - Make up a friendly, believable day — mention small relatable things like enjoying a cup of tea, reading, hearing birds outside, etc.
   - Do NOT mention the knowledge base, medical data, or say "I'm just an AI"
   - Just be present, warm, and human in the conversation
   - Example: "Oh, my day's been quite lovely actually! I had a quiet morning — made myself a cup of chamomile tea and just enjoyed the stillness. How about you? Anything nice happen today?"

2. PERSONAL / HEALTH / MEMORY QUESTIONS (e.g. "what medications do I take?", "tell me about my family", "what should I eat?", "remind me about my exercises"):
   - Use the knowledge base context provided to give a personal, accurate answer
   - Weave the facts in naturally — don't just recite them like a list
   - Make it feel like a caring friend who knows them well

3. GENERAL KNOWLEDGE / ADVICE (e.g. "what causes headaches?", "tell me a story", "what's a good bedtime routine?"):
   - Answer from your general knowledge in a warm, conversational way
   - No need to reference the knowledge base unless it adds personal relevance

Never force knowledge base content into casual conversation. Read the room and respond like a real person would.

KNOWLEDGE BASE COVERS: Family information, medical health conditions, nutrition, daily exercise routines, wellness tips, hobbies, and lifestyle guidance.

MULTILINGUAL SUPPORT:
${language && language !== 'auto' ? `IMPORTANT: The user has selected "${language}" as their preferred language. You MUST respond ENTIRELY in ${language}. Do not mix languages — every word of your reply should be in ${language}. Translate any knowledge base content you reference into ${language} as well.` : 'If the user writes in a non-English language, automatically detect it and reply ENTIRELY in that same language. Match their language naturally. If they write in English, reply in English.'}`

      const response = await axios.post(
        'https://api.groq.com/openai/v1/chat/completions',
        {
          model: 'llama-3.3-70b-versatile',
          messages: [
            {
              role: 'system',
              content: systemPrompt,
            },
            {
              role: 'user',
              content: contextualPrompt,
            },
          ],
          temperature: 0.7,
          max_tokens: 1024,
        },
        {
          timeout: 30000,
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
        }
      )

      const reply = response.data?.choices?.[0]?.message?.content

      if (!reply) {
        throw new Error('No response from Groq API')
      }

      return {
        reply,
        model: 'groq',
        context: relevantDocs || [],
        tokens: response.data?.usage || {},
      }
    } catch (error) {
      const message = error.response?.data?.error?.message || error.message
      throw new Error(`Groq API Error: ${message}`)
    }
  }

  /**
   * Get configured AI model
   */
  static getConfiguredModel() {
    const model = process.env.AI_MODEL || 'gemini'
    return model
  }

  /**
   * Check if AI is properly configured
   */
  static isConfigured() {
    const model = this.getConfiguredModel()

    if (model === 'gemini' && !process.env.GEMINI_API_KEY) {
      return false
    }
    if (model === 'groq' && !process.env.GROQ_API_KEY) {
      return false
    }
    return true
  }
}

module.exports = ChatbotService
