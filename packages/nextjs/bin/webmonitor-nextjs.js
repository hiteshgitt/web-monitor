#!/usr/bin/env node
// npx webmonitor-nextjs init [--new] [--force]
//   Creates the Web Monitor API route in your Next.js project and saves WEBMONITOR_API_KEY in .env.local.
import fs from 'node:fs';
import path from 'node:path';
import { randomBytes } from 'node:crypto';

const args = process.argv.slice(2);
const command = args.find((a) => !a.startsWith('-')) || 'help';
const flag = (name) => args.includes(`--${name}`);
const root = process.cwd();

const color = (code) => (text) => (process.stdout.isTTY ? `\x1b[${code}m${text}\x1b[0m` : text);
const green = color(32);
const yellow = color(33);
const red = color(31);

function fail(message) {
  console.error(red(`✖ ${message}`));
  process.exit(1);
}

function findRouterDir() {
  for (const dir of ['app', 'src/app']) {
    if (fs.existsSync(path.join(root, dir))) return { type: 'app', dir };
  }
  for (const dir of ['pages', 'src/pages']) {
    if (fs.existsSync(path.join(root, dir))) return { type: 'pages', dir };
  }
  return null;
}

function writeRoute() {
  const router = findRouterDir();
  if (!router) fail('No app/ or pages/ folder found. Run this in the root of your Next.js project.');
  const ext = fs.existsSync(path.join(root, 'tsconfig.json')) ? 'ts' : 'js';
  const file = router.type === 'app'
    ? path.join(router.dir, 'api', 'webmonitor', '[...slug]', `route.${ext}`)
    : path.join(router.dir, 'api', 'webmonitor', `[...slug].${ext}`);
  const contents = router.type === 'app'
    ? [
      '// Web Monitor endpoint (created by `npx webmonitor-nextjs init`)',
      "export { GET } from '@ruyalab/webmonitor-nextjs/app-router';",
      "export const dynamic = 'force-dynamic';",
      "export const runtime = 'nodejs';",
      '',
    ].join('\n')
    : [
      '// Web Monitor endpoint (created by `npx webmonitor-nextjs init`)',
      "export { default } from '@ruyalab/webmonitor-nextjs/pages-router';",
      '',
    ].join('\n');

  const fullPath = path.join(root, file);
  if (fs.existsSync(fullPath) && !flag('force')) {
    console.log(green(`✔ Route already exists: ${file}`));
    return;
  }
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, contents);
  console.log(green(`✔ Created ${file}`));
}

function ensureKey() {
  const envFile = path.join(root, '.env.local');
  let env = fs.existsSync(envFile) ? fs.readFileSync(envFile, 'utf8') : '';
  const existing = env.match(/^WEBMONITOR_API_KEY=(.*)$/m)?.[1]?.trim().replace(/^["']|["']$/g, '');
  if (existing && !flag('new')) {
    console.log(green('✔ WEBMONITOR_API_KEY already set in .env.local (use --new to replace it)'));
    return existing;
  }
  const key = randomBytes(32).toString('hex');
  const line = `WEBMONITOR_API_KEY=${key}`;
  env = /^WEBMONITOR_API_KEY=/m.test(env)
    ? env.replace(/^WEBMONITOR_API_KEY=.*$/m, line)
    : `${env.replace(/\n*$/, '')}${env ? '\n\n' : ''}${line}\n`;
  fs.writeFileSync(envFile, env);
  console.log(green('✔ Saved WEBMONITOR_API_KEY in .env.local'));
  return key;
}

if (command === 'init') {
  const pkgFile = path.join(root, 'package.json');
  if (!fs.existsSync(pkgFile)) fail('No package.json here. Run this in the root of your Next.js project.');
  const pkg = JSON.parse(fs.readFileSync(pkgFile, 'utf8'));
  if (!pkg.dependencies?.next && !pkg.devDependencies?.next) {
    console.log(yellow('! "next" is not in package.json — make sure you are in your Next.js project root.'));
  }
  writeRoute();
  const key = ensureKey();
  console.log(`
  Next steps
  1. Add the same variable to your hosting provider (e.g. Vercel → Settings → Environment Variables):
       ${yellow('WEBMONITOR_API_KEY')}=${key}
  2. Deploy, then add the site in your Web Monitor dashboard:
       Platform: ${yellow('Next.js')}    API key: ${key}
  3. Test: curl -H "Authorization: Bearer ${key}" https://your-site.com/api/webmonitor/health
`);
} else {
  console.log(`Web Monitor for Next.js

Usage:
  npx webmonitor-nextjs init          Create the API route and WEBMONITOR_API_KEY
  npx webmonitor-nextjs init --new    Replace the API key with a new one
  npx webmonitor-nextjs init --force  Re-create the route file
`);
}
