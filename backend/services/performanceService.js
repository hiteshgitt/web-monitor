const axios = require('axios');

class PerformanceService {
  constructor() {
    this.pagespeedApiKey = process.env.PAGESPEED_API_KEY;
    this.coreWebVitalsThresholds = {
      lcp: 2500, // Largest Contentful Paint (ms)
      fid: 100,  // First Input Delay (ms)
      cls: 0.1   // Cumulative Layout Shift
    };
  }

  // Core Web Vitals Monitoring
  async getCoreWebVitals(website) {
    if (!this.pagespeedApiKey) {
      const error = new Error('PageSpeed Insights API key is not configured. Please set PAGESPEED_API_KEY in your environment variables.');
      error.statusCode = 503;
      error.service = 'PageSpeed Insights';
      throw error;
    }

    try {
      const response = await axios.get(`https://www.googleapis.com/pagespeedonline/v5/runPagespeed`, {
        params: {
          url: website.url,
          key: this.pagespeedApiKey,
          category: 'performance',
          strategy: 'mobile'
        },
        httpsAgent: new (require('https').Agent)({ rejectUnauthorized: false })
      });

      const lighthouse = response.data.lighthouseResult;
      const audits = lighthouse.audits;

      return {
        lcp: {
          value: audits['largest-contentful-paint']?.numericValue || 0,
          score: audits['largest-contentful-paint']?.score || 0,
          status: this.getVitalStatus(audits['largest-contentful-paint']?.numericValue, this.coreWebVitalsThresholds.lcp, 'lcp')
        },
        fid: {
          value: audits['max-potential-fid']?.numericValue || 0,
          score: audits['max-potential-fid']?.score || 0,
          status: this.getVitalStatus(audits['max-potential-fid']?.numericValue, this.coreWebVitalsThresholds.fid, 'fid')
        },
        cls: {
          value: audits['cumulative-layout-shift']?.numericValue || 0,
          score: audits['cumulative-layout-shift']?.score || 0,
          status: this.getVitalStatus(audits['cumulative-layout-shift']?.numericValue, this.coreWebVitalsThresholds.cls, 'cls')
        },
        overallScore: lighthouse.categories.performance.score * 100
      };
    } catch (error) {
      console.error('PageSpeed Insights API Error:', error.message);
      const apiError = new Error(`Failed to fetch Core Web Vitals data: ${error.message}`);
      apiError.statusCode = error.response?.status || 500;
      apiError.service = 'PageSpeed Insights';
      apiError.originalError = error;
      throw apiError;
    }
  }

  // PageSpeed Insights Integration
  async getPageSpeedInsights(website, strategy = 'mobile') {
    if (!this.pagespeedApiKey) {
      const error = new Error('PageSpeed Insights API key is not configured. Please set PAGESPEED_API_KEY in your environment variables.');
      error.statusCode = 503;
      error.service = 'PageSpeed Insights';
      throw error;
    }

    try {
      const response = await axios.get(`https://www.googleapis.com/pagespeedonline/v5/runPagespeed`, {
        params: {
          url: website.url,
          key: this.pagespeedApiKey,
          category: 'performance',
          strategy: strategy
        },
        httpsAgent: new (require('https').Agent)({ rejectUnauthorized: false })
      });

      const lighthouse = response.data.lighthouseResult;
      const audits = lighthouse.audits;

      return {
        performanceScore: lighthouse.categories.performance.score * 100,
        accessibilityScore: lighthouse.categories.accessibility.score * 100,
        bestPracticesScore: lighthouse.categories['best-practices'].score * 100,
        seoScore: lighthouse.categories.seo.score * 100,
        pwaScore: lighthouse.categories.pwa ? lighthouse.categories.pwa.score * 100 : 0,
        metrics: {
          firstContentfulPaint: audits['first-contentful-paint']?.numericValue || 0,
          largestContentfulPaint: audits['largest-contentful-paint']?.numericValue || 0,
          firstMeaningfulPaint: audits['first-meaningful-paint']?.numericValue || 0,
          speedIndex: audits['speed-index']?.numericValue || 0,
          totalBlockingTime: audits['total-blocking-time']?.numericValue || 0,
          cumulativeLayoutShift: audits['cumulative-layout-shift']?.numericValue || 0
        },
        opportunities: this.extractOpportunities(audits),
        diagnostics: this.extractDiagnostics(audits)
      };
    } catch (error) {
      console.error('PageSpeed Insights API Error:', error.message);
      const apiError = new Error(`Failed to fetch PageSpeed Insights data: ${error.message}`);
      apiError.statusCode = error.response?.status || 500;
      apiError.service = 'PageSpeed Insights';
      apiError.originalError = error;
      throw apiError;
    }
  }

