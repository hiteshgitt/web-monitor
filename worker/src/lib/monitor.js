// Health checks of monitored sites (ported from the Express monitoringService) and how results are recorded.
import { alertStatements } from './alerts.js';
import { deliverPendingPush } from './push.js';
import { DOWN_STATUSES, UP_STATUSES, VALID_STATUSES, dayKey, hourKey, newId } from './util.js';

const TIMEOUT_MS = 10000;

// fetch that never throws for HTTP errors, measures the round trip, and parses JSON when present
async function timedFetch(url, apiKey) {
  const start = Date.now();
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' },
    signal: AbortSignal.timeout(TIMEOUT_MS),
    redirect: 'follow',
  });
  const elapsedMs = Date.now() - start;
  const type = (response.headers.get('content-type') || '').toLowerCase();
  let data = null;
  if (type.includes('json')) {
    data = await response.json().catch(() => null);
  } else {
    await response.body?.cancel();
  }
  return { status: response.status, type, data, elapsedMs };
}

// Integrations may report their own status words; anything unknown is treated as a warning
const normalizeStatus = (status) => {
  if (!status) return 'healthy';
  return VALID_STATUSES.includes(status) ? status : 'warning';
};

const networkFailure = (error) => ({
  status: 'offline',
  error: {
    message: `Site unreachable: ${error.name === 'TimeoutError' ? `no answer within ${TIMEOUT_MS / 1000}s` : error.message}`,
    code: error.name === 'TimeoutError' ? 'TIMEOUT' : 'CONNECTION_FAILED',
  },
});

const wpUrl = (base, endpoint, restRoute) => (restRoute
  ? `${base}/?rest_route=/webmonitor-advanced/v1/${endpoint}`
  : `${base}/wp-json/webmonitor-advanced/v1/${endpoint}`);

// WordPress REST sometimes only works through ?rest_route= (rewrites disabled); try both
// Throws the network error when the site can't be reached at all
export async function fetchWordPressEndpoint(site, endpoint) {
  const base = site.url.replace(/\/$/, '');
  let networkError = null;
  let result = await timedFetch(wpUrl(base, endpoint, false), site.api_key).catch((error) => { networkError = error; return null; });
  if (!result || result.status === 404) {
    const retry = await timedFetch(wpUrl(base, endpoint, true), site.api_key).catch((error) => { networkError = error; return null; });
    result = retry || result;
  }
  if (!result && networkError) throw networkError;
  return result;
}

// Map the integration detail endpoints (shared format of the WordPress plugin and all packages) to stored JSON
function integrationDetails([analytics, performance, seo, security]) {
  return {
    analytics: analytics && {
      totalVisitors: analytics.totalVisitors ?? null,
      totalPageViews: analytics.pageViews ?? null,
      bounceRate: analytics.bounceRate ?? null,
      avgSessionDuration: analytics.avgSessionDuration ?? null,
      seoScore: seo?.score ?? null,
      securityScore: security?.security_score ?? null,
      topPages: analytics.top_pages || [],
      contentStats: analytics.content_stats || {},
    },
    performance: performance && {
      loadTime: performance.load_time ?? null,
      serverResponseTime: performance.server_response_time ?? null,
      databaseQueryTime: performance.database_query_time ?? null,
      memoryUsage: performance.memory_usage ?? null,
      memoryPeak: performance.memory_peak ?? null,
      cpuUsage: performance.cpu_usage ?? null,
      performanceScore: performance.performance_score ?? null,
      activePlugins: performance.active_plugins ?? null,
      recommendations: performance.recommendations || [],
    },
    seo: seo && {
      score: seo.score ?? null,
      metaTags: seo.meta_tags || 'incomplete',
      altTags: seo.alt_tags ?? 0,
      headingStructure: seo.heading_structure || 'unknown',
      internalLinks: seo.internal_links ?? 0,
      externalLinks: seo.external_links ?? 0,
      sslEnabled: Boolean(seo.ssl_enabled),
      siteTitle: seo.site_title || '',
      siteDescription: seo.site_description || '',
      totalContent: seo.total_content ?? 0,
      seoIssues: seo.seo_issues || [],
      recommendations: seo.recommendations || [],
    },
    security: security && {
      sslStatus: security.ssl_status || 'disabled',
      firewall: security.firewall || 'none',
      malwareScan: security.malware_scan || 'unknown',
      vulnerabilityScan: security.vulnerability_scan || 'unknown',
      securityScore: security.security_score ?? null,
      securityPlugins: security.security_plugins ?? 0,
      totalPlugins: security.total_plugins ?? 0,
      outdatedPlugins: security.outdated_plugins ?? 0,
      wordpressVersion: security.wordpress_version || '',
      recommendations: security.recommendations || [],
    },
  };
}

