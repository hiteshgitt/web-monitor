// Ruya Lab accounts (accounts.ruyalab.com): one sign-in for every Ruya Lab product.
// A small OpenID Connect provider: authorization code flow with PKCE (S256) only, confidential clients,
// RS256 ID tokens. Products (WebMonitor, RuyaShield) keep their own data and permissions and add their own
// extra steps (RuyaShield asks for its authenticator code after this sign-in).
import { Hono } from 'hono';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import {
  checkPassword, hashPassword, jwks, needsRehash, passwordProblem, pkceChallenge, randomToken, safeEqual, sha256, signJwt, verifyJwt,
} from './lib/crypto.js';
import { mailConfigured, sendResetEmail, sendVerifyEmail } from './lib/mail.js';
import { accountPage, checkEmailPage, errorPage, forgotPage, resetPage, signinPage, signupPage } from './lib/ui.js';

const SESSION_DAYS = 30;
const CODE_TTL_S = 60;
const REQ_TTL_S = 30 * 60;
const TOKEN_TTL_S = 600;
const GOOGLE_JWKS = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));
const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/;

const now = () => new Date();
const iso = (d = now()) => d.toISOString();
const later = (s) => iso(new Date(Date.now() + s * 1000));
const newId = () => crypto.randomUUID();

// ---------- clients ----------

/** CLIENTS (JSON var): [{ id, name, redirect_uris, post_logout_redirect_uris, home }]. Secret: CLIENT_SECRET_<ID>. */
export function clients(env) {
  let list = [];
  try { list = JSON.parse(env.CLIENTS || '[]'); } catch { list = []; }
  return new Map(list.map((x) => [x.id, { ...x, secret: env[`CLIENT_SECRET_${String(x.id).toUpperCase()}`] || null }]));
}

// ---------- sessions ----------

const secure = (env) => String(env.ISSUER || '').startsWith('https://');
const cookieName = (env) => (secure(env) ? '__Host-rl_sid' : 'rl_sid');

async function getSession(c) {
  const raw = getCookie(c, cookieName(c.env));
  if (!raw || raw.length > 100) return null;
  const s = await c.env.DB.prepare(`SELECT s.*, u.email, u.name, u.disabled_at FROM sessions s JOIN users u ON u.id = s.user_id
    WHERE s.id_hash = ? AND s.revoked_at IS NULL`).bind(await sha256(raw)).first();
  if (!s || s.disabled_at || s.expires_at <= iso()) return null;
  if (Date.now() - Date.parse(s.last_seen_at) > 10 * 60_000) {
    // Sliding: 30 days from the last visit.
    await c.env.DB.prepare('UPDATE sessions SET last_seen_at = ?, expires_at = ? WHERE id_hash = ?').bind(iso(), later(SESSION_DAYS * 86400), s.id_hash).run();
  }
  return s;
}