  // Real User Monitoring (RUM)
  async getRealUserMetrics(website) {
    // Real User Monitoring requires integration with RUM services like:
    // - Google Analytics 4 Enhanced Measurement
    // - New Relic Browser
    // - Datadog RUM
    // - Sentry Performance Monitoring
    const error = new Error('Real User Monitoring (RUM) integration not implemented. Requires RUM service API setup (Google Analytics 4, New Relic, Datadog, or Sentry).');
    error.statusCode = 501;
    error.service = 'Real User Monitoring';
    throw error;
  }

  // CDN Performance Monitoring
  async getCDNPerformance(website) {
    const error = new Error('CDN Performance monitoring not implemented. Requires CDN provider API integration (Cloudflare, AWS CloudFront, etc.).');
    error.statusCode = 501;
    error.service = 'CDN Performance';
    throw error;
  }

  // Database Performance Monitoring
  async getDatabasePerformance(website) {
    const error = new Error('Database Performance monitoring not implemented. Requires database monitoring tool integration (New Relic, Datadog, etc.).');
    error.statusCode = 501;
    error.service = 'Database Performance';
    throw error;
  }

  // Server Resource Monitoring
  async getServerResources(website) {
    const error = new Error('Server Resource monitoring not implemented. Requires server monitoring tool integration (New Relic, Datadog, Prometheus, etc.).');
    error.statusCode = 501;
    error.service = 'Server Resources';
    throw error;
  }

  // Load Testing Integration
  async getLoadTestResults(website) {
    const error = new Error('Load Testing integration not implemented. Requires load testing tool API (k6, JMeter, LoadRunner, etc.).');
    error.statusCode = 501;
    error.service = 'Load Testing';
    throw error;
  }

  // Helper Methods
  getVitalStatus(value, threshold, type) {
    if (type === 'cls') {
      return value <= threshold ? 'good' : value <= threshold * 2 ? 'needs-improvement' : 'poor';
    } else {
      return value <= threshold ? 'good' : value <= threshold * 2 ? 'needs-improvement' : 'poor';
    }
  }

  extractOpportunities(audits) {
    const opportunities = [];
    const opportunityAudits = [
      'unused-css-rules',
      'unused-javascript',
      'render-blocking-resources',
      'unminified-css',
      'unminified-javascript',
      'efficient-animated-content',
      'uses-webp-images',
      'uses-optimized-images'
    ];

    opportunityAudits.forEach(auditKey => {
      if (audits[auditKey] && audits[auditKey].score < 0.9) {
        opportunities.push({
          id: auditKey,
          title: audits[auditKey].title,
          description: audits[auditKey].description,
          score: audits[auditKey].score * 100,
          savings: audits[auditKey].numericValue || 0
        });
      }
    });

    return opportunities;
  }

  extractDiagnostics(audits) {
    const diagnostics = [];
    const diagnosticAudits = [
      'diagnostic',
      'mainthread-work-breakdown',
      'bootup-time',
      'uses-rel-preconnect',
      'uses-rel-preload',
      'font-display',
      'uses-text-compression'
    ];

    diagnosticAudits.forEach(auditKey => {
      if (audits[auditKey]) {
        diagnostics.push({
          id: auditKey,
          title: audits[auditKey].title,
          description: audits[auditKey].description,
          score: audits[auditKey].score ? audits[auditKey].score * 100 : null,
          value: audits[auditKey].numericValue || null
        });
      }
    });

    return diagnostics;
  }


