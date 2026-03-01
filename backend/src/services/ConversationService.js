const Conversation = require('../models/Conversation');
const mongoose = require('mongoose');

/**
 * Conversation Service
 * Handles saving and retrieving conversations from MongoDB
 */
class ConversationService {
  /**
   * Create a new conversation
   * @param {string} userId - User ID (optional, for anonymous chats)
   * @param {object} data - Conversation data
   * @returns {Promise<Conversation>} Created conversation
   */
  static async createConversation(userId, data = {}) {
    try {
      // Convert userId to ObjectId if it's a valid string
      let convertedUserId = null;
      if (userId && userId !== 'anonymous') {
        if (mongoose.Types.ObjectId.isValid(userId)) {
          convertedUserId = new mongoose.Types.ObjectId(userId);
        } else {
          console.warn(`⚠️ Invalid userId format: ${userId}, creating anonymous conversation`);
        }
      }

      const conversation = new Conversation({
        userId: convertedUserId,
        title: data.title || `Chat - ${new Date().toLocaleString()}`,
        summary: data.summary || '',
        messages: [],
        status: 'active',
        messageCount: 0,
        aiModel: data.aiModel || process.env.AI_MODEL || 'groq',
        ...data,
      });

      await conversation.save();
      console.log(`✅ Conversation created: ${conversation._id}`);
      return conversation;
    } catch (error) {
      console.error('❌ Error creating conversation:', error);
      throw error;
    }
  }

  /**
   * Get conversation by ID
   * @param {string} conversationId - Conversation ID
   * @returns {Promise<Conversation>} Conversation document
   */
  static async getConversation(conversationId) {
    try {
      if (!mongoose.Types.ObjectId.isValid(conversationId)) {
        return null;
      }

      const conversation = await Conversation.findById(conversationId);
      return conversation;
    } catch (error) {
      console.error('❌ Error getting conversation:', error);
      return null;
    }
  }

  /**
   * Add message to conversation
   * @param {string} conversationId - Conversation ID
   * @param {object} message - Message object
   * @returns {Promise<Conversation>} Updated conversation
   */
  static async addMessage(conversationId, message) {
    try {
      if (!mongoose.Types.ObjectId.isValid(conversationId)) {
        throw new Error('Invalid conversation ID');
      }

      const conversation = await Conversation.findById(conversationId);
      if (!conversation) {
        throw new Error('Conversation not found');
      }

      // Ensure required fields
      if (!message.sender || !message.text) {
        throw new Error('Message must have sender and text');
      }

      // Add timestamp if not provided
      if (!message.timestamp) {
        message.timestamp = new Date();
      }

      // Add message to conversation
      conversation.messages.push(message);
      conversation.messageCount = conversation.messages.length;

      // Update ended time for AI messages
      if (message.sender === 'ai' && !conversation.endedAt) {
        conversation.endedAt = new Date();
        conversation.duration = Math.round(
          (conversation.endedAt - conversation.startedAt) / 60000
        ); // in minutes
      }

      await conversation.save();
      console.log(`✅ Message added to conversation: ${conversationId}`);
      return conversation;
    } catch (error) {
      console.error('❌ Error adding message:', error);
      throw error;
    }
  }

  /**
   * Save full conversation with user and AI messages
   * Useful for batch saving
   * @param {string} conversationId - Conversation ID
   * @param {object} userMessage - User message object
   * @param {object} aiMessage - AI response object
   * @returns {Promise<Conversation>} Updated conversation
   */
  static async saveMessagePair(conversationId, userMessage, aiMessage) {
    try {
      let conversation = await this.getConversation(conversationId);

      // Create new conversation if doesn't exist
      if (!conversation) {
        conversation = await this.createConversation(null, {
          title: `Chat - ${new Date().toLocaleString()}`,
        });
        conversationId = conversation._id;
      }

      // Add user message
      await this.addMessage(conversationId, {
        sender: 'user',
        text: userMessage.text,
        audioUrl: userMessage.audioUrl,
        audioPublicId: userMessage.audioPublicId,
        mood: userMessage.mood,
        sentiment: userMessage.sentiment,
        timestamp: userMessage.timestamp || new Date(),
      });

      // Add AI message with RAG context
      await this.addMessage(conversationId, {
        sender: 'ai',
        text: aiMessage.reply,
        ragContext: aiMessage.context || [],
        model: aiMessage.model,
        tokensUsed: aiMessage.tokens,
        sentiment: aiMessage.sentiment,
        timestamp: aiMessage.timestamp || new Date(),
      });

      return await this.getConversation(conversationId);
    } catch (error) {
      console.error('❌ Error saving message pair:', error);
      throw error;
    }
  }

