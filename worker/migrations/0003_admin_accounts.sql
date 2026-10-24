-- Super admins become their own accounts, separate from customers.
-- Created only with `npm run admin:create` (never by sign-up or Google sign-in); signing in at /ruyashield
-- needs the password and a 6-digit authenticator code.

CREATE TABLE admins (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL DEFAULT '',
  password_hash TEXT,                    -- NULL until the admin opens their setup link
  totp_secret TEXT,                      -- base32; confirmed once totp_enabled = 1
  totp_enabled INTEGER NOT NULL DEFAULT 0,
  totp_last_step INTEGER,                -- last accepted code's time step: a code works only once
  setup_token_hash TEXT,                 -- SHA-256 of the one-time setup link token
  setup_expires_at TEXT,
  notify_prefs TEXT,
  last_login_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Who did what in the admin area
CREATE TABLE admin_audit (
  id TEXT PRIMARY KEY,
  admin_id TEXT NOT NULL,
  admin_email TEXT NOT NULL,
  action TEXT NOT NULL,
  target_id TEXT,
  target_email TEXT,
  detail TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);
CREATE INDEX idx_admin_audit_created ON admin_audit (created_at);

-- Customer accounts are customers only from now on; the former admin login keeps Pro for their own sites
UPDATE users SET plan = 'pro' WHERE role = 'admin';
UPDATE users SET role = 'user' WHERE role = 'admin';
-- Admin alerts (sign-ups, Pro requests) were addressed to that customer login; admins get their own from now on
DELETE FROM notifications WHERE type IN ('signup', 'pro_request');
