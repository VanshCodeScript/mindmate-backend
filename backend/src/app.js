const express = require('express')
const cors = require('cors')
const helmet = require('helmet')
const morgan = require('morgan')
const compression = require('compression')

const app = express()

// Security Middleware
app.use(helmet())

// CORS Configuration - Allow LAN access for cross-device video calls
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return callback(null, true)
    
    // Allow localhost on any port
    if (origin.match(/^https?:\/\/localhost(:\d+)?$/)) return callback(null, true)
    
    // Allow any private network IP (LAN access for video calls)
    if (origin.match(/^https?:\/\/(127\.0\.0\.1|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+|192\.168\.\d+\.\d+)(:\d+)?$/)) {
      return callback(null, true)
    }

    // Allow configured CLIENT_URL
    if (process.env.CLIENT_URL && origin === process.env.CLIENT_URL) {
      return callback(null, true)
    }

    // In development, allow all
    if (process.env.NODE_ENV !== 'production') {
      return callback(null, true)
    }

    callback(new Error('Not allowed by CORS'))
  },
  credentials: true,
}))

// Body Parser
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ limit: '10mb', extended: true }))

// Logging
app.use(morgan('combined'))

// Compression
app.use(compression())

// Health Check Route
app.get('/health', (req, res) => {
  res.json({
    status: 'running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  })
})

// Root Route
app.get('/', (req, res) => {
  res.json({
    message: 'MindBridge API Server',
    version: '1.0.0',
    status: 'operational'
  })
})

// ================= API ROUTES =================

// Existing Routes
app.use('/api/v1/alerts', require('./modules/alerts/routes'))
app.use('/api/v1/auth', require('./modules/auth/routes'))
app.use('/api/v1/admin', require('./modules/admin/routes'))
app.use('/api/v1/video', require('./modules/video/routes'))
// app.use('/api/v1/prescriptions', require('./modules/prescriptions/routes'))  // ES module – needs conversion
app.use('/api/chatbot', require('./modules/chatbot/routes'))
app.use('/api/rag', require('./modules/rag/routes'))
app.use('/api/v1/reminders', require('./modules/reminders/routes'))
app.use('/api/v1/cognitive', require('./modules/cognitive/routes'))
app.use('/api/v1/users',    require('./modules/users/routes'))

// Location tracking (GPS)
app.use('/api/location', require('./modules/location/routes'))

// ==============================================

// 404 Handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: 'The requested resource does not exist',
    path: req.path
  })
})

// Error Handler
app.use((err, req, res, next) => {
  console.error('Error:', err)
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error',
    status: err.status || 500
  })
})

module.exports = app