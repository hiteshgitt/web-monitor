import { test } from 'node:test';
import assert from 'node:assert/strict';
import { advisoryCvss, advisorySeverity, compareVersions, cvss3Score, fixedVersion, newProblems, runtimeIssues } from '../src/lib/vulnerabilities.js';
import { runtimeFrom } from '../src/lib/monitor.js';

const today = new Date('2026-11-19T12:00:00Z');
const php = [
  { cycle: '8.4', eol: '2028-12-31', latest: '8.4.27' },
  { cycle: '8.1', eol: '2025-12-31', latest: '8.1.34' },
];
const node = [{ cycle: '24', eol: '2028-04-30' }, { cycle: '18', eol: '2025-04-30' }];
const nodeReleases = [
  { version: '24.22.1', security: false }, { version: '24.22.0', security: true }, { version: '24.21.0', security: false },
];

test('versions compare numerically', () => {
  assert.equal(compareVersions('16.4.3', '16.4.5'), -1);
  assert.equal(compareVersions('v24.22.1', '24.22.1'), 0);
  assert.equal(compareVersions('10.0.0', '9.9.9'), 1);
});

test('the first fixed version above the installed one', () => {
  const adv = { affected: [{ package: { ecosystem: 'npm', name: 'next' }, ranges: [{ events: [{ introduced: '15.0.0' }, { fixed: '15.5.9' }, { introduced: '16.3.0' }, { fixed: '16.4.5' }] }] }] };
  assert.equal(fixedVersion(adv, 'npm', 'next', '16.4.3'), '16.4.5');
  assert.equal(fixedVersion(adv, 'npm', 'react', '16.4.3'), null);
});

test('PHP: end of life and a missed patch release are high, current is fine', () => {
  assert.equal(runtimeIssues({ php: '8.1.30' }, { php }, today)[0].key, 'php-eol-8.1');
  const patch = runtimeIssues({ php: '8.4.20' }, { php }, today)[0];
  assert.equal(patch.severity, 'high');
  assert.match(patch.fix, /8\.4\.27/);
  assert.deepEqual(runtimeIssues({ php: '8.4.27' }, { php }, today), []);
});

test('Node.js: end of life, a missed security release, and up to date', () => {
  assert.equal(runtimeIssues({ node: '18.20.0' }, { node, nodeReleases }, today)[0].key, 'node-eol-18');
  const sec = runtimeIssues({ node: '24.21.0' }, { node, nodeReleases }, today)[0];
  assert.equal(sec.key, 'node-sec-24.22.0');
  assert.match(sec.fix, /24\.22\.1/);
  assert.deepEqual(runtimeIssues({ node: '24.22.0' }, { node, nodeReleases }, today), []);
});

test('WordPress versions WordPress.org calls insecure', () => {
  const wordpress = { '6.4.1': 'insecure', '6.8.3': 'latest', '6.7.2': 'outdated' };
  assert.equal(runtimeIssues({ wordpress: '6.4.1' }, { wordpress }, today)[0].key, 'wp-insecure-6.4.1');
  assert.deepEqual(runtimeIssues({ wordpress: '6.7.2' }, { wordpress }, today), []);
});

test('no reference data means no claims either way', () => {
  assert.deepEqual(runtimeIssues({ php: '5.6.0', node: '12.0.0', wordpress: '4.0' }, {}, today), []);
});

test('only new problems alert', () => {
  const p = { name: 'next', version: '16.4.3', ids: ['GHSA-a'] };
  const before = { packages: [p], runtime: [{ key: 'php-eol-8.1' }] };
  const after = { packages: [p, { name: 'axios', version: '1.0.0', ids: ['GHSA-b'] }], runtime: [{ key: 'php-eol-8.1' }, { key: 'node-sec-24.22.0' }] };
  const fresh = newProblems(before, after);
  assert.deepEqual(fresh.packages.map((x) => x.name), ['axios']);
  assert.deepEqual(fresh.runtime.map((x) => x.key), ['node-sec-24.22.0']);
  // A new advisory for the same installed version is new too.
  assert.equal(newProblems(before, { packages: [{ ...p, ids: ['GHSA-a', 'GHSA-c'] }], runtime: [] }).packages.length, 1);
});

test('runtime versions are read from health responses, junk ignored', () => {
  assert.deepEqual(runtimeFrom({ php_version: '8.3.12', wordpress_version: '6.8.3' }), { php: '8.3.12', node: null, wordpress: '6.8.3', nextjs: null });
  assert.deepEqual(runtimeFrom({ node_version: 'v24.22.1', nextjs_version: '16.4.6' }), { php: null, node: '24.22.1', wordpress: null, nextjs: '16.4.6' });
  assert.equal(runtimeFrom({ php_version: '<script>' }), null);
});

import { securityConfigFrom } from '../src/lib/monitor.js';
test('security config keeps known keys with plain values only', () => {
  assert.deepEqual(securityConfigFrom({ security_config: { 'session.upload_progress.enabled': true, 'session.serialize_handler': 'php', evil: 'x', expose_php: '<b>' } }),
    { 'session.upload_progress.enabled': true, 'session.serialize_handler': 'php' });
  assert.equal(securityConfigFrom({}), null);
});
test('Node.js flags are kept as security config', () => {
  assert.deepEqual(securityConfigFrom({ security_config: { 'node.permission_model': true, 'node.env': 'production', 'node.secret': 'x' } }),
    { 'node.permission_model': true, 'node.env': 'production' });
});

test('CVSS v3.x base scores match the FIRST calculator', () => {
  assert.equal(cvss3Score('CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H'), 9.8);
  assert.equal(cvss3Score('CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:C/C:H/I:H/A:H'), 10);
  assert.equal(cvss3Score('CVSS:3.1/AV:N/AC:L/PR:N/UI:R/S:C/C:L/I:L/A:N'), 6.1);
  assert.equal(cvss3Score('CVSS:3.0/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:N/A:N'), 7.5);
  assert.equal(cvss3Score('CVSS:3.1/AV:N/AC:H/PR:N/UI:N/S:U/C:H/I:N/A:N'), 5.9);
  assert.equal(cvss3Score('CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:N'), 0);
  assert.equal(cvss3Score('CVSS:4.0/AV:N/AC:L/AT:N/PR:N/UI:N/VC:H/VI:H/VA:H/SC:N/SI:N/SA:N'), null);
  assert.equal(cvss3Score('garbage'), null);
});

test('advisory CVSS: highest v3 score wins, v4-only keeps the vector, severity falls back to the score', () => {
  const both = { severity: [
    { type: 'CVSS_V3', score: 'CVSS:3.1/AV:N/AC:H/PR:N/UI:N/S:U/C:H/I:N/A:N' },
    { type: 'CVSS_V3', score: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H' },
    { type: 'CVSS_V4', score: 'CVSS:4.0/AV:N/AC:L/AT:N/PR:N/UI:N/VC:H/VI:H/VA:H/SC:N/SI:N/SA:N' },
  ] };
  assert.deepEqual(advisoryCvss(both), { score: 9.8, vector: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H' });
  assert.deepEqual(advisoryCvss({ severity: [both.severity[2]] }), { score: null, vector: both.severity[2].score });
  assert.deepEqual(advisoryCvss({}), { score: null, vector: null });
  assert.equal(advisorySeverity({ ...both, database_specific: { severity: 'MODERATE' } }), 'moderate'); // the advisory's own label wins
  assert.equal(advisorySeverity(both), 'critical');
  assert.equal(advisorySeverity({}), 'unknown');
});
