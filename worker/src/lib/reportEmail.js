// Monthly site health report email (Pro), sent through Resend. Each email carries the headline numbers and a
// fresh private link to the full report. Recipients may be the customer's clients, so every email has a
// one-click unsubscribe link that removes only that address.
import { isPro } from './auth.js';
import { buildReport } from './report.js';
import { createShare } from './reportShares.js';
import { ApiError, nowIso, parseJson } from './util.js';

export const MAX_RECIPIENTS = 5;
const REPORT_DAYS = 30;
const LINK_DAYS = 45;          // the link outlives the month, so last month's email still works for a while
const SEND_PER_RUN = 5;        // Resend allows a few requests a second; the 15-minute job catches up
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const emailConfigured = (env) => Boolean(env.RESEND_API_KEY && env.REPORT_EMAIL_FROM);
const appUrl = (env) => String(env.APP_URL || 'https://webmonitor.ruyalab.com').replace(/\/+$/, '');

export function parseRecipients(input) {
  const list = (Array.isArray(input) ? input : String(input || '').split(/[,;\s]+/))
    .map((a) => String(a).trim().toLowerCase()).filter(Boolean);
  const unique = [...new Set(list)];
  if (!unique.length) throw new ApiError(400, 'Add at least one email address.');
  if (unique.length > MAX_RECIPIENTS) throw new ApiError(400, `Add at most ${MAX_RECIPIENTS} addresses.`);
  const bad = unique.find((a) => !EMAIL.test(a) || a.length > 200);
  if (bad) throw new ApiError(400, `"${bad}" is not a valid email address.`);
  return unique;
}

const serialize = (env, row) => ({
  configured: emailConfigured(env),
  enabled: Boolean(row?.enabled),
  recipients: row ? parseJson(row.recipients) || [] : [],
  lastSentAt: row?.last_sent_at || null,
  lastError: row?.last_error || null,
});

export async function getReportEmail(env, userId, siteId) {
  const row = await env.DB.prepare('SELECT * FROM report_emails WHERE website_id = ? AND user_id = ?').bind(siteId, userId).first();
  return serialize(env, row);
}

export async function saveReportEmail(env, userId, siteId, body = {}) {
  const enabled = Boolean(body.enabled);
  const recipients = enabled || body.recipients ? parseRecipients(body.recipients) : [];
  const now = nowIso();
  await env.DB.prepare(`INSERT INTO report_emails (website_id, user_id, recipients, enabled, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(website_id) DO UPDATE SET user_id = excluded.user_id, recipients = excluded.recipients,
      enabled = excluded.enabled, last_error = NULL, updated_at = excluded.updated_at`)
    .bind(siteId, userId, JSON.stringify(recipients), enabled ? 1 : 0, now, now).run();
  return getReportEmail(env, userId, siteId);
}

// ---------- unsubscribe links (HMAC of site + address with JWT_SECRET) ----------

const toHex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
async function unsubscribeSig(env, siteId, address) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(`report-unsubscribe:${env.JWT_SECRET}`), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return toHex(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${siteId}\n${address}`))).slice(0, 32);
}

const unsubscribeUrl = async (env, siteId, address) => `${appUrl(env)}/api/report-email/unsubscribe?s=${encodeURIComponent(siteId)}&a=${encodeURIComponent(address)}&t=${await unsubscribeSig(env, siteId, address)}`;

export async function unsubscribe(env, siteId, address, sig) {
  const expected = await unsubscribeSig(env, String(siteId || ''), String(address || '').toLowerCase());
  if (!sig || sig !== expected) return false;
  const row = await env.DB.prepare('SELECT recipients FROM report_emails WHERE website_id = ?').bind(siteId).first();
  if (!row) return true;
  const left = (parseJson(row.recipients) || []).filter((a) => a !== String(address).toLowerCase());
  await env.DB.prepare('UPDATE report_emails SET recipients = ?, enabled = CASE WHEN ? = 0 THEN 0 ELSE enabled END, updated_at = ? WHERE website_id = ?')
    .bind(JSON.stringify(left), left.length, nowIso(), siteId).run();
  return true;
}

// ---------- the email ----------

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmtMinutes = (m) => (m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60} min`);
const scoreWord = (s) => (s == null ? 'Not measured' : s >= 90 ? 'Good' : s >= 70 ? 'Needs attention' : 'Poor');

