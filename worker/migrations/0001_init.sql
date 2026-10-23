-- Web Monitor on Cloudflare D1.
-- Designed for the D1 free plan (100k rows written/day): each site costs about 2 row writes per
-- minute (one hourly bucket + one daily total), instead of one row per check plus its deletion later.

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL DEFAULT '',
  avatar_url TEXT,
  password_hash TEXT,                    -- "pbkdf2$<iterations>$<salt>$<hash>", NULL for Google-only accounts
  google_id TEXT UNIQUE,
  plan TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'pro')),
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  upgrade_requested_at TEXT,
  last_login_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE websites (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('wordpress', 'nextjs', 'laravel', 'codeigniter', 'php', 'other')),
  api_key TEXT NOT NULL,
  status TEXT,                           -- latest status; written only when it changes
  monitoring_enabled INTEGER NOT NULL DEFAULT 1,
  alert_response_ms INTEGER NOT NULL DEFAULT 5000,
  -- Health details reported by the site's integration (JSON), refreshed every DETAILS_REFRESH_MINUTES
  analytics TEXT,
  performance TEXT,
  seo TEXT,
  security TEXT,
  details_checked_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX idx_websites_owner ON websites (owner_id);

-- All checks of one site in one UTC hour.
-- checks = JSON array of [epochSeconds, status, responseMs|null, httpStatus|null, errorMessage|null]
CREATE TABLE check_hours (
  website_id TEXT NOT NULL,
  hour TEXT NOT NULL,                    -- 'YYYY-MM-DDTHH'
  checks TEXT NOT NULL,
  PRIMARY KEY (website_id, hour)
) WITHOUT ROWID;

-- Daily totals: cheap 30-day uptime and downtime figures
CREATE TABLE check_days (
  website_id TEXT NOT NULL,
  day TEXT NOT NULL,                     -- 'YYYY-MM-DD'
  total INTEGER NOT NULL DEFAULT 0,
  up INTEGER NOT NULL DEFAULT 0,         -- healthy or warning
  response_sum REAL NOT NULL DEFAULT 0,  -- sum of response times of the up checks
  PRIMARY KEY (website_id, day)
) WITHOUT ROWID;

-- Downtime: opened when a site goes offline/error, closed when it answers again
CREATE TABLE incidents (
  id TEXT PRIMARY KEY,
  website_id TEXT NOT NULL,
  started_at TEXT NOT NULL,
  ended_at TEXT,
  status TEXT NOT NULL,
  message TEXT NOT NULL DEFAULT '',
  last_checked TEXT NOT NULL
);
CREATE INDEX idx_incidents_site ON incidents (website_id, started_at);
