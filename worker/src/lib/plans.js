// Where a customer's Pro comes from, and the parts of it that change on their own:
// - trial:   every new account gets 7 days of Pro (no card). Reminders 3 days and 1 day before the end (in-app
//            and email), then the account goes back to Free. One trial per account: trial_ends_at is never cleared.
// - ruyalab: Ruya Lab Pro on the linked Ruya Lab account (accounts.ruyalab.com) unlocks Pro here too. Read at
//            sign-in (the ruyalab_plan claim) and every 15 minutes (POST /api/entitlements).
// - manual:  an admin switched the account to Pro. Never removed automatically.
import { notificationStatement } from './alerts.js';
import { emailConfigured } from './reportEmail.js';
import { ruyaLabConfigured } from './ruyalab.js';
import { ApiError } from './util.js';

export const TRIAL_DAYS = 7; // keep in step with src/config/plans.js
const DAY = 86400e3;
const REMINDERS = [3, 1]; // days left

/** Plan columns for a brand-new account: Pro on a TRIAL_DAYS-day trial. */
export function newAccountPlan(at = new Date()) {
  return { plan: 'pro', plan_source: 'trial', trial_ends_at: new Date(at.getTime() + TRIAL_DAYS * DAY).toISOString() };
}

export const trialDaysLeft = (user, at = new Date()) => (user?.plan_source === 'trial' && user.trial_ends_at
  ? Math.max(0, Math.ceil((Date.parse(user.trial_ends_at) - at.getTime()) / DAY)) : null);

export const canStartTrial = (user) => user?.plan !== 'pro' && user?.role !== 'admin' && !user?.trial_ends_at;

/** Existing Free accounts that never had a trial can start one themselves. */
export async function startTrial(env, user, at = new Date()) {
  if (!canStartTrial(user)) throw new ApiError(400, user?.trial_ends_at ? 'This account has already used its free trial.' : 'This account is already on Pro.');
  const p = newAccountPlan(at);
  const res = await env.DB.prepare(`UPDATE users SET plan = 'pro', plan_source = 'trial', trial_ends_at = ?, trial_reminded = 0, updated_at = ?
    WHERE id = ? AND plan = 'free' AND trial_ends_at IS NULL`).bind(p.trial_ends_at, at.toISOString(), user.id).run();
  if (!res.meta?.changes) throw new ApiError(409, 'The trial could not be started. Reload the page and try again.');
  await env.DB.batch([notificationStatement(env.DB, {
    userId: user.id, type: 'trial_started', title: `Your ${TRIAL_DAYS}-day Pro trial has started`,
    body: `Everything in Pro is unlocked until ${longDate(p.trial_ends_at)}. Your account goes back to Free after that unless Pro is activated.`,
  }, at)]);
  return { ...user, ...p, trial_reminded: 0 };
}

const longDate = (iso) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

// ---------- Ruya Lab Pro ----------

/**
 * Statements that bring one account in line with its Ruya Lab plan ('pro' | 'free'). Manual Pro is left alone;
 * an account on a trial that gets Ruya Lab Pro switches to it (the trial counts as used).
 */
export function ruyaLabPlanStatements(db, user, ruyalabPlan, at = new Date()) {
  const now = at.toISOString();
  if (ruyalabPlan === 'pro' && user.plan_source !== 'manual' && user.plan_source !== 'ruyalab') {
    return [
      db.prepare(`UPDATE users SET plan = 'pro', plan_source = 'ruyalab', upgrade_requested_at = NULL, updated_at = ? WHERE id = ?`).bind(now, user.id),
      notificationStatement(db, {
        userId: user.id, type: 'pro_approved', title: 'Ruya Lab Pro is active',
        body: 'Your Ruya Lab account is on Ruya Lab Pro, so Pro is unlocked here for all your sites.',
      }, at),
    ];
  }
  if (ruyalabPlan === 'free' && user.plan_source === 'ruyalab') {
    return [
      db.prepare(`UPDATE users SET plan = 'free', plan_source = NULL, updated_at = ? WHERE id = ?`).bind(now, user.id),
      notificationStatement(db, {
        userId: user.id, type: 'pro_ended', title: 'Ruya Lab Pro has ended',
        body: 'Your Ruya Lab account is no longer on Ruya Lab Pro, so this account is back on Free. Your sites keep being monitored.',
      }, at),
    ];
  }
  return [];
}

