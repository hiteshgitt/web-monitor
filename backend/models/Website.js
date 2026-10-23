const mongoose = require('mongoose');

const websiteSchema = new mongoose.Schema({
  // Customer who added the site; every API query is scoped to it
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    index: true
  },
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
    enum: ['wordpress', 'nextjs', 'laravel', 'codeigniter', 'php', 'other']
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
    default: null,
    min: 0,
    max: 100
  },
  responseTime: {
    type: Number,
    default: null
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
      default: null
    },
    totalPageViews: {
      type: Number,
      default: null
    },
    bounceRate: {
      type: Number,
      default: null
    },
    avgSessionDuration: {
      type: Number,
      default: null
    },
    seoScore: {
      type: Number,
      default: null
    },
    securityScore: {
      type: Number,
      default: null
    }
  },
  performance: {
    loadTime: {
      type: Number,
      default: null
    },
    serverResponseTime: {
      type: Number,
      default: null
    },
    databaseQueryTime: {
      type: Number,
      default: null
    },
    memoryUsage: {
      type: Number,
      default: null
    },
    memoryPeak: {
      type: Number,
      default: null
    },
    cpuUsage: {
      type: Number,
      default: null
    },
    performanceScore: {
      type: Number,
      default: null
    },
    activePlugins: {
      type: Number,
      default: null
    },
    recommendations: [{
      type: String
    }]
  },
  seo: {
    score: {
      type: Number,
      default: null
    },
    metaTags: {
      type: String,
      default: 'incomplete'
    },
    altTags: {
      type: Number,
      default: null
    },
    headingStructure: {
      type: String,
      default: 'unknown'
    },
    internalLinks: {
      type: Number,
      default: null
    },
    externalLinks: {
      type: Number,
      default: null
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
      default: null
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
      default: null
    },
    securityPlugins: {
      type: Number,
      default: null
    },
    totalPlugins: {
      type: Number,
      default: null
    },
    outdatedPlugins: {
      type: Number,
      default: null
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
websiteSchema.pre('save', function() {
  this.updatedAt = Date.now();
});

// Index for better performance
// Never send the site's API key to the browser; expose only its last 4 characters
websiteSchema.set('toJSON', {
  transform(doc, ret) {
    ret.apiKeyLast4 = ret.apiKey ? String(ret.apiKey).slice(-4) : null;
    delete ret.apiKey;
    return ret;
  }
});

websiteSchema.index({ url: 1 });
websiteSchema.index({ status: 1 });
websiteSchema.index({ platform: 1 });

module.exports = mongoose.model('Website', websiteSchema);
