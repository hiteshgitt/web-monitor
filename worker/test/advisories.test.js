import { wordpressSecurityPosts, wordpressFixed, nextjsBatches } from '../src/lib/advisories.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { branchOf, evaluate, validateAdvisory } from '../src/lib/advisories.js';

const php = { component: 'php', branches: '["8.3","8.4"]', fixed: '{}', exposure: null };

test('branches: PHP and WordPress by major.minor, Node.js and Next.js by major', () => {
  assert.equal(branchOf('php', '8.3.12'), '8.3');
  assert.equal(branchOf('wordpress', '6.8.3'), '6.8');
  assert.equal(branchOf('node', '22.23.4'), '22');
  assert.equal(branchOf('nextjs', '16.4.2'), '16');
  assert.equal(branchOf('php', null), null);
});

test('announced: affected branches match, others and other runtimes do not', () => {
  assert.equal(evaluate(php, { php: '8.3.12' }).state, 'affected');
  assert.equal(evaluate(php, { php: '8.2.30' }), null);
  assert.equal(evaluate(php, { node: '22.1.0' }), null);
  assert.equal(evaluate({ ...php, branches: '["*"]' }, { php: '8.1.2' }).state, 'affected');
});

test('released: below the fixed version is affected with a target, at or above is patched', () => {
  const rel = { ...php, fixed: '{"8.3":"8.3.37","8.4":"8.4.28"}' };
  assert.deepEqual(evaluate(rel, { php: '8.3.36' }), { state: 'affected', version: '8.3.36', branch: '8.3', target: '8.3.37', exposed: null });
  assert.equal(evaluate(rel, { php: '8.4.28' }).state, 'patched');
  assert.equal(evaluate(rel, { php: '8.4.30' }).state, 'patched');
});

test('exposure rules: reported config decides exposed vs not exposed; unknown stays affected', () => {
  const rule = { ...php, exposure: '{"session.upload_progress.enabled":true}' };
  assert.equal(evaluate(rule, { php: '8.3.1' }, '{"session.upload_progress.enabled":false}').state, 'not_exposed');
  assert.equal(evaluate(rule, { php: '8.3.1' }, '{"session.upload_progress.enabled":true}').exposed, true);
  assert.equal(evaluate(rule, { php: '8.3.1' }, null).state, 'affected');
});

test('validation', () => {
  const a = validateAdvisory({ component: 'php', title: 'PHP security releases', severity: 'critical', cves: 'cve-2026-115560', branches: '8.3, 8.4', fixed: '8.3:8.3.37 8.4:8.4.28', status: 'announced' });
  assert.equal(a.cves, '["CVE-2026-115560"]');
  assert.equal(a.branches, '["8.3","8.4"]');
  assert.equal(a.fixed, '{"8.3":"8.3.37","8.4":"8.4.28"}');
  assert.throws(() => validateAdvisory({ component: 'ruby', title: 'x', severity: 'high' }), /component/);
  assert.throws(() => validateAdvisory({ component: 'php', title: 'x', severity: 'high', status: 'released' }), /fixed version/);
  assert.throws(() => validateAdvisory({ component: 'php', title: 'x', severity: 'high', url: 'javascript:alert(1)' }), /https/);
});

import { nodeSecurityDays, phpReleaseFor } from '../src/lib/advisories.js';

test('an announced PHP advisory is released once every supported branch has shipped on or after the day', () => {
  const adv = { component: 'php', status: 'announced', release_at: '2026-11-19T14:00:00.000Z', branches: '["*"]' };
  const before = [
    { cycle: '8.5', eol: '2029-12-31', latest: '8.5.12', latestReleaseDate: '2026-10-21' },
    { cycle: '8.4', eol: '2028-12-31', latest: '8.4.27', latestReleaseDate: '2026-10-21' },
    { cycle: '8.1', eol: '2025-12-31', latest: '8.1.34', latestReleaseDate: '2025-11-20' },
  ];
  const today = new Date('2026-11-19T15:00:00Z');
  assert.equal(phpReleaseFor(adv, before, today), null);
  const half = [{ ...before[0], latest: '8.5.13', latestReleaseDate: '2026-11-19' }, before[1], before[2]];
  assert.equal(phpReleaseFor(adv, half, today), null); // 8.4 not out yet
  const done = [half[0], { ...before[1], latest: '8.4.28', latestReleaseDate: '2026-11-19' }, before[2]];
  assert.deepEqual(phpReleaseFor(adv, done, today), { 8.5: '8.5.13', 8.4: '8.4.28' }); // end-of-life 8.1 gets no fix
});

test('Node.js security release days become one advisory each, newest version per major, known days skipped', () => {
  const releases = [
    { version: 'v24.22.1', date: '2026-11-10', security: true }, { version: 'v22.23.5', date: '2026-11-10', security: true },
    { version: 'v24.22.0', date: '2026-11-01', security: false }, { version: 'v20.0.0', date: '2025-01-01', security: true },
  ];
  const days = nodeSecurityDays(releases, new Set(), '2026-10-20');
  assert.deepEqual(days, [{ sourceRef: 'node-security-2026-11-10', date: '2026-11-10', fixed: { 24: '24.22.1', 22: '22.23.5' } }]);
  assert.deepEqual(nodeSecurityDays(releases, new Set(['node-security-2026-11-10']), '2026-10-20'), []);
});