const ENTITLEMENTS_BATCH = 200;

/** Every 15 minutes: read Ruya Lab plans for linked accounts and apply changes. */
export async function syncRuyaLabPlans(env, at = new Date()) {
  if (!ruyaLabConfigured(env)) return { skipped: 'not-configured' };
  const { results: users } = await env.DB.prepare(`SELECT id, ruyalab_sub, plan, plan_source, role FROM users
    WHERE ruyalab_sub IS NOT NULL AND role != 'admin'`).all();
  let changed = 0;
  for (let i = 0; i < users.length; i += ENTITLEMENTS_BATCH) {
    const batch = users.slice(i, i + ENTITLEMENTS_BATCH);
    const plans = await fetchEntitlements(env, batch.map((u) => u.ruyalab_sub));
    const statements = batch.flatMap((u) => (plans[u.ruyalab_sub] ? ruyaLabPlanStatements(env.DB, u, plans[u.ruyalab_sub], at) : []));
    if (statements.length) {
      await env.DB.batch(statements);
      changed += statements.length / 2;
    }
  }
  return { linked: users.length, changed };
}

async function fetchEntitlements(env, subs) {
  const url = `${env.RUYALAB_ISSUER}/api/entitlements`;
  const init = {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Basic ${btoa(`${env.RUYALAB_CLIENT_ID}:${env.RUYALAB_CLIENT_SECRET}`)}` },
    body: JSON.stringify({ subs }),
    signal: AbortSignal.timeout(10000),
  };
  const res = await (env.ACCOUNTS ? env.ACCOUNTS.fetch(url, init) : fetch(url, init));
  if (!res.ok) throw new Error(`Ruya Lab entitlements answered ${res.status}`);
  return (await res.json()).plans || {};
}

// ---------- trial end and reminders ----------

/** Every 15 minutes: end finished trials and send the 3-day and 1-day reminders. */
export async function sweepTrials(env, at = new Date()) {
  const now = at.toISOString();
  const { results: ended } = await env.DB.prepare(`SELECT id FROM users WHERE plan = 'pro' AND plan_source = 'trial' AND trial_ends_at <= ?`).bind(now).all();
  const statements = ended.flatMap((u) => [
    env.DB.prepare(`UPDATE users SET plan = 'free', plan_source = NULL, updated_at = ? WHERE id = ? AND plan_source = 'trial'`).bind(now, u.id),
    notificationStatement(env.DB, {
      userId: u.id, type: 'trial_ended', title: 'Your Pro trial has ended',
      body: 'Your account is back on Free. Your sites keep being monitored; request Pro from the dashboard to get the Advanced view back.',
    }, at),
  ]);

  const reminders = [];
  for (const days of REMINDERS) {
    const { results } = await env.DB.prepare(`SELECT id, email, name, trial_ends_at FROM users
      WHERE plan = 'pro' AND plan_source = 'trial' AND trial_ends_at > ? AND trial_ends_at <= ? AND (trial_reminded = 0 OR trial_reminded > ?)`)
      .bind(now, new Date(at.getTime() + days * DAY).toISOString(), days).all();
    for (const u of results) {
      if (reminders.some((r) => r.user.id === u.id)) continue;
      reminders.push({ user: u, days });
      const left = days === 1 ? 'less than a day' : `${days} days`;
      statements.push(
        env.DB.prepare('UPDATE users SET trial_reminded = ? WHERE id = ?').bind(days, u.id),
        notificationStatement(env.DB, {
          userId: u.id, type: 'trial_ending', title: `Your Pro trial ends in ${left}`,
          body: `Pro stays on until ${longDate(u.trial_ends_at)}. Request Pro from the dashboard to keep the Advanced view after that.`,
        }, at),
      );
    }
  }
  if (statements.length) await env.DB.batch(statements);

  let emailed = 0;
  if (emailConfigured(env)) {
    for (const { user, days } of reminders) {
      await sendTrialEmail(env, user, days).then(() => { emailed += 1; }, (e) => console.error('trial email failed', e.message));
    }
  }
  return { ended: ended.length, reminded: reminders.length, emailed };
}

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

const FONT = "font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const PRO_LOSES = [
  ['Advanced view', 'AI insights, plugin and package audits, PageSpeed and server details'],
  ['Security depth', 'Known vulnerabilities, Release Radar and the suspicious-file scan'],
  ['Errors and server', 'Error tracking with stack traces and the server agent'],
  ['Reports', 'Site health reports, client links and the monthly report email'],
];
const FREE_KEEPS = ['Every site checked each minute', 'Downtime incidents and alerts', 'SEO and security scores', 'Web dashboard and mobile app'];

/** The trial reminder: a table-based email in the same style as the monthly report (Gmail, Outlook, Apple Mail). */
export function renderTrialEmail(user, days, app = 'https://webmonitor.ruyalab.com') {
  const left = days === 1 ? 'tomorrow' : `in ${days} days`;
  const subject = `Your Web Monitor Pro trial ends ${left}`;
  const hello = user.name ? `Hi ${user.name},` : 'Hi,';
  const ends = longDate(user.trial_ends_at);
  const link = `${app}/app`;
  const lines = [
    `Your free Pro trial ends ${left}, on ${ends}.`,
    'After that your account goes back to Free: your sites keep being monitored, but the Advanced view, site health reports and report emails need Pro.',
    'To keep Pro, open your dashboard and choose Request Pro. Our team activates it.',
  ];
  const preheader = `Pro stays on until ${ends}. Request Pro from your dashboard to keep the Advanced view.`;
  const tick = (color) => `<span style="display:inline-block;width:18px;height:18px;line-height:18px;border-radius:9px;background:${color};color:#ffffff;font-size:11px;font-weight:800;text-align:center">&#10003;</span>`;
  const loses = PRO_LOSES.map(([title, text], i) => `<tr><td valign="top" width="30" style="padding:12px 0;border-top:${i ? '1px solid #eef0fa' : '0'}">${tick('#5868cf')}</td>
      <td style="padding:12px 0;border-top:${i ? '1px solid #eef0fa' : '0'};${FONT}"><div style="font-size:14px;font-weight:700;color:#1f2557">${title}</div><div style="font-size:13px;color:#4a5079;padding-top:2px;line-height:1.5">${text}</div></td></tr>`).join('');
  const keeps = FREE_KEEPS.map((t) => `<tr><td valign="top" width="28" style="padding:5px 0">${tick('#3cc48c')}</td><td style="padding:5px 0;${FONT};font-size:13px;color:#4a5079">${t}</td></tr>`).join('');

  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${esc(subject)}</title></head>
<body style="margin:0;padding:0;background:#eef1fb">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0f1230;background-image:linear-gradient(180deg,#0f1230 0%,#1b2050 300px,#eef1fb 300px,#eef1fb 100%)"><tr><td align="center" style="padding:28px 12px 36px">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px">
  <tr><td style="padding:0 6px 18px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
      <td><img src="${app}/icons/logo-mark-white.png" width="64" height="24" alt="Web Monitor" style="display:block;border:0;height:24px;width:auto"></td>
      <td align="right" style="${FONT};font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#aab7f0;font-weight:700">Pro trial</td>
    </tr></table>
  </td></tr>
  <tr><td style="border-radius:22px;overflow:hidden;background:#363f86;background-image:linear-gradient(135deg,#262d5f 0%,#4653ae 55%,#8799e8 100%)">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
      <td valign="middle" style="padding:30px 28px;${FONT}">
        <div style="font-size:12px;color:#ccd4f6;letter-spacing:1px">${esc(hello)}</div>
        <div style="font-size:28px;line-height:1.15;font-weight:800;color:#ffffff;padding-top:6px">Your Pro trial ends ${esc(left)}</div>
        <div style="font-size:14px;color:#ccd4f6;padding-top:10px;line-height:1.5">Everything in Pro stays on until <b style="color:#ffffff">${esc(ends)}</b>. Keep it with one click from your dashboard.</div>
      </td>
      <td valign="middle" align="center" width="150" style="padding:24px 28px 24px 0">
        <table role="presentation" cellpadding="0" cellspacing="0"><tr><td align="center" valign="middle" width="116" height="116" style="width:116px;height:116px;border-radius:66px;background:#ffffff;border:8px solid ${days === 1 ? '#e5536a' : '#e3b23c'};${FONT}">
          <div style="font-size:40px;font-weight:800;color:#1f2557;line-height:1">${days}</div>
          <div style="font-size:11px;color:#8a90b2;padding-top:2px">day${days === 1 ? '' : 's'} left</div>
        </td></tr></table>
      </td>
    </tr></table>
  </td></tr>
  <tr><td style="padding-top:16px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:22px">
      <tr><td style="padding:26px 28px 0;${FONT}">
        <div style="font-size:12px;font-weight:800;letter-spacing:2px;text-transform:uppercase;color:#5868cf;padding-bottom:6px">What needs Pro after ${esc(ends)}</div>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${loses}</table>
      </td></tr>
      <tr><td style="padding:18px 28px 0">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f7fd;border:1px solid #e6eafb;border-radius:14px"><tr><td style="padding:16px 18px;${FONT}">
          <div style="font-size:10px;letter-spacing:1.5px;text-transform:uppercase;color:#8a90b2;font-weight:700;padding-bottom:6px">Free keeps working</div>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${keeps}</table>
        </td></tr></table>
      </td></tr>
      <tr><td align="center" style="padding:30px 28px 10px">
        <table role="presentation" cellpadding="0" cellspacing="0"><tr><td align="center" style="border-radius:14px;background:#5868cf;background-image:linear-gradient(135deg,#4653ae,#8799e8)">
          <a href="${esc(link)}" style="display:inline-block;padding:16px 34px;${FONT};font-size:15px;font-weight:800;color:#ffffff;text-decoration:none;border-radius:14px">Keep Pro &rarr;</a>
        </td></tr></table>
        <div style="${FONT};font-size:12px;color:#8a90b2;padding-top:12px;line-height:1.5">Open your dashboard and choose <b style="color:#4a5079">Request Pro</b>. Our team activates it, no card needed.</div>
      </td></tr>
      <tr><td style="padding:14px 28px 26px"></td></tr>
    </table>
  </td></tr>
  <tr><td align="center" style="padding:22px 12px 0;${FONT};font-size:11px;color:#8a90b2;line-height:1.6">
    <b style="color:#4a5079">Web Monitor</b> · uptime, speed and security for your sites · by Ruyalab<br>
    You get this email once or twice during your trial.
  </td></tr>
</table>
</td></tr></table>
</body></html>`;
  const text = [hello, '', ...lines, '', `Open Web Monitor: ${link}`].join('\n');
  return { subject, html, text };
}

async function sendTrialEmail(env, user, days) {
  const app = String(env.APP_URL || 'https://webmonitor.ruyalab.com').replace(/\/+$/, '');
  const { subject, html, text } = renderTrialEmail(user, days, app);
  const res = await fetch(`${env.RESEND_API_BASE || 'https://api.resend.com'}/emails`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: env.REPORT_EMAIL_FROM, to: [user.email], subject, html, text }),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`Resend answered ${res.status}`);
}

