-- Cached PageSpeed lab run and Chrome UX Report field data. One row per site.
CREATE TABLE vitals_scans (
  website_id TEXT PRIMARY KEY,
  payload TEXT NOT NULL,
  checked_at TEXT NOT NULL
);
