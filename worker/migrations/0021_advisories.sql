-- Release Radar: security advisories for runtimes and platforms (PHP, Node.js, WordPress, Next.js), from
-- announcement to patch. An advisory names the branches it affects and, once released, the fixed version per
-- branch. Sites are matched by the runtime version their integration reports; Pro owners are told before
-- release (mitigation), at release (upgrade target) and when the fix is seen live (time to patch).
CREATE TABLE advisories (
  id TEXT PRIMARY KEY,
  component TEXT NOT NULL CHECK (component IN ('php', 'node', 'wordpress', 'nextjs')),
  title TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('critical', 'high', 'moderate', 'low')),
  cves TEXT NOT NULL DEFAULT '[]',          -- JSON array
  summary TEXT NOT NULL DEFAULT '',
  mitigation TEXT NOT NULL DEFAULT '',      -- what to do before (or instead of) upgrading
  branches TEXT NOT NULL DEFAULT '["*"]',   -- JSON: affected branches ("8.3", "22") or "*" for all
  fixed TEXT NOT NULL DEFAULT '{}',         -- JSON {"8.3": "8.3.37"}: set when the release is out
  exposure TEXT,                            -- JSON rule on reported config, e.g. {"session.upload_progress.enabled": true}
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'announced', 'released', 'withdrawn')),
  release_at TEXT,                          -- scheduled / actual release time (UTC)
  url TEXT,
  source TEXT NOT NULL DEFAULT 'manual',    -- manual | feed:<name>
  source_ref TEXT,                          -- feed item id, so a feed never creates the same advisory twice
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  published_at TEXT,
  released_at TEXT
);
CREATE UNIQUE INDEX advisories_source_ref ON advisories (source_ref) WHERE source_ref IS NOT NULL;

-- One row per (advisory, site) while the site is or was affected: drives notifications, time to patch and the fleet view.
CREATE TABLE advisory_sites (
  advisory_id TEXT NOT NULL REFERENCES advisories (id) ON DELETE CASCADE,
  website_id TEXT NOT NULL REFERENCES websites (id) ON DELETE CASCADE,
  state TEXT NOT NULL CHECK (state IN ('affected', 'patched', 'not_exposed')),
  version_seen TEXT,                        -- runtime version when first matched
  first_seen_at TEXT NOT NULL,
  notified_announce_at TEXT,
  notified_release_at TEXT,
  patched_at TEXT,
  patched_version TEXT,
  PRIMARY KEY (advisory_id, website_id)
) WITHOUT ROWID;
CREATE INDEX advisory_sites_site ON advisory_sites (website_id);

-- Security-relevant configuration from the integration (e.g. PHP ini values), for advisories with an exposure rule.
ALTER TABLE websites ADD COLUMN security_config TEXT;
