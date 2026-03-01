const path = require('path')

/**
 * ChromaDB Configuration
 * Vector database for RAG (Retrieval-Augmented Generation)
 */

const chromaConfig = {
  // Persistent storage path for ChromaDB
  persistDirectory: path.join(process.cwd(), 'data', 'chroma'),
  
  // Collection settings
  collectionName: 'mindbridge-knowledge-base',
  
  // Embedding settings
  embeddingModel: 'sentence-transformers/all-MiniLM-L6-v2',
  
  // ChromaDB client settings
  clientSettings: {
    // Enable persistence
    is_persistent: true,
    // Data directory
    data_dir: path.join(process.cwd(), 'data', 'chroma'),
    // Allow reset (useful for development)
    allow_reset: process.env.NODE_ENV === 'development',
  },
  
  // Search settings
  searchSettings: {
    topK: 5, // Number of documents to retrieve
    similarityThreshold: 0.7, // Minimum similarity score (0-1)
  },
  
  // Document chunking settings
  chunkingSettings: {
    chunkSize: 500, // Characters per chunk
    chunkOverlap: 100, // Overlap for context
  },
  
  // Metadata fields
  metadataFields: ['source', 'category', 'date_added', 'tags'],
}

module.exports = chromaConfig