import { parseSecurityFeed } from '../src/lib/advisories.js';
test('feeds: php.net security posts (not RCs or plain releases), every Node.js vulnerability post', () => {
  const atom = `<feed><entry xmlns="http://www.w3.org/2005/Atom"><title>Informational advisory: Session upload progress</title><id>https://www.php.net/archive/2026.php#2026-10-23-1</id><published>2026-10-23T10:12:28+00:00</published><content type="xhtml"><div>CVE-2026-115560 is a remote code execution vector</div></content></entry>
<entry><title>PHP 8.6.0 RC4 available for testing</title><id>https://www.php.net/archive/2026.php#x</id><published>2026-10-21T15:41:41+00:00</published><content>Please report security issues</content></entry>
<entry><title>PHP 8.6.0 released</title><id>https://www.php.net/archive/2026.php#y</id><published>2026-11-20T10:00:00+00:00</published><content>Features</content></entry></feed>`;
  const php = parseSecurityFeed(atom, 'php');
  assert.deepEqual(php.map((i) => i.title), ['Informational advisory: Session upload progress']);
  assert.deepEqual(php[0].cves, ['CVE-2026-115560']);
  const rss = '<rss><channel><item><title></title><link>https://nodejs.org/en/blog/vulnerability/november-2026-security-releases</link><pubDate>Wed, 11 Nov 2026 00:00:00 GMT</pubDate><description>Wednesday, November 11, 2026 Security Releases</description></item></channel></rss>';
  const node = parseSecurityFeed(rss, 'node');
  assert.equal(node.length, 1);
  assert.equal(node[0].title, 'Wednesday, November 11, 2026 Security Releases');
});

test('Node.js security releases over consecutive days are one advisory; a batch known under either day is skipped', () => {
  const releases = [
    { version: 'v24.22.1', date: '2026-11-10', security: true }, { version: 'v22.23.5', date: '2026-11-11', security: true },
    { version: 'v20.19.9', date: '2026-10-20', security: true },
  ];
  const all = nodeSecurityDays(releases, new Set(), '2026-10-01');
  assert.deepEqual(all.map((b) => [b.sourceRef, b.fixed]), [['node-security-2026-10-20', { 20: '20.19.9' }], ['node-security-2026-11-10', { 24: '24.22.1', 22: '22.23.5' }]]);
  assert.equal(nodeSecurityDays(releases, new Set(['node-security-2026-11-11']), '2026-10-01').length, 1);
});

test('WordPress: only core release posts from the security feed; fixes per branch come from stable-check', () => {
  const xml = `<rss><channel>
    <item><title>WordPress 7.1.5 Release</title><link>https://wordpress.org/news/2026/11/wordpress-7-1-5-release/</link><pubDate>Wed, 18 Nov 2026 17:08:59 +0000</pubDate><description><![CDATA[<p>Fixes CVE-2026-1234 in the REST API.</p>]]></description></item>
    <item><title>Critical PHP Security Release</title><link>https://wordpress.org/news/2026/10/critical-php-security-release/</link><pubDate>Wed, 21 Oct 2026 10:00:00 +0000</pubDate></item>
    <item><title>WordPress 7.2 RC 1</title><link>https://wordpress.org/news/2026/11/rc1/</link><pubDate>Wed, 18 Nov 2026 10:00:00 +0000</pubDate></item>
  </channel></rss>`;
  const posts = wordpressSecurityPosts(xml);
  assert.deepEqual(posts.map((p) => [p.version, p.cves]), [['7.1.5', ['CVE-2026-1234']]]);
  const stable = { '7.1.4': 'insecure', '7.1.5': 'latest', '7.0.8': 'insecure', '7.0.9': 'outdated', '6.9.12': 'outdated', '4.6.30': 'insecure' };
  assert.deepEqual(wordpressFixed(stable, '7.1.5'), { 7.1: '7.1.5', '7.0': '7.0.9', 6.9: '6.9.12' });
  assert.equal(wordpressFixed({ '7.1.4': 'latest' }, '7.1.5'), null); // not live yet
});

test('Next.js: OSV advisories within two days are one release with fixes per major and the worst severity', () => {
  const v = (id, published, severity, ranges, cve) => ({ id, published, aliases: cve ? [cve] : [], database_specific: { severity }, summary: id,
    affected: [{ package: { name: 'next', ecosystem: 'npm' }, ranges: ranges.map(([introduced, fixed]) => ({ type: 'SEMVER', events: [{ introduced }, { fixed }] })) }] });
  const vulns = [
    v('GHSA-a', '2026-11-19T22:23:21Z', 'MODERATE', [['15.0.0', '15.5.29']], 'CVE-2026-119346'),
    v('GHSA-b', '2026-11-20T08:00:00Z', 'HIGH', [['16.0.0', '16.4.5'], ['13.0.0', '14.2.40']], 'CVE-2026-119348'),
    v('GHSA-old', '2026-09-01T00:00:00Z', 'LOW', [['15.0.0', '15.1.0']]),
    { ...v('GHSA-w', '2026-11-19T00:00:00Z', 'CRITICAL', [['15.0.0', '15.9.9']]), withdrawn: '2026-11-19T01:00:00Z' },
  ];
  const [b] = nextjsBatches(vulns, '2026-11-01');
  assert.equal(nextjsBatches(vulns, '2026-11-01').length, 1);
  assert.equal(b.sourceRef, 'nextjs-security-2026-11-19');
  assert.deepEqual(b.fixed, { 14: '14.2.40', 15: '15.5.29', 16: '16.4.5' });
  assert.deepEqual(b.branches, ['13', '14', '15', '16']); // 13 is affected and gets no fix
  assert.equal(b.severity, 'high');
  assert.deepEqual(b.cves, ['CVE-2026-119346', 'CVE-2026-119348']);
  assert.deepEqual(b.refs, ['nextjs-security-2026-11-19', 'nextjs-security-2026-11-20']);
});
