-- Server agent (Pro): a read-only agent on the customer's own server pushes one snapshot a minute (CPU, memory,
-- top processes, filesystems with inodes, web-server traffic per IP and attack attempts). One agent per site.
CREATE TABLE agents (
  website_id TEXT PRIMARY KEY REFERENCES websites (id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,        -- SHA-256 of the token; the token itself is shown once
  token_prefix TEXT NOT NULL,
  created_at TEXT NOT NULL,
  hostname TEXT,
  agent_version TEXT,
  last_seen TEXT,
  last_snapshot TEXT,                     -- latest snapshot (cleaned JSON)
  alert_state TEXT
);

-- One row per agent minute for charts and baselines; kept 7 days.
CREATE TABLE agent_minutes (
  website_id TEXT NOT NULL REFERENCES websites (id) ON DELETE CASCADE,
  minute INTEGER NOT NULL,                -- unix minute
  cpu REAL,
  mem REAL,
  load1 REAL,
  requests INTEGER,
  errors5xx INTEGER,
  attacks INTEGER,
  PRIMARY KEY (website_id, minute)
) WITHOUT ROWID;