  // Comprehensive Performance Analysis
  async getComprehensivePerformance(website) {
    const results = {
      coreWebVitals: null,
      pageSpeedInsights: null,
      realUserMetrics: null,
      cdnPerformance: null,
      databasePerformance: null,
      serverResources: null,
      loadTestResults: null,
      errors: []
    };

    // Fetch Core Web Vitals (required)
    try {
      results.coreWebVitals = await this.getCoreWebVitals(website);
    } catch (error) {
      results.errors.push({
        service: 'Core Web Vitals',
        error: error.message,
        statusCode: error.statusCode
      });
    }

    // Fetch PageSpeed Insights (required)
    try {
      results.pageSpeedInsights = await this.getPageSpeedInsights(website);
    } catch (error) {
      results.errors.push({
        service: 'PageSpeed Insights',
        error: error.message,
        statusCode: error.statusCode
      });
    }

    // Fetch optional services (may not be implemented)
    try {
      results.realUserMetrics = await this.getRealUserMetrics(website);
    } catch (error) {
      console.warn(`Real User Metrics unavailable: ${error.message}`);
    }

    try {
      results.cdnPerformance = await this.getCDNPerformance(website);
    } catch (error) {
      console.warn(`CDN Performance unavailable: ${error.message}`);
    }

    try {
      results.databasePerformance = await this.getDatabasePerformance(website);
    } catch (error) {
      console.warn(`Database Performance unavailable: ${error.message}`);
    }

    try {
      results.serverResources = await this.getServerResources(website);
    } catch (error) {
      console.warn(`Server Resources unavailable: ${error.message}`);
    }

    try {
      results.loadTestResults = await this.getLoadTestResults(website);
    } catch (error) {
      console.warn(`Load Test Results unavailable: ${error.message}`);
    }

    // If required services failed, throw error
    if (!results.coreWebVitals && !results.pageSpeedInsights) {
      const error = new Error('Unable to fetch performance data. Both Core Web Vitals and PageSpeed Insights are unavailable.');
      error.statusCode = 503;
      error.details = results.errors;
      throw error;
    }

    return {
      coreWebVitals: results.coreWebVitals,
      pageSpeedInsights: results.pageSpeedInsights,
      realUserMetrics: results.realUserMetrics,
      cdnPerformance: results.cdnPerformance,
      databasePerformance: results.databasePerformance,
      serverResources: results.serverResources,
      loadTestResults: results.loadTestResults,
      summary: {
        overallScore: results.pageSpeedInsights?.performanceScore || 0,
        performanceGrade: results.pageSpeedInsights ? this.getPerformanceGrade(results.pageSpeedInsights.performanceScore) : 'N/A',
        criticalIssues: results.coreWebVitals && results.pageSpeedInsights 
          ? this.identifyCriticalIssues(results.coreWebVitals, results.pageSpeedInsights)
          : [],
        recommendations: results.coreWebVitals && results.pageSpeedInsights
          ? this.generatePerformanceRecommendations(results.coreWebVitals, results.pageSpeedInsights)
          : []
      },
      warnings: results.errors.length > 0 ? results.errors : undefined
    };
  }

  getPerformanceGrade(score) {
    if (score >= 90) return 'A';
    if (score >= 80) return 'B';
    if (score >= 70) return 'C';
    if (score >= 60) return 'D';
    return 'F';
  }

  identifyCriticalIssues(coreWebVitals, pageSpeedInsights) {
    const issues = [];
    
    if (coreWebVitals.lcp.status === 'poor') {
      issues.push('Critical: Largest Contentful Paint is too slow');
    }
    if (coreWebVitals.fid.status === 'poor') {
      issues.push('Critical: First Input Delay is too high');
    }
    if (coreWebVitals.cls.status === 'poor') {
      issues.push('Critical: Cumulative Layout Shift is too high');
    }
    if (pageSpeedInsights.performanceScore < 50) {
      issues.push('Critical: Overall performance score is very low');
    }

    return issues;
  }

  generatePerformanceRecommendations(coreWebVitals, pageSpeedInsights) {
    const recommendations = [];
    
    if (coreWebVitals.lcp.status !== 'good') {
      recommendations.push('Optimize Largest Contentful Paint by improving server response times and optimizing images');
    }
    if (coreWebVitals.fid.status !== 'good') {
      recommendations.push('Reduce First Input Delay by minimizing JavaScript execution time');
    }
    if (coreWebVitals.cls.status !== 'good') {
      recommendations.push('Improve Cumulative Layout Shift by setting size attributes on images and ads');
    }
    if (pageSpeedInsights.performanceScore < 70) {
      recommendations.push('Consider implementing a Content Delivery Network (CDN)');
      recommendations.push('Enable compression and minification for CSS and JavaScript files');
    }

    return recommendations;
  }
}

module.exports = new PerformanceService();
