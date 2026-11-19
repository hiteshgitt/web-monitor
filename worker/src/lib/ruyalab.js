// "Continue with Ruya Lab": WebMonitor as an OpenID Connect client of accounts.ruyalab.com.
// Code flow with PKCE; state, nonce and verifier ride in a short-lived signed cookie. The ID token is checked
// against the issuer's keys (signature, issuer, audience, nonce, expiry) and only a verified email links accounts.
import { createLocalJWKSet, jwtVerify } from 'jose';
import { sign, verify } from 'hono/jwt';

export const ruyaLabConfigured = (env) => Boolean(env.RUYALAB_ISSUER && env.RUYALAB_CLIENT_ID && env.RUYALAB_CLIENT_SECRET);

const b64u = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const random = (n = 32) => b64u(crypto.getRandomValues(new Uint8Array(n)));
const challenge = async (v) => b64u(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(v)));

/** Calls the accounts service: through the service binding when present (same Cloudflare account), else HTTPS. */
const call = (env, path, init) => (env.ACCOUNTS ? env.ACCOUNTS.fetch(`${env.RUYALAB_ISSUER}${path}`, init) : fetch(`${env.RUYALAB_ISSUER}${path}`, init));

export const redirectUri = (env, origin) => `${env.APP_URL || origin}/api/auth/ruyalab/callback`;

/** Returns the authorize URL and the cookie value that must come back with the callback. */
export async function startLogin(env, origin, screen) {
  const state = random(); const nonce = random(); const verifier = random(48);
  const cookie = await sign({ state, nonce, verifier, exp: Math.floor(Date.now() / 1000) + 600 }, env.JWT_SECRET, 'HS256');
  const u = new URL(`${env.RUYALAB_ISSUER}/authorize`);
  u.search = new URLSearchParams({
    response_type: 'code', client_id: env.RUYALAB_CLIENT_ID, redirect_uri: redirectUri(env, origin), scope: 'openid email profile',
    state, nonce, code_challenge: await challenge(verifier), code_challenge_method: 'S256', ...(screen === 'signup' ? { screen: 'signup' } : {}),
  }).toString();
  return { url: u.toString(), cookie };
}

/** Exchanges the code and returns the verified identity { sub, email, emailVerified, name, picture }. */
export async function finishLogin(env, origin, { code, state, iss }, cookie) {
  let saved;
  try { saved = await verify(String(cookie || ''), env.JWT_SECRET, 'HS256'); } catch { throw new Error('expired'); }
  if (!state || state !== saved.state) throw new Error('state');
  if (iss && iss !== env.RUYALAB_ISSUER) throw new Error('issuer');
  const res = await call(env, '/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', authorization: `Basic ${btoa(`${env.RUYALAB_CLIENT_ID}:${env.RUYALAB_CLIENT_SECRET}`)}` },
    body: new URLSearchParams({ grant_type: 'authorization_code', code: String(code || ''), redirect_uri: redirectUri(env, origin), code_verifier: saved.verifier }),
  });
  const tok = await res.json().catch(() => ({}));
  if (!res.ok || !tok.id_token) throw new Error('token');
  const keys = await (await call(env, '/jwks.json', {})).json();
  const { payload } = await jwtVerify(tok.id_token, createLocalJWKSet(keys), { issuer: env.RUYALAB_ISSUER, audience: env.RUYALAB_CLIENT_ID, algorithms: ['RS256'] });
  if (payload.nonce !== saved.nonce) throw new Error('nonce');
  return { sub: String(payload.sub), email: String(payload.email || '').toLowerCase(), emailVerified: payload.email_verified === true, name: payload.name || '', picture: payload.picture || null,
    plan: payload.ruyalab_plan === 'pro' || payload.ruyalab_plan === 'free' ? payload.ruyalab_plan : null };
}
