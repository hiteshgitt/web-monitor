import { test } from 'node:test';
import assert from 'node:assert/strict';
import { matchChanges } from '../src/lib/ruyashield.js';

const site = { id: 's1', name: 'Shop', url: 'https://www.shop.example.com/' };
const at = (iso) => new Date(iso).toISOString();
const incident = (startedAt, extra = {}) => ({ id: 'i1', website_id: 's1', started_at: at(startedAt), related_change: null, ...extra });
const posture = (changes, host = 'shop.example.com', tracked = true) => ({ hosts: [{ host, tracked, changes }] });
const change = (kind, iso, link = 'https://ruyashield.ruyalab.com/assets/a1') => ({ kind, at: at(iso), title: `${kind} title`, link });

test('an edge fix an hour before the outage is a possible cause (bare-domain asset, www site)', () => {
  const [m] = matchChanges([site], [incident('2026-11-19T10:00:00Z')], posture([change('edge_applied', '2026-11-19T09:00:00Z')]));
  assert.equal(m.incident.id, 'i1');
  assert.deepEqual(m.change, { kind: 'edge_applied', at: at('2026-11-19T09:00:00Z'), title: 'edge_applied title', link: 'https://ruyashield.ruyalab.com/assets/a1' });
});

test('the newest change in the window wins; changes outside it are ignored', () => {
  const p = posture([
    change('edge_applied', '2026-11-19T07:00:00Z'), // 3 h before: too old for an edge change
    change('edge_undone', '2026-11-19T09:40:00Z'),
    change('edge_applied', '2026-11-19T09:10:00Z'),
    change('edge_applied', '2026-11-19T10:30:00Z'), // after the outage started
  ]);
  const [m] = matchChanges([site], [incident('2026-11-19T10:00:00Z')], p);
  assert.equal(m.change.kind, 'edge_undone');
});

test('a change recorded a few minutes after the first failed check still counts', () => {
  assert.equal(matchChanges([site], [incident('2026-11-19T10:00:00Z')], posture([change('edge_applied', '2026-11-19T10:03:00Z')])).length, 1);
});

test('merged code gets a day (deploys come later), edge changes only two hours', () => {
  const p = posture([change('code_merged', '2026-11-18T14:00:00Z', 'https://github.com/o/r/pull/7')]);
  const [m] = matchChanges([site], [incident('2026-11-19T10:00:00Z')], p);
  assert.equal(m.change.link, 'https://github.com/o/r/pull/7');
  assert.equal(matchChanges([site], [incident('2026-11-19T10:00:00Z')], posture([change('edge_applied', '2026-11-18T14:00:00Z')])).length, 0);
});

test('skips incidents already matched, untracked hosts, other sites, unknown kinds and unsafe links', () => {
  const p = posture([change('edge_applied', '2026-11-19T09:30:00Z')]);
  assert.equal(matchChanges([site], [incident('2026-11-19T10:00:00Z', { related_change: '{}' })], p).length, 0);
  assert.equal(matchChanges([site], [incident('2026-11-19T10:00:00Z')], posture(p.hosts[0].changes, 'shop.example.com', false)).length, 0);
  assert.equal(matchChanges([site], [incident('2026-11-19T10:00:00Z', { website_id: 'other' })], p).length, 0);
  assert.equal(matchChanges([site], [incident('2026-11-19T10:00:00Z')], posture([change('dns_changed', '2026-11-19T09:30:00Z')])).length, 0);
  const [m] = matchChanges([site], [incident('2026-11-19T10:00:00Z')], posture([change('edge_applied', '2026-11-19T09:30:00Z', 'javascript:alert(1)')]));
  assert.equal(m.change.link, null);
});

test('an old RuyaShield without changes, or no posture at all, matches nothing', () => {
  assert.equal(matchChanges([site], [incident('2026-11-19T10:00:00Z')], { hosts: [{ host: 'shop.example.com', tracked: true }] }).length, 0);
  assert.equal(matchChanges([site], [incident('2026-11-19T10:00:00Z')], null).length, 0);
});
