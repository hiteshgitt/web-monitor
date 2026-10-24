// Push delivery for new notifications, run at the end of each monitoring cycle.
// - Mobile app: Expo push service (one request carries up to 100 messages).
// - Browsers: an empty Web Push "wake-up" signed with our VAPID key; the service worker then fetches
//   the alert text from /api/push/pull with its device pull_key (no payload encryption needed).
import { SignJWT, importJWK } from 'jose';
import { notifyPrefs, wantsPush } from './alerts.js';
import { nowIso, placeholders } from './util.js';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const EXPO_BATCH = 100;
// Alerts that waited longer than this (e.g. push not configured yet) are not pushed late
const MAX_PUSH_AGE_MS = 60 * 60 * 1000;
// D1 allows 100 bound parameters per query; the rest wait for the next minute
const PENDING_PER_RUN = 90;

const vapidKeyCache = new Map();

async function vapidAuthorization(env, endpoint) {
  const audience = new URL(endpoint).origin;
  const cached = vapidKeyCache.get(audience);
  if (cached && cached.expires > Date.now() + 60_000) return cached.header;
  const key = await importJWK(JSON.parse(env.VAPID_PRIVATE_JWK), 'ES256');
  const expires = Date.now() + 12 * 60 * 60 * 1000;
  const jwt = await new SignJWT({ aud: audience, sub: env.VAPID_SUBJECT || 'mailto:hiteshgml@gmail.com' })
    .setProtectedHeader({ alg: 'ES256', typ: 'JWT' })
    .setExpirationTime(Math.floor(expires / 1000))
    .sign(key);
  const header = `vapid t=${jwt}, k=${env.VAPID_PUBLIC_KEY}`;
  vapidKeyCache.set(audience, { header, expires });
  return header;
}

export const webPushConfigured = (env) => Boolean(env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_JWK);

async function wakeBrowser(env, device) {
  const response = await fetch(device.token, {
    method: 'POST',
    headers: { Authorization: await vapidAuthorization(env, device.token), TTL: '86400', Urgency: 'high', 'Content-Length': '0' },
  });
  await response.body?.cancel();
  // 404/410: the browser unsubscribed or the subscription expired
  return { gone: response.status === 404 || response.status === 410 };
}

async function sendExpo(messages) {
  const response = await fetch(EXPO_PUSH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(messages),
  });
  const data = await response.json().catch(() => ({}));
  return Array.isArray(data.data) ? data.data : [];
}

// Push every not-yet-pushed notification. `maxRequests` caps outgoing fetches (Workers free plan limit).
export async function deliverPendingPush(env, maxRequests = 6, at = new Date()) {
  const db = env.DB;
  const { results: pending } = await db.prepare(
    'SELECT * FROM notifications WHERE pushed_at IS NULL ORDER BY created_at LIMIT ?',
  ).bind(PENDING_PER_RUN).all();
  if (pending.length === 0) return { pushed: 0 };

  const userIds = [...new Set(pending.map((n) => n.user_id))];
  const [users, devices] = await db.batch([
    db.prepare(`SELECT id, notify_prefs FROM users WHERE id IN (${placeholders(userIds.length)})`).bind(...userIds),
    db.prepare(`SELECT * FROM push_devices WHERE user_id IN (${placeholders(userIds.length)})`).bind(...userIds),
  ]);
  const prefsByUser = new Map(users.results.map((u) => [u.id, notifyPrefs(u)]));
  const devicesByUser = new Map();
  for (const device of devices.results) {
    if (!devicesByUser.has(device.user_id)) devicesByUser.set(device.user_id, []);
    devicesByUser.get(device.user_id).push(device);
  }

  const expoMessages = [];
  const browsersToWake = new Map();
  for (const n of pending) {
    const prefs = prefsByUser.get(n.user_id);
    if (!prefs || !wantsPush(prefs, n.type) || at - new Date(n.created_at) > MAX_PUSH_AGE_MS) continue;
    for (const device of devicesByUser.get(n.user_id) || []) {
      if (device.kind === 'expo') {
        expoMessages.push({
          device,
          message: {
            to: device.token, title: n.title, body: n.body, sound: 'default', priority: 'high',
            channelId: 'alerts', data: { notificationId: n.id, websiteId: n.website_id, type: n.type },
          },
        });
      } else if (webPushConfigured(env)) {
        browsersToWake.set(device.id, device);
      }
    }
  }

  const goneDeviceIds = new Set();
  let requests = 0;
  for (let i = 0; i < expoMessages.length && requests < maxRequests; i += EXPO_BATCH) {
    const batch = expoMessages.slice(i, i + EXPO_BATCH);
    requests += 1;
    const tickets = await sendExpo(batch.map((m) => m.message)).catch(() => []);
    tickets.forEach((ticket, j) => {
      if (ticket?.details?.error === 'DeviceNotRegistered') goneDeviceIds.add(batch[j].device.id);
    });
  }
  // A browser fetches all of its waiting alerts on one wake-up, so one request per browser is enough
  for (const device of browsersToWake.values()) {
    if (requests >= maxRequests) break;
    requests += 1;
    const { gone } = await wakeBrowser(env, device).catch(() => ({ gone: false }));
    if (gone) goneDeviceIds.add(device.id);
  }

  const ids = pending.map((n) => n.id);
  const statements = [
    db.prepare(`UPDATE notifications SET pushed_at = ? WHERE id IN (${placeholders(ids.length)})`).bind(nowIso(), ...ids),
  ];
  if (goneDeviceIds.size > 0) {
    statements.push(db.prepare(`DELETE FROM push_devices WHERE id IN (${placeholders(goneDeviceIds.size)})`).bind(...goneDeviceIds));
  }
  await db.batch(statements);
  return { pushed: pending.length, requests };
}
