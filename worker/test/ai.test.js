import { test } from 'node:test';
import assert from 'node:assert/strict';
import { askZealot, buildPrompt, CF_DAILY_LIMIT, claimDaily } from '../src/lib/ai.js';

const site = { name: 'Shop', url: 'https://shop.example.com', platform: 'wordpress', status: 'online', uptime: 99.7, responseTime: 900 };

// A tiny stand-in for D1's ai_usage upsert.
function fakeDb() {
  const rows = new Map();
  return {
    rows,
    prepare: () => ({ bind: (day, provider) => ({ first: async () => {
      const k = `${day}|${provider}`;
      rows.set(k, (rows.get(k) || 0) + 1);
      return { requests: rows.get(k) };
    } }) }),
  };
}

test('the Workers AI daily cap stops calls once reached, and resets the next UTC day', async () => {
  const db = fakeDb();
  const day1 = new Date('2026-11-19T10:00:00Z');
  for (let i = 0; i < CF_DAILY_LIMIT; i += 1) assert.equal(await claimDaily(db, 'workers-ai', CF_DAILY_LIMIT, day1), true);
  assert.equal(await claimDaily(db, 'workers-ai', CF_DAILY_LIMIT, day1), false);
  assert.equal(await claimDaily(db, 'workers-ai', CF_DAILY_LIMIT, new Date('2026-11-20T00:00:01Z')), true);
});

test('the cap keeps the worst case inside the free 10,000 Neurons', () => {
  const prompt = buildPrompt('x'.repeat(50000), { ...site, analytics: { big: 'y'.repeat(50000) } });
  const inputTokens = prompt.length / 4; // ~4 characters per token
  const perAnswer = (inputTokens * 9091 + 600 * 27273) / 1e6; // Gemma 4 26B A4B Neurons
  assert.ok(prompt.length <= 10000);
  assert.ok(perAnswer * CF_DAILY_LIMIT < 10000, `worst case ${Math.round(perAnswer * CF_DAILY_LIMIT)} Neurons`);
});

test('a failing or capped provider falls through to the next; all failing gives a plain message', async () => {
  const calls = [];
  const r = await askZealot({}, 'How is uptime?', site, [
    ['capped', async () => { calls.push('capped'); return { skip: 'daily-cap' }; }],
    ['broken', async () => { calls.push('broken'); throw new Error('boom'); }],
    ['empty', async () => { calls.push('empty'); return { text: '', model: 'e' }; }],
    ['ok', async () => { calls.push('ok'); return { text: 'Uptime is 99.7%.', model: 'm' }; }],
  ]);
  assert.deepEqual(r, { answer: 'Uptime is 99.7%.', model: 'm' });
  assert.deepEqual(calls, ['capped', 'broken', 'empty', 'ok']);
  await assert.rejects(askZealot({}, 'q', site, [['x', async () => ({ error: 429 })]]), /very busy/);
});
