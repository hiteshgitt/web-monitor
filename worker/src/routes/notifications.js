// Alerts of one account (a customer, or an admin): history (the bell), read state, push preferences and the
// devices that receive push. The same routes serve both; `accountKey` names the c.var holding the account row.
import { Hono } from 'hono';
import { ADMIN_ALERT_TYPES, ALERT_TYPES, notifyPrefs, wantsPush } from '../lib/alerts.js';
import { webPushConfigured } from '../lib/push.js';
import { serializeNotification } from '../lib/serialize.js';
import { ApiError, newId, nowIso, placeholders } from '../lib/util.js';

const isExpoToken = (token) => /^(Exponent|Expo)PushToken\[[^\]]+\]$/.test(token);
const isWebPushEndpoint = (url) => /^https:\/\/[^\s]+$/.test(url) && url.length < 1000;

export function notificationRoutes({ accountKey, table, types }) {
  const notifications = new Hono();

  notifications.get('/', async (c) => {
    const account = c.get(accountKey);
    const limit = Math.min(Number(c.req.query('limit')) || 50, 100);
    const [list, unread] = await c.env.DB.batch([
      c.env.DB.prepare('SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT ?').bind(account.id, limit),
      c.env.DB.prepare('SELECT COUNT(*) AS n FROM notifications WHERE user_id = ? AND read_at IS NULL').bind(account.id),
    ]);
    return c.json({ notifications: list.results.map(serializeNotification), unread: unread.results[0].n });
  });

  // { ids: [...] } marks those read; no ids marks everything read
  notifications.post('/read', async (c) => {
    const { ids } = await c.req.json().catch(() => ({}));
    const account = c.get(accountKey);
    const now = nowIso();
    if (Array.isArray(ids) && ids.length > 0) {
      const some = ids.slice(0, 90).map(String);
      await c.env.DB.prepare(`UPDATE notifications SET read_at = ? WHERE user_id = ? AND read_at IS NULL
        AND id IN (${placeholders(some.length)})`).bind(now, account.id, ...some).run();
    } else {
      await c.env.DB.prepare('UPDATE notifications SET read_at = ? WHERE user_id = ? AND read_at IS NULL').bind(now, account.id).run();
    }
    return c.json({ ok: true });
  });

  // The settings screen: available alert types, the customer's choices and their push devices
  notifications.get('/settings', async (c) => {
    const account = c.get(accountKey);
    const { results: devices } = await c.env.DB.prepare(
      'SELECT id, kind, label, created_at, last_used_at FROM push_devices WHERE user_id = ? ORDER BY created_at DESC',
    ).bind(account.id).all();
    return c.json({
      prefs: notifyPrefs(account),
      types,
      devices: devices.map((d) => ({ _id: d.id, kind: d.kind, label: d.label, createdAt: d.created_at, lastUsedAt: d.last_used_at })),
      webPushPublicKey: webPushConfigured(c.env) ? c.env.VAPID_PUBLIC_KEY : null,
    });
  });

  notifications.put('/settings', async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const account = c.get(accountKey);
    const prefs = notifyPrefs(account);
    for (const key of Object.keys(prefs)) {
      if (typeof body[key] === 'boolean') prefs[key] = body[key];
    }
    await c.env.DB.prepare(`UPDATE ${table} SET notify_prefs = ?, updated_at = ? WHERE id = ?`)
      .bind(JSON.stringify(prefs), nowIso(), account.id).run();
    return c.json({ prefs });
  });

  // { kind: 'expo', token } from the mobile app, or { kind: 'web', endpoint } from a browser
  notifications.post('/devices', async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const account = c.get(accountKey);
    const kind = body.kind;
    const token = String(kind === 'web' ? body.endpoint || '' : body.token || '');
    if (kind === 'expo' ? !isExpoToken(token) : kind === 'web' ? !isWebPushEndpoint(token) : true) {
      throw new ApiError(400, 'A valid Expo push token or Web Push endpoint is required');
    }
    if (kind === 'web' && !webPushConfigured(c.env)) throw new ApiError(503, 'Browser notifications are not set up yet');
    const label = String(body.label || '').slice(0, 80);
    const now = nowIso();
    // A device moving to another account belongs to the new account only
    const pullKey = kind === 'web' ? newId() + newId() : null;
    await c.env.DB.prepare(`INSERT INTO push_devices (id, user_id, kind, token, pull_key, label, created_at, last_used_at)
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?7)
      ON CONFLICT (token) DO UPDATE SET user_id = ?2, pull_key = COALESCE(?5, pull_key), label = ?6, last_used_at = ?7`)
      .bind(newId(), account.id, kind, token, pullKey, label, now).run();
    const device = await c.env.DB.prepare('SELECT id, pull_key FROM push_devices WHERE token = ?').bind(token).first();
    return c.json({ _id: device.id, pullKey: device.pull_key || undefined }, 201);
  });

  // { token } or { endpoint }: stop pushing to this device (sign-out, or the customer turned it off)
  notifications.post('/devices/remove', async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const token = String(body.endpoint || body.token || '');
    await c.env.DB.prepare('DELETE FROM push_devices WHERE user_id = ? AND (token = ? OR id = ?)')
      .bind(c.get(accountKey).id, token, String(body.id || '')).run();
    return c.json({ ok: true });
  });

  return notifications;
}

export const customerNotifications = notificationRoutes({ accountKey: 'user', table: 'users', types: ALERT_TYPES });
export const adminNotifications = notificationRoutes({ accountKey: 'admin', table: 'admins', types: ADMIN_ALERT_TYPES });

// Public: a browser's service worker, woken by an empty Web Push, asks what to show.
// Authenticated by the device's pull_key; returns alerts since its last pull that the customer wants pushed.
export const pushPull = new Hono();

pushPull.get('/pull', async (c) => {
  const key = c.req.query('key') || '';
  if (key.length < 32) throw new ApiError(400, 'Missing key');
  const db = c.env.DB;
  // The device belongs to a customer or an admin
  const device = await db.prepare(`SELECT d.*, COALESCE(u.notify_prefs, a.notify_prefs) AS notify_prefs,
      u.status AS status, COALESCE(u.id, a.id) AS account_id
    FROM push_devices d LEFT JOIN users u ON u.id = d.user_id LEFT JOIN admins a ON a.id = d.user_id
    WHERE d.pull_key = ? AND d.kind = 'web'`).bind(key).first();
  if (!device || !device.account_id || device.status === 'suspended') return c.json({ notifications: [] }, 404);

  const prefs = notifyPrefs(device);
  const since = device.last_used_at || device.created_at;
  const { results } = await db.prepare(`SELECT * FROM notifications WHERE user_id = ? AND created_at > ?
    ORDER BY created_at DESC LIMIT 20`).bind(device.user_id, since).all();
  const now = nowIso();
  await db.prepare('UPDATE push_devices SET last_used_at = ? WHERE id = ?').bind(now, device.id).run();
  return c.json({ notifications: results.filter((n) => wantsPush(prefs, n.type)).slice(0, 5).map(serializeNotification) });
});
