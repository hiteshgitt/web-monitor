// Suspicious-file scan for Web Monitor (1.5.0). Read-only: files are read, never executed, changed or deleted.
// Looks inside the project (not node_modules) for server-side scripts dropped into public/, request input reaching
// child_process / eval, injected JavaScript loaders (also in the built .next output) and cryptominers, each with
// file, line, rule and a short snippet. Works in small batches (file and time budget per call) and remembers where
// it stopped in one JSON file in the temp folder; a full pass then starts again, skipping unchanged files.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const MAX_FILE_BYTES = 2_000_000;
const MAX_FINDINGS = 200;
const SKIP_DIRS = new Set(['node_modules', '.git', '.next/cache', '.vercel', '.turbo', '.open-next/cache', 'coverage', '.pnpm-store', '.yarn']);
const CODE_EXT = new Set(['js', 'mjs', 'cjs', 'jsx', 'ts', 'tsx', 'mts', 'cts', 'html', 'htm']);
const SERVER_SCRIPT_EXT = new Set(['php', 'phtml', 'php5', 'php7', 'phar', 'jsp', 'jspx', 'asp', 'aspx', 'ashx', 'cgi', 'pl', 'py', 'sh']);
// Folders that are served as static files: no server-side script belongs there.
const PUBLIC_DIRS = ['public', 'out', '.next/static'];

