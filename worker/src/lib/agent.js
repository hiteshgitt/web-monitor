// Server agent (Pro): a read-only agent on the customer's server (agent/webmonitor-agent.py) pushes one snapshot a
// minute. Web Monitor checks the token (stored only as a SHA-256), keeps the latest snapshot and a per-minute
// history, and alerts on sustained CPU / memory, full disks or inodes, floods from one IP, attack bursts, 5xx bursts,
// and an agent that stops reporting. The agent never receives commands: this is the only direction of traffic.
import { notificationStatement } from './alerts.js';
import { ApiError, parseJson } from './util.js';

const MAX_BODY = 128 * 1024;
const MIN_GAP_MS = 20e3;            // at most one snapshot per 20 s per agent
const SUSTAINED_MINUTES = 5;
const COOLDOWN_MS = 30 * 60e3;      // per IP / per condition, so a long attack is one alert per half hour
export const FLOOD_RPS = 20;        // one IP above this many requests in one second
export const ATTACK_BURST = 20;     // injection attempts from one IP in one snapshot
const INJECTION = new Set(['sqli', 'xss', 'traversal', 'rce']);
const ATTACK_LABEL = { sqli: 'SQL injection', xss: 'XSS', traversal: 'path traversal', rce: 'command injection', sensitive_probe: 'secret-file probe', shell_probe: 'web-shell probe', admin_bruteforce: 'login brute force', scanner: 'vulnerability scanner' };

const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
export const hashToken = async (token) => hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token)));

export async function createAgentToken(env, siteId, at = new Date()) {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  const token = `wma_${hex(bytes)}`;
  await env.DB.prepare(`INSERT INTO agents (website_id, token_hash, token_prefix, created_at) VALUES (?1, ?2, ?3, ?4)
    ON CONFLICT (website_id) DO UPDATE SET token_hash = ?2, token_prefix = ?3, created_at = ?4`)
    .bind(siteId, await hashToken(token), token.slice(0, 10), at.toISOString()).run();
  return token;
}

// ---------- cleaning the snapshot (it comes from the customer's server: keep only known, bounded fields) ----------

