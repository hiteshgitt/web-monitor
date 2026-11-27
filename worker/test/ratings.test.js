import { test } from 'node:test';
import assert from 'node:assert/strict';
import { configFindings, ratedCvss, runtimeCvss } from '../src/lib/ratings.js';
import { vulnerabilityAssessment } from '../src/lib/report.js';

const band = (s) => (s >= 9 ? 'critical' : s >= 7 ? 'high' : s >= 4 ? 'medium' : s > 0 ? 'low' : 'info');

test('rated CVSS always stays inside the severity band', () => {
  for (const issue of ['runtime.eol', 'runtime.unpatched', 'header.hsts', 'header.csp', 'header.clickjacking', 'header.nosniff', 'tls.weak', 'blocklist.listed', 'unknown.type']) {
    for (const sev of ['critical', 'high', 'medium', 'moderate', 'low']) {
      const c = ratedCvss(issue, sev);
      assert.equal(band(c.score), sev === 'moderate' ? 'medium' : sev, `${issue}@${sev}`);
      assert.equal(c.source, 'rated');
    }
  }
  assert.equal(runtimeCvss({ key: 'php-eol-8.1', severity: 'high' }).score, 8.1);
});

test('configuration findings from the public check, with CVSS', () => {
  const f = configFindings({ missingHeaders: ['Strict-Transport-Security', 'X-Content-Type-Options'], sslGrade: 'C', malware: 'flagged' });
  assert.deepEqual(f.map((x) => [x.severity, band(x.cvss.score)]), [['medium', 'medium'], ['low', 'low'], ['medium', 'medium'], ['high', 'high']]);
  assert.deepEqual(configFindings({ missingHeaders: [], sslGrade: 'A+', malware: 'clean' }), []);
  assert.deepEqual(configFindings(null), []);
});

test('the assessment lists every finding by CVSS, configuration issues included', () => {
  const a = vulnerabilityAssessment({
    platform: 'wordpress',
    patching: { packagesCheckedAt: 'x', packageTotal: 1, packageSeverities: ['high'], packageMaxCvss: 8.8, runtimeKnown: true, themesChecked: true,
      runtime: [{ key: 'php-eol-8.1', severity: 'high', title: 'PHP 8.1 is past end of life', fix: 'Move', cvss: { score: 8.1, vector: 'v', source: 'rated' } }],
      advisories: [], packages: [{ kind: 'plugin', ecosystem: 'wordpress', name: 'x', version: '1', severity: 'high', cve: 'CVE-1', cvss: { score: 8.8, vector: 'w' }, fixed: '2' }] },
    security: { connected: false }, publicChecks: { missingHeaders: ['Referrer-Policy'] }, siteHealth: null,
  });
  assert.equal(a.total, 3);
  assert.equal(a.configCount, 1);
  assert.deepEqual(a.findings.map((f) => [f.kind, f.cvss.score, f.cvss.source]), [['plugin', 8.8, 'advisory'], ['runtime', 8.1, 'rated'], ['configuration', 3.1, 'rated']]);
  assert.equal(a.highestCvss, 8.8);
});
