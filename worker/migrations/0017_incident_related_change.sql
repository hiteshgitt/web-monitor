-- "Possible cause" for downtime: a RuyaShield change (Cloudflare security headers applied or undone, or a RuyaShield
-- fix pull request merged) shortly before the site went down. JSON {kind, at, title, link}; set once per incident.
ALTER TABLE incidents ADD COLUMN related_change TEXT;
