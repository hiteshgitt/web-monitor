// Ruya Lab Security Assessment Attestation (Pro). A snapshot of the site's automated assessment, issued only when no
// critical or high finding is open and the core checks actually ran. Valid 90 days unless revoked; anyone can verify
// it at /verify/<id>. It is never a CERT-In VAPT certificate, and every view says so.
import { sha256Hex } from './adminAuth.js';
import { buildReport } from './report.js';
import { ApiError, nowIso, parseJson } from './util.js';

export const VALID_DAYS = 90;
const PERIOD_DAYS = 30;
const DISCLAIMER = 'Automated security assessment by Ruya Lab at the date of issue. It is not a CERT-In empanelled VAPT certificate, not a manual penetration test and not a guarantee that no vulnerabilities exist.';

/** Whether a report qualifies, with the reasons when it does not. Pure. */
export function eligibility(report) {
  const reasons = [];
  const a = report?.assessment;
  if (!a) reasons.push('No vulnerability assessment is available for this site yet.');
  else {
    if (a.counts.critical) reasons.push(`${a.counts.critical} critical finding${a.counts.critical === 1 ? ' is' : 's are'} open. Fix ${a.counts.critical === 1 ? 'it' : 'them'} and wait for the next check.`);
    if (a.counts.high) reasons.push(`${a.counts.high} high finding${a.counts.high === 1 ? ' is' : 's are'} open. Fix ${a.counts.high === 1 ? 'it' : 'them'} and wait for the next check.`);
    if (!a.scope[0]?.assessed) reasons.push(`Not checked yet: ${a.scope[0]?.area || 'installed software'}.`);
    if (!a.scope.find((s) => s.area.startsWith('SSL'))?.assessed) reasons.push('The public SSL, security header and Safe Browsing check has not run yet.');
  }
  if (report?.uptime?.percent == null) reasons.push('There is no uptime data for the last 30 days.');
  if (report?.publicChecks?.malware === 'flagged') reasons.push('Google Safe Browsing lists the site.');
  return { eligible: reasons.length === 0, reasons };
}

/** What the attestation states, taken from the report. Pure. */
export function snapshotOf(report, issuedAt, validUntil) {
  const a = report.assessment;
  return {
    v: 1,
    site: { name: report.site.name, url: report.site.url, platform: report.site.platform },
    issuedAt, validUntil,
    period: { days: report.period.days, from: report.period.from, to: report.period.to },
    result: {
      openBySeverity: a.counts, totalOpen: a.total, configurationIssues: a.configCount || 0,
      highestCvss: a.highestCvss,
      remaining: a.findings.slice(0, 10).map((f) => ({ title: f.title, severity: f.severity, cvss: f.cvss?.score ?? null, cvssSource: f.cvss?.source ?? null })),
    },
    scope: a.scope.map((s) => ({ area: s.area, assessed: s.assessed })),
    uptimePercent: report.uptime?.percent ?? null,
    sslGrade: report.publicChecks?.sslGrade ?? null,
    disclaimer: DISCLAIMER,
  };
}

const randomId = () => [...crypto.getRandomValues(new Uint8Array(12))].map((b) => b.toString(16).padStart(2, '0')).join('');
const verifyUrl = (env, id) => `${String(env.APP_URL || 'https://webmonitor.ruyalab.com').replace(/\/+$/, '')}/verify/${id}`;
const status = (row, now = new Date()) => (row.revoked_at ? 'revoked' : Date.parse(row.valid_until) <= now.getTime() ? 'expired' : 'valid');
const ownerView = (env, row) => row && ({ id: row.id, issuedAt: row.issued_at, validUntil: row.valid_until, revokedAt: row.revoked_at, status: status(row), url: verifyUrl(env, row.id) });

/** The latest attestation for a site and whether a new one can be issued now. */
export async function attestationState(env, userId, site) {
  const row = await env.DB.prepare('SELECT * FROM site_attestations WHERE website_id = ? AND owner_id = ? ORDER BY issued_at DESC LIMIT 1').bind(site.id, userId).first();
  const report = await buildReport(env, userId, site, PERIOD_DAYS);
  return { latest: ownerView(env, row), ...eligibility(report) };
}

export async function issueAttestation(env, userId, site, now = new Date()) {
  const report = await buildReport(env, userId, site, PERIOD_DAYS, now);
  const check = eligibility(report);
  if (!check.eligible) throw new ApiError(422, `This site does not qualify yet: ${check.reasons.join(' ')}`);
  const issuedAt = now.toISOString();
  const validUntil = new Date(now.getTime() + VALID_DAYS * 86400e3).toISOString();
  const snapshot = JSON.stringify(snapshotOf(report, issuedAt, validUntil));
  const row = { id: randomId(), website_id: site.id, owner_id: userId, issued_at: issuedAt, valid_until: validUntil, snapshot, sha256: await sha256Hex(snapshot), revoked_at: null };
  await env.DB.prepare(`INSERT INTO site_attestations (id, website_id, owner_id, issued_at, valid_until, snapshot, sha256) VALUES (?, ?, ?, ?, ?, ?, ?)`)
    .bind(row.id, row.website_id, row.owner_id, row.issued_at, row.valid_until, row.snapshot, row.sha256).run();
  return ownerView(env, row);
}

export async function revokeAttestation(env, userId, siteId, id) {
  const r = await env.DB.prepare('UPDATE site_attestations SET revoked_at = ? WHERE id = ? AND website_id = ? AND owner_id = ? AND revoked_at IS NULL')
    .bind(nowIso(), id, siteId, userId).run();
  if (!r.meta?.changes) throw new ApiError(404, 'Attestation not found or already revoked.');
}

/** Public verification: the snapshot as issued, its hash, and whether it is valid, expired or revoked. */
export async function publicAttestation(env, id) {
  if (!/^[a-f0-9]{24}$/.test(String(id || ''))) throw new ApiError(404, 'No attestation has this ID.');
  const row = await env.DB.prepare('SELECT * FROM site_attestations WHERE id = ?').bind(id).first();
  if (!row) throw new ApiError(404, 'No attestation has this ID.');
  return { id: row.id, status: status(row), revokedAt: row.revoked_at, sha256: row.sha256, url: verifyUrl(env, row.id), ...parseJson(row.snapshot) };
}
