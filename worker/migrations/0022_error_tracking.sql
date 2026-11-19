-- Error tracking: the integrations group fatal errors / uncaught exceptions with file, line and stack. The health
-- check carries a summary; when it shows something new, the monitor fetches the groups (Pro) and stores them here.
CREATE TABLE error_groups (
  website_id TEXT NOT NULL REFERENCES websites (id) ON DELETE CASCADE,
  fp TEXT NOT NULL,                 -- fingerprint from the integration (type + file + line + message shape)
  type TEXT NOT NULL,
  message TEXT NOT NULL,
  file TEXT,
  line INTEGER,
  location TEXT,                    -- route or path where it happened
  stack TEXT,                       -- JSON array of frames
  digest TEXT,
  count INTEGER NOT NULL DEFAULT 0,
  first_seen TEXT NOT NULL,
  last_seen TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved')),
  resolved_at TEXT,
  PRIMARY KEY (website_id, fp)
) WITHOUT ROWID;
CREATE INDEX error_groups_recent ON error_groups (website_id, last_seen);

ALTER TABLE websites ADD COLUMN errors_summary TEXT;   -- JSON {groups, latest, tracked}: written when it changes
ALTER TABLE websites ADD COLUMN errors_pending INTEGER NOT NULL DEFAULT 0;
ALTER TABLE websites ADD COLUMN errors_synced_at TEXT;
