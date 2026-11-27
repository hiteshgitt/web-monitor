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
import { runtimeCvss } from './ratings.js';

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

/** CVSS v3.x base score from a vector string (FIRST CVSS v3.1 spec, section 7). null for anything it cannot score. */
export function cvss3Score(vector) {
  const parts = String(vector || '').split('/');
  if (!/^CVSS:3\.[01]$/.test(parts[0])) return null;
  const m = Object.fromEntries(parts.slice(1).map((p) => p.split(':')));
  const W = {
    AV: { N: 0.85, A: 0.62, L: 0.55, P: 0.2 }, AC: { L: 0.77, H: 0.44 }, UI: { N: 0.85, R: 0.62 },
    C: { H: 0.56, L: 0.22, N: 0 }, I: { H: 0.56, L: 0.22, N: 0 }, A: { H: 0.56, L: 0.22, N: 0 },
  };
  const scope = m.S;
  const pr = (scope === 'C' ? { N: 0.85, L: 0.68, H: 0.5 } : { N: 0.85, L: 0.62, H: 0.27 })[m.PR];
  const v = (k) => W[k][m[k]];
  if ((scope !== 'U' && scope !== 'C') || [v('AV'), v('AC'), v('UI'), v('C'), v('I'), v('A'), pr].some((x) => x === undefined)) return null;
  const iss = 1 - (1 - v('C')) * (1 - v('I')) * (1 - v('A'));
  const impact = scope === 'U' ? 6.42 * iss : 7.52 * (iss - 0.029) - 3.25 * (iss - 0.02) ** 15;
  if (impact <= 0) return 0;
  const exploitability = 8.22 * v('AV') * v('AC') * pr * v('UI');
  const roundUp = (x) => { const i = Math.round(x * 100000); return i % 10000 === 0 ? i / 100000 : (Math.floor(i / 10000) + 1) / 10; };
  return roundUp(Math.min(scope === 'U' ? impact + exploitability : 1.08 * (impact + exploitability), 10));
}

/** The advisory's CVSS: the highest-scoring v3.x vector, else a v4.0 vector without a score. */
export function advisoryCvss(advisory) {
  let best = null;
  for (const s of advisory.severity || []) {
    if (s.type !== 'CVSS_V3') continue;
    const score = cvss3Score(s.score);
    if (score !== null && (!best || score > best.score)) best = { score, vector: s.score };
  }
  if (best) return best;
  const v4 = (advisory.severity || []).find((s) => s.type === 'CVSS_V4' && /^CVSS:4\.0\//.test(s.score || ''));
  return v4 ? { score: null, vector: v4.score } : { score: null, vector: null };
}

/**
 * CVSS for a CVE from the NVD (used for Release Radar items, which have CVE ids but no package advisory).
 * Prefers the NVD's own (Primary) v3.x vector, else the highest-scoring one; v4.0 only as a vector. Cached a day;
 * a CVE the NVD has not scored yet is null, never guessed.
 */
export async function cveCvss(env, cve) {
  if (!/^CVE-\d{4}-\d{4,}$/.test(String(cve || ''))) return null;
  const data = await cachedReference(env, `nvd:${cve}`, `https://services.nvd.nist.gov/rest/json/cves/2.0?cveId=${cve}`, undefined, 24 * 3600e3);
  return nvdCvss(data);
}

export function nvdCvss(data) {
  const metrics = data?.vulnerabilities?.[0]?.cve?.metrics || {};
  const v3 = [...(metrics.cvssMetricV31 || []), ...(metrics.cvssMetricV30 || [])]
    .map((m) => ({ primary: m.type === 'Primary', vector: m.cvssData?.vectorString, score: cvss3Score(m.cvssData?.vectorString) }))
    .filter((m) => m.score !== null)
    .sort((a, b) => (b.primary - a.primary) || (b.score - a.score))[0];
  if (v3) return { score: v3.score, vector: v3.vector };
  const v4 = (metrics.cvssMetricV40 || []).find((m) => /^CVSS:4\.0\//.test(m.cvssData?.vectorString || ''));
  return v4 ? { score: null, vector: v4.cvssData.vectorString } : null;
}

const severityFromScore = (n) => (n >= 9 ? 'critical' : n >= 7 ? 'high' : n >= 4 ? 'moderate' : n > 0 ? 'low' : 'unknown');

export function advisorySeverity(advisory) {
  const s = String(advisory.database_specific?.severity || '').toLowerCase();
  if (SEVERITY_RANK[s] !== undefined) return s === 'medium' ? 'moderate' : s;
  const { score } = advisoryCvss(advisory);
  return score === null ? 'unknown' : severityFromScore(score);
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
      cvss_score: advisoryCvss(a).score, cvss_vector: advisoryCvss(a).vector,
    };
    out.set(a.id, row);
    writes.push(env.DB.prepare(`INSERT INTO osv_vulns (id, summary, severity, aliases, fixed, url, fetched_at, cvss_score, cvss_vector) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT (id) DO UPDATE SET summary = excluded.summary, severity = excluded.severity, aliases = excluded.aliases,
      fixed = excluded.fixed, url = excluded.url, fetched_at = excluded.fetched_at, cvss_score = excluded.cvss_score, cvss_vector = excluded.cvss_vector`)
      .bind(row.id, row.summary, row.severity, row.aliases, row.fixed, row.url, row.fetched_at, row.cvss_score, row.cvss_vector));
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
    // The package's CVSS is its highest-scoring advisory (a vector without a score only when none can be scored).
    const scored = rows.filter((r) => r.cvss_score != null).sort((p, q) => q.cvss_score - p.cvss_score)[0];
    const cvss = scored ? { score: scored.cvss_score, vector: scored.cvss_vector } : rows.find((r) => r.cvss_vector) ? { score: null, vector: rows.find((r) => r.cvss_vector).cvss_vector } : null;
    return {
      cvss,
      name: h.name, version: h.version, ids: h.ids.slice(0, 10), severity: worst,
      summary: rows[0]?.summary || null, fixed: fixes[0] || null, // the highest first-fix covers every advisory listed
      aliases: rows.flatMap((r) => parseJson(r.aliases) || []).slice(0, 5), url: rows[0]?.url || `https://osv.dev/list?q=${encodeURIComponent(h.name)}`,
    };
  }).sort((p, q) => SEVERITY_RANK[q.severity] - SEVERITY_RANK[p.severity]);
}

