import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canStartTrial, newAccountPlan, ruyaLabPlanStatements, TRIAL_DAYS, trialDaysLeft } from '../src/lib/plans.js';

// Records statements instead of running them.
const db = { prepare: (sql) => ({ bind: (...args) => ({ sql, args }) }) };
const at = new Date('2026-11-19T12:00:00Z');

test('a new account starts on a 7-day Pro trial', () => {
  const p = newAccountPlan(at);
  assert.equal(p.plan, 'pro');
  assert.equal(p.plan_source, 'trial');
  assert.equal(Date.parse(p.trial_ends_at) - at.getTime(), TRIAL_DAYS * 86400e3);
  assert.equal(trialDaysLeft({ plan_source: 'trial', trial_ends_at: p.trial_ends_at }, at), 7);
  assert.equal(trialDaysLeft({ plan_source: 'trial', trial_ends_at: '2026-11-19T13:00:00Z' }, at), 1);
  assert.equal(trialDaysLeft({ plan_source: 'manual', trial_ends_at: p.trial_ends_at }, at), null);
});

test('one trial per account, never for Pro or admins', () => {
  assert.equal(canStartTrial({ plan: 'free', role: 'user', trial_ends_at: null }), true);
  assert.equal(canStartTrial({ plan: 'free', role: 'user', trial_ends_at: '2026-01-01T00:00:00Z' }), false);
  assert.equal(canStartTrial({ plan: 'pro', role: 'user', trial_ends_at: null }), false);
  assert.equal(canStartTrial({ plan: 'free', role: 'admin', trial_ends_at: null }), false);
});

test('Ruya Lab Pro switches free and trial accounts to Pro, and a notification goes out', () => {
  for (const user of [{ id: 'u', plan: 'free', plan_source: null }, { id: 'u', plan: 'pro', plan_source: 'trial' }]) {
    const st = ruyaLabPlanStatements(db, user, 'pro', at);
    assert.equal(st.length, 2);
    assert.match(st[0].sql, /plan = 'pro', plan_source = 'ruyalab'/);
    assert.match(st[1].sql, /INSERT INTO notifications/);
  }
});

test('manual Pro is never touched; Ruya Lab Pro ending returns only ruyalab accounts to Free', () => {
  assert.deepEqual(ruyaLabPlanStatements(db, { id: 'u', plan: 'pro', plan_source: 'manual' }, 'pro', at), []);
  assert.deepEqual(ruyaLabPlanStatements(db, { id: 'u', plan: 'pro', plan_source: 'manual' }, 'free', at), []);
  assert.deepEqual(ruyaLabPlanStatements(db, { id: 'u', plan: 'pro', plan_source: 'trial' }, 'free', at), []);
  assert.deepEqual(ruyaLabPlanStatements(db, { id: 'u', plan: 'pro', plan_source: 'ruyalab' }, 'pro', at), []);
  const st = ruyaLabPlanStatements(db, { id: 'u', plan: 'pro', plan_source: 'ruyalab' }, 'free', at);
  assert.match(st[0].sql, /plan = 'free', plan_source = NULL/);
});
