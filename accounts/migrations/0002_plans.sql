-- Ruya Lab Pro: one plan on the Ruya Lab account that unlocks Pro in every product (WebMonitor, RuyaShield).
-- Switched by an operator (scripts/plan.mjs) until online payment exists. Products read it with
-- POST /api/entitlements (client credentials) and from the ruyalab_plan claim at sign-in.
ALTER TABLE users ADD COLUMN plan TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'pro'));
ALTER TABLE users ADD COLUMN plan_changed_at TEXT;
