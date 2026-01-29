#!/usr/bin/env node

/**
 * PHP Integration Verification Script
 * Checks if the installation is correct and routes are configured
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const INTEGRATION_DIR = __dirname;
let PROJECT_ROOT = process.cwd();

// Auto-detect if running from integration folder
if (path.basename(PROJECT_ROOT) === 'php-integration' || path.basename(PROJECT_ROOT) === 'SAP Analytics') {
  PROJECT_ROOT = path.dirname(PROJECT_ROOT);
}

console.log('🔍 Web Monitor PHP Integration - Verification\n');
console.log(`📁 Project root: ${PROJECT_ROOT}\n`);

// Detect framework
function detectFramework() {
  if (fs.existsSync(path.join(PROJECT_ROOT, 'artisan')) && 
      fs.existsSync(path.join(PROJECT_ROOT, 'composer.json'))) {
    const composerJson = JSON.parse(fs.readFileSync(path.join(PROJECT_ROOT, 'composer.json'), 'utf8'));
    if (composerJson.name && composerJson.name.includes('laravel') || 
        (composerJson.require && composerJson.require['laravel/framework'])) {
      return 'laravel';
    }
  }
  
  if (fs.existsSync(path.join(PROJECT_ROOT, 'spark')) && 
      fs.existsSync(path.join(PROJECT_ROOT, 'app', 'Config'))) {
    return 'codeigniter4';
  }
  
  if (fs.existsSync(path.join(PROJECT_ROOT, 'application')) && 
      fs.existsSync(path.join(PROJECT_ROOT, 'system'))) {
    return 'codeigniter3';
  }
  
  return 'core-php';
}

const framework = detectFramework();
console.log(`📦 Detected framework: ${framework}\n`);

// Verification checks
const checks = [];

// Check 1: Controller file exists
if (framework === 'laravel') {
  const controllerPath = path.join(PROJECT_ROOT, 'app', 'Http', 'Controllers', 'WebMonitorController.php');
  const apiPath = path.join(PROJECT_ROOT, 'app', 'Http', 'Controllers', 'WebMonitorAPI.php');
  
  checks.push({
    name: 'WebMonitorController exists',
    path: controllerPath,
    exists: fs.existsSync(controllerPath),
    fix: `Copy from ${path.join(INTEGRATION_DIR, 'laravel', 'WebMonitorController.php')}`
  });
  
  checks.push({
    name: 'WebMonitorAPI exists',
    path: apiPath,
    exists: fs.existsSync(apiPath),
    fix: `Copy from ${path.join(INTEGRATION_DIR, 'common', 'WebMonitorAPI.php')}`
  });
  
  // Check 2: Routes configured
  const routesPath = path.join(PROJECT_ROOT, 'routes', 'api.php');
  let routesConfigured = false;
  if (fs.existsSync(routesPath)) {
    const routesContent = fs.readFileSync(routesPath, 'utf8');
    routesConfigured = routesContent.includes('WebMonitorController') || 
                      routesContent.includes('webmonitor');
  }
  
  checks.push({
    name: 'Routes configured in routes/api.php',
    path: routesPath,
    exists: routesConfigured,
    fix: `Add to routes/api.php:\nRoute::prefix('webmonitor')->group(function () {\n    Route::get('/{endpoint}', [App\\Http\\Controllers\\WebMonitorController::class, 'handle']);\n});`
  });
  
  // Check 3: .env has API key
  const envPath = path.join(PROJECT_ROOT, '.env');
  let hasApiKey = false;
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    hasApiKey = envContent.includes('WEBMONITOR_API_KEY=');
  }
  
  checks.push({
    name: 'API key in .env',
    path: envPath,
    exists: hasApiKey,
    fix: `Add WEBMONITOR_API_KEY=your_api_key_here to .env file`
  });
  
} else if (framework === 'codeigniter4' || framework === 'codeigniter3') {
  const controllerPath = path.join(PROJECT_ROOT, 'app', 'Controllers', 'WebMonitorController.php');
  const apiPath = path.join(PROJECT_ROOT, 'app', 'Controllers', 'WebMonitorAPI.php');
  
  checks.push({
    name: 'WebMonitorController exists',
    path: controllerPath,
    exists: fs.existsSync(controllerPath),
    fix: `Copy from ${path.join(INTEGRATION_DIR, 'codeigniter', 'WebMonitorController.php')}`
  });
  
  checks.push({
    name: 'WebMonitorAPI exists',
    path: apiPath,
    exists: fs.existsSync(apiPath),
    fix: `Copy from ${path.join(INTEGRATION_DIR, 'common', 'WebMonitorAPI.php')}`
  });
  
  const routesPath = path.join(PROJECT_ROOT, 'app', 'Config', 'Routes.php');
  let routesConfigured = false;
  if (fs.existsSync(routesPath)) {
    const routesContent = fs.readFileSync(routesPath, 'utf8');
    routesConfigured = routesContent.includes('WebMonitorController') || 
                      routesContent.includes('webmonitor');
  }
  
  checks.push({
    name: 'Routes configured',
    path: routesPath,
    exists: routesConfigured,
    fix: `Add to app/Config/Routes.php:\n$routes->get('api/webmonitor/(:segment)', 'WebMonitorController::handle/$1');`
  });
  
} else {
  // Core PHP
  const webmonitorPath = path.join(PROJECT_ROOT, 'api', 'webmonitor.php');
  const apiPath = path.join(PROJECT_ROOT, 'api', 'WebMonitorAPI.php');
  
  checks.push({
    name: 'webmonitor.php exists',
    path: webmonitorPath,
    exists: fs.existsSync(webmonitorPath),
    fix: `Copy from ${path.join(INTEGRATION_DIR, 'core-php', 'webmonitor.php')}`
  });
  
  checks.push({
    name: 'WebMonitorAPI.php exists',
    path: apiPath,
    exists: fs.existsSync(apiPath),
    fix: `Copy from ${path.join(INTEGRATION_DIR, 'common', 'WebMonitorAPI.php')}`
  });
}

// Print results
console.log('='.repeat(60));
console.log('📋 Verification Results:\n');

let allPassed = true;
checks.forEach((check, index) => {
  const status = check.exists ? '✅' : '❌';
  console.log(`${status} ${index + 1}. ${check.name}`);
  console.log(`   Path: ${check.path}`);
  
  if (!check.exists) {
    allPassed = false;
    console.log(`   ⚠️  Missing!`);
    console.log(`   Fix: ${check.fix}\n`);
  } else {
    console.log('   ✓ Found\n');
  }
});

console.log('='.repeat(60));

if (allPassed) {
  console.log('\n✅ All checks passed! Installation looks correct.\n');
  console.log('📝 Next steps:');
  console.log('   1. Restart your PHP server/web server');
  console.log('   2. Test the endpoint:');
  console.log(`      curl http://your-site.com/api/webmonitor/health \\`);
  console.log(`        -H "Authorization: Bearer YOUR_API_KEY"`);
  console.log('   3. If you see 404, check:');
  console.log('      - Laravel: php artisan route:list | grep webmonitor');
  console.log('      - Make sure routes/api.php is loaded');
  console.log('      - Check if API routes are enabled in app/Providers/RouteServiceProvider.php');
} else {
  console.log('\n❌ Some checks failed. Please fix the issues above.\n');
  console.log('💡 Tip: Run the install script again:');
  console.log(`   node ${path.join(INTEGRATION_DIR, 'install.js')}`);
  process.exit(1);
}

