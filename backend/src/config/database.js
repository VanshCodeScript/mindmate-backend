const mongoose = require('mongoose');

/**
 * MongoDB Connection Module
 * Handles connection to MongoDB Atlas
 */

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000,
    });

    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    console.log(`📂 Database: ${conn.connection.name}`);

    // Handle connection events
    mongoose.connection.on('disconnected', () => {
      console.warn('⚠️ MongoDB Disconnected');
    });

    mongoose.connection.on('error', (err) => {
      console.error('❌ MongoDB Connection Error:', err.message);
    });

    return conn;
  } catch (error) {
    console.error('❌ MongoDB Connection Failed:', error.message);
    // On Vercel (Serverless), we don't want to exit the process
    if (!process.env.VERCEL) {
      process.exit(1);
    }
    throw error;
  }
};

/**
 * Disconnect from MongoDB
 */
const disconnectDB = async () => {
  try {
    await mongoose.disconnect();
    console.log('✅ MongoDB Disconnected');
  } catch (error) {
    console.error('❌ Error disconnecting MongoDB:', error.message);
    process.exit(1);
  }
};

module.exports = { connectDB, disconnectDB };
