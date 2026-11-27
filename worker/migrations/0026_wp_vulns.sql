-- WordPress plugin vulnerabilities from the official CVE List (CVEProject/cvelistV5), loaded by the wp-vulns GitHub
-- Action (scripts/wp-vulns). One row per CVE and plugin slug; ranges is JSON [{from, lt, lte} | {exact}].
CREATE TABLE wp_vulns (
  cve TEXT NOT NULL,
  slug TEXT NOT NULL,
  title TEXT,
  ranges TEXT NOT NULL,
  cvss_score REAL,
  cvss_vector TEXT,
  severity TEXT NOT NULL,          -- critical | high | moderate | low | unknown (from the CVSS score)
  published TEXT,
  url TEXT,
  hash TEXT NOT NULL,
  PRIMARY KEY (cve, slug)
) WITHOUT ROWID;
CREATE INDEX wp_vulns_slug ON wp_vulns (slug);

-- When the data was last synced. Plugin checks refuse to report "no vulnerabilities" from stale or missing data.
CREATE TABLE wp_vulns_sync (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  synced_at TEXT NOT NULL,
  mode TEXT NOT NULL,              -- full | delta
  source TEXT,                     -- the CVE List release used
  row_count INTEGER
);
