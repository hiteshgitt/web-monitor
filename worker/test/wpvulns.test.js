import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compareLoose, inRanges, vulnerableWpPlugins, wpFix, wpPluginItems, wpThemeItems } from '../src/lib/vulnerabilities.js';

test('plugin versions compare segment by segment', () => {
  assert.equal(compareLoose('1.3.9.7', '1.3.10'), -1);
  assert.equal(compareLoose('2.0', '2.0.0'), 0);
  assert.equal(compareLoose('v9.1.1.1', '9.1.1'), 1);
  assert.equal(compareLoose('2.1.0-beta', '2.1.0'), 0);
  assert.equal(compareLoose('', '1.0'), null);
});

test('ranges: inclusive and exclusive ends, lower bounds, exact versions', () => {
  assert.equal(inRanges('9.1.1.1', [{ from: '9.0.0', lte: '9.1.1.1' }]), true);
  assert.equal(inRanges('9.1.1.2', [{ from: '9.0.0', lte: '9.1.1.1' }]), false);
  assert.equal(inRanges('8.9', [{ from: '9.0.0', lte: '9.1.1.1' }]), false);
  assert.equal(inRanges('9.8.2', [{ from: null, lt: '9.8.2' }]), false);
  assert.equal(inRanges('9.8.1', [{ from: null, lt: '9.8.2' }]), true);
  assert.equal(inRanges('1.2', [{ exact: '1.2' }]), true);
  assert.equal(inRanges('unknown', [{ lte: '9' }]), false);
});

test('the fix clears every CVE: a named fixed version, else "newer than"', () => {
  assert.deepEqual(wpFix([{ ranges: [{ lt: '2.0' }] }, { ranges: [{ lt: '2.1' }] }]), { fixed: '2.1', fixAbove: null });
  assert.deepEqual(wpFix([{ ranges: [{ lt: '2.0' }] }, { ranges: [{ lte: '2.3' }] }]), { fixed: null, fixAbove: '2.3' });
  assert.deepEqual(wpFix([{ ranges: [{ lte: '1.0' }] }, { ranges: [{ lt: '3.0' }] }]), { fixed: '3.0', fixAbove: null });
});

test('plugin slugs come from the plugin file', () => {
  assert.deepEqual(wpPluginItems([
    { file: 'really-simple-ssl/rlrsssl-really-simple-ssl.php', name: 'Really Simple Security', version: '9.1.1' },
    { file: 'hello.php', name: 'Hello Dolly', version: '1.7.2' },
    { file: '../evil', name: 'x', version: '1' },
    { file: 'no-version/x.php', name: 'y', version: '' },
  ]), [
    { kind: 'plugin', slug: 'really-simple-ssl', name: 'Really Simple Security', version: '9.1.1' },
    { kind: 'plugin', slug: 'hello', name: 'Hello Dolly', version: '1.7.2' },
  ]);
});

const fakeEnv = (syncedAt, rows) => ({
  DB: {
    prepare(sql) {
      return {
        bind: () => ({ all: async () => ({ results: rows }) }),
        first: async () => (sql.includes('wp_vulns_sync') && syncedAt ? { synced_at: syncedAt } : null),
      };
    },
  },
});

test('vulnerable plugins: matched by slug and version, worst first, with CVSS; stale data is an error', async () => {
  const now = new Date('2026-11-27T12:00:00Z');
  const rows = [
    { cve: 'CVE-2024-10924', slug: 'really-simple-ssl', title: 'Authentication Bypass', ranges: JSON.stringify([{ from: '9.0.0', lte: '9.1.1.1' }]), cvss_score: 9.8, cvss_vector: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H', severity: 'critical', url: 'https://w/1' },
    { cve: 'CVE-2026-1', slug: 'really-simple-ssl', title: 'XSS', ranges: JSON.stringify([{ lt: '9.8.2' }]), cvss_score: 4.3, cvss_vector: null, severity: 'moderate', url: 'https://w/2' },
    { cve: 'CVE-2026-2', slug: 'polylang', title: 'XSS', ranges: JSON.stringify([{ lte: '3.8.9' }]), cvss_score: 6.1, cvss_vector: null, severity: 'moderate', url: 'https://w/3' },
  ];
  const plugins = [{ slug: 'really-simple-ssl', name: 'Really Simple Security', version: '9.1.0' }, { slug: 'polylang', name: 'Polylang', version: '3.9.0' }];
  const out = await vulnerableWpPlugins(fakeEnv('2026-11-27T10:00:00Z', rows), plugins, now);
  assert.equal(out.length, 1);
  assert.equal(out[0].slug, 'really-simple-ssl');
  assert.deepEqual(out[0].ids, ['CVE-2024-10924', 'CVE-2026-1']);
  assert.equal(out[0].severity, 'critical');
  assert.equal(out[0].cvss.score, 9.8);
  assert.equal(out[0].fixed, '9.8.2');
  await assert.rejects(vulnerableWpPlugins(fakeEnv('2026-11-20T10:00:00Z', rows), plugins, now), /stale/);
  await assert.rejects(vulnerableWpPlugins(fakeEnv(null, rows), plugins, now), /missing/);
});

test('themes: slugs from the integration, matched only against theme CVEs', async () => {
  assert.deepEqual(wpThemeItems([{ slug: 'Houzez', name: 'Houzez', version: '4.1.1', is_active: true }, { slug: 'x y', version: '1' }, { slug: 'astra', version: '' }]),
    [{ kind: 'theme', slug: 'houzez', name: 'Houzez', version: '4.1.1', active: true }]);
  const rows = [
    { cve: 'CVE-2025-49406', kind: 'theme', slug: 'houzez', title: 'Broken Access Control', ranges: JSON.stringify([{ lte: '4.1.1' }]), cvss_score: 8.8, cvss_vector: null, severity: 'high', url: 'u' },
    { cve: 'CVE-2025-1', kind: 'plugin', slug: 'houzez', title: 'plugin of the same name', ranges: JSON.stringify([{ lte: '9' }]), cvss_score: 9.8, cvss_vector: null, severity: 'critical', url: 'u' },
  ];
  const env = { DB: { prepare: (sql) => ({ bind: () => ({ all: async () => ({ results: rows }) }), first: async () => (sql.includes('wp_vulns_sync') ? { synced_at: '2026-11-27T10:00:00Z' } : null) }) } };
  const out = await vulnerableWpPlugins(env, [{ kind: 'theme', slug: 'houzez', name: 'Houzez', version: '4.1.1' }], new Date('2026-11-27T12:00:00Z'));
  assert.equal(out.length, 1);
  assert.equal(out[0].kind, 'theme');
  assert.deepEqual(out[0].ids, ['CVE-2025-49406']);
});
