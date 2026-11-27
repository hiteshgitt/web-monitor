import { test } from 'node:test';
import assert from 'node:assert/strict';
import { confirmOutages } from '../src/lib/monitor.js';

const down = { status: 'offline', error: { code: 'TIMEOUT' } };
const up = { status: 'online', responseTime: 900 };

test('a new outage is re-checked once; a recovered re-check replaces the failure', async () => {
  const due = [{ id: 'a', status: 'online' }, { id: 'b', status: 'online' }, { id: 'c', status: 'offline' }];
  const results = [down, up, down];
  const rechecked = [];
  const n = await confirmOutages(due, results, async (s) => { rechecked.push(s.id); return up; }, { delayMs: 0 });
  assert.equal(n, 1);
  assert.deepEqual(rechecked, ['a']);      // b is up, c was already down
  assert.equal(results[0].status, 'online');
  assert.equal(results[2].status, 'offline');
});

test('a confirmed outage stays down, a failing re-check counts as down, and the limit holds', async () => {
  const due = [{ id: 'a', status: 'online' }, { id: 'b', status: 'online' }, { id: 'c', status: 'online' }];
  const results = [down, down, down];
  const n = await confirmOutages(due, results, async (s) => { if (s.id === 'b') throw new Error('boom'); return down; }, { limit: 2, delayMs: 0 });
  assert.equal(n, 2);
  assert.deepEqual(results.map((r) => r.status), ['offline', 'offline', 'offline']);
});
