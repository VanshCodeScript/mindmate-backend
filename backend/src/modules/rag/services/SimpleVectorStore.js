const fs = require('fs').promises
const path = require('path')
const { env, AutoTokenizer, AutoModel } = require('@xenova/transformers')

// Store model and tokenizer globally to avoid reloading
let model = null
let tokenizer = null
let embeddingCache = {}

/**
 * Simple Vector Store with Transformer Embeddings
 * Uses all-MiniLM-L6-v2 for lightweight semantic search
 */
class SimpleVectorStore {
  constructor(filePath) {
    this.filePath = filePath
    this.documents = []
    this.embeddings = {}
  }

  /**
   * Initialize embeddings model
   */
  static async initializeModel() {
    if (model && tokenizer) return

    try {
      console.log('🔄 Loading transformer model (all-MiniLM-L6-v2)...')
      env.allowLocalModels = false // Use HuggingFace cache
      env.cacheDir = path.join(process.cwd(), '.cache', 'transformers')
      
      // Use lightweight all-MiniLM-L6-v2 model
      tokenizer = await AutoTokenizer.from_pretrained('Xenova/all-MiniLM-L6-v2')
      model = await AutoModel.from_pretrained('Xenova/all-MiniLM-L6-v2', {
        quantized: true, // Use quantized version for speed
      })
      
      console.log('✅ Transformer model loaded successfully')
    } catch (error) {
      console.error('❌ Failed to load transformer model:', error.message)
      throw error
    }
  }

  /**
   * Generate embedding for text using proper mean pooling
   */
  static async getEmbedding(text) {
    if (!model || !tokenizer) {
      await this.initializeModel()
    }

    // Check cache first
    if (embeddingCache[text]) {
      return embeddingCache[text]
    }

    try {
      // Tokenize input
      const tokens = tokenizer(text, {
        padding: true,
        truncation: true,
        max_length: 512,
      })

      // Generate embeddings
      const output = await model(tokens)
      const lastHidden = output.last_hidden_state
      const dims = lastHidden.dims              // [1, seqLen, 384]
      const seqLen = dims[1]
      const hiddenSize = dims[2]                // 384
      const attentionMask = tokens.attention_mask

      // Mean pooling: average all non-padding token embeddings
      const pooled = new Float64Array(hiddenSize)
      let tokenCount = 0
      for (let t = 0; t < seqLen; t++) {
        // attention_mask can be BigInt (1n) or Number (1)
        const maskVal = Number(attentionMask.data[t])
        if (maskVal === 1) {
          for (let j = 0; j < hiddenSize; j++) {
            pooled[j] += lastHidden.data[t * hiddenSize + j]
          }
          tokenCount++
        }
      }
      if (tokenCount > 0) {
        for (let j = 0; j < hiddenSize; j++) {
          pooled[j] /= tokenCount
        }
      }

      // L2-normalize
      const embedding = Array.from(pooled)
      const norm = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0))
      const normalized = embedding.map(val => val / (norm || 1))

      // Cache it
      embeddingCache[text] = normalized
      
      // Debug log first embedding
      if (Object.keys(embeddingCache).length === 1) {
        console.log(`[EMBEDDING DEBUG] First embedding for "${text.substring(0, 30)}...": norm=${norm.toFixed(4)}, dims=${normalized.length}, tokens=${tokenCount}`)
        console.log(`  First 5 values: [${normalized.slice(0, 5).map(v => v.toFixed(4)).join(', ')}]`)
      }

