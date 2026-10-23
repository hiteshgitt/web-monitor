const axios = require('axios');
const Website = require('../models/Website');
const MonitoringData = require('../models/MonitoringData');
const Incident = require('../models/Incident');
const analyticsService = require('./analyticsService');
const performanceService = require('./performanceService');
const securityService = require('./securityService');
const aiInsightsService = require('./aiInsightsService');

const VALID_STATUSES = ['healthy', 'warning', 'error', 'offline'];
// A check counts towards uptime when the site answered and its monitor API responded
const UP_STATUSES = ['healthy', 'warning'];

// GET that records the round-trip time (ms) as seen by the monitor
async function timedGet(url, options) {
  const start = process.hrtime.bigint();
  const response = await axios.get(url, options);
  response.elapsedMs = Math.round(Number(process.hrtime.bigint() - start) / 1e6);
  return response;
}

// Integrations may report their own status words; anything unknown is treated as a warning
function normalizeStatus(status) {
  if (!status) return 'healthy';
  return VALID_STATUSES.includes(status) ? status : 'warning';
}

// AI insights cost API quota (Gemini free tier: ~20 requests/day), so reuse them per site
const AI_CACHE_MS = (parseFloat(process.env.AI_INSIGHTS_CACHE_HOURS) || 12) * 60 * 60 * 1000;

class MonitoringService {
  constructor() {
    this.isRunning = false;
    this.interval = null;
    this.aiInsightsCache = new Map(); // websiteId -> { at, data }
  }

  // Start monitoring all websites
  startMonitoring() {
    if (this.isRunning) return;
    
    this.isRunning = true;
    this.interval = setInterval(async () => {
      await this.checkAllWebsites();
    }, process.env.MONITORING_INTERVAL || 60000); // Default 1 minute
    
    console.log('Website monitoring started');
  }

