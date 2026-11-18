-- Latest published version of npm and Packagist packages, cached for a day so the library inventory can
-- say which dependencies have an update without asking the registries on every page view.
CREATE TABLE package_versions (
  ecosystem TEXT NOT NULL,          -- 'npm' | 'packagist'
  name TEXT NOT NULL,
  latest TEXT,                      -- null when the registry does not know the package
  checked_at TEXT NOT NULL,
  PRIMARY KEY (ecosystem, name)
) WITHOUT ROWID;
