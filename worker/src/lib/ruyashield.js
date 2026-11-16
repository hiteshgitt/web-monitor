// RuyaShield integration: a customer connects their RuyaShield organisation with a read-only API token
// (assets:read + findings:read, created in RuyaShield → Settings → API tokens). WebMonitor then shows each
// monitored site's RuyaShield status: open findings by severity, the top few titles, and the last assessment.
// Only RuyaShield's /v1/integrations/webmonitor/posture endpoint is called; it returns counts and titles, never evidence.
import { decryptToken, encryptToken } from './googleAnalytics.js';
import { notificationStatement, ruyashieldAlerts } from './alerts.js';
import { ApiError, nowIso, parseJson } from './util.js';

const TOKEN_PATTERN = /^rs_[A-Za-z0-9_-]{20,100}$/;
const CACHE_MINUTES = 10;
// While a site shows "not in RuyaShield yet" the customer is probably adding it there right now.
const UNTRACKED_CACHE_MINUTES = 1;
const MAX_HOSTS = 100;

export const ruyashieldConfigured = (env) => Boolean(env.RUYASHIELD_URL);
const baseUrl = (env) => env.RUYASHIELD_URL.replace(/\/+$/, '');

// RuyaShield tracks the registered domain; customers often monitor the www. form of the same site.
export function hostsForUrl(url) {
  let host;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return [];
  }
  return host.startsWith('www.') ? [host, host.slice(4)] : [host];
}

const REJECTED = {
  401: 'RuyaShield did not accept this token. It may have expired or been revoked. Create a new one and reconnect.',
  403: 'This token cannot read assets. Create one with the assets:read and findings:read scopes.',
};

// GET posture for these hosts. Returns { ok, data } or { ok: false, status, message }.
async function fetchPosture(env, token, hosts) {
  const url = `${baseUrl(env)}/v1/integrations/webmonitor/posture?hosts=${encodeURIComponent(hosts.join(','))}`;
  let res;
  try {
    res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      signal: AbortSignal.timeout(10000),
    });
  } catch (error) {
    return { ok: false, status: 0, message: `RuyaShield could not be reached (${error.message}).` };
  }
  const data = (res.headers.get('content-type') || '').includes('json') ? await res.json().catch(() => null) : null;
  if (!data) await res.body?.cancel();
  if (res.ok && data) return { ok: true, data };
  return {
    ok: false,
    status: res.status,
    message: REJECTED[res.status] || data?.error?.message || `RuyaShield returned ${res.status}.`,
  };
}

const readConnection = (env, userId) => env.DB
  .prepare('SELECT * FROM ruyashield_connections WHERE user_id = ?').bind(userId).first();

const publicStatus = (env, row) => ({
  configured: ruyashieldConfigured(env),
  scanRequests: handoffConfigured(env),
  appUrl: ruyashieldConfigured(env) ? baseUrl(env) : null,
  connected: Boolean(row),
  orgName: row?.org_name || null,
  tokenPrefix: row?.token_prefix || null,
  connectedAt: row?.connected_at || null,
  error: row?.last_error || null,
});

export async function connectionStatus(env, userId) {
  return publicStatus(env, await readConnection(env, userId));
}

export async function connect(env, userId, rawToken) {
  if (!ruyashieldConfigured(env)) throw new ApiError(503, 'The RuyaShield connection is not turned on yet.');
  const token = String(rawToken || '').trim();
  if (!TOKEN_PATTERN.test(token)) throw new ApiError(400, 'Paste a RuyaShield API token. It starts with rs_.');
  // An empty host list only checks the token and returns the organisation name.
  const check = await fetchPosture(env, token, []);
  if (!check.ok) throw new ApiError(check.status === 401 || check.status === 403 ? 400 : 502, check.message);
  const orgName = String(check.data.org?.name || 'RuyaShield').slice(0, 120);
  const now = nowIso();
  await env.DB.prepare(`INSERT INTO ruyashield_connections (user_id, token, token_prefix, org_name, connected_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT (user_id) DO UPDATE SET token = excluded.token, token_prefix = excluded.token_prefix,
      org_name = excluded.org_name, connected_at = excluded.connected_at, last_error = NULL, posture = NULL, posture_at = NULL`)
    .bind(userId, await encryptToken(env.JWT_SECRET, token), token.slice(0, 9), orgName, now)
    .run();
  return connectionStatus(env, userId);
}

