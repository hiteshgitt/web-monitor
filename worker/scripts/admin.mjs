// Creates a super admin, or resets one (lost password or phone), and prints a one-time setup link.
// The admin opens the link, chooses their password and links an authenticator app. Nobody else sees the password.
//
//   npm run admin:create -- webmonitor@ruyalab.com "Web Monitor Admin" --remote
//   npm run admin:create -- webmonitor@ruyalab.com --reset --remote     (new link; old password + authenticator stop working)
//   add --local to use the local development database instead of production
import { execFileSync } from 'node:child_process';
import { createHash, randomBytes, randomUUID } from 'node:crypto';

const SITE = process.env.SITE_URL || 'https://webmonitor.ruyalab.com';
const LINK_HOURS = 24;

const args = process.argv.slice(2);
const flags = new Set(args.filter((a) => a.startsWith('--')));
const [email, name = ''] = args.filter((a) => !a.startsWith('--'));
const where = flags.has('--local') ? '--local' : flags.has('--remote') ? '--remote' : null;

if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !where) {
  console.error('Usage: npm run admin:create -- <email> ["Name"] [--reset] --remote|--local');
  process.exit(1);
}

const sql = (value) => (value == null ? 'NULL' : `'${String(value).replace(/'/g, "''")}'`);
const d1 = (command) => execFileSync('npx', ['wrangler', 'd1', 'execute', 'web-monitor', where, '--json', '--command', command], {
  encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'],
});

const normalized = email.trim().toLowerCase();
const existing = JSON.parse(d1(`SELECT id FROM admins WHERE email = ${sql(normalized)}`))[0].results[0];
if (existing && !flags.has('--reset')) {
  console.error(`${normalized} is already an admin. Use --reset to send a new setup link (this signs them out of 2-step setup).`);
  process.exit(1);
}

const token = randomBytes(32).toString('base64url');
const tokenHash = createHash('sha256').update(token).digest('hex');
const now = new Date().toISOString();
const expires = new Date(Date.now() + LINK_HOURS * 60 * 60 * 1000).toISOString();

if (existing) {
  // Reset: the old password and authenticator stop working right away
  d1(`UPDATE admins SET password_hash = NULL, totp_enabled = 0, totp_secret = NULL, totp_last_step = NULL,
    setup_token_hash = ${sql(tokenHash)}, setup_expires_at = ${sql(expires)}, updated_at = ${sql(now)} WHERE id = ${sql(existing.id)}`);
} else {
  d1(`INSERT INTO admins (id, email, name, setup_token_hash, setup_expires_at, created_at, updated_at) VALUES
    (${sql(randomUUID().replace(/-/g, ''))}, ${sql(normalized)}, ${sql(name)}, ${sql(tokenHash)}, ${sql(expires)}, ${sql(now)}, ${sql(now)})`);
}

const base = where === '--local' ? (process.env.SITE_URL || 'http://localhost:8787') : SITE;
console.log(`\n${existing ? 'Reset' : 'Created'} super admin ${normalized}.`);
console.log(`One-time setup link (valid ${LINK_HOURS} hours, works once):\n\n  ${base}/ruyashield/setup?token=${token}\n`);
