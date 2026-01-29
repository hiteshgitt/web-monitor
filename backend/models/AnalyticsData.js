const mongoose = require('mongoose');

const analyticsDataSchema = new mongoose.Schema({
  websiteId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Website',
    required: true
  },
  date: {
    type: Date,
    required: true
  },
  visitors: {
    type: Number,
    default: 0
  },
  pageViews: {
    type: Number,
    default: 0
  },
  bounceRate: {
    type: Number,
    default: 0
  },
  avgSessionDuration: {
    type: Number,
    default: 0
  },
  topPages: [{
    page: String,
    views: Number
  }],
  trafficSources: [{
    source: String,
    visitors: Number
  }],
  deviceTypes: [{
    device: String,
    percentage: Number
  }],
  seoMetrics: {
    score: Number,
    issues: [{
      type: String,
      severity: String,
      message: String
    }]
  },
  securityMetrics: {
    score: Number,
    alerts: [{
      severity: String,
      message: String,
      timestamp: Date
    }]
  }
});

// Index for better performance
analyticsDataSchema.index({ websiteId: 1, date: -1 });
analyticsDataSchema.index({ date: -1 });

module.exports = mongoose.model('AnalyticsData', analyticsDataSchema);
