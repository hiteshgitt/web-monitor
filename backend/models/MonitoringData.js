const mongoose = require('mongoose');

const monitoringDataSchema = new mongoose.Schema({
  websiteId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Website',
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  status: {
    type: String,
    enum: ['healthy', 'warning', 'error', 'offline'],
    required: true
  },
  responseTime: {
    type: Number,
    required: true
  },
  statusCode: {
    type: Number,
    required: true
  },
  uptime: {
    type: Number,
    required: true
  },
  error: {
    message: String,
    code: String
  },
  metrics: {
    loadTime: Number,
    // Time the site's own integration spent building the health response (ms), reported by the site
    serverProcessingTime: Number,
    pageSize: Number,
    requests: Number,
    sslValid: Boolean,
    sslExpiry: Date
  }
});

// Index for better performance
monitoringDataSchema.index({ websiteId: 1, timestamp: -1 });
// Old checks are deleted automatically so storage stays bounded (fits free DB tiers)
const RETENTION_DAYS = parseInt(process.env.MONITORING_RETENTION_DAYS, 10) || 90;
monitoringDataSchema.index({ timestamp: 1 }, { expireAfterSeconds: RETENTION_DAYS * 24 * 60 * 60 });

module.exports = mongoose.model('MonitoringData', monitoringDataSchema);
