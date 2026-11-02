// Web Monitor service worker: shows alerts pushed while the dashboard is closed.
// The server sends an empty Web Push as a wake-up; we fetch the alert text with this browser's pull key
// (saved to IndexedDB by src/services/alerts.js) and show each alert.

const DB_NAME = 'webmonitor-push';

const readDevice = () => new Promise((resolve) => {
  const open = indexedDB.open(DB_NAME, 1);
  open.onupgradeneeded = () => open.result.createObjectStore('config');
  open.onerror = () => resolve(null);
  open.onsuccess = () => {
    const request = open.result.transaction('config').objectStore('config').get('device');
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => resolve(null);
  };
});

self.addEventListener('install', () => self.skipWaiting());

// Earlier versions cached the app shell; drop those caches so the dashboard is always current
self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((names) => Promise.all(names.map((name) => caches.delete(name))))
    .then(() => self.clients.claim()));
});

async function showPendingAlerts() {
  const device = await readDevice();
  let alerts = [];
  if (device?.pullKey) {
    try {
      const response = await fetch(`${device.apiBase}/push/pull?key=${encodeURIComponent(device.pullKey)}`);
      if (response.ok) alerts = (await response.json()).notifications || [];
    } catch {
      // Offline: fall through to the generic notice below
    }
  }
  if (alerts.length === 0) {
    // Browsers require a visible notification for every push
    return self.registration.showNotification('Web Monitor', { body: 'You have new alerts. Open the dashboard to see them.', icon: '/icons/icon-192.png', tag: 'webmonitor-generic' });
  }
  return Promise.all(alerts.map((alert) => self.registration.showNotification(alert.title, {
    body: alert.body,
    icon: '/icons/icon-192.png',
    tag: alert._id,
    requireInteraction: alert.type === 'site_down',
    data: {
      websiteId: alert.websiteId,
      alertId: alert._id,
      alertType: alert.type,
      alertTitle: alert.title,
      alertBody: alert.body,
      alertAt: alert.createdAt,
    },
  })));
}

self.addEventListener('push', (event) => event.waitUntil(showPendingAlerts()));

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  const siteId = data.websiteId;
  const params = new URLSearchParams();
  if (siteId) params.set('site', siteId);
  if (data.alertType) {
    params.set('alertId', data.alertId || '');
    params.set('alertType', data.alertType);
    params.set('alertTitle', data.alertTitle || '');
    params.set('alertBody', data.alertBody || '');
    params.set('alertAt', data.alertAt || '');
  }
  const url = `/app${params.toString() ? `?${params}` : ''}`;
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async (windows) => {
    const open = windows.find((w) => {
      try {
        return new URL(w.url).pathname.startsWith('/app');
      } catch {
        return false;
      }
    });
    if (open) {
      open.postMessage({ type: 'open-site', siteId, ...data });
      // Prefer navigating the open dashboard to the alert URL so a refresh still has context.
      if (typeof open.navigate === 'function' && (siteId || data.alertType)) {
        try {
          await open.navigate(url);
        } catch {
          // navigate() is unsupported in some browsers; focus + postMessage still apply.
        }
      }
      return open.focus();
    }
    return self.clients.openWindow(url);
  }));
});
