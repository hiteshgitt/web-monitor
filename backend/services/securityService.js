const axios = require('axios');

class SecurityService {
  constructor() {
    this.virusTotalApiKey = process.env.VIRUSTOTAL_API_KEY;
    this.shodanApiKey = process.env.SHODAN_API_KEY;
    this.sslLabsApiKey = process.env.SSLLABS_API_KEY;
  }

  // Real-time Security Monitoring
  async getSecurityStatus(website) {
    const [
      malwareScan,
      vulnerabilityScan,
      sslStatus,
      firewallStatus,
      intrusionDetection,
      securityHeaders
    ] = await Promise.all([
      this.performMalwareScan(website),
      this.performVulnerabilityScan(website),
      this.checkSSLStatus(website),
      this.checkFirewallStatus(website),
      this.checkIntrusionDetection(website),
      this.checkSecurityHeaders(website)
    ]);

    return {
      malwareScan,
      vulnerabilityScan,
      sslStatus,
      firewallStatus,
      intrusionDetection,
      securityHeaders,
      overallSecurityScore: this.calculateSecurityScore({
        malwareScan,
        vulnerabilityScan,
        sslStatus,
        firewallStatus,
        intrusionDetection,
        securityHeaders
      })
    };
  }

  // Malware Scanning
  async performMalwareScan(website) {
    if (!this.virusTotalApiKey) {
      const error = new Error('VirusTotal API key is not configured. Please set VIRUSTOTAL_API_KEY in your environment variables.');
      error.statusCode = 503;
      error.service = 'VirusTotal';
      throw error;
    }

    try {
      const response = await axios.get(`https://www.virustotal.com/vtapi/v2/url/report`, {
        params: {
          apikey: this.virusTotalApiKey,
          resource: website.url
        },
        httpsAgent: new (require('https').Agent)({ rejectUnauthorized: false })
      });

      if (response.data.response_code === 1) {
        return {
          status: response.data.positives > 0 ? 'infected' : 'clean',
          threats: response.data.positives,
          engines: response.data.total,
          scanDate: response.data.scan_date,
          details: response.data.scans
        };
      } else {
        const error = new Error(`VirusTotal scan failed: ${response.data.verbose_msg || 'Unknown error'}`);
        error.statusCode = 503;
        error.service = 'VirusTotal';
        throw error;
      }
    } catch (error) {
      console.error('Malware scan error:', error.message);
      const apiError = new Error(`Failed to perform malware scan: ${error.message}`);
      apiError.statusCode = error.response?.status || 500;
      apiError.service = 'VirusTotal';
      apiError.originalError = error;
      throw apiError;
    }
  }

  // Vulnerability Scanning
  async performVulnerabilityScan(website) {
    try {
      // Real vulnerability scanning requires integration with:
      // - OWASP ZAP API
      // - Nessus API
      // - OpenVAS API
      // - Qualys API
      // For now, perform basic checks
      const vulnerabilities = await this.checkCommonVulnerabilities(website);
      const outdatedComponents = await this.checkOutdatedComponents(website);
      
      return {
        status: vulnerabilities.length > 0 ? 'vulnerable' : 'secure',
        vulnerabilityCount: vulnerabilities.length,
        vulnerabilities: vulnerabilities,
        outdatedComponents: outdatedComponents,
        lastScan: new Date().toISOString(),
        riskLevel: this.calculateRiskLevel(vulnerabilities)
      };
    } catch (error) {
      console.error('Vulnerability scan error:', error.message);
      const apiError = new Error(`Failed to perform vulnerability scan: ${error.message}`);
      apiError.statusCode = 500;
      apiError.service = 'Vulnerability Scanner';
      apiError.originalError = error;
      throw apiError;
    }
  }

