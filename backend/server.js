const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config({ path: './config.env' });

const websiteRoutes = require('./routes/websites');
const advancedRoutes = require('./routes/advanced');
const monitoringService = require('./services/monitoringService');

const app = express();
const PORT = process.env.PORT || 5000;

// CORS configuration - MUST be before other middleware
const corsOptions = {
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://yourdomain.com'] 
    : ['http://localhost:5173', 'http://localhost:3000', 'http://localhost:3001', 'http://127.0.0.1:5173', 'http://127.0.0.1:3000', 'http://127.0.0.1:3001'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['Content-Type']
};
app.use(cors(corsOptions));

// Security middleware - configured to work with CORS
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  crossOriginEmbedderPolicy: false
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use(limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/webmonitor')
.then(() => {
  console.log('Connected to MongoDB');
  
  // Start monitoring service after database connection
  monitoringService.startMonitoring();
})
.catch((error) => {
  console.error('MongoDB connection error:', error);
  process.exit(1);
});

// Routes
app.use('/api/websites', websiteRoutes);
app.use('/api/advanced', advancedRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// API documentation endpoint
app.get('/api', (req, res) => {
  res.json({
    message: 'Web Monitor API',
    version: '1.0.0',
    endpoints: {
      websites: {
        'GET /api/websites': 'Get all websites',
        'GET /api/websites/:id': 'Get single website',
        'POST /api/websites': 'Create new website',
        'PUT /api/websites/:id': 'Update website',
        'DELETE /api/websites/:id': 'Delete website',
        'GET /api/websites/:id/monitoring': 'Get website monitoring data',
        'GET /api/websites/:id/analytics': 'Get website analytics data',
        'POST /api/websites/:id/test': 'Test website connection'
      },
      health: {
        'GET /api/health': 'API health check'
      }
    }
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    error: 'Something went wrong!',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  monitoringService.stopMonitoring();
  mongoose.connection.close().then(() => {
    console.log('MongoDB connection closed');
    process.exit(0);
  }).catch((err) => {
    console.error('Error closing MongoDB connection:', err);
    process.exit(1);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  monitoringService.stopMonitoring();
  mongoose.connection.close(() => {
    console.log('MongoDB connection closed');
    process.exit(0);
  });
});

app.listen(PORT, () => {
  console.log(`Web Monitor API server running on port ${PORT}`);
  console.log(`API Documentation: http://localhost:${PORT}/api`);
  console.log(`Health Check: http://localhost:${PORT}/api/health`);
});
