// PageSpeed Insights is a lab test. Chrome UX Report is real visitors. They stay separate.
import { ApiError, nowIso } from './util.js';

const HOUR_MS = 60 * 60 * 1000;
const WEEK_MS = 7 * 24 * HOUR_MS;
const RETRY_MS = 6 * HOUR_MS;
const CALL_MS = 55000;

const configured = (env) => Boolean(env.PAGESPEED_API_KEY);

const safeMessage = (text) => String(text || 'The request failed.').replace(/key=[^&\s]+/gi, 'key=');

function publicUrl(raw) {
  let url;
  try {
    url = new URL(String(raw || ''));
  } catch {
    throw new ApiError(400, 'This site does not have a public URL that PageSpeed can open.');
  }
  const host = url.hostname.toLowerCase();
  const privateHost = host === 'localhost' || host.endsWith('.local') || host === '0.0.0.0'
    || host.startsWith('127.') || host.startsWith('10.') || host.startsWith('192.168.')
    || /^172\.(1[6-9]|2\d|3[0-1])\./.test(host);
  if (!['http:', 'https:'].includes(url.protocol) || privateHost) {
    throw new ApiError(400, 'PageSpeed can only check a public website.');
  }
  return url;
}

function vitalStatus(kind, value) {
  if (value == null || Number.isNaN(value)) return null;
  const limits = {
    lcp: [2500, 4000],
    inp: [200, 500],
    cls: [0.1, 0.25],
    fcp: [1800, 3000],
    tbt: [200, 600],
  }[kind];
  if (!limits) return null;
  if (value <= limits[0]) return 'good';
  if (value <= limits[1]) return 'needs-improvement';
  return 'poor';
}

function auditMetric(audits, id, kind) {
  const audit = audits[id];
  if (!audit || typeof audit.numericValue !== 'number') return null;
  return {
    value: audit.numericValue,
    display: audit.displayValue || null,
    status: vitalStatus(kind, audit.numericValue),
  };
}

function labFrom(data, strategy) {
  const lighthouse = data?.lighthouseResult;
  const audits = lighthouse?.audits || {};
  const score = lighthouse?.categories?.performance?.score;
  const opportunities = Object.values(audits)
    .filter((audit) => audit?.details?.type === 'opportunity' && audit.numericValue > 0 && audit.title)
    .sort((a, b) => b.numericValue - a.numericValue)
    .slice(0, 5)
    .map((audit) => ({ title: audit.title, display: audit.displayValue || null }));
  return {
    strategy,
    score: typeof score === 'number' ? Math.round(score * 100) : null,
    fetchedAt: lighthouse?.fetchTime || null,
    lcp: auditMetric(audits, 'largest-contentful-paint', 'lcp'),
    inp: auditMetric(audits, 'interaction-to-next-paint', 'inp')
      || auditMetric(audits, 'experimental-interaction-to-next-paint', 'inp'),
    cls: auditMetric(audits, 'cumulative-layout-shift', 'cls'),
    fcp: auditMetric(audits, 'first-contentful-paint', 'fcp'),
    tbt: auditMetric(audits, 'total-blocking-time', 'tbt'),
    speedIndex: typeof audits['speed-index']?.numericValue === 'number' ? {
      value: audits['speed-index'].numericValue,
      display: audits['speed-index'].displayValue || null,
    } : null,
    opportunities,
  };
}

