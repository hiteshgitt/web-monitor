// Suspicious-file scan (Pro): the integration's read-only scanner walks the site in small batches (PHP in uploads,
// backdoor / web-shell code, request input reaching eval or shell functions, obfuscation, injected JavaScript,
// WordPress core files that differ from the release). Each call advances it and returns every open finding.
// New findings alert at once (critical); a finding is "cleared" only when a complete pass no longer reports it.
import { notificationStatement } from './alerts.js';
import { parseJson } from './util.js';
import { shareFileFindings } from './ruyashield.js';

export const FILESCAN_PLATFORMS = ['wordpress', 'laravel', 'codeigniter', 'php', 'nextjs'];
const IN_PROGRESS_EVERY_MS = 5 * 60e3;
const COMPLETE_EVERY_MS = 6 * 3600e3;
const SEV_ORDER = { critical: 0, high: 1, medium: 2, low: 3 };

/** Whether this site's scanner should be advanced now. Pure. */
export function filescanDue(site, at = new Date()) {
  if (!FILESCAN_PLATFORMS.includes(site.platform) || !site.owner_pro) return false;
  if (!site.filescan_at) return true;
  const state = parseJson(site.filescan_state) || {};
  const gap = state.cycleComplete ? COMPLETE_EVERY_MS : IN_PROGRESS_EVERY_MS;
  return at.getTime() - Date.parse(site.filescan_at) >= gap;
}

const str = (v, max) => String(v ?? '').slice(0, max);
const clean = (f) => ({
  id: str(f.id, 40).replace(/[^\w-]/g, ''), path: str(f.path, 300), line: Number.isInteger(f.line) ? f.line : Number(f.line) || 0,
  rule: str(f.rule, 40), severity: ['critical', 'high', 'medium', 'low'].includes(f.severity) ? f.severity : 'high', title: str(f.title, 200),
  snippet: str(f.snippet, 200), mtime: f.mtime && !Number.isNaN(Date.parse(f.mtime)) ? new Date(f.mtime).toISOString() : null,
});

/** Stores one scanner response and returns what it alerted. */
export async function syncFileScan(env, site, payload, at = new Date()) {
  const now = at.toISOString();
  const findings = (Array.isArray(payload?.findings) ? payload.findings : []).slice(0, 300).map(clean).filter((f) => f.id && f.path);
  const p = payload?.progress || {};
  const state = {
    filesDone: Number(p.files_done) || 0, filesTotal: p.files_total == null ? null : Number(p.files_total), cycleComplete: Boolean(p.cycle_complete),
    cycleCompleted: p.cycle_completed || null, coreIntegrity: payload?.core_integrity || null,
  };
  const before = parseJson(site.filescan_state) || {};
  const { results: rows } = await env.DB.prepare('SELECT id, status FROM file_findings WHERE website_id = ?').bind(site.id).all();
  const known = new Map(rows.map((r) => [r.id, r.status]));
  const fresh = findings.filter((f) => !known.has(f.id) || known.get(f.id) === 'cleared');
  const statements = findings.map((f) => env.DB.prepare(`INSERT INTO file_findings (website_id, id, path, line, rule, severity, title, snippet, file_mtime, first_seen, last_seen)
    VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?10)
    ON CONFLICT (website_id, id) DO UPDATE SET line = ?4, snippet = ?8, file_mtime = ?9, last_seen = ?10,
      status = CASE WHEN status = 'cleared' THEN 'open' ELSE status END, cleared_at = CASE WHEN status = 'cleared' THEN NULL ELSE cleared_at END`)
    .bind(site.id, f.id, f.path, f.line, f.rule, f.severity, f.title, f.snippet, f.mtime, now));

  // Only a complete pass can say a finding is gone (the file was cleaned or deleted).
  let cleared = [];
  if (state.cycleComplete) {
    const current = new Set(findings.map((f) => f.id));
    cleared = rows.filter((r) => r.status === 'open' && !current.has(r.id)).map((r) => r.id);
    for (const id of cleared) {
      statements.push(env.DB.prepare(`UPDATE file_findings SET status = 'cleared', cleared_at = ? WHERE website_id = ? AND id = ?`).bind(now, site.id, id));
    }
  }
  const alert = (type, title, body) => statements.push(notificationStatement(env.DB, { userId: site.owner_id, websiteId: site.id, type, title, body: body.slice(0, 900) }, at));
  const loc = (f) => `${f.path}${f.line ? `:${f.line}` : ''}`;
  const open = fresh.sort((a, b) => SEV_ORDER[a.severity] - SEV_ORDER[b.severity]);
  if (open.length === 1) {
    const f = open[0];
    alert('suspicious_file', `Suspicious code on ${site.name}: ${f.title}`, `${loc(f)}${f.snippet ? `: ${f.snippet}` : ''}. Check the file now; if it is not yours, remove it, change your passwords and update everything. Open Security → Suspicious files.`);
  } else if (open.length > 1) {
    alert('suspicious_file', `${open.length} suspicious files on ${site.name}`, `${open.slice(0, 3).map((f) => `${loc(f)} (${f.title})`).join('; ')}${open.length > 3 ? `; and ${open.length - 3} more` : ''}. Open Security → Suspicious files.`);
  }
  if (cleared.length) alert('suspicious_file_cleared', `Suspicious files cleared on ${site.name}`, `${cleared.length} finding${cleared.length === 1 ? '' : 's'} no longer present after a full scan.`);
  // The first complete pass with nothing found says so once.
  if (state.cycleComplete && !before.firstPassNotified && !findings.length && !rows.length) {
    alert('filescan_ok', `File scan complete on ${site.name}: nothing suspicious`, `${state.filesTotal ?? 'All'} files checked for backdoors, web shells, injected code and code in uploads${state.coreIntegrity?.status === 'ok' ? ', and WordPress core matches the official release' : ''}. We keep scanning and tell you if anything appears.`);
  }
  state.firstPassNotified = Boolean(before.firstPassNotified || state.cycleComplete);
  statements.push(env.DB.prepare('UPDATE websites SET filescan_state = ?, filescan_at = ? WHERE id = ?').bind(JSON.stringify(state), now, site.id));
  await env.DB.batch(statements);
  await shareFileFindings(env, site, state.cycleComplete).catch((e) => console.error('RuyaShield file report failed', e.message));
  return { findings: findings.length, fresh: open.length, cleared: cleared.length };
}

export async function fileScanView(env, site) {
  const { results } = await env.DB.prepare(`SELECT * FROM file_findings WHERE website_id = ? ORDER BY status = 'open' DESC,
    CASE severity WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END, path LIMIT 300`).bind(site.id).all();
  return {
    supported: FILESCAN_PLATFORMS.includes(site.platform),
    state: parseJson(site.filescan_state),
    scannedAt: site.filescan_at,
    findings: results.map((r) => ({ id: r.id, path: r.path, line: r.line, rule: r.rule, severity: r.severity, title: r.title, snippet: r.snippet,
      fileModified: r.file_mtime, firstSeen: r.first_seen, lastSeen: r.last_seen, status: r.status, clearedAt: r.cleared_at })),
  };
}