  // SSL Certificate Monitoring
  async checkSSLStatus(website) {
    try {
      const response = await axios.get(`https://api.ssllabs.com/api/v3/analyze`, {
        params: {
          host: website.url.replace(/^https?:\/\//, '').replace(/\/$/, ''),
          publish: 'off',
          startNew: 'on',
          all: 'done'
        },
        httpsAgent: new (require('https').Agent)({ rejectUnauthorized: false }),
        timeout: 30000
      });

      if (response.data.status === 'READY' && response.data.endpoints && response.data.endpoints.length > 0) {
        const endpoint = response.data.endpoints[0];
        return {
          status: endpoint.statusMessage,
          grade: endpoint.grade,
          expiresOn: endpoint.details?.cert?.notAfter,
          issuer: endpoint.details?.cert?.issuerSubject,
          protocol: endpoint.details?.protocols?.[0]?.name,
          cipher: endpoint.details?.suite?.name,
          hsts: endpoint.details?.hsts,
          vulnerabilities: endpoint.details?.vulnBeast || endpoint.details?.vulnPoodle
        };
      } else if (response.data.status === 'IN_PROGRESS' || response.data.status === 'DNS') {
        const error = new Error('SSL Labs scan is in progress. Please try again in a few moments.');
        error.statusCode = 202;
        error.service = 'SSL Labs';
        throw error;
      } else {
        const error = new Error(`SSL Labs scan failed: ${response.data.status || 'Unknown error'}`);
        error.statusCode = 503;
        error.service = 'SSL Labs';
        throw error;
      }
    } catch (error) {
      console.error('SSL check error:', error.message);
      const apiError = new Error(`Failed to check SSL status: ${error.message}`);
      apiError.statusCode = error.response?.status || error.statusCode || 500;
      apiError.service = 'SSL Labs';
      apiError.originalError = error;
      throw apiError;
    }
  }

  // Firewall Status Check
  async checkFirewallStatus(website) {
    try {
      // Real firewall status requires API integration with:
      // - Cloudflare API
      // - AWS WAF API
      // - ModSecurity
      // - Sucuri Firewall
      // For now, detect from headers
      const headers = await this.getWebsiteHeaders(website);
      const firewallDetected = this.detectFirewall(headers);
      const provider = this.detectFirewallProvider(headers);
      
      return {
        enabled: firewallDetected,
        provider: provider || 'Unknown',
        rules: null, // Requires API integration
        blockedRequests: null, // Requires API integration
        lastActivity: new Date().toISOString(),
        configuration: {
          ddosProtection: firewallDetected,
          botProtection: firewallDetected,
          geoBlocking: null, // Requires API integration
          rateLimiting: firewallDetected
        },
        note: firewallDetected 
          ? `Firewall detected via headers (${provider}). For detailed metrics, integrate with ${provider} API.`
          : 'No firewall detected. Consider implementing a WAF (Web Application Firewall).'
      };
    } catch (error) {
      console.error('Firewall check error:', error.message);
      const apiError = new Error(`Failed to check firewall status: ${error.message}`);
      apiError.statusCode = 500;
      apiError.service = 'Firewall Check';
      apiError.originalError = error;
      throw apiError;
    }
  }

  // Intrusion Detection
  async checkIntrusionDetection(website) {
    // Intrusion detection requires integration with:
    // - Security Information and Event Management (SIEM) systems
    // - Intrusion Detection Systems (IDS)
    // - Security monitoring tools
    const error = new Error('Intrusion Detection monitoring not implemented. Requires SIEM/IDS integration (Splunk, ELK Stack, OSSEC, etc.).');
    error.statusCode = 501;
    error.service = 'Intrusion Detection';
    throw error;
  }

  // Security Headers Check
  async checkSecurityHeaders(website) {
    try {
      const headers = await this.getWebsiteHeaders(website);
      
      const securityHeaders = {
        'Strict-Transport-Security': headers['strict-transport-security'] || null,
        'X-Content-Type-Options': headers['x-content-type-options'] || null,
        'X-Frame-Options': headers['x-frame-options'] || null,
        'X-XSS-Protection': headers['x-xss-protection'] || null,
        'Content-Security-Policy': headers['content-security-policy'] || null,
        'Referrer-Policy': headers['referrer-policy'] || null,
        'Permissions-Policy': headers['permissions-policy'] || null
      };

      const score = Object.values(securityHeaders).filter(header => header !== null).length;
      const totalHeaders = Object.keys(securityHeaders).length;

      return {
        score: Math.round((score / totalHeaders) * 100),
        headers: securityHeaders,
        missingHeaders: Object.keys(securityHeaders).filter(key => !securityHeaders[key]),
        recommendations: this.generateSecurityHeaderRecommendations(securityHeaders)
      };
    } catch (error) {
      console.error('Security headers check error:', error.message);
      const apiError = new Error(`Failed to check security headers: ${error.message}`);
      apiError.statusCode = 500;
      apiError.service = 'Security Headers';
      apiError.originalError = error;
      throw apiError;
    }
  }

  // WordPress Security Check
  async checkWordPressSecurity(website) {
    // WordPress security check requires WordPress REST API access
    // This should be fetched from the WordPress site's webmonitor API endpoint
    // For now, return basic info from headers
    try {
      const version = await this.getWordPressVersion(website);
      return {
        version: version,
        isLatestVersion: null, // Requires version comparison
        plugins: {
          total: null, // Requires WordPress API
          outdated: null,
          vulnerable: null
        },
        themes: {
          total: null,
          outdated: null,
          vulnerable: null
        },
        securityPlugins: null,
        adminUsers: null,
        filePermissions: {
          correct: null,
          issues: null
        },
        note: 'WordPress security details require WordPress REST API access. Use the webmonitor WordPress plugin for detailed information.'
      };
    } catch (error) {
      const apiError = new Error(`Failed to check WordPress security: ${error.message}`);
      apiError.statusCode = 500;
      apiError.service = 'WordPress Security';
      apiError.originalError = error;
      throw apiError;
    }
  }

  // Helper Methods
  async getWebsiteHeaders(website) {
    try {
      const response = await axios.head(website.url, { timeout: 10000 });
      return response.headers;
    } catch (error) {
      return {};
    }
  }

  detectFirewall(headers) {
    const firewallIndicators = [
      'cf-ray', // Cloudflare
      'x-sucuri-id', // Sucuri
      'x-aws-waf', // AWS WAF
      'x-security', // Generic
      'server' // Check server header
    ];

    return firewallIndicators.some(indicator => headers[indicator.toLowerCase()]);
  }

  detectFirewallProvider(headers) {
    if (headers['cf-ray']) return 'Cloudflare';
    if (headers['x-sucuri-id']) return 'Sucuri';
    if (headers['x-aws-waf']) return 'AWS WAF';
    if (headers['server'] && headers['server'].includes('nginx')) return 'Nginx';
    return 'Unknown';
  }

  async checkCommonVulnerabilities(website) {
    // Real vulnerability detection requires integration with:
    // - OWASP ZAP API
    // - Nessus API
    // - OpenVAS API
    // - Automated security scanners
    // For now, return empty array - real implementation needed
    return [];
  }

  async checkOutdatedComponents(website) {
    // Real outdated component detection requires:
    // - Dependency scanning tools
    // - Package manager APIs
    // - Security advisory databases
    // For now, return empty array - real implementation needed
    return [];
  }

  calculateRiskLevel(vulnerabilities) {
    const highSeverity = vulnerabilities.filter(v => v.severity === 'high').length;
    const mediumSeverity = vulnerabilities.filter(v => v.severity === 'medium').length;
    
    if (highSeverity > 0) return 'high';
    if (mediumSeverity > 2) return 'medium';
    return 'low';
  }

  calculateSecurityScore(securityData) {
    let score = 100;
    
    if (securityData.malwareScan.status === 'infected') score -= 30;
    if (securityData.vulnerabilityScan.vulnerabilityCount > 0) score -= 20;
    if (securityData.sslStatus.grade === 'F') score -= 25;
    if (!securityData.firewallStatus.enabled) score -= 15;
    if (securityData.intrusionDetection.suspiciousActivity > 5) score -= 10;
    if (securityData.securityHeaders.score < 80) score -= 10;

    return Math.max(0, score);
  }

  generateSecurityHeaderRecommendations(headers) {
    const recommendations = [];
    
    if (!headers['Strict-Transport-Security']) {
      recommendations.push('Implement HSTS (HTTP Strict Transport Security) header');
    }
    if (!headers['X-Content-Type-Options']) {
      recommendations.push('Add X-Content-Type-Options: nosniff header');
    }
    if (!headers['X-Frame-Options']) {
      recommendations.push('Add X-Frame-Options header to prevent clickjacking');
    }
    if (!headers['Content-Security-Policy']) {
      recommendations.push('Implement Content Security Policy (CSP) header');
    }

    return recommendations;
  }

  async getWordPressVersion(website) {
    try {
      const response = await axios.get(`${website.url}/wp-json/wp/v2/`, { timeout: 5000 });
      return response.headers['x-wp-version'] || 'Unknown';
    } catch (error) {
      return 'Unknown';
    }
  }


  // Comprehensive Security Analysis
  async getComprehensiveSecurity(website) {
    const results = {
      securityStatus: null,
      wordPressSecurity: null,
      errors: []
    };

    // Fetch security status (required)
    try {
      results.securityStatus = await this.getSecurityStatus(website);
    } catch (error) {
      results.errors.push({
        service: 'Security Status',
        error: error.message,
        statusCode: error.statusCode
      });
    }

    // Fetch WordPress security (optional - only for WordPress sites)
    if (website.platform === 'wordpress') {
      try {
        results.wordPressSecurity = await this.checkWordPressSecurity(website);
      } catch (error) {
        console.warn(`WordPress security check unavailable: ${error.message}`);
      }
    }

    // If security status failed, throw error
    if (!results.securityStatus) {
      const error = new Error('Unable to fetch security data. Security status check failed.');
      error.statusCode = 503;
      error.details = results.errors;
      throw error;
    }

    return {
      ...results.securityStatus,
      wordPressSecurity: results.wordPressSecurity,
      summary: {
        overallScore: results.securityStatus.overallSecurityScore,
        riskLevel: this.calculateOverallRiskLevel(results.securityStatus, results.wordPressSecurity),
        criticalIssues: this.identifyCriticalSecurityIssues(results.securityStatus, results.wordPressSecurity),
        recommendations: this.generateSecurityRecommendations(results.securityStatus, results.wordPressSecurity)
      },
      warnings: results.errors.length > 0 ? results.errors : undefined
    };
  }

  calculateOverallRiskLevel(securityStatus, wordPressSecurity) {
    if (securityStatus.malwareScan.status === 'infected') return 'critical';
    if (securityStatus.vulnerabilityScan.vulnerabilityCount > 3) return 'high';
    if (wordPressSecurity.plugins.vulnerable > 0) return 'high';
    if (securityStatus.overallSecurityScore < 70) return 'medium';
    return 'low';
  }

  identifyCriticalSecurityIssues(securityStatus, wordPressSecurity) {
    const issues = [];
    
    if (securityStatus.malwareScan.status === 'infected') {
      issues.push('Critical: Malware detected on website');
    }
    if (securityStatus.vulnerabilityScan.vulnerabilityCount > 0) {
      issues.push(`Critical: ${securityStatus.vulnerabilityScan.vulnerabilityCount} vulnerabilities found`);
    }
    if (wordPressSecurity.plugins.vulnerable > 0) {
      issues.push(`Critical: ${wordPressSecurity.plugins.vulnerable} vulnerable plugins detected`);
    }
    if (securityStatus.sslStatus.grade === 'F') {
      issues.push('Critical: SSL certificate issues detected');
    }

    return issues;
  }

  generateSecurityRecommendations(securityStatus, wordPressSecurity) {
    const recommendations = [];
    
    if (securityStatus.overallSecurityScore < 80) {
      recommendations.push('Implement comprehensive security monitoring');
    }
    if (wordPressSecurity.plugins.outdated > 0) {
      recommendations.push('Update outdated WordPress plugins');
    }
    if (securityStatus.securityHeaders.score < 90) {
      recommendations.push('Improve security headers configuration');
    }
    if (!securityStatus.firewallStatus.enabled) {
      recommendations.push('Enable web application firewall');
    }

    return recommendations;
  }
}

module.exports = new SecurityService();
