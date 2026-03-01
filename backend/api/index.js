const app = require('../src/app');
const { connectDB } = require('../src/config/database');
const initializeRAGModule = require('../src/modules/rag/init');

let isInitialized = false;

const initialize = async () => {
    if (isInitialized) return;

    try {
        console.log('🚀 Initializing Serverless Environment...');

        // Connect to MongoDB
        await connectDB();

        // Initialize RAG module (Transformer models, etc.)
        // Note: This might be slow on first execution in a cold start
        await initializeRAGModule();

        isInitialized = true;
        console.log('✅ Initialization Complete');
    } catch (error) {
        console.error('❌ Initialization Failed:', error);
        // We don't throw here to allow the app to still respond (maybe with 500)
    }
};

// Vercel Serverless Function entry point
module.exports = async (req, res) => {
    await initialize();
    return app(req, res);
};
