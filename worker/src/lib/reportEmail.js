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

const SCORE_COLOR = (s) => (s == null ? '#8a90b2' : s >= 90 ? '#3cc48c' : s >= 70 ? '#e3b23c' : '#e5536a');
const PRIORITY = { critical: ['#fce7ea', '#b4233a'], high: ['#fff1e6', '#c2410c'], medium: ['#fbf3df', '#92650a'], low: ['#e8f3fd', '#1f6fb2'] };
const SEV = [['critical', '#b4233a', '#fce7ea'], ['high', '#c2410c', '#fff1e6'], ['medium', '#92650a', '#fbf3df'], ['low', '#1f6fb2', '#e8f3fd']];
const FONT = "font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const fmtDay = (iso) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });

// A premium, table-based email (Gmail, Outlook, Apple Mail): dark brand header with the score, key figures,
// a day-by-day uptime strip, what to fix first, incidents and security findings, then the full-report button.
export function renderEmail(report, link, unsubscribeLink, appBase = 'https://webmonitor.ruyalab.com') {
  const u = report.uptime;
  const sec = report.security;
  const score = report.score.overall;
  const color = SCORE_COLOR(score);
  const month = new Date(report.period.to).toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  const host = (() => { try { return new URL(report.site.url).host; } catch { return report.site.url; } })();
  const mobile = report.speed?.lab?.mobile?.score ?? report.speed?.score ?? null;

  const kpis = [
    ['Uptime', u.percent == null ? '—' : `${u.percent}%`, `${u.incidentCount} incident${u.incidentCount === 1 ? '' : 's'}`],
    ['Downtime', fmtMinutes(u.downtimeMinutes), `last ${report.period.days} days`],
    ['Avg response', u.avgResponseMs == null ? '—' : `${u.avgResponseMs} ms`, 'checked every minute'],
    ['Mobile speed', mobile == null ? '—' : `${mobile}`, 'PageSpeed / 100'],
    ['SSL grade', report.publicChecks?.sslGrade || '—', report.publicChecks?.malware === 'flagged' ? 'Safe Browsing: listed' : 'SSL Labs'],
    ['Open findings', sec.open && sec.lastAssessment ? String(sec.openTotal) : '—', sec.open && sec.lastAssessment ? `${sec.open.critical} critical · ${sec.open.high} high` : 'RuyaShield'],
  ];
  const kpiCell = ([label, value, sub]) => `<td width="33%" valign="top" style="padding:6px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f7fd;border:1px solid #e6eafb;border-radius:14px"><tr><td style="padding:14px 14px 12px;${FONT}">
      <div style="font-size:10px;letter-spacing:1.5px;text-transform:uppercase;color:#8a90b2;font-weight:700">${label}</div>
      <div style="font-size:22px;font-weight:800;color:#1f2557;padding-top:4px">${esc(value)}</div>
      <div style="font-size:11px;color:#8a90b2;padding-top:2px">${esc(sub)}</div>
    </td></tr></table></td>`;

  const strip = u.daily.length ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>${u.daily.map((d) => {
    const c = d.uptime == null ? '#e6eafb' : d.uptime >= 99.9 ? '#3cc48c' : d.uptime >= 99 ? '#e3b23c' : '#e5536a';
    return `<td style="padding:0 1px"><div title="${d.day}" style="height:26px;border-radius:3px;background:${c}"></div></td>`;
  }).join('')}</tr></table>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
    <td style="${FONT};font-size:11px;color:#8a90b2;padding-top:6px">${fmtDay(u.daily[0].day)}</td>
    <td align="center" style="${FONT};font-size:11px;color:#8a90b2;padding-top:6px"><span style="color:#3cc48c">&#9632;</span> 99.9%+ &nbsp; <span style="color:#e3b23c">&#9632;</span> 99–99.9% &nbsp; <span style="color:#e5536a">&#9632;</span> below 99%</td>
    <td align="right" style="${FONT};font-size:11px;color:#8a90b2;padding-top:6px">${fmtDay(u.daily[u.daily.length - 1].day)}</td>
  </tr></table>` : '';

  const plan = (report.actionPlan || []).slice(0, 4);
  const planHtml = plan.length ? plan.map((a, i) => {
    const [bg, fg] = PRIORITY[a.priority];
    return `<tr><td style="padding:8px 0;border-top:${i ? '1px solid #eef0fa' : '0'};${FONT}">
      <span style="display:inline-block;background:${bg};color:${fg};font-size:10px;font-weight:800;letter-spacing:1px;text-transform:uppercase;padding:3px 8px;border-radius:6px">${a.priority}</span>
      <span style="font-size:14px;color:#1f2557;font-weight:700;padding-left:6px">${esc(a.area)}</span>
      <div style="font-size:13px;color:#4a5079;padding-top:4px;line-height:1.5">${esc(a.text)}</div></td></tr>`;
  }).join('') : `<tr><td style="${FONT};font-size:14px;color:#4a5079;padding:6px 0">No problems found in the measured areas this period.</td></tr>`;

  const incidents = (u.longestIncidents || []).slice(0, 3);
  const incHtml = incidents.length ? incidents.map((i) => `<tr>
      <td style="${FONT};font-size:13px;color:#1f2557;padding:7px 0;border-top:1px solid #eef0fa">${esc(new Date(i.startedAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }))} UTC</td>
      <td style="${FONT};font-size:13px;color:#1f2557;font-weight:700;padding:7px 0;border-top:1px solid #eef0fa">${fmtMinutes(i.minutes)}</td>
      <td style="${FONT};font-size:13px;color:#4a5079;padding:7px 0;border-top:1px solid #eef0fa">${esc(i.message || i.status)}</td></tr>`).join('') : '';

  const findings = sec.open && sec.lastAssessment ? `<table role="presentation" cellpadding="0" cellspacing="0"><tr>${SEV.map(([k, fg, bg]) => `<td style="padding:0 6px 6px 0"><div style="${FONT};background:${bg};color:${fg};border-radius:10px;padding:8px 12px;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:1px">${k}<div style="font-size:20px;letter-spacing:0">${sec.open[k] ?? 0}</div></div></td>`).join('')}</tr></table>
    ${(sec.top || []).map((f) => `<div style="${FONT};font-size:13px;color:#4a5079;padding:4px 0">&#8226; <b style="color:#1f2557">${esc(f.title)}</b> <span style="color:#8a90b2">(${esc(f.severity)}${f.cvss?.score != null ? `, CVSS ${esc(Number(f.cvss.score).toFixed(1))}${f.cvss.source === 'rated' ? ' rated' : ''}` : ''})</span></div>`).join('')}` : '';

  const section = (title, body) => `<tr><td style="padding:22px 28px 0"><div style="${FONT};font-size:12px;font-weight:800;letter-spacing:2px;text-transform:uppercase;color:#5868cf;padding-bottom:10px">${title}</div>${body}</td></tr>`;

  const subject = `${report.site.name}: ${score ?? '—'}/100 site health · ${month}`;
  const preheader = `Uptime ${u.percent ?? '—'}%, ${u.incidentCount} incident${u.incidentCount === 1 ? '' : 's'}, ${plan.length} thing${plan.length === 1 ? '' : 's'} to fix first.`;
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${esc(subject)}</title></head>
<body style="margin:0;padding:0;background:#eef1fb">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0f1230;background-image:linear-gradient(180deg,#0f1230 0%,#1b2050 340px,#eef1fb 340px,#eef1fb 100%)"><tr><td align="center" style="padding:28px 12px 36px">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px">
  <tr><td style="padding:0 6px 18px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
      <td><img src="${appBase}/icons/logo-mark-white.png" width="64" height="24" alt="Web Monitor" style="display:block;border:0;height:24px;width:auto"></td>
      <td align="right" style="${FONT};font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#aab7f0;font-weight:700">Site health report · ${esc(month)}</td>
    </tr></table>
  </td></tr>
  <tr><td style="border-radius:22px;overflow:hidden;background:#363f86;background-image:linear-gradient(135deg,#262d5f 0%,#4653ae 55%,#8799e8 100%)">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
      <td valign="middle" style="padding:30px 28px;${FONT}">
        <div style="font-size:12px;color:#ccd4f6;letter-spacing:1px">${esc(host)}</div>
        <div style="font-size:28px;line-height:1.15;font-weight:800;color:#ffffff;padding-top:6px">${esc(report.site.name)}</div>
        <div style="font-size:13px;color:#ccd4f6;padding-top:8px">Last ${report.period.days} days · ${esc(fmtDay(report.period.from))} – ${esc(fmtDay(report.period.to))}</div>
        <div style="padding-top:16px"><span style="display:inline-block;background:rgba(255,255,255,.16);color:#ffffff;border-radius:999px;padding:6px 14px;font-size:12px;font-weight:700">${scoreWord(score)}</span></div>
      </td>
      <td valign="middle" align="center" width="150" style="padding:24px 28px 24px 0">
        <table role="presentation" cellpadding="0" cellspacing="0"><tr><td align="center" valign="middle" width="116" height="116" style="width:116px;height:116px;border-radius:66px;background:#ffffff;border:8px solid ${color};${FONT}">
          <div style="font-size:40px;font-weight:800;color:#1f2557;line-height:1">${score ?? '—'}</div>
          <div style="font-size:11px;color:#8a90b2;padding-top:2px">out of 100</div>
        </td></tr></table>
      </td>
    </tr></table>
  </td></tr>
  <tr><td style="padding-top:16px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:22px">
      <tr><td style="padding:16px 22px 4px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr>${kpis.slice(0, 3).map(kpiCell).join('')}</tr><tr>${kpis.slice(3).map(kpiCell).join('')}</tr>
      </table></td></tr>
      ${strip ? section('Uptime, day by day', strip) : ''}
      ${section('What to fix first', `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${planHtml}</table>`)}
      ${incHtml ? section('Longest incidents', `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${incHtml}</table>`) : ''}
      ${findings ? section('Security findings · RuyaShield', findings) : ''}
      <tr><td align="center" style="padding:30px 28px 10px">
        <table role="presentation" cellpadding="0" cellspacing="0"><tr><td align="center" style="border-radius:14px;background:#5868cf;background-image:linear-gradient(135deg,#4653ae,#8799e8)">
          <a href="${esc(link)}" style="display:inline-block;padding:16px 34px;${FONT};font-size:15px;font-weight:800;color:#ffffff;text-decoration:none;border-radius:14px">Open the full report &rarr;</a>
        </td></tr></table>
        <div style="${FONT};font-size:12px;color:#8a90b2;padding-top:12px;line-height:1.5">Every section, all incidents and the PDF download. The link works for ${LINK_DAYS} days.</div>
      </td></tr>
      <tr><td style="padding:14px 28px 26px;${FONT};font-size:11px;color:#8a90b2;line-height:1.5;border-top:1px solid #eef0fa">
        &ldquo;Not measured&rdquo; means there was no data for that part; it is never counted as a pass. This report is not a certification.
      </td></tr>
    </table>
  </td></tr>
  <tr><td align="center" style="padding:22px 12px 0;${FONT};font-size:11px;color:#8a90b2;line-height:1.6">
    <b style="color:#4a5079">Web Monitor</b> · uptime, speed and security for your sites · by Ruyalab<br>
    You receive this because the owner of ${esc(host)} added your address. <a href="${esc(unsubscribeLink)}" style="color:#5868cf">Unsubscribe</a>
  </td></tr>
</table>
</td></tr></table>
</body></html>`;
  const text = [`${report.site.name} (${report.site.url}): site health ${score ?? '—'}/100 (${scoreWord(score)}), last ${report.period.days} days`,
    '', ...kpis.map(([k, v, sub]) => `${k}: ${v} (${sub})`), '', 'What to fix first:',
    ...(plan.length ? plan.map((a, i) => `${i + 1}. [${a.priority}] ${a.area}: ${a.text}`) : ['Nothing found in the measured areas.']),
    '', `Full report: ${link}`, `Unsubscribe: ${unsubscribeLink}`].join('\n');
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
      await resendSend(env, { to, unsubscribeLink, ...renderEmail(report, share.url, unsubscribeLink, appUrl(env)) });
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
