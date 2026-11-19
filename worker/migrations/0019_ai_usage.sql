-- Daily AI request counter per provider, so Zealot never goes past a free allowance (Cloudflare Workers AI:
-- 10,000 Neurons a day). The day is UTC, like Cloudflare's reset. Old days are deleted by the daily cleanup.
CREATE TABLE ai_usage (
  day TEXT NOT NULL,
  provider TEXT NOT NULL,
  requests INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, provider)
);
