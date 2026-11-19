// Latest integration versions, shown on the Integrations page and used to tell customers when a site's plugin or
// package is behind. Keep in step with wordpress-plugin/ (Version header), packages/php-core (VERSION) and
// packages/nextjs (package.json) when releasing.
export const LATEST_INTEGRATION = {
  wordpress: { version: '1.6.0', whatsNew: 'Inode (file count) monitoring with alerts, the suspicious-file scan (backdoors, web shells, code in uploads, modified WordPress core) and error tracking with stack traces.' },
  nextjs: { version: '1.4.0', whatsNew: 'Inode (file count) monitoring, error tracking with stack traces (needs instrumentation.ts), and the real runtime and Node.js flags for Release Radar.' },
  laravel: { version: '1.5.0', whatsNew: 'Inode monitoring, the suspicious-file scan with file and line, and error tracking for every exception Laravel reports.' },
  codeigniter: { version: '1.5.0', whatsNew: 'Inode monitoring, the suspicious-file scan with file and line, and error tracking with stack traces.' },
  php: { version: '1.5.0', whatsNew: 'Inode monitoring, the suspicious-file scan with file and line, and error tracking (add webmonitor-track.php to index.php).' },
};

export const UPDATE_HOW = {
  wordpress: 'Download the zip from the Integrations page and upload it in Plugins → Add New → Upload Plugin, then choose “Replace current with uploaded”.',
  nextjs: 'Run npm install @ruyalab/webmonitor-nextjs@latest and deploy.',
  laravel: 'Run composer update ruyalab/webmonitor-laravel and deploy.',
  codeigniter: 'Run composer update ruyalab/webmonitor-codeigniter and deploy.',
  php: 'Download the Core PHP zip again and replace api/webmonitor.php (keep your webmonitor-config.php).',
};

/** True when `installed` is older than the latest release for this platform (unknown counts as not behind). */
export function integrationBehind(platform, installed) {
  const latest = LATEST_INTEGRATION[platform]?.version;
  const a = String(installed || '').match(/^(\d+)\.(\d+)\.(\d+)/);
  const b = String(latest || '').match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!a || !b) return false;
  for (let i = 1; i <= 3; i += 1) if (Number(a[i]) !== Number(b[i])) return Number(a[i]) < Number(b[i]);
  return false;
}
