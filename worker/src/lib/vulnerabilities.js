// Known vulnerabilities on a monitored site (Pro):
// - packages: installed npm / Composer packages (from the site's integration) checked against OSV.dev, the open
//   vulnerability database that includes the GitHub advisories for npm and Packagist. Only {ecosystem, name,
//   version} is sent.
// - runtime: the PHP, Node.js and WordPress versions from the health response, against end-of-life dates
//   (endoflife.date), Node.js security releases (nodejs.org) and WordPress.org's stable-check.
// New problems raise a 'vulnerability' notification; problems already known do not alert again.
import { shareVulnerablePackages } from './ruyashield.js';
import { detectReleases, draftFromFeeds, syncAdvisories } from './advisories.js';
import { notificationStatement, notifyAdmins } from './alerts.js';
import { nowIso, parseJson } from './util.js';

const OSV = 'https://api.osv.dev/v1';
const ECOSYSTEM = { npm: 'npm', packagist: 'Packagist' };
const VULN_TTL_MS = 24 * 3600e3;
const REFERENCE_TTL_MS = 6 * 3600e3;
const MAX_NEW_DETAILS = 8;      // advisory details fetched per site per run (the rest come from the cache later)
const SEVERITY_RANK = { critical: 4, high: 3, moderate: 2, medium: 2, low: 1, unknown: 0 };

// ---------- versions ----------

export function parseSemver(v) {
  const m = String(v || '').trim().replace(/^[v=^~]+/i, '').match(/^(\d+)(?:\.(\d+))?(?:\.(\d+))?/);
  return m ? [Number(m[1]), Number(m[2] || 0), Number(m[3] || 0)] : null;
}
export function compareVersions(a, b) {
  const x = parseSemver(a); const y = parseSemver(b);
  if (!x || !y) return null;
  for (let i = 0; i < 3; i += 1) if (x[i] !== y[i]) return x[i] < y[i] ? -1 : 1;
  return 0;
}

/** The first fixed version above `installed` in an OSV advisory for this package, or null. */
export function fixedVersion(advisory, ecosystem, name, installed) {
  const fixes = [];
  for (const a of advisory.affected || []) {
    if (a.package?.ecosystem !== ecosystem || a.package?.name?.toLowerCase() !== name.toLowerCase()) continue;
    for (const r of a.ranges || []) for (const e of r.events || []) if (e.fixed && compareVersions(e.fixed, installed) === 1) fixes.push(e.fixed);
  }
  return fixes.sort((p, q) => compareVersions(p, q))[0] || null;
}

export function advisorySeverity(advisory) {
  const s = String(advisory.database_specific?.severity || '').toLowerCase();
  if (SEVERITY_RANK[s] !== undefined) return s === 'medium' ? 'moderate' : s;
  return 'unknown';
}

// ---------- caches ----------