export async function disconnect(env, userId) {
  await env.DB.prepare('DELETE FROM ruyashield_connections WHERE user_id = ?').bind(userId).run();
  return connectionStatus(env, userId);
}

// One call covers every site the customer monitors; the answer is cached for a few minutes.
async function postureForUser(env, userId, row, { refresh = false, needHosts = [] } = {}) {
  const cached = parseJson(row.posture);
  // A site added since the last call is not in the cached answer yet.
  const covers = cached && needHosts.every((h) => cached.hosts?.some((entry) => entry.host === h));
  const tracked = covers && needHosts.some((h) => cached.hosts.some((entry) => entry.host === h && entry.tracked));
  const maxAge = (tracked ? CACHE_MINUTES : UNTRACKED_CACHE_MINUTES) * 60 * 1000;
  const fresh = row.posture_at && Date.now() - Date.parse(row.posture_at) < maxAge;
  if (fresh && covers && !refresh) return { data: cached, fetchedAt: row.posture_at };

  const { results } = await env.DB.prepare('SELECT id, owner_id, name, url FROM websites WHERE owner_id = ?').bind(userId).all();
  const hosts = [...new Set(results.flatMap((site) => hostsForUrl(site.url)))].slice(0, MAX_HOSTS);
  let token;
  try {
    token = await decryptToken(env.JWT_SECRET, row.token);
  } catch {
    const message = 'The saved RuyaShield token can no longer be read. Reconnect RuyaShield.';
    await env.DB.prepare('UPDATE ruyashield_connections SET last_error = ? WHERE user_id = ?').bind(message, userId).run();
    return { error: message };
  }
  const res = await fetchPosture(env, token, hosts);
  const now = nowIso();
  if (!res.ok) {
    // Keep showing nothing stale after the token is rejected; a network blip keeps the last answer.
    const rejected = res.status === 401 || res.status === 403;
    await env.DB.prepare(`UPDATE ruyashield_connections SET last_error = ?${rejected ? ', posture = NULL, posture_at = NULL' : ''} WHERE user_id = ?`)
      .bind(res.message, userId).run();
    return rejected || !cached ? { error: res.message } : { data: cached, fetchedAt: row.posture_at, error: res.message };
  }
  // Alerts are raised here, on every fresh answer (panel view or the 15-minute job), against alert_state.
  const { alerts, state } = ruyashieldAlerts(results, parseJson(row.alert_state), res.data);
  await env.DB.batch([
    env.DB.prepare('UPDATE ruyashield_connections SET posture = ?, posture_at = ?, last_error = NULL, org_name = ?, alert_state = ? WHERE user_id = ?')
      .bind(JSON.stringify(res.data), now, String(res.data.org?.name || row.org_name).slice(0, 120), JSON.stringify(state), userId),
    ...alerts.map((alert) => notificationStatement(env.DB, alert)),
  ]);
  return { data: res.data, fetchedAt: now };
}

// What the site's Security tab shows. `site` is a websites row owned by userId.
export async function ruyashieldForSite(env, userId, site, options = {}) {
  const row = await readConnection(env, userId);
  const status = publicStatus(env, row);
  if (!row || !status.configured) return { ...status, site: null, fetchedAt: null };
  const candidates = hostsForUrl(site.url);
  const { data, fetchedAt, error } = await postureForUser(env, userId, row, { ...options, needHosts: candidates });
  const entries = (data?.hosts || []).filter((h) => candidates.includes(h.host));
  // Prefer the host RuyaShield actually tracks (www. or bare domain).
  const match = entries.find((h) => h.tracked) || entries[0] || null;
  return {
    ...status,
    error: error || null,
    fetchedAt: fetchedAt || null,
    site: match || (data ? { host: candidates[0] || null, tracked: false } : null),
  };
}

