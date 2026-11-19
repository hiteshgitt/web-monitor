import { test } from 'node:test';
import assert from 'node:assert/strict';
import { agentAlerts, cleanSnapshot } from '../src/lib/agent.js';

const base = (o = {}) => cleanSnapshot({
  hostname: 'web1', cpu: { percent: 40, cores: 4, load: [1, 1, 1] }, memory: { percent: 50 },
  processes: { top_cpu: [{ pid: 1, name: 'php-fpm', user: 'www-data', cpu: 95, rss: 1e8 }], top_memory: [{ pid: 2, name: 'mysqld', user: 'mysql', rss: 2e9 }] },
  filesystems: [{ mount: '/', percent: 50, inodes_percent: 20 }],
  traffic: { requests: 100, status: { '2xx': 100 }, top_ips: [], attacks: [] }, ...o,
});
const titles = (r) => r.alerts.map((a) => a.title);

test('CPU alerts only when sustained for 5 minutes, then recovers', () => {
  const hot = cleanSnapshot({ ...base(), cpu: { percent: 97 } });
  assert.deepEqual(titles(agentAlerts('Shop', hot, [{ cpu: 97 }, { cpu: 96 }, { cpu: 99 }])), []);
  const r = agentAlerts('Shop', base({ cpu: { percent: 97 } }), Array.from({ length: 5 }, () => ({ cpu: 97 })));
  assert.deepEqual(titles(r), ['High CPU on web1']);
  assert.match(r.alerts[0].body, /php-fpm \(95%, www-data\)/);
  assert.deepEqual(titles(agentAlerts('Shop', base({ cpu: { percent: 40 } }), [{ cpu: 40 }], r.state)), ['CPU back to normal on web1']);
});

test('request flood from one IP and injection bursts alert once per cooldown', () => {
  const snap = base({ traffic: { requests: 900, status: { '2xx': 900 }, top_ips: [{ ip: '198.51.100.9', requests: 800, peak_rps: 45 }],
    attacks: [{ ip: '192.0.2.66', type: 'xss', count: 15, sample: 'GET /search?q=<script>' }, { ip: '192.0.2.66', type: 'sqli', count: 10, sample: 'GET /item' }] } });
  const now = Date.parse('2026-11-19T12:00:00Z');
  const r = agentAlerts('Shop', snap, [{ requests: 900 }], {}, now);
  assert.deepEqual(titles(r), ['Request flood from 198.51.100.9 on Shop', 'XSS and SQL injection attempts from 192.0.2.66 on Shop']);
  assert.ok(!r.alerts[1].body.includes('<script>'), 'query strings are never shown');
  assert.deepEqual(titles(agentAlerts('Shop', snap, [{ requests: 900 }], r.state, now + 10 * 60e3)), []);
  assert.equal(agentAlerts('Shop', snap, [{ requests: 900 }], r.state, now + 31 * 60e3).alerts.length, 2);
});

test('disk or inodes at 90% alert; a few attempts or normal traffic do not', () => {
  assert.match(titles(agentAlerts('Shop', base({ filesystems: [{ mount: '/var', percent: 60, inodes_percent: 93 }] }), []))[0], /inodes 93% used/);
  const quiet = base({ traffic: { requests: 50, status: {}, top_ips: [{ ip: '203.0.113.5', requests: 50, peak_rps: 3 }], attacks: [{ ip: '192.0.2.1', type: 'xss', count: 2 }] } });
  assert.deepEqual(titles(agentAlerts('Shop', quiet, [])), []);
});

test('untrusted snapshot fields are bounded and cleaned', () => {
  const s = cleanSnapshot({ hostname: 'x'.repeat(500), cpu: { percent: 'lots' }, traffic: { top_ips: [{ ip: 'not an ip; drop', requests: 1 }], attacks: [{ ip: '1.2.3.4', type: 'evil', count: 9 }] } });
  assert.equal(s.hostname.length, 80);
  assert.equal(s.cpu.percent, null);
  assert.deepEqual(s.traffic.topIps, []);
  assert.deepEqual(s.traffic.attacks, []);
});
