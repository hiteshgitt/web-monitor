-- Latest component health reported by a site's integration (database, PHP memory, disk, WP-Cron, Laravel
-- queue/scheduler, Next.js server errors...), as a JSON array of { id, name, status, message, hint }.
-- Written only when it changes.
ALTER TABLE websites ADD COLUMN components TEXT;
ALTER TABLE websites ADD COLUMN components_at TEXT;
