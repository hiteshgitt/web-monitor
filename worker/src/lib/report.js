// Site health report: uptime and speed from Web Monitor, the public security check, and RuyaShield findings,
// for one site over a period. One score summarises the parts that have data; parts without data are listed as
// "not measured" and left out of the score instead of counting as a pass.
import { dayKey, daysAgo } from './util.js';
import { readSecurityScan } from './securityScan.js';
import { readVitals } from './webVitals.js';
import { ruyashieldForSite } from './ruyashield.js';

export const REPORT_PERIODS = [7, 30, 90];
const MAX_INCIDENTS = 10;

// Weights of the overall score. A part without data is dropped and the rest re-weighted.
export const SCORE_WEIGHTS = { uptime: 40, security: 30, speed: 20, publicChecks: 10 };

const clamp = (n) => Math.max(0, Math.min(100, Math.round(n)));
const round1 = (n) => Math.round(n * 10) / 10;

// 99.9 % or better scores 100; 95 % or worse scores 0; linear in between.
export const uptimeScore = (pct) => clamp(((pct - 95) / (99.9 - 95)) * 100);

// Open RuyaShield findings: critical -25, high -10, medium -3, low -1 each.
export const securityScore = (open) => clamp(100 - (open.critical || 0) * 25 - (open.high || 0) * 10 - (open.medium || 0) * 3 - (open.low || 0));

const SSL_POINTS = { 'A+': 100, A: 100, 'A-': 90, B: 75, C: 50, D: 30, E: 20, F: 0, T: 0, M: 0 };

// SSL grade, minus 5 per missing security header (at most 30), and 0 if Google Safe Browsing lists the site.
export function publicChecksScore(scan) {
  if (!scan?.checkedAt) return null;
  if (scan.malware?.status === 'flagged') return 0;
  const ssl = scan.ssl?.grade ? SSL_POINTS[scan.ssl.grade] : null;
  const missing = Array.isArray(scan.headers?.missing) ? scan.headers.missing.length : null;
  if (ssl == null && missing == null) return null;
  return clamp((ssl ?? 100) - Math.min(30, (missing ?? 0) * 5));
}

export function overallScore(parts) {
  const scored = Object.entries(parts).filter(([, v]) => typeof v === 'number');
  if (!scored.length) return null;
  const weight = scored.reduce((t, [k]) => t + SCORE_WEIGHTS[k], 0);
  return clamp(scored.reduce((t, [k, v]) => t + v * SCORE_WEIGHTS[k], 0) / weight);
}

// Minutes of an incident that fall inside [from, to].
const minutesWithin = (incident, from, to) => {
  const start = Math.max(Date.parse(incident.started_at), from.getTime());
  const end = Math.min(incident.ended_at ? Date.parse(incident.ended_at) : to.getTime(), to.getTime());
  return end > start ? (end - start) / 60000 : 0;
};

