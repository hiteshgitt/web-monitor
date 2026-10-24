// Alerts from the server (history, read state, push settings) and this browser's push subscription.
// The service worker (public/service-worker.js) reads the device pull key from IndexedDB to fetch alert text.
import { API_BASE_URL } from '../config/api';
import { apiFetch } from './session';

const json = async (response) => {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
  return data;
};

const send = (path, method, body) => apiFetch(`${API_BASE_URL}${path}`, {
  method,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body ?? {}),
}).then(json);

export const fetchNotifications = () => apiFetch(`${API_BASE_URL}/notifications?limit=50`).then(json);
export const markNotificationsRead = (ids) => send('/notifications/read', 'POST', ids ? { ids } : {});
export const fetchAlertSettings = () => apiFetch(`${API_BASE_URL}/notifications/settings`).then(json);
export const saveAlertSettings = (prefs) => send('/notifications/settings', 'PUT', prefs);
export const removePushDevice = (id) => send('/notifications/devices/remove', 'POST', { id });

// --- This browser's push subscription ---

const DB_NAME = 'webmonitor-push';

function withStore(mode, run) {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open(DB_NAME, 1);
    open.onupgradeneeded = () => open.result.createObjectStore('config');
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const tx = open.result.transaction('config', mode);
      const request = run(tx.objectStore('config'));
      tx.oncomplete = () => resolve(request?.result);
      tx.onerror = () => reject(tx.error);
    };
  });
}

export const browserPushSupported = () => typeof window !== 'undefined'
  && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window && 'indexedDB' in window;

const keyBytes = (base64url) => {
  const base64 = (base64url + '='.repeat((4 - (base64url.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
};

const browserLabel = () => {
  const ua = navigator.userAgent;
  const browser = /Edg\//.test(ua) ? 'Edge' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : 'Browser';
  const os = /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iOS' : /Mac OS/.test(ua) ? 'macOS' : /Windows/.test(ua) ? 'Windows' : /Linux/.test(ua) ? 'Linux' : '';
  return os ? `${browser} on ${os}` : browser;
};

export async function currentBrowserSubscription() {
  if (!browserPushSupported()) return null;
  const registration = await navigator.serviceWorker.getRegistration();
  return registration ? registration.pushManager.getSubscription() : null;
}

// Asks for permission (must run from a click), subscribes and registers this browser with the server
export async function enableBrowserPush(publicKey) {
  if (!browserPushSupported()) throw new Error('This browser does not support notifications.');
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error('Notifications are blocked for this site. Allow them in your browser’s site settings, then try again.');
  }
  const registration = await navigator.serviceWorker.register('/service-worker.js');
  await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription()
    || await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(publicKey) });
  const device = await send('/notifications/devices', 'POST', { kind: 'web', endpoint: subscription.endpoint, label: browserLabel() });
  await withStore('readwrite', (store) => store.put({ pullKey: device.pullKey, apiBase: new URL(API_BASE_URL, location.origin).href }, 'device'));
  return device;
}

// Unsubscribes this browser; tells the server unless signing out already removed the session
export async function disableBrowserPush({ notifyServer = true } = {}) {
  const subscription = await currentBrowserSubscription().catch(() => null);
  if (subscription) {
    if (notifyServer) await send('/notifications/devices/remove', 'POST', { endpoint: subscription.endpoint }).catch(() => {});
    await subscription.unsubscribe().catch(() => {});
  }
  if (browserPushSupported()) await withStore('readwrite', (store) => store.delete('device')).catch(() => {});
}
