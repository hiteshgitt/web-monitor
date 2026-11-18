import { test } from 'node:test';
import assert from 'node:assert/strict';
import { diagnoseNetworkError, diagnoseResponse, errorFor } from '../src/lib/diagnose.js';

const d = (status, body = '', server = null) => diagnoseResponse({ status, body, headers: { server } });

test('WordPress database down', () => {
  const r = d(500, '<html><h1>Error establishing a database connection</h1></html>');
  assert.equal(r.cause, 'database');
  assert.match(r.title, /Database connection failing/);
});

test('Laravel database error names SQLSTATE', () => {
  const r = d(500, '<pre>SQLSTATE[HY000] [2002] Connection refused (Connection: mysql)</pre>');
  assert.equal(r.cause, 'database');
  assert.match(r.detail, /SQLSTATE\[HY000\]/);
});

test('PHP memory exhausted reads the limit', () => {
  const r = d(500, '<b>Fatal error</b>: Allowed memory size of 134217728 bytes exhausted (tried to allocate 20480 bytes) in /var/www/x.php on line 9');
  assert.equal(r.cause, 'php_memory');
  assert.match(r.detail, /128 MB/);
});

test('WordPress critical error names the plugin when the page shows it', () => {
  const r = d(500, 'There has been a critical error on this website. ... /wp-content/plugins/woo-bulk-editor/includes/x.php');
  assert.equal(r.cause, 'wordpress_fatal');
  assert.equal(r.component, 'Plugin: Woo Bulk Editor');
  assert.match(r.title, /Woo Bulk Editor plugin/);
});

test('WordPress critical error without a plugin name', () => {
  const r = d(500, 'There has been a critical error on this website. Learn more about troubleshooting WordPress.');
  assert.equal(r.component, 'WordPress');
});

test('stuck maintenance mode', () => {
  assert.equal(d(503, 'Briefly unavailable for scheduled maintenance. Check back in a minute.').cause, 'maintenance_stuck');
});

test('PHP fatal with file path', () => {
  const r = d(500, '<b>Fatal error</b>:  Uncaught Error: Call to undefined function foo() in /home/u/public_html/wp-content/plugins/acme-forms/acme.php:12');
  assert.equal(r.cause, 'php_fatal');
  assert.equal(r.component, 'Plugin: Acme Forms');
});

test('disk full, hosting suspended, Next.js and Laravel pages', () => {
  assert.equal(d(500, 'fwrite(): No space left on device').cause, 'disk_full');
  assert.equal(d(200, '<title>Account Suspended</title>').cause, 'hosting_suspended');
  assert.equal(d(500, 'Application error: a server-side exception has occurred (see the server logs for more information).').cause, 'nextjs_error');
  assert.equal(d(500, '<title>Server Error</title><div>500</div><div>Server Error</div>').cause, 'laravel_error');
});

test('gateway and Cloudflare status codes', () => {
  assert.equal(d(502, '<center>nginx</center>', 'nginx').cause, 'app_server_down');
  assert.match(d(502, '', 'nginx').detail, /nginx is up/);
  assert.equal(d(504).cause, 'app_server_slow');
  assert.equal(d(521).title, 'Web server is down');
  assert.equal(d(526).cause, 'ssl');
  assert.equal(d(530, 'error code: 1016').cause, 'dns');
});

test('unknown failures are not guessed', () => {
  assert.equal(d(500, '<html>Something odd</html>'), null);
  assert.equal(d(418), null);
});

test('network errors', () => {
  const t = Object.assign(new Error('The operation was aborted'), { name: 'TimeoutError' });
  assert.equal(diagnoseNetworkError(t, 10).cause, 'timeout');
  assert.equal(diagnoseNetworkError(new Error('certificate has expired'), 10).cause, 'ssl');
  assert.equal(diagnoseNetworkError(new Error('getaddrinfo ENOTFOUND x.example'), 10).cause, 'dns');
  assert.equal(diagnoseNetworkError(new Error('weird'), 10), null);
});

test('errorFor keeps the fallback when there is no diagnosis', () => {
  const fb = { message: 'API returned status 500', code: 'API_ERROR' };
  assert.deepEqual(errorFor(null, fb), fb);
  const e = errorFor(d(500, 'Error establishing a database connection'), fb);
  assert.equal(e.code, 'API_ERROR');
  assert.equal(e.cause, 'database');
  assert.match(e.message, /^Database connection failing: /);
});

import { alertStatements } from '../src/lib/alerts.js';
import { normalizeComponents } from '../src/lib/monitor.js';

// A fake D1: records the notifications and alert_state each check would write.
const fakeDb = () => {
  const writes = [];
  return { writes, prepare: (sql) => ({ bind: (...args) => { writes.push({ sql, args }); return {}; } }) };
};
const notes = (db) => db.writes.filter((w) => w.sql.includes('INSERT INTO notifications')).map((w) => `${w.args[3]}: ${w.args[4]}`);
const stateOf = (db) => db.writes.find((w) => w.sql.includes('alert_state'))?.args[0] ?? null;

test('component alerts: failing twice in a row, once, then recovery', () => {
  const queueDown = [{ id: 'queue', name: 'Queue worker', status: 'error', message: 'Queue worker stopped', hint: 'Restart it' }];
  let site = { id: 's', owner_id: 'u', name: 'Shop', status: 'warning', components: null, alert_state: null, url: 'https://x' };
  const run = (components) => {
    const db = fakeDb();
    alertStatements(db, site, { status: 'warning', responseTime: 100, components }, new Date());
    site = { ...site, components: JSON.stringify(components), alert_state: stateOf(db) ?? site.alert_state };
    return notes(db);
  };
  assert.deepEqual(run(queueDown), []);                                   // first failure: no alert yet
  assert.deepEqual(run(queueDown), ['component_failed: Queue worker failing on Shop']);
  assert.deepEqual(run(queueDown), []);                                   // announced once
  assert.deepEqual(run([{ id: 'queue', name: 'Queue worker', status: 'ok', message: 'Processing jobs' }]), ['component_ok: Queue worker is working again on Shop']);
});

test('warnings never alert', () => {
  const site = { id: 's', owner_id: 'u', name: 'Shop', status: 'warning', url: 'https://x', components: JSON.stringify([{ id: 'disk', status: 'warning' }]), alert_state: null };
  const db = fakeDb();
  alertStatements(db, site, { status: 'warning', responseTime: 100, components: [{ id: 'disk', name: 'Disk', status: 'warning', message: '9% free' }] });
  assert.deepEqual(notes(db), []);
});

test('normalizeComponents cleans and caps', () => {
  const out = normalizeComponents([{ id: 'db', status: 'weird', message: 'x'.repeat(500) }, { nope: 1 }, null]);
  assert.equal(out.length, 1);
  assert.equal(out[0].status, 'unknown');
  assert.equal(out[0].message.length, 200);
  assert.equal(normalizeComponents(undefined), null);
});
