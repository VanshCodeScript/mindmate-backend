const express = require('express')
const multer = require('multer')
const RAGController = require('../controllers/RAGController')

const router = express.Router()

// Multer config: store PDF in memory (up to 10MB)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') cb(null, true)
    else cb(new Error('Only PDF files are allowed'))
  },
})

/**
 * RAG Routes
 * Knowledge base and retrieval endpoints
 */

/**
 * POST /api/rag/search
 * Search knowledge base with query
 */
router.post('/search', RAGController.search)

/**
 * POST /api/rag/context
 * Get context for chatbot using RAG
 */
router.post('/context', RAGController.getContext)

/**
 * GET /api/rag/category/:category
 * Search documents by category
 */
router.get('/category/:category', RAGController.searchByCategory)

/**
 * POST /api/rag/tags
 * Search documents by tags
 */
router.post('/tags', RAGController.searchByTags)

/**
 * GET /api/rag/stats
 * Get knowledge base statistics
 */
router.get('/stats', RAGController.getStats)

/**
 * POST /api/rag/upload
 * Upload text or PDF to knowledge base
 */
router.post('/upload', upload.single('file'), RAGController.uploadDocument)

/**
 * POST /api/rag/documents
 * Add new document to knowledge base
 */
router.post('/documents', RAGController.addDocument)

/**
 * DELETE /api/rag/documents/:source
 * Delete document by source
 */
router.delete('/documents/:source', RAGController.deleteDocument)

/**
 * POST /api/rag/init-samples
 * Initialize with sample data (dev only)
 */
router.post('/init-samples', RAGController.initializeSamples)

/**
 * POST /api/rag/reset
 * Reset knowledge base (dev only)
 */
router.post('/reset', RAGController.reset)

module.exports = router