// ---------- WordPress plugins ----------
// Matched against wp_vulns: WordPress plugin CVEs from the official CVE List, loaded by the wp-vulns GitHub Action.

const WP_DATA_MAX_AGE_MS = 3 * 24 * 3600e3;

/** Compares plugin versions segment by segment ("1.3.9.7" vs "1.3.10"); suffixes after the numbers are ignored. */
export function compareLoose(a, b) {
  const seg = (v) => (String(v || '').trim().replace(/^v/i, '').match(/^\d+(?:\.\d+)*/)?.[0] || '').split('.').filter(Boolean).map(Number);
  const x = seg(a); const y = seg(b);
  if (!x.length || !y.length) return null;
  for (let i = 0; i < Math.max(x.length, y.length); i += 1) {
    const p = x[i] || 0; const q = y[i] || 0;
    if (p !== q) return p < q ? -1 : 1;
  }
  return 0;
}

/** Whether `version` is in any of the ranges ([{from, lt, lte}] or [{exact}]). An unreadable version never matches. */
export function inRanges(version, ranges) {
  return (ranges || []).some((r) => {
    if (r.exact) return compareLoose(version, r.exact) === 0;
    if (r.from && (compareLoose(version, r.from) ?? -1) < 0) return false;
    if (r.lt) return compareLoose(version, r.lt) === -1;
    if (r.lte) { const c = compareLoose(version, r.lte); return c === -1 || c === 0; }
    return false;
  });
}

/** The version that clears every matched CVE: {fixed} when the CVEs name it, else {fixAbove} (newer than this). */
export function wpFix(rows) {
  let lt = null; let lte = null;
  for (const r of rows) for (const g of r.ranges) {
    if (g.lt && (!lt || compareLoose(g.lt, lt) === 1)) lt = g.lt;
    if (g.lte && (!lte || compareLoose(g.lte, lte) === 1)) lte = g.lte;
    if (g.exact && (!lte || compareLoose(g.exact, lte) === 1)) lte = g.exact;
  }
  if (lte && (!lt || compareLoose(lte, lt) >= 0)) return { fixed: null, fixAbove: lte };
  return { fixed: lt, fixAbove: null };
}

/** The installed plugins' slugs and versions, from the integration's plugin list. */
export function wpPluginItems(list) {
  return (Array.isArray(list) ? list : []).map((p) => {
    const file = String(p?.file || '');
    const slug = (file.includes('/') ? file.split('/')[0] : file.replace(/\.php$/i, '')).toLowerCase();
    return { kind: 'plugin', slug, name: String(p?.name || slug), version: String(p?.version || '').trim() };
  }).filter((p) => /^[a-z0-9][a-z0-9_-]{0,99}$/.test(p.slug) && p.version);
}

/** The installed themes (integration 1.7.0+): slug is the theme's directory. */
export function wpThemeItems(list) {
  return (Array.isArray(list) ? list : []).map((t) => {
    const slug = String(t?.slug || '').toLowerCase();
    return { kind: 'theme', slug, name: String(t?.name || slug), version: String(t?.version || '').trim(), active: Boolean(t?.is_active) };
  }).filter((t) => /^[a-z0-9][a-z0-9_-]{0,99}$/.test(t.slug) && t.version);
}

/**
 * Vulnerable WordPress plugins, in the same shape as vulnerablePackages(). Throws when the CVE data is missing or
 * older than three days, so stale data never turns into "no vulnerabilities".
 */
