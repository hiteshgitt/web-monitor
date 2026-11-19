// Release Radar (Pro): security advisories for PHP, Node.js, WordPress and Next.js, followed per site from
// announcement to patch.
// - announced: a release is scheduled (e.g. "PHP security releases on 19 Nov, 14:00 UTC"). Affected sites' owners
//   get the mitigation now.
// - released:  fixed versions are known per branch. Owners get the exact upgrade target for each site.
// - patched:   the site's integration reports a fixed version (the one-minute health check). Owners hear
//   "patched in 3 h 12 min" and the fleet view counts it.
// Exposure rules (e.g. a PHP ini value) narrow "affected" to "exposed" when the integration reports its config.
import { notificationStatement } from './alerts.js';
import { compareVersions, parseSemver } from './vulnerabilities.js';
import { ApiError, newId, parseJson } from './util.js';

export const COMPONENTS = ['php', 'node', 'wordpress', 'nextjs'];
const LABEL = { php: 'PHP', node: 'Node.js', wordpress: 'WordPress', nextjs: 'Next.js' };
const SEVERITIES = ['critical', 'high', 'moderate', 'low'];

/** The branch a version belongs to: PHP / WordPress by major.minor, Node.js / Next.js by major. */
export function branchOf(component, version) {
  const v = parseSemver(version);
  if (!v) return null;
  return component === 'php' || component === 'wordpress' ? `${v[0]}.${v[1]}` : String(v[0]);
}

const asList = (x, fallback) => {
  const v = typeof x === 'string' ? parseJson(x) : x;
  return Array.isArray(v) ? v : fallback;
};
const asObject = (x) => {
  const v = typeof x === 'string' ? parseJson(x) : x;
  return v && typeof v === 'object' && !Array.isArray(v) ? v : {};
};

/**
 * How one site stands against one advisory. Pure.
 * Returns null when the site does not run the component or its branch is not affected;
 * otherwise { state: 'affected' | 'patched' | 'not_exposed', version, branch, target, exposed }.
 */
export function evaluate(advisory, runtime, securityConfig) {
  const version = runtime?.[advisory.component];
  const branch = branchOf(advisory.component, version);
  if (!branch) return null;
  const branches = asList(advisory.branches, ['*']);
  if (!branches.includes('*') && !branches.includes(branch)) return null;
  const target = asObject(advisory.fixed)[branch] || null;
  if (target && compareVersions(version, target) >= 0) return { state: 'patched', version, branch, target, exposed: null };
  // Exposure: every rule key must be reported and match for "exposed"; a reported mismatch means not exposed.
  const rule = asObject(advisory.exposure);
  const config = asObject(securityConfig);
  let exposed = null;
  const keys = Object.keys(rule);
  if (keys.length && keys.every((k) => k in config)) exposed = keys.every((k) => String(config[k]) === String(rule[k]));
  return { state: exposed === false ? 'not_exposed' : 'affected', version, branch, target, exposed };
}

// ---------- admin: create / update ----------

const clean = (s, max) => String(s ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max);

