const mongoose = require('mongoose');

const websiteSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  url: {
    type: String,
    required: true,
    trim: true,
    lowercase: true
  },
  platform: {
    type: String,
    required: true,
    enum: ['wordpress', 'nextjs', 'laravel', 'codeigniter', 'other']
  },
  apiKey: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['healthy', 'warning', 'error', 'offline'],
    default: 'healthy'
  },
  uptime: {
    type: Number,
    default: 100,
    min: 0,
    max: 100
  },
  responseTime: {
    type: Number,
    default: 0
  },
  lastChecked: {
    type: Date,
    default: Date.now
  },
  monitoringEnabled: {
    type: Boolean,
    default: true
  },
  settings: {
    checkInterval: {
      type: Number,
      default: 60000 // 1 minute
    },
    timeout: {
      type: Number,
      default: 10000 // 10 seconds
    },
    alertThresholds: {
      responseTime: {
        type: Number,
        default: 5000 // 5 seconds
      },
      uptime: {
        type: Number,
        default: 95 // 95%
      }
    }
  },
  analytics: {
    totalVisitors: {
      type: Number,
      default: 0
    },
    totalPageViews: {
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
    seoScore: {
      type: Number,
      default: 0
    },
    securityScore: {
      type: Number,
      default: 0
    }
  },
  performance: {
    loadTime: {
      type: Number,
      default: 0
    },
    serverResponseTime: {
      type: Number,
      default: 0
    },
    databaseQueryTime: {
      type: Number,
      default: 0
    },
    memoryUsage: {
      type: Number,
      default: 0
    },
    memoryPeak: {
      type: Number,
      default: 0
    },
    cpuUsage: {
      type: Number,
      default: 0
    },
    performanceScore: {
      type: Number,
      default: 0
    },
    activePlugins: {
      type: Number,
      default: 0
    },
    recommendations: [{
      type: String
    }]
  },
  seo: {
    score: {
      type: Number,
      default: 0
    },
    metaTags: {
      type: String,
      default: 'incomplete'
    },
    altTags: {
      type: Number,
      default: 0
    },
    headingStructure: {
      type: String,
      default: 'unknown'
    },
    internalLinks: {
      type: Number,
      default: 0
    },
    externalLinks: {
      type: Number,
      default: 0
    },
    sslEnabled: {
      type: Boolean,
      default: false
    },
    siteTitle: {
      type: String,
      default: ''
    },
    siteDescription: {
      type: String,
      default: ''
    },
    totalContent: {
      type: Number,
      default: 0
    },
    seoIssues: [{
      type: String
    }],
    recommendations: [{
      type: String
    }]
  },
  security: {
    sslStatus: {
      type: String,
      default: 'disabled'
    },
    firewall: {
      type: String,
      default: 'none'
    },
    malwareScan: {
      type: String,
      default: 'unknown'
    },
    vulnerabilityScan: {
      type: String,
      default: 'unknown'
    },
    securityScore: {
      type: Number,
      default: 0
    },
    securityPlugins: {
      type: Number,
      default: 0
    },
    totalPlugins: {
      type: Number,
      default: 0
    },
    outdatedPlugins: {
      type: Number,
      default: 0
    },
    wordpressVersion: {
      type: String,
      default: ''
    },
    recommendations: [{
      type: String
    }]
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Update the updatedAt field before saving
websiteSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Index for better performance
websiteSchema.index({ url: 1 });
websiteSchema.index({ status: 1 });
websiteSchema.index({ platform: 1 });

module.exports = mongoose.model('Website', websiteSchema);