export function renderEmail(report, link, unsubscribeLink) {
  const u = report.uptime;
  const sec = report.security;
  const rows = [
    ['Uptime', u.percent == null ? 'Not measured' : `${u.percent}%`],
    ['Downtime', `${fmtMinutes(u.downtimeMinutes)} (${u.incidentCount} incident${u.incidentCount === 1 ? '' : 's'})`],
    ['Average response', u.avgResponseMs == null ? 'Not measured' : `${u.avgResponseMs} ms`],
    ['Speed (PageSpeed)', report.speed?.score == null ? 'Not measured' : `${report.speed.score} / 100`],
    ['SSL grade', report.publicChecks?.sslGrade || 'Not measured'],
    ['Open security findings', sec.open && sec.lastAssessment
      ? `${sec.openTotal} (critical ${sec.open.critical}, high ${sec.open.high})` : 'Not measured'],
  ];
  const subject = `${report.site.name}: site health ${report.score.overall ?? '—'}/100 for the last ${report.period.days} days`;
  const html = `<!doctype html><html><body style="margin:0;background:#eef1fb;font-family:Arial,Helvetica,sans-serif;color:#1f2557">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef1fb;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;padding:28px">
<tr><td style="font-size:12px;font-weight:bold;letter-spacing:2px;color:#5868cf;text-transform:uppercase">Site health report</td></tr>
<tr><td style="padding-top:8px;font-size:22px;font-weight:bold">${esc(report.site.name)}</td></tr>
<tr><td style="padding-top:2px;font-size:13px;color:#8a90b2">${esc(report.site.url)} · last ${report.period.days} days</td></tr>
<tr><td style="padding-top:20px"><span style="font-size:40px;font-weight:bold">${report.score.overall ?? '—'}</span><span style="font-size:16px;color:#8a90b2"> / 100 · ${scoreWord(report.score.overall)}</span></td></tr>
<tr><td style="padding-top:16px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px">
${rows.map(([k, v]) => `<tr><td style="padding:8px 0;border-top:1px solid #e6eafb;color:#4a5079">${k}</td><td align="right" style="padding:8px 0;border-top:1px solid #e6eafb;font-weight:bold">${esc(v)}</td></tr>`).join('')}
</table></td></tr>
<tr><td style="padding-top:24px"><a href="${esc(link)}" style="display:inline-block;background:#5868cf;color:#ffffff;text-decoration:none;font-weight:bold;font-size:14px;padding:12px 20px;border-radius:10px">Open the full report</a></td></tr>
<tr><td style="padding-top:10px;font-size:12px;color:#8a90b2">The link works for ${LINK_DAYS} days. "Not measured" means there was no data for that part; it is never counted as a pass.</td></tr>
</table>
<p style="font-size:11px;color:#8a90b2;max-width:560px">Sent by Web Monitor (Ruyalab) because the owner of this site added your address. <a href="${esc(unsubscribeLink)}" style="color:#8a90b2">Unsubscribe</a></p>
</td></tr></table></body></html>`;
  const text = [`Site health report: ${report.site.name} (${report.site.url}), last ${report.period.days} days`,
    `Score: ${report.score.overall ?? '—'}/100 (${scoreWord(report.score.overall)})`, ...rows.map(([k, v]) => `${k}: ${v}`),
    `Full report: ${link}`, `Unsubscribe: ${unsubscribeLink}`].join('\n');
  return { subject, html, text };
}

async function resendSend(env, { to, subject, html, text, unsubscribeLink }) {
  // RESEND_API_BASE is only for local testing against a stand-in server.
  const res = await fetch(`${env.RESEND_API_BASE || 'https://api.resend.com'}/emails`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: env.REPORT_EMAIL_FROM, to: [to], subject, html, text,
      headers: { 'List-Unsubscribe': `<${unsubscribeLink}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' },
    }),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || `Resend answered ${res.status}`);
  }
}

// Builds the report once, makes one link, sends one email per recipient (each with its own unsubscribe link).
export async function sendReportEmail(env, userId, site, recipients) {
  if (!emailConfigured(env)) throw new ApiError(503, 'Report emails are not turned on yet.');
  const report = await buildReport(env, userId, site, REPORT_DAYS);
  const share = await createShare(env, userId, site.id, {
    days: REPORT_DAYS, expiresInDays: LINK_DAYS, label: `Monthly email ${report.generatedAt.slice(0, 7)}`, system: true,
  });
  let sent = 0;
  const errors = [];
  for (const to of recipients) {
    try {
      const unsubscribeLink = await unsubscribeUrl(env, site.id, to);
      await resendSend(env, { to, unsubscribeLink, ...renderEmail(report, share.url, unsubscribeLink) });
      sent += 1;
    } catch (error) {
      errors.push(`${to}: ${error.message}`);
    }
  }
  const lastError = errors.length ? errors.join('; ').slice(0, 500) : null;
  await env.DB.prepare('UPDATE report_emails SET last_sent_at = CASE WHEN ? > 0 THEN ? ELSE last_sent_at END, last_error = ? WHERE website_id = ?')
    .bind(sent, nowIso(), lastError, site.id).run();
  if (!sent) throw new ApiError(502, lastError || 'No email could be sent.');
  return { sent, failed: errors.length };
}

// 15-minute job: from the 1st of each month, send every enabled Pro site that has not had this month's email.
export async function sendDueReportEmails(env, at = new Date()) {
  if (!emailConfigured(env)) return { skipped: 'not-configured' };
  const monthStart = new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), 1)).toISOString();
  const { results } = await env.DB.prepare(`SELECT e.*, u.plan, u.role FROM report_emails e JOIN users u ON u.id = e.user_id
    WHERE e.enabled = 1 AND (u.plan = 'pro' OR u.role = 'admin') AND (e.last_sent_at IS NULL OR e.last_sent_at < ?)
      AND (e.last_error IS NULL OR e.updated_at < ?)
    ORDER BY e.last_sent_at LIMIT ?`).bind(monthStart, new Date(at.getTime() - 6 * 3600000).toISOString(), SEND_PER_RUN).all();
  let sent = 0;
  for (const row of results) {
    if (!isPro(row)) continue;
    const site = await env.DB.prepare('SELECT * FROM websites WHERE id = ? AND owner_id = ?').bind(row.website_id, row.user_id).first();
    const recipients = parseJson(row.recipients) || [];
    if (!site || !recipients.length) {
      // Nothing to send to: switch it off so it does not hold a place in the queue.
      await env.DB.prepare('UPDATE report_emails SET enabled = 0, updated_at = ? WHERE website_id = ?').bind(nowIso(), row.website_id).run();
      continue;
    }
    // A failure is retried after 6 hours: updated_at moves forward so the filter above waits.
    await sendReportEmail(env, row.user_id, site, recipients).then(() => { sent += 1; }).catch(async (error) => {
      await env.DB.prepare('UPDATE report_emails SET last_error = ?, updated_at = ? WHERE website_id = ?')
        .bind(String(error.message).slice(0, 500), nowIso(), row.website_id).run();
    });
  }
  return { due: results.length, sent };
}
