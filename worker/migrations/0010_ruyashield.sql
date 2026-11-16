-- RuyaShield connection: one per customer. The customer pastes a read-only RuyaShield API token
-- (assets:read + findings:read); it is encrypted before it is stored, like the Google refresh tokens.
-- posture caches the last per-host answer so opening a site does not call RuyaShield every time.
CREATE TABLE ruyashield_connections (
  user_id TEXT PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  token_prefix TEXT NOT NULL,
  org_name TEXT NOT NULL,
  connected_at TEXT NOT NULL,
  last_error TEXT,
  posture TEXT,
  posture_at TEXT
);
