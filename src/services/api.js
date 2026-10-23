import { API_BASE_URL } from '../config/api';
import { apiFetch } from './session';

const CACHE_KEY = 'webmonitor_websites_cache';
const CACHE_TIMESTAMP_KEY = 'webmonitor_websites_cache_timestamp';

class ApiService {
  // Cache management
  static getCachedWebsites() {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (error) {
      console.error('Error reading cache:', error);
    }
    return null;
  }

  static setCachedWebsites(websites) {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(websites));
      localStorage.setItem(CACHE_TIMESTAMP_KEY, Date.now().toString());
    } catch (error) {
      console.error('Error saving cache:', error);
    }
  }

  static markWebsitesAsOffline(websites) {
    return websites.map(site => ({
      ...site,
      status: 'offline',
      backendConnected: false
    }));
  }

  static clearCache() {
    try {
      localStorage.removeItem(CACHE_KEY);
      localStorage.removeItem(CACHE_TIMESTAMP_KEY);
    } catch (error) {
      console.error('Error clearing cache:', error);
    }
  }

  // Website endpoints
  static async getWebsites() {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
    
    try {
      const response = await apiFetch(`${API_BASE_URL}/websites`, {
        signal: controller.signal,
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        // When using Vite proxy, no need for CORS mode
      });
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch websites: ${response.status} ${response.statusText}`);
      }
      
      const websites = await response.json();
      // Cache successful response
      this.setCachedWebsites(websites);
      return websites;
    } catch (error) {
      clearTimeout(timeoutId);
      
      // If fetch fails, return cached data marked as offline
      const cached = this.getCachedWebsites();
      if (cached && cached.length > 0) {
        return this.markWebsitesAsOffline(cached);
      }
      
      // Re-throw with more context
      throw new Error(`Backend connection failed: ${error.message}`, { cause: error });
    }
  }

  static async getWebsite(id) {
    const response = await apiFetch(`${API_BASE_URL}/websites/${id}`);
    if (!response.ok) {
      throw new Error('Failed to fetch website');
    }
    return response.json();
  }

  static async createWebsite(websiteData) {
    const response = await apiFetch(`${API_BASE_URL}/websites`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(websiteData),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || 'Failed to create website');
    }
    return response.json();
  }

  static async updateWebsite(id, websiteData) {
    const response = await apiFetch(`${API_BASE_URL}/websites/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(websiteData),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || 'Failed to update website');
    }
    return response.json();
  }

  static async deleteWebsite(id) {
    const response = await apiFetch(`${API_BASE_URL}/websites/${id}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      throw new Error('Failed to delete website');
    }
    return response.json();
  }

  static async getIncidents(websiteId, days = 30) {
    const response = await apiFetch(`${API_BASE_URL}/websites/${websiteId}/incidents?days=${days}`);
    if (!response.ok) {
      throw new Error('Failed to fetch incidents');
    }
    return response.json();
  }

  // Monitoring endpoints
  static async getMonitoringData(websiteId, hours = 24, limit = 100) {
    const response = await apiFetch(`${API_BASE_URL}/websites/${websiteId}/monitoring?hours=${hours}&limit=${limit}`);
    if (!response.ok) {
      throw new Error('Failed to fetch monitoring data');
    }
    return response.json();
  }

  static async getAnalyticsData(websiteId, days = 30) {
    const response = await apiFetch(`${API_BASE_URL}/websites/${websiteId}/analytics?days=${days}`);
    if (!response.ok) {
      throw new Error('Failed to fetch analytics data');
    }
    return response.json();
  }

  // Server-side check of a site's integration; resolves to { ok, status, message, responseTime }
  static async verifyWebsite({ url, platform, apiKey, websiteId }) {
    const response = await apiFetch(`${API_BASE_URL}/websites/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url, platform, apiKey, websiteId }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok && !data.message) {
      throw new Error(`Verification failed: ${response.status}`);
    }
    return data;
  }

  static async testWebsiteConnection(websiteId) {
    const response = await apiFetch(`${API_BASE_URL}/websites/${websiteId}/test`, {
      method: 'POST',
    });
    if (!response.ok) {
      throw new Error('Failed to test website connection');
    }
    return response.json();
  }

  // Health check
  static async healthCheck() {
    const response = await fetch(`${API_BASE_URL}/health`);
    if (!response.ok) {
      throw new Error('API health check failed');
    }
    return response.json();
  }
}

export default ApiService;
