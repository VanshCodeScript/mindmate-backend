# RAG Module - Knowledge Base for MindBridge Chatbot

## Overview

The RAG (Retrieval-Augmented Generation) module provides a vector database knowledge base for the MindBridge chatbot. It uses **ChromaDB** as a persistent vector store to enable the chatbot to retrieve relevant information from curated documents and use it as context for generating more informed and accurate responses.

---

## Architecture

### Folder Structure

```
server/
├── src/
│   └── modules/
│       └── rag/
│           ├── config/
│           │   └── chromadb.js          # ChromaDB configuration
│           ├── services/
│           │   ├── ChromaDBService.js   # ChromaDB client & connection
│           │   ├── DocumentIngestionService.js  # Document processing & chunking
│           │   └── RAGService.js        # Search & retrieval logic
│           ├── controllers/
│           │   └── RAGController.js     # API endpoints
│           ├── routes/
│           │   └── index.js             # Route definitions
│           └── init.js                  # Module initialization
└── data/
    ├── knowledge-base/                  # User documents (add .txt/.md files here)
    └── chroma/                          # ChromaDB persistent storage
```

---

## Components

### 1. ChromaDBService
**File:** `services/ChromaDBService.js`

Manages the ChromaDB client and collection lifecycle.

**Key Methods:**
- `initialize()` - Initialize ChromaDB client
- `getCollection()` - Get the active collection
- `getClient()` - Get ChromaDB client
- `resetCollection()` - Reset collection (dev only)
- `getStats()` - Get collection statistics

### 2. DocumentIngestionService
**File:** `services/DocumentIngestionService.js`

Handles document processing, chunking, and ingestion into ChromaDB.

**Key Methods:**
- `ingestDocuments(documents)` - Add multiple documents
- `addDocument(content, metadata)` - Add single document
- `chunkText(text)` - Split text into chunks
- `loadFromDirectory(directory)` - Load documents from folder
- `initializeSampleData()` - Load sample elderly health documents

### 3. RAGService
**File:** `services/RAGService.js`

Retrieves documents and builds context for the chatbot.

**Key Methods:**
- `search(query, topK)` - Search documents by semantic similarity
- `buildContext(query, topK)` - Build context string for chatbot
- `searchByCategory(category, topK)` - Filter by category
- `searchByTags(tags, topK)` - Filter by tags
- `getStats()` - Get knowledge base statistics
- `deleteDocument(source)` - Remove document

### 4. RAGController
**File:** `controllers/RAGController.js`

Express controller handling API endpoints.

### 5. Routes
**File:** `routes/index.js`

REST API endpoints for RAG operations.

---

## API Endpoints

### Search Operations

#### Search Knowledge Base
```bash
POST /api/rag/search
Content-Type: application/json

{
  "query": "what are good exercises for elderly",
  "topK": 5
}

Response:
{
  "success": true,
  "query": "what are good exercises for elderly",
  "results": [
    {
      "content": "...",
      "similarity": 0.92,
      "metadata": {...}
    }
  ],
  "count": 1
}
```

#### Get Context for Chatbot
```bash
POST /api/rag/context
Content-Type: application/json

{
  "query": "how should I exercise",
  "topK": 3
}

Response:
{
  "success": true,
  "context": "Based on the following knowledge base information:\n\n[Document 1 - Confidence: 95.2%]\n..."
}
```

#### Search by Category
```bash
GET /api/rag/category/health?topK=10

Response:
{
  "success": true,
  "category": "health",
  "results": [...],
  "count": 5
}
```

#### Search by Tags
```bash
POST /api/rag/tags
Content-Type: application/json

{
  "tags": ["fitness", "elderly"],
  "topK": 10
}

Response:
{
  "success": true,
  "tags": ["fitness", "elderly"],
  "results": [...],
  "count": 3
}
```

#### Get Statistics
```bash
GET /api/rag/stats

Response:
{
  "success": true,
  "stats": {
    "documentCount": 24,
    "collectionName": "mindbridge-knowledge-base",
    "initialized": true
  }
}
```

### Document Management

#### Add Document
```bash
POST /api/rag/documents
Content-Type: application/json

{
  "content": "Full document text here...",
  "metadata": {
    "source": "my-document.txt",
    "category": "health",
    "date_added": "2024-02-28T00:00:00Z",
    "tags": ["health", "nutrition"]
  }
}

Response:
{
  "success": true,
  "chunksAdded": 3
}
```

#### Delete Document
```bash
DELETE /api/rag/documents/my-document.txt

Response:
{
  "success": true,
  "message": "Document deleted successfully",
  "deletedCount": 3
}
```

### Admin Operations (Development Only)

#### Initialize Sample Data
```bash
POST /api/rag/init-samples

Response:
{
  "success": true,
  "message": "Sample data initialized",
  "chunksAdded": 12
}
```

#### Reset Knowledge Base
```bash
POST /api/rag/reset

Response:
{
  "success": true,
  "message": "Knowledge base reset successfully"
}
```

---

## Configuration

### chromadb.js
**Location:** `config/chromadb.js`

```javascript
{
  persistDirectory: 'data/chroma',
  collectionName: 'mindbridge-knowledge-base',
  embeddingModel: 'sentence-transformers/all-MiniLM-L6-v2',
  searchSettings: {
    topK: 5,
    similarityThreshold: 0.7
  },
  chunkingSettings: {
    chunkSize: 500,
    chunkOverlap: 100
  }
}
```

