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