async function checkWordPress(site, withDetails) {
  let health;
  try {
    health = await fetchWordPressEndpoint(site, 'health');
  } catch (error) {
    return networkFailure(error);
  }
  if (health.status === 404) {
    return { status: 'offline', statusCode: 404, error: { message: 'WordPress Web Monitor plugin not found or site is returning 404.', code: 'API_NOT_FOUND' } };
  }
  if (health.status === 401 || health.status === 403) {
    return { status: 'error', statusCode: health.status, error: { message: 'Invalid API key. Check your WordPress API key.', code: 'INVALID_API_KEY' } };
  }
  if (health.status !== 200 || !health.data) {
    return { status: 'offline', statusCode: health.status, error: { message: `API returned status ${health.status}`, code: 'API_ERROR' } };
  }

  const result = {
    status: normalizeStatus(health.data.status),
    responseTime: health.elapsedMs,
    statusCode: health.status,
    serverProcessingTime: health.data.response_time ?? null,
  };
  if (withDetails) {
    const parts = await Promise.all(['analytics', 'performance', 'seo', 'security'].map((ep) => (
      fetchWordPressEndpoint(site, ep).then((r) => (r?.status === 200 && r.data ? r.data : null)).catch(() => null)
    )));
    result.details = integrationDetails(parts);
  }
  return result;
}

// Next.js / Laravel / CodeIgniter / Core PHP integrations share /api/webmonitor/health
async function checkApiIntegration(site, frameworkName, withDetails = false) {
  const base = site.url.replace(/\/$/, '');
  let health;
  try {
    health = await timedFetch(`${base}/api/webmonitor/health`, site.api_key);
  } catch (error) {
    return networkFailure(error);
  }
  if (health.status === 404 || health.type.includes('text/html')) {
    return { status: 'error', statusCode: health.status, error: { message: `API endpoint not found. Install the ${frameworkName} integration.`, code: 'API_NOT_FOUND' } };
  }
  if (health.status === 401) {
    return { status: 'error', statusCode: 401, error: { message: 'Invalid API key. Check your WEBMONITOR_API_KEY.', code: 'INVALID_API_KEY' } };
  }
  if (health.status !== 200 || !health.data) {
    return { status: 'error', statusCode: health.status, error: { message: `API returned status ${health.status}`, code: 'API_ERROR' } };
  }
  const result = {
    status: normalizeStatus(health.data.status),
    responseTime: health.elapsedMs,
    statusCode: health.status,
    serverProcessingTime: health.data.response_time ?? null,
  };
  if (withDetails) {
    const parts = await Promise.all(['analytics', 'performance', 'seo', 'security'].map((ep) => (
      timedFetch(`${base}/api/webmonitor/${ep}`, site.api_key)
        .then((r) => (r.status === 200 && r.data ? r.data : null))
        .catch(() => null)
    )));
    result.details = integrationDetails(parts);
  }
  return result;
}

// Plain URL without an integration: reachable, but monitoring needs the API
async function checkGeneric(site) {
  try {
    const start = Date.now();
    const response = await fetch(site.url, { signal: AbortSignal.timeout(TIMEOUT_MS), redirect: 'follow' });
    await response.body?.cancel();
    return {
      status: 'error',
      responseTime: Date.now() - start,
      statusCode: response.status,
      error: { message: 'No API integration detected. Add the Web Monitor integration to enable monitoring.', code: 'NO_API' },
    };
  } catch (error) {
    return networkFailure(error);
  }
}

