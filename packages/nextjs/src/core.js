// Web Monitor integration core for Next.js (Node.js runtime).
// Every value is measured at request time; what can't be measured (visitor analytics, malware scans)
// is reported as null / "not_available", never guessed.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { timingSafeEqual } from 'node:crypto';

export const VERSION = '1.0.0';
export const ENDPOINTS = ['health', 'analytics', 'performance', 'seo', 'security', 'libraries', 'logs', 'recommendations'];

const projectRoot = () => process.cwd();

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

const installedVersion = (name) => readJson(path.join(projectRoot(), 'node_modules', name, 'package.json'))?.version ?? null;

function safeEqual(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  return left.length === right.length && timingSafeEqual(left, right);
}

const round = (value, digits = 2) => (value == null ? null : Number(value.toFixed(digits)));

function systemMemoryPercent() {
  return round(((os.totalmem() - os.freemem()) / os.totalmem()) * 100);
}

// 1-minute load average per CPU core, as a percentage (null on Windows, where it isn't available)
function cpuUsagePercent() {
  if (process.platform === 'win32') return null;
  const cores = os.cpus().length || 1;
  return round(Math.min(100, (os.loadavg()[0] / cores) * 100));
}

function diskFreePercent() {
  try {
    const stats = fs.statfsSync(projectRoot());
    return round((stats.bavail / stats.blocks) * 100, 1);
  } catch {
    return null;
  }
}

// ---- endpoints ------------------------------------------------------------------------------

function getHealth() {
  const start = performance.now();
  const memory = systemMemoryPercent();
  const status = memory >= 95 ? 'warning' : 'healthy';
  return {
    status,
    message: status === 'healthy' ? 'Site is healthy' : 'Server memory usage is above 95%',
    timestamp: new Date().toISOString(),
    response_time: round(performance.now() - start),
    node_version: process.version,
    nextjs_version: installedVersion('next'),
    framework: 'Next.js',
    integration_version: VERSION,
    uptime_seconds: Math.round(os.uptime()),
    checks: {
      memory_usage: `${memory}%`,
      load_average: process.platform === 'win32' ? null : round(os.loadavg()[0]),
    },
  };
}

function getAnalytics() {
  // Visitors, page views, bounce rate and sessions need an analytics source (Vercel Analytics, GA4...).
  return {
    totalVisitors: null,
    pageViews: null,
    bounceRate: null,
    avgSessionDuration: null,
    analytics_source: 'unavailable',
    analytics_note: 'Connect an analytics provider for visitor data. The server cannot measure visits on its own.',
    top_pages: [],
    content_stats: {},
  };
}

function getPerformance() {
  const start = performance.now();
  const memory = systemMemoryPercent();
  const cpu = cpuUsagePercent();
  const disk = diskFreePercent();
  const processMemory = process.memoryUsage();
  const elapsed = round(performance.now() - start);

  let score = 100;
  const recommendations = [];
  if (memory > 80) { score -= 15; recommendations.push('Server memory usage is high — add memory or reduce usage'); }
  if (cpu != null && cpu > 80) { score -= 20; recommendations.push('Server CPU load is high — optimize heavy work or add capacity'); }
  if (disk != null && disk < 10) { score -= 15; recommendations.push('Less than 10% disk space left on the server'); }
  if (process.env.NODE_ENV !== 'production') { score -= 10; recommendations.push('Run the site with a production build (next build && next start)'); }

  return {
    load_time: elapsed,
    server_response_time: elapsed,
    database_query_time: null,
    memory_usage: memory,
    memory_peak: round(processMemory.rss / 1048576),
    heap_used_mb: round(processMemory.heapUsed / 1048576),
    cpu_usage: cpu,
    disk_free_percent: disk,
    performance_score: Math.max(0, score),
    active_plugins: null,
    recommendations,
  };
}

async function fetchHomepage(ctx) {
  if (ctx.homepage) return ctx.homepage;
  const url = `${ctx.siteUrl}/`;
  try {
    const response = await fetch(url, { headers: { 'User-Agent': `WebMonitor/${VERSION}` }, signal: AbortSignal.timeout(5000) });
    const html = await response.text();
    ctx.homepage = { url, html, headers: Object.fromEntries([...response.headers].map(([k, v]) => [k.toLowerCase(), v])) };
  } catch (error) {
    ctx.homepage = { url, html: null, headers: null, error: error.message };
  }
  return ctx.homepage;
}