export async function cachedReference(env, key, url, parse = (t) => JSON.parse(t), ttlMs = REFERENCE_TTL_MS, init = {}) {
  const row = await env.DB.prepare('SELECT body, fetched_at FROM reference_cache WHERE key = ?').bind(key).first();
  if (row && Date.now() - Date.parse(row.fetched_at) < ttlMs) return parse(row.body);
  try {
    const res = await fetch(url, { ...init, headers: { Accept: 'application/json', 'User-Agent': 'WebMonitor (+https://webmonitor.ruyalab.com)', ...(init.headers || {}) }, signal: AbortSignal.timeout(10000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    const value = parse(text);
    await env.DB.prepare(`INSERT INTO reference_cache (key, body, fetched_at) VALUES (?, ?, ?)
      ON CONFLICT (key) DO UPDATE SET body = excluded.body, fetched_at = excluded.fetched_at`).bind(key, text, nowIso()).run();
    return value;
  } catch (error) {
    console.error('reference fetch failed', key, error.message);
    return row ? parse(row.body) : null; // stale beats nothing; never invent an answer
  }
}

async function advisories(env, ids) {
  const out = new Map();
  if (!ids.length) return out;
  const { results } = await env.DB.prepare(`SELECT * FROM osv_vulns WHERE id IN (${ids.map(() => '?').join(',')})`).bind(...ids).all();
  for (const r of results) if (Date.now() - Date.parse(r.fetched_at) < VULN_TTL_MS) out.set(r.id, r);
  const missing = ids.filter((id) => !out.has(id)).slice(0, MAX_NEW_DETAILS);
  const fetched = await Promise.all(missing.map(async (id) => {
    try {
      const res = await fetch(`${OSV}/vulns/${encodeURIComponent(id)}`, { signal: AbortSignal.timeout(10000) });
      return res.ok ? await res.json() : null;
    } catch { return null; }
  }));
  const writes = [];
  for (const a of fetched.filter(Boolean)) {
    const fixed = {};
    for (const af of a.affected || []) {
      const key = `${af.package?.ecosystem}|${String(af.package?.name || '').toLowerCase()}`;
      fixed[key] = (af.ranges || []).flatMap((r) => (r.events || []).filter((e) => e.fixed).map((e) => e.fixed));
    }
    const row = {
      id: a.id, summary: String(a.summary || a.details || '').slice(0, 300), severity: advisorySeverity(a),
      aliases: JSON.stringify((a.aliases || []).filter((x) => /^CVE-/.test(x)).slice(0, 5)), fixed: JSON.stringify(fixed),
      url: (a.references || []).find((r) => r.type === 'ADVISORY')?.url || `https://osv.dev/vulnerability/${a.id}`, fetched_at: nowIso(),
    };
    out.set(a.id, row);
    writes.push(env.DB.prepare(`INSERT INTO osv_vulns (id, summary, severity, aliases, fixed, url, fetched_at) VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT (id) DO UPDATE SET summary = excluded.summary, severity = excluded.severity, aliases = excluded.aliases,
      fixed = excluded.fixed, url = excluded.url, fetched_at = excluded.fetched_at`)
      .bind(row.id, row.summary, row.severity, row.aliases, row.fixed, row.url, row.fetched_at));
  }
  if (writes.length) await env.DB.batch(writes);
  return out;
}

const firstFixAbove = (row, ecosystem, name, installed) => {
  const list = parseJson(row.fixed)?.[`${ecosystem}|${name.toLowerCase()}`] || [];
  return list.filter((v) => compareVersions(v, installed) === 1).sort((p, q) => compareVersions(p, q))[0] || null;
};

// ---------- packages ----------

const isPlatformReq = (name) => /^(php|hhvm|composer(-[\w-]+)?|ext-[\w-]+|lib-[\w-]+)$/i.test(name);

/**
 * Checks installed packages against OSV. `packages`: [{name, version}] for one ecosystem ('npm' | 'packagist').
 * Returns [{name, version, ids, severity, summary, fixed, aliases, url}] for vulnerable ones, worst first.
 * Throws when OSV cannot be asked, so a failed check is never mistaken for "no vulnerabilities".
 */
export async function vulnerablePackages(env, ecosystemKey, packages) {
  const ecosystem = ECOSYSTEM[ecosystemKey];
  const list = [];
  const seen = new Set();
  for (const p of packages || []) {
    const name = String(p?.name || '').trim();
    const version = String(p?.version || '').replace(/^[v=^~]+/, '').trim();
    if (!name || !parseSemver(version) || isPlatformReq(name) || seen.has(`${name}@${version}`)) continue;
    seen.add(`${name}@${version}`);
    list.push({ name, version });
  }
  if (!ecosystem || !list.length) return [];
  const res = await fetch(`${OSV}/querybatch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ queries: list.slice(0, 1000).map((p) => ({ package: { ecosystem, name: p.name }, version: p.version })) }),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`OSV answered ${res.status}`);
  const results = (await res.json()).results || [];
  const hits = list.map((p, i) => ({ ...p, ids: (results[i]?.vulns || []).map((v) => v.id) })).filter((p) => p.ids.length);
  const details = await advisories(env, [...new Set(hits.flatMap((h) => h.ids))]);
  return hits.map((h) => {
    const rows = h.ids.map((id) => details.get(id)).filter(Boolean);
    const worst = rows.reduce((w, r) => (SEVERITY_RANK[r.severity] > SEVERITY_RANK[w] ? r.severity : w), 'unknown');
    const fixes = rows.map((r) => firstFixAbove(r, ecosystem, h.name, h.version)).filter(Boolean).sort((p, q) => compareVersions(q, p));
    return {
      name: h.name, version: h.version, ids: h.ids.slice(0, 10), severity: worst,
      summary: rows[0]?.summary || null, fixed: fixes[0] || null, // the highest first-fix covers every advisory listed
      aliases: rows.flatMap((r) => parseJson(r.aliases) || []).slice(0, 5), url: rows[0]?.url || `https://osv.dev/list?q=${encodeURIComponent(h.name)}`,
    };
  }).sort((p, q) => SEVERITY_RANK[q.severity] - SEVERITY_RANK[p.severity]);
}

// ---------- runtime ----------

const cycleOf = (version, depth) => (parseSemver(version) || []).slice(0, depth).join('.');

/** Runtime problems for {php, node, wordpress}: [{key, component, version, severity, title, fix}]. Pure given the data. */
export function runtimeIssues(runtime, { php, node, nodeReleases, wordpress }, today = new Date()) {
  const out = [];
  const day = today.toISOString().slice(0, 10);
  if (runtime?.php && Array.isArray(php)) {
    const cycle = php.find((c) => c.cycle === cycleOf(runtime.php, 2));
    if (cycle && cycle.eol && cycle.eol <= day) {
      out.push({ key: `php-eol-${cycle.cycle}`, component: 'PHP', version: runtime.php, severity: 'high', title: `PHP ${cycle.cycle} is past end of life (${cycle.eol})`, fix: `Move to a supported PHP version (${php.filter((c) => c.eol > day).map((c) => c.cycle).slice(-1)[0] || 'current'} or newer).` });
    } else if (cycle?.latest && compareVersions(runtime.php, cycle.latest) === -1) {
      // PHP patch releases are security releases; running behind one is a high-severity gap.
      out.push({ key: `php-patch-${cycle.latest}`, component: 'PHP', version: runtime.php, severity: 'high', title: `PHP ${runtime.php} is behind ${cycle.latest}, which includes security fixes`, fix: `Update PHP to ${cycle.latest} (same ${cycle.cycle} branch).` });
    }
  }
  if (runtime?.node && Array.isArray(node)) {
    const major = cycleOf(runtime.node, 1);
    const cycle = node.find((c) => String(c.cycle) === major);
    if (cycle && cycle.eol && cycle.eol <= day) {
      out.push({ key: `node-eol-${major}`, component: 'Node.js', version: runtime.node, severity: 'high', title: `Node.js ${major} is past end of life (${cycle.eol})`, fix: 'Move to a supported Node.js LTS version.' });
    } else if (Array.isArray(nodeReleases)) {
      // A later release on the same major line marked as a security release means this one has known fixes missing.
      const sec = nodeReleases.filter((r) => r.security && cycleOf(r.version, 1) === major && compareVersions(r.version, runtime.node) === 1)
        .sort((p, q) => compareVersions(q.version, p.version))[0];
      if (sec) {
        const latest = nodeReleases.filter((r) => cycleOf(r.version, 1) === major).sort((p, q) => compareVersions(q.version, p.version))[0];
        out.push({ key: `node-sec-${sec.version}`, component: 'Node.js', version: runtime.node, severity: 'high', title: `Node.js ${runtime.node} is missing the security release ${sec.version}`, fix: `Update Node.js to ${latest?.version || sec.version}.` });
      }
    }
  }
  if (runtime?.wordpress && wordpress && typeof wordpress === 'object') {
    const state = wordpress[runtime.wordpress];
    const latest = Object.entries(wordpress).find(([, s]) => s === 'latest')?.[0];
    if (state === 'insecure') {
      out.push({ key: `wp-insecure-${runtime.wordpress}`, component: 'WordPress', version: runtime.wordpress, severity: 'high', title: `WordPress ${runtime.wordpress} has known security issues`, fix: `Update WordPress to ${latest || 'the latest version'}.` });
    }
  }
  return out;
}

async function runtimeReference(env, runtime) {
  return {
    // Hourly for PHP and Node.js release lists, so a security release is picked up on the next run.
    php: runtime?.php ? await cachedReference(env, 'eol:php', 'https://endoflife.date/api/php.json', undefined, 3600e3) : null,
    node: runtime?.node ? await cachedReference(env, 'eol:nodejs', 'https://endoflife.date/api/nodejs.json') : null,
    nodeReleases: runtime?.node ? await cachedReference(env, 'node:releases', 'https://nodejs.org/dist/index.json',
      (t) => JSON.parse(t).filter((r) => !/-/.test(r.version)).map((r) => ({ version: r.version.replace(/^v/, ''), security: Boolean(r.security) })), 3600e3) : null,
    wordpress: runtime?.wordpress ? await cachedReference(env, 'wp:stable', 'https://api.wordpress.org/core/stable-check/1.0/') : null,
  };
}

// ---------- the job ----------

/** What a clean check covered, in words, for the "all OK" notification. */
function okScope(site, runtime) {
  const parts = [];
  if (runtime.php) parts.push(`PHP ${runtime.php}`);
  if (runtime.node) parts.push(`Node.js ${runtime.node}`);
  if (runtime.wordpress) parts.push(`WordPress ${runtime.wordpress}`);
  if (runtime.nextjs) parts.push(`Next.js ${runtime.nextjs}`);
  const pk = site.platform === 'nextjs' ? 'its npm packages' : ['laravel', 'php', 'codeigniter'].includes(site.platform) ? 'its Composer packages' : null;
  return `Checked ${[...parts, pk].filter(Boolean).join(', ')} against known vulnerabilities, end-of-life dates and security releases: nothing found.`;
}

const PACKAGE_RECHECK_MS = 12 * 3600e3;
// Per run: 3 sites × (1 integration call + 1 OSV batch + ≤8 advisories + 1 RuyaShield report) + ≤4 reference lists ≈ 37 of 50.
const PACKAGE_SITES_PER_RUN = 3;
const PHP_PLATFORMS = ['laravel', 'php', 'codeigniter'];

/** The site's installed packages from its integration, or null when it cannot report them. */
async function installedPackages(site, fetchIntegration) {
  const endpoint = site.platform === 'nextjs' ? 'libraries' : PHP_PLATFORMS.includes(site.platform) ? 'packages' : null;
  if (!endpoint) return null;
  const data = await fetchIntegration(site, endpoint);
  if (!data || data.error) return null;
  const items = data.all_libraries || data.all_packages || [];
  return Array.isArray(items) ? { ecosystem: site.platform === 'nextjs' ? 'npm' : 'packagist', items } : null;
}

const issueKey = (p) => `${p.name}@${p.version}:${p.ids.join(',')}`;

/** Alerts for what is new since `before`. */
export function newProblems(before, after) {
  const old = new Set([...(before?.packages || []).map(issueKey), ...(before?.runtime || []).map((r) => r.key)]);
  return {
    packages: (after.packages || []).filter((p) => !old.has(issueKey(p))),
    runtime: (after.runtime || []).filter((r) => !old.has(r.key)),
  };
}

function alertFor(site, fresh) {
  const n = fresh.packages.length + fresh.runtime.length;
  if (!n) return null;
  const parts = [
    ...fresh.runtime.map((r) => `${r.title}. ${r.fix}`),
    ...fresh.packages.slice(0, 3).map((p) => `${p.name} ${p.version} (${p.severity}${p.aliases[0] ? `, ${p.aliases[0]}` : ''})${p.fixed ? `: update to ${p.fixed} or later` : ''}`),
  ];
  if (fresh.packages.length > 3) parts.push(`and ${fresh.packages.length - 3} more package(s)`);
  return {
    userId: site.owner_id, websiteId: site.id, type: 'vulnerability',
    title: `${site.name}: ${n === 1 ? 'a known vulnerability' : `${n} known vulnerabilities`} found`,
    body: `${parts.map((x) => x.replace(/\.+$/, '')).join('. ')}.`.slice(0, 900),
  };
}

/**
 * Hourly (own cron, own request budget): runtime checks for every Pro site, package checks for a few Pro sites
 * whose last package check is older than 12 hours. `fetchIntegration(site, endpoint)` reads the site's integration.
 */
export async function scanVulnerabilities(env, fetchIntegration, at = new Date()) {
  const { results: sites } = await env.DB.prepare(`SELECT w.* FROM websites w JOIN users u ON u.id = w.owner_id
    WHERE (u.plan = 'pro' OR u.role = 'admin') AND u.status = 'active' AND w.monitoring_enabled = 1`).all();
  const cutoff = new Date(at.getTime() - PACKAGE_RECHECK_MS).toISOString();
  const due = new Set(sites.filter((s) => s.platform === 'nextjs' || PHP_PLATFORMS.includes(s.platform))
    .filter((s) => !s.vulns_checked_at || s.vulns_checked_at < cutoff)
    .sort((a, b) => (a.vulns_checked_at || '').localeCompare(b.vulns_checked_at || ''))
    .slice(0, PACKAGE_SITES_PER_RUN).map((s) => s.id));

  const statements = [];
  let checked = 0; let alerts = 0; let failed = 0;
  for (const site of sites) {
    const runtime = parseJson(site.runtime) || {};
    const before = parseJson(site.vulnerabilities) || { packages: [], runtime: [] };
    const after = { ...before };
    const reference = await runtimeReference(env, runtime);
    after.runtime = runtimeIssues(runtime, reference, at);
    // Complete only when every release list this site needs loaded; otherwise "no issues" could just be "no data".
    const runtimeComplete = (!runtime.php || reference.php) && (!runtime.node || (reference.node && reference.nodeReleases)) && (!runtime.wordpress || reference.wordpress);
    let packagesChecked = false;
    if (due.has(site.id)) {
      try {
        const inv = await installedPackages(site, fetchIntegration);
        if (inv) {
          after.packages = await vulnerablePackages(env, inv.ecosystem, inv.items);
          packagesChecked = true;
          checked += 1;
          // RuyaShield turns these into findings for organizations that verified this site (if connected).
          await shareVulnerablePackages(env, site, inv.ecosystem, after.packages)
            .catch((error) => console.error('sharing packages with RuyaShield failed', site.id, error.message));
        }
      } catch (error) {
        failed += 1;
        console.error('vulnerability check failed', site.id, error.message);
      }
    }
    // "All OK" needs a complete check: release lists loaded, and (for Next.js / PHP framework sites) the packages checked.
    const checksPackages = site.platform === 'nextjs' || PHP_PLATFORMS.includes(site.platform);
    const complete = runtimeComplete && (!checksPackages || packagesChecked || Boolean(before.checkedAt));
    const total = (after.packages || []).length + after.runtime.length;
    const beforeTotal = (before.packages || []).length + (before.runtime || []).length;
    const anyData = Object.values(runtime).some(Boolean);
    const okAlert = complete && anyData && total === 0 && (beforeTotal > 0 || !before.okNotified) ? {
      userId: site.owner_id, websiteId: site.id, type: 'vulnerability_ok',
      title: beforeTotal > 0 ? `All clear on ${site.name}: no known vulnerabilities left` : `Checked: no known vulnerabilities on ${site.name}`,
      body: `${okScope(site, runtime)} We keep checking and tell you as soon as something new affects this site.`,
    } : null;
    const json = JSON.stringify({ packages: after.packages || [], runtime: after.runtime, checkedAt: packagesChecked ? at.toISOString() : before.checkedAt || null,
      okNotified: Boolean(before.okNotified || okAlert) });
    if (json !== (site.vulnerabilities || null) || packagesChecked) {
      statements.push(env.DB.prepare(`UPDATE websites SET vulnerabilities = ?${packagesChecked ? ', vulns_checked_at = ?' : ''} WHERE id = ?`)
        .bind(...(packagesChecked ? [json, at.toISOString(), site.id] : [json, site.id])));
    }
    // The first check of a site alerts on everything it finds; after that only new problems alert.
    const fresh = site.vulnerabilities ? newProblems(before, after) : { packages: after.packages || [], runtime: after.runtime };
    const alert = alertFor(site, fresh);
    if (alert) {
      statements.push(notificationStatement(env.DB, alert, at));
      alerts += 1;
    }
    if (okAlert) statements.push(notificationStatement(env.DB, okAlert, at));
  }
  if (statements.length) await env.DB.batch(statements);
  // Release Radar: fixes that just shipped, then new matches, upgrade targets and "patched" (the health check keeps
  // runtime versions current).
  const released = await detectReleases(env, cachedReference, at).catch((error) => ({ error: error.message }));
  const drafts = await draftFromFeeds(env, cachedReference, notifyAdmins, at).catch((error) => ({ error: error.message }));
  const radar = { released, drafts, ...(await syncAdvisories(env, at).catch((error) => ({ error: error.message }))) };
  return { sites: sites.length, packagesChecked: checked, alerts, failed, radar };
}

/**
 * For the Advanced view: marks each package of a Next.js / PHP inventory (after withUpdates) with its known
 * vulnerabilities and adds a `vulnerable` list. A failed lookup says so instead of showing "none found".
 */
export async function withVulnerabilities(env, data) {
  if (!data || data.error || !data.ecosystem) return data;
  const listKey = data.all_libraries ? 'all_libraries' : data.all_packages ? 'all_packages' : null;
  if (!listKey) return data;
  let found;
  try {
    found = await vulnerablePackages(env, data.ecosystem, data[listKey]);
  } catch (error) {
    console.error('vulnerability lookup failed', error.message);
    return { ...data, vulnerability_check: 'failed' };
  }
  const byKey = new Map(found.map((v) => [`${v.name}@${v.version}`, v]));
  const mark = (i) => {
    const v = i?.name ? byKey.get(`${i.name}@${String(i.version || '').replace(/^[v=^~]+/, '').trim()}`) : null;
    return v ? { ...i, vulnerabilities: { severity: v.severity, ids: v.ids, aliases: v.aliases, fixed: v.fixed, summary: v.summary, url: v.url } } : i;
  };
  return {
    ...data,
    [listKey]: data[listKey].map(mark),
    dependencies: (data.dependencies || []).map(mark),
    devDependencies: (data.devDependencies || []).map(mark),
    vulnerable: found,
    vulnerable_count: found.length,
    vulnerability_check: 'ok',
  };
}
