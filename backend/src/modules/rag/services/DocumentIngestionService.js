const fs = require('fs').promises
const path = require('path')
const chromaDB = require('./ChromaDBService')
const chromaConfig = require('../config/chromadb')

/**
 * Document Ingestion Service
 * Handles document processing, chunking, and adding to ChromaDB
 */

class DocumentIngestionService {
  /**
   * Add documents to knowledge base
   * @param {Array} documents - Array of documents {content, metadata}
   */
  static async ingestDocuments(documents) {
    try {
      const collection = chromaDB.getCollection()
      
      const ids = []
      const embeddings = []
      const documents_text = []
      const metadatas = []

      console.log(`\n📥 INGESTING ${documents.length} DOCUMENT(S)...`)

      for (const doc of documents) {
        console.log(`  Processing: ${doc.metadata.source} (${doc.content.length} chars)`)
        
        // Chunk the document
        const chunks = this.chunkText(doc.content)

        for (let i = 0; i < chunks.length; i++) {
          const chunkId = `${doc.metadata.source}_chunk_${i}`
          
          ids.push(chunkId)
          documents_text.push(chunks[i])
          metadatas.push({
            ...doc.metadata,
            chunk_index: i,
            total_chunks: chunks.length,
          })
        }
      }

      // Add to ChromaDB
      console.log(`  Adding ${ids.length} chunks to collection...`)
      await collection.add({
        ids,
        documents: documents_text,
        metadatas,
      })

      console.log(`✅ Ingested ${ids.length} document chunks`)
      return {
        success: true,
        chunksAdded: ids.length,
      }
    } catch (error) {
      console.error('❌ Document ingestion failed:', error.message)
      throw error
    }
  }

  /**
   * Add single document
   * @param {string} content - Document content
   * @param {Object} metadata - Metadata {source, category, tags}
   */
  static async addDocument(content, metadata) {
    return this.ingestDocuments([{ content, metadata }])
  }

  /**
   * Chunk text into smaller pieces, respecting paragraph/section boundaries.
   * Splits on section headers (ALL-CAPS lines, === lines) and double-newlines
   * first, then falls back to sentence splitting if chunks are too large.
   * @param {string} text - Text to chunk
   * @returns {Array} Array of text chunks
   */
  static chunkText(text) {
    const maxChunkSize = chromaConfig.chunkingSettings.chunkSize  // 500
    const overlap = chromaConfig.chunkingSettings.chunkOverlap     // 100

    // Step 1: Split into sections by double-newline or section headers
    const sectionRegex = /\n\s*\n|\n(?=[A-Z][A-Z\s&\-]{3,}:)/g
    const rawSections = text.split(sectionRegex).map(s => s.trim()).filter(Boolean)

    // Step 2: Merge small sections together, split large ones
    const chunks = []
    let buffer = ''

    for (const section of rawSections) {
      // If adding this section exceeds max, flush buffer first
      if (buffer.length > 0 && buffer.length + section.length + 2 > maxChunkSize) {
        chunks.push(buffer.trim())
        // Keep overlap from end of buffer
        buffer = buffer.length > overlap ? buffer.slice(-overlap) : ''
      }

      // If a single section is larger than max, split it by sentences
      if (section.length > maxChunkSize) {
        if (buffer.length > 0) {
          chunks.push(buffer.trim())
          buffer = ''
        }
        // Split long section by sentences/lines
        const lines = section.split(/(?<=\.)\s+|\n/)
        let lineBuffer = ''
        for (const line of lines) {
          if (lineBuffer.length + line.length + 1 > maxChunkSize && lineBuffer.length > 0) {
            chunks.push(lineBuffer.trim())
            lineBuffer = lineBuffer.length > overlap ? lineBuffer.slice(-overlap) : ''
          }
          lineBuffer += (lineBuffer ? '\n' : '') + line
        }
        if (lineBuffer.trim()) {
          buffer = lineBuffer
        }
      } else {
        buffer += (buffer ? '\n\n' : '') + section
      }
    }

    if (buffer.trim()) {
      chunks.push(buffer.trim())
    }

    // Safety: if we ended up with zero chunks, fall back to simple character split
    if (chunks.length === 0) {
      for (let i = 0; i < text.length; i += maxChunkSize - overlap) {
        chunks.push(text.substring(i, i + maxChunkSize))
      }
    }

    return chunks
  }

