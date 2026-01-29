const axios = require('axios');

class AnalyticsService {
  constructor() {
    this.googleAnalytics = {
      enabled: process.env.GOOGLE_ANALYTICS_ENABLED === 'true',
      propertyId: process.env.GOOGLE_ANALYTICS_PROPERTY_ID,
      apiKey: process.env.GOOGLE_ANALYTICS_API_KEY
    };
    
    this.googleSearchConsole = {
      enabled: process.env.GOOGLE_SEARCH_CONSOLE_ENABLED === 'true',
      siteUrl: process.env.GOOGLE_SEARCH_CONSOLE_SITE_URL,
      apiKey: process.env.GOOGLE_SEARCH_CONSOLE_API_KEY
    };
  }

  // Google Analytics Integration
  async getGoogleAnalyticsData(website, dateRange = '7daysAgo') {
    if (!this.googleAnalytics.enabled) {
      const error = new Error('Google Analytics API is not enabled. Please configure GOOGLE_ANALYTICS_ENABLED, GOOGLE_ANALYTICS_PROPERTY_ID, and GOOGLE_ANALYTICS_API_KEY in your environment variables.');
      error.statusCode = 503;
      error.service = 'Google Analytics';
      throw error;
    }

    if (!this.googleAnalytics.propertyId || !this.googleAnalytics.apiKey) {
      const error = new Error('Google Analytics API is not properly configured. Missing GOOGLE_ANALYTICS_PROPERTY_ID or GOOGLE_ANALYTICS_API_KEY.');
      error.statusCode = 503;
      error.service = 'Google Analytics';
      throw error;
    }

    try {
      const response = await axios.get(`https://analyticsdata.googleapis.com/v1beta/properties/${this.googleAnalytics.propertyId}:runReport`, {
        headers: {
          'Authorization': `Bearer ${this.googleAnalytics.apiKey}`,
          'Content-Type': 'application/json'
        },
        data: {
          dateRanges: [{ startDate: dateRange, endDate: 'today' }],
          metrics: [
            { name: 'sessions' },
            { name: 'users' },
            { name: 'pageviews' },
            { name: 'bounceRate' },
            { name: 'averageSessionDuration' }
          ],
          dimensions: [
            { name: 'date' },
            { name: 'deviceCategory' },
            { name: 'channelGrouping' }
          ]
        }
      });

      return this.processGoogleAnalyticsData(response.data);
    } catch (error) {
      console.error('Google Analytics API Error:', error.message);
      const apiError = new Error(`Failed to fetch Google Analytics data: ${error.message}`);
      apiError.statusCode = error.response?.status || 500;
      apiError.service = 'Google Analytics';
      apiError.originalError = error;
      throw apiError;
    }
  }