export async function buildReport(env, userId, site, days, now = new Date()) {
  const from = daysAgo(days, now);
  const [dayRows, incidentRows, scan, vitals, ruyashield] = await Promise.all([
    env.DB.prepare('SELECT day, total, up, response_sum FROM check_days WHERE website_id = ? AND day >= ? ORDER BY day')
      .bind(site.id, dayKey(from)).all().then((r) => r.results),
    env.DB.prepare(`SELECT started_at, ended_at, status, message FROM incidents
      WHERE website_id = ? AND (ended_at IS NULL OR ended_at >= ?) AND started_at <= ? ORDER BY started_at DESC`)
      .bind(site.id, from.toISOString(), now.toISOString()).all().then((r) => r.results),
    readSecurityScan(env, site),
    readVitals(env, site),
    ruyashieldForSite(env, userId, site).catch(() => null),
  ]);

  // ----- uptime and response time -----
  const total = dayRows.reduce((t, d) => t + d.total, 0);
  const up = dayRows.reduce((t, d) => t + d.up, 0);
  const responseSum = dayRows.reduce((t, d) => t + d.response_sum, 0);
  const uptimePct = total ? round1((up / total) * 100) : null;
  const incidents = incidentRows.map((i) => ({
    startedAt: i.started_at, endedAt: i.ended_at, status: i.status, message: i.message,
    minutes: Math.round(minutesWithin(i, from, now)),
  }));
  const uptime = {
    checks: total,
    percent: uptimePct,
    avgResponseMs: up ? Math.round(responseSum / up) : null,
    downtimeMinutes: incidents.reduce((t, i) => t + i.minutes, 0),
    incidentCount: incidents.length,
    longestIncidents: [...incidents].sort((a, b) => b.minutes - a.minutes).slice(0, MAX_INCIDENTS),
    daily: dayRows.map((d) => ({
      day: d.day,
      uptime: d.total ? round1((d.up / d.total) * 100) : null,
      avgResponseMs: d.up ? Math.round(d.response_sum / d.up) : null,
    })),
  };

  // ----- speed (PageSpeed lab run, refreshed weekly) -----
  const lab = vitals?.lab?.mobile || vitals?.lab?.desktop || null;
  const speed = vitals?.checkedAt && lab ? {
    checkedAt: vitals.checkedAt,
    strategy: lab.strategy,
    score: lab.score,
    lcp: lab.lcp?.display || null,
    cls: lab.cls?.display || null,
    tbt: lab.tbt?.display || null,
    opportunities: (lab.opportunities || []).slice(0, 3),
  } : null;

  // ----- public security check (SSL Labs, headers, Safe Browsing) -----
  const publicChecks = scan?.checkedAt ? {
    checkedAt: scan.checkedAt,
    sslGrade: scan.ssl?.grade || null,
    sslMessage: scan.ssl?.grade ? null : scan.ssl?.message || null,
    malware: scan.malware?.status || null,
    missingHeaders: scan.headers?.missing || [],
  } : null;

  // ----- RuyaShield -----
  const rs = ruyashield?.site?.tracked ? ruyashield.site : null;
  const security = {
    connected: Boolean(ruyashield?.connected),
    tracked: Boolean(rs),
    orgName: ruyashield?.orgName || null,
    fetchedAt: ruyashield?.fetchedAt || null,
    verified: rs ? rs.asset.status === 'verified' : null,
    open: rs?.findings?.open || null,
    openTotal: rs?.findings?.openTotal ?? null,
    top: rs?.findings?.top || [],
    lastAssessment: rs?.lastAssessment || null,
    link: rs?.link || null,
  };

  // RuyaShield findings only count once an assessment has run; no assessment is "not measured", not a pass.
  const parts = {
    uptime: uptimePct == null ? null : uptimeScore(uptimePct),
    security: security.open && security.lastAssessment ? securityScore(security.open) : null,
    speed: typeof speed?.score === 'number' ? speed.score : null,
    publicChecks: publicChecksScore(scan),
  };

  return {
    site: { id: site.id, name: site.name, url: site.url, platform: site.platform },
    period: { days, from: from.toISOString(), to: now.toISOString() },
    generatedAt: now.toISOString(),
    score: { overall: overallScore(parts), parts, weights: SCORE_WEIGHTS },
    uptime,
    speed,
    publicChecks,
    security,
  };
}

// Free plans see the headline only: the overall score, uptime and which parts were measured. Everything else
// (incidents, daily data, speed, SSL, RuyaShield findings) and every download stays Pro, enforced here.
export const FREE_REPORT_DAYS = 30;

export function previewReport(report) {
  return {
    preview: true,
    site: report.site,
    period: report.period,
    generatedAt: report.generatedAt,
    score: {
      overall: report.score.overall,
      weights: report.score.weights,
      measured: Object.fromEntries(Object.entries(report.score.parts).map(([k, v]) => [k, v != null])),
    },
    uptime: { percent: report.uptime.percent, incidentCount: report.uptime.incidentCount },
    security: { connected: report.security.connected, tracked: report.security.tracked },
  };
}
