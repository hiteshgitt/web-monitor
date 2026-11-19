-- Where Pro comes from: 'manual' (an admin), 'trial' (the 14-day trial every new account gets) or 'ruyalab'
-- (Ruya Lab Pro on the linked Ruya Lab account). Only trial and ruyalab Pro end on their own; manual never does.
-- trial_ends_at is set once and kept, so each person gets one trial. trial_reminded: 3 or 1 = that reminder was sent.
ALTER TABLE users ADD COLUMN plan_source TEXT CHECK (plan_source IN ('manual', 'trial', 'ruyalab'));
ALTER TABLE users ADD COLUMN trial_ends_at TEXT;
ALTER TABLE users ADD COLUMN trial_reminded INTEGER NOT NULL DEFAULT 0;
UPDATE users SET plan_source = 'manual' WHERE plan = 'pro';
CREATE INDEX users_trial ON users (trial_ends_at) WHERE plan_source = 'trial';