export function validateAdvisory(input, existing = null) {
  const a = { ...(existing || {}) };
  if (input.component !== undefined) {
    if (!COMPONENTS.includes(input.component)) throw new ApiError(400, `component must be one of ${COMPONENTS.join(', ')}`);
    a.component = input.component;
  }
  if (input.title !== undefined) a.title = clean(input.title, 200);
  if (input.severity !== undefined) {
    if (!SEVERITIES.includes(input.severity)) throw new ApiError(400, 'severity must be critical, high, moderate or low');
    a.severity = input.severity;
  }
  if (input.summary !== undefined) a.summary = clean(input.summary, 2000);
  if (input.mitigation !== undefined) a.mitigation = clean(input.mitigation, 2000);
  if (input.url !== undefined) {
    const u = clean(input.url, 500);
    if (u && !/^https:\/\/[^\s]+$/i.test(u)) throw new ApiError(400, 'url must start with https://');
    a.url = u || null;
  }
  if (input.cves !== undefined) {
    const list = (Array.isArray(input.cves) ? input.cves : String(input.cves).split(/[\s,]+/)).map((c) => c.trim().toUpperCase()).filter(Boolean);
    if (list.some((c) => !/^CVE-\d{4}-\d{3,9}$/.test(c))) throw new ApiError(400, 'CVEs look like CVE-2026-12345');
    a.cves = JSON.stringify([...new Set(list)].slice(0, 20));
  }
  if (input.branches !== undefined) {
    const list = (Array.isArray(input.branches) ? input.branches : String(input.branches).split(/[\s,]+/)).map((b) => b.trim()).filter(Boolean);
    if (!list.length || list.some((b) => b !== '*' && !/^\d+(\.\d+)?$/.test(b))) throw new ApiError(400, 'branches are like 8.3, 8.4 (PHP / WordPress) or 22 (Node.js / Next.js), or *');
    a.branches = JSON.stringify(list.slice(0, 20));
  }
  if (input.fixed !== undefined) {
    const obj = typeof input.fixed === 'string' ? Object.fromEntries(input.fixed.split(/[\s,]+/).filter(Boolean).map((x) => x.split(/[:=]/))) : input.fixed || {};
    for (const [b, v] of Object.entries(obj)) {
      if (!/^\d+(\.\d+)?$/.test(b) || !parseSemver(v)) throw new ApiError(400, 'fixed versions are like 8.3:8.3.37, 8.4:8.4.28');
    }
    a.fixed = JSON.stringify(obj);
  }
  if (input.exposure !== undefined) {
    const obj = input.exposure && typeof input.exposure === 'object' ? input.exposure : null;
    if (obj && Object.keys(obj).some((k) => !/^[a-z0-9_.]{1,80}$/.test(k))) throw new ApiError(400, 'exposure keys are config names like session.upload_progress.enabled');
    a.exposure = obj && Object.keys(obj).length ? JSON.stringify(obj) : null;
  }
  if (input.releaseAt !== undefined) {
    const t = input.releaseAt ? Date.parse(input.releaseAt) : NaN;
    if (input.releaseAt && Number.isNaN(t)) throw new ApiError(400, 'releaseAt must be a date and time');
    a.release_at = input.releaseAt ? new Date(t).toISOString() : null;
  }
  if (input.status !== undefined) {
    if (!['draft', 'announced', 'released', 'withdrawn'].includes(input.status)) throw new ApiError(400, 'status must be draft, announced, released or withdrawn');
    a.status = input.status;
  }
  if (!a.component || !a.title || !a.severity) throw new ApiError(400, 'component, title and severity are required');
  if (a.status === 'released' && !Object.keys(asObject(a.fixed)).length) throw new ApiError(400, 'A released advisory needs the fixed version for each branch');
  return a;
}

export async function saveAdvisory(env, input, id = null, at = new Date()) {
  const existing = id ? await env.DB.prepare('SELECT * FROM advisories WHERE id = ?').bind(id).first() : null;
  if (id && !existing) throw new ApiError(404, 'Advisory not found');
  const a = validateAdvisory(input, existing);
  const now = at.toISOString();
  a.id = existing?.id || newId();
  a.created_at = existing?.created_at || now;
  a.updated_at = now;
  a.status = a.status || 'draft';
  if (a.status !== 'draft' && !a.published_at) a.published_at = now;
  if (a.status === 'released' && !a.released_at) a.released_at = now;
  a.source = a.source || input.source || 'manual';
  a.source_ref = a.source_ref ?? input.sourceRef ?? null;
  await env.DB.prepare(`INSERT INTO advisories (id, component, title, severity, cves, summary, mitigation, branches, fixed, exposure, status,
      release_at, url, source, source_ref, created_at, updated_at, published_at, released_at)
    VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19)
    ON CONFLICT (id) DO UPDATE SET component = ?2, title = ?3, severity = ?4, cves = ?5, summary = ?6, mitigation = ?7, branches = ?8,
      fixed = ?9, exposure = ?10, status = ?11, release_at = ?12, url = ?13, updated_at = ?17, published_at = ?18, released_at = ?19`)
    .bind(a.id, a.component, a.title, a.severity, a.cves || '[]', a.summary || '', a.mitigation || '', a.branches || '["*"]', a.fixed || '{}',
      a.exposure || null, a.status, a.release_at || null, a.url || null, a.source, a.source_ref, a.created_at, a.updated_at, a.published_at || null, a.released_at || null)
    .run();
  return a;
}

