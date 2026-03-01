const chromaDB = require('./services/ChromaDBService')
const DocumentIngestionService = require('./services/DocumentIngestionService')
const fs = require('fs').promises
const path = require('path')

/**
 * RAG Module Initializer
 * Called on server startup to initialize ChromaDB and load knowledge base
 */

async function initializeRAGModule() {
  try {
    console.log('\n🚀 Initializing RAG Module...')
    
    // Initialize ChromaDB
    await chromaDB.initialize()
    
    // Get stats
    const stats = chromaDB.getStats()
    console.log('📊 Knowledge Base Stats:', stats)
    
    // Path to knowledge base
    const knowledgeBasePath = path.join(process.cwd(), 'data', 'knowledge-base')
    let filesLoaded = false
    
    // Check if embeddings are valid (not all same similarity)
    const needsReingestion = stats.total_documents === 0 || stats.total_documents === undefined || stats.has_corrupt_embeddings
    
    // Try to load documents from knowledge-base folder
    try {
      await fs.access(knowledgeBasePath)
      console.log('📂 Found knowledge-base directory')
      
      // Clear and reload if embeddings are corrupt or KB is empty
      if (needsReingestion) {
        if (stats.has_corrupt_embeddings) {
          console.log('⚠️  Corrupt embeddings detected - clearing and reingesting...')
          await chromaDB.resetCollection()
        }
        // Get list of category subdirectories
        const categories = await fs.readdir(knowledgeBasePath, { withFileTypes: true })
        const subDirs = categories.filter(item => item.isDirectory())
        
        if (subDirs.length > 0) {
          console.log(`📚 Found ${subDirs.length} knowledge categories`)
          let totalChunksLoaded = 0
          
          // Load documents from each category folder
          for (const dir of subDirs) {
            const categoryPath = path.join(knowledgeBasePath, dir.name)
            const files = await fs.readdir(categoryPath)
            const docFiles = files.filter(file => file.endsWith('.txt') || file.endsWith('.md'))
            
            if (docFiles.length > 0) {
              console.log(`  📁 ${dir.name}/: ${docFiles.length} files`)
              
              // Load each file in this category
              for (const docFile of docFiles) {
                const filePath = path.join(categoryPath, docFile)
                const content = await fs.readFile(filePath, 'utf-8')
                
                const result = await DocumentIngestionService.addDocument(content, {
                  source: docFile,
                  category: dir.name,
                  date_added: new Date().toISOString(),
                  tags: [dir.name],
                })
                
                totalChunksLoaded += result.chunksAdded
              }
            }
          }
          
          if (totalChunksLoaded > 0) {
            console.log(`✅ Loaded ${totalChunksLoaded} document chunks from file system`)
            filesLoaded = true
          }
        }
      } else {
        console.log(`📚 Knowledge base already populated (${stats.total_documents} documents). Skipping file load.`)
      }
    } catch (err) {
      if (err.code !== 'ENOENT') {
        console.warn('⚠️  Error reading knowledge-base directory:', err.message)
      }
    }
    
    // Load sample data if no files were loaded (always load for development with empty KB)
    if (!filesLoaded && (stats.total_documents === 0 || stats.total_documents === undefined) && process.env.NODE_ENV !== 'production') {
      console.log('📚 No document files found. Loading sample elderly care knowledge base...')
      const result = await DocumentIngestionService.initializeSampleData()
      console.log(`✅ Loaded ${result.chunksAdded} sample document chunks into knowledge base`)
    }
    
    console.log('✅ RAG Module initialized successfully\n')
  } catch (error) {
    console.error('❌ Failed to initialize RAG Module:', error.message)
    process.exit(1)
  }
}

module.exports = initializeRAGModule