-- Unguessable link for a customer's public uptime page. Null until they open the link.
ALTER TABLE users ADD COLUMN status_slug TEXT;
CREATE UNIQUE INDEX idx_users_status_slug ON users (status_slug);
