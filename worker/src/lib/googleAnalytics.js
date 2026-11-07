// Google Analytics 4: the site owner grants read access to their own property.
// Sign-in with Google is a different client and does not receive this token.
import { sign, verify } from 'hono/jwt';
import { ApiError, newId, nowIso } from './util.js';

const SCOPE = 'https://www.googleapis.com/auth/analytics.readonly';
const PENDING_MINUTES = 15;

const configured = (env) => Boolean(env.GOOGLE_ANALYTICS_CLIENT_ID && env.GOOGLE_ANALYTICS_CLIENT_SECRET);

export function assertAnalyticsConfigured(env) {
  if (!configured(env)) {
    throw new ApiError(503, 'Google Analytics connection is not turned on yet. Add the Analytics OAuth client first.');
  }
}

export function redirectUri(requestUrl) {
  const url = new URL(requestUrl);
  return `${url.origin}/api/analytics/google/callback`;
}

async function aesKey(secret) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`ga:${secret}`));
  return crypto.subtle.importKey('raw', digest, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

const bytesToB64 = (bytes) => {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
};

const b64ToBytes = (text) => Uint8Array.from(atob(text), (char) => char.charCodeAt(0));

export async function encryptToken(secret, plain) {
  const key = await aesKey(secret);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(plain)));
  return `${bytesToB64(iv)}.${bytesToB64(cipher)}`;
}

export async function decryptToken(secret, stored) {
  const [iv, cipher] = String(stored || '').split('.');
  if (!iv || !cipher) throw new Error('Stored Analytics token is unreadable');
  const key = await aesKey(secret);
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64ToBytes(iv) }, key, b64ToBytes(cipher));
  return new TextDecoder().decode(plain);
}

