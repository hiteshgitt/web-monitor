-- Suspicious-file scan (Pro): findings from the integration's read-only scanner (file, line, rule, snippet).
CREATE TABLE file_findings (
  website_id TEXT NOT NULL REFERENCES websites (id) ON DELETE CASCADE,
  id TEXT NOT NULL,                  -- fingerprint from the scanner (path + rule + line text)
  path TEXT NOT NULL,
  line INTEGER,
  rule TEXT NOT NULL,
  severity TEXT NOT NULL,
  title TEXT NOT NULL,
  snippet TEXT,
  file_mtime TEXT,
  first_seen TEXT NOT NULL,
  last_seen TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'cleared', 'ignored')),
  cleared_at TEXT,
  PRIMARY KEY (website_id, id)
) WITHOUT ROWID;

ALTER TABLE websites ADD COLUMN filescan_state TEXT;   -- JSON progress from the last call
ALTER TABLE websites ADD COLUMN filescan_at TEXT;      -- when the scanner was last advanced
