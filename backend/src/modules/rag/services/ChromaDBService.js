const path = require('path')
const SimpleVectorStore = require('./SimpleVectorStore')

/**
 * ChromaDB Adapter Service (uses SimpleVectorStore internally)
 * Provides a ChromaDB-like interface for document storage and retrieval
 */
class ChromaDBService {
  static _initialized = false
  static _instance = null
  static _collection = null

  /**
   * Initialize the vector store
   */
  static async initialize() {
    if (this._initialized) {
      return
    }

    try {
      const dataDir = path.join(process.cwd(), 'data', 'chroma')
      const storePath = path.join(dataDir, 'vector-store.json')

      this._instance = new SimpleVectorStore(storePath)
      await this._instance.initialize()

      this._initialized = true
      console.log('✅ Vector store initialized at:', dataDir)
    } catch (error) {
      console.error('❌ Failed to initialize vector store:', error.message)
      throw error
    }
  }

  /**
   * Get or create a collection
   */
  static getCollection(name = 'elderly-knowledge') {
    if (!this._initialized) {
      throw new Error('Vector store not initialized. Call initialize() first.')
    }

    // Return a collection wrapper that uses the vector store
    if (!this._collection) {
      this._collection = {
        add: async (data) => {
          await this._instance.add(data.ids, data.documents, data.metadatas)
        },
        query: async (queryData) => {
          return await this._instance.query(queryData.query_texts, queryData.n_results)
        },
        get: async (ids) => {
          return this._instance.documents.filter((doc) => ids.includes(doc.id))
        },
        delete: async (ids) => {
          for (const id of ids) {
            await this._instance.deleteById(id)
          }
        },
      }
    }

    return this._collection
  }

  /**
   * Get vector store statistics
   */
  static getStats() {
    if (!this._initialized) {
      return { status: 'not initialized' }
    }
    const stats = this._instance.getStats()
    
    // Check if embeddings are valid
    if (stats.total_documents > 0) {
      const docsWithEmbeddings = this._instance.documents.filter(d => d.embedding && d.embedding.length > 0).length
      stats.documents_with_embeddings = docsWithEmbeddings
      stats.has_corrupt_embeddings = docsWithEmbeddings < stats.total_documents * 0.5
    }
    
    return stats
  }

  /**
   * Reset collection (dev only)
   */
  static async resetCollection() {
    if (!this._initialized) {
      throw new Error('Vector store not initialized')
    }
    await this._instance.clear()
    console.log('✅ Collection reset')
  }
}

module.exports = ChromaDBService