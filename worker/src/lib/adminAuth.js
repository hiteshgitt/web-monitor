// Super admin sessions, kept apart from customer sessions: admin tokens carry their own audience and
// expire after ADMIN_SESSION_HOURS. A customer token never passes requireAdmin (no admin audience), and an
// admin token never passes requireAuth (its subject isn't a customer).
import { SignJWT, jwtVerify } from 'jose';
import { ApiError, newId, nowIso } from './util.js';

const ADMIN_AUDIENCE = 'webmonitor-admin';
// Between the password and the 6-digit code
const CHALLENGE_AUDIENCE = 'webmonitor-admin-challenge';
const CHALLENGE_MINUTES = 10;

const secretKey = (env) => new TextEncoder().encode(env.JWT_SECRET);

export async function signAdminToken(env, admin) {
  const hours = Number(env.ADMIN_SESSION_HOURS) || 8;
  return new SignJWT({})
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(admin.id)
    .setAudience(ADMIN_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${hours}h`)
    .sign(secretKey(env));
}

// purpose: 'code' (2-step code of an enabled authenticator) or 'setup' (confirming a new one)
export async function signChallenge(env, admin, purpose) {
  return new SignJWT({ purpose })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(admin.id)
    .setAudience(CHALLENGE_AUDIENCE)
    .setExpirationTime(`${CHALLENGE_MINUTES}m`)
    .sign(secretKey(env));
}

export async function readChallenge(env, token) {
  try {
    const { payload } = await jwtVerify(String(token || ''), secretKey(env), { audience: CHALLENGE_AUDIENCE });
    return payload;
  } catch {
    throw new ApiError(401, 'This sign-in step expired. Start again with your password.', { code: 'CHALLENGE_EXPIRED' });
  }
}

// Sets c.var.admin
export async function requireAdmin(c, next) {
  const header = c.req.header('Authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  let payload;
  try {
    ({ payload } = await jwtVerify(token, secretKey(c.env), { audience: ADMIN_AUDIENCE }));
  } catch {
    throw new ApiError(401, 'Please sign in to the admin area', { code: 'ADMIN_AUTH_REQUIRED' });
  }
  const admin = await c.env.DB.prepare('SELECT * FROM admins WHERE id = ? AND totp_enabled = 1').bind(payload.sub).first();
  if (!admin) throw new ApiError(401, 'Please sign in to the admin area', { code: 'ADMIN_AUTH_REQUIRED' });
  c.set('admin', admin);
  await next();
}

export const serializeAdmin = (row) => ({
  _id: row.id,
  email: row.email,
  name: row.name,
  lastLoginAt: row.last_login_at || undefined,
});

export const sha256Hex = async (text) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)))]
  .map((b) => b.toString(16).padStart(2, '0')).join('');

// Statement for the admin activity log
export const auditStatement = (db, admin, action, { targetId = null, targetEmail = null, detail = '' } = {}) => db.prepare(
  `INSERT INTO admin_audit (id, admin_id, admin_email, action, target_id, target_email, detail, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
).bind(newId(), admin.id, admin.email, action, targetId, targetEmail, String(detail).slice(0, 500), nowIso());
