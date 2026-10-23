// Advanced view (Pro): plugins/packages, logs, recommendations, server info, CSV export, Zealot assistant
import { Hono } from 'hono';
import { askZealot } from '../lib/ai.js';
import { loadOwnedWebsite } from '../lib/auth.js';
import { fetchWordPressEndpoint } from '../lib/monitor.js';
import { serializeIncident, serializeWebsite } from '../lib/serialize.js';
import { liveStatsFor, recentChecks, serverInfo } from '../lib/stats.js';
import { ApiError, daysAgo } from '../lib/util.js';

const advanced = new Hono();
advanced.use('/:section/:id', loadOwnedWebsite);
advanced.use('/:section/:id/*', loadOwnedWebsite);

const PHP_PLATFORMS = ['laravel', 'codeigniter', 'php'];

// GET <integration>/<endpoint> with the site's API key; returns parsed JSON or { error }
async function fetchIntegration(site, endpoint) {
  try {
    if (site.platform === 'wordpress') {
      const res = await fetchWordPressEndpoint(site, endpoint);
      if (res?.status === 200 && res.data) return res.data;
      return { error: `Endpoint returned ${res?.status ?? 'no response'}` };
    }
    const base = site.url.replace(/\/$/, '');
    const res = await fetch(`${base}/api/webmonitor/${endpoint}`, {
      headers: { Authorization: `Bearer ${site.api_key}`, Accept: 'application/json' },
      signal: AbortSignal.timeout(10000),
    });
    const type = res.headers.get('content-type') || '';
    if (!type.includes('json')) {
      await res.body?.cancel();
      return { error: 'API endpoint not found (the server returned a web page instead of JSON).', status: res.status };
    }
    const data = await res.json();
    return res.ok ? data : { error: data?.error || `Endpoint returned ${res.status}`, status: res.status };
  } catch (error) {
    return { error: `Unable to reach the site: ${error.message}` };
  }
}

const pluginsEndpoint = (site) => {
  if (site.platform === 'wordpress') return 'plugins';
  if (site.platform === 'nextjs') return 'libraries';
  if (PHP_PLATFORMS.includes(site.platform)) return 'packages';
  return null;
};

advanced.get('/comprehensive/:id', async (c) => {
  const site = c.get('website');
  const endpoint = pluginsEndpoint(site);
  const [live, plugins, logs, recommendations] = await Promise.all([
    liveStatsFor(c.env.DB, [site.id]).then((m) => m.get(site.id)),
    endpoint ? fetchIntegration(site, endpoint) : Promise.resolve(null),
    fetchIntegration(site, 'logs'),
    fetchIntegration(site, 'recommendations'),
  ]);
  return c.json({
    basic: serializeWebsite(site, live),
    // External analytics (Google Analytics / Search Console) are not connected yet
    analytics: { error: 'Google Analytics is not connected for this site.', statusCode: 503, service: 'Analytics' },
    plugins: site.platform === 'wordpress' ? plugins : undefined,
    libraries: site.platform === 'nextjs' ? plugins : undefined,
    packages: PHP_PLATFORMS.includes(site.platform) ? plugins : undefined,
    logs: logs?.error ? { error_log: { enabled: false, message: logs.error }, access_summary: {} } : logs,
    recommendations: recommendations?.error ? { recommendations: [], count: 0 } : recommendations,
    serverInfo: await serverInfo(c.env.DB, site, live),
    timestamp: new Date().toISOString(),
    website: { id: site.id, name: site.name, url: site.url, platform: site.platform },
  });
});

advanced.get('/plugins/:id', async (c) => {
  const site = c.get('website');
  const endpoint = pluginsEndpoint(site);
  if (!endpoint) throw new ApiError(400, 'Platform not supported for plugins/libraries/packages endpoint');
  const data = await fetchIntegration(site, endpoint);
  if (data?.error) return c.json(data, data.status && data.status >= 400 ? data.status : 503);
  return c.json(data);
});

advanced.get('/incidents/:id', async (c) => {
  const days = Math.min(Number(c.req.query('days')) || 30, 90);
  const { results } = await c.env.DB.prepare(`SELECT * FROM incidents
    WHERE website_id = ? AND (started_at >= ? OR ended_at IS NULL) ORDER BY started_at DESC LIMIT 100`)
    .bind(c.get('website').id, daysAgo(days).toISOString()).all();
  return c.json(results.map(serializeIncident));
});

// Check history as CSV (or JSON). Up to 30 days of per-minute checks.
advanced.get('/export/:id', async (c) => {
  const site = c.get('website');
  const days = Math.min(Number(c.req.query('days')) || 30, 30);
  const format = (c.req.query('format') || 'csv').toLowerCase();
  const checks = (await recentChecks(c.env.DB, site.id, days * 24, days * 24 * 60)).reverse();
  const rows = checks.map((h) => [h.timestamp, h.status, h.responseTime ?? '', h.statusCode ?? '', h.error?.message ?? '']);

  if (format === 'csv') {
    const header = ['Date', 'Status', 'Response Time (ms)', 'Status Code', 'Error'];
    const csv = [header, ...rows].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const filename = `${(site.name || 'report').replace(/[^a-z0-9_-]/gi, '_')}-${days}days.csv`;
    return c.body(csv, 200, {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    });
  }
  return c.json({
    website: { name: site.name, url: site.url },
    period: `${days} days`,
    summary: { totalChecks: checks.length, healthy: checks.filter((h) => h.status === 'healthy').length },
    history: checks,
  });
});

advanced.post('/ai-insights/:id/query', async (c) => {
  const { query } = await c.req.json().catch(() => ({}));
  if (!query || !String(query).trim()) throw new ApiError(400, 'Query is required');
  const site = c.get('website');
  const live = (await liveStatsFor(c.env.DB, [site.id])).get(site.id);
  return c.json(await askZealot(c.env, String(query), serializeWebsite(site, live)));
});

export default advanced;
