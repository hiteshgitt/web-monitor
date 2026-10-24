import { Hono } from 'hono';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { notifyAdmins } from '../lib/alerts.js';
import { assertActive, checkPassword, hashPassword, needsRehash, requireAuth, signToken } from '../lib/auth.js';
import { serializeUser } from '../lib/serialize.js';
import { ApiError, newId, nowIso } from '../lib/util.js';

const auth = new Hono();

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;
const GOOGLE_JWKS = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));

const announceSignup = (c, user) => notifyAdmins(c.env.DB, {
  type: 'signup', title: 'New sign-up', body: `${user.name ? `${user.name} · ` : ''}${user.email}`,
}, user.id).catch(() => {});

const adminEmails = (env) => (env.ADMIN_EMAILS || '')
  .split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);

// Shared post-sign-in steps: admin role from ADMIN_EMAILS, last login time, new token
async function finishSignIn(c, user) {
  assertActive(user);
  const now = nowIso();
  const role = adminEmails(c.env).includes(user.email) ? 'admin' : user.role;
  await c.env.DB.prepare('UPDATE users SET role = ?, last_login_at = ?, updated_at = ? WHERE id = ?')
    .bind(role, now, now, user.id).run();
  const fresh = { ...user, role, last_login_at: now, updated_at: now };
  return { token: await signToken(c.env, user.id), user: serializeUser(fresh) };
}

auth.post('/register', async (c) => {
  const { email, password, name } = await c.req.json().catch(() => ({}));
  const normalizedEmail = String(email || '').trim().toLowerCase();
  if (!EMAIL_PATTERN.test(normalizedEmail)) throw new ApiError(400, 'Enter a valid email address');
  if (!password || String(password).length < MIN_PASSWORD_LENGTH) {
    throw new ApiError(400, `Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
  }
  const existing = await c.env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(normalizedEmail).first();
  if (existing) throw new ApiError(409, 'An account with this email already exists. Sign in instead.');

  const now = nowIso();
  const user = {
    id: newId(), email: normalizedEmail, name: String(name || '').trim(), avatar_url: null,
    password_hash: await hashPassword(String(password)), google_id: null, plan: 'free', role: 'user',
    upgrade_requested_at: null, last_login_at: null, created_at: now, updated_at: now,
  };
  await c.env.DB.prepare(`INSERT INTO users (id, email, name, password_hash, plan, role, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
    .bind(user.id, user.email, user.name, user.password_hash, user.plan, user.role, now, now).run();
  const result = await finishSignIn(c, user);
  await announceSignup(c, user);
  return c.json(result, 201);
});

auth.post('/login', async (c) => {
  const { email, password } = await c.req.json().catch(() => ({}));
  const user = await c.env.DB.prepare('SELECT * FROM users WHERE email = ?')
    .bind(String(email || '').trim().toLowerCase()).first();
  // Same message for unknown email and wrong password, so accounts can't be probed
  if (!user || !(await checkPassword(String(password || ''), user.password_hash))) {
    throw new ApiError(401, 'Incorrect email or password');
  }
  if (needsRehash(user.password_hash)) {
    await c.env.DB.prepare('UPDATE users SET password_hash = ? WHERE id = ?')
      .bind(await hashPassword(String(password)), user.id).run();
  }
  return c.json(await finishSignIn(c, user));
});

auth.post('/google', async (c) => {
  const clientIds = (c.env.GOOGLE_CLIENT_ID || '').split(',').map((id) => id.trim()).filter(Boolean);
  if (clientIds.length === 0) throw new ApiError(503, 'Google sign-in is not configured');
  const { credential } = await c.req.json().catch(() => ({}));

  let payload;
  try {
    ({ payload } = await jwtVerify(String(credential || ''), GOOGLE_JWKS, {
      issuer: ['https://accounts.google.com', 'accounts.google.com'],
      audience: clientIds,
    }));
  } catch {
    throw new ApiError(401, 'Google sign-in failed, please try again');
  }
  if (!payload.email || !payload.email_verified) throw new ApiError(401, 'Your Google account email is not verified');

  const email = payload.email.toLowerCase();
  const now = nowIso();
  let user = await c.env.DB.prepare('SELECT * FROM users WHERE google_id = ? OR email = ?').bind(payload.sub, email).first();
  const isNew = !user;
  if (!user) {
    user = {
      id: newId(), email, name: payload.name || '', avatar_url: payload.picture || null, password_hash: null,
      google_id: payload.sub, plan: 'free', role: 'user', upgrade_requested_at: null, last_login_at: null,
      created_at: now, updated_at: now,
    };
    await c.env.DB.prepare(`INSERT INTO users (id, email, name, avatar_url, google_id, plan, role, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(user.id, email, user.name, user.avatar_url, user.google_id, 'free', 'user', now, now).run();
  } else {
    user = { ...user, google_id: payload.sub, avatar_url: payload.picture || user.avatar_url, name: user.name || payload.name || '' };
    await c.env.DB.prepare('UPDATE users SET google_id = ?, avatar_url = ?, name = ? WHERE id = ?')
      .bind(user.google_id, user.avatar_url, user.name, user.id).run();
  }
  const result = await finishSignIn(c, user);
  if (isNew) await announceSignup(c, user);
  return c.json(result);
});

auth.get('/me', requireAuth, (c) => c.json({ user: serializeUser(c.get('user')) }));

// Manual Pro for now: the customer asks, an admin switches the plan
auth.post('/upgrade-request', requireAuth, async (c) => {
  const user = c.get('user');
  const isPro = user.plan === 'pro' || user.role === 'admin';
  if (!isPro && !user.upgrade_requested_at) {
    const now = nowIso();
    await c.env.DB.prepare('UPDATE users SET upgrade_requested_at = ?, updated_at = ? WHERE id = ?').bind(now, now, user.id).run();
    await notifyAdmins(c.env.DB, {
      type: 'pro_request', title: 'New Pro request', body: `${user.name || user.email} asked for the Pro plan.`,
    }).catch(() => {});
    return c.json({ user: serializeUser({ ...user, upgrade_requested_at: now, updated_at: now }) });
  }
  return c.json({ user: serializeUser(user) });
});

export default auth;