      return normalized
    } catch (error) {
      console.error('Error generating embedding:', error.message)
      throw error
    }
  }

  /**
   * Calculate cosine similarity between two embeddings
   */
  static cosineSimilarity(a, b) {
    if (!a || !b || a.length !== b.length) {
      console.warn(`[SIM DEBUG] Invalid embeddings: a=${a?.length}, b=${b?.length}`)
      return 0
    }

    let dotProduct = 0
    let normA = 0
    let normB = 0

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i]
      normA += a[i] * a[i]
      normB += b[i] * b[i]
    }

    const denominator = Math.sqrt(normA) * Math.sqrt(normB)
    if (denominator === 0) {
      console.warn(`[SIM DEBUG] Zero denominator: normA=${normA}, normB=${normB}`)
      return 0
    }

    return dotProduct / denominator
  }

  /**
   * Initialize store from file
   */
  async initialize() {
    try {
      // Load transformer model
      await SimpleVectorStore.initializeModel()

      const dir = path.dirname(this.filePath)
      await fs.mkdir(dir, { recursive: true })

      if (await this.fileExists(this.filePath)) {
        console.log('📂 Loading existing vector store...')
        const data = await fs.readFile(this.filePath, 'utf-8')
        const parsed = JSON.parse(data)
        this.documents = parsed.documents || []
        this.embeddings = parsed.embeddings || {}
        
        // Validate embeddings
        const docsWithEmbeddings = this.documents.filter(d => d.embedding && d.embedding.length > 0).length
        console.log(`   Loaded: ${this.documents.length} documents, ${docsWithEmbeddings} with embeddings`)
        
        if (docsWithEmbeddings < this.documents.length * 0.5 && this.documents.length > 0) {
          console.log('⚠️  WARNING: >50% documents missing embeddings - clearing store')
          this.documents = []
          this.embeddings = {}
        }
      } else {
        console.log('📂 No existing vector store found - will create new one')
      }
    } catch (error) {
      console.error('Error initializing vector store:', error.message)
      this.documents = []
      this.embeddings = {}
    }
  }

  /**
   * Check if file exists
   */
  async fileExists(filePath) {
    try {
      await fs.access(filePath)
      return true
    } catch {
      return false
    }
  }

  /**
   * Save store to file
   */
  async save() {
    try {
      const dir = path.dirname(this.filePath)
      await fs.mkdir(dir, { recursive: true })
      
      const data = {
        documents: this.documents,
        embeddings: this.embeddings,
      }
      
      await fs.writeFile(this.filePath, JSON.stringify(data, null, 2))
    } catch (error) {
      console.error('Error saving vector store:', error.message)
    }
  }

  /**
   * Add documents to store with embeddings
   */
  async add(ids, documents, metadatas) {
    console.log(`\n[ADD DEBUG] Starting to add ${ids.length} documents`)
    let successCount = 0
    let failCount = 0

    for (let i = 0; i < ids.length; i++) {
      // Generate embedding for document
      let embedding = null
      try {
        embedding = await SimpleVectorStore.getEmbedding(documents[i])
        successCount++
        
        if (i < 2) {
          console.log(`  [ADD ${i}] "${ids[i]}": embedding generated, dims=${embedding?.length}`)
        }
      } catch (error) {
        failCount++
        console.warn(`  [ADD ${i}] Failed to embed "${ids[i]}":`, error.message)
      }

      this.documents.push({
        id: ids[i],
        content: documents[i],
        metadata: metadatas[i],
        embedding: embedding,
      })

      if (embedding) {
        this.embeddings[ids[i]] = embedding
      }
    }

    console.log(`[ADD DEBUG] Completed: ${successCount} success, ${failCount} failed`)
    await this.save()
  }

  /**
   * Keyword-based search as fallback
   */
  async keywordSearch(query, nResults = 5) {
    const queryLower = query.toLowerCase()
    const queryWords = queryLower.split(/\s+/).filter(w => w.length > 2)

    const scored = this.documents.map((doc) => {
      const contentLower = doc.content.toLowerCase()
      let score = 0

      // Count keyword matches using word boundaries (whole-word match)
      let matches = 0
      for (const word of queryWords) {
        // Use word boundary regex to avoid "child" matching "grandchildren"
        const wordRegex = new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i')
        if (wordRegex.test(contentLower)) {
          matches++
          // Boost score if word is near start of content
          const idx = contentLower.search(wordRegex)
          if (idx >= 0 && idx < 300) {
            score += 0.15
          } else {
            score += 0.1
          }
        }
      }

      // Proportion of query words matched (rewards covering more of the query)
      if (queryWords.length > 0) {
        score *= (matches / queryWords.length)
      }

      // Tag matching
      if (doc.metadata?.tags) {
        for (const tag of doc.metadata.tags) {
          if (queryWords.some(w => tag.toLowerCase().includes(w))) {
            score += 0.1
          }
        }
      }

      // Category matching
      if (doc.metadata?.category && queryWords.some(w => 
        doc.metadata.category.toLowerCase().includes(w)
      )) {
        score += 0.1
      }

      const clampedScore = Math.min(0.8, score) // Keyword-only can never be 1.0
      return {
        ...doc,
        keywordScore: clampedScore,
      }
    })

    return scored
      .filter(r => r.keywordScore > 0.05)
      .sort((a, b) => b.keywordScore - a.keywordScore)
      .slice(0, nResults)
  }

  /**
   * Hybrid query: semantic + keyword search with result merging
   */
  async hybridQuery(queryTexts, nResults = 5) {
    const query = queryTexts[0] || ''

    // Semantic search
    let semanticResults = []
    let queryEmbedding = null
    try {
      queryEmbedding = await SimpleVectorStore.getEmbedding(query)
      
      console.log(`\n[DEBUG] Query embedding generated (${queryEmbedding ? queryEmbedding.length : 0} dims)`)
      console.log(`[DEBUG] Total documents in store: ${this.documents.length}`)
      
      const scored = this.documents.map((doc) => {
        let similarity = 0
        if (doc.embedding && queryEmbedding) {
          similarity = SimpleVectorStore.cosineSimilarity(doc.embedding, queryEmbedding)
        }
        return { ...doc, similarity, distance: 1 - similarity }
      })
      
      // Sort and log top 5 for debugging
      const sorted = scored.sort((a, b) => b.similarity - a.similarity)
      console.log(`[DEBUG] Top 5 similarity scores:`)
      sorted.slice(0, 5).forEach((r, i) => {
        console.log(`  ${i+1}. "${r.metadata?.source}" (chunk ${r.metadata?.chunk_index}): ${(r.similarity*100).toFixed(2)}% - "${r.content.substring(0, 50).replace(/\n/g, ' ')}..."`)
      })

      semanticResults = sorted
        .filter(r => r.similarity > 0.15) // Lower threshold for semantic
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, nResults * 2) // Get more for merging
    } catch (error) {
      console.warn('Semantic search failed:', error.message)
    }

    // Keyword search fallback
    const keywordResults = await this.keywordSearch(query, nResults * 2)

    // Merge results by ID, combining semantic + keyword scores
    const resultMap = new Map()

    // Add semantic results (store semantic similarity separately)
    semanticResults.forEach(doc => {
      resultMap.set(doc.id, {
        id: doc.id,
        content: doc.content,
        metadata: doc.metadata,
        semanticSim: doc.similarity,
        keywordScore: 0,
        score: doc.similarity * 0.7, // Semantic weight
      })
    })

    // Add/enhance with keyword results
    keywordResults.forEach(doc => {
      if (resultMap.has(doc.id)) {
        // Combine scores: add keyword component
        const existing = resultMap.get(doc.id)
        existing.keywordScore = doc.keywordScore
        existing.score = (existing.semanticSim * 0.7) + (doc.keywordScore * 0.3)
      } else {
        // Keyword-only result (no semantic match)
        resultMap.set(doc.id, {
          id: doc.id,
          content: doc.content,
          metadata: doc.metadata,
          semanticSim: 0,
          keywordScore: doc.keywordScore,
          score: doc.keywordScore * 0.3, // Keyword-only weight
        })
      }
    })

    // Sort by combined score and return top results
    const results = Array.from(resultMap.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, nResults)

    console.log(`[HYBRID DEBUG] Final top ${results.length} results:`)
    results.forEach((r, i) => {
      console.log(`  ${i+1}. "${r.metadata?.source}" chunk=${r.metadata?.chunk_index} | sem=${r.semanticSim.toFixed(3)} kw=${r.keywordScore.toFixed(3)} combined=${r.score.toFixed(3)}`)
    })

    return {
      ids: [results.map((r) => r.id)],
      documents: [results.map((r) => r.content)],
      distances: [results.map((r) => 1 - r.score)], // Distance = 1 - combined score
      metadatas: [results.map((r) => r.metadata)],
    }
  }

  /**
   * Query documents by semantic similarity
   */
  async query(queryTexts, nResults = 5) {
    // Use hybrid search instead of semantic-only
    return this.hybridQuery(queryTexts, nResults)
  }

  /**
   * Get all documents
   */
  async getAll() {
    return this.documents
  }

  /**
   * Delete by ID
   */
  async deleteById(id) {
    this.documents = this.documents.filter((doc) => doc.id !== id)
    delete this.embeddings[id]
    await this.save()
  }

  /**
   * Clear all documents
   */
  async clear() {
    this.documents = []
    this.embeddings = {}
    embeddingCache = {}
    await this.save()
  }

  /**
   * Get statistics
   */
  getStats() {
    return {
      total_documents: this.documents.length,
      embedding_model: 'all-MiniLM-L6-v2',
      embedding_dimension: 384,
    }
  }
}

module.exports = SimpleVectorStore