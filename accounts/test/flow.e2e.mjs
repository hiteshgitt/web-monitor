// End-to-end check against a running dev server (npm run dev on port 8799, with .dev.vars "testapp" client).
//   node test/flow.e2e.mjs <dev-log-file>
// Plays a product: sign-up, email link, code exchange with PKCE, ID token verification, and the abuse cases.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRemoteJWKSet, jwtVerify } from 'jose';

const BASE = 'http://127.0.0.1:8799';
const CLIENT = { id: 'testapp', secret: 'test-secret-0123456789', redirect: 'http://127.0.0.1:9/cb' };
const log = process.argv[2];
const jar = new Map();
const cookie = () => [...jar].map(([k, v]) => `${k}=${v}`).join('; ');
async function go(path, init = {}) {
  const res = await fetch(path.startsWith('http') ? path : BASE + path, { redirect: 'manual', ...init, headers: { cookie: cookie(), ...(init.headers || {}) } });
  for (const sc of res.headers.getSetCookie()) { const [kv] = sc.split(';'); const [k, v] = kv.split('='); if (v) jar.set(k, v); else jar.delete(k); }
  return res;
}
const form = (o) => ({ method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded', origin: BASE }, body: new URLSearchParams(o).toString() });
const b64u = (buf) => Buffer.from(buf).toString('base64url');
const verifier = b64u(crypto.getRandomValues(new Uint8Array(32)));
const challenge = b64u(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)));
const authorizeUrl = (extra = {}) => `/authorize?${new URLSearchParams({ response_type: 'code', client_id: CLIENT.id, redirect_uri: CLIENT.redirect, scope: 'openid email profile', state: 'st-1', nonce: 'n-1', code_challenge: challenge, code_challenge_method: 'S256', ...extra })}`;
const token = (o) => fetch(`${BASE}/token`, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded', authorization: `Basic ${btoa(`${CLIENT.id}:${CLIENT.secret}`)}` }, body: new URLSearchParams(o) });
let passed = 0;
const ok = (name) => { passed += 1; console.log(`ok ${passed} - ${name}`); };

// Unregistered redirect URIs never redirect.
let r = await go(authorizeUrl({ redirect_uri: 'https://evil.example/cb' }));
assert.equal(r.status, 400); assert.equal(r.headers.get('location'), null); ok('unknown redirect_uri shows an error page, no redirect');
r = await go(authorizeUrl({ code_challenge_method: 'plain' }));
assert.match(r.headers.get('location'), /error=invalid_request/); ok('PKCE S256 is required');
r = await go(authorizeUrl({ prompt: 'none' }));
assert.match(r.headers.get('location'), /error=login_required/); ok('prompt=none without a session returns login_required');

// Sign up through the product's request.
r = await go(authorizeUrl());
const signin = r.headers.get('location');
assert.match(signin, /^\/signin\?req=[0-9a-f-]{36}$/); ok('authorize sends a signed-out visitor to sign-in');
const req = signin.split('req=')[1];
const page = await (await go(signin)).text();
assert.match(page, /to continue to <strong>Test App<\/strong>/); ok('sign-in page names the product');
const email = `e2e-${Date.now()}@example.com`;
r = await go('/signup', form({ req, name: 'E2E', email, password: 'short' }));
assert.match(await r.text(), /at least 10 characters/); ok('weak password refused');
r = await go('/signup', { ...form({ req, name: 'E2E', email, password: 'correct-horse-9' }), headers: { 'content-type': 'application/x-www-form-urlencoded', origin: 'https://evil.example' } });
assert.equal(r.status, 403); ok('cross-site form post refused');
r = await go('/signup', form({ req, name: 'E2E', email, password: 'correct-horse-9' }));
assert.match(await r.text(), /Check your email/); ok('sign-up asks to confirm the email');
r = await go('/signin', form({ req, email, password: 'correct-horse-9' }));
assert.match(await r.text(), /Check your email/); ok('an unverified account cannot sign in yet');

await new Promise((res) => setTimeout(res, 500));
const links = [...readFileSync(log, 'utf8').matchAll(new RegExp(`verify link for ${email.replace(/[.+]/g, '\\$&')}: (\\S+)`, 'g'))];
const link = links.at(-1)[1];
r = await go(link.replace(BASE, ''));
const back = r.headers.get('location');
assert.match(back, /^http:\/\/127\.0\.0\.1:9\/cb\?code=.+&state=st-1&iss=/); ok('the email link verifies, signs in and returns to the product with a code');
r = await go(link.replace(BASE, ''));
assert.match(await r.text(), /Link expired/); ok('the email link works once');

// Code exchange.
const code = new URL(back).searchParams.get('code');
r = await token({ grant_type: 'authorization_code', code, redirect_uri: CLIENT.redirect, code_verifier: 'wrong-verifier-wrong-verifier-wrong-verifier-1' });
assert.equal(r.status, 400); ok('wrong PKCE verifier refused (and the code is burned)');
r = await go(authorizeUrl());
const code2 = new URL(r.headers.get('location')).searchParams.get('code');
ok('a signed-in visitor gets a code straight away (single sign-on)');
r = await fetch(`${BASE}/token`, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded', authorization: `Basic ${btoa(`${CLIENT.id}:nope`)}` }, body: new URLSearchParams({ grant_type: 'authorization_code', code: code2, redirect_uri: CLIENT.redirect, code_verifier: verifier }) });
assert.equal(r.status, 401); ok('wrong client secret refused');
r = await go(authorizeUrl());
const code3 = new URL(r.headers.get('location')).searchParams.get('code');
r = await token({ grant_type: 'authorization_code', code: code3, redirect_uri: CLIENT.redirect, code_verifier: verifier });
const t = await r.json();
assert.equal(r.status, 200, JSON.stringify(t));
const { payload } = await jwtVerify(t.id_token, createRemoteJWKSet(new URL(`${BASE}/jwks.json`)), { issuer: BASE, audience: CLIENT.id });
assert.equal(payload.email, email); assert.equal(payload.email_verified, true); assert.equal(payload.nonce, 'n-1'); assert.deepEqual(payload.amr, ['pwd']);
ok('ID token is signed, for this client, with verified email, nonce and amr');
r = await token({ grant_type: 'authorization_code', code: code3, redirect_uri: CLIENT.redirect, code_verifier: verifier });
assert.equal(r.status, 400); ok('a code works only once');
const ui = await (await fetch(`${BASE}/userinfo`, { headers: { authorization: `Bearer ${t.access_token}` } })).json();
assert.equal(ui.email, email); ok('userinfo answers with the access token');

// Logout ends the single sign-on.
r = await go(`/logout?client_id=${CLIENT.id}&post_logout_redirect_uri=${encodeURIComponent('http://127.0.0.1:9/')}`);
assert.equal(r.headers.get('location'), 'http://127.0.0.1:9/'); ok('logout returns to a registered address');
r = await go(authorizeUrl());
assert.match(r.headers.get('location'), /^\/signin\?req=/); ok('after logout, sign-in is needed again');
r = await go('/signin', form({ email, password: 'wrong-password-1' }));
assert.match(await r.text(), /Incorrect email or password/); ok('wrong password refused');
console.log(`\n${passed} checks passed`);
