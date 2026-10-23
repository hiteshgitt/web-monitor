/**
 * Notification Service
 * Handles browser push notifications and alert management
 */

// Use relative URL in development (via Vite proxy) or absolute URL in production
import { API_BASE_URL } from '../config/api';
import { apiFetch, getToken } from './session';
const NOTIFICATION_STORAGE_KEY = 'webmonitor_notifications';
const LAST_CHECK_KEY = 'webmonitor_last_check';

class NotificationService {
  constructor() {
    this.permission = null;
    this.notificationCount = 0;
    this.alerts = [];
    this.checkInterval = null;
    this.listeners = [];
    this.isChecking = false;
  }

  // Initialize notification service
  async initialize() {
    // Check browser support
    if (!('Notification' in window)) {
      console.warn('This browser does not support notifications');
      return false;
    }

    // Request permission
    this.permission = Notification.permission;
    if (this.permission === 'default') {
      this.permission = await Notification.requestPermission();
    }

    // Load cached notifications
    this.loadCachedNotifications();

    // Start checking for alerts periodically
    this.startPeriodicCheck();

    return this.permission === 'granted';
  }

  // Load cached notifications from localStorage
  loadCachedNotifications() {
    try {
      const cached = localStorage.getItem(NOTIFICATION_STORAGE_KEY);
      if (cached) {
        const data = JSON.parse(cached);
        this.alerts = data.alerts || [];
        this.notificationCount = this.alerts.filter(a => !a.read).length;
        this.notifyListeners();
      }
    } catch (error) {
      console.error('Error loading cached notifications:', error);
    }
  }

  // Save notifications to localStorage
  saveNotifications() {
    try {
      localStorage.setItem(NOTIFICATION_STORAGE_KEY, JSON.stringify({
        alerts: this.alerts,
        lastCheck: Date.now()
      }));
    } catch (error) {
      console.error('Error saving notifications:', error);
    }
  }

  // Fetch alerts from all websites
  async fetchAllAlerts() {
    // Nothing to poll until someone is signed in
    if (this.isChecking || !getToken()) return;
    
    this.isChecking = true;
    try {
      // Fetch all websites
      const websitesResponse = await apiFetch(`${API_BASE_URL}/websites`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!websitesResponse.ok) {
        throw new Error('Failed to fetch websites');
      }

      const websites = await websitesResponse.json();
      const allAlerts = [];

      // Check each website for alerts
      for (const website of websites) {
        const alerts = this.extractAlertsFromWebsite(website);
        allAlerts.push(...alerts.map(alert => ({
          ...alert,
          websiteId: website._id,
          websiteName: website.name,
          websiteUrl: website.url
        })));
      }

      // Compare with previous alerts to detect new ones
      const previousById = new Map(this.alerts.map(a => [a.id, a]));
      const newAlerts = allAlerts.filter(alert => !previousById.has(alert.id));

      // Preserve read state so we don't re-notify for same alerts when app is open
      allAlerts.forEach(alert => {
        const prev = previousById.get(alert.id);
        if (prev && prev.read) alert.read = true;
      });

      // Update alerts; count only unread so badge is one-time until new alerts
      this.alerts = allAlerts;
      this.notificationCount = this.alerts.filter(a => !a.read).length;
      this.saveNotifications();
      this.notifyListeners();

      // Show browser notifications for new alerts
      if (newAlerts.length > 0 && this.permission === 'granted') {
        this.showBrowserNotifications(newAlerts);
      }

      return allAlerts;
    } catch (error) {
      console.error('Error fetching alerts:', error);
      return [];
    } finally {
      this.isChecking = false;
    }
  }

  // Extract alerts from website data
  extractAlertsFromWebsite(website) {
    const alerts = [];
    let alertId = 0;

    // SSL Alert
    if (!website.seo?.sslEnabled) {
      alerts.push({
        id: `${website._id}-ssl-${alertId++}`,
        type: 'ssl',
        priority: 'high',
        title: 'SSL Certificate Disabled',
        message: `SSL certificate is disabled on ${website.name}`,
        description: 'Enable SSL for better security and SEO'
      });
    }

    // Security Score Alert
    if (website.security?.securityScore && website.security.securityScore < 70) {
      alerts.push({
        id: `${website._id}-security-${alertId++}`,
        type: 'security',
        priority: 'medium',
        title: 'Security Score Low',
        message: `Security score is ${website.security.securityScore}/100 on ${website.name}`,
        description: 'Security score is below recommended threshold'
      });
    }

    // Outdated Plugins Alert
    if (website.security?.outdatedPlugins && website.security.outdatedPlugins > 0) {
      alerts.push({
        id: `${website._id}-plugins-${alertId++}`,
        type: 'plugins',
        priority: 'medium',
        title: 'Outdated Plugins Detected',
        message: `${website.security.outdatedPlugins} outdated plugin(s) on ${website.name}`,
        description: 'Update plugins to fix security vulnerabilities'
      });
    }

    // Meta Tags Alert
    if (website.seo?.metaTags === 'incomplete') {
      alerts.push({
        id: `${website._id}-meta-${alertId++}`,
        type: 'meta',
        priority: 'low',
        title: 'Meta Tags Incomplete',
        message: `Meta tags incomplete on ${website.name}`,
        description: 'Complete meta tags for better SEO'
      });
    }

    // SEO Issues Alert
    if (website.seo?.seoIssues && website.seo.seoIssues.length > 0) {
      alerts.push({
        id: `${website._id}-seo-${alertId}`,
        type: 'seo',
        priority: 'medium',
        title: 'SEO Issues Found',
        message: `${website.seo.seoIssues.length} SEO issue(s) on ${website.name}`,
        description: 'Review and fix SEO issues'
      });
    }

    return alerts;
  }

