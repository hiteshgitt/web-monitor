-- A Pro payment. The plan stays free until Razorpay confirms this row.
CREATE TABLE billing_orders (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  provider_order_id TEXT,
  provider_payment_id TEXT,
  amount INTEGER NOT NULL,
  currency TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  paid_at TEXT
);
CREATE UNIQUE INDEX idx_billing_provider_order ON billing_orders (provider, provider_order_id);