  /**
   * Load documents from file system
   * @param {string} directory - Directory path with .txt files
   */
  static async loadFromDirectory(directory) {
    try {
      const files = await fs.readdir(directory)
      const documents = []

      for (const file of files) {
        if (file.endsWith('.txt') || file.endsWith('.md')) {
          const filePath = path.join(directory, file)
          const content = await fs.readFile(filePath, 'utf-8')

          documents.push({
            content,
            metadata: {
              source: file,
              category: path.basename(directory),
              date_added: new Date().toISOString(),
              tags: [path.basename(directory)],
            },
          })
        }
      }

      if (documents.length === 0) {
        console.log('⚠️ No documents found in directory:', directory)
        return { success: false, documentsLoaded: 0 }
      }

      return this.ingestDocuments(documents)
    } catch (error) {
      console.error('❌ Failed to load documents:', error.message)
      throw error
    }
  }

  /**
   * Initialize knowledge base with sample documents
   */
  static async initializeSampleData() {
    const sampleDocuments = [
      {
        content: `
          # Elderly Health and Wellness Guide
          
          ## Regular Health Checkups
          Regular health checkups are essential for maintaining good health. It's recommended that seniors have:
          - Annual physical examinations
          - Blood pressure monitoring
          - Cholesterol screening
          - Vision and hearing tests
          
          ## Nutrition Tips for Seniors
          - Eat a balanced diet with plenty of fruits and vegetables
          - Stay hydrated by drinking plenty of water
          - Include lean proteins for muscle health
          - Limit salt and sugar intake
          - Take vitamins as recommended by your doctor
        `,
        metadata: {
          source: 'health-guidelines.txt',
          category: 'health',
          date_added: new Date().toISOString(),
          tags: ['health', 'wellness', 'elderly', 'nutrition'],
        },
      },
      {
        content: `
          # Memory and Cognitive Health
          
          ## Brain Exercises
          Keep your mind sharp with these activities:
          - Reading newspapers and books
          - Playing chess, puzzles, or card games
          - Learning new skills or hobbies
          - Engaging in meaningful conversations
          - Solving crossword puzzles
          - Painting or drawing
          
          ## Social Connections
          Social interaction is crucial for mental health:
          - Join community groups or clubs
          - Spend time with family and friends
          - Participate in group activities
          - Volunteer in your community
          - Take classes or join workshops
        `,
        metadata: {
          source: 'cognitive-health.txt',
          category: 'mental-health',
          date_added: new Date().toISOString(),
          tags: ['mental-health', 'cognitive', 'exercises', 'social'],
        },
      },
      {
        content: `
          # Physical Activity for Seniors
          
          ## Safe Exercise Guidelines
          Before starting any exercise program:
          - Consult with your doctor
          - Start slowly and gradually increase intensity
          - Warm up before exercising
          - Cool down after exercising
          - Stay hydrated during exercise
          
          ## Recommended Activities
          - Walking (30 minutes daily if possible)
          - Swimming or water aerobics
          - Yoga or tai chi for balance and flexibility
          - Light resistance training with proper form
          - Dancing
          - Gardening
          
          ## Fall Prevention
          - Keep floors clear of hazards
          - Ensure good lighting
          - Install grab bars in bathrooms
          - Wear appropriate footwear
          - Consider vision and hearing checks
        `,
        metadata: {
          source: 'physical-activity.txt',
          category: 'fitness',
          date_added: new Date().toISOString(),
          tags: ['fitness', 'exercise', 'safety', 'health'],
        },
      },
      {
        content: `
          # Sleep Tips for Seniors
          
          ## Healthy Sleep Habits
          - Maintain a consistent sleep schedule
          - Create a comfortable sleep environment
          - Keep bedroom cool, dark, and quiet
          - Avoid screens 1 hour before bedtime
          - Limit caffeine intake
          - Avoid heavy meals before sleeping
          
          ## Sleep Disorders
          Common sleep issues in seniors:
          - Insomnia
          - Sleep apnea
          - Restless leg syndrome
          
          Consult a doctor if sleep problems persist.
        `,
        metadata: {
          source: 'sleep-guide.txt',
          category: 'wellness',
          date_added: new Date().toISOString(),
          tags: ['sleep', 'wellness', 'rest', 'health'],
        },
      },
      {
        content: `
          # Family Relationships and Communication
          
          ## Building Strong Family Bonds
          Family relationships are essential for emotional well-being:
          - Schedule regular family calls and visits
          - Share stories and memories with grandchildren
          - Plan family gatherings and celebrations
          - Create new traditions with loved ones
          - Express love and appreciation to family members
          
          ## Technology for Family Connection
          Stay connected with family using:
          - Video calling apps (WhatsApp, Zoom, FaceTime)
          - Email and messaging
          - Social media to see family updates
          - Family group chats to stay in touch
          
          ## Extended Family Care
          Maintaining relationships with:
          - Grandchildren - spend quality time, listen to their stories
          - Adult children - share your wisdom and experience
          - Siblings and cousins - organize reunions
          - In-laws - foster positive relationships
          - Close family friends - maintain these valuable connections
        `,
        metadata: {
          source: 'family-relationships.txt',
          category: 'family',
          date_added: new Date().toISOString(),
          tags: ['family', 'relationships', 'communication', 'social'],
        },
      },
      {
        content: `
          # Caregiving: For and From Family Members
          
          ## When Your Family Provides Care
          - Communicate your needs clearly and appreciatively
          - Maintain independence in activities you can do
          - Respect caregivers' time and effort
          - Have regular conversations about care preferences
          - Express gratitude regularly
          
          ## Family Caregiving Support
          If you're caring for a family member:
          - Take regular breaks to prevent burnout
          - Ask other family members for help
          - Stay organized with medical records and schedules
          - Learn about available resources and support groups
          - Don't hesitate to seek professional help
          
          ## Multi-Generational Households
          Living with family members:
          - Establish clear routines and expectations
          - Respect each other's privacy and space
          - Have regular family meetings
          - Share household responsibilities fairly
          - Celebrate together and support during challenges
        `,
        metadata: {
          source: 'caregiving-family.txt',
          category: 'family',
          date_added: new Date().toISOString(),
          tags: ['family', 'caregiving', 'relationships', 'support'],
        },
      },
      {
        content: `
          # Legacy, Grandparenting and Passing on Wisdom
          
          ## The Role of Grandparents
          As a grandparent, you can:
          - Share family history and cultural traditions
          - Provide unconditional love and support
          - Teach life lessons through stories and experiences
          - Be a mentor and role model
          - Create lasting memories
          
          ## Passing Down Family Values
          How to transmit values to younger generations:
          - Tell family stories and traditions
          - Share recipes and prepare meals together
          - Teach crafts, gardening, or other hobbies
          - Discuss family principles and beliefs
          - Set a good example through your actions
          
          ## Creating a Legacy
          Something for future generations:
          - Write a family memoir or journal
          - Record audio/video messages
          - Organize old photographs with stories
          - Create a family tree
          - Donate to causes you believe in
          - Share life advice and wisdom
          - Leave a letter for grandchildren to open later
        `,
        metadata: {
          source: 'grandparenting-legacy.txt',
          category: 'family',
          date_added: new Date().toISOString(),
          tags: ['family', 'grandparenting', 'legacy', 'wisdom'],
        },
      },
      {
        content: `
          # Managing Family Finances and Planning
          
          ## Financial Planning for Seniors
          Important financial considerations:
          - Keep organized records of all accounts
          - Create or update your will and living will
          - Discuss financial plans with family
          - Plan for healthcare costs
          - Review insurance policies regularly
          
          ## Involving Family in Financial Decisions
          - Inform trusted family members about accounts
          - Choose a financial power of attorney
          - Keep important documents in safe place
          - Discuss inheritance with family
          - Consider family meetings about finances
          
          ## Estate Planning Basics
          Planning for future generations:
          - Identify what you want to leave behind
          - Organize important documents and passwords
          - Consider tax implications
          - Update beneficiaries on insurance/retirement
          - Ensure someone knows where records are kept
          - Consult with a lawyer or financial advisor
        `,
        metadata: {
          source: 'family-financial-planning.txt',
          category: 'family',
          date_added: new Date().toISOString(),
          tags: ['family', 'finances', 'planning', 'estate'],
        },
      },
    ]

    return this.ingestDocuments(sampleDocuments)
  }
}

module.exports = DocumentIngestionService