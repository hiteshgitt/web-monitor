const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config({ path: './config.env', quiet: true });

const websiteRoutes = require('./routes/websites');
const advancedRoutes = require('./routes/advanced');
const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const { requireAuth, requirePro, requireAdmin } = require('./middleware/auth');
const monitoringService = require('./services/monitoringService');
const MonitoringData = require('./models/MonitoringData');

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  console.error('JWT_SECRET must be set in config.env (at least 32 random characters)');
  process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 5000;

// Behind nginx/a load balancer, use the real client IP (needed for per-user rate limiting)
if (process.env.TRUST_PROXY) {
  app.set('trust proxy', parseInt(process.env.TRUST_PROXY, 10) || 1);
}

// CORS configuration - MUST be before other middleware
// CORS_ORIGINS: comma-separated dashboard origins, e.g. https://monitor.example.com
const corsOptions = {
  origin: process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean)
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

// Rate limiting - Relaxed in development to prevent false-offline errors
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  // The dashboard polls every 30-60s per open tab, so allow well above that per IP
  limit: parseInt(process.env.RATE_LIMIT_MAX, 10) || (process.env.NODE_ENV === 'production' ? 1000 : 10000),
  message: { error: 'Too many requests', message: 'Rate limit exceeded during high-frequency monitoring.' }
});
app.use(limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/webmonitor')
.then(async () => {
  console.log('Connected to MongoDB');
  // Replace the old plain timestamp index with the retention (TTL) index
  await MonitoringData.syncIndexes();
  
  // Start monitoring service after database connection
  monitoringService.startMonitoring();
})
.catch((error) => {
  console.error('MongoDB connection error:', error);
  process.exit(1);
});

// Sign-in endpoints get a much lower limit to slow down password guessing
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: parseInt(process.env.AUTH_RATE_LIMIT_MAX, 10) || 30,
  skip: (req) => req.method === 'GET',
  message: { error: 'Too many sign-in attempts. Please wait a few minutes and try again.' }
});

// Routes
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/websites', requireAuth, websiteRoutes);
// Advanced view is the paid Pro tier
app.use('/api/advanced', requireAuth, requirePro, advancedRoutes);
app.use('/api/admin', requireAuth, requireAdmin, adminRoutes);

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
app.use((req, res) => {
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
  mongoose.connection.close().then(() => {
    console.log('MongoDB connection closed');
    process.exit(0);
  });
});

app.listen(PORT, () => {
  console.log(`Web Monitor API server running on port ${PORT}`);
  console.log(`API Documentation: http://localhost:${PORT}/api`);
  console.log(`Health Check: http://localhost:${PORT}/api/health`);
});
