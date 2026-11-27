import { test } from 'node:test';
import assert from 'node:assert/strict';
import { vulnerabilityAssessment } from '../src/lib/report.js';
import { nvdCvss } from '../src/lib/vulnerabilities.js';

const v31 = (vector, type = 'Primary') => ({ type, cvssData: { vectorString: vector } });

test('NVD CVSS: Primary v3.1 first, then the highest; v4 only as a vector; unscored is null', () => {
  const critical = 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H';
  const medium = 'CVSS:3.1/AV:N/AC:L/PR:N/UI:R/S:C/C:L/I:L/A:N';
  const wrap = (metrics) => ({ vulnerabilities: [{ cve: { metrics } }] });
  assert.deepEqual(nvdCvss(wrap({ cvssMetricV31: [v31(critical, 'Secondary'), v31(medium, 'Primary')] })), { score: 6.1, vector: medium });
  assert.deepEqual(nvdCvss(wrap({ cvssMetricV31: [v31(medium, 'Secondary'), v31(critical, 'Secondary')] })), { score: 9.8, vector: critical });
  const v4 = 'CVSS:4.0/AV:N/AC:L/AT:N/PR:N/UI:N/VC:H/VI:H/VA:H/SC:N/SI:N/SA:N';
  assert.deepEqual(nvdCvss(wrap({ cvssMetricV40: [{ cvssData: { vectorString: v4 } }] })), { score: null, vector: v4 });
  assert.equal(nvdCvss(wrap({})), null);
  assert.equal(nvdCvss(null), null);
});

test('assessment counts every source by severity, takes the highest CVSS, and never counts what did not run', () => {
  const patching = {
    packagesCheckedAt: '2026-11-27T00:00:00Z', packageTotal: 2, packageSeverities: ['moderate', 'critical'], packageMaxCvss: 9.1,
    runtimeKnown: true, runtime: [{ severity: 'high' }],
    advisories: [{ state: 'affected', severity: 'high', cvss: { score: 9.8 } }, { state: 'patched', severity: 'critical', cvss: { score: 10 } }],
  };
  const security = { connected: true, tracked: true, lastAssessment: {}, open: { critical: 1, high: 0, medium: 2, low: 0, info: 5 }, top: [{ cvss: { score: 7.5 } }] };
  const a = vulnerabilityAssessment({ patching, security, publicChecks: { checkedAt: 'x' }, siteHealth: { plugins: { total: 8, outdated: 6 } } });
  assert.deepEqual(a.counts, { critical: 2, high: 2, medium: 3, low: 0 });
  assert.equal(a.total, 7);
  assert.equal(a.highestCvss, 9.8); // the patched advisory's 10 does not count
  assert.equal(a.scope.some((s) => s.area.startsWith('WordPress plugins')), false); // not a WordPress site
  const wp = vulnerabilityAssessment({ patching, security, publicChecks: null, siteHealth: null, platform: 'wordpress' });
  assert.equal(wp.scope[0].assessed, true);
  assert.match(wp.scope[0].area, /WordPress plugins/);
  assert.equal(a.scope.find((s) => s.area.startsWith('Manual penetration')).assessed, false);

  const none = vulnerabilityAssessment({ patching: { packageSeverities: ['critical'], packageMaxCvss: 9, runtime: [], advisories: [] }, security: { connected: false }, publicChecks: null, siteHealth: null });
  assert.equal(none.total, 0); // packages were never checked, so they are not counted
  assert.equal(none.highestCvss, null);
  assert.equal(none.scope.filter((s) => s.assessed).length, 0);
  assert.match(none.scope.find((s) => s.area.startsWith('RuyaShield')).detail, /not connected/);
});
