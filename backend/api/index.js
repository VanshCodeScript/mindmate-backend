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
    // 1. Immediate Health Check (No initialization required)
    if (req.url === '/api/ver-health' || req.url === '/api/v1/health') {
        return res.status(200).json({
            status: 'ok',
            vercel: true,
            time: new Date().toISOString(),
            env: process.env.NODE_ENV
        });
    }

    try {
        console.log(`[VERCEL] Handling request: ${req.method} ${req.url}`);

        // 2. Initialize (this will only happen once per instance)
        const initStart = Date.now();
        await initialize();
        console.log(`[VERCEL] Initialization took ${Date.now() - initStart}ms`);

        // 3. Forward to Express
        return app(req, res);
    } catch (err) {
        console.error('[VERCEL] Request failed:', err);
        return res.status(500).json({
            error: 'In-Function Crash',
            message: err.message,
            stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
        });
    }
};
