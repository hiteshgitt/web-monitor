// Error tracking: the site's integration groups fatal errors and uncaught exceptions (type, message, file, line,
// stack, count). Every health check carries a small summary; when it shows a newer error, the monitor marks the
// site and fetches the groups (Pro) with spare request budget. New error types and errors that come back after
// being resolved raise an alert; error spikes are alerted from the summary itself (alerts.js), for every plan.
import { notificationStatement } from './alerts.js';
import { parseJson } from './util.js';

/** The integration's error summary from a health response, or null. Pure. */
export function errorsSummaryFrom(data) {
  const e = data?.errors;
  if (!e || typeof e !== 'object') return null;
  const n = (x) => (Number.isFinite(Number(x)) ? Math.max(0, Math.min(1e7, Math.round(Number(x)))) : 0);
  const latest = typeof e.latest === 'string' && !Number.isNaN(Date.parse(e.latest)) ? new Date(e.latest).toISOString() : null;
  return { tracked: Boolean(e.tracked), groups: n(e.groups), last5m: n(e.last_5m), lastHour: n(e.last_hour), latest };
}

/** Whether the summary shows an error newer than what is stored (so the groups should be fetched). Pure. */
export function hasNewErrors(stored, summary) {
  if (!summary?.latest) return false;
  return !stored?.latest || Date.parse(summary.latest) > Date.parse(stored.latest) || summary.groups !== stored.groups;
}

const str = (v, max) => String(v ?? '').slice(0, max);
const cleanGroup = (g) => ({
  fp: str(g.fp, 40).replace(/[^\w-]/g, ''), type: str(g.type, 80) || 'Error', message: str(g.message, 300),
  file: str(g.file, 200) || null, line: Number.isInteger(g.line) ? g.line : Number(g.line) || null, location: str(g.where, 120) || null,
  stack: JSON.stringify((Array.isArray(g.stack) ? g.stack : []).slice(0, 10).map((f) => str(f, 240))), digest: g.digest ? str(g.digest, 40) : null,
  count: Math.max(1, Number(g.count) || 1),
  first_seen: !Number.isNaN(Date.parse(g.first_seen)) ? new Date(g.first_seen).toISOString() : new Date().toISOString(),
  last_seen: !Number.isNaN(Date.parse(g.last_seen)) ? new Date(g.last_seen).toISOString() : new Date().toISOString(),
});

/**
 * Stores the groups from the integration's errors endpoint and returns statements for new / returning errors.
 * The first sync of a site sends one "error tracking is on" summary instead of one alert per old error.
 */
export async function syncErrorGroups(env, site, payload, at = new Date()) {
  const groups = (Array.isArray(payload?.groups) ? payload.groups : []).slice(0, 100).map(cleanGroup).filter((g) => g.fp);
  const { results: rows } = await env.DB.prepare('SELECT fp, status, resolved_at FROM error_groups WHERE website_id = ?').bind(site.id).all();
  const known = new Map(rows.map((r) => [r.fp, r]));
  const firstSync = !site.errors_synced_at;
  const fresh = [];
  const back = [];
  const statements = [];
  for (const g of groups) {
    const row = known.get(g.fp);
    if (!row) fresh.push(g);
    else if (row.status === 'resolved' && row.resolved_at && g.last_seen > row.resolved_at) back.push(g);
    statements.push(env.DB.prepare(`INSERT INTO error_groups (website_id, fp, type, message, file, line, location, stack, digest, count, first_seen, last_seen)
      VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)
      ON CONFLICT (website_id, fp) DO UPDATE SET message = ?4, location = ?7, stack = ?8, digest = COALESCE(?9, digest), count = MAX(count, ?10),
        last_seen = MAX(last_seen, ?12),
        status = CASE WHEN status = 'resolved' AND resolved_at IS NOT NULL AND ?12 > resolved_at THEN 'open' ELSE status END`)
      .bind(site.id, g.fp, g.type, g.message, g.file, g.line, g.location, g.stack, g.digest, g.count, g.first_seen, g.last_seen));
  }
  const where = (g) => `${g.file ? `${g.file}${g.line ? `:${g.line}` : ''}` : 'unknown file'}${g.location ? ` (${g.location})` : ''}`;
  const alert = (type, title, body) => statements.push(notificationStatement(env.DB, { userId: site.owner_id, websiteId: site.id, type, title, body: body.slice(0, 900) }, at));
  if (firstSync && groups.length) {
    alert('error_new', `Error tracking is on for ${site.name}`, `${groups.length} error type${groups.length === 1 ? '' : 's'} recorded so far, most recent: ${groups[0].type}: ${groups[0].message} at ${where(groups[0])}. Open Advanced → Errors for the stack traces.`);
  } else if (fresh.length === 1) {
    const g = fresh[0];
    alert('error_new', `New error on ${site.name}: ${g.type}`, `${g.message} at ${where(g)}. Seen ${g.count} time${g.count === 1 ? '' : 's'}. Open Advanced → Errors for the stack trace.`);
  } else if (fresh.length > 1) {
    alert('error_new', `${fresh.length} new errors on ${site.name}`, fresh.slice(0, 3).map((g) => `${g.type}: ${g.message} at ${where(g)}`).join('; ') + (fresh.length > 3 ? `; and ${fresh.length - 3} more` : ''));
  }
  if (!firstSync) {
    for (const g of back.slice(0, 3)) alert('error_back', `Resolved error is back on ${site.name}: ${g.type}`, `${g.message} at ${where(g)} happened again after it was marked resolved.`);
  }
  statements.push(env.DB.prepare('UPDATE websites SET errors_pending = 0, errors_synced_at = ? WHERE id = ?').bind(at.toISOString(), site.id));
  await env.DB.batch(statements);
  return { groups: groups.length, fresh: fresh.length, back: back.length };
}

/** Groups for the Advanced view, newest first. */
export async function listErrorGroups(env, siteId) {
  const { results } = await env.DB.prepare(`SELECT * FROM error_groups WHERE website_id = ? ORDER BY status = 'resolved', last_seen DESC LIMIT 100`).bind(siteId).all();
  return results.map((r) => ({
    fp: r.fp, type: r.type, message: r.message, file: r.file, line: r.line, location: r.location, stack: parseJson(r.stack) || [],
    digest: r.digest, count: r.count, firstSeen: r.first_seen, lastSeen: r.last_seen, status: r.status, resolvedAt: r.resolved_at,
  }));
}
