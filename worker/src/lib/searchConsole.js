// Search Console: the site owner grants read access to a property they already verify.
// This is a different OAuth client from sign-in and from Google Analytics.
import { sign, verify } from 'hono/jwt';
import { decryptToken, encryptToken } from './googleAnalytics.js';
import { ApiError, newId, nowIso } from './util.js';

const SCOPE = 'https://www.googleapis.com/auth/webmasters.readonly';
const PENDING_MINUTES = 15;

const configured = (env) => Boolean(env.GOOGLE_SEARCH_CONSOLE_CLIENT_ID && env.GOOGLE_SEARCH_CONSOLE_CLIENT_SECRET);

function assertConfigured(env) {
  if (!configured(env)) {
    throw new ApiError(503, 'Search Console connection is not turned on yet. Add the Search Console OAuth client first.');
  }
}

function redirectUri(requestUrl) {
  const url = new URL(requestUrl);
  return `${url.origin}/api/search-console/google/callback`;
}

function isoDate(daysAgo) {
  return new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export async function connectUrl(env, requestUrl, userId, websiteId, { returnTo = 'web' } = {}) {
  assertConfigured(env);
  const state = await sign({
    purpose: 'sc-connect',
    sub: userId,
    websiteId,
    returnTo: returnTo === 'app' ? 'app' : 'web',
    exp: Math.floor(Date.now() / 1000) + PENDING_MINUTES * 60,
  }, env.JWT_SECRET, 'HS256');
  const params = new URLSearchParams({
    client_id: env.GOOGLE_SEARCH_CONSOLE_CLIENT_ID,
    redirect_uri: redirectUri(requestUrl),
    response_type: 'code',
    scope: SCOPE,
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'false',
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

async function readConnectState(env, state) {
  let payload;
  try {
    payload = await verify(state, env.JWT_SECRET, 'HS256');
  } catch {
    throw new ApiError(400, 'This Google connection link has expired. Start again from the site.');
  }
  if (payload.purpose !== 'sc-connect' || !payload.sub || !payload.websiteId) {
    throw new ApiError(400, 'This Google connection link is not valid.');
  }
  return payload;
}

async function tokenRequest(env, body) {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new ApiError(502, data.error_description || 'Google did not accept the Search Console connection.');
  }
  return data;
}

async function exchangeCode(env, requestUrl, code) {
  const data = await tokenRequest(env, {
    code,
    client_id: env.GOOGLE_SEARCH_CONSOLE_CLIENT_ID,
    client_secret: env.GOOGLE_SEARCH_CONSOLE_CLIENT_SECRET,
    redirect_uri: redirectUri(requestUrl),
    grant_type: 'authorization_code',
  });
  if (!data.refresh_token) {
    throw new ApiError(502, 'Google did not return a lasting Search Console permission. Remove Web Monitor from your Google Account permissions and connect again.');
  }
  return data.refresh_token;
}

async function accessToken(env, refreshToken) {
  const data = await tokenRequest(env, {
    refresh_token: refreshToken,
    client_id: env.GOOGLE_SEARCH_CONSOLE_CLIENT_ID,
    client_secret: env.GOOGLE_SEARCH_CONSOLE_CLIENT_SECRET,
    grant_type: 'refresh_token',
  });
  return data.access_token;
}

async function listSites(access) {
  const response = await fetch('https://www.googleapis.com/webmasters/v3/sites', {
    headers: { Authorization: `Bearer ${access}` },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new ApiError(502, data.error?.message || 'Search Console sites could not be listed. Enable the Search Console API.');
  }
  return (data.siteEntry || []).map((site) => ({
    id: site.siteUrl,
    name: site.siteUrl,
    permission: site.permissionLevel || '',
  }));
}

async function searchQuery(access, siteUrl, body) {
  const response = await fetch(`https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${access}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new ApiError(response.status === 403 ? 403 : 502, data.error?.message || 'Search Console did not return a report.');
    throw error;
  }
  return data;
}

export async function reportForSite(env, refreshToken, siteUrl) {
  const access = await accessToken(env, refreshToken);
  const range = { startDate: isoDate(28), endDate: isoDate(2), type: 'web' };
  const [totals, queries] = await Promise.all([
    searchQuery(access, siteUrl, range),
    searchQuery(access, siteUrl, { ...range, dimensions: ['query'], rowLimit: 8 }),
  ]);
  const row = totals.rows?.[0];
  return {
    totalClicks: row?.clicks ?? null,
    totalImpressions: row?.impressions ?? null,
    averageCTR: row?.ctr ?? null,
    averagePosition: row?.position ?? null,
    topQueries: (queries.rows || []).map((item) => ({
      query: item.keys?.[0] || '',
      clicks: item.clicks ?? null,
      impressions: item.impressions ?? null,
      ctr: item.ctr ?? null,
      position: item.position ?? null,
    })),
    range: 'Last 28 days',
    siteUrl,
  };
}

async function savePending(db, secret, { userId, websiteId, refreshToken }) {
  const id = newId();
  const now = new Date();
  await db.prepare(`INSERT INTO sc_pending (id, user_id, website_id, refresh_token, expires_at, created_at)
    VALUES (?, ?, ?, ?, ?, ?)`).bind(
    id,
    userId,
    websiteId,
    await encryptToken(secret, refreshToken),
    new Date(now.getTime() + PENDING_MINUTES * 60 * 1000).toISOString(),
    nowIso(),
  ).run();
  return id;
}

async function pendingRow(env, pendingId, userId, websiteId) {
  const row = await env.DB.prepare('SELECT * FROM sc_pending WHERE id = ? AND user_id = ? AND website_id = ?')
    .bind(pendingId, userId, websiteId).first();
  if (!row || row.expires_at < nowIso()) {
    if (row) await env.DB.prepare('DELETE FROM sc_pending WHERE id = ?').bind(pendingId).run();
    throw new ApiError(404, 'That Google connection expired. Connect again.');
  }
  return row;
}

export async function pendingSites(env, pendingId, userId, websiteId) {
  const row = await pendingRow(env, pendingId, userId, websiteId);
  const refreshToken = await decryptToken(env.JWT_SECRET, row.refresh_token);
  const access = await accessToken(env, refreshToken);
  return listSites(access);
}

export async function attachSite(env, pendingId, userId, websiteId, siteUrl) {
  const sites = await pendingSites(env, pendingId, userId, websiteId);
  const chosen = sites.find((site) => site.id === siteUrl);
  if (!chosen) throw new ApiError(400, 'Choose one of the Search Console properties on this account.');
  const row = await env.DB.prepare('SELECT refresh_token FROM sc_pending WHERE id = ?').bind(pendingId).first();
  const now = nowIso();
  await env.DB.batch([
    env.DB.prepare(`UPDATE websites SET sc_site_url = ?, sc_permission = ?, sc_refresh_token = ?, sc_connected_at = ?, updated_at = ?
      WHERE id = ? AND owner_id = ?`).bind(chosen.id, chosen.permission, row.refresh_token, now, now, websiteId, userId),
    env.DB.prepare('DELETE FROM sc_pending WHERE id = ?').bind(pendingId),
  ]);
  return { siteUrl: chosen.id, permission: chosen.permission, connectedAt: now };
}

function scFinishRedirect(origin, payload, { websiteId = '', pendingId = '', error = '' } = {}) {
  if (payload?.returnTo === 'app') {
    const params = new URLSearchParams();
    if (websiteId) params.set('site', websiteId);
    if (pendingId) params.set('scPending', pendingId);
    if (error) params.set('scError', error);
    return `webmonitor://oauth/sc?${params}`;
  }
  if (error) {
    const site = websiteId ? `site=${encodeURIComponent(websiteId)}&` : '';
    return `${origin}/app?${site}scError=${encodeURIComponent(error)}`;
  }
  return `${origin}/app?site=${encodeURIComponent(websiteId)}&scPending=${encodeURIComponent(pendingId)}`;
}

export async function handleCallback(c) {
  const origin = new URL(c.req.url).origin;
  let websiteId = '';
  let payload = null;
  try {
    assertConfigured(c.env);
    payload = await readConnectState(c.env, c.req.query('state') || '');
    websiteId = payload.websiteId;
    if (c.req.query('error')) throw new ApiError(400, 'Google connection was cancelled.');
    const code = c.req.query('code');
    if (!code) throw new ApiError(400, 'Google did not return a connection code.');
    const site = await c.env.DB.prepare('SELECT id FROM websites WHERE id = ? AND owner_id = ?')
      .bind(payload.websiteId, payload.sub).first();
    if (!site) throw new ApiError(404, 'That site is no longer on your account.');
    const refreshToken = await exchangeCode(c.env, c.req.url, code);
    const pendingId = await savePending(c.env.DB, c.env.JWT_SECRET, {
      userId: payload.sub,
      websiteId: payload.websiteId,
      refreshToken,
    });
    return c.redirect(scFinishRedirect(origin, payload, { websiteId, pendingId }));
  } catch (error) {
    return c.redirect(scFinishRedirect(origin, payload, {
      websiteId,
      error: error.message || 'Search Console could not be connected.',
    }));
  }
}

export async function searchConsoleForSite(env, site) {
  if (!site.sc_refresh_token || !site.sc_site_url) return { connected: false };
  if (!configured(env)) {
    return { error: 'Search Console connection is not turned on yet.', statusCode: 503, service: 'Search Console' };
  }
  try {
    const refreshToken = await decryptToken(env.JWT_SECRET, site.sc_refresh_token);
    const report = await reportForSite(env, refreshToken, site.sc_site_url);
    return {
      searchConsole: {
        ...report,
        permission: site.sc_permission,
        connectedAt: site.sc_connected_at,
      },
    };
  } catch (error) {
    console.error('Search Console report failed:', error.message);
    return {
      error: error.status === 403
        ? 'This Google account cannot read that Search Console property. Connect again and choose a property you can access.'
        : 'Search Console did not return data. Connect the property again if this keeps happening.',
      statusCode: 502,
      service: 'Search Console',
      reconnect: true,
    };
  }
}
