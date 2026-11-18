// Root cause of a failed check. Instead of "API returned status 500", say what broke: the database, PHP memory,
// a WordPress plugin, the app server, DNS, SSL... It reads the error page the site returned (first 16 KB, never
// stored), its status code and a few headers, and how the request failed. Unknown failures return null, so the
// caller keeps its generic message: a guess is never presented as a cause.

const plugin = (slug) => slug.replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
const mb = (bytes) => `${Math.round(Number(bytes) / 1048576)} MB`;

/** @returns {{ cause: string, component: string, title: string, detail: string, hint: string } | null} */
function fromBody(body) {
  if (!body) return null;
  let m;

  if (/Error establishing a database connection/i.test(body)) {
    return {
      cause: 'database', component: 'Database (MySQL)', title: 'Database connection failing',
      detail: 'WordPress cannot connect to its MySQL database.',
      hint: 'Check that the database server is running and that DB_HOST, DB_USER and DB_PASSWORD in wp-config.php are correct. A full disk or too many connections can also cause this.',
    };
  }
  if ((m = body.match(/SQLSTATE\[(\w+)\][^<\n]{0,160}/i)) || /Unable to connect to (?:the|your) database/i.test(body) || /Too many connections/i.test(body)) {
    const text = m ? m[0].replace(/<[^>]+>/g, '').trim() : '';
    return {
      cause: 'database', component: 'Database', title: 'Database connection failing',
      detail: text ? `The application reported a database error: ${text.slice(0, 160)}` : 'The application cannot reach its database.',
      hint: 'Check that the database server is running, the credentials in .env are right and it has free connections and disk space.',
    };
  }
  if ((m = body.match(/Allowed memory size of (\d+) bytes exhausted/i))) {
    return {
      cause: 'php_memory', component: 'PHP', title: 'PHP memory limit exhausted',
      detail: `A request needed more than the ${mb(m[1])} PHP memory limit and stopped.`,
      hint: 'Raise memory_limit (or WP_MEMORY_LIMIT in wp-config.php), and look for the plugin or query that uses so much memory.',
    };
  }
  if ((m = body.match(/Maximum execution time of (\d+) seconds? exceeded/i))) {
    return {
      cause: 'php_timeout', component: 'PHP', title: 'PHP request timed out',
      detail: `A request ran longer than the ${m[1]}-second max_execution_time limit.`,
      hint: 'Find the slow request (often a plugin, an external API call or a heavy query) and raise max_execution_time only if needed.',
    };
  }
  if (/No space left on device|Disk quota exceeded/i.test(body)) {
    return {
      cause: 'disk_full', component: 'Server disk', title: 'Disk full',
      detail: 'The server could not write a file because the disk is full.',
      hint: 'Free space on the server: old backups, logs and cache folders are the usual culprits.',
    };
  }
  if (/Briefly unavailable for scheduled maintenance/i.test(body)) {
    return {
      cause: 'maintenance_stuck', component: 'WordPress', title: 'Stuck in maintenance mode',
      detail: 'WordPress is showing its maintenance page, usually because an update did not finish.',
      hint: 'Delete the .maintenance file in the WordPress root, then re-run the update that was interrupted.',
    };
  }
  if (/There has been a critical error on (?:this|your) website/i.test(body)) {
    const p = body.match(/wp-content\/plugins\/([a-z0-9._-]+)\//i);
    const t = body.match(/wp-content\/themes\/([a-z0-9._-]+)\//i);
    const who = p ? `the ${plugin(p[1])} plugin` : t ? `the ${plugin(t[1])} theme` : null;
    return {
      cause: 'wordpress_fatal', component: p ? `Plugin: ${plugin(p[1])}` : t ? `Theme: ${plugin(t[1])}` : 'WordPress',
      title: who ? `WordPress fatal error in ${who}` : 'WordPress fatal error',
      detail: who ? `A PHP fatal error in ${who} stopped the site.` : 'A PHP fatal error stopped the site (usually a plugin or theme, often right after an update).',
      hint: who ? `Deactivate ${who} (rename its folder over FTP if you cannot log in) and check its latest update.` : 'Check the error log or the "critical error" email WordPress sent the admin, then deactivate the plugin or theme it names.',
    };
  }
  if ((m = body.match(/(?:Fatal error|Parse error|Uncaught [\w\\]+)(?:<\/b>)?:?\s*([^<\n]{0,140}?)\s+in\s+(?:<b>)?([^<\n]+?\.php)/i))) {
    const file = m[2].trim(); const p = file.match(/wp-content\/plugins\/([a-z0-9._-]+)\//i);
    return {
      cause: 'php_fatal', component: p ? `Plugin: ${plugin(p[1])}` : 'PHP', title: p ? `PHP fatal error in the ${plugin(p[1])} plugin` : 'PHP fatal error',
      detail: `${m[1].trim().slice(0, 120)} (${file.split('/').slice(-3).join('/')})`,
      hint: 'Fix or roll back the file named here. Turn off display_errors on production so visitors do not see file paths.',
    };
  }
  if (/Account Suspended|This Account has been suspended|account has been suspended/i.test(body)) {
    return {
      cause: 'hosting_suspended', component: 'Hosting', title: 'Hosting account suspended',
      detail: 'The host is showing an "account suspended" page instead of the site.',
      hint: 'Contact your hosting provider; this is usually an unpaid invoice or a resource or abuse limit.',
    };
  }
  if (/Application error: a (?:server|client)-side exception has occurred/i.test(body)) {
    return {
      cause: 'nextjs_error', component: 'Next.js app', title: 'Next.js application error',
      detail: 'The Next.js app threw an exception while rendering the page.',
      hint: 'Check the server logs (Vercel or your Node process) for the stack trace of the failing route.',
    };
  }
  if (/Whoops, looks like something went wrong|laravel_session|<title>\s*Server Error\s*<\/title>[\s\S]{0,4000}?500/i.test(body)) {
    return {
      cause: 'laravel_error', component: 'Laravel app', title: 'Laravel application error',
      detail: 'Laravel returned its "Server Error" page: an exception was thrown while handling the request.',
      hint: 'Check storage/logs/laravel.log for the exception. Common causes: a failed deployment, a missing .env value or a database error.',
    };
  }
  return null;
}

// Cloudflare's origin errors, when the site is behind Cloudflare.
const CLOUDFLARE = {
  520: ['Origin returned an unexpected response', 'The web server sent an empty or invalid response to Cloudflare.', 'Check the web server and application logs; the server may be crashing on requests.'],
  521: ['Web server is down', 'Cloudflare could not connect: the origin web server refused the connection.', 'Start the web server (nginx/Apache) and check that it allows Cloudflare\'s IP addresses.'],
  522: ['Connection to the web server timed out', 'Cloudflare could not reach the origin server in time.', 'The server may be overloaded, offline or blocking Cloudflare in its firewall.'],
  523: ['Web server unreachable', 'Cloudflare cannot route to the origin server.', 'Check the A/AAAA records in Cloudflare DNS point at the right server.'],
  524: ['Web server took too long to respond', 'The origin accepted the connection but did not answer within 100 seconds.', 'Find the slow request: a long-running script, a stuck queue or a slow database.'],
  525: ['SSL handshake with the web server failed', 'Cloudflare could not complete HTTPS with the origin.', 'Check the certificate and HTTPS configuration on the origin server.'],
  526: ['Invalid SSL certificate on the web server', 'The origin\'s certificate is expired, self-signed or for another domain.', 'Renew or replace the certificate on the origin, or change the Cloudflare SSL mode.'],
};

/**
 * Diagnoses an HTTP response that was not a healthy answer.
 * @param {{ status: number, body?: string, headers?: Record<string, string|null> }} r
 */
export function diagnoseResponse(r) {
  const fromPage = fromBody(r.body || '');
  if (fromPage) return { ...fromPage, statusCode: r.status };
  const body = r.body || '';
  const code = body.match(/error code:\s*(\d{3,4})/i)?.[1];
  if (r.status === 530 && code === '1016') {
    return { cause: 'dns', component: 'DNS', statusCode: 530, title: 'Domain does not resolve', detail: 'The domain\'s DNS record points nowhere (Cloudflare error 1016).', hint: 'Check the domain\'s DNS records and that the domain has not expired.' };
  }
  if (CLOUDFLARE[r.status]) {
    const [title, detail, hint] = CLOUDFLARE[r.status];
    return { cause: r.status === 525 || r.status === 526 ? 'ssl' : 'origin_down', component: 'Web server (behind Cloudflare)', statusCode: r.status, title, detail: `${detail} (Cloudflare ${r.status})`, hint };
  }
  const server = (r.headers?.server || '').toLowerCase();
  const front = server.includes('nginx') ? 'nginx' : server.includes('apache') ? 'Apache' : server.includes('litespeed') ? 'LiteSpeed' : 'The web server';
  if (r.status === 502) {
    return { cause: 'app_server_down', component: 'Application server', statusCode: 502, title: 'Application server not responding', detail: `${front} is up, but the application behind it (PHP-FPM, Node or the app container) is not answering (502 Bad Gateway).`, hint: 'Restart PHP-FPM / the Node process and check its logs; it may have crashed or run out of memory or workers.' };
  }
  if (r.status === 504) {
    return { cause: 'app_server_slow', component: 'Application server', statusCode: 504, title: 'Application server timed out', detail: `${front} gave up waiting for the application (504 Gateway Timeout).`, hint: 'Look for slow requests or a stuck database; increase workers if the server is overloaded.' };
  }
  if (r.status === 503) {
    return { cause: 'unavailable', component: 'Web server', statusCode: 503, title: 'Site temporarily unavailable', detail: 'The server answered 503 Service Unavailable: overloaded, in maintenance mode, or a resource limit was hit.', hint: 'Check for a maintenance mode switch (php artisan up, .maintenance) and the host\'s resource limits.' };
  }
  if (r.status === 508) {
    return { cause: 'resource_limit', component: 'Hosting', statusCode: 508, title: 'Hosting resource limit reached', detail: 'The host stopped the site because it used too many processes or too much CPU (508).', hint: 'Look for traffic spikes, bots or a plugin running heavy background work; upgrade the plan if needed.' };
  }
  return null;
}

/** Diagnoses a request that never got an HTTP answer. */
export function diagnoseNetworkError(error, timeoutSeconds) {
  const msg = String(error?.message || '');
  if (error?.name === 'TimeoutError') {
    return { cause: 'timeout', component: 'Server', title: 'Not responding', detail: `No answer within ${timeoutSeconds} seconds.`, hint: 'The server may be overloaded, stuck on a slow request, or down. Check its load and whether it is reachable at all.' };
  }
  if (/certificate|SSL|TLS|handshake/i.test(msg)) {
    return { cause: 'ssl', component: 'SSL certificate', title: 'SSL/TLS connection failed', detail: msg.slice(0, 160), hint: 'Check that the certificate is valid, not expired and issued for this domain.' };
  }
  if (/ENOTFOUND|getaddrinfo|DNS|name not resolved|lookup/i.test(msg)) {
    return { cause: 'dns', component: 'DNS', title: 'Domain does not resolve', detail: 'The domain name could not be resolved to a server.', hint: 'Check the DNS records and that the domain has not expired.' };
  }
  if (/refused|ECONNREFUSED|reset|ECONNRESET|closed|lost/i.test(msg)) {
    return { cause: 'connection_refused', component: 'Web server', title: 'Connection refused', detail: 'The server closed or refused the connection.', hint: 'The web server may be stopped, or a firewall is blocking requests.' };
  }
  return null;
}

/** The error object a check result carries: a diagnosis when there is one, else the caller's fallback. */
export function errorFor(diagnosis, fallback) {
  if (!diagnosis) return fallback;
  return {
    message: `${diagnosis.title}: ${diagnosis.detail}`,
    code: fallback?.code || 'DIAGNOSED',
    cause: diagnosis.cause,
    component: diagnosis.component,
    hint: diagnosis.hint,
  };
}
