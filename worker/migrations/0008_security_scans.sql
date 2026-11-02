-- Cached public security check: Safe Browsing, SSL Labs grade, and response headers.
CREATE TABLE security_scans (
  website_id TEXT PRIMARY KEY,
  payload TEXT NOT NULL,
  checked_at TEXT NOT NULL
);
