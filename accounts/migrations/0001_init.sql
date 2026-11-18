-- Ruya Lab accounts: one sign-in for WebMonitor, RuyaShield and future products (OpenID Connect provider).

CREATE TABLE users (
  id             TEXT PRIMARY KEY,
  email          TEXT NOT NULL UNIQUE,              -- lower-case
  email_verified INTEGER NOT NULL DEFAULT 0,
  name           TEXT NOT NULL DEFAULT '',
  picture        TEXT,
  password_hash  TEXT,                              -- pbkdf2$<iterations>$<salt>$<hash>; NULL for Google-only
  google_sub     TEXT UNIQUE,
  disabled_at    TEXT,
  last_login_at  TEXT,
  created_at     TEXT NOT NULL,
  updated_at     TEXT NOT NULL
);

-- Browser sessions on accounts.ruyalab.com (cookie holds the raw token, only its SHA-256 is stored).
CREATE TABLE sessions (
  id_hash      TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL REFERENCES users(id),
  amr          TEXT NOT NULL,                       -- JSON array: ["pwd"] or ["google"]
  auth_time    INTEGER NOT NULL,                    -- unix seconds
  created_at   TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  expires_at   TEXT NOT NULL,
  revoked_at   TEXT,
  ip           TEXT,
  user_agent   TEXT
);
CREATE INDEX sessions_user ON sessions (user_id);

-- A product's sign-in request, parked while the person signs in or verifies their email.
CREATE TABLE auth_requests (
  id         TEXT PRIMARY KEY,
  client_id  TEXT NOT NULL,
  params     TEXT NOT NULL,                         -- JSON: redirect_uri, state, nonce, code_challenge, scope
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

-- One-time authorization codes (SHA-256 of the code), redeemable once within 60 seconds.
CREATE TABLE auth_codes (
  code_hash      TEXT PRIMARY KEY,
  client_id      TEXT NOT NULL,
  user_id        TEXT NOT NULL,
  redirect_uri   TEXT NOT NULL,
  code_challenge TEXT NOT NULL,
  nonce          TEXT,
  scope          TEXT NOT NULL,
  auth_time      INTEGER NOT NULL,
  amr            TEXT NOT NULL,
  expires_at     TEXT NOT NULL,
  used_at        TEXT
);

-- Email verification and password reset links.
CREATE TABLE email_tokens (
  token_hash TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id),
  purpose    TEXT NOT NULL CHECK (purpose IN ('verify', 'reset')),
  req_id     TEXT,
  expires_at TEXT NOT NULL,
  used_at    TEXT
);

-- Google sign-in round trips.
CREATE TABLE google_states (
  state      TEXT PRIMARY KEY,
  nonce      TEXT NOT NULL,
  verifier   TEXT NOT NULL,
  req_id     TEXT,
  expires_at TEXT NOT NULL
);