// ---------- matching and notifications ----------

const hours = (ms) => {
  const m = Math.max(1, Math.round(ms / 60000));
  return m < 120 ? `${m} min` : m < 48 * 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${Math.round(m / 1440)} days`;
};
const releaseTime = (iso) => new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }) + ' UTC';

/**
 * Matches every live advisory (or just `onlyId`) against Pro sites and sends what is due: the mitigation for
 * announced advisories, the upgrade target once released, and "patched" when a fixed version is seen.
 * One notification per owner per advisory and phase, listing their sites.
 */
export async function syncAdvisories(env, at = new Date(), onlyId = null) {
  const now = at.toISOString();
  const { results: advisories } = await env.DB.prepare(`SELECT * FROM advisories WHERE status IN ('announced', 'released')${onlyId ? ' AND id = ?' : ''}`)
    .bind(...(onlyId ? [onlyId] : [])).all();
  if (!advisories.length) return { advisories: 0 };
  const { results: sites } = await env.DB.prepare(`SELECT w.id, w.name, w.owner_id, w.runtime, w.security_config FROM websites w JOIN users u ON u.id = w.owner_id
    WHERE (u.plan = 'pro' OR u.role = 'admin') AND u.status = 'active' AND w.runtime IS NOT NULL`).all();
  const statements = [];
  let notices = 0;
  for (const adv of advisories) {
    const { results: rows } = await env.DB.prepare('SELECT * FROM advisory_sites WHERE advisory_id = ?').bind(adv.id).all();
    const known = new Map(rows.map((r) => [r.website_id, r]));
    const byOwner = new Map(); // owner -> { announce: [], release: [], patched: [] }
    const bucket = (owner) => byOwner.get(owner) || byOwner.set(owner, { announce: [], release: [], patched: [], ok: [] }).get(owner);
    for (const site of sites) {
      const ev = evaluate(adv, parseJson(site.runtime), site.security_config);
      const row = known.get(site.id);
      if (!ev) continue;
      if (!row) {
        // Every site running the component gets a row, so owners also hear "all OK": not exposed, or already on
        // the fixed version (stored as patched with no patched_at: it never needed patching).
        statements.push(env.DB.prepare(`INSERT INTO advisory_sites (advisory_id, website_id, state, version_seen, first_seen_at, patched_version, notified_announce_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)`)
          .bind(adv.id, site.id, ev.state, ev.version, now, ev.state === 'patched' ? ev.version : null, ev.state === 'affected' ? null : now));
        if (ev.state === 'affected') bucket(site.owner_id)[adv.status === 'released' ? 'release' : 'announce'].push({ site, ev });
        else bucket(site.owner_id).ok.push({ site, ev, reason: okReason(adv, ev, site) });
        continue;
      }
      if (row.state !== 'patched' && ev.state === 'patched') {
        statements.push(env.DB.prepare(`UPDATE advisory_sites SET state = 'patched', patched_at = ?, patched_version = ? WHERE advisory_id = ? AND website_id = ?`)
          .bind(now, ev.version, adv.id, site.id));
        if (row.state === 'affected') {
          const from = Math.max(Date.parse(row.first_seen_at), adv.released_at ? Date.parse(adv.released_at) : 0);
          bucket(site.owner_id).patched.push({ site, ev, took: at.getTime() - from });
        }
        continue;
      }
      if (row.state !== ev.state && ev.state !== 'patched') {
        statements.push(env.DB.prepare('UPDATE advisory_sites SET state = ? WHERE advisory_id = ? AND website_id = ?').bind(ev.state, adv.id, site.id));
      }
      if (ev.state === 'affected' && adv.status === 'released' && !row.notified_release_at) bucket(site.owner_id).release.push({ site, ev });
      if (ev.state === 'affected' && adv.status === 'announced' && !row.notified_announce_at) bucket(site.owner_id).announce.push({ site, ev });
    }

    const label = LABEL[adv.component];
    const cves = asList(adv.cves, []);
    const cveText = cves.length ? ` (${cves.slice(0, 3).join(', ')})` : '';
    for (const [owner, b] of byOwner) {
      // "All OK" is folded into the same message when some sites need action, and sent on its own otherwise.
      const okLines = b.ok.map((x) => `${x.site.name}: ${x.reason}`).join('; ');
      if (b.ok.length && !b.announce.length && !b.release.length) {
        statements.push(notificationStatement(env.DB, {
          userId: owner, websiteId: b.ok.length === 1 ? b.ok[0].site.id : null, type: 'advisory_ok',
          title: `Checked: ${b.ok.length === 1 ? b.ok[0].site.name : `your ${b.ok.length} sites`} ${b.ok.length === 1 ? 'is' : 'are'} OK for ${adv.title}`,
          body: `${okLines}.${cveText} No action needed now.`.slice(0, 900),
        }, at));
        notices += 1;
      }
      if (b.announce.length) {
        const names = b.announce.map((x) => `${x.site.name} (${label} ${x.ev.version})`).join(', ');
        statements.push(notificationStatement(env.DB, {
          userId: owner, websiteId: b.announce.length === 1 ? b.announce[0].site.id : null, type: 'advisory',
          title: `Security release ahead: ${adv.title}`,
          body: `${adv.release_at ? `Due ${releaseTime(adv.release_at)}. ` : ''}Affects ${names}${cveText}. ${adv.mitigation ? `Do this now: ${adv.mitigation}` : 'Plan the upgrade as soon as it is out.'}${okLines ? ` OK: ${okLines}.` : ''}`.slice(0, 900),
        }, at));
        for (const x of b.announce) statements.push(env.DB.prepare('UPDATE advisory_sites SET notified_announce_at = ? WHERE advisory_id = ? AND website_id = ?').bind(now, adv.id, x.site.id));
        notices += 1;
      }
      if (b.release.length) {
        const lines = b.release.map((x) => `${x.site.name}: ${label} ${x.ev.version} → ${x.ev.target || 'a supported branch (no fix for this one)'}`).join('; ');
        statements.push(notificationStatement(env.DB, {
          userId: owner, websiteId: b.release.length === 1 ? b.release[0].site.id : null, type: 'advisory',
          title: `${adv.severity === 'critical' ? 'Critical: ' : ''}${label} security fix is out, upgrade ${b.release.length === 1 ? b.release[0].site.name : `${b.release.length} sites`}`,
          body: `${adv.title}${cveText}. ${lines}.${adv.mitigation ? ` Until then: ${adv.mitigation}` : ''}${okLines ? ` OK: ${okLines}.` : ''}`.slice(0, 900),
        }, at));
        for (const x of b.release) statements.push(env.DB.prepare('UPDATE advisory_sites SET notified_release_at = ? WHERE advisory_id = ? AND website_id = ?').bind(now, adv.id, x.site.id));
        notices += 1;
      }
      for (const x of b.patched) {
        statements.push(notificationStatement(env.DB, {
          userId: owner, websiteId: x.site.id, type: 'advisory_patched',
          title: `${x.site.name} is patched: ${label} ${x.ev.version}`,
          body: `${adv.title}${cveText}: fixed on this site ${hours(x.took)} after ${adv.released_at ? 'the release' : 'it was flagged'}.`,
        }, at));
        notices += 1;
      }
    }
  }
  if (statements.length) await env.DB.batch(statements);
  return { advisories: advisories.length, sites: sites.length, notices };
}

/** Why a site is fine for an advisory, in words. */
function okReason(adv, ev, site) {
  if (ev.state === 'patched') return `already on ${LABEL[adv.component]} ${ev.version}, which has the fix`;
  const rule = asObject(adv.exposure);
  const config = asObject(site.security_config);
  const off = Object.keys(rule).filter((k) => k in config && String(config[k]) !== String(rule[k]))
    .map((k) => (typeof config[k] === 'boolean' ? `${k} is ${config[k] ? 'on' : 'off'}` : `${k} is ${config[k]}`));
  return `not exposed on ${LABEL[adv.component]} ${ev.version} (${off.join(', ') || 'its settings rule this out'}); upgrade at your normal pace`;
}

// ---------- read models ----------

const publicAdvisory = (a) => ({
  id: a.id, component: a.component, componentLabel: LABEL[a.component], title: a.title, severity: a.severity, cves: asList(a.cves, []),
  summary: a.summary, mitigation: a.mitigation, branches: asList(a.branches, ['*']), fixed: asObject(a.fixed), status: a.status,
  releaseAt: a.release_at, releasedAt: a.released_at, publishedAt: a.published_at, url: a.url, hasExposureRule: Boolean(a.exposure),
});

/** The owner's fleet: every live advisory with each of their sites' state (Release Radar page). */
export async function radarFor(env, userId) {
  const { results } = await env.DB.prepare(`SELECT a.*, s.website_id, s.state, s.version_seen, s.first_seen_at, s.patched_at, s.patched_version,
      w.name AS site_name, w.url AS site_url, w.runtime
    FROM advisories a JOIN advisory_sites s ON s.advisory_id = a.id JOIN websites w ON w.id = s.website_id
    WHERE w.owner_id = ? AND a.status IN ('announced', 'released') ORDER BY a.published_at DESC`).bind(userId).all();
  const map = new Map();
  for (const r of results) {
    const entry = map.get(r.id) || map.set(r.id, { ...publicAdvisory(r), sites: [] }).get(r.id);
    const current = parseJson(r.runtime)?.[r.component] || null;
    entry.sites.push({
      id: r.website_id, name: r.site_name, url: r.site_url, state: r.state, version: current || r.version_seen,
      target: asObject(r.fixed)[branchOf(r.component, current || r.version_seen)] || null,
      firstSeenAt: r.first_seen_at, patchedAt: r.patched_at, patchedVersion: r.patched_version,
      hoursToPatch: r.patched_at ? Math.round((Date.parse(r.patched_at) - Math.max(Date.parse(r.first_seen_at), r.released_at ? Date.parse(r.released_at) : 0)) / 360000) / 10 : null,
    });
  }
  return [...map.values()].map((a) => ({
    ...a,
    counts: { affected: a.sites.filter((s) => s.state === 'affected').length, patched: a.sites.filter((s) => s.state === 'patched').length, notExposed: a.sites.filter((s) => s.state === 'not_exposed').length },
  }));
}

/** Advisories touching one site (Security tab). */
export async function advisoriesForSite(env, siteId) {
  const { results } = await env.DB.prepare(`SELECT a.*, s.state, s.version_seen, s.patched_at FROM advisories a JOIN advisory_sites s ON s.advisory_id = a.id
    WHERE s.website_id = ? AND a.status IN ('announced', 'released') ORDER BY a.published_at DESC LIMIT 20`).bind(siteId).all();
  return results.map((r) => ({ ...publicAdvisory(r), siteState: r.state, versionSeen: r.version_seen, patchedAt: r.patched_at }));
}

/** Admin list with fleet counts. */
export async function listAdvisories(env) {
  const { results } = await env.DB.prepare(`SELECT a.*,
      (SELECT COUNT(*) FROM advisory_sites s WHERE s.advisory_id = a.id AND s.state = 'affected') AS affected,
      (SELECT COUNT(*) FROM advisory_sites s WHERE s.advisory_id = a.id AND s.state = 'patched') AS patched,
      (SELECT COUNT(*) FROM advisory_sites s WHERE s.advisory_id = a.id AND s.state = 'not_exposed') AS not_exposed
    FROM advisories a ORDER BY a.updated_at DESC LIMIT 100`).all();
  return results.map((r) => ({ ...publicAdvisory(r), exposure: asObject(r.exposure), source: r.source, counts: { affected: r.affected, patched: r.patched, notExposed: r.not_exposed } }));
}


// ---------- automatic release detection ----------

const NODE_RELEASES_URL = 'https://nodejs.org/dist/index.json';
const PHP_RELEASES_URL = 'https://endoflife.date/api/php.json';

/**
 * An announced PHP advisory becomes "released" by itself once every supported branch has a newer patch release
 * dated on or after the announced release day: the fixed version per branch is that release. Pure.
 * `phpCycles`: endoflife.date rows { cycle, latest, latestReleaseDate, eol }.
 */
export function phpReleaseFor(advisory, phpCycles, today = new Date()) {
  if (advisory.component !== 'php' || advisory.status !== 'announced' || !advisory.release_at || !Array.isArray(phpCycles)) return null;
  const day = advisory.release_at.slice(0, 10);
  const todayDay = today.toISOString().slice(0, 10);
  const branches = asList(advisory.branches, ['*']);
  const supported = phpCycles.filter((c) => c.eol > todayDay && (branches.includes('*') || branches.includes(c.cycle)));
  if (!supported.length) return null;
  const released = supported.filter((c) => c.latestReleaseDate && c.latestReleaseDate >= day);
  if (released.length !== supported.length) return null; // wait until every supported branch has shipped
  return Object.fromEntries(released.map((c) => [c.cycle, c.latest]));
}

/**
 * Node.js marks security releases in its release index. Each release day with security releases becomes one
 * advisory (released, fixed version per major line). Pure: returns [{ sourceRef, date, fixed }] for days not yet known.
 */
export function nodeSecurityDays(releases, knownRefs, since) {
  const days = new Map();
  for (const r of releases || []) {
    if (!r.security || /-/.test(r.version) || !r.date || r.date < since) continue;
    const ref = `node-security-${r.date}`;
    if (knownRefs.has(ref)) continue;
    const major = branchOf('node', r.version);
    const d = days.get(ref) || days.set(ref, { sourceRef: ref, date: r.date, fixed: {} }).get(ref);
    if (!d.fixed[major] || compareVersions(r.version.replace(/^v/, ''), d.fixed[major]) > 0) d.fixed[major] = r.version.replace(/^v/, '');
  }
  return [...days.values()];
}

/** Hourly: release announced PHP advisories when the fixes ship, and add new Node.js security releases. */
export async function detectReleases(env, cachedReference, at = new Date()) {
  const out = { phpReleased: 0, nodeAdded: 0 };
  const { results: announced } = await env.DB.prepare(`SELECT * FROM advisories WHERE status = 'announced' AND component = 'php'`).all();
  if (announced.length) {
    const cycles = await cachedReference(env, 'eol:php', PHP_RELEASES_URL, undefined, 3600e3);
    for (const adv of announced) {
      const fixed = phpReleaseFor(adv, cycles, at);
      if (!fixed) continue;
      await saveAdvisory(env, { status: 'released', fixed }, adv.id, at);
      out.phpReleased += 1;
    }
  }
  const releases = await cachedReference(env, 'node:releases:raw', NODE_RELEASES_URL, undefined, 3600e3);
  if (Array.isArray(releases)) {
    const { results: refs } = await env.DB.prepare(`SELECT source_ref FROM advisories WHERE source_ref LIKE 'node-security-%'`).all();
    // Only security releases from the last 30 days: older ones are covered by the runtime check already.
    const since = new Date(at.getTime() - 30 * 86400e3).toISOString().slice(0, 10);
    for (const day of nodeSecurityDays(releases, new Set(refs.map((r) => r.source_ref)), since)) {
      await saveAdvisory(env, {
        component: 'node', severity: 'high', status: 'released', source: 'feed:nodejs', sourceRef: day.sourceRef,
        title: `Node.js security releases (${day.date})`,
        summary: `Node.js shipped security releases on ${day.date} for the ${Object.keys(day.fixed).map((m) => `${m}.x`).join(', ')} line(s). Versions before these releases have known vulnerabilities.`,
        branches: Object.keys(day.fixed), fixed: day.fixed, url: 'https://nodejs.org/en/blog/vulnerability',
      }, null, at);
      out.nodeAdded += 1;
    }
  }
  return out;
}

// ---------- feeds: security posts become drafts for review ----------
// php.net news and the Node.js vulnerability blog announce security releases (often days ahead). A new security
// post becomes a DRAFT advisory and an admin alert: a person checks it and announces it with one click, so a
// misread feed item can never alarm customers. (Node.js releases themselves are detected automatically above.)

const PHP_FEED = 'https://www.php.net/feed.atom';
const NODE_FEED = 'https://nodejs.org/en/feed/vulnerability.xml';
const SECURITY_WORDS = /\b(security|vulnerab|advisory|CVE-\d{4}-\d+)/i;
const FEED_WINDOW_DAYS = 14;

const unescape = (s) => String(s || '').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
const tag = (xml, name) => unescape((xml.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, 'i')) || [])[1] || '').trim();
const plain = (html) => unescape(html).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

/** Security items from php.net's Atom feed and the Node.js vulnerability RSS. Pure. */
export function parseSecurityFeed(xml, source) {
  const items = [];
  const blocks = String(xml || '').match(source === 'php' ? /<entry[\s>][\s\S]*?<\/entry>/gi : /<item[\s>][\s\S]*?<\/item>/gi) || [];
  for (const b of blocks) {
    const link = source === 'php' ? tag(b, 'id') : tag(b, 'link');
    const body = plain(tag(b, source === 'php' ? 'content' : 'description')).slice(0, 1500);
    const title = plain(tag(b, 'title')) || body.slice(0, 120) || (link.split('/').pop() || '').replace(/-/g, ' ');
    const date = source === 'php' ? tag(b, 'published') || tag(b, 'updated') : tag(b, 'pubDate');
    const at = Date.parse(date);
    if (!link || Number.isNaN(at) || !/^https:\/\//.test(link)) continue;
    // php.net mixes releases and RCs in; only security posts count. Every Node.js vulnerability post is one.
    if (source === 'php' && (!SECURITY_WORDS.test(`${title} ${body}`) || /\b(RC\s?\d*|alpha\s?\d*|beta\s?\d*)\b/i.test(title))) continue;
    items.push({ source, link, title: title.slice(0, 200), body, publishedAt: new Date(at).toISOString(), cves: [...new Set((`${title} ${body}`.match(/CVE-\d{4}-\d{3,9}/g) || []))].slice(0, 10) });
  }
  return items;
}

/** Hourly: drafts for new security posts from the last two weeks, and one admin alert per new draft. */
export async function draftFromFeeds(env, cachedReference, notifyAdmins, at = new Date()) {
  const since = at.getTime() - FEED_WINDOW_DAYS * 86400e3;
  let drafted = 0;
  for (const [source, url, component] of [['php', PHP_FEED, 'php'], ['node', NODE_FEED, 'node']]) {
    const xml = await cachedReference(env, `feed:${source}`, url, (t) => t, 3600e3);
    for (const item of parseSecurityFeed(xml, source).filter((i) => Date.parse(i.publishedAt) >= since)) {
      const ref = `feed:${item.link}`.slice(0, 300);
      const exists = await env.DB.prepare('SELECT 1 FROM advisories WHERE source_ref = ?').bind(ref).first();
      if (exists) continue;
      const a = await saveAdvisory(env, {
        component, status: 'draft', severity: item.cves.length ? 'high' : 'moderate', source: `feed:${source === 'php' ? 'php.net' : 'nodejs.org'}`, sourceRef: ref,
        title: item.title || `${LABEL[component]} security post`, summary: item.body.slice(0, 2000), url: item.link, cves: item.cves,
      }, null, at);
      await notifyAdmins(env.DB, {
        type: 'radar_draft', title: `Release Radar draft: ${a.title}`,
        body: `${LABEL[component]} posted a security item on ${item.publishedAt.slice(0, 10)}. Review it in Release Radar: set the affected branches, release time and mitigation, then announce.`,
      }).catch(() => {});
      drafted += 1;
    }
  }
  return { drafted };
}
