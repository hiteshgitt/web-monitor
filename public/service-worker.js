/**
 * Service Worker for Web Monitor
 * Handles background notifications and offline functionality
 */

const CACHE_NAME = 'webmonitor-v1';
const API_BASE_URL = 'http://localhost:5000/api';

// Install event - cache resources
self.addEventListener('install', (event) => {
  console.log('Service Worker installing...');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll([
        '/',
        '/icons/platforms/wordpress.png'
      ]);
    })
  );
  self.skipWaiting(); // Activate immediately
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('Service Worker activating...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  return self.clients.claim();
});

// Fetch event - handle network requests
self.addEventListener('fetch', (event) => {
  // Let the browser handle non-GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((response) => {
      // Return cached version or fetch from network
      return response || fetch(event.request);
    })
  );
});

// Background sync for checking alerts
self.addEventListener('sync', (event) => {
  if (event.tag === 'check-alerts') {
    event.waitUntil(checkAlerts());
  }
});

// Periodic background sync (if supported)
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'check-alerts-periodic') {
    event.waitUntil(checkAlerts());
  }
});

// Check for alerts in background
async function checkAlerts() {
  try {
    // Fetch websites
    const websitesResponse = await fetch(`${API_BASE_URL}/websites`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });

    if (!websitesResponse.ok) {
      throw new Error('Failed to fetch websites');
    }

    const websites = await websitesResponse.json();
    const alerts = [];

    // Extract alerts from websites
    for (const website of websites) {
      if (!website.seo?.sslEnabled) {
        alerts.push({
          id: `${website._id}-ssl`,
          type: 'ssl',
          priority: 'high',
          title: 'SSL Certificate Disabled',
          message: `SSL certificate is disabled on ${website.name}`,
          websiteId: website._id,
          websiteName: website.name
        });
      }

      if (website.security?.securityScore && website.security.securityScore < 70) {
        alerts.push({
          id: `${website._id}-security`,
          type: 'security',
          priority: 'medium',
          title: 'Security Score Low',
          message: `Security score is ${website.security.securityScore}/100 on ${website.name}`,
          websiteId: website._id,
          websiteName: website.name
        });
      }

      if (website.security?.outdatedPlugins && website.security.outdatedPlugins > 0) {
        alerts.push({
          id: `${website._id}-plugins`,
          type: 'plugins',
          priority: 'medium',
          title: 'Outdated Plugins Detected',
          message: `${website.security.outdatedPlugins} outdated plugin(s) on ${website.name}`,
          websiteId: website._id,
          websiteName: website.name
        });
      }
    }

    // Show notifications for high priority alerts
    const highPriorityAlerts = alerts.filter(a => a.priority === 'high');
    if (highPriorityAlerts.length > 0) {
      highPriorityAlerts.forEach(alert => {
        self.registration.showNotification(alert.title, {
          body: alert.message,
          icon: '/icons/platforms/wordpress.png',
          badge: '/icons/platforms/wordpress.png',
          tag: alert.id,
          requireInteraction: true,
          data: {
            websiteId: alert.websiteId,
            websiteName: alert.websiteName,
            alertType: alert.type
          }
        });
      });
    }

    // Store alerts for when app opens
    const clients = await self.clients.matchAll();
    clients.forEach(client => {
      client.postMessage({
        type: 'ALERTS_UPDATED',
        alerts: alerts
      });
    });

  } catch (error) {
    console.error('Error checking alerts in service worker:', error);
  }
}

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // If app is already open, focus it
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        if (client.url && 'focus' in client) {
          return client.focus();
        }
      }
      // Otherwise open a new window
      if (clients.openWindow) {
        return clients.openWindow('/');
      }
    })
  );
});

// Handle push notifications (if push API is implemented)
self.addEventListener('push', (event) => {
  if (event.data) {
    const data = event.data.json();
    const options = {
      body: data.message || 'New alert detected',
      icon: '/icons/platforms/wordpress.png',
      badge: '/icons/platforms/wordpress.png',
      tag: data.id || 'alert',
      requireInteraction: data.priority === 'high',
      data: data
    };

    event.waitUntil(
      self.registration.showNotification(data.title || 'Web Monitor Alert', options)
    );
  }
});

// Message handler for communication with main app
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'CHECK_ALERTS') {
    checkAlerts();
  }
});

