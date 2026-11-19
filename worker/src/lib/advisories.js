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
    const bucket = (owner) => byOwner.get(owner) || byOwner.set(owner, { announce: [], release: [], patched: [] }).get(owner);
    for (const site of sites) {
      const ev = evaluate(adv, parseJson(site.runtime), site.security_config);
      const row = known.get(site.id);
      if (!ev) continue;
      if (!row) {
        // A site already on a fixed version when first seen was never affected: nothing to record.
        if (ev.state === 'patched') continue;
        statements.push(env.DB.prepare(`INSERT INTO advisory_sites (advisory_id, website_id, state, version_seen, first_seen_at) VALUES (?, ?, ?, ?, ?)`)
          .bind(adv.id, site.id, ev.state, ev.version, now));
        if (ev.state === 'affected') bucket(site.owner_id)[adv.status === 'released' ? 'release' : 'announce'].push({ site, ev });
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
      if (b.announce.length) {
        const names = b.announce.map((x) => `${x.site.name} (${label} ${x.ev.version})`).join(', ');
        statements.push(notificationStatement(env.DB, {
          userId: owner, websiteId: b.announce.length === 1 ? b.announce[0].site.id : null, type: 'advisory',
          title: `Security release ahead: ${adv.title}`,
          body: `${adv.release_at ? `Due ${releaseTime(adv.release_at)}. ` : ''}Affects ${names}${cveText}. ${adv.mitigation ? `Do this now: ${adv.mitigation}` : 'Plan the upgrade as soon as it is out.'}`.slice(0, 900),
        }, at));
        for (const x of b.announce) statements.push(env.DB.prepare('UPDATE advisory_sites SET notified_announce_at = ? WHERE advisory_id = ? AND website_id = ?').bind(now, adv.id, x.site.id));
        notices += 1;
      }
      if (b.release.length) {
        const lines = b.release.map((x) => `${x.site.name}: ${label} ${x.ev.version} → ${x.ev.target || 'a supported branch (no fix for this one)'}`).join('; ');
        statements.push(notificationStatement(env.DB, {
          userId: owner, websiteId: b.release.length === 1 ? b.release[0].site.id : null, type: 'advisory',
          title: `${adv.severity === 'critical' ? 'Critical: ' : ''}${label} security fix is out, upgrade ${b.release.length === 1 ? b.release[0].site.name : `${b.release.length} sites`}`,
          body: `${adv.title}${cveText}. ${lines}.${adv.mitigation ? ` Until then: ${adv.mitigation}` : ''}`.slice(0, 900),
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

