-- Ruya Lab Security Assessment Attestations: a stored, hashed snapshot of a site's automated assessment, issued only
-- when no critical or high finding is open. Public verification at /verify/<id>. Not a CERT-In VAPT certificate.
CREATE TABLE site_attestations (
  id TEXT PRIMARY KEY,                 -- 24 hex characters, unguessable; shown as the verification ID
  website_id TEXT NOT NULL,
  owner_id TEXT NOT NULL,
  issued_at TEXT NOT NULL,
  valid_until TEXT NOT NULL,
  snapshot TEXT NOT NULL,              -- JSON: what was assessed and the result, as issued
  sha256 TEXT NOT NULL,                -- of the snapshot JSON, shown on the verification page
  revoked_at TEXT
);
CREATE INDEX site_attestations_site ON site_attestations (website_id, issued_at);