  // Google Search Console Integration
  async getGoogleSearchConsoleData(website, dateRange = 7) {
    if (!this.googleSearchConsole.enabled) {
      const error = new Error('Google Search Console API is not enabled. Please configure GOOGLE_SEARCH_CONSOLE_ENABLED, GOOGLE_SEARCH_CONSOLE_SITE_URL, and GOOGLE_SEARCH_CONSOLE_API_KEY in your environment variables.');
      error.statusCode = 503;
      error.service = 'Google Search Console';
      throw error;
    }

    if (!this.googleSearchConsole.siteUrl || !this.googleSearchConsole.apiKey) {
      const error = new Error('Google Search Console API is not properly configured. Missing GOOGLE_SEARCH_CONSOLE_SITE_URL or GOOGLE_SEARCH_CONSOLE_API_KEY.');
      error.statusCode = 503;
      error.service = 'Google Search Console';
      throw error;
    }

    try {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - dateRange);

      const response = await axios.get(`https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(this.googleSearchConsole.siteUrl)}/searchAnalytics/query`, {
        headers: {
          'Authorization': `Bearer ${this.googleSearchConsole.apiKey}`,
          'Content-Type': 'application/json'
        },
        data: {
          startDate: startDate.toISOString().split('T')[0],
          endDate: endDate.toISOString().split('T')[0],
          dimensions: ['query', 'page', 'device'],
          rowLimit: 1000
        }
      });

      return this.processSearchConsoleData(response.data);
    } catch (error) {
      console.error('Google Search Console API Error:', error.message);
      const apiError = new Error(`Failed to fetch Google Search Console data: ${error.message}`);
      apiError.statusCode = error.response?.status || 500;
      apiError.service = 'Google Search Console';
      apiError.originalError = error;
      throw apiError;
    }
  }

  // Social Media Analytics
  async getSocialMediaMetrics(website) {
    return {
      facebook: await this.getFacebookMetrics(website),
      twitter: await this.getTwitterMetrics(website),
      linkedin: await this.getLinkedInMetrics(website),
      instagram: await this.getInstagramMetrics(website)
    };
  }

  async getFacebookMetrics(website) {
    // Social media APIs require OAuth tokens and specific implementations
    // Return error indicating API integration needed
    const error = new Error('Facebook Graph API integration not implemented. Social media metrics require OAuth authentication and API setup.');
    error.statusCode = 501;
    error.service = 'Facebook';
    throw error;
  }

  async getTwitterMetrics(website) {
    const error = new Error('Twitter API v2 integration not implemented. Social media metrics require OAuth authentication and API setup.');
    error.statusCode = 501;
    error.service = 'Twitter';
    throw error;
  }

  async getLinkedInMetrics(website) {
    const error = new Error('LinkedIn API integration not implemented. Social media metrics require OAuth authentication and API setup.');
    error.statusCode = 501;
    error.service = 'LinkedIn';
    throw error;
  }

  async getInstagramMetrics(website) {
    const error = new Error('Instagram Basic Display API integration not implemented. Social media metrics require OAuth authentication and API setup.');
    error.statusCode = 501;
    error.service = 'Instagram';
    throw error;
  }

  // Email Marketing Analytics
  async getEmailMarketingMetrics(website) {
    return {
      mailchimp: await this.getMailchimpMetrics(website),
      convertkit: await this.getConvertKitMetrics(website),
      activecampaign: await this.getActiveCampaignMetrics(website)
    };
  }

  async getMailchimpMetrics(website) {
    const error = new Error('Mailchimp API integration not implemented. Email marketing metrics require API key and account setup.');
    error.statusCode = 501;
    error.service = 'Mailchimp';
    throw error;
  }

  async getConvertKitMetrics(website) {
    const error = new Error('ConvertKit API integration not implemented. Email marketing metrics require API key and account setup.');
    error.statusCode = 501;
    error.service = 'ConvertKit';
    throw error;
  }

  async getActiveCampaignMetrics(website) {
    const error = new Error('ActiveCampaign API integration not implemented. Email marketing metrics require API key and account setup.');
    error.statusCode = 501;
    error.service = 'ActiveCampaign';
    throw error;
  }

  // Advanced Analytics Processing
  processGoogleAnalyticsData(data) {
    const rows = data.rows || [];
    const processedData = {
      sessions: 0,
      users: 0,
      pageviews: 0,
      bounceRate: 0,
      averageSessionDuration: 0,
      deviceBreakdown: {},
      channelBreakdown: {},
      dailyData: []
    };

    rows.forEach(row => {
      processedData.sessions += parseInt(row.metrics[0].value) || 0;
      processedData.users += parseInt(row.metrics[1].value) || 0;
      processedData.pageviews += parseInt(row.metrics[2].value) || 0;
      
      const device = row.dimensionValues[1].value;
      const channel = row.dimensionValues[2].value;
      
      if (!processedData.deviceBreakdown[device]) {
        processedData.deviceBreakdown[device] = 0;
      }
      if (!processedData.channelBreakdown[channel]) {
        processedData.channelBreakdown[channel] = 0;
      }
      
      processedData.deviceBreakdown[device] += parseInt(row.metrics[0].value) || 0;
      processedData.channelBreakdown[channel] += parseInt(row.metrics[0].value) || 0;
    });

    return processedData;
  }

  processSearchConsoleData(data) {
    const rows = data.rows || [];
    return {
      totalClicks: rows.reduce((sum, row) => sum + row.clicks, 0),
      totalImpressions: rows.reduce((sum, row) => sum + row.impressions, 0),
      averageCTR: rows.reduce((sum, row) => sum + row.ctr, 0) / rows.length,
      averagePosition: rows.reduce((sum, row) => sum + row.position, 0) / rows.length,
      topQueries: rows.slice(0, 10).map(row => ({
        query: row.keys[0],
        clicks: row.clicks,
        impressions: row.impressions,
        ctr: row.ctr,
        position: row.position
      })),
      topPages: rows.slice(0, 10).map(row => ({
        page: row.keys[1],
        clicks: row.clicks,
        impressions: row.impressions,
        ctr: row.ctr,
        position: row.position
      }))
    };
  }


  // Comprehensive Analytics Dashboard Data
  async getComprehensiveAnalytics(website) {
    const results = {
      googleAnalytics: null,
      searchConsole: null,
      socialMedia: null,
      emailMarketing: null,
      errors: []
    };

    // Fetch Google Analytics (required)
    try {
      results.googleAnalytics = await this.getGoogleAnalyticsData(website);
    } catch (error) {
      results.errors.push({
        service: 'Google Analytics',
        error: error.message,
        statusCode: error.statusCode
      });
    }

    // Fetch Google Search Console (required)
    try {
      results.searchConsole = await this.getGoogleSearchConsoleData(website);
    } catch (error) {
      results.errors.push({
        service: 'Google Search Console',
        error: error.message,
        statusCode: error.statusCode
      });
    }

    // Fetch Social Media (optional - may not be implemented)
    try {
      results.socialMedia = await this.getSocialMediaMetrics(website);
    } catch (error) {
      // Social media is optional, log but don't fail
      console.warn(`Social media metrics unavailable: ${error.message}`);
    }

    // Fetch Email Marketing (optional - may not be implemented)
    try {
      results.emailMarketing = await this.getEmailMarketingMetrics(website);
    } catch (error) {
      // Email marketing is optional, log but don't fail
      console.warn(`Email marketing metrics unavailable: ${error.message}`);
    }

    // If required services failed, throw error
    if (!results.googleAnalytics && !results.searchConsole) {
      const error = new Error('Unable to fetch analytics data. Both Google Analytics and Google Search Console are unavailable.');
      error.statusCode = 503;
      error.details = results.errors;
      throw error;
    }

    return {
      googleAnalytics: results.googleAnalytics,
      searchConsole: results.searchConsole,
      socialMedia: results.socialMedia,
      emailMarketing: results.emailMarketing,
      summary: {
        totalTraffic: results.googleAnalytics?.sessions || 0,
        organicTraffic: results.searchConsole?.totalClicks || 0,
        socialTraffic: results.socialMedia ? Object.values(results.socialMedia).reduce((sum, platform) => sum + (platform.followers || 0), 0) : 0,
        emailSubscribers: results.emailMarketing ? Object.values(results.emailMarketing).reduce((sum, platform) => sum + (platform.subscribers || 0), 0) : 0
      },
      warnings: results.errors.length > 0 ? results.errors : undefined
    };
  }
}

module.exports = new AnalyticsService();
