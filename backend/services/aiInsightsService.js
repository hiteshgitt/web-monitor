const axios = require('axios');
const MonitoringData = require('../models/MonitoringData');

class AIInsightsService {
  constructor() {
    this.openaiApiKey = process.env.OPENAI_API_KEY;
    this.anthropicApiKey = process.env.ANTHROPIC_API_KEY;
    this.googleAIApiKey = process.env.GOOGLE_AI_API_KEY;
  }

  // AI-Powered Analytics Insights
  async generateAnalyticsInsights(analyticsData, website) {
    if (!analyticsData || analyticsData.error) {
      const error = new Error('Analytics data is unavailable. Cannot generate AI insights without data.');
      error.statusCode = 400;
      throw error;
    }

    const prompt = this.withRawData(this.buildAnalyticsPrompt(analyticsData, website), analyticsData, ['insights', 'recommendations', 'predictions']);
    
    try {
      const insights = await this.callAI(prompt);
      return this.parseAnalyticsInsights(insights);
    } catch (error) {
      console.error('AI Analytics Insights Error:', error.message);
      const apiError = new Error(`Failed to generate AI analytics insights: ${error.message}`);
      apiError.statusCode = error.statusCode || 500;
      apiError.service = 'AI Insights';
      apiError.originalError = error;
      throw apiError;
    }
  }

  // Parse methods for AI responses
  // Missing sections stay empty: the dashboard must never show advice the AI didn't give.
  toList(value) {
    if (Array.isArray(value)) return value.map(String);
    if (value == null || value === '') return [];
    return [String(value)];
  }

  parseAnalyticsInsights(insights) {
    return {
      insights: this.toList(insights.insights ?? insights.answer),
      recommendations: this.toList(insights.recommendations),
      predictions: this.toList(insights.predictions)
    };
  }

  parsePerformanceInsights(insights) {
    return {
      insights: this.toList(insights.insights ?? insights.answer),
      recommendations: this.toList(insights.recommendations),
      impact: this.toList(insights.impact)
    };
  }

  parseSEOInsights(insights) {
    return {
      insights: this.toList(insights.insights ?? insights.answer),
      recommendations: this.toList(insights.recommendations),
      priorities: this.toList(insights.priorities)
    };
  }

  parseSecurityInsights(insights) {
    return {
      insights: this.toList(insights.insights ?? insights.answer),
      recommendations: this.toList(insights.recommendations),
      riskAssessment: this.toList(insights.riskAssessment ?? insights.risk_assessment)
    };
  }

  // The prompt templates use the external services' field names, which site integrations don't
  // share; so drop template lines with no value and always include the real data and reply shape.
  withRawData(prompt, data, listKeys) {
    const template = prompt.split('\n').filter((line) => !/undefined|null\/100/.test(line)).join('\n');
    return `${template}

    Actual data (JSON). Base every statement only on these values and do not assume anything not present.
    Times are in milliseconds; memory and CPU values are percentages; altTags and link fields are counts:
    ${JSON.stringify(data, null, 2)}

    Reply with only a JSON object with these keys, each an array of short strings: ${listKeys.join(', ')}.`;
  }

  // AI-Powered Performance Insights
  async generatePerformanceInsights(performanceData, website) {
    if (!performanceData || performanceData.error) {
      const error = new Error('Performance data is unavailable. Cannot generate AI insights without data.');
      error.statusCode = 400;
      throw error;
    }

    const prompt = this.withRawData(this.buildPerformancePrompt(performanceData, website), performanceData, ['insights', 'recommendations', 'impact']);
    
    try {
      const insights = await this.callAI(prompt);
      return this.parsePerformanceInsights(insights);
    } catch (error) {
      console.error('AI Performance Insights Error:', error.message);
      const apiError = new Error(`Failed to generate AI performance insights: ${error.message}`);
      apiError.statusCode = error.statusCode || 500;
      apiError.service = 'AI Insights';
      apiError.originalError = error;
      throw apiError;
    }
  }

  // AI-Powered SEO Insights
  async generateSEOInsights(seoData, website) {
    if (!seoData || seoData.error) {
      const error = new Error('SEO data is unavailable. Cannot generate AI insights without data.');
      error.statusCode = 400;
      throw error;
    }

    const prompt = this.withRawData(this.buildSEOPrompt(seoData, website), seoData, ['insights', 'recommendations', 'priorities']);
    
    try {
      const insights = await this.callAI(prompt);
      return this.parseSEOInsights(insights);
    } catch (error) {
      console.error('AI SEO Insights Error:', error.message);
      const apiError = new Error(`Failed to generate AI SEO insights: ${error.message}`);
      apiError.statusCode = error.statusCode || 500;
      apiError.service = 'AI Insights';
      apiError.originalError = error;
      throw apiError;
    }
  }