async function startSession(c, user, amr) {
  const raw = randomToken();
  const t = Math.floor(Date.now() / 1000);
  await c.env.DB.batch([
    c.env.DB.prepare(`INSERT INTO sessions (id_hash, user_id, amr, auth_time, created_at, last_seen_at, expires_at, ip, user_agent)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(await sha256(raw), user.id, JSON.stringify(amr), t, iso(), iso(), later(SESSION_DAYS * 86400),
      c.req.header('cf-connecting-ip') || null, (c.req.header('user-agent') || '').slice(0, 300)),
    c.env.DB.prepare('UPDATE users SET last_login_at = ? WHERE id = ?').bind(iso(), user.id),
  ]);
  setCookie(c, cookieName(c.env), raw, { httpOnly: true, secure: secure(c.env), sameSite: 'Lax', path: '/', maxAge: SESSION_DAYS * 86400 });
  return { user_id: user.id, amr: JSON.stringify(amr), auth_time: t };
}

// ---------- guards ----------

/** Form posts must come from this site (SameSite=Lax cookies plus an Origin check). */
function sameOrigin(c) {
  // Modern browsers say where a request came from in Sec-Fetch-Site; trust that first.
  const site = c.req.header('sec-fetch-site');
  if (site) return site === 'same-origin';
  const origin = c.req.header('origin');
  if (!origin) return true; // very old browsers; the cookie is SameSite=Lax anyway
  return origin === new URL(c.env.ISSUER).origin;
}

async function limited(c, key) {
  if (!c.env.AUTH_LIMITER) return false;
  const { success } = await c.env.AUTH_LIMITER.limit({ key: `${key}:${c.req.header('cf-connecting-ip') || 'local'}` });
  return !success;
}

const googleOn = (env) => Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);

// ---------- authorization requests ----------

function redirectWith(uri, params) {
  const u = new URL(uri);
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null) u.searchParams.set(k, v);
  return u.toString();
}

async function loadRequest(env, id) {
  if (!id || !/^[0-9a-f-]{36}$/.test(id)) return null;
  const r = await env.DB.prepare('SELECT * FROM auth_requests WHERE id = ? AND expires_at > ?').bind(id, iso()).first();
  if (!r) return null;
  const client = clients(env).get(r.client_id);
  return client ? { ...r, params: JSON.parse(r.params), client } : null;
}

/** Issues a one-time code for the request and sends the browser back to the product. */
async function issueCode(c, client, params, session) {
  const code = randomToken();
  await c.env.DB.prepare(`INSERT INTO auth_codes (code_hash, client_id, user_id, redirect_uri, code_challenge, nonce, scope, auth_time, amr, expires_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(await sha256(code), client.id, session.user_id, params.redirect_uri, params.code_challenge,
    params.nonce || null, params.scope, session.auth_time, session.amr, later(CODE_TTL_S)).run();
  return c.redirect(redirectWith(params.redirect_uri, { code, state: params.state, iss: c.env.ISSUER }), 302);
}

/** After any successful sign-in: finish the product's request, or show the account page. */
async function continueAfterSignIn(c, reqId, session) {
  const r = await loadRequest(c.env, reqId);
  if (!r) return c.redirect('/account', 302);
  await c.env.DB.prepare('DELETE FROM auth_requests WHERE id = ?').bind(r.id).run();
  return issueCode(c, r.client, r.params, session);
}

const app = new Hono();

app.use('*', async (c, next) => {
  await next();
  c.header('strict-transport-security', 'max-age=31536000');
  c.header('x-frame-options', 'DENY');
});

// ---------- discovery ----------

app.get('/.well-known/openid-configuration', (c) => {
  const i = c.env.ISSUER;
  return c.json({
    issuer: i, authorization_endpoint: `${i}/authorize`, token_endpoint: `${i}/token`, userinfo_endpoint: `${i}/userinfo`,
    jwks_uri: `${i}/jwks.json`, end_session_endpoint: `${i}/logout`,
    response_types_supported: ['code'], grant_types_supported: ['authorization_code'], subject_types_supported: ['public'],
    id_token_signing_alg_values_supported: ['RS256'], scopes_supported: ['openid', 'email', 'profile'],
    token_endpoint_auth_methods_supported: ['client_secret_basic', 'client_secret_post'], code_challenge_methods_supported: ['S256'],
    claims_supported: ['sub', 'iss', 'aud', 'exp', 'iat', 'auth_time', 'nonce', 'amr', 'email', 'email_verified', 'name', 'picture'],
    authorization_response_iss_parameter_supported: true,
  }, 200, { 'cache-control': 'public, max-age=3600' });
});

app.get('/jwks.json', async (c) => c.json(await jwks(c.env), 200, { 'cache-control': 'public, max-age=3600' }));

// ---------- authorize ----------

app.get('/authorize', async (c) => {
  const p = c.req.query();
  const client = clients(c.env).get(p.client_id || '');
  // Unknown client or redirect URI: never redirect anywhere (open-redirect protection).
  if (!client) return errorPage('Unknown application', 'This sign-in link is not valid.');
  if (!client.redirect_uris.includes(p.redirect_uri)) return errorPage('Sign-in link not valid', 'The return address of this sign-in link is not registered.');
  const fail = (error, desc) => c.redirect(redirectWith(p.redirect_uri, { error, error_description: desc, state: p.state, iss: c.env.ISSUER }), 302);
  if (p.response_type !== 'code') return fail('unsupported_response_type', 'Only the code flow is supported.');
  const scope = String(p.scope || '').split(' ').filter(Boolean);
  if (!scope.includes('openid')) return fail('invalid_scope', 'openid scope required.');
  if (p.code_challenge_method !== 'S256' || !/^[A-Za-z0-9_-]{43,128}$/.test(p.code_challenge || '')) return fail('invalid_request', 'PKCE with S256 is required.');
  if (p.state && p.state.length > 500) return fail('invalid_request', 'state too long.');
  if (p.nonce && p.nonce.length > 500) return fail('invalid_request', 'nonce too long.');

  const params = { redirect_uri: p.redirect_uri, state: p.state || null, nonce: p.nonce || null, code_challenge: p.code_challenge, scope: scope.join(' ') };
  const prompt = String(p.prompt || '').split(' ');
  const session = await getSession(c);
  const tooOld = session && p.max_age !== undefined && Number.isFinite(Number(p.max_age)) && Date.now() / 1000 - session.auth_time > Number(p.max_age);
  if (session && !prompt.includes('login') && !tooOld) return issueCode(c, client, params, session);
  if (prompt.includes('none')) return fail('login_required', 'Sign-in required.');
  const id = newId();
  await c.env.DB.prepare('INSERT INTO auth_requests (id, client_id, params, created_at, expires_at) VALUES (?, ?, ?, ?, ?)')
    .bind(id, client.id, JSON.stringify(params), iso(), later(REQ_TTL_S)).run();
  return c.redirect(`/${p.screen === 'signup' ? 'signup' : 'signin'}?req=${id}`, 302);
});

// ---------- token ----------

const tokenError = (c, error, status = 400, desc) => c.json({ error, ...(desc ? { error_description: desc } : {}) }, status, { 'cache-control': 'no-store' });

/** Client credentials from HTTP Basic (or the form body). Returns the client, or null when they do not match. */
function authenticateClient(c, body = {}) {
  let id = body.client_id; let secret = body.client_secret;
  const auth = c.req.header('authorization') || '';
  if (auth.startsWith('Basic ')) {
    try {
      const [u, s] = atob(auth.slice(6)).split(':');
      id = decodeURIComponent(u); secret = decodeURIComponent(s ?? '');
    } catch { return null; }
  }
  const client = clients(c.env).get(String(id || ''));
  if (!client || !client.secret || !secret || !safeEqual(String(secret), client.secret)) return null;
  return client;
}

const planOf = (user) => (user && !user.disabled_at && user.plan === 'pro' ? 'pro' : 'free');

app.post('/token', async (c) => {
  const body = await c.req.parseBody().catch(() => ({}));
  const client = authenticateClient(c, body);
  if (!client) return tokenError(c, 'invalid_client', 401);
  if (body.grant_type !== 'authorization_code') return tokenError(c, 'unsupported_grant_type');

  const hash = await sha256(String(body.code || ''));
  // Single use: only the first redemption wins, even under a race.
  const used = await c.env.DB.prepare('UPDATE auth_codes SET used_at = ? WHERE code_hash = ? AND used_at IS NULL').bind(iso(), hash).run();
  const row = await c.env.DB.prepare('SELECT * FROM auth_codes WHERE code_hash = ?').bind(hash).first();
  if (!row || used.meta.changes !== 1 || row.expires_at <= iso() || row.client_id !== client.id || row.redirect_uri !== body.redirect_uri) {
    return tokenError(c, 'invalid_grant');
  }
  if (!body.code_verifier || (await pkceChallenge(String(body.code_verifier))) !== row.code_challenge) return tokenError(c, 'invalid_grant', 400, 'PKCE verification failed.');
  const user = await c.env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(row.user_id).first();
  if (!user || user.disabled_at) return tokenError(c, 'invalid_grant');

  const scope = row.scope.split(' ');
  const claims = {
    sub: user.id, auth_time: row.auth_time, amr: JSON.parse(row.amr), ...(row.nonce ? { nonce: row.nonce } : {}),
    ...(scope.includes('email') ? { email: user.email, email_verified: Boolean(user.email_verified) } : {}),
    ...(scope.includes('profile') ? { name: user.name || undefined, picture: user.picture || undefined } : {}),
    ruyalab_plan: planOf(user),
  };
  const idToken = await signJwt(c.env, claims, { audience: client.id, expiresIn: `${TOKEN_TTL_S}s` });
  const accessToken = await signJwt(c.env, { sub: user.id, scope: row.scope, client_id: client.id }, { audience: `${c.env.ISSUER}/userinfo`, expiresIn: `${TOKEN_TTL_S}s` });
  return c.json({ access_token: accessToken, token_type: 'Bearer', expires_in: TOKEN_TTL_S, id_token: idToken, scope: row.scope }, 200, { 'cache-control': 'no-store', pragma: 'no-cache' });
});

async function userinfo(c) {
  const auth = c.req.header('authorization') || '';
  let p;
  try { p = await verifyJwt(c.env, auth.replace(/^Bearer /, ''), `${c.env.ISSUER}/userinfo`); } catch {
    return c.json({ error: 'invalid_token' }, 401, { 'www-authenticate': 'Bearer error="invalid_token"' });
  }
  const user = await c.env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(p.sub).first();
  if (!user || user.disabled_at) return c.json({ error: 'invalid_token' }, 401);
  const scope = String(p.scope || '').split(' ');
  return c.json({
    sub: user.id,
    ...(scope.includes('email') ? { email: user.email, email_verified: Boolean(user.email_verified) } : {}),
    ...(scope.includes('profile') ? { name: user.name || undefined, picture: user.picture || undefined } : {}),
  }, 200, { 'cache-control': 'no-store' });
}
app.get('/userinfo', userinfo);
app.post('/userinfo', userinfo);

// ---------- entitlements (server to server) ----------

// POST /api/entitlements { subs: [...] } with the product's client credentials (HTTP Basic) ->
// { plans: { <sub>: "pro" | "free" } }. Unknown subjects are left out; disabled accounts count as free.
const MAX_SUBS = 200;
app.post('/api/entitlements', async (c) => {
  const client = authenticateClient(c);
  if (!client) return c.json({ error: 'invalid_client' }, 401, { 'www-authenticate': 'Basic realm="ruyalab"' });
  const body = await c.req.json().catch(() => null);
  const subs = Array.isArray(body?.subs) ? [...new Set(body.subs.map(String))].filter((s) => /^[0-9a-f-]{36}$/.test(s)) : null;
  if (!subs || subs.length > MAX_SUBS) return c.json({ error: 'invalid_request', error_description: `Send subs: up to ${MAX_SUBS} account ids.` }, 400);
  const plans = {};
  if (subs.length) {
    const { results } = await c.env.DB.prepare(`SELECT id, plan, disabled_at FROM users WHERE id IN (${subs.map(() => '?').join(',')})`).bind(...subs).all();
    for (const u of results) plans[u.id] = planOf(u);
  }
  return c.json({ plans }, 200, { 'cache-control': 'no-store' });
});

// ---------- sign in / sign up ----------

const clientName = async (env, req) => (await loadRequest(env, req))?.client.name;

app.get('/', (c) => c.redirect('/account', 302));

app.get('/signin', async (c) => {
  const req = c.req.query('req');
  const session = await getSession(c);
  if (session && req) return continueAfterSignIn(c, req, session);
  return signinPage({ req, client: await clientName(c.env, req), google: googleOn(c.env), info: c.req.query('info') });
});

app.post('/signin', async (c) => {
  if (!sameOrigin(c)) return errorPage('Not allowed', 'This form was sent from another site.', 403);
  const f = await c.req.parseBody();
  const req = String(f.req || '');
  const email = String(f.email || '').trim().toLowerCase();
  const again = async (error) => signinPage({ req, client: await clientName(c.env, req), google: googleOn(c.env), email, error });
  if (await limited(c, 'signin')) return again('Too many attempts. Wait a minute and try again.');
  const user = await c.env.DB.prepare('SELECT * FROM users WHERE email = ?').bind(email).first();
  if (!user || !(await checkPassword(String(f.password || ''), user.password_hash))) {
    return again(user && !user.password_hash ? 'This account signs in with Google. Use "Continue with Google", or reset the password to add one.' : 'Incorrect email or password.');
  }
  if (user.disabled_at) return again('This account is disabled.');
  if (needsRehash(user.password_hash)) await c.env.DB.prepare('UPDATE users SET password_hash = ? WHERE id = ?').bind(await hashPassword(String(f.password)), user.id).run();
  if (!user.email_verified) {
    await sendVerify(c, user, req);
    return checkEmailPage(user.email);
  }
  return continueAfterSignIn(c, req, await startSession(c, user, ['pwd']));
});

async function sendVerify(c, user, req) {
  const token = randomToken();
  await c.env.DB.prepare('INSERT INTO email_tokens (token_hash, user_id, purpose, req_id, expires_at) VALUES (?, ?, ?, ?, ?)')
    .bind(await sha256(token), user.id, 'verify', req || null, later(86400)).run();
  // The product's request may expire before the email is opened; the link still verifies and signs in.
  if (req) await c.env.DB.prepare('UPDATE auth_requests SET expires_at = ? WHERE id = ?').bind(later(86400), req).run();
  const url = `${c.env.ISSUER}/verify?token=${token}`;
  if (mailConfigured(c.env)) await sendVerifyEmail(c.env, user.email, url);
  else console.log(`[dev] verify link for ${user.email}: ${url}`);
}

app.get('/signup', async (c) => {
  const req = c.req.query('req');
  return signupPage({ req, client: await clientName(c.env, req), google: googleOn(c.env) });
});

app.post('/signup', async (c) => {
  if (!sameOrigin(c)) return errorPage('Not allowed', 'This form was sent from another site.', 403);
  const f = await c.req.parseBody();
  const req = String(f.req || '');
  const email = String(f.email || '').trim().toLowerCase();
  const name = String(f.name || '').trim().slice(0, 80);
  const password = String(f.password || '');
  const again = async (error) => signupPage({ req, client: await clientName(c.env, req), google: googleOn(c.env), email, name, error });
  if (await limited(c, 'signup')) return again('Too many attempts. Wait a minute and try again.');
  if (!name) return again('Enter your name.');
  if (!EMAIL.test(email) || email.length > 254) return again('Enter a valid email address.');
  const problem = passwordProblem(password);
  if (problem) return again(problem);
  const existing = await c.env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(email).first();
  if (existing) return again('An account already uses this email. Sign in, or use "Forgot password?" to set a password.');
  const user = { id: newId(), email, name };
  await c.env.DB.prepare(`INSERT INTO users (id, email, email_verified, name, password_hash, created_at, updated_at) VALUES (?, ?, 0, ?, ?, ?, ?)`)
    .bind(user.id, email, name, await hashPassword(password), iso(), iso()).run();
  await sendVerify(c, user, req);
  return checkEmailPage(email);
});

app.get('/verify', async (c) => {
  const hash = await sha256(String(c.req.query('token') || ''));
  const t = await c.env.DB.prepare(`SELECT * FROM email_tokens WHERE token_hash = ? AND purpose = 'verify' AND used_at IS NULL AND expires_at > ?`).bind(hash, iso()).first();
  if (!t) return errorPage('Link expired', 'This confirmation link has expired or was already used. Sign in to get a new one.');
  await c.env.DB.batch([
    c.env.DB.prepare('UPDATE email_tokens SET used_at = ? WHERE token_hash = ?').bind(iso(), hash),
    c.env.DB.prepare('UPDATE users SET email_verified = 1, updated_at = ? WHERE id = ?').bind(iso(), t.user_id),
  ]);
  const user = await c.env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(t.user_id).first();
  return continueAfterSignIn(c, t.req_id, await startSession(c, user, ['pwd']));
});

// ---------- forgot / reset ----------

app.get('/forgot', (c) => forgotPage({ req: c.req.query('req') }));

app.post('/forgot', async (c) => {
  if (!sameOrigin(c)) return errorPage('Not allowed', 'This form was sent from another site.', 403);
  const f = await c.req.parseBody();
  const req = String(f.req || '');
  if (await limited(c, 'forgot')) return forgotPage({ req, error: 'Too many attempts. Wait a minute and try again.' });
  const user = await c.env.DB.prepare('SELECT * FROM users WHERE email = ?').bind(String(f.email || '').trim().toLowerCase()).first();
  if (user && !user.disabled_at) {
    const token = randomToken();
    await c.env.DB.prepare('INSERT INTO email_tokens (token_hash, user_id, purpose, req_id, expires_at) VALUES (?, ?, ?, ?, ?)')
      .bind(await sha256(token), user.id, 'reset', req || null, later(3600)).run();
    const url = `${c.env.ISSUER}/reset?token=${token}`;
    if (mailConfigured(c.env)) await sendResetEmail(c.env, user.email, url);
    else console.log(`[dev] reset link for ${user.email}: ${url}`);
  }
  return forgotPage({ req, sent: true }); // same answer whether or not the account exists
});

app.get('/reset', (c) => resetPage({ token: c.req.query('token') || '' }));

app.post('/reset', async (c) => {
  if (!sameOrigin(c)) return errorPage('Not allowed', 'This form was sent from another site.', 403);
  const f = await c.req.parseBody();
  const token = String(f.token || '');
  const problem = passwordProblem(String(f.password || ''));
  if (problem) return resetPage({ token, error: problem });
  const hash = await sha256(token);
  const claimed = await c.env.DB.prepare(`UPDATE email_tokens SET used_at = ? WHERE token_hash = ? AND purpose = 'reset' AND used_at IS NULL AND expires_at > ?`)
    .bind(iso(), hash, iso()).run();
  if (claimed.meta.changes !== 1) return errorPage('Link expired', 'This reset link has expired or was already used. Ask for a new one.');
  const t = await c.env.DB.prepare('SELECT * FROM email_tokens WHERE token_hash = ?').bind(hash).first();
  // A reset proves the email address, and ends every other session.
  await c.env.DB.batch([
    c.env.DB.prepare('UPDATE users SET password_hash = ?, email_verified = 1, updated_at = ? WHERE id = ?').bind(await hashPassword(String(f.password)), iso(), t.user_id),
    c.env.DB.prepare('UPDATE sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL').bind(iso(), t.user_id),
  ]);
  const user = await c.env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(t.user_id).first();
  return continueAfterSignIn(c, t.req_id, await startSession(c, user, ['pwd']));
});

// ---------- Google ----------

app.get('/google/start', async (c) => {
  if (!googleOn(c.env)) return errorPage('Not available', 'Google sign-in is not set up yet.');
  const state = randomToken(); const nonce = randomToken(); const verifier = randomToken(48);
  const req = c.req.query('req');
  await c.env.DB.prepare('INSERT INTO google_states (state, nonce, verifier, req_id, expires_at) VALUES (?, ?, ?, ?, ?)')
    .bind(state, nonce, verifier, req && /^[0-9a-f-]{36}$/.test(req) ? req : null, later(600)).run();
  const u = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  u.search = new URLSearchParams({
    client_id: c.env.GOOGLE_CLIENT_ID, redirect_uri: `${c.env.ISSUER}/google/callback`, response_type: 'code', scope: 'openid email profile',
    state, nonce, code_challenge: await pkceChallenge(verifier), code_challenge_method: 'S256', prompt: 'select_account',
  }).toString();
  return c.redirect(u.toString(), 302);
});

app.get('/google/callback', async (c) => {
  const { state, code, error } = c.req.query();
  const s = state ? await c.env.DB.prepare('SELECT * FROM google_states WHERE state = ? AND expires_at > ?').bind(state, iso()).first() : null;
  if (s) await c.env.DB.prepare('DELETE FROM google_states WHERE state = ?').bind(state).run();
  if (!s) return errorPage('Sign-in expired', 'Please start again.');
  if (error || !code) return c.redirect(`/signin${s.req_id ? `?req=${s.req_id}` : ''}`, 302);
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ code, client_id: c.env.GOOGLE_CLIENT_ID, client_secret: c.env.GOOGLE_CLIENT_SECRET, redirect_uri: `${c.env.ISSUER}/google/callback`, grant_type: 'authorization_code', code_verifier: s.verifier }),
  });
  const tok = await res.json().catch(() => ({}));
  let p;
  try {
    ({ payload: p } = await jwtVerify(String(tok.id_token || ''), GOOGLE_JWKS, { issuer: ['https://accounts.google.com', 'accounts.google.com'], audience: c.env.GOOGLE_CLIENT_ID }));
  } catch { return errorPage('Google sign-in failed', 'Google did not confirm the sign-in. Please try again.'); }
  if (p.nonce !== s.nonce) return errorPage('Google sign-in failed', 'Please try again.');
  if (!p.email || !p.email_verified) return errorPage('Email not verified', 'Your Google account email is not verified.');
  const email = String(p.email).toLowerCase();
  let user = await c.env.DB.prepare('SELECT * FROM users WHERE google_sub = ?').bind(p.sub).first()
    || await c.env.DB.prepare('SELECT * FROM users WHERE email = ?').bind(email).first();
  if (user) {
    if (user.disabled_at) return errorPage('Account disabled', 'This account is disabled.');
    // Google verified the address, so linking by email is safe; it also confirms an unverified sign-up.
    await c.env.DB.prepare('UPDATE users SET google_sub = ?, email_verified = 1, picture = COALESCE(picture, ?), name = CASE WHEN name = \'\' THEN ? ELSE name END, updated_at = ? WHERE id = ?')
      .bind(p.sub, p.picture || null, p.name || '', iso(), user.id).run();
  } else {
    user = { id: newId(), email };
    await c.env.DB.prepare('INSERT INTO users (id, email, email_verified, name, picture, google_sub, created_at, updated_at) VALUES (?, ?, 1, ?, ?, ?, ?, ?)')
      .bind(user.id, email, p.name || '', p.picture || null, p.sub, iso(), iso()).run();
  }
  return continueAfterSignIn(c, s.req_id, await startSession(c, user, ['google']));
});

