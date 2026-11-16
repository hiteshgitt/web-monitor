-- Site health report: private links a Pro customer can send a client (no sign-in), and the monthly email.

-- Only the SHA-256 of the link token is stored; the link itself is shown once when it is created.
CREATE TABLE report_shares (
  id TEXT PRIMARY KEY,
  website_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  days INTEGER NOT NULL DEFAULT 30,
  label TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  revoked_at TEXT,
  last_viewed_at TEXT
);
CREATE INDEX idx_report_shares_site ON report_shares (website_id);

-- Monthly report email per site: up to 5 recipients, sent on the 1st of each month for the previous 30 days.
CREATE TABLE report_emails (
  website_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  recipients TEXT NOT NULL,              -- JSON array of addresses
  enabled INTEGER NOT NULL DEFAULT 1,
  last_sent_at TEXT,
  last_error TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX idx_report_emails_user ON report_emails (user_id);