### Environment Variables

Add to `.env`:
```bash
# RAG Settings
RAG_ENABLED=true
RAG_TOP_K=5
RAG_SIMILARITY_THRESHOLD=0.7
RAG_CHUNK_SIZE=500
RAG_CHUNK_OVERLAP=100
```

---

## Adding Documents to Knowledge Base

### Method 1: Use API

```bash
curl -X POST http://localhost:5004/api/rag/documents \
  -H "Content-Type: application/json" \
  -d '{
    "content": "Your document text here...",
    "metadata": {
      "source": "my-file.txt",
      "category": "health",
      "tags": ["wellness", "tips"]
    }
  }'
```

### Method 2: Add .txt/.md Files

1. Create text files in `server/data/knowledge-base/`
2. Files are grouped by subdirectory (becomes category)
3. Load via API:

```bash
curl -X POST http://localhost:5004/api/rag/load \
  -H "Content-Type: application/json" \
  -d '{"directory": "health"}'
```

### Method 3: Initialize Sample Data

In development, sample data auto-loads on startup if knowledge base is empty:

```bash
POST /api/rag/init-samples
```

---

## Integration with Chatbot

### Using RAG in ChatbotService

Update `server/src/modules/chatbot/services/ChatbotService.js`:

```javascript
const RAGService = require('../rag/services/RAGService')

static async sendToGemini(message) {
  // Get context from RAG
  const context = await RAGService.buildContext(message, 3)
  
  // Build prompt with context
  let systemPrompt = 'You are a helpful AI assistant for elderly users.'
  if (context) {
    systemPrompt += `\n\nUse this information to inform your response:\n${context}`
  }
  
  // ... rest of implementation
}
```

### Flow

1. User sends message to chatbot
2. Chatbot service calls `RAGService.buildContext()`
3. RAG retrieves relevant documents from ChromaDB
4. Context is prepended to LLM prompt
5. LLM generates response using both context and reasoning

---

## Document Format & Best Practices

### Document Structure

```markdown
# Elderly Care Guide

## Health Tips
Regular exercise is important for seniors...

## Sleep Habits
Consistent sleep schedule helps...
```

### Metadata Best Practices

```javascript
{
  "source": "filename.txt",        // Unique identifier
  "category": "health",             // Broad classification
  "tags": ["sleep", "elderly"],     // Multiple searchable tags
  "date_added": "2024-02-28",      // ISO date
}
```

### Chunking Strategy

- **chunkSize: 500** - Medium-sized chunks (good balance)
- **chunkOverlap: 100** - 20% overlap preserves context
- Documents auto-chunk on ingestion

---

## Performance Tuning

### Optimize Search Quality

```javascript
// In chromadb.js
searchSettings: {
  topK: 5,                    // More = better recall, slower
  similarityThreshold: 0.7,   // Higher = stricter matching
}
```

### Optimize Document Chunks

```javascript
chunkingSettings: {
  chunkSize: 500,      // Smaller = more specific
  chunkOverlap: 100,   // Higher = better context flow
}
```

---

## Monitoring & Debugging

### Check Knowledge Base Health

```bash
curl http://localhost:5004/api/rag/stats
# Returns document count, collection info, etc.
```

### View ChromaDB Storage

File system location: `server/data/chroma/`

Contains:
- `chroma.db` - ChromaDB database
- Vector embeddings
- Document metadata

### Logs on Server Startup

```
🔄 Initializing ChromaDB...
✅ ChromaDB initialized successfully
📁 Storage: ...data/chroma
📚 Collection: mindbridge-knowledge-base
📊 Knowledge Base Stats: { documentCount: 24, ... }
```

---

## Dependencies

Add to `requirements.txt` (Python):

```
chromadb==0.4.0
sentence-transformers==2.2.2
```

Or npm (Node.js wrapper):

```bash
npm install chromadb
```

---

## Common Use Cases

### Healthcare Q&A
```
User: "What exercises are safe for seniors?"
→ RAG retrieves fitness documents
→ Context appended to prompt
→ More accurate, safety-conscious response
```

### Medication Information
```
User: "Tell me about vitamin D"
→ RAG retrieves health documents
→ Mentions recommended dosage
→ More helpful response
```

### Personalized Wellness
```
User: "I have trouble sleeping"
→ RAG retrieves sleep quality documents
→ Provides backed-up suggestions
→ Better engagement
```

---

## Troubleshooting

### ChromaDB not initializing
- Check `server/data/chroma/` permissions
- Ensure Node modules installed: `npm install chromadb`
- Clear data: `rm -rf server/data/chroma/`

### No results found
- Check similarity threshold is reasonable (0.6-0.8)
- Verify documents are indexed: `GET /api/rag/stats`
- Try different query terms

### Slow search
- Reduce `topK` parameter
- Check ChromaDB size: `GET /api/rag/stats`
- Add more specific metadata/tags

---

## Future Enhancements

- [ ] Web UI for document management
- [ ] Auto-generate summaries for chunks
- [ ] Multi-language support
- [ ] Document versioning
- [ ] Analytics on most-retrieved documents
- [ ] User feedback loop for relevance tuning
- [ ] Integration with external knowledge sources

---

**Module Author:** MindBridge Team
**Last Updated:** February 28, 2026
**Version:** 1.0.0
