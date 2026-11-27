-- Themes as well as plugins (integration 1.7.0 reports installed themes). Existing rows are plugins; the next full
-- sync re-hashes every row (the hash now includes the kind) and adds the theme CVEs.
ALTER TABLE wp_vulns ADD COLUMN kind TEXT NOT NULL DEFAULT 'plugin';
CREATE INDEX wp_vulns_kind_slug ON wp_vulns (kind, slug);
