import { test } from 'node:test';
import assert from 'node:assert/strict';
import { errorsSummaryFrom, hasNewErrors } from '../src/lib/errorTracking.js';
import { alertStatements } from '../src/lib/alerts.js';

const db = { prepare: (sql) => ({ bind: (...args) => ({ sql, args }) }) };
const site = (state = {}) => ({ id: 's', owner_id: 'u', name: 'Shop', status: 'healthy', alert_state: JSON.stringify(state), components: '[]' });
const ok = (errorsSummary) => ({ status: 'healthy', responseTime: 300, errorsSummary });
const titles = (st) => st.filter((x) => /notifications/.test(x.sql)).map((x) => x.args[4]);

test('summary parsing and "newer error" detection', () => {
  const s = errorsSummaryFrom({ errors: { tracked: true, groups: 3, last_5m: 2, last_hour: 9, latest: '2026-11-19T10:00:00Z' } });
  assert.deepEqual(s, { tracked: true, groups: 3, last5m: 2, lastHour: 9, latest: '2026-11-19T10:00:00.000Z' });
  assert.equal(errorsSummaryFrom({}), null);
  assert.equal(hasNewErrors(null, s), true);
  assert.equal(hasNewErrors({ groups: 3, latest: s.latest }, s), false);
  assert.equal(hasNewErrors({ groups: 3, latest: '2026-11-19T09:00:00.000Z' }, s), true);
  assert.equal(hasNewErrors({ groups: 2, latest: s.latest }, s), true);
  assert.equal(hasNewErrors(null, { ...s, latest: null }), false);
});

test('error spike: alerts once when 5-minute errors jump, and again when they settle', () => {
  const spike = alertStatements(db, site(), ok({ tracked: true, groups: 2, last5m: 30, lastHour: 40, latest: null }));
  assert.deepEqual(titles(spike), ['Error spike on Shop']);
  // Steady high error rate is not a spike (it is the baseline).
  assert.deepEqual(titles(alertStatements(db, site(), ok({ tracked: true, groups: 2, last5m: 12, lastHour: 140, latest: null }))), []);
  // Few errors never alert.
  assert.deepEqual(titles(alertStatements(db, site(), ok({ tracked: true, groups: 1, last5m: 4, lastHour: 4, latest: null }))), []);
  // Already alerted: no repeat; settles → recovery alert.
  assert.deepEqual(titles(alertStatements(db, site({ errorSpike: true }), ok({ tracked: true, groups: 2, last5m: 25, lastHour: 60, latest: null }))), []);
  assert.deepEqual(titles(alertStatements(db, site({ errorSpike: true }), ok({ tracked: true, groups: 2, last5m: 1, lastHour: 60, latest: null }))), ['Errors back to normal on Shop']);
});

import { filescanDue } from '../src/lib/fileScan.js';
test('file scan cadence: Pro PHP / WordPress / Next.js only; 5 minutes during a pass, 6 hours after a complete one', () => {
  const at = new Date('2026-11-19T12:00:00Z');
  const site = (o) => ({ platform: 'wordpress', owner_pro: 1, filescan_at: null, filescan_state: null, ...o });
  assert.equal(filescanDue(site({}), at), true);
  assert.equal(filescanDue(site({ owner_pro: 0 }), at), false);
  assert.equal(filescanDue(site({ platform: 'nextjs' }), at), true);
  assert.equal(filescanDue(site({ platform: 'html' }), at), false);
  const during = JSON.stringify({ cycleComplete: false });
  assert.equal(filescanDue(site({ filescan_at: '2026-11-19T11:57:00Z', filescan_state: during }), at), false);
  assert.equal(filescanDue(site({ filescan_at: '2026-11-19T11:54:00Z', filescan_state: during }), at), true);
  const done = JSON.stringify({ cycleComplete: true });
  assert.equal(filescanDue(site({ filescan_at: '2026-11-19T07:00:00Z', filescan_state: done }), at), false);
  assert.equal(filescanDue(site({ filescan_at: '2026-11-19T05:00:00Z', filescan_state: done }), at), true);
});
