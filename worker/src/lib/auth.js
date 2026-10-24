// Passwords (PBKDF2 via WebCrypto), sign-in tokens (JWT HS256) and route guards
import { sign, verify } from 'hono/jwt';
import { ApiError } from './util.js';

// The Workers free plan allows 10 ms of CPU per request; 20k rounds is ~6-7 ms.
// The round count is stored with each hash, so it can be raised later (and old hashes upgraded on sign-in).
export const PBKDF2_ITERATIONS = 20000;

const encoder = new TextEncoder();
const toBase64 = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes)));
const fromBase64 = (text) => Uint8Array.from(atob(text), (c) => c.charCodeAt(0));

async function pbkdf2(password, salt, iterations) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
  return crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, key, 256);
}

export async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await pbkdf2(password, salt, PBKDF2_ITERATIONS);
  return `pbkdf2$${PBKDF2_ITERATIONS}$${toBase64(salt)}$${toBase64(hash)}`;
}

export async function checkPassword(password, stored) {
  if (!stored) return false;
  const [scheme, iterations, salt, expected] = stored.split('$');
  if (scheme !== 'pbkdf2') return false;
  const actual = new Uint8Array(await pbkdf2(password, fromBase64(salt), Number(iterations)));
  const wanted = fromBase64(expected);
  if (actual.length !== wanted.length) return false;
  // Constant-time comparison
  let diff = 0;
  for (let i = 0; i < actual.length; i += 1) diff |= actual[i] ^ wanted[i];
  return diff === 0;
}

export const needsRehash = (stored) => Number(stored?.split('$')[1]) < PBKDF2_ITERATIONS;

export async function signToken(env, userId) {
  const days = Number(env.JWT_EXPIRES_DAYS) || 30;
  return sign({ sub: userId, exp: Math.floor(Date.now() / 1000) + days * 24 * 60 * 60 }, env.JWT_SECRET, 'HS256');
}

// Sets c.var.user for signed-in requests
export async function requireAuth(c, next) {
  const header = c.req.header('Authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) throw new ApiError(401, 'Please sign in', { code: 'AUTH_REQUIRED' });
  let payload;
  try {
    payload = await verify(token, c.env.JWT_SECRET, 'HS256');
  } catch {
    throw new ApiError(401, 'Your session has expired, please sign in again', { code: 'AUTH_REQUIRED' });
  }
  const user = await c.env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(payload.sub).first();
  if (!user) throw new ApiError(401, 'Account not found', { code: 'AUTH_REQUIRED' });
  assertActive(user);
  c.set('user', user);
  await next();
}

export function assertActive(user) {
  if (user.status === 'suspended') {
    throw new ApiError(403, 'This account is suspended. Contact hiteshgml@gmail.com.', { code: 'ACCOUNT_SUSPENDED' });
  }
}

export const isPro = (user) => user?.plan === 'pro' || user?.role === 'admin';

export async function requirePro(c, next) {
  if (!isPro(c.get('user'))) {
    throw new ApiError(402, 'The Advanced view is part of the Pro plan', { code: 'PRO_REQUIRED' });
  }
  await next();
}

// Loads the :id website if it belongs to the signed-in customer (sets c.var.website)
export async function loadOwnedWebsite(c, next) {
  const website = await c.env.DB
    .prepare('SELECT * FROM websites WHERE id = ? AND owner_id = ?')
    .bind(c.req.param('id'), c.get('user').id)
    .first();
  if (!website) throw new ApiError(404, 'Website not found');
  c.set('website', website);
  await next();
}

// Per-IP limit on sign-in attempts (Cloudflare rate limiting binding)
export async function authRateLimit(c, next) {
  if (c.req.method !== 'GET' && c.env.AUTH_LIMITER) {
    const ip = c.req.header('CF-Connecting-IP') || 'unknown';
    const { success } = await c.env.AUTH_LIMITER.limit({ key: ip });
    if (!success) throw new ApiError(429, 'Too many sign-in attempts. Please wait a minute and try again.');
  }
  await next();
}
