-- Per-site Search Console connection. The refresh token is encrypted before it is stored.
ALTER TABLE websites ADD COLUMN sc_site_url TEXT;
ALTER TABLE websites ADD COLUMN sc_permission TEXT;
ALTER TABLE websites ADD COLUMN sc_refresh_token TEXT;
ALTER TABLE websites ADD COLUMN sc_connected_at TEXT;

-- Short-lived handoff between the Google redirect and the site picker. No token is put in the URL.
CREATE TABLE sc_pending (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  website_id TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);
