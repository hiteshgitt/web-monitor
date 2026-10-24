// Super admin sign-in (/ruyashield): password, then a 6-digit authenticator code.
// First time: the one-time setup link sets the password, then the authenticator is linked and confirmed.
import { Hono } from 'hono';
import {
  auditStatement, readChallenge, requireAdmin, serializeAdmin, sha256Hex, signAdminToken, signChallenge,
} from '../lib/adminAuth.js';
import { checkPassword, hashPassword, needsRehash } from '../lib/auth.js';
import { newTotpSecret, totpUri, verifyTotp } from '../lib/totp.js';
import { ApiError, nowIso } from '../lib/util.js';

const adminAuth = new Hono();

const MIN_ADMIN_PASSWORD = 12;
const WRONG = 'Incorrect email or password';

// Next step after the password: confirm a new authenticator, or enter a code from the linked one
async function nextStep(c, admin) {
  if (admin.totp_enabled) return { step: 'code', challenge: await signChallenge(c.env, admin, 'code') };
  // A fresh secret each time until it is confirmed, so an abandoned setup can't be reused
  const secret = newTotpSecret();
  await c.env.DB.prepare('UPDATE admins SET totp_secret = ?, updated_at = ? WHERE id = ?').bind(secret, nowIso(), admin.id).run();
  return {
    step: 'setup',
    challenge: await signChallenge(c.env, admin, 'setup'),
    secret,
    otpauthUrl: totpUri(secret, admin.email),
  };
}

adminAuth.post('/login', async (c) => {
  const { email, password } = await c.req.json().catch(() => ({}));
  const admin = await c.env.DB.prepare('SELECT * FROM admins WHERE email = ?').bind(String(email || '').trim().toLowerCase()).first();
  if (!admin || !admin.password_hash) {
    // Same work as a real check, so response time doesn't reveal which emails are admins
    await hashPassword(String(password || ''));
    throw new ApiError(401, WRONG);
  }
  if (!(await checkPassword(String(password || ''), admin.password_hash))) throw new ApiError(401, WRONG);
  if (needsRehash(admin.password_hash)) {
    await c.env.DB.prepare('UPDATE admins SET password_hash = ? WHERE id = ?').bind(await hashPassword(String(password)), admin.id).run();
  }
  return c.json(await nextStep(c, admin));
});

// One-time setup link: choose the password (then the authenticator step follows)
adminAuth.post('/setup', async (c) => {
  const { token, password, name } = await c.req.json().catch(() => ({}));
  if (!token) throw new ApiError(400, 'This setup link is incomplete');
  if (String(password || '').length < MIN_ADMIN_PASSWORD) {
    throw new ApiError(400, `Use at least ${MIN_ADMIN_PASSWORD} characters for the admin password`);
  }
  const admin = await c.env.DB.prepare('SELECT * FROM admins WHERE setup_token_hash = ?').bind(await sha256Hex(String(token))).first();
  if (!admin || !admin.setup_expires_at || new Date(admin.setup_expires_at) < new Date()) {
    throw new ApiError(400, 'This setup link has expired or was already used. Ask for a new one.');
  }
  const now = nowIso();
  const passwordHash = await hashPassword(String(password));
  const displayName = String(name || '').trim().slice(0, 80) || admin.name;
  // The link works once; a reset also unlinks the old authenticator
  await c.env.DB.batch([
    c.env.DB.prepare(`UPDATE admins SET password_hash = ?, name = ?, setup_token_hash = NULL, setup_expires_at = NULL,
        totp_enabled = 0, totp_secret = NULL, totp_last_step = NULL, updated_at = ? WHERE id = ?`)
      .bind(passwordHash, displayName, now, admin.id),
    auditStatement(c.env.DB, admin, 'password_set'),
  ]);
  return c.json(await nextStep(c, { ...admin, totp_enabled: 0 }));
});

adminAuth.post('/verify', async (c) => {
  const { challenge, code } = await c.req.json().catch(() => ({}));
  const claims = await readChallenge(c.env, challenge);
  const admin = await c.env.DB.prepare('SELECT * FROM admins WHERE id = ?').bind(claims.sub).first();
  if (!admin || !admin.totp_secret || (claims.purpose === 'code' && !admin.totp_enabled)) {
    throw new ApiError(401, 'Start again with your password.', { code: 'CHALLENGE_EXPIRED' });
  }
  const step = await verifyTotp(admin.totp_secret, code, admin.totp_last_step ?? -1);
  if (step === null) throw new ApiError(401, 'That code didn’t match. Enter the current 6-digit code from your authenticator app.');

  const now = nowIso();
  const enabling = claims.purpose === 'setup';
  await c.env.DB.batch([
    c.env.DB.prepare('UPDATE admins SET totp_enabled = 1, totp_last_step = ?, last_login_at = ?, updated_at = ? WHERE id = ?')
      .bind(step, now, now, admin.id),
    auditStatement(c.env.DB, admin, enabling ? 'two_step_enabled' : 'sign_in', {
      detail: c.req.header('CF-Connecting-IP') ? `from ${c.req.header('CF-Connecting-IP')}` : '',
    }),
  ]);
  return c.json({ token: await signAdminToken(c.env, admin), admin: serializeAdmin({ ...admin, last_login_at: now }) });
});

adminAuth.get('/me', requireAdmin, (c) => c.json({ admin: serializeAdmin(c.get('admin')) }));

export default adminAuth;
