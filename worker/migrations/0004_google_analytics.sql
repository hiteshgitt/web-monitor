-- Per-site Google Analytics connection. The refresh token is encrypted before it is stored.
ALTER TABLE websites ADD COLUMN ga_property_id TEXT;
ALTER TABLE websites ADD COLUMN ga_property_name TEXT;
ALTER TABLE websites ADD COLUMN ga_refresh_token TEXT;
ALTER TABLE websites ADD COLUMN ga_connected_at TEXT;

-- Short-lived handoff between the Google redirect and the property picker. No token is put in the URL.
CREATE TABLE ga_pending (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  website_id TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);
