// Operator: switch a Ruya Lab account's plan (Ruya Lab Pro unlocks Pro in every product).
//   node scripts/plan.mjs <email> pro|free            # production (--remote)
//   node scripts/plan.mjs <email> pro|free --local    # local D1
// Products pick the change up within 15 minutes, or at the person's next sign-in.
import { execFileSync } from 'node:child_process';

const [email, plan, where = '--remote'] = process.argv.slice(2);
const EMAIL = /^[A-Za-z0-9._%+-]{1,64}@[A-Za-z0-9.-]{1,253}\.[A-Za-z]{2,}$/;
if (!email || !EMAIL.test(email) || !['pro', 'free'].includes(plan) || !['--remote', '--local'].includes(where)) {
  console.error('Usage: node scripts/plan.mjs <email> pro|free [--local]');
  process.exit(2);
}
// The email is checked against a strict pattern above (no quotes), so it is safe inside the SQL string.
const sql = `UPDATE users SET plan = '${plan}', plan_changed_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE email = '${email.toLowerCase()}';
SELECT email, plan, plan_changed_at FROM users WHERE email = '${email.toLowerCase()}';`;
const out = execFileSync('npx', ['wrangler', 'd1', 'execute', 'ruyalab-accounts', where, '--json', '--command', sql], { encoding: 'utf8' });
const rows = JSON.parse(out).at(-1)?.results ?? [];
if (!rows.length) {
  console.error(`No Ruya Lab account with the email ${email}. They need to sign up at accounts.ruyalab.com first.`);
  process.exit(1);
}
console.log(`${rows[0].email}: ${rows[0].plan === 'pro' ? 'Ruya Lab Pro' : 'Free'} (changed ${rows[0].plan_changed_at})`);
