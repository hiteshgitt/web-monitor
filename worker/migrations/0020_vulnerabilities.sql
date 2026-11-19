-- Known vulnerabilities (Pro): installed npm/Composer packages checked against OSV.dev, and the site's runtime
-- (PHP, Node.js, WordPress) checked against its end-of-life dates and security releases.

-- Runtime versions from the integration's health response; written only when they change.
ALTER TABLE websites ADD COLUMN runtime TEXT;            -- JSON {php, node, wordpress, nextjs}
-- What was found last, so only new problems alert. JSON {packages: [...], runtime: [...]}.
ALTER TABLE websites ADD COLUMN vulnerabilities TEXT;
ALTER TABLE websites ADD COLUMN vulns_checked_at TEXT;   -- last package check (runtime is checked every run)

-- OSV advisories, cached: they change rarely and many sites share packages.
CREATE TABLE osv_vulns (
  id TEXT PRIMARY KEY,                -- GHSA-…, CVE-…, PYSEC-…
  summary TEXT,
  severity TEXT,                      -- critical | high | moderate | low | unknown
  aliases TEXT,                       -- JSON array (CVE ids)
  fixed TEXT,                         -- JSON {"<ecosystem>|<package>": "<first fixed version>"}
  url TEXT,
  fetched_at TEXT NOT NULL
) WITHOUT ROWID;

-- Public reference data (PHP/Node.js release lists, WordPress stable-check), cached for hours.
CREATE TABLE reference_cache (
  key TEXT PRIMARY KEY,
  body TEXT NOT NULL,
  fetched_at TEXT NOT NULL
) WITHOUT ROWID;