  /**
   * Get all conversations for a user
   * @param {string} userId - User ID (optional, for anonymous chats use null)
   * @param {object} options - Query options
   * @returns {Promise<Array>} Array of conversations
   */
  static async getUserConversations(userId, options = {}) {
    try {
      const {
        limit = 20,
        skip = 0,
        status = 'active',
        sort = '-startedAt', // Most recent first
      } = options;

      const query = {};

      // Handle userId filtering
      if (userId && userId !== 'anonymous') {
        if (mongoose.Types.ObjectId.isValid(userId)) {
          query.userId = new mongoose.Types.ObjectId(userId);
        }
        // If invalid ObjectId but not anonymous, search all (graceful fallback)
      }
      // For 'anonymous' or null userId, return all anonymous conversations (no userId filter)

      if (status) {
        query.status = status;
      }

      const conversations = await Conversation.find(query)
        .sort(sort)
        .limit(limit)
        .skip(skip)
        .select('title summary messageCount status startedAt endedAt duration aiModel');

      const total = await Conversation.countDocuments(query);

      return {
        conversations,
        total,
        limit,
        skip,
        pages: Math.ceil(total / limit),
      };
    } catch (error) {
      console.error('❌ Error getting user conversations:', error);
      throw error;
    }
  }

  /**
   * Archive a conversation
   * @param {string} conversationId - Conversation ID
   * @returns {Promise<Conversation>} Updated conversation
   */
  static async archiveConversation(conversationId) {
    try {
      const conversation = await Conversation.findByIdAndUpdate(
        conversationId,
        {
          status: 'archived',
          endedAt: new Date(),
        },
        { new: true }
      );

      if (conversation) {
        console.log(`✅ Conversation archived: ${conversationId}`);
      }
      return conversation;
    } catch (error) {
      console.error('❌ Error archiving conversation:', error);
      throw error;
    }
  }

  /**
   * Delete a conversation
   * @param {string} conversationId - Conversation ID
   * @returns {Promise<boolean>} Success status
   */
  static async deleteConversation(conversationId) {
    try {
      const result = await Conversation.findByIdAndDelete(conversationId);
      if (result) {
        console.log(`✅ Conversation deleted: ${conversationId}`);
        return true;
      }
      return false;
    } catch (error) {
      console.error('❌ Error deleting conversation:', error);
      throw error;
    }
  }

  /**
   * Get conversation analytics
   * @param {string} conversationId - Conversation ID
   * @returns {Promise<object>} Analytics data
   */
  static async getConversationAnalytics(conversationId) {
    try {
      const conversation = await this.getConversation(conversationId);
      if (!conversation) {
        return null;
      }

      const userMessages = conversation.messages.filter((m) => m.sender === 'user');
      const aiMessages = conversation.messages.filter((m) => m.sender === 'ai');

      // Calculate sentiments
      const sentiments = {
        positive: userMessages.filter((m) => m.sentiment === 'positive').length,
        neutral: userMessages.filter((m) => m.sentiment === 'neutral').length,
        negative: userMessages.filter((m) => m.sentiment === 'negative').length,
      };

      // Calculate tokens used
      let totalTokens = 0;
      aiMessages.forEach((msg) => {
        if (msg.tokensUsed && msg.tokensUsed.total) {
          totalTokens += msg.tokensUsed.total;
        }
      });

      return {
        messageCount: conversation.messageCount,
        userMessages: userMessages.length,
        aiMessages: aiMessages.length,
        duration: conversation.duration,
        sentiments,
        totalTokensUsed: totalTokens,
        aiModel: conversation.aiModel,
        startedAt: conversation.startedAt,
        endedAt: conversation.endedAt,
      };
    } catch (error) {
      console.error('❌ Error getting conversation analytics:', error);
      throw error;
    }
  }

  /**
   * Search conversations
   * @param {string} userId - User ID
   * @param {string} searchText - Search text
   * @param {object} options - Query options
   * @returns {Promise<Array>} Matching conversations
   */
  static async searchConversations(userId, searchText, options = {}) {
    try {
      const { limit = 10, skip = 0 } = options;

      const conversations = await Conversation.find(
        {
          userId,
          $or: [
            { title: { $regex: searchText, $options: 'i' } },
            { summary: { $regex: searchText, $options: 'i' } },
            { 'messages.text': { $regex: searchText, $options: 'i' } },
          ],
        },
        {
          title: 1,
          summary: 1,
          messageCount: 1,
          startedAt: 1,
          aiModel: 1,
          messages: { $slice: 2 }, // Only first 2 messages for preview
        }
      )
        .sort('-startedAt')
        .limit(limit)
        .skip(skip);

      return conversations;
    } catch (error) {
      console.error('❌ Error searching conversations:', error);
      throw error;
    }
  }

  /**
   * Update conversation metadata
   * @param {string} conversationId - Conversation ID
   * @param {object} updates - Metadata updates
   * @returns {Promise<Conversation>} Updated conversation
   */
  static async updateConversationMetadata(conversationId, updates) {
    try {
      const conversation = await Conversation.findByIdAndUpdate(
        conversationId,
        updates,
        { new: true }
      );

      if (conversation) {
        console.log(`✅ Conversation metadata updated: ${conversationId}`);
      }
      return conversation;
    } catch (error) {
      console.error('❌ Error updating conversation metadata:', error);
      throw error;
    }
  }
}

module.exports = ConversationService;
