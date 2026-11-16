-- Per-host critical/high counts and titles from the last RuyaShield answer that alerts were raised against.
-- Separate from `posture` (the display cache), so a panel refresh can never swallow an alert.
ALTER TABLE ruyashield_connections ADD COLUMN alert_state TEXT;
