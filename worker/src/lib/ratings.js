// CVSS for findings that are not a published vulnerability: unsupported or unpatched runtimes and the public
// checks (security headers, SSL grade, Safe Browsing). A standard CVSS v3.1 vector per issue type, used only when its
// score falls in the finding's severity band (else a per-severity reference vector). Mirrors RuyaShield's ratings.
import { cvss3Score } from './vulnerabilities.js';

const V = (m) => `CVSS:3.1/${m}`;
const BY_SEVERITY = {
  critical: V('AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H'), // 9.8
  high: V('AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:N/A:N'),     // 7.5
  medium: V('AV:N/AC:L/PR:N/UI:R/S:U/C:L/I:L/A:N'),   // 5.4
  low: V('AV:N/AC:H/PR:N/UI:R/S:U/C:L/I:N/A:N'),      // 3.1
};
const BY_ISSUE = {
  'runtime.eol': V('AV:N/AC:H/PR:N/UI:N/S:U/C:H/I:H/A:H'),       // 8.1: no more security fixes
  'runtime.unpatched': V('AV:N/AC:H/PR:N/UI:N/S:U/C:H/I:H/A:H'), // 8.1: a published security fix is missing
  'header.hsts': V('AV:N/AC:H/PR:N/UI:R/S:U/C:L/I:L/A:N'),
  'header.csp': V('AV:N/AC:H/PR:N/UI:R/S:C/C:L/I:L/A:N'),
  'header.clickjacking': V('AV:N/AC:L/PR:N/UI:R/S:U/C:N/I:L/A:N'),
  'header.nosniff': V('AV:N/AC:H/PR:N/UI:R/S:U/C:N/I:L/A:N'),
  'header.referrer': V('AV:N/AC:H/PR:N/UI:R/S:U/C:L/I:N/A:N'),
  'header.permissions': V('AV:N/AC:H/PR:N/UI:R/S:U/C:L/I:N/A:N'),
  'tls.weak': V('AV:N/AC:H/PR:N/UI:N/S:U/C:H/I:L/A:N'),
  'blocklist.listed': V('AV:N/AC:L/PR:N/UI:R/S:C/C:L/I:L/A:N'),
};
const band = (s) => (s >= 9 ? 'critical' : s >= 7 ? 'high' : s >= 4 ? 'medium' : s > 0 ? 'low' : 'info');
const NORMAL = { moderate: 'medium' };

/** {score, vector, source: 'rated'} for an issue type at a severity (critical | high | medium/moderate | low). */
export function ratedCvss(issue, severity) {
  const sev = NORMAL[severity] || severity;
  const specific = BY_ISSUE[issue];
  const score = specific ? cvss3Score(specific) : null;
  const vector = specific && score !== null && band(score) === sev ? specific : BY_SEVERITY[sev] || BY_SEVERITY.medium;
  return { score: cvss3Score(vector), vector, source: 'rated' };
}

const HEADER = {
  'Strict-Transport-Security': ['header.hsts', 'medium'], 'Content-Security-Policy': ['header.csp', 'medium'],
  'Clickjacking protection': ['header.clickjacking', 'medium'], 'X-Frame-Options': ['header.clickjacking', 'medium'],
  'X-Content-Type-Options': ['header.nosniff', 'low'], 'Referrer-Policy': ['header.referrer', 'low'], 'Permissions-Policy': ['header.permissions', 'low'],
};
const SSL_SEVERITY = { B: 'low', C: 'medium', D: 'high', E: 'high', F: 'high', T: 'high', M: 'high' };

/** Configuration findings from the public check, each with a rated CVSS. */
export function configFindings(publicChecks) {
  if (!publicChecks) return [];
  const out = [];
  for (const h of publicChecks.missingHeaders || []) {
    const [issue, severity] = HEADER[h] || ['header.other', 'low'];
    out.push({ kind: 'configuration', title: `Missing security header: ${h}`, severity, cvss: ratedCvss(issue, severity) });
  }
  const grade = String(publicChecks.sslGrade || '').toUpperCase().replace(/[+-]$/, '');
  if (SSL_SEVERITY[grade]) out.push({ kind: 'configuration', title: `SSL Labs grade ${publicChecks.sslGrade}`, severity: SSL_SEVERITY[grade], cvss: ratedCvss('tls.weak', SSL_SEVERITY[grade]) });
  if (publicChecks.malware === 'flagged') out.push({ kind: 'configuration', title: 'Listed by Google Safe Browsing', severity: 'high', cvss: ratedCvss('blocklist.listed', 'high') });
  return out;
}

/** Rated CVSS for a runtime issue (key php-eol-…, php-patch-…, node-eol-…, node-sec-…, wp-insecure-…). */
export const runtimeCvss = (r) => ratedCvss(/-eol-/.test(r.key || '') ? 'runtime.eol' : 'runtime.unpatched', r.severity || 'high');