function countLinks(html, siteUrl) {
  const host = new URL(siteUrl).host;
  let internal = 0;
  let external = 0;
  for (const [, href] of html.matchAll(/<a\b[^>]*href=["']([^"'#]+)["']/gi)) {
    try {
      const target = new URL(href, siteUrl);
      if (target.host === host) internal += 1;
      else if (/^https?:$/.test(target.protocol)) external += 1;
    } catch {
      // ignore malformed links
    }
  }
  return [internal, external];
}

async function getSeo(ctx) {
  const page = await fetchHomepage(ctx);
  if (page.html == null) {
    return { score: null, ssl_enabled: ctx.https, seo_issues: [], recommendations: [], note: `Homepage could not be read for analysis: ${page.error}` };
  }
  const { html } = page;
  const issues = [];
  const recommendations = [];
  let score = 100;

  const title = (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '').replace(/<[^>]+>/g, '').trim();
  const description = (html.match(/<meta[^>]+name=["']description["'][^>]*content=["']([^"']*)["']/i)
    || html.match(/<meta[^>]+content=["']([^"']*)["'][^>]*name=["']description["']/i))?.[1]?.trim() || '';
  const h1Count = (html.match(/<h1[\s>]/gi) || []).length;
  const images = html.match(/<img\b[^>]*>/gi) || [];
  const imagesWithAlt = images.filter((tag) => /\balt=["'][^"']+["']/i.test(tag)).length;
  const hasLang = /<html[^>]+\blang=["'][^"']+["']/i.test(html);
  const hasCanonical = /<link[^>]+rel=["']canonical["']/i.test(html);
  const [internal, external] = countLinks(html, ctx.siteUrl);

  if (!title) { score -= 20; issues.push('Homepage has no <title>'); recommendations.push('Add a descriptive page title (metadata.title)'); }
  else if (title.length > 65) { score -= 5; issues.push('Title is longer than 65 characters'); }
  if (!description) { score -= 15; issues.push('Homepage has no meta description'); recommendations.push('Add a meta description (metadata.description)'); }
  if (h1Count === 0) { score -= 10; issues.push('Homepage has no <h1> heading'); recommendations.push('Add one <h1> heading'); }
  else if (h1Count > 1) { score -= 5; issues.push(`Homepage has ${h1Count} <h1> headings`); }
  if (images.length > imagesWithAlt) { score -= 10; issues.push(`${images.length - imagesWithAlt} of ${images.length} images have no alt text`); recommendations.push('Add alt text to images'); }
  if (!hasLang) { score -= 5; issues.push('<html> has no lang attribute'); }
  if (!hasCanonical) { score -= 5; issues.push('No canonical link'); }
  if (!ctx.https) { score -= 10; issues.push('Site is not served over HTTPS'); recommendations.push('Enable SSL certificate'); }

  return {
    score: Math.max(0, score),
    meta_tags: title && description ? 'complete' : 'incomplete',
    alt_tags: images.length ? Math.round((imagesWithAlt / images.length) * 100) : null,
    heading_structure: h1Count === 1 ? 'good' : 'needs_improvement',
    internal_links: internal,
    external_links: external,
    ssl_enabled: ctx.https,
    site_title: title,
    site_description: description,
    total_content: null,
    seo_issues: issues,
    recommendations,
    analyzed_url: page.url,
  };
}

async function getSecurity(ctx) {
  const checks = {};
  const recommendations = [];
  const add = (name, passed, advice) => {
    checks[name] = passed;
    if (passed === false) recommendations.push(advice);
  };

  add('https', ctx.https, 'Enable SSL certificate (serve the site over HTTPS)');
  add('supported_node', Number(process.versions.node.split('.')[0]) >= 20, 'Upgrade Node.js to a supported LTS version (20 or newer)');
  add('production_mode', process.env.NODE_ENV === 'production', 'Run a production build (NODE_ENV=production)');

  const { headers } = await fetchHomepage(ctx);
  if (headers) {
    add('no_powered_by_header', !headers['x-powered-by'], 'Hide the X-Powered-By header (poweredByHeader: false in next.config)');
    add('hsts_header', Boolean(headers['strict-transport-security']), 'Send a Strict-Transport-Security header');
    add('nosniff_header', Boolean(headers['x-content-type-options']), 'Send X-Content-Type-Options: nosniff');
    add('frame_protection', Boolean(headers['x-frame-options'] || headers['content-security-policy']), 'Protect against clickjacking (X-Frame-Options or CSP)');
  }

  const known = Object.values(checks).filter((v) => v !== null && v !== undefined);
  return {
    ssl_status: ctx.https ? 'enabled' : 'disabled',
    firewall: 'unknown',
    malware_scan: 'not_available',
    vulnerability_scan: 'not_available',
    security_score: known.length ? Math.round((known.filter(Boolean).length / known.length) * 100) : null,
    security_checks: checks,
    security_plugins: null,
    total_plugins: null,
    outdated_plugins: null,
    node_version: process.version,
    nextjs_version: installedVersion('next'),
    recommendations,
  };
}

function getLibraries() {
  const pkg = readJson(path.join(projectRoot(), 'package.json'));
  if (!pkg) return { total_libraries: 0, all_libraries: [], message: 'package.json not found' };
  const format = (deps = {}, isDev) => Object.entries(deps).map(([name, range]) => ({
    name,
    version: installedVersion(name),
    rawVersion: range,
    isDev,
    type: isDev ? 'devDependency' : 'dependency',
    outdated: null,
  }));
  const dependencies = format(pkg.dependencies, false);
  const devDependencies = format(pkg.devDependencies, true);
  return {
    total_libraries: dependencies.length + devDependencies.length,
    dependencies_count: dependencies.length,
    devDependencies_count: devDependencies.length,
    dependencies,
    devDependencies,
    all_libraries: [...dependencies, ...devDependencies],
    outdated_count: null,
    node_version: process.version,
    nextjs_version: installedVersion('next'),
  };
}

function getLogs() {
  const candidates = [process.env.WEBMONITOR_LOG_FILE, path.join(projectRoot(), 'logs', 'error.log')].filter(Boolean);
  for (const file of candidates) {
    try {
      const lines = fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).slice(-100);
      return {
        error_log: {
          enabled: true,
          message: '',
          lines: lines.map((raw) => ({ raw, time: raw.slice(0, 40).match(/\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}/)?.[0] ?? '' })),
          count: lines.length,
        },
        access_summary: {},
      };
    } catch {
      // try the next location
    }
  }
  return {
    error_log: { enabled: false, message: 'No log file found. Set WEBMONITOR_LOG_FILE to show your error log here.', lines: [], count: 0 },
    access_summary: {},
  };
}

async function getRecommendations(ctx) {
  const sections = { performance: getPerformance(), seo: await getSeo(ctx), security: await getSecurity(ctx) };
  const recommendations = Object.entries(sections).flatMap(([source, data]) => (data.recommendations || []).map((text) => ({ text, source })));
  return { recommendations, count: recommendations.length };
}

const HANDLERS = {
  health: getHealth,
  analytics: getAnalytics,
  performance: getPerformance,
  seo: getSeo,
  security: getSecurity,
  libraries: getLibraries,
  plugins: getLibraries,
  logs: getLogs,
  recommendations: getRecommendations,
};

/**
 * Framework-neutral request handler.
 * @param {string} endpoint  last path segment, e.g. "health"
 * @param {{ authorization?: string|null, origin: string, forwardedProto?: string|null }} request
 * @returns {Promise<{ status: number, body: object }>}
 */
export async function handleWebMonitorRequest(endpoint, request) {
  const apiKey = process.env.WEBMONITOR_API_KEY || '';
  if (!apiKey) {
    return { status: 503, body: { error: 'WEBMONITOR_API_KEY is not set on this site. Run: npx webmonitor-nextjs init' } };
  }
  // A short or placeholder key would be guessable: refuse to run with it
  if (apiKey.length < 16 || /^paste-/i.test(apiKey)) {
    return { status: 503, body: { error: 'WEBMONITOR_API_KEY is too short or still the placeholder. Use a long random key.' } };
  }
  const token = /^Bearer\s+(.+)$/i.exec(request.authorization || '')?.[1]?.trim() || '';
  if (!safeEqual(token, apiKey)) {
    return { status: 401, body: { error: 'Invalid API key. Please check your authorization header.' } };
  }
  const handler = HANDLERS[endpoint];
  if (!handler) {
    return { status: 404, body: { error: `Unknown endpoint. Available: ${ENDPOINTS.join(', ')}` } };
  }

  const siteUrl = (process.env.WEBMONITOR_SITE_URL || request.origin).replace(/\/$/, '');
  const ctx = {
    siteUrl,
    https: siteUrl.startsWith('https://') || request.forwardedProto === 'https',
    homepage: null,
  };
  try {
    return { status: 200, body: await handler(ctx) };
  } catch (error) {
    return { status: 500, body: { error: `Web Monitor check failed: ${error.message}` } };
  }
}
