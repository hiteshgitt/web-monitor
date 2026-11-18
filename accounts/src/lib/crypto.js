// Passwords (PBKDF2 via WebCrypto), random tokens, hashes and the ID-token signing key.
import { exportJWK, importJWK, SignJWT, jwtVerify } from 'jose';

// Workers free plan: 10 ms CPU per request; 20k rounds is ~6-7 ms. Stored with each hash so it can be raised later.
export const PBKDF2_ITERATIONS = 20000;
const enc = new TextEncoder();
const b64 = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes)));
const unb64 = (text) => Uint8Array.from(atob(text), (c) => c.charCodeAt(0));

async function pbkdf2(password, salt, iterations) {
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  return crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, key, 256);
}

export async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return `pbkdf2$${PBKDF2_ITERATIONS}$${b64(salt)}$${b64(await pbkdf2(password, salt, PBKDF2_ITERATIONS))}`;
}

export async function checkPassword(password, stored) {
  if (!stored) return false;
  const [scheme, iterations, salt, expected] = stored.split('$');
  if (scheme !== 'pbkdf2') return false;
  const a = new Uint8Array(await pbkdf2(password, unb64(salt), Number(iterations)));
  const b = unb64(expected);
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a[i] ^ b[i];
  return diff === 0;
}

export const needsRehash = (stored) => Number(stored?.split('$')[1]) < PBKDF2_ITERATIONS;

/** Problems with a new password, or null. Same rule as RuyaShield: 10+ characters, not only one kind. */
export function passwordProblem(pw) {
  if (typeof pw !== 'string' || pw.length < 10) return 'Use at least 10 characters.';
  if (pw.length > 200) return 'Use at most 200 characters.';
  if (/^\d+$/.test(pw) || /^[a-z]+$/i.test(pw)) return 'Mix letters with numbers or symbols.';
  return null;
}

export function randomToken(bytes = 32) {
  const a = crypto.getRandomValues(new Uint8Array(bytes));
  return b64(a).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function sha256(text) {
  const d = await crypto.subtle.digest('SHA-256', enc.encode(text));
  return [...new Uint8Array(d)].map((x) => x.toString(16).padStart(2, '0')).join('');
}

/** base64url(SHA-256(verifier)): the PKCE S256 challenge. */
export async function pkceChallenge(verifier) {
  const d = await crypto.subtle.digest('SHA-256', enc.encode(verifier));
  return b64(d).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Constant-time string comparison. */
export function safeEqual(a, b) {
  const x = enc.encode(String(a)); const y = enc.encode(String(b));
  if (x.length !== y.length) return false;
  let diff = 0;
  for (let i = 0; i < x.length; i += 1) diff |= x[i] ^ y[i];
  return diff === 0;
}

// ---------- signing key (RS256; private JWK in the OIDC_PRIVATE_JWK secret) ----------

let keyCache = null;
async function keys(env) {
  if (keyCache && keyCache.raw === env.OIDC_PRIVATE_JWK) return keyCache;
  if (!env.OIDC_PRIVATE_JWK) throw new Error('OIDC_PRIVATE_JWK is not set');
  const jwk = JSON.parse(env.OIDC_PRIVATE_JWK);
  const privateKey = await importJWK(jwk, 'RS256');
  const { d, p, q, dp, dq, qi, ...pub } = jwk; // eslint-disable-line no-unused-vars
  const publicKey = await importJWK(pub, 'RS256');
  keyCache = { raw: env.OIDC_PRIVATE_JWK, kid: jwk.kid, privateKey, publicKey, publicJwk: { ...pub, use: 'sig', alg: 'RS256' } };
  return keyCache;
}

export async function jwks(env) {
  return { keys: [(await keys(env)).publicJwk] };
}

export async function signJwt(env, claims, { audience, expiresIn }) {
  const k = await keys(env);
  return new SignJWT(claims).setProtectedHeader({ alg: 'RS256', kid: k.kid, typ: 'JWT' })
    .setIssuer(env.ISSUER).setAudience(audience).setIssuedAt().setExpirationTime(expiresIn).sign(k.privateKey);
}

export async function verifyJwt(env, token, audience) {
  const k = await keys(env);
  return (await jwtVerify(token, k.publicKey, { issuer: env.ISSUER, audience, algorithms: ['RS256'] })).payload;
}

export { exportJWK };
