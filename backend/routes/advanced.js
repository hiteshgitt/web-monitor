const express = require('express');
const router = express.Router();
const axios = require('axios');
const Website = require('../models/Website');
const monitoringService = require('../services/monitoringService');
const analyticsService = require('../services/analyticsService');
const performanceService = require('../services/performanceService');
const securityService = require('../services/securityService');
const aiInsightsService = require('../services/aiInsightsService');

// Get comprehensive website data with all advanced features
router.get('/comprehensive/:id', async (req, res) => {
  try {
    const website = await Website.findById(req.params.id);
    if (!website) {
      return res.status(404).json({ error: 'Website not found' });
    }

    const comprehensiveData = await monitoringService.getComprehensiveWebsiteData(website);
    res.json(comprehensiveData);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Server / hosting info: downtime hours (from monitoring), disk & bandwidth when integrated
router.get('/server-info/:id', async (req, res) => {
  try {
    const website = await Website.findById(req.params.id);
    if (!website) {
      return res.status(404).json({ error: 'Website not found' });
    }

    const serverInfo = await monitoringService.getServerInfo(website);
    res.json(serverInfo);
  } catch (error) {
    res.status(error.statusCode || 500).json({
      error: error.message,
      ...(error.service && { service: error.service })
    });
  }
});

// Get enhanced WordPress data
router.get('/wordpress/:id', async (req, res) => {
  try {
    const website = await Website.findById(req.params.id);
    if (!website) {
      return res.status(404).json({ error: 'Website not found' });
    }

    if (website.platform !== 'wordpress') {
      return res.status(400).json({ error: 'Website is not a WordPress site' });
    }

    const enhancedData = await monitoringService.getEnhancedWordPressData(website);
    res.json(enhancedData);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get enhanced Next.js data
router.get('/nextjs/:id', async (req, res) => {
  try {
    const website = await Website.findById(req.params.id);
    if (!website) {
      return res.status(404).json({ error: 'Website not found' });
    }

    if (website.platform !== 'nextjs') {
      return res.status(400).json({ error: 'Website is not a Next.js site' });
    }

    const enhancedData = await monitoringService.getEnhancedNextJSData(website);
    res.json(enhancedData);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get enhanced PHP data (Laravel, CodeIgniter, Core PHP)
router.get('/php/:id', async (req, res) => {
  try {
    const website = await Website.findById(req.params.id);
    if (!website) {
      return res.status(404).json({ error: 'Website not found' });
    }

    if (!['laravel', 'codeigniter', 'php'].includes(website.platform)) {
      return res.status(400).json({ error: 'Website is not a PHP-based site' });
    }

    const enhancedData = await monitoringService.getEnhancedPHPData(website);
    res.json(enhancedData);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Plugins data (for WordPress), Libraries data (for Next.js), or Packages data (for PHP)
router.get('/plugins/:id', async (req, res) => {
  try {
    const website = await Website.findById(req.params.id);
    if (!website) {
      return res.status(404).json({ error: 'Website not found' });
    }

    if (website.platform === 'wordpress') {
      // WordPress: Get plugins
      const response = await axios.get(`${website.url}/wp-json/webmonitor-advanced/v1/plugins`, {
        timeout: 10000,
        headers: { 'Authorization': `Bearer ${website.apiKey}` }
      });
      res.json(response.data);
    } else if (website.platform === 'nextjs') {
      // Next.js: Get libraries/packages
      const response = await axios.get(`${website.url}/api/webmonitor/libraries`, {
        timeout: 10000,
        headers: { 'Authorization': `Bearer ${website.apiKey}` }
      });
      res.json(response.data);
    } else if (website.platform === 'laravel' || website.platform === 'codeigniter' || website.platform === 'php') {
      // PHP: Get Composer packages
      try {
        // Remove trailing slash from URL to avoid double slashes
        const baseUrl = website.url.replace(/\/$/, '');
        const packagesUrl = `${baseUrl}/api/webmonitor/packages`;
        console.log(`📦 Fetching packages from: ${packagesUrl}`);
        console.log(`📦 Using API key: ${website.apiKey.substring(0, 20)}...`);
        
        const response = await axios.get(packagesUrl, {
          timeout: 10000,
          headers: { 'Authorization': `Bearer ${website.apiKey}` },
          validateStatus: function (status) {
            // Don't throw error for any status - we'll handle it
            return status < 600;
          }
        });
        
        console.log(`✅ Packages response status: ${response.status}`);
        console.log(`✅ Content-Type:`, response.headers['content-type']);
        
        // Check if response is HTML (error page) instead of JSON
        const contentType = response.headers['content-type'] || '';
        if (contentType.includes('text/html')) {
          console.error('❌ Server returned HTML instead of JSON - likely 404 page');
          return res.status(404).json({
            error: 'API endpoint not found',
            message: 'Server returned HTML (likely 404 page) instead of JSON. Check: 1. URL is correct, 2. Laravel routes configured, 3. Server is running',
            url: packagesUrl,
            status: response.status
          });
        }
        
        // Check if response is actually an error (but returned as JSON)
        if (response.data && response.data.error) {
          console.error('❌ Laravel returned error:', response.data);
          return res.status(response.status || 500).json(response.data);
        }
        
        console.log(`✅ Packages data keys:`, Object.keys(response.data || {}));
        console.log(`✅ Packages data sample:`, JSON.stringify(response.data).substring(0, 200));
        res.json(response.data);
      } catch (error) {
        console.error(`Error fetching packages from ${website.url}:`, error.message);
        console.error(`Full error:`, error);
        
        // Provide detailed error information
        let errorDetails = {
          error: error.message,
          url: `${website.url}/api/webmonitor/packages`,
          platform: website.platform
        };
        
        if (error.response) {
          // Server responded with error status
          errorDetails.status = error.response.status;
          errorDetails.statusText = error.response.statusText;
          errorDetails.data = error.response.data;
          
          // Check if it's a 404 - route might not exist or URL is wrong
          if (error.response.status === 404) {
            errorDetails.message = 'API route not found. Please check: 1. URL is correct (use actual domain/IP, not localhost), 2. Laravel routes are configured, 3. PHP server is running';
          } else if (error.response.status === 401) {
            errorDetails.message = 'API key authentication failed. Verify the API key in .env matches the dashboard.';
          }
          
          res.status(error.response.status).json(errorDetails);
        } else if (error.request) {
          // Request made but no response
          errorDetails.message = 'Unable to reach PHP server. The server may be down or unreachable.';
          errorDetails.troubleshooting = [
            'Check if PHP server is running',
            'Verify the URL is correct (use actual domain/IP, not localhost if accessing from different machine)',
            'Check firewall/network settings',
            'Ensure Laravel routes are properly configured'
          ];
          // Return 503 for connection errors
          return res.status(503).json(errorDetails);
        } else {
          // Error setting up request
          errorDetails.message = 'Error setting up request to PHP server';
          // Return 500 for request setup errors
          return res.status(500).json(errorDetails);
        }
      }
    } else {
      return res.status(400).json({ error: 'Platform not supported for plugins/libraries/packages endpoint' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Advanced Analytics Routes
router.get('/analytics/:id', async (req, res) => {
  try {
    const website = await Website.findById(req.params.id);
    if (!website) {
      return res.status(404).json({ error: 'Website not found' });
    }

    const analyticsData = await analyticsService.getComprehensiveAnalytics(website);
    res.json(analyticsData);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/analytics/:id/google', async (req, res) => {
  try {
    const website = await Website.findById(req.params.id);
    if (!website) {
      return res.status(404).json({ error: 'Website not found' });
    }

    const googleAnalytics = await analyticsService.getGoogleAnalyticsData(website, req.query.dateRange || '7daysAgo');
    res.json(googleAnalytics);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/analytics/:id/search-console', async (req, res) => {
  try {
    const website = await Website.findById(req.params.id);
    if (!website) {
      return res.status(404).json({ error: 'Website not found' });
    }

    const searchConsole = await analyticsService.getGoogleSearchConsoleData(website, req.query.days || 7);
    res.json(searchConsole);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/analytics/:id/social-media', async (req, res) => {
  try {
    const website = await Website.findById(req.params.id);
    if (!website) {
      return res.status(404).json({ error: 'Website not found' });
    }

    const socialMedia = await analyticsService.getSocialMediaMetrics(website);
    res.json(socialMedia);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/analytics/:id/email-marketing', async (req, res) => {
  try {
    const website = await Website.findById(req.params.id);
    if (!website) {
      return res.status(404).json({ error: 'Website not found' });
    }

    const emailMarketing = await analyticsService.getEmailMarketingMetrics(website);
    res.json(emailMarketing);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Advanced Performance Routes
router.get('/performance/:id', async (req, res) => {
  try {
    const website = await Website.findById(req.params.id);
    if (!website) {
      return res.status(404).json({ error: 'Website not found' });
    }

    const performanceData = await performanceService.getComprehensivePerformance(website);
    res.json(performanceData);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/performance/:id/core-web-vitals', async (req, res) => {
  try {
    const website = await Website.findById(req.params.id);
    if (!website) {
      return res.status(404).json({ error: 'Website not found' });
    }

    const coreWebVitals = await performanceService.getCoreWebVitals(website);
    res.json(coreWebVitals);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/performance/:id/pagespeed', async (req, res) => {
  try {
    const website = await Website.findById(req.params.id);
    if (!website) {
      return res.status(404).json({ error: 'Website not found' });
    }

    const pageSpeed = await performanceService.getPageSpeedInsights(website, req.query.strategy || 'mobile');
    res.json(pageSpeed);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/performance/:id/rum', async (req, res) => {
  try {
    const website = await Website.findById(req.params.id);
    if (!website) {
      return res.status(404).json({ error: 'Website not found' });
    }

    const rum = await performanceService.getRealUserMetrics(website);
    res.json(rum);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/performance/:id/cdn', async (req, res) => {
  try {
    const website = await Website.findById(req.params.id);
    if (!website) {
      return res.status(404).json({ error: 'Website not found' });
    }

    const cdn = await performanceService.getCDNPerformance(website);
    res.json(cdn);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/performance/:id/database', async (req, res) => {
  try {
    const website = await Website.findById(req.params.id);
    if (!website) {
      return res.status(404).json({ error: 'Website not found' });
    }

    const database = await performanceService.getDatabasePerformance(website);
    res.json(database);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/performance/:id/server', async (req, res) => {
  try {
    const website = await Website.findById(req.params.id);
    if (!website) {
      return res.status(404).json({ error: 'Website not found' });
    }

    const server = await performanceService.getServerResources(website);
    res.json(server);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/performance/:id/load-test', async (req, res) => {
  try {
    const website = await Website.findById(req.params.id);
    if (!website) {
      return res.status(404).json({ error: 'Website not found' });
    }

    const loadTest = await performanceService.getLoadTestResults(website);
    res.json(loadTest);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Advanced Security Routes
router.get('/security/:id', async (req, res) => {
  try {
    const website = await Website.findById(req.params.id);
    if (!website) {
      return res.status(404).json({ error: 'Website not found' });
    }

    const securityData = await securityService.getComprehensiveSecurity(website);
    res.json(securityData);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/security/:id/malware-scan', async (req, res) => {
  try {
    const website = await Website.findById(req.params.id);
    if (!website) {
      return res.status(404).json({ error: 'Website not found' });
    }

    const malwareScan = await securityService.performMalwareScan(website);
    res.json(malwareScan);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/security/:id/vulnerability-scan', async (req, res) => {
  try {
    const website = await Website.findById(req.params.id);
    if (!website) {
      return res.status(404).json({ error: 'Website not found' });
    }

    const vulnerabilityScan = await securityService.performVulnerabilityScan(website);
    res.json(vulnerabilityScan);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/security/:id/ssl-status', async (req, res) => {
  try {
    const website = await Website.findById(req.params.id);
    if (!website) {
      return res.status(404).json({ error: 'Website not found' });
    }

    const sslStatus = await securityService.checkSSLStatus(website);
    res.json(sslStatus);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/security/:id/firewall', async (req, res) => {
  try {
    const website = await Website.findById(req.params.id);
    if (!website) {
      return res.status(404).json({ error: 'Website not found' });
    }

    const firewall = await securityService.checkFirewallStatus(website);
    res.json(firewall);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/security/:id/intrusion-detection', async (req, res) => {
  try {
    const website = await Website.findById(req.params.id);
    if (!website) {
      return res.status(404).json({ error: 'Website not found' });
    }

    const intrusion = await securityService.checkIntrusionDetection(website);
    res.json(intrusion);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/security/:id/headers', async (req, res) => {
  try {
    const website = await Website.findById(req.params.id);
    if (!website) {
      return res.status(404).json({ error: 'Website not found' });
    }

    const headers = await securityService.checkSecurityHeaders(website);
    res.json(headers);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/security/:id/wordpress', async (req, res) => {
  try {
    const website = await Website.findById(req.params.id);
    if (!website) {
      return res.status(404).json({ error: 'Website not found' });
    }

    if (website.platform !== 'wordpress') {
      return res.status(400).json({ error: 'Website is not a WordPress site' });
    }

    const wordPressSecurity = await securityService.checkWordPressSecurity(website);
    res.json(wordPressSecurity);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// AI Insights Routes
router.get('/ai-insights/:id', async (req, res) => {
  try {
    const website = await Website.findById(req.params.id);
    if (!website) {
      return res.status(404).json({ error: 'Website not found' });
    }

    const aiInsights = await aiInsightsService.getComprehensiveAIAnalysis(website);
    res.json(aiInsights);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/ai-insights/:id/analytics', async (req, res) => {
  try {
    const website = await Website.findById(req.params.id);
    if (!website) {
      return res.status(404).json({ error: 'Website not found' });
    }

    const analyticsInsights = await aiInsightsService.generateAnalyticsInsights(website.analytics, website);
    res.json(analyticsInsights);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/ai-insights/:id/performance', async (req, res) => {
  try {
    const website = await Website.findById(req.params.id);
    if (!website) {
      return res.status(404).json({ error: 'Website not found' });
    }

    const performanceInsights = await aiInsightsService.generatePerformanceInsights(website.performance, website);
    res.json(performanceInsights);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/ai-insights/:id/seo', async (req, res) => {
  try {
    const website = await Website.findById(req.params.id);
    if (!website) {
      return res.status(404).json({ error: 'Website not found' });
    }

    const seoInsights = await aiInsightsService.generateSEOInsights(website.seo, website);
    res.json(seoInsights);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/ai-insights/:id/security', async (req, res) => {
  try {
    const website = await Website.findById(req.params.id);
    if (!website) {
      return res.status(404).json({ error: 'Website not found' });
    }

    const securityInsights = await aiInsightsService.generateSecurityInsights(website.security, website);
    res.json(securityInsights);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/ai-insights/:id/predictions', async (req, res) => {
  try {
    const website = await Website.findById(req.params.id);
    if (!website) {
      return res.status(404).json({ error: 'Website not found' });
    }

    const predictions = await aiInsightsService.generatePredictiveAnalytics(website, website);
    res.json(predictions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/ai-insights/:id/anomalies', async (req, res) => {
  try {
    const website = await Website.findById(req.params.id);
    if (!website) {
      return res.status(404).json({ error: 'Website not found' });
    }

    const anomalies = await aiInsightsService.detectAnomalies(website, website);
    res.json(anomalies);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/ai-insights/:id/query', async (req, res) => {
  try {
    const website = await Website.findById(req.params.id);
    if (!website) {
      return res.status(404).json({ error: 'Website not found' });
    }

    const { query } = req.body;
    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }

    // Pass comprehensive website data so AI can use real analytics, performance, SEO, security
    let websiteData = website.toObject ? website.toObject() : website;
    try {
      const comprehensive = await monitoringService.getComprehensiveWebsiteData(website);
      if (comprehensive && !comprehensive.error) {
        websiteData = { ...websiteData, ...comprehensive };
      }
    } catch (e) {
      // Keep using base website if comprehensive fetch fails
    }

    const response = await aiInsightsService.processNaturalLanguageQuery(query, websiteData);
    res.json(response);
  } catch (error) {
    const status = error.statusCode || 500;
    res.status(status).json({
      error: error.message,
      ...(error.service && { service: error.service })
    });
  }
});

router.get('/ai-insights/:id/recommendations', async (req, res) => {
  try {
    const website = await Website.findById(req.params.id);
    if (!website) {
      return res.status(404).json({ error: 'Website not found' });
    }

    const recommendations = await aiInsightsService.generateAutomatedRecommendations(website);
    res.json(recommendations);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Plugin Management Routes
router.get('/plugins/:id', async (req, res) => {
  try {
    const website = await Website.findById(req.params.id);
    if (!website) {
      return res.status(404).json({ error: 'Website not found' });
    }

    if (website.platform !== 'wordpress') {
      return res.status(400).json({ error: 'Website is not a WordPress site' });
    }

    // Get plugins data from WordPress API
    const response = await axios.get(`${website.url}/wp-json/webmonitor-advanced/v1/plugins`, {
      headers: { 'Authorization': `Bearer ${website.apiKey}` }
    });

    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
