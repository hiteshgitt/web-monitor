/**
 * Verification Script - Check if Next.js integration is installed correctly
 * 
 * Usage: node verify-installation.js
 */

const fs = require('fs');
const path = require('path');

function findProjectRoot() {
  let currentDir = process.cwd();
  
  if (path.basename(currentDir) === 'nextjs-integration') {
    currentDir = path.dirname(currentDir);
  }
  
  return currentDir;
}

const PROJECT_ROOT = findProjectRoot();

console.log('🔍 Verifying Next.js Integration Installation\n');
console.log(`📁 Project root: ${PROJECT_ROOT}\n`);

// Check for App Router
const appRouteFile = path.join(PROJECT_ROOT, 'app', 'api', 'webmonitor', 'route.ts');
const pagesRouteFile = path.join(PROJECT_ROOT, 'pages', 'api', 'webmonitor', '[...slug].ts');

let found = false;
let version = '';

if (fs.existsSync(appRouteFile)) {
  console.log('✅ Found App Router route file:');
  console.log(`   ${appRouteFile}`);
  found = true;
  version = 'App Router (Next.js 13+)';
} else if (fs.existsSync(pagesRouteFile)) {
  console.log('✅ Found Pages Router route file:');
  console.log(`   ${pagesRouteFile}`);
  found = true;
  version = 'Pages Router (Next.js 12 or below)';
} else {
  console.log('❌ Route file not found!');
  console.log('');
  console.log('Expected locations:');
  console.log(`   App Router: ${appRouteFile}`);
  console.log(`   Pages Router: ${pagesRouteFile}`);
  console.log('');
  console.log('Please run: node install.js');
  process.exit(1);
}

// Check .env.local
const envFile = path.join(PROJECT_ROOT, '.env.local');
console.log('');
if (fs.existsSync(envFile)) {
  const envContent = fs.readFileSync(envFile, 'utf8');
  if (envContent.includes('WEBMONITOR_API_KEY')) {
    const match = envContent.match(/WEBMONITOR_API_KEY=(.+)/);
    if (match) {
      const apiKey = match[1].trim();
      console.log('✅ Found API key in .env.local');
      console.log(`   Key: ${apiKey.substring(0, 16)}...`);
    } else {
      console.log('⚠️  .env.local exists but API key format is incorrect');
    }
  } else {
    console.log('⚠️  .env.local exists but WEBMONITOR_API_KEY not found');
  }
} else {
  console.log('⚠️  .env.local not found');
  console.log('   Run: node install.js (it will create .env.local)');
}

console.log('');
console.log('='.repeat(50));
console.log('✅ Installation verified!');
console.log(`📦 Version: ${version}`);
console.log('');
console.log('📝 Next steps:');
console.log('   1. Restart your Next.js server (if running)');
console.log('   2. Test: curl http://localhost:3002/api/webmonitor/health \\');
if (fs.existsSync(envFile)) {
  const envContent = fs.readFileSync(envFile, 'utf8');
  const match = envContent.match(/WEBMONITOR_API_KEY=(.+)/);
  if (match) {
    console.log(`      -H "Authorization: Bearer ${match[1].trim()}"`);
  }
}
console.log('   3. Add to Web Monitor Dashboard');
console.log('='.repeat(50));