  // Stop monitoring
  stopMonitoring() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    this.isRunning = false;
    console.log('Website monitoring stopped');
  }

  // Check all websites
  async checkAllWebsites() {
    try {
      const websites = await Website.find({ monitoringEnabled: true });
      
      for (const website of websites) {
        await this.checkWebsite(website);
      }
    } catch (error) {
      console.error('Error checking websites:', error);
    }
  }

  // Check individual website
  async checkWebsite(website) {
    try {
      const result = await this.performHealthCheck(website);
      const isUp = UP_STATUSES.includes(result.status);

      // Save monitoring data (uptime here is this single check: 100 = up, 0 = down)
      const monitoringData = new MonitoringData({
        websiteId: website._id,
        status: result.status,
        responseTime: isUp ? (result.responseTime ?? 0) : 0,
        statusCode: result.statusCode ?? 0,
        uptime: isUp ? 100 : 0,
        error: result.error,
        metrics: result.metrics
      });

      await monitoringData.save();

      // Track incidents (downtime) when status is not healthy
      await this.recordIncident(website._id, result.status, result.error?.message || '', new Date());

      // Update website status with all dynamic data
      website.status = result.status;
      website.responseTime = isUp ? (result.responseTime ?? null) : null;
      website.uptime = await this.computeUptimePercent(website._id, 30);
      website.lastChecked = new Date();

      // Update analytics data (null = not measurable without an analytics integration)
      if (result.analytics) {
        website.analytics = {
          totalVisitors: result.analytics.totalVisitors ?? null,
          totalPageViews: result.analytics.totalPageViews ?? null,
          bounceRate: result.analytics.bounceRate ?? null,
          avgSessionDuration: result.analytics.avgSessionDuration ?? null,
          seoScore: result.seo?.score || 0,
          securityScore: result.security?.securityScore || 0
        };
      }
      
      // Update performance data
      if (result.performance) {
        website.performance = {
          loadTime: result.performance.loadTime || 0,
          serverResponseTime: result.performance.serverResponseTime || 0,
          databaseQueryTime: result.performance.databaseQueryTime || 0,
          memoryUsage: result.performance.memoryUsage || 0,
          memoryPeak: result.performance.memoryPeak || 0,
          cpuUsage: result.performance.cpuUsage || 0,
          performanceScore: result.performance.performanceScore || 0,
          activePlugins: result.performance.activePlugins || 0,
          recommendations: result.performance.recommendations || []
        };
      }
      
      // Update SEO data
      if (result.seo) {
        website.seo = {
          score: result.seo.score || 0,
          metaTags: result.seo.metaTags || 'incomplete',
          altTags: result.seo.altTags || 0,
          headingStructure: result.seo.headingStructure || 'unknown',
          internalLinks: result.seo.internalLinks || 0,
          externalLinks: result.seo.externalLinks || 0,
          sslEnabled: result.seo.sslEnabled || false,
          siteTitle: result.seo.siteTitle || '',
          siteDescription: result.seo.siteDescription || '',
          totalContent: result.seo.totalContent || 0,
          seoIssues: result.seo.seoIssues || [],
          recommendations: result.seo.recommendations || []
        };
      }
      
      // Update security data
      if (result.security) {
        website.security = {
          sslStatus: result.security.sslStatus || 'disabled',
          firewall: result.security.firewall || 'none',
          malwareScan: result.security.malwareScan || 'unknown',
          vulnerabilityScan: result.security.vulnerabilityScan || 'unknown',
          securityScore: result.security.securityScore || 0,
          securityPlugins: result.security.securityPlugins || 0,
          totalPlugins: result.security.totalPlugins || 0,
          outdatedPlugins: result.security.outdatedPlugins || 0,
          wordpressVersion: result.security.wordpressVersion || '',
          recommendations: result.security.recommendations || []
        };
      }
      
      await website.save();
      
      console.log(`Checked ${website.name}: ${result.status}`);
      
    } catch (error) {
      console.error(`Error checking website ${website.name}:`, error);
      
      // Save error data
      const monitoringData = new MonitoringData({
        websiteId: website._id,
        status: 'error',
        responseTime: 0,
        statusCode: 0,
        uptime: 0,
        error: {
          message: error.message,
          code: 'CHECK_FAILED'
        }
      });
      
      await monitoringData.save();
      await this.recordIncident(website._id, 'error', error.message, new Date());
    }
  }

  // Share of checks in the window where the site was up, as a percentage (null if no checks yet)
  async computeUptimePercent(websiteId, days = 30) {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const [total, up] = await Promise.all([
      MonitoringData.countDocuments({ websiteId, timestamp: { $gte: since } }),
      MonitoringData.countDocuments({ websiteId, timestamp: { $gte: since }, status: { $in: UP_STATUSES } })
    ]);
    return total > 0 ? Math.round((up / total) * 1000) / 10 : null;
  }

  async recordIncident(websiteId, status, message, timestamp) {
    const isHealthy = status === 'healthy';
    const open = await Incident.findOne({ websiteId, endedAt: null }).sort({ startedAt: -1 });
    if (isHealthy) {
      if (open) {
        open.endedAt = timestamp;
        await open.save();
      }
    } else {
      if (open) {
        open.lastChecked = timestamp;
        open.status = status;
        open.message = message || open.message;
        await open.save();
      } else {
        await Incident.create({
          websiteId,
          startedAt: timestamp,
          status,
          message: message || '',
          lastChecked: timestamp
        });
      }
    }
  }

  // One-off check used when adding/editing a site; nothing is saved
  async verifyConnection({ url, platform, apiKey }) {
    const result = await this.performHealthCheck({ url: (url || '').replace(/\/$/, ''), platform, apiKey });
    const ok = UP_STATUSES.includes(result.status) && !result.error;
    return {
      ok,
      status: result.status,
      responseTime: result.responseTime ?? null,
      code: result.error?.code || null,
      message: ok ? 'Connection verified' : (result.error?.message || `Site reported status "${result.status}"`)
    };
  }

  // Perform health check based on platform
  async performHealthCheck(website) {
    try {
      switch (website.platform) {
        case 'wordpress':
          return await this.checkWordPress(website);
        case 'nextjs':
          return await this.checkNextJS(website);
        case 'laravel':
        case 'php':
          return await this.checkLaravel(website);
        case 'codeigniter':
          return await this.checkCodeIgniter(website);
        default:
          return await this.checkGeneric(website);
      }
    } catch (error) {
      return {
        status: 'error',
        error: {
          message: error.message,
          code: 'HEALTH_CHECK_FAILED'
        }
      };
    }
  }

  // Build WordPress REST URL: pretty (wp-json) or fallback (?rest_route=) when rewrites fail
  _wpApiUrl(wpBase, endpoint, useRestRoute = false) {
    if (useRestRoute) {
      return `${wpBase}/?rest_route=/webmonitor-advanced/v1/${endpoint}`;
    }
    return `${wpBase}/wp-json/webmonitor-advanced/v1/${endpoint}`;
  }

  // WordPress health check – return "error"/"offline" if API doesn't exist
  async checkWordPress(website) {
    const wpBase = (website.url || '').replace(/\/$/, '');
    if (!wpBase) {
      return { status: 'error', error: { message: 'Website URL is missing.', code: 'INVALID_URL' } };
    }
    const opts = {
      timeout: 10000,
      headers: { 'Authorization': `Bearer ${website.apiKey}` },
      validateStatus: (s) => s < 500
    };

    try {
      // Health is fetched on its own so its round-trip time isn't skewed by the parallel data requests
      let healthResponse;
      let useRestRoute = false;
      try {
        healthResponse = await timedGet(this._wpApiUrl(wpBase, 'health'), opts);
        // If 404 with pretty URL, retry with ?rest_route= (works when rewrites fail despite Post name)
        if (healthResponse.status === 404) {
          const retry = await timedGet(this._wpApiUrl(wpBase, 'health', true), opts).catch(() => null);
          if (retry && retry.status !== 404) {
            healthResponse = retry;
            useRestRoute = true;
          }
        }
      } catch (networkError) {
        console.error(`[Monitor] Connection error for ${website.url}:`, networkError.message);
        return {
          status: 'offline',
          error: {
            message: `Site unreachable: ${networkError.message}`,
            code: networkError.code || 'CONNECTION_FAILED'
          }
        };
      }

      // Check if health endpoint exists (404 = API not installed or site offline)
      if (healthResponse.status === 404) {
        return {
          status: 'offline',
          statusCode: 404,
          error: {
            message: 'WordPress Web Monitor plugin not found or site is returning 404.',
            code: 'API_NOT_FOUND'
          }
        };
      }
      
      if (healthResponse.status === 401 || healthResponse.status === 403) {
        return {
          status: 'error',
          statusCode: healthResponse.status,
          error: {
            message: 'Invalid API key. Check your WordPress API key.',
            code: 'INVALID_API_KEY'
          }
        };
      }
      
      if (healthResponse.status !== 200 || typeof healthResponse.data !== 'object') {
        return {
          status: 'offline',
          statusCode: healthResponse.status,
          error: {
            message: `API returned status ${healthResponse.status}`,
            code: 'API_ERROR'
          }
        };
      }

      const [analyticsResponse, performanceResponse, seoResponse, securityResponse] = await Promise.all(
        ['analytics', 'performance', 'seo', 'security'].map((ep) =>
          axios.get(this._wpApiUrl(wpBase, ep, useRestRoute), opts).catch(() => null)
        )
      );
      // A section whose endpoint failed is left out so the last good values are kept
      const dataOf = (r) => (r && r.status === 200 && r.data && typeof r.data === 'object' ? r.data : null);

      const healthData = healthResponse.data;
      const analyticsData = dataOf(analyticsResponse);
      const performanceData = dataOf(performanceResponse);
      const seoData = dataOf(seoResponse);
      const securityData = dataOf(securityResponse);
      
      return {
        status: normalizeStatus(healthData.status),
        responseTime: healthResponse.elapsedMs,
        statusCode: healthResponse.status,
        metrics: {
          loadTime: healthResponse.elapsedMs,
          serverProcessingTime: healthData.response_time ?? null,
          sslValid: website.url.startsWith('https://')
        },
        analytics: analyticsData && {
          totalVisitors: analyticsData.totalVisitors ?? null,
          totalPageViews: analyticsData.pageViews ?? null,
          bounceRate: analyticsData.bounceRate ?? null,
          avgSessionDuration: analyticsData.avgSessionDuration ?? null,
          topPages: analyticsData.top_pages || [],
          contentStats: analyticsData.content_stats || {}
        },
        performance: performanceData && {
          loadTime: performanceData.load_time || 0,
          serverResponseTime: performanceData.server_response_time || 0,
          databaseQueryTime: performanceData.database_query_time || 0,
          memoryUsage: performanceData.memory_usage || 0,
          memoryPeak: performanceData.memory_peak || 0,
          cpuUsage: performanceData.cpu_usage ?? null,
          performanceScore: performanceData.performance_score ?? null,
          activePlugins: performanceData.active_plugins || 0,
          recommendations: performanceData.recommendations || []
        },
        seo: seoData && {
          score: seoData.score ?? null,
          metaTags: seoData.meta_tags || 'incomplete',
          altTags: seoData.alt_tags || 0,
          headingStructure: seoData.heading_structure || 'unknown',
          internalLinks: seoData.internal_links || 0,
          externalLinks: seoData.external_links || 0,
          sslEnabled: seoData.ssl_enabled || false,
          siteTitle: seoData.site_title || '',
          siteDescription: seoData.site_description || '',
          totalContent: seoData.total_content || 0,
          seoIssues: seoData.seo_issues || [],
          recommendations: seoData.recommendations || []
        },
        security: securityData && {
          sslStatus: securityData.ssl_status || 'disabled',
          firewall: securityData.firewall || 'none',
          malwareScan: securityData.malware_scan || 'unknown',
          vulnerabilityScan: securityData.vulnerability_scan || 'unknown',
          securityScore: securityData.security_score ?? null,
          securityPlugins: securityData.security_plugins || 0,
          totalPlugins: securityData.total_plugins || 0,
          outdatedPlugins: securityData.outdated_plugins || 0,
          wordpressVersion: securityData.wordpress_version || '',
          recommendations: securityData.recommendations || []
        }
      };
    } catch (error) {
      return {
        status: 'error',
        error: {
          message: error.message,
          code: 'WP_CHECK_FAILED'
        }
      };
    }
  }

  // Next.js health check – return "error"/"offline" if API doesn't exist
  async checkNextJS(website) {
    try {
      const response = await timedGet(`${website.url}/api/webmonitor/health`, {
        timeout: 10000,
        headers: {
          'Authorization': `Bearer ${website.apiKey}`
        },
        validateStatus: (s) => s < 500
      });
      
      if (response.status === 404) {
        return {
          status: 'error',
          error: {
            message: 'Next.js API route not found. Install the integration.',
            code: 'API_NOT_FOUND'
          }
        };
      }
      
      if (response.status === 401) {
        return {
          status: 'error',
          error: {
            message: 'Invalid API key. Check your WEBMONITOR_API_KEY.',
            code: 'INVALID_API_KEY'
          }
        };
      }
      
      if (response.status !== 200) {
        return {
          status: 'error',
          error: {
            message: `API returned status ${response.status}`,
            code: 'API_ERROR'
          }
        };
      }
      
      const ct = (response.headers['content-type'] || '').toLowerCase();
      if (ct.includes('text/html')) {
        return {
          status: 'error',
          error: {
            message: 'API endpoint returned HTML instead of JSON. Check URL and integration.',
            code: 'API_NOT_FOUND'
          }
        };
      }
      
      const data = response.data;
      
      return {
        status: normalizeStatus(data.status),
        responseTime: response.elapsedMs,
        statusCode: response.status,
        metrics: {
          loadTime: response.elapsedMs,
          serverProcessingTime: data.response_time ?? null,
          sslValid: website.url.startsWith('https://'),
          nextjsVersion: data.nextjs_version,
          nodeVersion: data.node_version
        }
      };
    } catch (error) {
      const isConnectionError = error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT' || error.message.includes('timeout');
      return {
        status: isConnectionError ? 'offline' : 'error',
        error: {
          message: error.message,
          code: isConnectionError ? 'CONNECTION_FAILED' : 'NEXTJS_CHECK_FAILED'
        }
      };
    }
  }

  // Laravel health check – status "error"/"offline" if API doesn't exist; "warning" only if health OK but packages missing
  async checkLaravel(website) {
    try {
      const baseUrl = (website.url || '').replace(/\/$/, '');
      const healthResponse = await timedGet(`${baseUrl}/api/webmonitor/health`, {
        timeout: 10000,
        headers: { 'Authorization': `Bearer ${website.apiKey}` },
        validateStatus: (s) => s < 500 // Don't throw on 4xx, check status explicitly
      });

      // If health endpoint doesn't exist (404) or unauthorized (401), API is not connected
      if (healthResponse.status === 404) {
        return {
          status: 'error',
          error: {
            message: 'API endpoint not found. Install the Laravel integration.',
            code: 'API_NOT_FOUND'
          }
        };
      }
      
      if (healthResponse.status === 401) {
        return {
          status: 'error',
          error: {
            message: 'Invalid API key. Check your WEBMONITOR_API_KEY.',
            code: 'INVALID_API_KEY'
          }
        };
      }

      if (healthResponse.status !== 200) {
        return {
          status: 'error',
          error: {
            message: `API returned status ${healthResponse.status}`,
            code: 'API_ERROR'
          }
        };
      }

      // Check if response is JSON (API exists) vs HTML (wrong endpoint)
      const ct = (healthResponse.headers['content-type'] || '').toLowerCase();
      if (ct.includes('text/html')) {
        return {
          status: 'error',
          error: {
            message: 'API endpoint returned HTML instead of JSON. Check URL and integration.',
            code: 'API_NOT_FOUND'
          }
        };
      }

      const data = healthResponse.data;
      let status = normalizeStatus(data.status);
      let apiPackagesAvailable = true;

      // Only check packages if health works - if packages missing, show warning
      try {
        const packagesRes = await axios.get(`${baseUrl}/api/webmonitor/packages`, {
          timeout: 5000,
          headers: { 'Authorization': `Bearer ${website.apiKey}` },
          validateStatus: (s) => s < 500
        });
        const packagesCt = (packagesRes.headers['content-type'] || '').toLowerCase();
        if (packagesRes.status === 404 || packagesCt.includes('text/html')) {
          apiPackagesAvailable = false;
          status = 'warning'; // Health works but packages missing = warning
        }
      } catch (_) {
        apiPackagesAvailable = false;
        status = 'warning'; // Health works but packages check failed = warning
      }

      return {
        status,
        responseTime: healthResponse.elapsedMs,
        statusCode: healthResponse.status,
        apiPackagesAvailable,
        metrics: {
          loadTime: healthResponse.elapsedMs,
          serverProcessingTime: data.response_time ?? null,
          sslValid: (website.url || '').startsWith('https://'),
          phpVersion: data.php_version,
          laravelVersion: data.framework_version,
          memoryUsage: data.checks?.memory_usage || 0
        }
      };
    } catch (error) {
      // Network errors, timeouts, etc. = offline/error
      const isConnectionError = error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT' || error.message.includes('timeout');
      return {
        status: isConnectionError ? 'offline' : 'error',
        error: {
          message: error.message,
          code: isConnectionError ? 'CONNECTION_FAILED' : 'LARAVEL_CHECK_FAILED'
        }
      };
    }
  }

  // CodeIgniter health check – same: "error"/"offline" if API doesn't exist; "warning" only if health OK but packages missing
  async checkCodeIgniter(website) {
    try {
      const baseUrl = (website.url || '').replace(/\/$/, '');
      const healthResponse = await timedGet(`${baseUrl}/api/webmonitor/health`, {
        timeout: 10000,
        headers: { 'Authorization': `Bearer ${website.apiKey}` },
        validateStatus: (s) => s < 500
      });

      if (healthResponse.status === 404) {
        return {
          status: 'error',
          error: {
            message: 'API endpoint not found. Install the CodeIgniter integration.',
            code: 'API_NOT_FOUND'
          }
        };
      }
      
      if (healthResponse.status === 401) {
        return {
          status: 'error',
          error: {
            message: 'Invalid API key. Check your WEBMONITOR_API_KEY.',
            code: 'INVALID_API_KEY'
          }
        };
      }

      if (healthResponse.status !== 200) {
        return {
          status: 'error',
          error: {
            message: `API returned status ${healthResponse.status}`,
            code: 'API_ERROR'
          }
        };
      }

      const ct = (healthResponse.headers['content-type'] || '').toLowerCase();
      if (ct.includes('text/html')) {
        return {
          status: 'error',
          error: {
            message: 'API endpoint returned HTML instead of JSON. Check URL and integration.',
            code: 'API_NOT_FOUND'
          }
        };
      }

      const data = healthResponse.data;
      let status = normalizeStatus(data.status);
      let apiPackagesAvailable = true;

      try {
        const packagesRes = await axios.get(`${baseUrl}/api/webmonitor/packages`, {
          timeout: 5000,
          headers: { 'Authorization': `Bearer ${website.apiKey}` },
          validateStatus: (s) => s < 500
        });
        const packagesCt = (packagesRes.headers['content-type'] || '').toLowerCase();
        if (packagesRes.status === 404 || packagesCt.includes('text/html')) {
          apiPackagesAvailable = false;
          status = 'warning';
        }
      } catch (_) {
        apiPackagesAvailable = false;
        status = 'warning';
      }

      return {
        status,
        responseTime: healthResponse.elapsedMs,
        statusCode: healthResponse.status,
        apiPackagesAvailable,
        metrics: {
          loadTime: healthResponse.elapsedMs,
          serverProcessingTime: data.response_time ?? null,
          sslValid: (website.url || '').startsWith('https://'),
          phpVersion: data.php_version,
          codeigniterVersion: data.framework_version,
          memoryUsage: data.checks?.memory_usage || 0
        }
      };
    } catch (error) {
      const isConnectionError = error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT' || error.message.includes('timeout');
      return {
        status: isConnectionError ? 'offline' : 'error',
        error: {
          message: error.message,
          code: isConnectionError ? 'CONNECTION_FAILED' : 'CI_CHECK_FAILED'
        }
      };
    }
  }

  // Generic health check – URL reachable but no API; show "error" since no API connection
  async checkGeneric(website) {
    try {
      const response = await timedGet(website.url, {
        timeout: 10000
      });
      // URL is reachable but no API = error (not warning, since API is required)
      return {
        status: 'error',
        responseTime: response.elapsedMs,
        statusCode: response.status,
        apiConnected: false,
        error: {
          message: 'No API integration detected. Add API integration to enable monitoring.',
          code: 'NO_API'
        },
        metrics: {
          loadTime: response.elapsedMs,
          serverProcessingTime: null,
          sslValid: (website.url || '').startsWith('https://')
        }
      };
    } catch (error) {
      const isConnectionError = error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT' || error.message.includes('timeout');
      return {
        status: isConnectionError ? 'offline' : 'error',
        error: {
          message: error.message,
          code: isConnectionError ? 'CONNECTION_FAILED' : 'GENERIC_CHECK_FAILED'
        }
      };
    }
  }

  /**
   * Get server/hosting info: downtime hours (from real MonitoringData), disk & bandwidth when integrated.
   * Downtime is computed from historical checks; disk/bandwidth return null until a real integration exists.
   */
  async getServerInfo(website) {
    const intervalMs = website.settings?.checkInterval || parseInt(process.env.MONITORING_INTERVAL, 10) || 60000;
    const intervalHours = intervalMs / (1000 * 60 * 60);
    const now = new Date();

    const windows = [
      { label: '24h', start: new Date(now - 24 * 60 * 60 * 1000) },
      { label: '7d', start: new Date(now - 7 * 24 * 60 * 60 * 1000) },
      { label: '30d', start: new Date(now - 30 * 24 * 60 * 60 * 1000) }
    ];

    const downtimeHours = { last24h: 0, last7d: 0, last30d: 0 };
    const keys = ['last24h', 'last7d', 'last30d'];

    for (let i = 0; i < windows.length; i++) {
      const counts = await MonitoringData.countDocuments({
        websiteId: website._id,
        timestamp: { $gte: windows[i].start },
        status: { $in: ['offline', 'error'] }
      });
      downtimeHours[keys[i]] = Math.round(counts * intervalHours * 100) / 100;
    }

    const uptimePercent = await this.computeUptimePercent(website._id, 30);

    let diskSpace = null;
    let bandwidth = null;
    let serverResourcesMessage = null;

    try {
      const sr = await performanceService.getServerResources(website);
      if (sr && !sr.error) {
        diskSpace = sr.diskSpace || null;
        bandwidth = sr.bandwidth || null;
      }
    } catch (e) {
      serverResourcesMessage = 'Disk and bandwidth require a server monitoring integration (e.g. cPanel API, server agent).';
    }

    if (!diskSpace && !bandwidth && !serverResourcesMessage) {
      serverResourcesMessage = 'Disk and bandwidth require a server monitoring integration (e.g. cPanel API, server agent).';
    }

    return {
      downtimeHours,
      uptimePercent,
      lastChecked: website.lastChecked || null,
      status: website.status || 'unknown',
      checkIntervalMinutes: Math.round(intervalMs / 60000),
      diskSpace,
      bandwidth,
      serverResourcesMessage
    };
  }

  // Comprehensive monitoring with all advanced features
  async getComprehensiveWebsiteData(website) {
    try {
      // Get basic health check first
      const basicHealth = await this.performHealthCheck(website);
      
      // Get advanced data with fallbacks
      let advancedAnalytics, performanceData, securityData, aiInsights, pluginsData;
      
      try {
        advancedAnalytics = await analyticsService.getComprehensiveAnalytics(website);
      } catch (error) {
        console.error('Analytics service error:', error.message);
        // Don't use mock data - let error propagate or handle gracefully
        advancedAnalytics = {
          error: error.message,
          statusCode: error.statusCode,
          service: 'Analytics'
        };
      }
      
      try {
        performanceData = await performanceService.getComprehensivePerformance(website);
      } catch (error) {
        console.error('Performance service error:', error.message);
        // Don't use mock data - let error propagate or handle gracefully
        performanceData = {
          error: error.message,
          statusCode: error.statusCode,
          service: 'Performance'
        };
      }
      
      try {
        securityData = await securityService.getComprehensiveSecurity(website);
      } catch (error) {
        console.error('Security service error:', error.message);
        // Don't use mock data - let error propagate or handle gracefully
        securityData = {
          error: error.message,
          statusCode: error.statusCode,
          service: 'Security'
        };
      }
      
      try {
        // Spreading a mongoose document doesn't copy its fields, so work from a plain object.
        // External services win when configured; otherwise use the site's own integration data.
        const plain = typeof website.toObject === 'function' ? website.toObject() : website;
        const cacheKey = String(website._id);
        const cached = this.aiInsightsCache.get(cacheKey);
        if (cached && Date.now() - cached.at < AI_CACHE_MS) {
          aiInsights = { ...cached.data, cachedAt: new Date(cached.at) };
        } else {
          aiInsights = await aiInsightsService.getComprehensiveAIAnalysis({
            ...plain,
            analytics: advancedAnalytics,
            performance: performanceData?.error ? plain.performance : performanceData,
            security: securityData?.error ? plain.security : securityData
          });
          // Failures throw above and are never cached, so the next load retries
          this.aiInsightsCache.set(cacheKey, { at: Date.now(), data: aiInsights });
        }
      } catch (error) {
        console.error('AI insights service error:', error.message);
        // Don't use mock data - let error propagate or handle gracefully
        aiInsights = {
          error: error.message,
          statusCode: error.statusCode,
          service: 'AI Insights'
        };
      }

      // Get plugins/packages data
      try {
        if (website.platform === 'wordpress') {
          const pluginsResponse = await this._fetchWordPressEndpoint(website, 'plugins');
          if (pluginsResponse && pluginsResponse.data) pluginsData = pluginsResponse.data;
        } else if (website.platform === 'nextjs') {
          // Next.js libraries handled separately
        } else if (website.platform === 'laravel' || website.platform === 'codeigniter' || website.platform === 'php') {
          // PHP projects use Composer packages
          const baseUrl = website.url.replace(/\/$/, '');
          const packagesResponse = await axios.get(`${baseUrl}/api/webmonitor/packages`, {
            timeout: 10000,
            headers: { 'Authorization': `Bearer ${website.apiKey}` }
          }).catch(() => null);
          if (packagesResponse) {
            pluginsData = packagesResponse.data; // Store as packages for PHP projects
          }
        }
      } catch (error) {
        console.error('Plugins/packages fetch error:', error.message);
        pluginsData = null;
      }

      let logsData = null;
      let recommendationsData = null;
      try {
        logsData = await this.getLogs(website);
        recommendationsData = await this.getRecommendations(website);
      } catch (e) {
        console.error('Logs/recommendations fetch error:', e.message);
      }

      let serverInfo = null;
      try {
        serverInfo = await this.getServerInfo(website);
      } catch (e) {
        console.error('Server info error:', e.message);
      }

      return {
        basic: basicHealth,
        analytics: advancedAnalytics,
        performance: performanceData,
        security: securityData,
        aiInsights: aiInsights,
        plugins: pluginsData,
        logs: logsData,
        recommendations: recommendationsData,
        serverInfo,
        timestamp: new Date(),
        website: {
          id: website._id,
          name: website.name,
          url: website.url,
          platform: website.platform
        }
      };
    } catch (error) {
      console.error(`Error getting comprehensive data for ${website.name}:`, error);
      // Don't return mock data - throw error instead
      const apiError = new Error(`Failed to get comprehensive website data: ${error.message}`);
      apiError.statusCode = error.statusCode || 500;
      apiError.originalError = error;
      throw apiError;
    }
  }

  async _fetchWordPressEndpoint(website, endpoint) {
    const wpBase = (website.url || '').replace(/\/$/, '');
    const opts = {
      timeout: 10000,
      headers: { 'Authorization': `Bearer ${website.apiKey}` },
      validateStatus: (s) => s < 500
    };
    let res = await axios.get(this._wpApiUrl(wpBase, endpoint, false), opts).catch(() => null);
    if (!res || res.status === 404) {
      res = await axios.get(this._wpApiUrl(wpBase, endpoint, true), opts).catch(() => null);
    }
    return res;
  }

  async getLogs(website) {
    const fallback = { error_log: { enabled: false, message: '' }, access_summary: {} };
    try {
      if (website.platform === 'wordpress') {
        const res = await this._fetchWordPressEndpoint(website, 'logs');
        if (res && res.data) return res.data;
        return fallback;
      }
      if (website.platform === 'nextjs') {
        const base = website.url.replace(/\/$/, '');
        const res = await axios.get(`${base}/api/webmonitor/logs`, {
          timeout: 10000,
          headers: { 'Authorization': `Bearer ${website.apiKey}` }
        });
        return res.data || fallback;
      }
      if (['laravel', 'codeigniter', 'php'].includes(website.platform)) {
        const base = website.url.replace(/\/$/, '');
        const res = await axios.get(`${base}/api/webmonitor/logs`, {
          timeout: 10000,
          headers: { 'Authorization': `Bearer ${website.apiKey}` }
        });
        return res.data || fallback;
      }
    } catch (error) {
      console.error('Logs fetch error:', error.message);
      fallback.error_log.message = error.message || 'Logs endpoint not available. Add /api/webmonitor/logs to your integration.';
    }
    return fallback;
  }

  async getRecommendations(website) {
    const fallback = { recommendations: [], count: 0 };
    try {
      if (website.platform === 'wordpress') {
        const res = await this._fetchWordPressEndpoint(website, 'recommendations');
        if (res && res.data) return res.data;
        return fallback;
      }
      if (website.platform === 'nextjs') {
        const base = website.url.replace(/\/$/, '');
        const res = await axios.get(`${base}/api/webmonitor/recommendations`, {
          timeout: 10000,
          headers: { 'Authorization': `Bearer ${website.apiKey}` }
        });
        return res.data || fallback;
      }
      if (['laravel', 'codeigniter', 'php'].includes(website.platform)) {
        const base = website.url.replace(/\/$/, '');
        const res = await axios.get(`${base}/api/webmonitor/recommendations`, {
          timeout: 10000,
          headers: { 'Authorization': `Bearer ${website.apiKey}` }
        });
        return res.data || fallback;
      }
    } catch (error) {
      console.error('Recommendations fetch error:', error.message);
    }
    return fallback;
  }

  async getIncidents(websiteId, days = 30) {
    const since = new Date();
    since.setDate(since.getDate() - days);
    const incidents = await Incident.find({
      websiteId,
      $or: [{ startedAt: { $gte: since } }, { endedAt: null }]
    }).sort({ startedAt: -1 }).limit(100).lean();
    return incidents;
  }

  // Enhanced Next.js check with all advanced features
  async getEnhancedNextJSData(website) {
    try {
      // Get all Next.js API endpoints including libraries
      const [
        healthResponse,
        analyticsResponse,
        performanceResponse,
        seoResponse,
        securityResponse,
        librariesResponse
      ] = await Promise.all([
        axios.get(`${website.url}/api/webmonitor/health`, {
          timeout: 10000,
          headers: { 'Authorization': `Bearer ${website.apiKey}` }
        }).catch(() => null),
        axios.get(`${website.url}/api/webmonitor/analytics`, {
          timeout: 10000,
          headers: { 'Authorization': `Bearer ${website.apiKey}` }
        }).catch(() => null),
        axios.get(`${website.url}/api/webmonitor/performance`, {
          timeout: 10000,
          headers: { 'Authorization': `Bearer ${website.apiKey}` }
        }).catch(() => null),
        axios.get(`${website.url}/api/webmonitor/seo`, {
          timeout: 10000,
          headers: { 'Authorization': `Bearer ${website.apiKey}` }
        }).catch(() => null),
        axios.get(`${website.url}/api/webmonitor/security`, {
          timeout: 10000,
          headers: { 'Authorization': `Bearer ${website.apiKey}` }
        }).catch(() => null),
        axios.get(`${website.url}/api/webmonitor/libraries`, {
          timeout: 10000,
          headers: { 'Authorization': `Bearer ${website.apiKey}` }
        }).catch(() => null)
      ]);

      // Combine all data
      const nextJSData = {
        health: healthResponse?.data || {},
        analytics: analyticsResponse?.data || {},
        performance: performanceResponse?.data || {},
        seo: seoResponse?.data || {},
        security: securityResponse?.data || {},
        libraries: librariesResponse?.data || {}
      };

      // Get advanced external data
      const [
        advancedAnalytics,
        performanceInsights,
        securityInsights,
        aiAnalysis
      ] = await Promise.all([
        analyticsService.getComprehensiveAnalytics(website),
        performanceService.getComprehensivePerformance(website),
        securityService.getComprehensiveSecurity(website),
        aiInsightsService.getComprehensiveAIAnalysis({
          ...website,
          ...nextJSData
        })
      ]);

      return {
        nextjs: nextJSData,
        advancedAnalytics,
        performanceInsights,
        securityInsights,
        aiAnalysis,
        timestamp: new Date()
      };
    } catch (error) {
      console.error(`Error getting enhanced Next.js data for ${website.name}:`, error);
      return null;
    }
  }

  // Enhanced PHP check with all advanced features (Laravel, CodeIgniter, Core PHP)
  async getEnhancedPHPData(website) {
    try {
      // Remove trailing slash from URL
      const baseUrl = website.url.replace(/\/$/, '');
      // Get all PHP API endpoints
      const [
        healthResponse,
        analyticsResponse,
        performanceResponse,
        seoResponse,
        securityResponse,
        packagesResponse
      ] = await Promise.all([
        axios.get(`${baseUrl}/api/webmonitor/health`, {
          timeout: 10000,
          headers: { 'Authorization': `Bearer ${website.apiKey}` }
        }).catch(() => null),
        axios.get(`${baseUrl}/api/webmonitor/analytics`, {
          timeout: 10000,
          headers: { 'Authorization': `Bearer ${website.apiKey}` }
        }).catch(() => null),
        axios.get(`${baseUrl}/api/webmonitor/performance`, {
          timeout: 10000,
          headers: { 'Authorization': `Bearer ${website.apiKey}` }
        }).catch(() => null),
        axios.get(`${baseUrl}/api/webmonitor/seo`, {
          timeout: 10000,
          headers: { 'Authorization': `Bearer ${website.apiKey}` }
        }).catch(() => null),
        axios.get(`${baseUrl}/api/webmonitor/security`, {
          timeout: 10000,
          headers: { 'Authorization': `Bearer ${website.apiKey}` }
        }).catch(() => null),
        axios.get(`${baseUrl}/api/webmonitor/packages`, {
          timeout: 10000,
          headers: { 'Authorization': `Bearer ${website.apiKey}` }
        }).catch(() => null)
      ]);

      // Combine all data
      const phpData = {
        health: healthResponse?.data || {},
        analytics: analyticsResponse?.data || {},
        performance: performanceResponse?.data || {},
        seo: seoResponse?.data || {},
        security: securityResponse?.data || {},
        packages: packagesResponse?.data || {}
      };

      // Get advanced external data
      const [
        advancedAnalytics,
        performanceInsights,
        securityInsights,
        aiAnalysis
      ] = await Promise.all([
        analyticsService.getComprehensiveAnalytics(website),
        performanceService.getComprehensivePerformance(website),
        securityService.getComprehensiveSecurity(website),
        aiInsightsService.getComprehensiveAIAnalysis({
          ...website,
          ...phpData
        })
      ]);

      return {
        php: phpData,
        advancedAnalytics,
        performanceInsights,
        securityInsights,
        aiAnalysis,
        timestamp: new Date()
      };
    } catch (error) {
      console.error(`Error getting enhanced PHP data for ${website.name}:`, error);
      return null;
    }
  }

  // Enhanced WordPress check with all advanced features
  async getEnhancedWordPressData(website) {
    try {
      // Get all WordPress plugin endpoints
      const [
        healthResponse,
        analyticsResponse,
        performanceResponse,
        seoResponse,
        securityResponse,
        pluginsResponse
      ] = await Promise.all([
        axios.get(`${website.url}/wp-json/webmonitor-advanced/v1/health`, {
          timeout: 10000,
          headers: { 'Authorization': `Bearer ${website.apiKey}` }
        }).catch(() => null),
        axios.get(`${website.url}/wp-json/webmonitor-advanced/v1/analytics`, {
          timeout: 10000,
          headers: { 'Authorization': `Bearer ${website.apiKey}` }
        }).catch(() => null),
        axios.get(`${website.url}/wp-json/webmonitor-advanced/v1/performance`, {
          timeout: 10000,
          headers: { 'Authorization': `Bearer ${website.apiKey}` }
        }).catch(() => null),
        axios.get(`${website.url}/wp-json/webmonitor-advanced/v1/seo`, {
          timeout: 10000,
          headers: { 'Authorization': `Bearer ${website.apiKey}` }
        }).catch(() => null),
        axios.get(`${website.url}/wp-json/webmonitor-advanced/v1/security`, {
          timeout: 10000,
          headers: { 'Authorization': `Bearer ${website.apiKey}` }
        }).catch(() => null),
        axios.get(`${website.url}/wp-json/webmonitor-advanced/v1/plugins`, {
          timeout: 10000,
          headers: { 'Authorization': `Bearer ${website.apiKey}` }
        }).catch(() => null)
      ]);

      // Combine all data
      const wordPressData = {
        health: healthResponse?.data || {},
        analytics: analyticsResponse?.data || {},
        performance: performanceResponse?.data || {},
        seo: seoResponse?.data || {},
        security: securityResponse?.data || {},
        plugins: pluginsResponse?.data || {}
      };

      // Get advanced external data
      const [
        advancedAnalytics,
        performanceInsights,
        securityInsights,
        aiAnalysis
      ] = await Promise.all([
        analyticsService.getComprehensiveAnalytics(website),
        performanceService.getComprehensivePerformance(website),
        securityService.getComprehensiveSecurity(website),
        aiInsightsService.getComprehensiveAIAnalysis({
          ...website,
          ...wordPressData
        })
      ]);

      return {
        wordPress: wordPressData,
        advancedAnalytics,
        performanceInsights,
        securityInsights,
        aiAnalysis,
        timestamp: new Date()
      };
    } catch (error) {
      console.error(`Error getting enhanced WordPress data for ${website.name}:`, error);
      return null;
    }
  }
}

module.exports = new MonitoringService();
