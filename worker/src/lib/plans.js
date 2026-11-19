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

async function sendTrialEmail(env, user, days) {
  const app = String(env.APP_URL || 'https://webmonitor.ruyalab.com').replace(/\/+$/, '');
  const left = days === 1 ? 'tomorrow' : `in ${days} days`;
  const subject = `Your Web Monitor Pro trial ends ${left}`;
  const hello = user.name ? `Hi ${user.name},` : 'Hi,';
  const lines = [
    `Your free Pro trial ends ${left}, on ${longDate(user.trial_ends_at)}.`,
    'After that your account goes back to Free: your sites keep being monitored, but the Advanced view, site health reports and report emails need Pro.',
    'To keep Pro, open your dashboard and choose Request Pro. Our team activates it.',
  ];
  const html = `<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#1f2547;line-height:1.55">
<h2 style="color:#4a5bc4;margin:0 0 12px">${esc(subject)}</h2><p>${esc(hello)}</p>${lines.map((l) => `<p>${esc(l)}</p>`).join('')}
<p><a href="${esc(`${app}/app`)}" style="display:inline-block;background:#6c80e0;color:#fff;padding:10px 18px;border-radius:10px;text-decoration:none;font-weight:bold">Open Web Monitor</a></p>
<p style="color:#8a90b0;font-size:12px">You get this email once or twice during your trial. Web Monitor by Ruya Lab.</p></div>`;
  const text = [hello, '', ...lines, '', `${app}/app`].join('\n');
  const res = await fetch(`${env.RESEND_API_BASE || 'https://api.resend.com'}/emails`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: env.REPORT_EMAIL_FROM, to: [user.email], subject, html, text }),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`Resend answered ${res.status}`);
}