// ---------- account ----------

const appsFor = (env) => [...clients(env).values()].filter((x) => x.home).map((x) => ({ name: x.name, url: x.home }));

async function accountView(c, extra = {}) {
  const s = await getSession(c);
  if (!s) return c.redirect('/signin', 302);
  const user = await c.env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(s.user_id).first();
  return accountPage({ user, apps: appsFor(c.env), ...extra });
}

app.get('/account', (c) => accountView(c));

app.post('/account/name', async (c) => {
  if (!sameOrigin(c)) return errorPage('Not allowed', 'This form was sent from another site.', 403);
  const s = await getSession(c);
  if (!s) return c.redirect('/signin', 302);
  const name = String((await c.req.parseBody()).name || '').trim().slice(0, 80);
  if (!name) return accountView(c, { error: 'Enter your name.' });
  await c.env.DB.prepare('UPDATE users SET name = ?, updated_at = ? WHERE id = ?').bind(name, iso(), s.user_id).run();
  return accountView(c, { info: 'Name saved.' });
});

app.post('/account/password', async (c) => {
  if (!sameOrigin(c)) return errorPage('Not allowed', 'This form was sent from another site.', 403);
  const s = await getSession(c);
  if (!s) return c.redirect('/signin', 302);
  const f = await c.req.parseBody();
  const user = await c.env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(s.user_id).first();
  if (user.password_hash && !(await checkPassword(String(f.current || ''), user.password_hash))) return accountView(c, { error: 'Your current password is not right.' });
  const problem = passwordProblem(String(f.password || ''));
  if (problem) return accountView(c, { error: problem });
  // Other devices sign in again with the new password; this one stays signed in.
  await c.env.DB.batch([
    c.env.DB.prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?').bind(await hashPassword(String(f.password)), iso(), user.id),
    c.env.DB.prepare('UPDATE sessions SET revoked_at = ? WHERE user_id = ? AND id_hash <> ? AND revoked_at IS NULL').bind(iso(), user.id, s.id_hash),
  ]);
  return accountView(c, { info: 'Password saved. Other devices were signed out.' });
});