/** [id, severity, title, regex] — tested per line. */
const RULES = [
  ['js-injected-loader', 'high', 'Injected JavaScript loader (decoded and executed at runtime)',
    /(eval\s*\(\s*(String\.fromCharCode|atob|unescape)\s*\(|document\.write\s*\(\s*unescape\s*\(|new\s+Function\s*\(\s*atob\s*\()/i],
  ['node-request-exec', 'critical', 'Request input passed to a shell command or eval (remote code execution)',
    /\b(exec|execSync|spawn|spawnSync|execFile|execFileSync|eval)\s*\(\s*[^;]{0,80}\b(req|request)\s*\.\s*(query|body|params|headers|cookies)\b/],
  ['node-webshell', 'critical', 'Known Node.js web-shell pattern',
    /require\s*\(\s*['"](child_process|node:child_process)['"]\s*\)\s*\.\s*(exec|execSync|spawn)\s*\(\s*[^;]{0,60}\b(req|request|searchParams|query)\b/],
  ['cryptominer', 'high', 'Cryptocurrency miner code', /(coinhive\.min\.js|CoinHive\.Anonymous|cryptonight|stratum\+tcp:\/\/|xmrig)/i],
];
// Rules checked on long (minified / built) lines too: precise enough not to hit normal bundles.
const LONG_LINE_RULES = new Set(['js-injected-loader', 'cryptominer']);

const SELF = (() => {
  try { return fs.realpathSync(fileURLToPath(import.meta.url)); } catch { return null; }
})();

/** Rules matching one line: [[id, severity, title], ...]. Pure. */
export function matchLine(line, long = false) {
  const hits = [];
  for (const [id, sev, title, re] of RULES) {
    if (long && !LONG_LINE_RULES.has(id)) continue;
    if (re.test(line)) hits.push([id, sev, title]);
  }
  return hits;
}

const snippet = (text) => String(text).trim()
  .replace(/[A-Za-z0-9+/=]{60,}/g, '[encoded payload]')
  .replace(/(password|passwd|secret|token|api[_-]?key)(["']?\s*[:=]\s*)["']?[^\s"',;]+/gi, '$1$2[removed]')
  .replace(/\s+/g, ' ').slice(0, 160);

const inPublic = (rel) => PUBLIC_DIRS.some((d) => rel === d || rel.startsWith(`${d}/`));
// Skipped from the project root; node_modules and .git at any depth.
const skipDir = (rel) => SKIP_DIRS.has(rel) || ['node_modules', '.git'].includes(path.posix.basename(rel));

export class FileScanner {
  constructor(base = process.cwd(), stateFile = null) {
    this.base = base.replace(/[\\/]+$/, '');
    this.state = stateFile || path.join(os.tmpdir(), `webmonitor-filescan-${createHash('sha1').update(this.base).digest('hex').slice(0, 12)}.json`);
  }

  /** Relative path => { size, mtime, ext } for every candidate file, in a stable order. */
  * walk() {
    const stack = [''];
    while (stack.length) {
      const dir = stack.pop();
      let entries;
      try { entries = fs.readdirSync(path.join(this.base, dir), { withFileTypes: true }); } catch { continue; }
      entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
      const subdirs = [];
      for (const e of entries) {
        const rel = dir ? `${dir}/${e.name}` : e.name;
        if (e.isSymbolicLink()) continue;
        if (e.isDirectory()) {
          if (!skipDir(rel)) subdirs.push(rel);
          continue;
        }
        if (!e.isFile()) continue;
        const ext = path.extname(e.name).slice(1).toLowerCase();
        const script = SERVER_SCRIPT_EXT.has(ext) && inPublic(rel);
        if (!CODE_EXT.has(ext) && !script) continue;
        const abs = path.join(this.base, rel);
        if (SELF && abs === SELF) continue;
        let st;
        try { st = fs.statSync(abs); } catch { continue; }
        if (st.size > MAX_FILE_BYTES) continue;
        yield [rel, { size: st.size, mtime: Math.floor(st.mtimeMs / 1000), ext, script }];
      }
      for (const d of subdirs.reverse()) stack.push(d);
    }
  }

  /** Findings for one file. Pure apart from reading it. */
  scanFile(rel, info) {
    const out = new Map();
    const add = (rule, sev, title, line, text) => {
      const id = createHash('sha1').update(`${rel}|${rule}|${String(text).trim().replace(/\s+/g, ' ')}`).digest('hex').slice(0, 16);
      out.set(id, { id, path: rel, line, rule, severity: sev, title, snippet: snippet(text), mtime: new Date(info.mtime * 1000).toISOString(), size: info.size });
    };
    let content;
    try { content = fs.readFileSync(path.join(this.base, rel), 'utf8'); } catch { return []; }
    if (info.script) {
      add('script-in-public', 'critical', 'Server-side script in a public (static files) folder: it does not belong to a Next.js site', 1, content.slice(0, 200));
      return [...out.values()];
    }
    const lines = content.split('\n');
    for (let n = 0; n < lines.length && out.size < 20; n++) {
      const line = lines[n];
      for (const [id, sev, title] of matchLine(line, line.length > 20000)) add(id, sev, title, n + 1, line.length > 400 ? excerpt(line, id) : line);
    }
    return [...out.values()];
  }

  /** One batch: scans up to maxFiles files or `seconds` of work, then returns progress and every open finding. */
  step(maxFiles = 400, seconds = 3) {
    const start = Date.now();
    const s = this.load();
    let cursor = Number(s.cursor) || 0;
    if (cursor === 0) { s.cycle_started = Math.floor(start / 1000); s.seen = {}; }
    s.files ||= {};
    s.findings ||= {};
    const seen = s.seen || {};
    let index = 0;
    let scanned = 0;
    let done = true;
    for (const [rel, info] of this.walk()) {
      if (index++ < cursor) continue;
      if (scanned >= maxFiles || Date.now() - start > seconds * 1000) { done = false; index--; break; }
      scanned++;
      seen[rel] = 1;
      const sig = `${info.size}:${info.mtime}`;
      if (s.files[rel] === sig) continue; // unchanged since the last full pass: its findings still stand
      s.files[rel] = sig;
      for (const [id, f] of Object.entries(s.findings)) if (f.path === rel) delete s.findings[id];
      for (const f of this.scanFile(rel, info)) if (Object.keys(s.findings).length < MAX_FINDINGS) s.findings[f.id] = f;
    }
    s.seen = seen;
    s.cursor = done ? 0 : index;
    if (done) {
      for (const rel of Object.keys(s.files)) {
        if (seen[rel]) continue;
        delete s.files[rel];
        for (const [id, f] of Object.entries(s.findings)) if (f.path === rel) delete s.findings[id];
      }
      s.cycle_completed = Math.floor(Date.now() / 1000);
      s.files_total = Object.keys(seen).length;
      s.seen = {};
    }
    this.save(s);
    const iso = (t) => (t ? new Date(t * 1000).toISOString() : null);
    return {
      scanner: 'webmonitor-filescan-node/1',
      progress: { files_done: done ? s.files_total : index, files_total: s.files_total ?? null, cycle_complete: done, cycle_started: iso(s.cycle_started), cycle_completed: iso(s.cycle_completed) },
      findings: Object.values(s.findings),
    };
  }

  load() {
    try { const d = JSON.parse(fs.readFileSync(this.state, 'utf8')); return d && typeof d === 'object' ? d : {}; } catch { return {}; }
  }

  save(s) {
    try { fs.writeFileSync(this.state, JSON.stringify(s), { mode: 0o600 }); } catch { /* read-only file system: the next call starts over */ }
  }
}

// 300 characters from just before the first match on a long line, so a built bundle does not fill the snippet with noise.
function excerpt(line, ruleId) {
  const re = RULES.find(([id]) => id === ruleId)?.[3];
  const at = re ? Math.max(0, line.search(re)) : 0;
  return line.slice(Math.max(0, at - 20), at + 280);
}
