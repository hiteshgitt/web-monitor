// WebMonitor ↔ Ruya Lab round trip against both dev servers (accounts :8799, WebMonitor worker :8787).
//   node test/webmonitor.e2e.mjs <accounts-dev-log>
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const ACC = 'http://127.0.0.1:8799';
const WM = 'http://127.0.0.1:8787';
const jars = { [ACC]: new Map(), [WM]: new Map() };
async function go(url, init = {}) {
  const jar = jars[new URL(url).origin];
  const res = await fetch(url, { redirect: 'manual', ...init, headers: { cookie: [...jar].map(([k, v]) => `${k}=${v}`).join('; '), ...(init.headers || {}) } });
  for (const sc of res.headers.getSetCookie()) { const [kv] = sc.split(';'); const i = kv.indexOf('='); const k = kv.slice(0, i); const v = kv.slice(i + 1); if (v) jar.set(k, v); else jar.delete(k); }
  return res;
}
const follow = (res, base) => new URL(res.headers.get('location'), base).toString();
const form = (o) => ({ method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded', origin: ACC }, body: new URLSearchParams(o).toString() });
let n = 0;
const ok = (m) => console.log(`ok ${++n} - ${m}`);

// 1. A brand-new person signs up at Ruya Lab from WebMonitor.
let r = await go(`${WM}/api/auth/ruyalab/start?screen=signup`);
r = await go(follow(r, WM));
const signup = follow(r, ACC);
assert.match(signup, /\/signup\?req=/); ok('"Create account" goes to the Ruya Lab sign-up screen');
const req = new URL(signup).searchParams.get('req');
const email = `wm-${Date.now()}@example.com`;
r = await go(`${ACC}/signup`, form({ req, name: 'Asha', email, password: 'monitor-pass-42' }));
assert.match(await r.text(), /Check your email/);
await new Promise((res) => setTimeout(res, 500));
const link = [...readFileSync(process.argv[2], 'utf8').matchAll(/verify link for (\S+): (\S+)/g)].filter((m) => m[1] === email).at(-1)[2];
r = await go(link);
const cb = follow(r, ACC);
assert.match(cb, /^http:\/\/127\.0\.0\.1:8787\/api\/auth\/ruyalab\/callback\?code=/); ok('after confirming the email, Ruya Lab returns to WebMonitor');
r = await go(cb);
const landing = r.headers.get('location');
assert.match(landing, /^\/app#rl_token=/, landing); ok('WebMonitor signs the new person in');
const token = decodeURIComponent(landing.split('rl_token=')[1]);
let me = await (await fetch(`${WM}/api/auth/me`, { headers: { authorization: `Bearer ${token}` } })).json();
assert.equal(me.user.email, email); assert.equal(me.user.name, 'Asha'); ok('the WebMonitor account was created with the Ruya Lab name and email');

// 2. Single sign-on: already signed in at Ruya Lab, so no form at all.
jars[WM].clear();
r = await go(`${WM}/api/auth/ruyalab/start`);
r = await go(follow(r, WM));
assert.match(r.headers.get('location'), /\/api\/auth\/ruyalab\/callback\?code=/); ok('a second visit goes straight back with no sign-in form');
r = await go(follow(r, ACC));
const t2 = decodeURIComponent(r.headers.get('location').split('rl_token=')[1]);
me = await (await fetch(`${WM}/api/auth/me`, { headers: { authorization: `Bearer ${t2}` } })).json();
assert.equal(me.user.email, email); ok('…and lands in the same WebMonitor account');

// 3. An existing WebMonitor user (email + password) is linked, not duplicated.
const old = `old-${Date.now()}@example.com`;
r = await fetch(`${WM}/api/auth/register`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: 'Old', email: old, password: 'old-password-1' }) });
const oldId = (await r.json()).user.id;
jars[ACC].clear(); jars[WM].clear();
r = await go(`${WM}/api/auth/ruyalab/start`);
r = await go(follow(r, WM));
const sreq = new URL(follow(r, ACC)).searchParams.get('req');
r = await go(`${ACC}/signup`, form({ req: sreq, name: 'Old', email: old, password: 'new-ruyalab-pass-1' }));
await new Promise((res) => setTimeout(res, 500));
const link2 = [...readFileSync(process.argv[2], 'utf8').matchAll(/verify link for (\S+): (\S+)/g)].filter((m) => m[1] === old).at(-1)[2];
r = await go(link2);
r = await go(follow(r, ACC));
const t3 = decodeURIComponent(r.headers.get('location').split('rl_token=')[1]);
me = await (await fetch(`${WM}/api/auth/me`, { headers: { authorization: `Bearer ${t3}` } })).json();
assert.equal(me.user.id, oldId); ok('an existing WebMonitor account with the same verified email is linked, keeping its sites');

// 4. Tampering.
jars[WM].clear();
r = await go(`${WM}/api/auth/ruyalab/callback?code=x&state=forged`);
assert.match(r.headers.get('location'), /\/login\?rl_error=expired/); ok('a callback without the start cookie is refused');
r = await go(`${WM}/api/auth/ruyalab/start`);
r = await go(`${WM}/api/auth/ruyalab/callback?code=x&state=forged`);
assert.match(r.headers.get('location'), /\/login\?rl_error=failed/); ok('a forged state is refused');
console.log(`\n${n} checks passed`);
