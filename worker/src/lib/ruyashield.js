// RuyaShield integration: a customer connects their RuyaShield organisation with a read-only API token
// (assets:read + findings:read, created in RuyaShield → Settings → API tokens). WebMonitor then shows each
// monitored site's RuyaShield status: open findings by severity, the top few titles, and the last assessment.
// Only RuyaShield's /v1/integrations/webmonitor/posture endpoint is called; it returns counts and titles, never evidence.
import { decryptToken, encryptToken } from './googleAnalytics.js';
import { ApiError, nowIso, parseJson } from './util.js';

const TOKEN_PATTERN = /^rs_[A-Za-z0-9_-]{20,100}$/;
const CACHE_MINUTES = 10;
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
  const fresh = row.posture_at && Date.now() - Date.parse(row.posture_at) < CACHE_MINUTES * 60 * 1000;
  // A site added since the last call is not in the cached answer yet.
  const covers = cached && needHosts.every((h) => cached.hosts?.some((entry) => entry.host === h));
  if (fresh && covers && !refresh) return { data: cached, fetchedAt: row.posture_at };

  const { results } = await env.DB.prepare('SELECT url FROM websites WHERE owner_id = ?').bind(userId).all();
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
  await env.DB.prepare('UPDATE ruyashield_connections SET posture = ?, posture_at = ?, last_error = NULL, org_name = ? WHERE user_id = ?')
    .bind(JSON.stringify(res.data), now, String(res.data.org?.name || row.org_name).slice(0, 120), userId).run();
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