// 15-minute job: refresh Pro customers whose answer is older than the display cache, so alerts arrive even
// when nobody has the dashboard open. A few per run keeps it inside the Worker's per-invocation request budget.
const REFRESH_PER_RUN = 10;

export async function refreshRuyaShieldAlerts(env) {
  if (!ruyashieldConfigured(env)) return { skipped: 'not-configured' };
  const cutoff = new Date(Date.now() - CACHE_MINUTES * 60 * 1000).toISOString();
  const { results } = await env.DB.prepare(`SELECT c.* FROM ruyashield_connections c JOIN users u ON u.id = c.user_id
    WHERE (u.plan = 'pro' OR u.role = 'admin') AND (c.posture_at IS NULL OR c.posture_at < ?)
    ORDER BY c.posture_at LIMIT ?`).bind(cutoff, REFRESH_PER_RUN).all();
  let failed = 0;
  for (const row of results) {
    const r = await postureForUser(env, row.user_id, row, { refresh: true }).catch(() => ({ error: 'exception' }));
    if (r.error) failed += 1;
  }
  return { refreshed: results.length, failed };
}

// ---------- "Scan in RuyaShield": a signed referral hand-off ----------
// WebMonitor only suggests a scan. RuyaShield shows the person a review page; nothing is scanned until they
// consent there and the site is a verified asset of their organisation. Only the host and a short plain-text
// note leave WebMonitor (no API keys, page content or monitoring data beyond the public check summary).

export const handoffConfigured = (env) => ruyashieldConfigured(env) && String(env.RUYASHIELD_HANDOFF_SECRET || '').length >= 32;

const toHex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');

async function signHandoff(secret, timestamp, body) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return `sha256=${toHex(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${timestamp}.${body}`)))}`;
}

// The public check WebMonitor already ran, as a short note for the RuyaShield review page.
export function handoffSummary(site, scan) {
  const lines = [`Requested from WebMonitor for ${site.name}.`];
  if (scan?.ssl?.grade) lines.push(`SSL Labs grade: ${scan.ssl.grade}.`);
  if (scan?.headers?.missing?.length) lines.push(`Missing security headers: ${scan.headers.missing.join(', ')}.`);
  if (scan?.malware?.status === 'flagged') lines.push('Google Safe Browsing lists this site.');
  return lines.join(' ').slice(0, 1000);
}

// `trackedHost`: the name RuyaShield already knows this site by (bare or www.), so its review page finds the asset.
export async function requestScan(env, site, scan, trackedHost = null) {
  if (!handoffConfigured(env)) throw new ApiError(503, 'Scanning from WebMonitor is not turned on yet.');
  const candidates = hostsForUrl(site.url);
  const host = candidates.includes(trackedHost) ? trackedHost : candidates[candidates.length - 1];
  if (!host) throw new ApiError(400, 'This site does not have a valid address.');
  const body = JSON.stringify({
    nonce: `wm-${crypto.randomUUID()}`,
    externalRef: `wm-${site.id}`.slice(0, 100),
    signalType: 'webmonitor.scan_request',
    host,
    observedAt: nowIso(),
    summary: handoffSummary(site, scan),
  });
  const timestamp = String(Math.floor(Date.now() / 1000));
  let res;
  try {
    res = await fetch(`${baseUrl(env)}/v1/integrations/webmonitor/handoffs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-WebMonitor-Timestamp': timestamp,
        'X-WebMonitor-Signature': await signHandoff(env.RUYASHIELD_HANDOFF_SECRET, timestamp, body),
      },
      body,
      signal: AbortSignal.timeout(10000),
    });
  } catch (error) {
    throw new ApiError(502, `RuyaShield could not be reached (${error.message}).`);
  }
  const data = await res.json().catch(() => null);
  if (res.status === 202 && data?.link) return { link: data.link, expiresAt: data.expiresAt };
  const code = data?.error?.code;
  if (code === 'invalid_host') throw new ApiError(400, 'RuyaShield cannot scan this address.');
  console.error('RuyaShield handoff failed', res.status, code);
  throw new ApiError(502, 'RuyaShield did not accept the scan request. Try again later.');
}
