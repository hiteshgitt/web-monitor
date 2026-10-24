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
    data: { websiteId: alert.websiteId },
  })));
}

self.addEventListener('push', (event) => event.waitUntil(showPendingAlerts()));

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const siteId = event.notification.data?.websiteId;
  const url = siteId ? `/app?site=${encodeURIComponent(siteId)}` : '/app';
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
    const open = windows.find((w) => new URL(w.url).pathname.startsWith('/app'));
    if (open) {
      open.postMessage({ type: 'open-site', siteId });
      return open.focus();
    }
    return self.clients.openWindow(url);
  }));
});