  // AI-Powered Security Insights
  async generateSecurityInsights(securityData, website) {
    if (!securityData || securityData.error) {
      const error = new Error('Security data is unavailable. Cannot generate AI insights without data.');
      error.statusCode = 400;
      throw error;
    }

    const prompt = this.withRawData(this.buildSecurityPrompt(securityData, website), securityData, ['insights', 'recommendations', 'riskAssessment']);
    
    try {
      const insights = await this.callAI(prompt);
      return this.parseSecurityInsights(insights);
    } catch (error) {
      console.error('AI Security Insights Error:', error.message);
      const apiError = new Error(`Failed to generate AI security insights: ${error.message}`);
      apiError.statusCode = error.statusCode || 500;
      apiError.service = 'AI Insights';
      apiError.originalError = error;
      throw apiError;
    }
  }

  // Predictive Analytics
  async generatePredictiveAnalytics(historicalData, website) {
    const predictions = {
      traffic: await this.predictTraffic(website),
      performance: await this.predictPerformance(website),
      security: await this.predictSecurityRisks(website),
      revenue: await this.predictRevenue(website)
    };

    return predictions;
  }

  // Anomaly Detection
  async detectAnomalies(data, website) {
    const anomalies = {
      traffic: this.detectTrafficAnomalies(data.traffic),
      performance: this.detectPerformanceAnomalies(data.performance),
      security: this.detectSecurityAnomalies(data.security),
      errors: this.detectErrorAnomalies(data.errors)
    };

    return anomalies;
  }

  // Natural Language Queries — uses real AI with website data; supports questions and pasted issues/fixes
  async processNaturalLanguageQuery(query, websiteData) {
    if (!query || !query.trim()) {
      const error = new Error('Query is required for natural language processing.');
      error.statusCode = 400;
      throw error;
    }

    const prompt = this.buildNLQueryPrompt(query, websiteData);

    try {
      const raw = await this.callAIText(prompt);
      return this.parseNLQueryResponse(raw);
    } catch (error) {
      console.error('AI NL Query Error:', error.message);
      const apiError = new Error(`Failed to process natural language query: ${error.message}`);
      apiError.statusCode = error.statusCode || 500;
      apiError.service = 'AI Insights';
      apiError.originalError = error;
      throw apiError;
    }
  }

  // Automated Recommendations
  // Recommendations reported by the site's own integration checks
  async generateAutomatedRecommendations(websiteData) {
    return {
      performance: this.toList(websiteData.performance?.recommendations),
      seo: this.toList(websiteData.seo?.recommendations),
      security: this.toList(websiteData.security?.recommendations)
    };
  }

  // Competitive Analysis
  async performCompetitiveAnalysis(website, competitors) {
    const analysis = {
      marketPosition: await this.analyzeMarketPosition(website, competitors),
      featureGaps: await this.identifyFeatureGaps(website, competitors),
      pricingAnalysis: await this.analyzePricing(website, competitors),
      contentGaps: await this.identifyContentGaps(website, competitors),
      recommendations: await this.generateCompetitiveRecommendations(website, competitors)
    };

    return analysis;
  }

