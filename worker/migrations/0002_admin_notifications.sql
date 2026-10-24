-- Super admin controls and customer alerts.

-- 'suspended' customers can't sign in and their sites are not checked
ALTER TABLE users ADD COLUMN status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended'));
-- Which alert types the customer wants pushed (JSON { type: boolean }); NULL = defaults
ALTER TABLE users ADD COLUMN notify_prefs TEXT;
-- When a Pro request was last declined (shown to the customer and the admin)
ALTER TABLE users ADD COLUMN upgrade_declined_at TEXT;

-- What was last alerted for a site (JSON), so each problem is announced once, not every minute
ALTER TABLE websites ADD COLUMN alert_state TEXT;

-- Alert history per customer: the bell in the dashboard and the source of push notifications.
-- pushed_at stays NULL until delivery to the customer's devices has been attempted.
CREATE TABLE notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  website_id TEXT,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  read_at TEXT,
  pushed_at TEXT
);
CREATE INDEX idx_notifications_user ON notifications (user_id, created_at);
CREATE INDEX idx_notifications_unpushed ON notifications (pushed_at) WHERE pushed_at IS NULL;

-- Devices that receive push: Expo push tokens (mobile app) and Web Push subscriptions (browsers).
-- pull_key lets a browser's service worker fetch the alert text without the sign-in token.
CREATE TABLE push_devices (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('expo', 'web')),
  token TEXT NOT NULL UNIQUE,             -- Expo push token, or the Web Push endpoint URL
  pull_key TEXT,
  label TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  last_used_at TEXT
);
CREATE INDEX idx_push_devices_user ON push_devices (user_id);
