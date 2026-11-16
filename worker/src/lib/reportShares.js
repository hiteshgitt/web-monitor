// Private report links: a Pro customer creates a link to one site's health report and sends it to a client,
// who opens it without signing in. Only the token's SHA-256 is stored. A link stops working when it expires,
// is revoked, the site is deleted, or the owner is no longer on Pro.
import { isPro } from './auth.js';
import { sha256Hex } from './adminAuth.js';
import { buildReport, REPORT_PERIODS } from './report.js';
import { ApiError, newId, nowIso } from './util.js';

export const SHARE_EXPIRY_DAYS = [7, 30, 90, 365];
const MAX_ACTIVE_SHARES_PER_SITE = 10;

const toBase64Url = (bytes) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const newToken = () => `wmr_${toBase64Url(crypto.getRandomValues(new Uint8Array(24)))}`;
const TOKEN_PATTERN = /^wmr_[A-Za-z0-9_-]{32}$/;

export const shareUrl = (env, token) => `${String(env.APP_URL || 'https://webmonitor.ruyalab.com').replace(/\/+$/, '')}/r/${token}`;

const serializeShare = (row) => ({
  id: row.id,
  label: row.label,
  days: row.days,
  createdAt: row.created_at,
  expiresAt: row.expires_at,
  lastViewedAt: row.last_viewed_at,
});

export async function listShares(env, userId, siteId) {
  const { results } = await env.DB.prepare(`SELECT * FROM report_shares
    WHERE website_id = ? AND user_id = ? AND revoked_at IS NULL AND expires_at > ? ORDER BY created_at DESC`)
    .bind(siteId, userId, nowIso()).all();
  return results.map(serializeShare);
}

export async function createShare(env, userId, siteId, input = {}) {
  const days = Number(input.days) || 30;
  const expiresInDays = Number(input.expiresInDays) || 30;
  if (!REPORT_PERIODS.includes(days)) throw new ApiError(400, `Choose a report period of ${REPORT_PERIODS.join(', ')} days.`);
  if (!input.system && !SHARE_EXPIRY_DAYS.includes(expiresInDays)) throw new ApiError(400, `Choose an expiry of ${SHARE_EXPIRY_DAYS.join(', ')} days.`);
  const label = String(input.label || '').trim().slice(0, 80);
  // Links made for the monthly email (system) do not count against the customer's own limit.
  const active = input.system ? [] : (await listShares(env, userId, siteId)).filter((sh) => !sh.label.startsWith('Monthly email '));
  if (active.length >= MAX_ACTIVE_SHARES_PER_SITE) {
    throw new ApiError(409, `A site can have at most ${MAX_ACTIVE_SHARES_PER_SITE} active links. Revoke one first.`);
  }
  const token = newToken();
  const now = new Date();
  const row = {
    id: newId(), website_id: siteId, user_id: userId, token_hash: await sha256Hex(token), days, label,
    created_at: now.toISOString(), expires_at: new Date(now.getTime() + expiresInDays * 86400000).toISOString(), last_viewed_at: null,
  };
  await env.DB.prepare(`INSERT INTO report_shares (id, website_id, user_id, token_hash, days, label, created_at, expires_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
    .bind(row.id, row.website_id, row.user_id, row.token_hash, row.days, row.label, row.created_at, row.expires_at).run();
  return { ...serializeShare(row), url: shareUrl(env, token) };
}

export async function revokeShare(env, userId, siteId, shareId) {
  const r = await env.DB.prepare('UPDATE report_shares SET revoked_at = ? WHERE id = ? AND website_id = ? AND user_id = ? AND revoked_at IS NULL')
    .bind(nowIso(), shareId, siteId, userId).run();
  if (!r.meta?.changes) throw new ApiError(404, 'That link was not found or is already revoked.');
}

// What a client sees: the full report, minus links into the owner's own RuyaShield organisation.
export function clientReport(report) {
  return { ...report, shared: true, security: { ...report.security, link: null } };
}

export async function sharedReport(env, token) {
  const gone = new ApiError(404, 'This report link is not valid. It may have expired or been revoked.');
  if (!TOKEN_PATTERN.test(String(token || ''))) throw gone;
  const share = await env.DB.prepare(`SELECT s.*, u.plan, u.role FROM report_shares s JOIN users u ON u.id = s.user_id
    WHERE s.token_hash = ?`).bind(await sha256Hex(token)).first();
  if (!share || share.revoked_at || share.expires_at <= nowIso() || !isPro(share)) throw gone;
  const site = await env.DB.prepare('SELECT * FROM websites WHERE id = ? AND owner_id = ?').bind(share.website_id, share.user_id).first();
  if (!site) throw gone;
  await env.DB.prepare('UPDATE report_shares SET last_viewed_at = ? WHERE id = ?').bind(nowIso(), share.id).run();
  return clientReport(await buildReport(env, share.user_id, site, share.days));
}
