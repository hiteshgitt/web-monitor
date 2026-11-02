// Public security check for a site the customer already monitors.
// Safe Browsing is Google's free malware list. SSL Labs is the free certificate grade.
// Header results come from the site's own response. None of these are invented.
import { ApiError, nowIso } from './util.js';

const HOUR_MS = 60 * 60 * 1000;
const WEEK_MS = 7 * 24 * HOUR_MS;
const RETRY_MS = 6 * HOUR_MS;
const HEADER_CHECKS = [
  ['strict-transport-security', 'Strict-Transport-Security'],
  ['content-security-policy', 'Content-Security-Policy'],
  ['x-content-type-options', 'X-Content-Type-Options'],
  ['referrer-policy', 'Referrer-Policy'],
  ['permissions-policy', 'Permissions-Policy'],
];

const GRADES = ['A+', 'A', 'A-', 'B', 'C', 'D', 'E', 'F', 'T', 'M'];

function publicPage(raw) {
  let url;
  try {
    url = new URL(String(raw || ''));
  } catch {
    throw new ApiError(400, 'This site does not have a public URL that can be checked.');
  }
  const host = url.hostname.toLowerCase();
  const privateHost = host === 'localhost' || host.endsWith('.local') || host === '0.0.0.0'
    || host.startsWith('127.') || host.startsWith('10.') || host.startsWith('192.168.')
    || /^172\.(1[6-9]|2\d|3[0-1])\./.test(host);
  if (!['http:', 'https:'].includes(url.protocol) || privateHost) {
    throw new ApiError(400, 'Security checks only run against a public website.');
  }
  return url;
}

async function safeBrowsing(env, pageUrl) {
  if (!env.SAFE_BROWSING_API_KEY) {
    return { configured: false, status: null, threats: [], message: 'Safe Browsing is not turned on yet.' };
  }
  const response = await fetch(`https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${encodeURIComponent(env.SAFE_BROWSING_API_KEY)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client: { clientId: 'web-monitor', clientVersion: '1.0' },
      threatInfo: {
        threatTypes: ['MALWARE', 'SOCIAL_ENGINEERING', 'UNWANTED_SOFTWARE', 'POTENTIALLY_HARMFUL_APPLICATION'],
        platformTypes: ['ANY_PLATFORM'],
        threatEntryTypes: ['URL'],
        threatEntries: [{ url: pageUrl.toString() }],
      },
    }),
    signal: AbortSignal.timeout(15000),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    return { configured: true, status: null, threats: [], message: data.error?.message || 'Safe Browsing did not answer.' };
  }
  const threats = [...new Set((data.matches || []).map((match) => match.threatType).filter(Boolean))];
  return {
    configured: true,
    status: threats.length ? 'flagged' : 'clean',
    threats,
    message: threats.length ? null : 'Google Safe Browsing lists no malware or phishing for this URL.',
  };
}

async function headerCheck(pageUrl) {
  const response = await fetch(pageUrl, { redirect: 'follow', signal: AbortSignal.timeout(15000) });
  await response.body?.cancel();
  const frame = response.headers.get('x-frame-options')
    || (response.headers.get('content-security-policy') || '').toLowerCase().includes('frame-ancestors');
  const checks = [
    ...HEADER_CHECKS.map(([name, label]) => ({ label, present: Boolean(response.headers.get(name)) })),
    { label: 'Clickjacking protection', present: Boolean(frame) },
  ];
  const present = checks.filter((item) => item.present).length;
  return {
    checked: checks.length,
    present,
    missing: checks.filter((item) => !item.present).map((item) => item.label),
  };
}

function worstGrade(endpoints) {
  const grades = (endpoints || []).map((endpoint) => endpoint.grade).filter((grade) => GRADES.includes(grade));
  if (!grades.length) return null;
  return grades.sort((a, b) => GRADES.indexOf(b) - GRADES.indexOf(a))[0];
}

async function sslGrade(hostname, polls = 1) {
  const params = new URLSearchParams({
    host: hostname,
    publish: 'off',
    fromCache: 'on',
    maxAge: '168',
    all: 'done',
  });
  let data = null;
  for (let attempt = 0; attempt < polls; attempt += 1) {
    const response = await fetch(`https://api.ssllabs.com/api/v3/analyze?${params}`, { signal: AbortSignal.timeout(20000) });
    data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return { status: 'error', grade: null, message: data.errors?.[0]?.message || 'SSL Labs did not return a grade.' };
    }
    if (data.status === 'READY' || data.status === 'ERROR') break;
    await new Promise((resolve) => setTimeout(resolve, 8000));
  }
  if (data?.status !== 'READY') {
    return { status: 'pending', grade: null, message: 'SSL Labs is still grading this certificate.' };
  }
  const grade = worstGrade(data.endpoints);
  return {
    status: grade ? 'ready' : 'error',
    grade,
    message: grade ? null : 'SSL Labs finished without a letter grade.',
  };
}

async function loadRow(env, websiteId) {
  const row = await env.DB.prepare('SELECT payload, checked_at FROM security_scans WHERE website_id = ?')
    .bind(websiteId).first();
  if (!row) return null;
  try {
    return { ...JSON.parse(row.payload), checkedAt: row.checked_at };
  } catch {
    return null;
  }
}

export async function readSecurityScan(env, site) {
  return (await loadRow(env, site.id)) || { checkedAt: null, malware: null, ssl: null, headers: null };
}