// One health check (plus integration details for WordPress when withDetails)
export async function performHealthCheck(site, { withDetails = false } = {}) {
  if (!/^https?:\/\//i.test(site.url || '')) {
    return { status: 'error', error: { message: 'Website URL is missing or invalid.', code: 'INVALID_URL' } };
  }
  try {
    switch (site.platform) {
      case 'wordpress': return await checkWordPress(site, withDetails);
      case 'nextjs': return await checkApiIntegration(site, 'Next.js', withDetails);
      case 'laravel': return await checkApiIntegration(site, 'Laravel', withDetails);
      case 'codeigniter': return await checkApiIntegration(site, 'CodeIgniter', withDetails);
      case 'php': return await checkApiIntegration(site, 'PHP', withDetails);
      default: {
        // Custom stacks can implement /api/webmonitor/health; otherwise only reachability is checked
        const custom = await checkApiIntegration(site, 'Web Monitor', withDetails);
        if (custom.error?.code !== 'API_NOT_FOUND') return custom;
        // No integration: reachability only. Empty details still mark the site as refreshed.
        const generic = await checkGeneric(site);
        return withDetails ? { ...generic, details: {} } : generic;
      }
    }
  } catch (error) {
    return { status: 'error', error: { message: error.message, code: 'CHECK_FAILED' } };
  }
}

// Statements that store one check result: hourly bucket, daily total, status/incident changes and alerts.
// Returned (not executed) so the monitor can send every site's writes in a single D1 batch.
export function recordCheckStatements(db, site, result, at = new Date()) {
  const isUp = UP_STATUSES.includes(result.status);
  const responseTime = isUp ? Math.round(result.responseTime ?? 0) : null;
  const entry = JSON.stringify([
    Math.floor(at.getTime() / 1000), result.status, responseTime, result.statusCode ?? null, result.error?.message ?? null,
  ]);
  const timestamp = at.toISOString();

  const statements = [
    db.prepare(`INSERT INTO check_hours (website_id, hour, checks) VALUES (?1, ?2, json_array(json(?3)))
      ON CONFLICT (website_id, hour) DO UPDATE SET checks = json_insert(checks, '$[#]', json(?3))`)
      .bind(site.id, hourKey(at), entry),
    db.prepare(`INSERT INTO check_days (website_id, day, total, up, response_sum) VALUES (?1, ?2, 1, ?3, ?4)
      ON CONFLICT (website_id, day) DO UPDATE SET total = total + 1, up = up + ?3, response_sum = response_sum + ?4`)
      .bind(site.id, dayKey(at), isUp ? 1 : 0, responseTime ?? 0),
  ];

  // Status and incidents are only written when something changes (keeps writes low)
  if (result.status !== site.status) {
    statements.push(db.prepare('UPDATE websites SET status = ?, updated_at = ? WHERE id = ?').bind(result.status, timestamp, site.id));
    const wasDown = DOWN_STATUSES.includes(site.status);
    const isDown = DOWN_STATUSES.includes(result.status);
    if (isDown && !wasDown) {
      statements.push(db.prepare(`INSERT INTO incidents (id, website_id, started_at, status, message, last_checked)
        VALUES (?, ?, ?, ?, ?, ?)`).bind(newId(), site.id, timestamp, result.status, result.error?.message || '', timestamp));
    } else if (!isDown && wasDown) {
      statements.push(db.prepare('UPDATE incidents SET ended_at = ?, last_checked = ? WHERE website_id = ? AND ended_at IS NULL')
        .bind(timestamp, timestamp, site.id));
    }
  }

  if (result.details) {
    const d = result.details;
    statements.push(db.prepare(`UPDATE websites SET
        analytics = COALESCE(?, analytics), performance = COALESCE(?, performance),
        seo = COALESCE(?, seo), security = COALESCE(?, security), details_checked_at = ?
      WHERE id = ?`).bind(
      d.analytics ? JSON.stringify(d.analytics) : null,
      d.performance ? JSON.stringify(d.performance) : null,
      d.seo ? JSON.stringify(d.seo) : null,
      d.security ? JSON.stringify(d.security) : null,
      timestamp,
      site.id,
    ));
  }
  statements.push(...alertStatements(db, site, result, at));
  return statements;
}