  // Show browser notifications
  showBrowserNotifications(newAlerts) {
    // Show notification for each new alert (limit to 3 to avoid spam)
    const alertsToShow = newAlerts.slice(0, 3);
    
    alertsToShow.forEach((alert, index) => {
      setTimeout(() => {
        const notification = new Notification(alert.title, {
          body: alert.message,
          icon: '/icons/platforms/wordpress.png', // Default icon
          badge: '/icons/platforms/wordpress.png',
          tag: alert.id, // Prevent duplicate notifications
          requireInteraction: alert.priority === 'high',
          data: {
            websiteId: alert.websiteId,
            websiteName: alert.websiteName,
            alertType: alert.type,
            priority: alert.priority
          }
        });

        // Handle notification click
        notification.onclick = () => {
          window.focus();
          notification.close();
          // Dispatch custom event to navigate to specific website's alerts
          window.dispatchEvent(new CustomEvent('notification-clicked', {
            detail: {
              ...alert,
              navigateTo: {
                websiteId: alert.websiteId,
                websiteName: alert.websiteName,
                alertType: alert.type,
                tab: 'alerts' // Navigate to alerts tab
              }
            }
          }));
        };
      }, index * 1000); // Stagger notifications
    });

    // If there are more than 3 alerts, show a summary
    if (newAlerts.length > 3) {
      setTimeout(() => {
        new Notification('More Alerts', {
          body: `You have ${newAlerts.length - 3} more alert(s). Click to view all.`,
          icon: '/icons/platforms/wordpress.png',
          tag: 'more-alerts'
        });
      }, 4000);
    }
  }

  // Start periodic check for alerts
  startPeriodicCheck() {
    // Check immediately
    this.fetchAllAlerts();

    // Then check every 2 minutes
    this.checkInterval = setInterval(() => {
      this.fetchAllAlerts();
    }, 2 * 60 * 1000); // 2 minutes
  }

  // Stop periodic check
  stopPeriodicCheck() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  // Get current notification count
  getNotificationCount() {
    return this.notificationCount;
  }

  // Get notification count for a specific website
  getNotificationCountForWebsite(websiteId) {
    return this.alerts.filter(alert => alert.websiteId === websiteId).length;
  }

  // Get all alerts
  getAlerts() {
    return this.alerts;
  }

  // Get alerts for a specific website
  getAlertsForWebsite(websiteId) {
    return this.alerts.filter(alert => alert.websiteId === websiteId);
  }

  // Get alerts grouped by website
  getAlertsByWebsite() {
    const grouped = {};
    this.alerts.forEach(alert => {
      if (!grouped[alert.websiteId]) {
        grouped[alert.websiteId] = {
          websiteId: alert.websiteId,
          websiteName: alert.websiteName,
          websiteUrl: alert.websiteUrl,
          alerts: []
        };
      }
      grouped[alert.websiteId].alerts.push(alert);
    });
    return Object.values(grouped);
  }

  // Clear all notifications
  clearNotifications() {
    this.alerts = [];
    this.notificationCount = 0;
    this.saveNotifications();
    this.notifyListeners();
  }

  // Mark alert as read
  markAsRead(alertId) {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.read = true;
      this.notificationCount = this.alerts.filter(a => !a.read).length;
      this.saveNotifications();
      this.notifyListeners();
    }
  }

  // Mark all alerts as seen (one-time: badge clears when user opens the panel)
  markAllAsSeen() {
    this.alerts.forEach(a => { a.read = true; });
    this.notificationCount = 0;
    this.saveNotifications();
    this.notifyListeners();
  }

  // Subscribe to notification updates
  subscribe(listener) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  // Notify all listeners
  notifyListeners() {
    this.listeners.forEach(listener => {
      listener({
        count: this.notificationCount,
        alerts: this.alerts
      });
    });
  }

  // Check if service worker is supported
  isServiceWorkerSupported() {
    return 'serviceWorker' in navigator;
  }

  // Register service worker
  async registerServiceWorker() {
    if (!this.isServiceWorkerSupported()) {
      console.warn('Service workers are not supported');
      return false;
    }

    try {
      const registration = await navigator.serviceWorker.register('/service-worker.js');
      console.log('Service Worker registered:', registration);
      return registration;
    } catch (error) {
      console.error('Service Worker registration failed:', error);
      return null;
    }
  }
}

// Export singleton instance
const notificationService = new NotificationService();
export default notificationService;

