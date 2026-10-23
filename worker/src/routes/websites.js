import { Hono } from 'hono';
import { loadOwnedWebsite } from '../lib/auth.js';
import { checkAndRecord, performHealthCheck } from '../lib/monitor.js';
import { serializeIncident, serializeWebsite } from '../lib/serialize.js';
import { liveStatsFor, recentChecks } from '../lib/stats.js';
import { ApiError, PLATFORMS, UP_STATUSES, daysAgo, newId, normalizeUrl, nowIso } from '../lib/util.js';

const websites = new Hono();

// A site's API key identifies its integration, so the same key or URL means the same site.
async function findDuplicate(db, ownerId, { url, apiKey }, excludeId = '') {
  if (url) {
    const sameUrl = await db.prepare(`SELECT id FROM websites WHERE owner_id = ? AND id != ?
      AND rtrim(lower(url), '/') = ?`).bind(ownerId, excludeId, normalizeUrl(url)).first();
    if (sameUrl) return 'You are already monitoring this website.';
  }
  if (apiKey) {
    const sameKey = await db.prepare('SELECT id FROM websites WHERE owner_id = ? AND id != ? AND api_key = ?')
      .bind(ownerId, excludeId, apiKey).first();
    if (sameKey) return 'This API key is already connected to one of your websites.';
  }
  return null;
}

async function withLiveStats(db, rows) {
  const live = await liveStatsFor(db, rows.map((r) => r.id));
  return rows.map((row) => serializeWebsite(row, live.get(row.id)));
}

websites.get('/', async (c) => {
  const { results } = await c.env.DB
    .prepare('SELECT * FROM websites WHERE owner_id = ? AND monitoring_enabled = 1 ORDER BY created_at DESC')
    .bind(c.get('user').id).all();
  return c.json(await withLiveStats(c.env.DB, results));
});

websites.post('/', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const user = c.get('user');
  const url = normalizeUrl(body.url);
  const platform = PLATFORMS.includes(body.platform) ? body.platform : 'other';
  if (!body.name || !url || !body.apiKey) throw new ApiError(400, 'Name, URL and API key are required');
  const duplicate = await findDuplicate(c.env.DB, user.id, { url, apiKey: body.apiKey });
  if (duplicate) throw new ApiError(409, duplicate);

  const now = nowIso();
  const site = {
    id: newId(), owner_id: user.id, name: String(body.name).trim(), url, platform, api_key: String(body.apiKey),
    status: null, monitoring_enabled: 1, alert_response_ms: 5000, analytics: null, performance: null, seo: null,
    security: null, details_checked_at: null, created_at: now, updated_at: now,
  };
  await c.env.DB.prepare(`INSERT INTO websites (id, owner_id, name, url, platform, api_key, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
    .bind(site.id, site.owner_id, site.name, site.url, site.platform, site.api_key, now, now).run();
  // First check right away so the dashboard shows real data immediately
  await checkAndRecord(c.env, site).catch(() => {});
  const fresh = await c.env.DB.prepare('SELECT * FROM websites WHERE id = ?').bind(site.id).first();
  const [created] = await withLiveStats(c.env.DB, [fresh]);
  return c.json(created, 201);
});

// Check a site's integration before saving it (server-side, so no browser CORS issues)
websites.post('/verify', async (c) => {
  const { url, platform, apiKey, websiteId } = await c.req.json().catch(() => ({}));
  let key = apiKey;
  if (!key && websiteId) {
    const existing = await c.env.DB.prepare('SELECT api_key FROM websites WHERE id = ? AND owner_id = ?')
      .bind(websiteId, c.get('user').id).first();
    key = existing?.api_key;
  }
  if (!url || !platform || !key) {
    return c.json({ ok: false, message: 'URL, platform and API key are required.' }, 400);
  }
  const result = await performHealthCheck({ url: normalizeUrl(url), platform, api_key: key });
  const ok = UP_STATUSES.includes(result.status) && !result.error;
  return c.json({
    ok,
    status: result.status,
    responseTime: result.responseTime ?? null,
    code: result.error?.code || null,
    message: ok ? 'Connection verified' : (result.error?.message || `Site reported status "${result.status}"`),
  });
});

websites.use('/:id', loadOwnedWebsite);
websites.use('/:id/*', loadOwnedWebsite);

websites.get('/:id', async (c) => {
  const [site] = await withLiveStats(c.env.DB, [c.get('website')]);
  return c.json(site);
});

websites.put('/:id', async (c) => {
  const site = c.get('website');
  const body = await c.req.json().catch(() => ({}));
  const update = {
    name: body.name !== undefined ? String(body.name).trim() : site.name,
    url: body.url !== undefined ? normalizeUrl(body.url) : site.url,
    platform: PLATFORMS.includes(body.platform) ? body.platform : site.platform,
    // A blank key means "keep the current one" (the browser never receives the real key)
    api_key: body.apiKey ? String(body.apiKey) : site.api_key,
  };
  const duplicate = await findDuplicate(c.env.DB, site.owner_id, { url: update.url, apiKey: body.apiKey ? update.api_key : null }, site.id);
  if (duplicate) throw new ApiError(409, duplicate);

  const now = nowIso();
  await c.env.DB.prepare('UPDATE websites SET name = ?, url = ?, platform = ?, api_key = ?, updated_at = ? WHERE id = ?')
    .bind(update.name, update.url, update.platform, update.api_key, now, site.id).run();
  const [updated] = await withLiveStats(c.env.DB, [{ ...site, ...update, updated_at: now }]);
  return c.json(updated);
});

websites.delete('/:id', async (c) => {
  const id = c.get('website').id;
  // Remove the site's history too, so deleting really deletes (the privacy policy relies on this)
  await c.env.DB.batch([
    c.env.DB.prepare('DELETE FROM check_hours WHERE website_id = ?').bind(id),
    c.env.DB.prepare('DELETE FROM check_days WHERE website_id = ?').bind(id),
    c.env.DB.prepare('DELETE FROM incidents WHERE website_id = ?').bind(id),
    c.env.DB.prepare('DELETE FROM websites WHERE id = ?').bind(id),
  ]);
  return c.json({ message: 'Website deleted successfully' });
});

websites.get('/:id/monitoring', async (c) => {
  const hours = Math.min(Number(c.req.query('hours')) || 24, 24 * 7);
  const limit = Math.min(Number(c.req.query('limit')) || 100, 5000);
  return c.json(await recentChecks(c.env.DB, c.get('website').id, hours, limit));
});

websites.get('/:id/incidents', async (c) => {
  const days = Math.min(Number(c.req.query('days')) || 30, 90);
  const { results } = await c.env.DB.prepare(`SELECT * FROM incidents
    WHERE website_id = ? AND (started_at >= ? OR ended_at IS NULL) ORDER BY started_at DESC LIMIT 100`)
    .bind(c.get('website').id, daysAgo(days).toISOString()).all();
  return c.json(results.map(serializeIncident));
});

// Kept for API compatibility; per-day analytics history needs an analytics integration
websites.get('/:id/analytics', (c) => c.json([]));

// "Run check": a real check now, recorded like a scheduled one
websites.post('/:id/test', async (c) => {
  const site = c.get('website');
  const { result, at } = await checkAndRecord(c.env, site);
  const [live] = await withLiveStats(c.env.DB, [site]);
  return c.json({
    status: result.status,
    responseTime: UP_STATUSES.includes(result.status) ? result.responseTime ?? null : null,
    uptime: live.uptime,
    lastChecked: at.toISOString(),
    message: 'Website health check completed',
  });
});

export default websites;
