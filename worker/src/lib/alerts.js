// Customer alerts: turning check results into notifications (each problem announced once, plus its recovery),
// and the per-customer choice of which alert types are pushed to their phone and browser.
import { DOWN_STATUSES, newId, parseJson } from './util.js';

// Alert types the customer can switch on/off for push. Every alert is still kept in the in-app history.
export const ALERT_TYPES = [
  { key: 'downtime', label: 'Site down and recovered', description: 'When a site stops answering, and when it is back.' },
  { key: 'slow', label: 'Slow responses', description: 'When a site gets slower than its alert threshold.' },
  { key: 'components', label: 'Site components', description: 'When the database, queue worker, scheduler, cron, disk or another part of a site fails, and when it recovers.' },
  { key: 'plugins', label: 'Plugin updates', description: 'When plugins or packages have updates waiting.' },
  { key: 'ssl', label: 'SSL problems', description: 'When HTTPS stops working on a site.' },
  { key: 'security', label: 'Security', description: 'When a site’s security score drops below 70, or a known vulnerability is found in its PHP, Node.js, WordPress or packages (Pro).' },
  { key: 'ruyashield', label: 'RuyaShield findings', description: 'When RuyaShield finds a new critical or high issue on a site, and when they are all fixed.' },
  { key: 'account', label: 'Account and plan', description: 'Pro plan approved or declined.' },
];
export const ADMIN_ALERT_TYPES = [
  { key: 'admin_requests', label: 'Customer requests', description: 'When a customer asks for Pro or reports a Zealot answer.' },
  { key: 'admin_signups', label: 'Sign-ups and deletions', description: 'When someone creates or deletes an account.' },
];

// notification.type -> preference key
const CATEGORY = {
  site_down: 'downtime', site_up: 'downtime', change_suspect: 'downtime', slow: 'slow', slow_ok: 'slow', plugins: 'plugins',
  ssl_off: 'ssl', ssl_ok: 'ssl', security_low: 'security', vulnerability: 'security', advisory: 'security', advisory_patched: 'security', pro_approved: 'account', pro_declined: 'account',
  pro_ended: 'account', trial_started: 'account', trial_ending: 'account', trial_ended: 'account',
  ruyashield_critical: 'ruyashield', ruyashield_high: 'ruyashield', ruyashield_ok: 'ruyashield',
  component_failed: 'components', component_ok: 'components',
  pro_request: 'admin_requests', ai_report: 'admin_requests', signup: 'admin_signups', account_deleted: 'admin_signups',
};
export const categoryOf = (type) => CATEGORY[type] || type;

// Stored prefs merged over the defaults (everything on)
export function notifyPrefs(user) {
  const stored = parseJson(user?.notify_prefs) || {};
  const prefs = { push: stored.push !== false };
  for (const { key } of [...ALERT_TYPES, ...ADMIN_ALERT_TYPES]) prefs[key] = stored[key] !== false;
  return prefs;
}

export const wantsPush = (prefs, type) => prefs.push && prefs[categoryOf(type)] !== false;

export const SECURITY_ALERT_BELOW = 70;
// A site counts as fast again only well under the threshold, so it doesn't flip every minute
const SLOW_RECOVERY_FACTOR = 0.8;

export function notificationStatement(db, { userId, websiteId = null, type, title, body = '' }, at = new Date()) {
  return db.prepare(`INSERT INTO notifications (id, user_id, website_id, type, title, body, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)`).bind(newId(), userId, websiteId, type, title, body, at.toISOString());
}

// Notify every super admin (new sign-up, Pro request)
export async function notifyAdmins(db, alert) {
  const { results } = await db.prepare('SELECT id FROM admins WHERE totp_enabled = 1').all();
  if (results.length === 0) return;
  await db.batch(results.map((admin) => notificationStatement(db, { ...alert, userId: admin.id })));
}

