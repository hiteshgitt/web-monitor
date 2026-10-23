// Database rows -> API JSON, in the same shape the dashboard used with the Express/MongoDB backend
import { parseJson } from './util.js';

export const serializeUser = (row, extra = {}) => ({
  _id: row.id,
  email: row.email,
  name: row.name,
  avatarUrl: row.avatar_url || undefined,
  plan: row.plan,
  role: row.role,
  isPro: row.plan === 'pro' || row.role === 'admin',
  hasPassword: Boolean(row.password_hash),
  upgradeRequestedAt: row.upgrade_requested_at || undefined,
  lastLoginAt: row.last_login_at || undefined,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  ...extra,
});

// live = { status, responseTime, lastChecked, uptime } computed from check_hours / check_days
export const serializeWebsite = (row, live = {}) => ({
  _id: row.id,
  owner: row.owner_id,
  name: row.name,
  url: row.url,
  platform: row.platform,
  // Never send the site's API key to the browser; expose only its last 4 characters
  apiKeyLast4: row.api_key ? row.api_key.slice(-4) : null,
  status: live.status ?? row.status ?? null,
  uptime: live.uptime ?? null,
  responseTime: live.responseTime ?? null,
  lastChecked: live.lastChecked ?? null,
  monitoringEnabled: Boolean(row.monitoring_enabled),
  settings: { alertThresholds: { responseTime: row.alert_response_ms } },
  analytics: parseJson(row.analytics),
  performance: parseJson(row.performance),
  seo: parseJson(row.seo),
  security: parseJson(row.security),
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export const serializeIncident = (row) => ({
  _id: row.id,
  websiteId: row.website_id,
  startedAt: row.started_at,
  endedAt: row.ended_at || null,
  status: row.status,
  message: row.message,
  lastChecked: row.last_checked,
});
