/**
 * Web Monitor Integration Installation Script
 * 
 * Usage: node install.js
 * 
 * This script:
 * 1. Copies the appropriate route file to your Next.js project
 * 2. Creates .env.local if it doesn't exist
 * 3. Generates an API key if not set
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const INTEGRATION_DIR = __dirname;

// Find Next.js project root
function findProjectRoot() {
  let currentDir = process.cwd();
  const maxDepth = 10; // Prevent infinite loops
  let depth = 0;
  
  // If we're inside the integration folder, go up one level
  if (path.basename(currentDir) === 'nextjs-integration') {
    currentDir = path.dirname(currentDir);
    console.log(`📁 Detected we're in integration folder, looking in parent: ${currentDir}`);
  }
  
  // Search up the directory tree for Next.js project
  while (depth < maxDepth) {
    const appDir = path.join(currentDir, 'app');
    const pagesDir = path.join(currentDir, 'pages');
    const packageJson = path.join(currentDir, 'package.json');
    
    // Check if this looks like a Next.js project
    if (fs.existsSync(packageJson)) {
      const packageContent = JSON.parse(fs.readFileSync(packageJson, 'utf8'));
      if (packageContent.dependencies && packageContent.dependencies.next) {
        if (fs.existsSync(appDir) || fs.existsSync(pagesDir)) {
          return currentDir;
        }
      }
    }
    
    // Go up one level
    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) {
      // Reached filesystem root
      break;
    }
    currentDir = parentDir;
    depth++;
  }
  
  return null;
}

const PROJECT_ROOT = findProjectRoot();

// Detect Next.js version
function detectNextJsVersion() {
  if (!PROJECT_ROOT) {
    console.error('❌ Error: Could not find Next.js project root.');
    console.error('');
    console.error('   Make sure you:');
    console.error('   1. Are in a Next.js project directory');
    console.error('   2. Or run from the project root: cd .. && node nextjs-integration/install.js');
    console.error('');
    console.error('   Current directory:', process.cwd());
    process.exit(1);
  }
  
  const appDir = path.join(PROJECT_ROOT, 'app');
  const pagesDir = path.join(PROJECT_ROOT, 'pages');
  
  if (fs.existsSync(appDir)) {
    return 'app-router';
  } else if (fs.existsSync(pagesDir)) {
    return 'pages-router';
  } else {
    console.error('❌ Error: Could not detect Next.js project structure.');
    console.error('   Found project root:', PROJECT_ROOT);
    console.error('   But no app/ or pages/ directory found.');
    console.error('   Make sure this is a Next.js project.');
    process.exit(1);
  }
}

// Generate API key
function generateApiKey() {
  return crypto.randomBytes(32).toString('hex');
}

// Copy route file
function copyRouteFile(version) {
  let sourceFile, targetDir, targetFile;
  
  if (version === 'app-router') {
    // Use catch-all route structure: app/api/webmonitor/[...slug]/route.ts
    sourceFile = path.join(INTEGRATION_DIR, 'app-router', 'webmonitor', '[...slug]', 'route.ts');
    targetDir = path.join(PROJECT_ROOT, 'app', 'api', 'webmonitor', '[...slug]');
    targetFile = path.join(targetDir, 'route.ts');
  } else {
    sourceFile = path.join(INTEGRATION_DIR, 'pages-router', 'api', 'webmonitor', '[...slug].ts');
    targetDir = path.join(PROJECT_ROOT, 'pages', 'api', 'webmonitor');
    targetFile = path.join(targetDir, '[...slug].ts');
  }
  
  // Create target directory if it doesn't exist
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
    console.log(`✅ Created directory: ${targetDir}`);
  }
  
  // Copy file
  if (fs.existsSync(targetFile)) {
    console.log(`⚠️  File already exists: ${targetFile}`);
    console.log(`   Skipping copy. If you want to update, delete the file first.`);
    return false;
  }
  
  fs.copyFileSync(sourceFile, targetFile);
  console.log(`✅ Copied route file to: ${targetFile}`);
  return true;
}

// Setup environment variables
function setupEnvFile() {
  const envFile = path.join(PROJECT_ROOT, '.env.local');
  const envExample = path.join(INTEGRATION_DIR, '.env.example');
  
  let envContent = '';
  let apiKey = '';
  
  // Read existing .env.local if it exists
  if (fs.existsSync(envFile)) {
    envContent = fs.readFileSync(envFile, 'utf8');
    // Check if API key already exists
    const match = envContent.match(/WEBMONITOR_API_KEY=(.+)/);
    if (match) {
      apiKey = match[1].trim();
      console.log(`✅ Found existing API key in .env.local`);
    }
  }
  
  // Generate new API key if not found
  if (!apiKey) {
    apiKey = generateApiKey();
    console.log(`✅ Generated new API key: ${apiKey.substring(0, 16)}...`);
  }
  
  // Add or update API key in .env.local
  if (envContent.includes('WEBMONITOR_API_KEY')) {
    envContent = envContent.replace(/WEBMONITOR_API_KEY=.*/, `WEBMONITOR_API_KEY=${apiKey}`);
  } else {
    envContent += `\n# Web Monitor API Key\nWEBMONITOR_API_KEY=${apiKey}\n`;
  }
  
  fs.writeFileSync(envFile, envContent);
  console.log(`✅ Updated .env.local with API key`);
  
  return apiKey;
}