app.post('/account/signout-all', async (c) => {
  if (!sameOrigin(c)) return errorPage('Not allowed', 'This form was sent from another site.', 403);
  const s = await getSession(c);
  if (s) await c.env.DB.prepare('UPDATE sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL').bind(iso(), s.user_id).run();
  deleteCookie(c, cookieName(c.env), { path: '/', secure: secure(c.env) });
  return c.redirect('/signin?info=' + encodeURIComponent('Signed out on every device.'), 302);
});

// ---------- logout (RP-initiated) ----------

async function logout(c) {
  const raw = getCookie(c, cookieName(c.env));
  if (raw) await c.env.DB.prepare('UPDATE sessions SET revoked_at = ? WHERE id_hash = ?').bind(iso(), await sha256(raw)).run();
  deleteCookie(c, cookieName(c.env), { path: '/', secure: secure(c.env) });
  const q = c.req.method === 'GET' ? c.req.query() : {};
  const client = clients(c.env).get(q.client_id || '');
  if (client && q.post_logout_redirect_uri && (client.post_logout_redirect_uris || []).includes(q.post_logout_redirect_uri)) {
    return c.redirect(redirectWith(q.post_logout_redirect_uri, { state: q.state }), 302);
  }
  return c.redirect('/signin?info=' + encodeURIComponent('You are signed out of Ruya Lab.'), 302);
}
app.get('/logout', logout);
app.post('/logout', async (c) => (sameOrigin(c) ? logout(c) : errorPage('Not allowed', 'This form was sent from another site.', 403)));

app.notFound(() => errorPage('Not found', 'This page does not exist.', 404));
app.onError((err) => {
  console.error('accounts.error', err?.message);
  return errorPage('Something went wrong', 'Please try again in a moment.', 500);
});

export default {
  fetch: app.fetch,
  // Daily: drop expired requests, codes, states, tokens and sessions.
  async scheduled(_e, env) {
    const t = iso();
    await env.DB.batch([
      env.DB.prepare('DELETE FROM auth_requests WHERE expires_at < ?').bind(t),
      env.DB.prepare('DELETE FROM auth_codes WHERE expires_at < ?').bind(t),
      env.DB.prepare('DELETE FROM google_states WHERE expires_at < ?').bind(t),
      env.DB.prepare('DELETE FROM email_tokens WHERE expires_at < ?').bind(t),
      env.DB.prepare('DELETE FROM sessions WHERE expires_at < ? OR revoked_at IS NOT NULL').bind(t),
    ]);
  },
};
