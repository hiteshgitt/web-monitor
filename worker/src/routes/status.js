// Public uptime page. The slug is unguessable and is the only way to open it.
import { Hono } from 'hono';
import { liveStatsFor } from '../lib/stats.js';
import { ApiError, DOWN_STATUSES, UP_STATUSES } from '../lib/util.js';

const status = new Hono();

const labelFor = (site, live) => {
  const current = live.status ?? site.status;
  if (!current) return 'unknown';
  if (DOWN_STATUSES.includes(current)) return 'down';
  if (UP_STATUSES.includes(current) && live.responseTime != null && live.responseTime > (site.alert_response_ms || 5000)) return 'slow';
  if (UP_STATUSES.includes(current)) return 'up';
  return 'unknown';
};

status.get('/:slug', async (c) => {
  const slug = String(c.req.param('slug') || '');
  if (!/^[a-f0-9]{32}$/.test(slug)) throw new ApiError(404, 'This status page does not exist.');
  const owner = await c.env.DB.prepare('SELECT id, name FROM users WHERE status_slug = ? AND status = \'active\'').bind(slug).first();
  if (!owner) throw new ApiError(404, 'This status page does not exist.');
  const { results } = await c.env.DB.prepare(`SELECT id, name, url, status, alert_response_ms
    FROM websites WHERE owner_id = ? AND monitoring_enabled = 1 ORDER BY name`).bind(owner.id).all();
  const live = await liveStatsFor(c.env.DB, results.map((site) => site.id));
  return c.json({
    name: owner.name || 'Status',
    updatedAt: new Date().toISOString(),
    sites: results.map((site) => {
      const stats = live.get(site.id) || {};
      return {
        name: site.name,
        url: site.url,
        status: labelFor(site, stats),
        lastChecked: stats.lastChecked || null,
        uptime: stats.uptime ?? null,
      };
    }),
  });
});

export default status;