// Main installation
function install() {
  console.log('🚀 Web Monitor Integration - Installation\n');
  
  if (!PROJECT_ROOT) {
    console.error('❌ Error: Could not find Next.js project root.');
    console.error('');
    console.error('   Please run this script from your Next.js project root:');
    console.error('   cd /path/to/your-nextjs-project');
    console.error('   node nextjs-integration/install.js');
    console.error('');
    console.error('   Or if you\'re already in the project root:');
    console.error('   node nextjs-integration/install.js');
    process.exit(1);
  }
  
  console.log(`📁 Project root: ${PROJECT_ROOT}\n`);
  
  // Check if we're in a Next.js project
  const packageJson = path.join(PROJECT_ROOT, 'package.json');
  if (!fs.existsSync(packageJson)) {
    console.error('❌ Error: package.json not found.');
    console.error('   Project root:', PROJECT_ROOT);
    process.exit(1);
  }
  
  // Detect Next.js version
  const version = detectNextJsVersion();
  console.log(`📦 Detected Next.js version: ${version === 'app-router' ? 'App Router (13+)' : 'Pages Router (12 or below)'}\n`);
  
  // Copy route file
  console.log('📋 Copying route file...');
  const copied = copyRouteFile(version);
  
  // Setup environment variables
  console.log('\n🔑 Setting up environment variables...');
  const apiKey = setupEnvFile();
  
  // Summary
  console.log('\n' + '='.repeat(50));
  console.log('✅ Installation Complete!\n');
  console.log('📝 Next Steps:');
  console.log('   1. Restart your Next.js dev server');
  console.log('   2. Test the endpoint:');
  console.log(`      curl http://localhost:3000/api/webmonitor/health \\`);
  console.log(`        -H "Authorization: Bearer ${apiKey}"`);
  console.log('   3. Add your site to Web Monitor Dashboard:');
  console.log(`      - URL: http://localhost:3000 (or your production URL)`);
  console.log(`      - Platform: Next.js`);
  console.log(`      - API Key: ${apiKey}`);
  console.log('\n⚠️  Important Notes:');
  console.log('   - If you change WEBMONITOR_API_KEY in .env.local,');
  console.log('     you MUST also update it in Web Monitor Dashboard');
  console.log('   - Always restart Next.js server after changing .env.local');
  console.log('   - See API_KEY_UPDATE.md for detailed instructions');
  console.log('\n' + '='.repeat(50));
}

// Run installation
install();

