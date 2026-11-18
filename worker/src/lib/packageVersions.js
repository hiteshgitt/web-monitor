// Which npm / Composer dependencies of a site have a newer release. The site's integration reports what is
// installed; the latest versions come from the public registries (registry.npmjs.org, repo.packagist.org),
// cached in D1 for a day. Only stable releases count; a pre-release installed on purpose is left alone.
import { nowIso } from './util.js';

const TTL_MS = 24 * 60 * 60 * 1000;
const MAX_LOOKUPS = 40;            // per request; the rest are filled in on later views from the cache
const NAME = { npm: /^(@[a-z0-9][\w.-]*\/)?[a-z0-9][\w.-]*$/i, packagist: /^[a-z0-9][\w.-]*\/[a-z0-9][\w.-]*$/i };

/** [major, minor, patch] or null for anything that is not a plain x.y.z (dev branches, pre-releases). */
export function parseVersion(v) {
  const m = String(v || '').trim().replace(/^v/i, '').match(/^(\d+)\.(\d+)(?:\.(\d+))?$/);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3] || 0)] : null;
}

/** 'major' | 'minor' | 'patch' when latest is newer than installed, else null. */
export function updateKind(installed, latest) {
  const a = parseVersion(installed); const b = parseVersion(latest);
  if (!a || !b) return null;
  if (b[0] !== a[0]) return b[0] > a[0] ? 'major' : null;
  if (b[1] !== a[1]) return b[1] > a[1] ? 'minor' : null;
  return b[2] > a[2] ? 'patch' : null;
}

async function fetchLatest(ecosystem, name) {
  try {
    if (ecosystem === 'npm') {
      const res = await fetch(`https://registry.npmjs.org/${name.replace('/', '%2F')}/latest`, { signal: AbortSignal.timeout(5000), headers: { Accept: 'application/json' } });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`npm ${res.status}`);
      return (await res.json()).version || null;
    }
    const res = await fetch(`https://repo.packagist.org/p2/${name.toLowerCase()}.json`, { signal: AbortSignal.timeout(5000), headers: { Accept: 'application/json' } });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`packagist ${res.status}`);
    const versions = (await res.json()).packages?.[name.toLowerCase()] || [];
    const stable = versions.map((v) => String(v.version || '').replace(/^v/i, '')).filter((v) => parseVersion(v));
    stable.sort((x, y) => { const a = parseVersion(x); const b = parseVersion(y); return b[0] - a[0] || b[1] - a[1] || b[2] - a[2]; });
    return stable[0] || null;
  } catch {
    return undefined; // registry unreachable: try again next time, do not cache
  }
}

/** Latest versions for these names, from the cache or the registry. Returns Map(name -> latest|null). */
export async function latestVersions(env, ecosystem, names) {
  const wanted = [...new Set(names.filter((n) => NAME[ecosystem].test(n)))];
  const out = new Map();
  if (!wanted.length) return out;
  const fresh = new Date(Date.now() - TTL_MS).toISOString();
  const cached = await env.DB.prepare(`SELECT name, latest FROM package_versions WHERE ecosystem = ? AND checked_at > ?
    AND name IN (${wanted.map(() => '?').join(',')})`).bind(ecosystem, fresh, ...wanted).all();
  for (const r of cached.results) out.set(r.name, r.latest);
  const missing = wanted.filter((n) => !out.has(n)).slice(0, MAX_LOOKUPS);
  const found = await Promise.all(missing.map(async (n) => [n, await fetchLatest(ecosystem, n)]));
  const now = nowIso();
  const writes = [];
  for (const [n, latest] of found) {
    if (latest === undefined) continue;
    out.set(n, latest);
    writes.push(env.DB.prepare(`INSERT INTO package_versions (ecosystem, name, latest, checked_at) VALUES (?, ?, ?, ?)
      ON CONFLICT(ecosystem, name) DO UPDATE SET latest = excluded.latest, checked_at = excluded.checked_at`).bind(ecosystem, n, latest, now));
  }
  if (writes.length) await env.DB.batch(writes);
  return out;
}

// Composer platform requirements are not packages: php, ext-*, lib-*, composer-*.
const isPlatform = (name) => /^(php|hhvm|composer(-[\w-]+)?|ext-[\w-]+|lib-[\w-]+)$/i.test(name);

/**
 * Adds latest_version / update to every library of a Next.js or PHP inventory and a real outdated list.
 * The integration's own data is kept; nothing is marked outdated without a registry answer.
 */
export async function withUpdates(env, platform, data) {
  if (!data || data.error) return data;
  const ecosystem = platform === 'nextjs' ? 'npm' : 'packagist';
  const items = data.all_libraries || data.all_packages || [];
  if (!Array.isArray(items) || !items.length) return data;
  const names = items.map((i) => i.name).filter((n) => n && !isPlatform(n));
  const latest = await latestVersions(env, ecosystem, names);
  const enrich = (i) => {
    if (!i?.name || isPlatform(i.name)) return { ...i, platform_requirement: true };
    const l = latest.get(i.name);
    const kind = l ? updateKind(i.version, l) : null;
    return { ...i, latest_version: l ?? null, update: kind, update_available: Boolean(kind), checked: latest.has(i.name) };
  };
  const all = items.map(enrich);
  const deps = (data.dependencies || []).map(enrich);
  const devDeps = (data.devDependencies || []).map(enrich);
  const outdated = all.filter((i) => i.update_available);
  const listKey = data.all_libraries ? 'all_libraries' : 'all_packages';
  return {
    ...data,
    [listKey]: all,
    dependencies: deps,
    devDependencies: devDeps,
    outdated: outdated,
    outdated_count: outdated.length,
    outdated_major: outdated.filter((i) => i.update === 'major').length,
    unchecked_count: all.filter((i) => !i.platform_requirement && !i.checked).length,
    ecosystem,
  };
}
