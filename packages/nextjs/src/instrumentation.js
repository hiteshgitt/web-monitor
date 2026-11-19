// Next.js instrumentation hooks. No Node.js imports: Next also loads instrumentation.ts in the edge runtime.
// In your project's instrumentation.ts:
//   export { register, onRequestError } from '@ruyalab/webmonitor-nextjs/instrumentation';
// Errors are kept on globalThis because Next bundles instrumentation.ts and the API route separately.
// They cover this server process (on serverless, the instance answering), so Web Monitor reads them often.

const ERRORS_MAX = 200;
const GROUPS_MAX = 100;

export const errorStore = () => {
  const s = (globalThis.__webmonitorErrors ??= { hooked: false, items: [] });
  s.groups ??= {};
  return s;
};

/** Called once when the server starts; marks error tracking as installed. */
export function register() {
  errorStore().hooked = true;
}

// Emails, long tokens and passwords never leave the site.
export function cleanText(s) {
  return String(s ?? '')
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '[email]')
    .replace(/(pass(?:word)?|pwd|secret|token|api[_-]?key|authorization)(["']?\s*[:=]\s*)[^\s,;&"']+/gi, '$1$2[redacted]')
    .replace(/\b[A-Za-z0-9_-]{32,}\b/g, '[token]');
}

const hash = (s) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i += 1) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(16).padStart(8, '0');
};

// "    at fn (file:line:col)" → { frame: "file:line fn", file, line }. App frames first: node_modules and Next internals
// are kept in the stack but the first app frame is what the error is filed under.
function parseStack(stack) {
  const frames = [];
  for (const raw of String(stack || '').split('\n').slice(1, 30)) {
    const m = raw.match(/at (?:(.+?) \()?(.+?):(\d+):\d+\)?\s*$/);
    if (!m) continue;
    let file = decodeURI(m[2].replace(/^file:\/\//, ''));
    const cwd = typeof globalThis.process?.cwd === 'function' ? globalThis.process.cwd() : '';
    if (cwd && file.startsWith(`${cwd}/`)) file = file.slice(cwd.length + 1);
    else file = file.replace(/^.*?\/(\.next\/|app\/|src\/|pages\/|node_modules\/)/, '$1');
    file = file.slice(-200);
    frames.push({ fn: m[1] || '', file, line: Number(m[3]) });
  }
  return frames;
}

/** Called by Next.js 15+ for every error thrown while handling a request. */
export function onRequestError(error, request, context) {
  const store = errorStore();
  store.hooked = true;
  const at = Date.now();
  const path = String(request?.path || '').split('?')[0].slice(0, 120);
  const route = context?.routePath ? String(context.routePath).slice(0, 120) : null;
  const message = cleanText(String(error?.message || error || 'Error')).slice(0, 300);
  store.items.push({ at, path, route, message: message.slice(0, 160), digest: error?.digest || null });
  if (store.items.length > ERRORS_MAX) store.items.splice(0, store.items.length - ERRORS_MAX);

  // Grouped like the PHP integrations: type + file + line + message shape.
  const frames = parseStack(error?.stack);
  const top = frames.find((f) => !f.file.includes('node_modules') && !f.file.includes('next/dist')) || frames[0] || { file: route || path, line: 0 };
  const type = String(error?.name || error?.constructor?.name || 'Error').slice(0, 80);
  const shape = message.replace(/\d+/g, 'N').replace(/'[^']*'|"[^"]*"/g, 'S');
  const fp = hash(`${type}|${top.file}|${top.line}|${shape}`) + hash(`${shape}|${type}`);
  const g = store.groups[fp] ||= {
    fp, type, message, file: top.file, line: top.line, where: route || path,
    stack: frames.slice(0, 10).map((f) => cleanText(`${f.file}:${f.line} ${f.fn}`.trim())), count: 0, first_seen: at,
  };
  g.count += 1;
  g.last_seen = at;
  g.where = route || path || g.where;
  if (error?.digest) g.digest = String(error.digest).slice(0, 40);
  const keys = Object.keys(store.groups);
  if (keys.length > GROUPS_MAX) {
    keys.sort((a, b) => store.groups[a].last_seen - store.groups[b].last_seen).slice(0, keys.length - GROUPS_MAX).forEach((k) => delete store.groups[k]);
  }
}

/** The small summary in every health response (same shape as the PHP integrations). */
export function errorSummary(now = Date.now()) {
  const store = errorStore();
  const groups = Object.values(store.groups);
  const latest = groups.reduce((m, g) => Math.max(m, g.last_seen), 0);
  return {
    tracked: Boolean(store.hooked || store.items.length),
    groups: groups.length,
    last_5m: store.items.filter((e) => e.at >= now - 5 * 60_000).length,
    last_hour: store.items.filter((e) => e.at >= now - 60 * 60_000).length,
    latest: latest ? new Date(latest).toISOString() : null,
  };
}

/** Every group, newest first (the errors endpoint). */
export function errorGroups() {
  return Object.values(errorStore().groups).sort((a, b) => b.last_seen - a.last_seen)
    .map((g) => ({ ...g, first_seen: new Date(g.first_seen).toISOString(), last_seen: new Date(g.last_seen).toISOString() }));
}
