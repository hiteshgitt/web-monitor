// Reading monitoring results back out of check_hours (per-minute detail) and check_days (daily totals).
// Queries touch only the buckets they need, to stay well inside the D1 free read quota.
import { UP_STATUSES, dayKey, daysAgo, hourKey, hoursAgo, parseJson, placeholders } from './util.js';

// One stored check: [epochSeconds, status, responseMs, httpStatus, errorMessage]
export const expandCheck = (entry) => ({
  _id: String(entry[0]),
  timestamp: new Date(entry[0] * 1000).toISOString(),
  status: entry[1],
  responseTime: entry[2],
  statusCode: entry[3],
  error: entry[4] ? { message: entry[4] } : undefined,
});

// Latest check and 30-day uptime for several sites at once -> Map(id -> live fields)
export async function liveStatsFor(db, siteIds) {
  const live = new Map(siteIds.map((id) => [id, {}]));
  if (siteIds.length === 0) return live;
  const now = new Date();
  const ids = placeholders(siteIds.length);

  const [latest, uptime] = await db.batch([
    // Current and previous hour are enough to find the latest check of an active site
    db.prepare(`SELECT website_id, hour, checks FROM check_hours
      WHERE website_id IN (${ids}) AND hour IN (?, ?) ORDER BY hour`)
      .bind(...siteIds, hourKey(hoursAgo(1, now)), hourKey(now)),
    db.prepare(`SELECT website_id, SUM(total) AS total, SUM(up) AS up FROM check_days
      WHERE website_id IN (${ids}) AND day >= ? GROUP BY website_id`)
      .bind(...siteIds, dayKey(daysAgo(30, now))),
  ]);

  for (const row of latest.results) {
    const checks = parseJson(row.checks) || [];
    const last = checks[checks.length - 1];
    if (!last) continue;
    const entry = live.get(row.website_id);
    entry.status = last[1];
    entry.responseTime = UP_STATUSES.includes(last[1]) ? last[2] : null;
    entry.lastChecked = new Date(last[0] * 1000).toISOString();
  }
  for (const row of uptime.results) {
    if (row.total > 0) live.get(row.website_id).uptime = Math.round((row.up / row.total) * 1000) / 10;
  }
  return live;
}

// Individual checks of the last `hours`, newest first
export async function recentChecks(db, siteId, hours = 24, limit = 1500) {
  const since = hoursAgo(hours);
  const { results } = await db
    .prepare('SELECT checks FROM check_hours WHERE website_id = ? AND hour >= ? ORDER BY hour DESC')
    .bind(siteId, hourKey(since))
    .all();
  const sinceSeconds = Math.floor(since.getTime() / 1000);
  const checks = [];
  for (const row of results) {
    const entries = parseJson(row.checks) || [];
    for (let i = entries.length - 1; i >= 0 && checks.length < limit; i -= 1) {
      if (entries[i][0] >= sinceSeconds) checks.push(expandCheck(entries[i]));
    }
    if (checks.length >= limit) break;
  }
  return checks;
}

// Downtime hours and uptime % for the Advanced view's server panel
export async function serverInfo(db, site, live) {
  const now = new Date();
  const [day1, day7, day30] = await db.batch([1, 7, 30].map((days) => db
    .prepare('SELECT SUM(total) AS total, SUM(up) AS up FROM check_days WHERE website_id = ? AND day >= ?')
    .bind(site.id, dayKey(daysAgo(days, now)))));
  // One check per minute, so each failed check is one minute of downtime
  const downHours = (r) => Math.round((((r.results[0]?.total || 0) - (r.results[0]?.up || 0)) / 60) * 100) / 100;
  const diskSpace = diskFromPerformance(site.performance);
  const bandwidth = bandwidthFromPerformance(site.performance);
  return {
    downtimeHours: { last24h: downHours(day1), last7d: downHours(day7), last30d: downHours(day30) },
    uptimePercent: live.uptime ?? null,
    lastChecked: live.lastChecked ?? null,
    status: live.status ?? site.status ?? 'unknown',
    checkIntervalMinutes: 1,
    diskSpace,
    bandwidth,
    serverResourcesMessage: serverResourcesMessage(diskSpace, bandwidth),
  };
}

function serverResourcesMessage(diskSpace, bandwidth) {
  const disk = diskSpace
    ? 'Disk is the space this server reports for the site.'
    : 'This site has not reported disk space yet.';
  const transfer = bandwidth
    ? 'Data transfer is traffic this server has sent since it last restarted. It is not the hosting plan’s monthly quota.'
    : 'This site has not reported data transfer yet.';
  return `${disk} ${transfer}`;
}

function bandwidthFromPerformance(raw) {
  const perf = parseJson(raw) || {};
  if (perf.bandwidthTxBytes == null) return null;
  const sent = Number(perf.bandwidthTxBytes);
  if (!Number.isFinite(sent) || sent < 0) return null;
  const gb = (bytes) => Math.round((bytes / 1073741824) * 100) / 100;
  const received = Number(perf.bandwidthRxBytes);
  return {
    used: gb(sent),
    received: Number.isFinite(received) && received >= 0 ? gb(received) : null,
    limit: null,
    unit: 'GB',
    since: 'restart',
  };
}

function diskFromPerformance(raw) {
  const perf = parseJson(raw) || {};
  const total = Number(perf.diskTotalBytes);
  const free = Number(perf.diskFreeBytes);
  if (!Number.isFinite(total) || total <= 0 || !Number.isFinite(free) || free < 0 || free > total) return null;
  const gb = (bytes) => Math.round((bytes / 1073741824) * 100) / 100;
  return { used: gb(total - free), total: gb(total), unit: 'GB' };
}