async function saveScan(env, websiteId, payload) {
  const checkedAt = nowIso();
  await env.DB.prepare(`INSERT INTO security_scans (website_id, payload, checked_at) VALUES (?, ?, ?)
    ON CONFLICT(website_id) DO UPDATE SET payload = excluded.payload, checked_at = excluded.checked_at`)
    .bind(websiteId, JSON.stringify(payload), checkedAt).run();
  return { ...payload, checkedAt };
}

export async function refreshSecurity(env, site, { force = false, sslPolls = 1 } = {}) {
  const pageUrl = publicPage(site.url);
  const saved = await loadRow(env, site.id);
  const age = saved?.checkedAt ? Date.now() - Date.parse(saved.checkedAt) : WEEK_MS;
  if (!force && saved?.malware?.configured !== false && saved.malware && saved.ssl?.status !== 'pending' && !saved.running && age < HOUR_MS) {
    return { ...saved, cached: true };
  }

  const [malware, headers] = await Promise.all([
    safeBrowsing(env, pageUrl).catch((error) => ({ configured: Boolean(env.SAFE_BROWSING_API_KEY), status: null, threats: [], message: error.message })),
    headerCheck(pageUrl).catch((error) => ({ error: error.message, missing: [], present: null, checked: null })),
  ]);
  const sslTask = pageUrl.protocol === 'https:'
    ? sslGrade(pageUrl.hostname, sslPolls).catch((error) => ({ status: 'error', grade: null, message: error.message }))
    : Promise.resolve({ status: 'error', grade: null, message: 'This site is not served over HTTPS.' });
  await saveScan(env, site.id, {
    malware,
    headers,
    ssl: { status: 'pending', grade: null, message: 'SSL Labs is still grading this certificate.' },
    failed: false,
    running: true,
  });
  const ssl = await sslTask;
  if (malware.status == null && malware.configured && headers?.error && ssl.status === 'error') {
    throw new ApiError(502, malware.message || headers.error || ssl.message || 'The security check failed.');
  }
  return saveScan(env, site.id, { malware, headers, ssl, failed: false, running: false });
}

// Starts one check unless a fresh result already exists or a check began in the last minute.
export async function queueSecurityScan(env, site) {
  const saved = await loadRow(env, site.id);
  const age = saved?.checkedAt ? Date.now() - Date.parse(saved.checkedAt) : Infinity;
  const complete = saved?.malware?.configured !== false && saved?.malware && saved.ssl?.status !== 'pending' && !saved.failed && !saved.running && age < WEEK_MS;
  if (complete || (saved?.running && age < 90 * 1000)) return { queued: false };
  await saveScan(env, site.id, {
    malware: saved?.malware || null,
    headers: saved?.headers || null,
    ssl: saved?.ssl || null,
    failed: false,
    running: true,
  });
  try {
    return await refreshSecurity(env, site, { force: true, sslPolls: 2 });
  } catch (error) {
    await saveScan(env, site.id, {
      malware: saved?.malware || null,
      headers: saved?.headers || null,
      ssl: saved?.ssl || null,
      failed: true,
      running: false,
      error: error.message,
    });
    return { failed: true };
  }
}

export async function scanDueSecurity(env) {
  const retryBefore = new Date(Date.now() - RETRY_MS).toISOString();
  const weekBefore = new Date(Date.now() - WEEK_MS).toISOString();
  const pendingBefore = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  const runningBefore = new Date(Date.now() - 2 * 60 * 1000).toISOString();
  const site = await env.DB.prepare(`SELECT w.* FROM websites w
    JOIN users u ON u.id = w.owner_id
    LEFT JOIN security_scans s ON s.website_id = w.id
    WHERE w.monitoring_enabled = 1 AND u.status = 'active' AND (u.plan = 'pro' OR u.role = 'admin')
      AND (
        s.website_id IS NULL
        OR (json_extract(s.payload, '$.running') = 1 AND s.checked_at < ?)
        OR (IFNULL(json_extract(s.payload, '$.failed'), 0) = 1 AND s.checked_at < ?)
        OR (json_extract(s.payload, '$.ssl.status') = 'pending' AND s.checked_at < ?)
        OR json_extract(s.payload, '$.malware.configured') = 0
        OR (IFNULL(json_extract(s.payload, '$.failed'), 0) = 0 AND IFNULL(json_extract(s.payload, '$.running'), 0) = 0 AND IFNULL(json_extract(s.payload, '$.ssl.status'), '') != 'pending' AND s.checked_at < ?)
      )
    ORDER BY s.checked_at ASC
    LIMIT 1`).bind(runningBefore, retryBefore, pendingBefore, weekBefore).first();
  if (!site) return { skipped: 'none-due' };
  try {
    const result = await refreshSecurity(env, site, { force: true, sslPolls: 2 });
    return { websiteId: site.id, checkedAt: result.checkedAt, ssl: result.ssl?.status || null };
  } catch (error) {
    const previous = await loadRow(env, site.id);
    await saveScan(env, site.id, {
      malware: previous?.malware || null,
      headers: previous?.headers || null,
      ssl: previous?.ssl || null,
      failed: true,
      scannedAt: previous?.checkedAt || null,
      error: error.message,
    });
    console.error('Security scan failed:', site.id, error.message);
    return { websiteId: site.id, failed: true };
  }
}