const num = (v, max = 1e15) => (Number.isFinite(Number(v)) ? Math.max(0, Math.min(max, Number(v))) : null);
const text = (v, max) => String(v ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').slice(0, max);
const IP = /^[0-9a-fA-F:.]{3,45}$/;

export function cleanSnapshot(p) {
  const proc = (x) => ({ pid: num(x?.pid, 1e9), name: text(x?.name, 40), user: text(x?.user, 32), cpu: num(x?.cpu, 1e5), rss: num(x?.rss) });
  const t = p?.traffic || {};
  return {
    agentVersion: text(p?.agent_version, 20), hostname: text(p?.hostname, 80), at: num(p?.at, 1e11), uptimeSeconds: num(p?.uptime_seconds),
    cpu: { percent: num(p?.cpu?.percent, 100), cores: num(p?.cpu?.cores, 4096), load: Array.isArray(p?.cpu?.load) ? p.cpu.load.slice(0, 3).map((x) => num(x, 1e6)) : null },
    memory: { total: num(p?.memory?.total), used: num(p?.memory?.used), percent: num(p?.memory?.percent, 100), swapPercent: num(p?.memory?.swap_percent, 100) },
    processes: {
      count: num(p?.processes?.count, 1e7),
      topCpu: (Array.isArray(p?.processes?.top_cpu) ? p.processes.top_cpu : []).slice(0, 10).map(proc),
      topMemory: (Array.isArray(p?.processes?.top_memory) ? p.processes.top_memory : []).slice(0, 10).map(proc),
    },
    filesystems: (Array.isArray(p?.filesystems) ? p.filesystems : []).slice(0, 20).map((f) => ({
      mount: text(f?.mount, 120), fs: text(f?.fs, 20), total: num(f?.total), used: num(f?.used), percent: num(f?.percent, 100), inodesPercent: num(f?.inodes_percent, 100),
    })),
    traffic: {
      logs: (Array.isArray(t.logs) ? t.logs : []).slice(0, 10).map((x) => text(x, 200)),
      requests: num(t.requests, 1e9) ?? 0,
      status: { '2xx': num(t.status?.['2xx']) ?? 0, '3xx': num(t.status?.['3xx']) ?? 0, '4xx': num(t.status?.['4xx']) ?? 0, '5xx': num(t.status?.['5xx']) ?? 0 },
      topIps: (Array.isArray(t.top_ips) ? t.top_ips : []).filter((x) => IP.test(String(x?.ip))).slice(0, 15)
        .map((x) => ({ ip: String(x.ip), requests: num(x.requests, 1e9), peakRps: num(x.peak_rps, 1e7) })),
      attacks: (Array.isArray(t.attacks) ? t.attacks : []).filter((x) => IP.test(String(x?.ip)) && ATTACK_LABEL[x?.type]).slice(0, 30)
        .map((x) => ({ ip: String(x.ip), type: x.type, count: num(x.count, 1e9), sample: text(x.sample, 160).split('?')[0] })),
    },
    errorLog: { logs: (Array.isArray(p?.error_log?.logs) ? p.error_log.logs : []).slice(0, 10).map((x) => text(x, 200)), errors: num(p?.error_log?.errors, 1e9) ?? 0 },
  };
}

// ---------- alerts ----------

/**
 * Alerts for one snapshot, given the recent minutes (newest last, including this one) and the previous state. Pure.
 * Returns { alerts: [{type, title, body}], state }.
 */
export function agentAlerts(siteName, snap, recent, before = {}, now = Date.now()) {
  const state = { ...before, flood: { ...(before.flood || {}) }, attack: { ...(before.attack || {}) }, disks: { ...(before.disks || {}) } };
  const alerts = [];
  const add = (type, title, body) => alerts.push({ type, title, body });
  const last = recent.slice(-SUSTAINED_MINUTES);
  const sustained = (key, limit) => last.length >= SUSTAINED_MINUTES && last.every((m) => m[key] != null && m[key] >= limit);

  if (state.offline) {
    state.offline = false;
    add('server_ok', `Server agent is reporting again on ${siteName}`, `${snap.hostname || 'The server'} is sending data again.`);
  }
  if (!state.cpuHigh && sustained('cpu', 90)) {
    state.cpuHigh = true;
    const top = snap.processes.topCpu.slice(0, 3).map((p) => `${p.name} (${p.cpu}%, ${p.user})`).join(', ');
    add('server_alert', `High CPU on ${snap.hostname || siteName}`, `CPU above 90% for ${SUSTAINED_MINUTES} minutes (now ${snap.cpu.percent}%). Top: ${top || 'unknown'}.`);
  } else if (state.cpuHigh && snap.cpu.percent != null && snap.cpu.percent < 70) {
    state.cpuHigh = false;
    add('server_ok', `CPU back to normal on ${snap.hostname || siteName}`, `Now ${snap.cpu.percent}%.`);
  }
  if (!state.memHigh && sustained('mem', 90)) {
    state.memHigh = true;
    const top = snap.processes.topMemory.slice(0, 3).map((p) => `${p.name} (${Math.round((p.rss || 0) / 1048576)} MB)`).join(', ');
    add('server_alert', `High memory on ${snap.hostname || siteName}`, `Memory above 90% for ${SUSTAINED_MINUTES} minutes (now ${snap.memory.percent}%${snap.memory.swapPercent ? `, swap ${snap.memory.swapPercent}%` : ''}). Largest: ${top || 'unknown'}.`);
  } else if (state.memHigh && snap.memory.percent != null && snap.memory.percent < 80) {
    state.memHigh = false;
    add('server_ok', `Memory back to normal on ${snap.hostname || siteName}`, `Now ${snap.memory.percent}%.`);
  }
  for (const f of snap.filesystems) {
    const worst = Math.max(f.percent ?? 0, f.inodesPercent ?? 0);
    const what = (f.inodesPercent ?? 0) > (f.percent ?? 0) ? `inodes ${f.inodesPercent}% used` : `${f.percent}% full`;
    if (!state.disks[f.mount] && worst >= 90) {
      state.disks[f.mount] = true;
      add('server_alert', `Disk ${f.mount} on ${snap.hostname || siteName}: ${what}`, (f.inodesPercent ?? 0) >= 90 ? 'Too many small files: clear caches, sessions, mail queues and old backups.' : 'Free space: old backups, logs and caches are the usual culprits.');
    } else if (state.disks[f.mount] && worst < 85) {
      delete state.disks[f.mount];
      add('server_ok', `Disk ${f.mount} back to normal on ${snap.hostname || siteName}`, `${f.percent}% full, inodes ${f.inodesPercent ?? '—'}%.`);
    }
  }
  // One IP flooding (DDoS-style): peak requests in a single second.
  for (const ip of snap.traffic.topIps.filter((x) => (x.peakRps ?? 0) >= FLOOD_RPS)) {
    if (state.flood[ip.ip] && now - state.flood[ip.ip] < COOLDOWN_MS) continue;
    state.flood[ip.ip] = now;
    add('server_attack', `Request flood from ${ip.ip} on ${siteName}`, `${ip.peakRps} requests in one second (${ip.requests} in the last minute). If it is not a known crawler or monitor, block it in your firewall or CDN (e.g. a Cloudflare rate-limiting rule).`);
  }
  // Traffic surge overall: 5x the usual minute and at least 600 requests.
  const baseline = recent.slice(0, -1).filter((m) => m.requests != null);
  const avg = baseline.length >= 30 ? baseline.reduce((s, m) => s + m.requests, 0) / baseline.length : null;
  if (avg != null && snap.traffic.requests >= 600 && snap.traffic.requests >= 5 * avg && !(state.surge && now - state.surge < COOLDOWN_MS)) {
    state.surge = now;
    add('server_attack', `Traffic surge on ${siteName}`, `${snap.traffic.requests} requests in the last minute, about ${Math.round(snap.traffic.requests / Math.max(avg, 1))}× the usual ${Math.round(avg)}. Top IP: ${snap.traffic.topIps[0]?.ip || 'unknown'}.`);
  }
  // Injection attempts (XSS, SQL injection, traversal, command injection) from one IP.
  const byIp = {};
  for (const a of snap.traffic.attacks) {
    if (!INJECTION.has(a.type)) continue;
    const e = (byIp[a.ip] ||= { count: 0, types: new Set(), sample: a.sample });
    e.count += a.count || 0;
    e.types.add(ATTACK_LABEL[a.type]);
  }
  for (const [ip, e] of Object.entries(byIp)) {
    if (e.count < ATTACK_BURST || (state.attack[ip] && now - state.attack[ip] < COOLDOWN_MS)) continue;
    state.attack[ip] = now;
    add('server_attack', `${[...e.types].join(' and ')} attempts from ${ip} on ${siteName}`, `${e.count} attempts in the last minute, e.g. ${e.sample}. Block the IP and make sure the site escapes input; RuyaShield can test the site for these issues.`);
  }
  // 5xx burst in the access logs.
  const s5 = snap.traffic.status['5xx'];
  if (s5 >= 20 && s5 >= 0.1 * snap.traffic.requests && !(state.errors5xx && now - state.errors5xx < COOLDOWN_MS)) {
    state.errors5xx = now;
    add('server_alert', `Server errors on ${siteName}: ${s5} in a minute`, `${Math.round((s5 / Math.max(snap.traffic.requests, 1)) * 100)}% of requests answered 5xx${snap.errorLog.errors ? `; ${snap.errorLog.errors} new lines in the error log` : ''}. Check the application and error logs.`);
  }
  // Forget old cooldown entries.
  for (const k of ['flood', 'attack']) for (const [ip, ts] of Object.entries(state[k])) if (now - ts > 6 * COOLDOWN_MS) delete state[k][ip];
  return { alerts, state };
}

// ---------- ingest ----------

export async function ingestSnapshot(env, request, at = new Date()) {
  const auth = request.headers.get('authorization') || '';
  const token = /^Bearer\s+(wma_[0-9a-f]{48})$/.exec(auth)?.[1];
  if (!token) throw new ApiError(401, 'Agent token missing or malformed.');
  const len = Number(request.headers.get('content-length') || 0);
  if (len > MAX_BODY) throw new ApiError(413, 'Snapshot too large.');
  const raw = await request.text();
  if (raw.length > MAX_BODY) throw new ApiError(413, 'Snapshot too large.');
  const agent = await env.DB.prepare(`SELECT a.*, w.name AS site_name, w.owner_id, (u.plan = 'pro' OR u.role = 'admin') AS owner_pro
    FROM agents a JOIN websites w ON w.id = a.website_id JOIN users u ON u.id = w.owner_id WHERE a.token_hash = ?`).bind(await hashToken(token)).first();
  if (!agent) throw new ApiError(401, 'Unknown agent token. Create one in Web Monitor → site → Advanced → Server.');
  if (!agent.owner_pro) throw new ApiError(402, 'The server agent is part of Pro.');
  if (agent.last_seen && at.getTime() - Date.parse(agent.last_seen) < MIN_GAP_MS) throw new ApiError(429, 'Too many snapshots; send one a minute.');
  let payload;
  try { payload = JSON.parse(raw); } catch { throw new ApiError(400, 'Snapshot is not JSON.'); }
  const snap = cleanSnapshot(payload);
  const minute = Math.floor(at.getTime() / 60000);
  const attacks = snap.traffic.attacks.reduce((s, a) => s + (a.count || 0), 0);
  const { results: recentRows } = await env.DB.prepare('SELECT cpu, mem, requests FROM agent_minutes WHERE website_id = ? AND minute > ? ORDER BY minute')
    .bind(agent.website_id, minute - 60).all();
  const recent = [...recentRows, { cpu: snap.cpu.percent, mem: snap.memory.percent, requests: snap.traffic.requests }];
  const { alerts, state } = agentAlerts(agent.site_name, snap, recent, parseJson(agent.alert_state) || {}, at.getTime());
  await env.DB.batch([
    env.DB.prepare(`INSERT INTO agent_minutes (website_id, minute, cpu, mem, load1, requests, errors5xx, attacks) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT (website_id, minute) DO UPDATE SET cpu = excluded.cpu, mem = excluded.mem, load1 = excluded.load1, requests = excluded.requests,
        errors5xx = excluded.errors5xx, attacks = excluded.attacks`)
      .bind(agent.website_id, minute, snap.cpu.percent, snap.memory.percent, snap.cpu.load?.[0] ?? null, snap.traffic.requests, snap.traffic.status['5xx'], attacks),
    env.DB.prepare('UPDATE agents SET hostname = ?, agent_version = ?, last_seen = ?, last_snapshot = ?, alert_state = ? WHERE website_id = ?')
      .bind(snap.hostname, snap.agentVersion, at.toISOString(), JSON.stringify(snap), JSON.stringify(state), agent.website_id),
    ...alerts.map((a) => notificationStatement(env.DB, { userId: agent.owner_id, websiteId: agent.website_id, ...a, body: a.body.slice(0, 900) }, at)),
  ]);
  return { ok: true, alerts: alerts.length };
}

/** Every 15 minutes: agents silent for 10 minutes get one "not reporting" alert. */
export async function checkSilentAgents(env, at = new Date()) {
  const cutoff = new Date(at.getTime() - 10 * 60e3).toISOString();
  const { results } = await env.DB.prepare(`SELECT a.website_id, a.hostname, a.alert_state, w.name, w.owner_id FROM agents a JOIN websites w ON w.id = a.website_id
    WHERE a.last_seen IS NOT NULL AND a.last_seen < ?`).bind(cutoff).all();
  const statements = [];
  for (const a of results) {
    const state = parseJson(a.alert_state) || {};
    if (state.offline) continue;
    state.offline = true;
    statements.push(env.DB.prepare('UPDATE agents SET alert_state = ? WHERE website_id = ?').bind(JSON.stringify(state), a.website_id));
    statements.push(notificationStatement(env.DB, { userId: a.owner_id, websiteId: a.website_id, type: 'server_alert', title: `Server agent stopped reporting on ${a.name}`, body: `${a.hostname || 'The server'} has sent nothing for over 10 minutes. The server may be down or overloaded, or the agent stopped: check with  systemctl status webmonitor-agent` }, at));
  }
  if (statements.length) await env.DB.batch(statements);
  return { silent: statements.length / 2 };
}

/** For the Advanced → Server tab. */
export async function agentView(env, site, at = new Date()) {
  const a = await env.DB.prepare('SELECT * FROM agents WHERE website_id = ?').bind(site.id).first();
  if (!a) return { installed: false };
  const since = Math.floor(at.getTime() / 60000) - 24 * 60;
  const { results } = await env.DB.prepare('SELECT minute, cpu, mem, load1, requests, errors5xx, attacks FROM agent_minutes WHERE website_id = ? AND minute > ? ORDER BY minute').bind(site.id, since).all();
  return {
    installed: true, tokenPrefix: a.token_prefix, createdAt: a.created_at, hostname: a.hostname, agentVersion: a.agent_version,
    lastSeen: a.last_seen, online: Boolean(a.last_seen && at.getTime() - Date.parse(a.last_seen) < 10 * 60e3),
    snapshot: parseJson(a.last_snapshot), series: results,
  };
}
