-- CVSS for cached OSV advisories: the v3.x base score we compute from the vector, and the vector itself
-- (v4.0 vectors are kept without a score; their scoring needs the full FIRST lookup table).
ALTER TABLE osv_vulns ADD COLUMN cvss_score REAL;
ALTER TABLE osv_vulns ADD COLUMN cvss_vector TEXT;
