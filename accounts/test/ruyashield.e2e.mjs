// RuyaShield ↔ Ruya Lab round trip against both dev servers (accounts :8799, RuyaShield :3299).
//   node test/ruyashield.e2e.mjs <accounts-dev-log>
// The same Ruya Lab account that signed in to WebMonitor signs in to RuyaShield, which still asks for its
// authenticator code (it never creates a session straight from Ruya Lab).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const ACC = 'http://127.0.0.1:8799';
const RS = 'http://127.0.0.1:3299';
const jars = { [ACC]: new Map(), [RS]: new Map() };
async function go(url, init = {}) {
  const jar = jars[new URL(url).origin];
  const res = await fetch(url, { redirect: 'manual', ...init, headers: { cookie: [...jar].map(([k, v]) => `${k}=${v}`).join('; '), ...(init.headers || {}) } });
  for (const sc of res.headers.getSetCookie()) { const [kv] = sc.split(';'); const i = kv.indexOf('='); const k = kv.slice(0, i); const v = kv.slice(i + 1); if (v) jar.set(k, v); else jar.delete(k); }
  return res;
}
const next = (res, base) => new URL(res.headers.get('location'), base).toString();
const form = (o) => ({ method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded', origin: ACC }, body: new URLSearchParams(o).toString() });
let n = 0;
const ok = (m) => console.log(`ok ${++n} - ${m}`);

// A new Ruya Lab account (as if made from WebMonitor), then "Continue with Ruya Lab" on RuyaShield.
const email = `rs-${Date.now()}@example.com`;
let r = await go(`${RS}/auth/ruyalab/login?returnTo=/dashboard`);
r = await go(next(r, RS));
const signin = next(r, ACC);
assert.match(signin, /\/signin\?req=/); ok('RuyaShield sends a signed-out visitor to Ruya Lab');
r = await go(await (async () => `${ACC}/signup?req=${new URL(signin).searchParams.get('req')}`)());
assert.match(await r.text(), /One account for RuyaShield/); ok('the Ruya Lab page names RuyaShield');
r = await go(`${ACC}/signup`, form({ req: new URL(signin).searchParams.get('req'), name: 'Ravi', email, password: 'shield-pass-42' }));
await new Promise((res) => setTimeout(res, 500));
const link = [...readFileSync(process.argv[2], 'utf8').matchAll(/verify link for (\S+): (\S+)/g)].filter((m) => m[1] === email).at(-1)[2];
r = await go(link);
const cb = next(r, ACC);
assert.match(cb, /^http:\/\/127\.0\.0\.1:3299\/auth\/ruyalab\/callback\?code=/); ok('Ruya Lab returns to RuyaShield');
r = await go(cb);
assert.equal(r.headers.get('location'), `${RS}/auth/mfa`, r.headers.get('location')); ok('RuyaShield continues to its authenticator step, not straight in');
assert.ok(jars[RS].has('ruya_pending') || [...jars[RS].keys()].some((k) => /pending/.test(k))); ok('…with a pending sign-in, not a session');
assert.ok(![...jars[RS].keys()].some((k) => /ruya_sid/.test(k))); ok('no RuyaShield session exists before the code');
const mfa = await (await go(`${RS}/auth/mfa`)).text();
assert.match(mfa, /Set up two-step verification|authenticator/i); ok('the authenticator page is shown for the Ruya Lab account');

// Single sign-on: a second RuyaShield sign-in skips the Ruya Lab form.
jars[RS].clear();
r = await go(`${RS}/auth/ruyalab/login`);
r = await go(next(r, RS));
assert.match(r.headers.get('location'), /\/auth\/ruyalab\/callback\?code=/); ok('signed in at Ruya Lab: no form the second time');

// A Google-started sign-in state cannot be finished on the Ruya Lab callback.
jars[RS].clear();
r = await go(`${RS}/auth/ruyalab/callback?code=forged&state=forged`);
assert.match(r.headers.get('location'), /\/auth\/error\?code=invalid_state/); ok('a forged callback is refused');
console.log(`\n${n} checks passed`);
