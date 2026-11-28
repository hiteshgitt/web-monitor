import { test } from 'node:test';
import assert from 'node:assert/strict';
import { eligibility, snapshotOf } from '../src/lib/attestation.js';

const scope = (vuln = true, ssl = true) => [{ area: 'WordPress plugins, against …', assessed: vuln }, { area: 'SSL / TLS, security headers and Google Safe Browsing', assessed: ssl }];
const report = (counts, over = {}) => ({
  site: { name: 'S', url: 'https://s', platform: 'wordpress' }, period: { days: 30, from: 'a', to: 'b' },
  uptime: { percent: 99.9 }, publicChecks: { sslGrade: 'A', malware: 'clean' },
  assessment: { counts, total: Object.values(counts).reduce((x, y) => x + y, 0), configCount: 2, highestCvss: 5.4, scope: scope(), findings: [{ title: 'Missing header', severity: 'medium', cvss: { score: 5.4, source: 'rated' } }] },
  ...over,
});

test('issued only with no critical or high findings and the core checks done', () => {
  assert.deepEqual(eligibility(report({ critical: 0, high: 0, medium: 2, low: 1 })), { eligible: true, reasons: [] });
  const bad = eligibility(report({ critical: 1, high: 2, medium: 0, low: 0 }));
  assert.equal(bad.eligible, false);
  assert.equal(bad.reasons.length, 2);
  const unchecked = report({ critical: 0, high: 0, medium: 0, low: 0 });
  unchecked.assessment.scope = scope(false, false);
  assert.equal(eligibility(unchecked).reasons.length, 2);
  assert.equal(eligibility(report({ critical: 0, high: 0, medium: 0, low: 0 }, { uptime: { percent: null } })).eligible, false);
  assert.equal(eligibility(report({ critical: 0, high: 0, medium: 0, low: 0 }, { publicChecks: { malware: 'flagged' } })).eligible, false);
  assert.equal(eligibility({}).eligible, false);
});

test('the snapshot states the result, scope and the disclaimer', () => {
  const s = snapshotOf(report({ critical: 0, high: 0, medium: 1, low: 0 }), '2026-11-28T00:00:00Z', '2027-02-26T00:00:00Z');
  assert.equal(s.result.totalOpen, 1);
  assert.equal(s.result.remaining[0].cvss, 5.4);
  assert.match(s.disclaimer, /not a CERT-In empanelled VAPT certificate/);
  assert.equal(s.scope.length, 2);
});