// Check one site now and store the result (used by "Run check" and right after a site is added)
export async function checkAndRecord(env, site) {
  const at = new Date();
  const result = await performHealthCheck(site, { withDetails: true });
  await env.DB.batch(recordCheckStatements(env.DB, site, result, at));
  return { result, at };
}

// Free plan: 50 outgoing requests per run. Health checks first (1 request per site);
// leftover budget refreshes the slower-changing WordPress details (4 requests per site).
// PUSH_REQUESTS are kept for delivering the alerts the run produced.
const SUBREQUEST_BUDGET = 40;
const PUSH_REQUESTS = 6;

export async function runMonitoringCycle(env, scheduledTime = Date.now()) {
  const at = new Date(scheduledTime);
  // Suspended customers' sites are not checked
  const { results: sites } = await env.DB.prepare(`SELECT w.* FROM websites w JOIN users u ON u.id = w.owner_id
    WHERE w.monitoring_enabled = 1 AND u.status = 'active'`).all();
  if (sites.length === 0) return { checked: 0, ...(await deliverPendingPush(env, PUSH_REQUESTS, at).catch(() => ({}))) };

  // More sites than one run can reach: rotate through them minute by minute
  const minute = Math.floor(scheduledTime / 60000);
  const perRun = Math.min(sites.length, SUBREQUEST_BUDGET);
  const start = (minute * perRun) % sites.length;
  const due = sites.length <= perRun ? sites : Array.from({ length: perRun }, (_, i) => sites[(start + i) % sites.length]);

  const refreshMs = (Number(env.DETAILS_REFRESH_MINUTES) || 30) * 60 * 1000;
  const stale = due
    .filter((s) => (!s.details_checked_at || at - new Date(s.details_checked_at) > refreshMs))
    .sort((a, b) => (a.details_checked_at || '').localeCompare(b.details_checked_at || ''));
  const detailIds = new Set();
  let budget = SUBREQUEST_BUDGET - due.length;
  for (const site of stale) {
    if (budget < 4) break;
    detailIds.add(site.id);
    budget -= 4;
  }

  const results = await Promise.all(due.map((site) => performHealthCheck(site, { withDetails: detailIds.has(site.id) })));
  const statements = due.flatMap((site, i) => recordCheckStatements(env.DB, site, results[i], at));
  await env.DB.batch(statements);

  // Once a day: drop history past the retention period
  if (at.getUTCHours() === 0 && at.getUTCMinutes() === 5) {
    await purgeOldHistory(env, at);
  }
  const push = await deliverPendingPush(env, PUSH_REQUESTS, at).catch((error) => ({ pushError: error.message }));
  return { checked: due.length, detailsRefreshed: detailIds.size, ...push };
}

export async function purgeOldHistory(env, at = new Date()) {
  const days = Number(env.MONITORING_RETENTION_DAYS) || 90;
  const cutoff = new Date(at.getTime() - days * 24 * 60 * 60 * 1000);
  await env.DB.batch([
    env.DB.prepare('DELETE FROM check_hours WHERE hour < ?').bind(hourKey(cutoff)),
    env.DB.prepare('DELETE FROM check_days WHERE day < ?').bind(dayKey(cutoff)),
    env.DB.prepare('DELETE FROM incidents WHERE ended_at IS NOT NULL AND ended_at < ?').bind(cutoff.toISOString()),
    env.DB.prepare('DELETE FROM notifications WHERE created_at < ?').bind(cutoff.toISOString()),
  ]);
}
