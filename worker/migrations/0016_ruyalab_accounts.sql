-- One Ruya Lab account: the accounts.ruyalab.com subject linked to this WebMonitor user.
ALTER TABLE users ADD COLUMN ruyalab_sub TEXT;
CREATE UNIQUE INDEX users_ruyalab_sub ON users (ruyalab_sub) WHERE ruyalab_sub IS NOT NULL;