// Statements for the alerts one check result causes (and the site's new alert_state), possibly none.
// `site.status` is the status before this check, so "down twice in a row" filters out one-off blips.
export function alertStatements(db, site, result, at = new Date()) {
  const before = parseJson(site.alert_state) || {};
  const state = { ...before };
  const alerts = [];
  const add = (type, title, body) => alerts.push({ userId: site.owner_id, websiteId: site.id, type, title, body });
  const name = site.name;

  const isDown = DOWN_STATUSES.includes(result.status);
  if (isDown && DOWN_STATUSES.includes(site.status) && !state.down) {
    state.down = true;
    // A diagnosed cause leads, with what to do about it.
    const why = result.error?.message || `The site reported "${result.status}".`;
    add('site_down', `${name} is down`, result.error?.hint ? `${why} What to do: ${result.error.hint}` : why);
  } else if (!isDown && state.down) {
    state.down = false;
    add('site_up', `${name} is back up`, result.responseTime != null ? `Answering again in ${Math.round(result.responseTime)} ms.` : 'Answering again.');
  }

  const threshold = site.alert_response_ms || 5000;
  if (!isDown && result.responseTime != null) {
    if (!state.slow && result.responseTime > threshold) {
      state.slow = true;
      add('slow', `${name} is slow`, `Responded in ${Math.round(result.responseTime)} ms (your alert threshold is ${threshold} ms).`);
    } else if (state.slow && result.responseTime < threshold * SLOW_RECOVERY_FACTOR) {
      state.slow = false;
      add('slow_ok', `${name} is fast again`, `Responded in ${Math.round(result.responseTime)} ms.`);
    }
  }

  // Components (database, queue, cron, disk...): alert when one is failing on two checks in a row, and when
  // it recovers. Warnings are shown on the site page but do not alert.
  if (Array.isArray(result.components)) {
    const previous = new Map((parseJson(site.components) || []).map((c) => [c.id, c.status]));
    const alerted = { ...(state.components || {}) };
    for (const c of result.components) {
      const failing = c.status === 'error';
      if (failing && previous.get(c.id) === 'error' && !alerted[c.id]) {
        alerted[c.id] = true;
        add('component_failed', `${c.name} failing on ${name}`, c.hint ? `${c.message} What to do: ${c.hint}` : c.message);
      } else if (!failing && c.status === 'ok' && alerted[c.id]) {
        delete alerted[c.id];
        add('component_ok', `${c.name} is working again on ${name}`, c.message);
      }
    }
    // Components that disappeared from the report are forgotten.
    for (const id of Object.keys(alerted)) if (!result.components.some((c) => c.id === id)) delete alerted[id];
    if (Object.keys(alerted).length) state.components = alerted;
    else delete state.components;
  }

  // Integration details (refreshed every DETAILS_REFRESH_MINUTES)
  const security = result.details?.security;
  if (security) {
    const outdated = Number(security.outdatedPlugins) || 0;
    if (outdated > (state.outdated || 0)) {
      add('plugins', `Updates waiting on ${name}`, `${outdated} plugin${outdated === 1 ? '' : 's'} or package${outdated === 1 ? '' : 's'} can be updated.`);
    }
    state.outdated = outdated;

    // Behind a proxy the integration can report "disabled" although HTTPS works; an https:// URL that
    // answered our check proves it does, so only plain-http sites count
    const sslOff = security.sslStatus === 'disabled' && !/^https:\/\//i.test(site.url);
    if (sslOff && !state.sslOff) add('ssl_off', `${name} is not using HTTPS`, 'Visitors may see a “Not secure” warning. Enable SSL on the site.');
    else if (!sslOff && state.sslOff) add('ssl_ok', `SSL is working on ${name}`, 'HTTPS is back to normal.');
    state.sslOff = sslOff;

    const score = security.securityScore;
    const low = score != null && score < SECURITY_ALERT_BELOW;
    if (low && !state.securityLow) add('security_low', `Security score dropped on ${name}`, `Now ${score}/100. Open the Security tab to see what to fix.`);
    state.securityLow = low;
  }

  const statements = alerts.map((alert) => notificationStatement(db, alert, at));
  if (JSON.stringify(state) !== JSON.stringify(before)) {
    statements.push(db.prepare('UPDATE websites SET alert_state = ? WHERE id = ?').bind(JSON.stringify(state), site.id));
  }
  return statements;
}

// RuyaShield: alerts when open critical/high findings on a site go up, and an all-clear when they reach zero.
// `before` is the per-host state from the last answer alerts were raised against; a host seen for the first
// time only sets the baseline, so connecting does not announce findings the customer can already see.
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

export function ruyashieldAlerts(sites, before, posture) {
  const state = { ...(before || {}) };
  const alerts = [];
  const byHost = new Map((posture?.hosts || []).filter((h) => h.tracked && h.findings).map((h) => [h.host, h]));
  const seen = new Set();
  for (const site of sites) {
    let host;
    try { host = new URL(site.url).hostname.toLowerCase(); } catch { continue; }
    const entry = byHost.get(host) || byHost.get(host.replace(/^www\./, ''));
    if (!entry) continue;
    const { critical = 0, high = 0 } = entry.findings.open;
    const titles = entry.findings.top.filter((f) => f.severity === 'critical' || f.severity === 'high').map((f) => f.title);
    const prev = state[entry.host];
    seen.add(entry.host);
    if (prev) {
      const fresh = titles.filter((t) => !(prev.titles || []).includes(t));
      const detail = fresh.length ? fresh.join('; ') : 'Open the Security tab to see the details.';
      if (critical > prev.critical) {
        alerts.push({ userId: site.owner_id, websiteId: site.id, type: 'ruyashield_critical',
          title: `${plural(critical - prev.critical, 'new critical finding')} on ${site.name}`, body: detail });
      } else if (high > prev.high) {
        alerts.push({ userId: site.owner_id, websiteId: site.id, type: 'ruyashield_high',
          title: `${plural(high - prev.high, 'new high finding')} on ${site.name}`, body: detail });
      } else if (prev.critical + prev.high > 0 && critical + high === 0) {
        alerts.push({ userId: site.owner_id, websiteId: site.id, type: 'ruyashield_ok',
          title: `No critical or high findings left on ${site.name}`, body: 'RuyaShield reports them all fixed or resolved.' });
      }
    }
  }
  for (const host of seen) {
    const entry = byHost.get(host);
    state[host] = {
      critical: entry.findings.open.critical || 0,
      high: entry.findings.open.high || 0,
      titles: entry.findings.top.filter((f) => f.severity === 'critical' || f.severity === 'high').map((f) => f.title),
    };
  }
  return { alerts, state };
}