export async function connectUrl(env, requestUrl, userId, websiteId, { returnTo = 'web' } = {}) {
  assertAnalyticsConfigured(env);
  const state = await sign({
    purpose: 'ga-connect',
    sub: userId,
    websiteId,
    returnTo: returnTo === 'app' ? 'app' : 'web',
    exp: Math.floor(Date.now() / 1000) + PENDING_MINUTES * 60,
  }, env.JWT_SECRET, 'HS256');
  const params = new URLSearchParams({
    client_id: env.GOOGLE_ANALYTICS_CLIENT_ID,
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

export async function readConnectState(env, state) {
  let payload;
  try {
    payload = await verify(state, env.JWT_SECRET, 'HS256');
  } catch {
    throw new ApiError(400, 'This Google connection link has expired. Start again from the site.');
  }
  if (payload.purpose !== 'ga-connect' || !payload.sub || !payload.websiteId) {
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
    throw new ApiError(502, data.error_description || 'Google did not accept the Analytics connection.');
  }
  return data;
}

export async function exchangeCode(env, requestUrl, code) {
  const data = await tokenRequest(env, {
    code,
    client_id: env.GOOGLE_ANALYTICS_CLIENT_ID,
    client_secret: env.GOOGLE_ANALYTICS_CLIENT_SECRET,
    redirect_uri: redirectUri(requestUrl),
    grant_type: 'authorization_code',
  });
  if (!data.refresh_token) {
    throw new ApiError(502, 'Google did not return a lasting Analytics permission. Remove Web Monitor from your Google Account permissions and connect again.');
  }
  return data.refresh_token;
}

async function accessToken(env, refreshToken) {
  const data = await tokenRequest(env, {
    refresh_token: refreshToken,
    client_id: env.GOOGLE_ANALYTICS_CLIENT_ID,
    client_secret: env.GOOGLE_ANALYTICS_CLIENT_SECRET,
    grant_type: 'refresh_token',
  });
  return data.access_token;
}

export async function listProperties(access) {
  const response = await fetch('https://analyticsadmin.googleapis.com/v1beta/accountSummaries?pageSize=200', {
    headers: { Authorization: `Bearer ${access}` },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new ApiError(502, data.error?.message || 'Google Analytics properties could not be listed. Enable the Analytics Admin API.');
  }
  const properties = [];
  for (const account of data.accountSummaries || []) {
    for (const property of account.propertySummaries || []) {
      properties.push({
        id: property.property,
        name: property.displayName || property.property,
        account: account.displayName || '',
      });
    }
  }
  return properties;
}

async function runReport(access, propertyId, body) {
  const response = await fetch(`https://analyticsdata.googleapis.com/v1beta/${propertyId}:runReport`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${access}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = data.error?.message || 'Google Analytics did not return a report.';
    const error = new ApiError(response.status === 403 ? 403 : 502, message);
    throw error;
  }
  return data;
}

const metricMap = (report) => {
  const headers = report.metricHeaders || [];
  const values = report.rows?.[0]?.metricValues || [];
  const out = {};
  headers.forEach((header, index) => {
    out[header.name] = Number(values[index]?.value ?? 0);
  });
  return out;
};

const dimensionRows = (report) => (report.rows || []).map((row) => ({
  name: row.dimensionValues?.[0]?.value || 'Other',
  value: Number(row.metricValues?.[0]?.value ?? 0),
}));

export async function reportForProperty(env, refreshToken, propertyId) {
  const access = await accessToken(env, refreshToken);
  const range = [{ startDate: '28daysAgo', endDate: 'yesterday' }];
  const [totals, channels, devices] = await Promise.all([
    runReport(access, propertyId, {
      dateRanges: range,
      metrics: [
        { name: 'sessions' },
        { name: 'totalUsers' },
        { name: 'screenPageViews' },
        { name: 'bounceRate' },
        { name: 'averageSessionDuration' },
      ],
    }),
    runReport(access, propertyId, {
      dateRanges: range,
      dimensions: [{ name: 'sessionDefaultChannelGroup' }],
      metrics: [{ name: 'sessions' }],
      limit: 8,
      orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
    }),
    runReport(access, propertyId, {
      dateRanges: range,
      dimensions: [{ name: 'deviceCategory' }],
      metrics: [{ name: 'sessions' }],
    }),
  ]);
  const metrics = metricMap(totals);
  return {
    sessions: metrics.sessions || 0,
    totalUsers: metrics.totalUsers || 0,
    pageViews: metrics.screenPageViews || 0,
    bounceRate: metrics.bounceRate != null ? Math.round(metrics.bounceRate * 1000) / 10 : null,
    avgSessionDuration: metrics.averageSessionDuration != null ? Math.round(metrics.averageSessionDuration) : null,
    channelBreakdown: Object.fromEntries(dimensionRows(channels).map((row) => [row.name, row.value])),
    deviceBreakdown: Object.fromEntries(dimensionRows(devices).map((row) => [row.name, row.value])),
    range: 'Last 28 days',
  };
}

export async function savePending(db, secret, { userId, websiteId, refreshToken }) {
  const id = newId();
  const now = new Date();
  await db.prepare(`INSERT INTO ga_pending (id, user_id, website_id, refresh_token, expires_at, created_at)
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

export async function pendingProperties(env, pendingId, userId, websiteId) {
  const row = await env.DB.prepare('SELECT * FROM ga_pending WHERE id = ? AND user_id = ? AND website_id = ?')
    .bind(pendingId, userId, websiteId).first();
  if (!row || row.expires_at < nowIso()) {
    if (row) await env.DB.prepare('DELETE FROM ga_pending WHERE id = ?').bind(pendingId).run();
    throw new ApiError(404, 'That Google connection expired. Connect again.');
  }
  const refreshToken = await decryptToken(env.JWT_SECRET, row.refresh_token);
  const access = await accessToken(env, refreshToken);
  return listProperties(access);
}

export async function attachProperty(env, pendingId, userId, websiteId, propertyId) {
  const properties = await pendingProperties(env, pendingId, userId, websiteId);
  const chosen = properties.find((property) => property.id === propertyId);
  if (!chosen) throw new ApiError(400, 'Choose one of the Google Analytics properties on this account.');
  const row = await env.DB.prepare('SELECT refresh_token FROM ga_pending WHERE id = ?').bind(pendingId).first();
  const now = nowIso();
  await env.DB.batch([
    env.DB.prepare(`UPDATE websites SET ga_property_id = ?, ga_property_name = ?, ga_refresh_token = ?, ga_connected_at = ?, updated_at = ?
      WHERE id = ? AND owner_id = ?`).bind(chosen.id, chosen.name, row.refresh_token, now, now, websiteId, userId),
    env.DB.prepare('DELETE FROM ga_pending WHERE id = ?').bind(pendingId),
  ]);
  return { propertyId: chosen.id, propertyName: chosen.name, connectedAt: now };
}

function gaFinishRedirect(origin, payload, { websiteId = '', pendingId = '', error = '' } = {}) {
  // Mobile AuthSession listens for webmonitor://oauth/ga; the website keeps /app handoff.
  if (payload?.returnTo === 'app') {
    const params = new URLSearchParams();
    if (websiteId) params.set('site', websiteId);
    if (pendingId) params.set('gaPending', pendingId);
    if (error) params.set('gaError', error);
    return `webmonitor://oauth/ga?${params}`;
  }
  if (error) {
    const site = websiteId ? `site=${encodeURIComponent(websiteId)}&` : '';
    return `${origin}/app?${site}gaError=${encodeURIComponent(error)}`;
  }
  return `${origin}/app?site=${encodeURIComponent(websiteId)}&gaPending=${encodeURIComponent(pendingId)}`;
}

export async function handleCallback(c) {
  const origin = new URL(c.req.url).origin;
  let websiteId = '';
  let payload = null;
  try {
    assertAnalyticsConfigured(c.env);
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
    return c.redirect(gaFinishRedirect(origin, payload, { websiteId, pendingId }));
  } catch (error) {
    return c.redirect(gaFinishRedirect(origin, payload, {
      websiteId,
      error: error.message || 'Google Analytics could not be connected.',
    }));
  }
}

export async function analyticsForSite(env, site) {
  if (!site.ga_refresh_token || !site.ga_property_id) {
    return { error: 'Google Analytics is not connected for this site.', statusCode: 503, service: 'Analytics' };
  }
  if (!configured(env)) {
    return { error: 'Google Analytics connection is not turned on yet.', statusCode: 503, service: 'Analytics' };
  }
  try {
    const refreshToken = await decryptToken(env.JWT_SECRET, site.ga_refresh_token);
    const report = await reportForProperty(env, refreshToken, site.ga_property_id);
    return {
      googleAnalytics: {
        ...report,
        propertyId: site.ga_property_id,
        propertyName: site.ga_property_name,
        connectedAt: site.ga_connected_at,
      },
    };
  } catch (error) {
    console.error('Google Analytics report failed:', error.message);
    return {
      error: error.status === 403
        ? 'This Google account cannot read that Analytics property. Connect again and choose a property you can access.'
        : 'Google Analytics did not return data. Connect the property again if this keeps happening.',
      statusCode: 502,
      service: 'Analytics',
      reconnect: true,
    };
  }
}