async function googleJson(url, options) {
  const response = await fetch(url, { ...options, signal: AbortSignal.timeout(CALL_MS) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = safeMessage(data.error?.message || `Google returned ${response.status}`);
    const error = new ApiError(response.status === 429 ? 429 : 502, message);
    error.googleStatus = response.status;
    throw error;
  }
  return data;
}

async function runPagespeed(env, pageUrl, strategy) {
  const params = new URLSearchParams({
    url: pageUrl.toString(),
    key: env.PAGESPEED_API_KEY,
    strategy,
    category: 'performance',
  });
  const data = await googleJson(`https://www.googleapis.com/pagespeedonline/v5/runPagespeed?${params}`);
  const lab = labFrom(data, strategy);
  if (lab.score == null && !lab.lcp) throw new ApiError(502, 'PageSpeed returned no performance result for this URL.');
  return lab;
}

function fieldMetric(metrics, key, kind) {
  const metric = metrics?.[key];
  const p75 = Number(metric?.percentiles?.p75);
  if (!Number.isFinite(p75)) return null;
  const bins = metric.histogram || [];
  const share = (bin) => (bin && typeof bin.density === 'number' ? Math.round(bin.density * 1000) / 10 : null);
  return {
    p75,
    status: vitalStatus(kind, p75),
    good: share(bins[0]),
    needsImprovement: share(bins[1]),
    poor: share(bins[2]),
  };
}

function periodLabel(record) {
  const period = record?.collectionPeriod;
  if (!period?.firstDate || !period?.lastDate) return null;
  const fmt = (part) => new Date(Date.UTC(part.year, part.month - 1, part.day))
    .toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
  return `${fmt(period.firstDate)} – ${fmt(period.lastDate)}`;
}

async function queryCrux(env, pageUrl, formFactor) {
  const data = await googleJson(`https://chromeuxreport.googleapis.com/v1/records:queryRecord?key=${encodeURIComponent(env.PAGESPEED_API_KEY)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ origin: pageUrl.origin, formFactor }),
  }).catch((error) => {
    if (error.googleStatus === 404) return null;
    throw error;
  });
  if (!data) return null;
  const metrics = data.record?.metrics || {};
  return {
    formFactor,
    period: periodLabel(data.record),
    lcp: fieldMetric(metrics, 'largest_contentful_paint', 'lcp'),
    inp: fieldMetric(metrics, 'interaction_to_next_paint', 'inp'),
    cls: fieldMetric(metrics, 'cumulative_layout_shift', 'cls'),
  };
}

async function loadRow(env, websiteId) {
  const row = await env.DB.prepare('SELECT payload, checked_at FROM vitals_scans WHERE website_id = ?')
    .bind(websiteId).first();
  if (!row) return null;
  try {
    return { ...JSON.parse(row.payload), checkedAt: row.checked_at, configured: true };
  } catch {
    return null;
  }
}

export async function readVitals(env, site) {
  if (!configured(env)) {
    return { configured: false, error: 'PageSpeed Insights API is not configured.', checkedAt: null, lab: null, field: null };
  }
  const saved = await loadRow(env, site.id);
  return saved || { configured: true, checkedAt: null, lab: null, field: null };
}

export async function refreshVitals(env, site) {
  if (!configured(env)) throw new ApiError(503, 'PageSpeed Insights API is not configured.');
  const pageUrl = publicUrl(site.url);
  const saved = await loadRow(env, site.id);
  if (saved?.checkedAt && saved.lab && Date.now() - Date.parse(saved.checkedAt) < HOUR_MS) {
    return { ...saved, cached: true };
  }

  const [mobile, desktop, phone, desktopField] = await Promise.all([
    runPagespeed(env, pageUrl, 'mobile').catch((error) => ({ error: safeMessage(error.message) })),
    runPagespeed(env, pageUrl, 'desktop').catch((error) => ({ error: safeMessage(error.message) })),
    queryCrux(env, pageUrl, 'PHONE').catch((error) => ({ error: safeMessage(error.message) })),
    queryCrux(env, pageUrl, 'DESKTOP').catch((error) => ({ error: safeMessage(error.message) })),
  ]);

  const labMobile = mobile?.error ? null : mobile;
  const labDesktop = desktop?.error ? null : desktop;
  const fieldPhone = phone?.error ? null : phone;
  const fieldDesktop = desktopField?.error ? null : desktopField;
  const labFailed = !labMobile && !labDesktop;
  const fieldFailed = Boolean(phone?.error && desktopField?.error);
  if (labFailed && fieldFailed) {
    throw new ApiError(502, mobile.error || phone.error || 'PageSpeed and Chrome field data both failed.');
  }

  const payload = {
    lab: {
      mobile: labMobile,
      desktop: labDesktop,
      error: mobile?.error || desktop?.error || null,
    },
    field: {
      origin: pageUrl.origin,
      phone: fieldPhone,
      desktop: fieldDesktop,
      error: phone?.error || desktopField?.error || null,
      message: !fieldPhone && !fieldDesktop && !phone?.error && !desktopField?.error
        ? 'Chrome does not have enough real-visitor data for this site yet.'
        : null,
    },
  };
  const checkedAt = nowIso();
  await env.DB.prepare(`INSERT INTO vitals_scans (website_id, payload, checked_at) VALUES (?, ?, ?)
    ON CONFLICT(website_id) DO UPDATE SET payload = excluded.payload, checked_at = excluded.checked_at`)
    .bind(site.id, JSON.stringify(payload), checkedAt).run();
  return { configured: true, checkedAt, cached: false, ...payload };
}

// One Pro site per run, oldest first. A finished scan waits a week; a failed one is tried again after six hours.
export async function scanDueVitals(env) {
  if (!configured(env)) return { skipped: 'not-configured' };
  const retryBefore = new Date(Date.now() - RETRY_MS).toISOString();
  const weekBefore = new Date(Date.now() - WEEK_MS).toISOString();
  const site = await env.DB.prepare(`SELECT w.* FROM websites w
    JOIN users u ON u.id = w.owner_id
    LEFT JOIN vitals_scans v ON v.website_id = w.id
    WHERE w.monitoring_enabled = 1 AND u.status = 'active' AND (u.plan = 'pro' OR u.role = 'admin')
      AND (
        v.website_id IS NULL
        OR (IFNULL(json_extract(v.payload, '$.failed'), 0) = 1 AND v.checked_at < ?)
        OR (IFNULL(json_extract(v.payload, '$.failed'), 0) = 0 AND v.checked_at < ?)
      )
    ORDER BY v.checked_at ASC
    LIMIT 1`).bind(retryBefore, weekBefore).first();
  if (!site) return { skipped: 'none-due' };
  try {
    const result = await refreshVitals(env, site);
    return { websiteId: site.id, checkedAt: result.checkedAt };
  } catch (error) {
    const previous = await loadRow(env, site.id);
    const payload = {
      lab: previous?.lab || null,
      field: previous?.field || null,
      failed: true,
      scannedAt: previous?.scannedAt || previous?.checkedAt || null,
      error: safeMessage(error.message),
    };
    const checkedAt = nowIso();
    await env.DB.prepare(`INSERT INTO vitals_scans (website_id, payload, checked_at) VALUES (?, ?, ?)
      ON CONFLICT(website_id) DO UPDATE SET payload = excluded.payload, checked_at = excluded.checked_at`)
      .bind(site.id, JSON.stringify(payload), checkedAt).run();
    console.error('Weekly vitals scan failed:', site.id, payload.error);
    return { websiteId: site.id, failed: true };
  }
}