  // Helper Methods
  async callAI(prompt) {
    // Real AI implementation requires API key configuration
    if (!this.openaiApiKey && !this.anthropicApiKey && !this.googleAIApiKey) {
      const error = new Error('AI API key is not configured. Please set OPENAI_API_KEY, ANTHROPIC_API_KEY, or GOOGLE_AI_API_KEY in your environment variables.');
      error.statusCode = 503;
      error.service = 'AI Service';
      throw error;
    }

    // Providers are tried in order; a failing one (bad key, quota, outage) falls through to the next
    let lastError = null;

    // Try OpenAI first
    if (this.openaiApiKey) {
      try {
        const response = await axios.post('https://api.openai.com/v1/chat/completions', {
          model: 'gpt-4',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.7,
          max_tokens: 1000
        }, {
          headers: {
            'Authorization': `Bearer ${this.openaiApiKey}`,
            'Content-Type': 'application/json'
          }
        });

        return JSON.parse(response.data.choices[0].message.content);
      } catch (error) {
        console.error('OpenAI API Error:', error.message);
        lastError = error;
      }
    }

    // Try Anthropic if OpenAI not available
    if (this.anthropicApiKey) {
      try {
        const response = await axios.post('https://api.anthropic.com/v1/messages', {
          model: 'claude-3-opus-20240229',
          max_tokens: 1000,
          messages: [{ role: 'user', content: prompt }]
        }, {
          headers: {
            'x-api-key': this.anthropicApiKey,
            'anthropic-version': '2023-06-01',
            'Content-Type': 'application/json'
          }
        });

        return JSON.parse(response.data.content[0].text);
      } catch (error) {
        console.error('Anthropic API Error:', error.message);
        lastError = error;
      }
    }

    // Try Google AI if others not available
    if (this.googleAIApiKey) {
      try {
        const response = await axios.post(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${this.googleAIApiKey}`,
          {
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              maxOutputTokens: 2048,
              temperature: 0.4,
              responseMimeType: 'application/json',
              // Thinking tokens count against maxOutputTokens and can truncate the JSON
              thinkingConfig: { thinkingBudget: 0 }
            }
          },
          {
            headers: {
              'Content-Type': 'application/json'
            }
          }
        );

        const text = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) {
          throw new Error('No text response from Gemini API');
        }
        
        // Try to parse as JSON, fallback to plain text
        try {
          return JSON.parse(text.replace(/^\s*```(?:json)?\s*/i, '').replace(/\s*```\s*$/, ''));
        } catch (parseError) {
          // If not JSON, return as plain text wrapped in a structure
          return { answer: text };
        }
      } catch (error) {
        console.error('Google AI API Error:', error.response?.data || error.message);
        lastError = error;
      }
    }

    if (lastError) throw lastError;

    const error = new Error('No AI service available. Please configure at least one AI API key.');
    error.statusCode = 503;
    throw error;
  }

  buildAnalyticsPrompt(analyticsData, website) {
    return `Analyze the following analytics data for ${website.name} (${website.url}):

    Traffic Data:
    - Sessions: ${analyticsData.sessions}
    - Users: ${analyticsData.users}
    - Page Views: ${analyticsData.pageviews}
    - Bounce Rate: ${analyticsData.bounceRate}%
    - Average Session Duration: ${analyticsData.averageSessionDuration}s

    Device Breakdown:
    ${JSON.stringify(analyticsData.deviceBreakdown, null, 2)}

    Channel Breakdown:
    ${JSON.stringify(analyticsData.channelBreakdown, null, 2)}

    Please provide insights on:
    1. Key performance indicators
    2. Areas for improvement
    3. Opportunities for growth
    4. Specific recommendations
    5. Trend analysis

    Format the response as JSON with sections for insights, recommendations, and predictions.`;
  }

  buildPerformancePrompt(performanceData, website) {
    return `Analyze the following performance data for ${website.name} (${website.url}):

    Core Web Vitals:
    - LCP: ${performanceData.coreWebVitals?.lcp?.value}ms (${performanceData.coreWebVitals?.lcp?.status})
    - FID: ${performanceData.coreWebVitals?.fid?.value}ms (${performanceData.coreWebVitals?.fid?.status})
    - CLS: ${performanceData.coreWebVitals?.cls?.value} (${performanceData.coreWebVitals?.cls?.status})

    Performance Scores:
    - Overall Score: ${performanceData.pageSpeedInsights?.performanceScore}/100
    - Accessibility: ${performanceData.pageSpeedInsights?.accessibilityScore}/100
    - SEO: ${performanceData.pageSpeedInsights?.seoScore}/100

    Server Metrics:
    ${JSON.stringify(performanceData.serverResources, null, 2)}

    Please provide insights on:
    1. Performance bottlenecks
    2. Optimization opportunities
    3. Priority improvements
    4. Technical recommendations
    5. Impact predictions

    Format the response as JSON with sections for insights, recommendations, and impact.`;
  }

  buildSEOPrompt(seoData, website) {
    return `Analyze the following SEO data for ${website.name} (${website.url}):

    SEO Metrics:
    - SEO Score: ${seoData.score}/100
    - SSL Enabled: ${seoData.sslEnabled}
    - Meta Tags: ${seoData.metaTags}
    - Alt Tags: ${seoData.altTags}%
    - Total Content: ${seoData.totalContent}

    Issues Found:
    ${JSON.stringify(seoData.seoIssues, null, 2)}

    Please provide insights on:
    1. SEO strengths and weaknesses
    2. Content optimization opportunities
    3. Technical SEO improvements
    4. Keyword optimization strategies
    5. Competitive positioning

    Format the response as JSON with sections for insights, recommendations, and priorities.`;
  }

  buildSecurityPrompt(securityData, website) {
    return `Analyze the following security data for ${website.name} (${website.url}):

    Security Status:
    - Overall Score: ${securityData.overallSecurityScore}/100
    - Malware Scan: ${securityData.malwareScan?.status}
    - Vulnerability Count: ${securityData.vulnerabilityScan?.vulnerabilityCount}
    - SSL Grade: ${securityData.sslStatus?.grade}

    Security Headers Score: ${securityData.securityHeaders?.score}/100

    Please provide insights on:
    1. Security posture assessment
    2. Critical vulnerabilities
    3. Security improvements needed
    4. Best practices implementation
    5. Risk mitigation strategies

    Format the response as JSON with sections for insights, recommendations, and risk assessment.`;
  }

  buildNLQueryPrompt(query, websiteData) {
    return `You are an expert web analytics and performance assistant. Based on the following website data for ${websiteData.name} (${websiteData.url}), answer the user's question or analyze the fix/issue they pasted.

User question or pasted content:
"""
${query}
"""

Website Data Summary:
- Platform: ${websiteData.platform}
- Status: ${websiteData.status}
- Uptime: ${websiteData.uptime}%
- Response Time: ${websiteData.responseTime}ms
- Analytics: ${JSON.stringify(websiteData.analytics || {}, null, 2)}
- Performance: ${JSON.stringify(websiteData.performance || {}, null, 2)}
- SEO: ${JSON.stringify(websiteData.seo || {}, null, 2)}
- Security: ${JSON.stringify(websiteData.security || {}, null, 2)}

If the user asked a question, answer using this data. If they pasted an error, fix suggestion, or issue text, explain how it relates to this site's data and give specific next steps. Reply in plain text only, no JSON.`;
  }

  // Returns raw text (no JSON parse) for natural-language answers and pasted issues
  async callAIText(prompt) {
    if (!this.openaiApiKey && !this.anthropicApiKey && !this.googleAIApiKey) {
      const error = new Error('AI API key is not configured. Please set OPENAI_API_KEY, ANTHROPIC_API_KEY, or GOOGLE_AI_API_KEY in your environment variables.');
      error.statusCode = 503;
      error.service = 'AI Service';
      throw error;
    }

    if (this.openaiApiKey) {
      try {
        const response = await axios.post('https://api.openai.com/v1/chat/completions', {
          model: 'gpt-4',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.7,
          max_tokens: 1500
        }, {
          headers: {
            'Authorization': `Bearer ${this.openaiApiKey}`,
            'Content-Type': 'application/json'
          }
        });
        return (response.data.choices[0]?.message?.content || '').trim();
      } catch (error) {
        console.error('OpenAI API Error:', error.message);
        throw error;
      }
    }

    if (this.anthropicApiKey) {
      try {
        const response = await axios.post('https://api.anthropic.com/v1/messages', {
          model: 'claude-3-opus-20240229',
          max_tokens: 1500,
          messages: [{ role: 'user', content: prompt }]
        }, {
          headers: {
            'x-api-key': this.anthropicApiKey,
            'anthropic-version': '2023-06-01',
            'Content-Type': 'application/json'
          }
        });
        return (response.data.content[0]?.text || '').trim();
      } catch (error) {
        console.error('Anthropic API Error:', error.message);
        throw error;
      }
    }

    if (this.googleAIApiKey) {
      try {
        // Use gemini-2.5-flash (fast) or gemini-2.5-pro (more capable)
        const model = 'gemini-2.5-flash'; // Fast and efficient for chat
        
        const response = await axios.post(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${this.googleAIApiKey}`,
          {
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { 
              maxOutputTokens: 1500,
              temperature: 0.7
            }
          },
          {
            headers: {
              'Content-Type': 'application/json'
            }
          }
        );
        
        const text = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) {
          throw new Error('No text response from Gemini API');
        }
        
        return text.trim();
      } catch (error) {
        console.error('Google Gemini API Error:', error.response?.data || error.message);
        const errorMsg = error.response?.data?.error?.message || error.message;
        const statusCode = error.response?.status || 500;
        const apiError = new Error(`Google Gemini API Error: ${errorMsg}`);
        apiError.statusCode = statusCode;
        apiError.details = error.response?.data || { message: error.message };
        throw apiError;
      }
    }

    const error = new Error('No AI service available. Please configure at least one AI API key.');
    error.statusCode = 503;
    throw error;
  }

  parseNLQueryResponse(rawText) {
    if (rawText == null || String(rawText).trim() === '') {
      return { answer: 'No response generated.' };
    }
    return { answer: String(rawText).trim() };
  }

  // Prediction Methods
  // Only trends that can be derived from real data are reported; anything that would need
  // traffic or sales data returns { available: false } instead of a made-up number.
  async predictTraffic() {
    return {
      available: false,
      reason: 'Traffic forecasting needs a connected analytics source (e.g. Google Analytics).'
    };
  }

  async predictPerformance(website) {
    if (!website?._id) {
      return { available: false, reason: 'No monitoring history for this site.' };
    }
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const checks = await MonitoringData.find({
      websiteId: website._id,
      timestamp: { $gte: since },
      status: { $in: ['healthy', 'warning'] },
      responseTime: { $ne: null }
    }).sort({ timestamp: 1 }).select('responseTime').lean();

    if (checks.length < 20) {
      return {
        available: false,
        reason: `Not enough monitoring history yet (${checks.length} successful checks in the last 7 days, need 20).`
      };
    }

    // Compare the older half of the window with the newer half
    const half = Math.floor(checks.length / 2);
    const avg = (list) => list.reduce((sum, c) => sum + c.responseTime, 0) / list.length;
    const earlier = avg(checks.slice(0, half));
    const recent = avg(checks.slice(half));
    const changePercent = earlier > 0 ? Math.round(((recent - earlier) / earlier) * 1000) / 10 : 0;

    return {
      available: true,
      basis: `${checks.length} successful checks over the last 7 days`,
      earlierAvgResponseMs: Math.round(earlier),
      recentAvgResponseMs: Math.round(recent),
      changePercent,
      trend: changePercent > 10 ? 'slowing' : changePercent < -10 ? 'improving' : 'stable'
    };
  }

  async predictSecurityRisks(website) {
    const security = website?.security;
    const score = security?.securityScore ?? security?.overallSecurityScore;
    if (!security || security.error || score == null) {
      return { available: false, reason: 'No security data available for this site.' };
    }
    return {
      available: true,
      basis: `Security score ${score}/100 reported by the site integration`,
      riskLevel: score < 50 ? 'high' : score < 75 ? 'medium' : 'low',
      outdatedPlugins: security.outdatedPlugins ?? null,
      sslEnabled: security.sslStatus ? security.sslStatus === 'enabled' : null
    };
  }

  async predictRevenue() {
    return {
      available: false,
      reason: 'Revenue forecasting needs a connected sales or e-commerce data source.'
    };
  }

  // Anomaly Detection Methods
  detectTrafficAnomalies(trafficData) {
    const anomalies = [];
    
    // Handle undefined or missing data
    if (!trafficData || !trafficData.sessions) {
      return anomalies;
    }
    
    if (trafficData.sessions > (trafficData.avgSessions || trafficData.sessions * 0.5) * 2) {
      anomalies.push({
        type: 'traffic_spike',
        severity: 'high',
        description: 'Unusual traffic increase detected',
        value: trafficData.sessions,
        expected: trafficData.avgSessions || trafficData.sessions * 0.5
      });
    }
    
    if (trafficData.bounceRate && trafficData.bounceRate > 80) {
      anomalies.push({
        type: 'high_bounce_rate',
        severity: 'medium',
        description: 'Bounce rate is unusually high',
        value: trafficData.bounceRate,
        expected: 60
      });
    }

    return anomalies;
  }

  detectPerformanceAnomalies(performanceData) {
    const anomalies = [];
    
    if (performanceData.responseTime > 3000) {
      anomalies.push({
        type: 'slow_response',
        severity: 'high',
        description: 'Response time is significantly slower than usual',
        value: performanceData.responseTime,
        expected: 1000
      });
    }

    return anomalies;
  }

  detectSecurityAnomalies(securityData) {
    const anomalies = [];
    
    if (securityData.failedLogins > 100) {
      anomalies.push({
        type: 'brute_force_attempt',
        severity: 'high',
        description: 'Multiple failed login attempts detected',
        value: securityData.failedLogins,
        expected: 10
      });
    }

    return anomalies;
  }

  detectErrorAnomalies(errorData) {
    const anomalies = [];
    
    // Handle undefined or missing data
    if (!errorData || typeof errorData.errorRate === 'undefined') {
      return anomalies;
    }
    
    if (errorData.errorRate > 5) {
      anomalies.push({
        type: 'high_error_rate',
        severity: 'high',
        description: 'Error rate is unusually high',
        value: errorData.errorRate,
        expected: 1
      });
    }

    return anomalies;
  }


  // Comprehensive AI Analysis
  async getComprehensiveAIAnalysis(websiteData) {
    const results = {
      analyticsInsights: null,
      performanceInsights: null,
      seoInsights: null,
      securityInsights: null,
      predictions: null,
      anomalies: null,
      recommendations: null,
      errors: []
    };

    // Generate insights for available data
    if (websiteData.analytics && !websiteData.analytics.error) {
      try {
        results.analyticsInsights = await this.generateAnalyticsInsights(websiteData.analytics, websiteData);
      } catch (error) {
        results.errors.push({ service: 'Analytics Insights', error: error.message });
      }
    }

    if (websiteData.performance && !websiteData.performance.error) {
      try {
        results.performanceInsights = await this.generatePerformanceInsights(websiteData.performance, websiteData);
      } catch (error) {
        results.errors.push({ service: 'Performance Insights', error: error.message });
      }
    }

    if (websiteData.seo && !websiteData.seo.error) {
      try {
        results.seoInsights = await this.generateSEOInsights(websiteData.seo, websiteData);
      } catch (error) {
        results.errors.push({ service: 'SEO Insights', error: error.message });
      }
    }

    if (websiteData.security && !websiteData.security.error) {
      try {
        results.securityInsights = await this.generateSecurityInsights(websiteData.security, websiteData);
      } catch (error) {
        results.errors.push({ service: 'Security Insights', error: error.message });
      }
    }

    // Generate predictions and recommendations
    try {
      results.predictions = await this.generatePredictiveAnalytics(websiteData, websiteData);
    } catch (error) {
      results.errors.push({ service: 'Predictions', error: error.message });
    }

    try {
      results.anomalies = await this.detectAnomalies(websiteData, websiteData);
    } catch (error) {
      results.errors.push({ service: 'Anomaly Detection', error: error.message });
    }

    try {
      results.recommendations = await this.generateAutomatedRecommendations(websiteData);
    } catch (error) {
      results.errors.push({ service: 'Recommendations', error: error.message });
    }

    // If all services failed, throw error
    if (results.errors.length > 0 && !results.analyticsInsights && !results.performanceInsights && !results.seoInsights && !results.securityInsights) {
      const error = new Error('Unable to generate AI insights. All AI services failed.');
      error.statusCode = 503;
      error.details = results.errors;
      throw error;
    }

    return {
      analyticsInsights: results.analyticsInsights,
      performanceInsights: results.performanceInsights,
      seoInsights: results.seoInsights,
      securityInsights: results.securityInsights,
      predictions: results.predictions,
      anomalies: results.anomalies,
      recommendations: results.recommendations,
      summary: {
        overallHealth: this.calculateOverallHealth(websiteData),
        priorityActions: this.identifyPriorityActions(websiteData),
        aiScore: this.calculateAIScore(websiteData)
      },
      warnings: results.errors.length > 0 ? results.errors : undefined
    };
  }

  calculateOverallHealth(websiteData) {
    let score = 0;
    let factors = 0;

    // Bounce rate isn't a health score (higher is worse), so it is not averaged in here
    if (websiteData.performance) {
      score += websiteData.performance.performanceScore || 0;
      factors++;
    }
    if (websiteData.seo) {
      score += websiteData.seo.score || 0;
      factors++;
    }
    if (websiteData.security) {
      score += websiteData.security.securityScore || 0;
      factors++;
    }

    return factors > 0 ? Math.round(score / factors) : 0;
  }

  identifyPriorityActions(websiteData) {
    const actions = [];
    
    if (websiteData.performance?.performanceScore < 70) {
      actions.push('Optimize website performance');
    }
    if (websiteData.security?.securityScore < 80) {
      actions.push('Improve security measures');
    }
    if (websiteData.seo?.score < 80) {
      actions.push('Enhance SEO optimization');
    }

    return actions;
  }

  calculateAIScore(websiteData) {
    const health = this.calculateOverallHealth(websiteData);
    const uptime = websiteData.uptime || 0;
    
    return Math.round((health + uptime) / 2);
  }
}

module.exports = new AIInsightsService();