export async function vulnerableWpPlugins(env, plugins, now = new Date()) {
  const sync = await env.DB.prepare('SELECT synced_at FROM wp_vulns_sync WHERE id = 1').first();
  if (!sync || now.getTime() - Date.parse(sync.synced_at) > WP_DATA_MAX_AGE_MS) throw new Error('WordPress vulnerability data is missing or stale');
  const bySlug = new Map();
  const slugs = [...new Set(plugins.map((p) => p.slug))];
  for (let i = 0; i < slugs.length; i += 90) {
    const chunk = slugs.slice(i, i + 90);
    const { results } = await env.DB.prepare(`SELECT cve, kind, slug, title, ranges, cvss_score, cvss_vector, severity, url FROM wp_vulns
      WHERE slug IN (${chunk.map(() => '?').join(',')})`).bind(...chunk).all();
    for (const r of results) {
      const key = `${r.kind || 'plugin'}:${r.slug}`;
      if (!bySlug.has(key)) bySlug.set(key, []);
      bySlug.get(key).push({ ...r, ranges: parseJson(r.ranges) || [] });
    }
  }
  const out = [];
  for (const p of plugins) {
    const rows = (bySlug.get(`${p.kind || 'plugin'}:${p.slug}`) || []).filter((r) => inRanges(p.version, r.ranges))
      .sort((a, b) => (b.cvss_score ?? -1) - (a.cvss_score ?? -1) || SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity]);
    if (!rows.length) continue;
    const worst = rows.reduce((w, r) => (SEVERITY_RANK[r.severity] > SEVERITY_RANK[w] ? r.severity : w), 'unknown');
    out.push({
      name: p.name, slug: p.slug, kind: p.kind || 'plugin', version: p.version, ecosystem: 'wordpress', ids: rows.map((r) => r.cve).slice(0, 10), severity: worst,
      summary: rows[0].title, ...wpFix(rows), aliases: rows.map((r) => r.cve).slice(0, 5), url: rows[0].url,
      cvss: rows[0].cvss_score != null ? { score: rows[0].cvss_score, vector: rows[0].cvss_vector } : null,
    });
  }
  return out.sort((a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity] || (b.cvss?.score ?? -1) - (a.cvss?.score ?? -1));
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
  // Not a single published CVE, so the CVSS is rated for the issue type (see ratings.js).
  return out.map((issue) => ({ ...issue, cvss: runtimeCvss(issue) }));
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
  const endpoint = site.platform === 'nextjs' ? 'libraries' : PHP_PLATFORMS.includes(site.platform) ? 'packages' : site.platform === 'wordpress' ? 'plugins' : null;
  if (!endpoint) return null;
  const data = await fetchIntegration(site, endpoint);
  if (!data || data.error) return null;
  if (site.platform === 'wordpress') {
    if (!Array.isArray(data.all_plugins)) return null;
    const themes = Array.isArray(data.all_themes); // integration 1.7.0+
    return { ecosystem: 'wordpress', items: [...wpPluginItems(data.all_plugins), ...wpThemeItems(data.all_themes)], themes };
  }
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
    ...fresh.packages.slice(0, 3).map((p) => `${p.name} ${p.version} (${p.severity}${p.cvss?.score != null ? `, CVSS ${p.cvss.score}` : ''}${p.aliases[0] ? `, ${p.aliases[0]}` : ''})${p.fixed ? `: update to ${p.fixed} or later` : p.fixAbove ? `: update to a version newer than ${p.fixAbove}` : ''}`),
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
  const due = new Set(sites.filter((s) => s.platform === 'nextjs' || s.platform === 'wordpress' || PHP_PLATFORMS.includes(s.platform))
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
          after.packages = inv.ecosystem === 'wordpress' ? await vulnerableWpPlugins(env, inv.items, at) : await vulnerablePackages(env, inv.ecosystem, inv.items);
          packagesChecked = true;
          checked += 1;
          after.themesChecked = inv.ecosystem === 'wordpress' ? Boolean(inv.themes) : undefined;
          // RuyaShield turns these into findings for organizations that verified this site (if connected).
          // WordPress plugins are not shared yet: RuyaShield's package check knows npm and Composer only.
          if (inv.ecosystem !== 'wordpress') {
            await shareVulnerablePackages(env, site, inv.ecosystem, after.packages)
              .catch((error) => console.error('sharing packages with RuyaShield failed', site.id, error.message));
          }
        }
      } catch (error) {
        failed += 1;
        console.error('vulnerability check failed', site.id, error.message);
      }
    }
    // "All OK" needs a complete check: release lists loaded, and (for Next.js / PHP framework sites) the packages checked.
    const checksPackages = site.platform === 'nextjs' || site.platform === 'wordpress' || PHP_PLATFORMS.includes(site.platform);
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
      ...(after.themesChecked !== undefined ? { themesChecked: after.themesChecked } : {}),
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
