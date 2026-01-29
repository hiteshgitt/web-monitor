#!/usr/bin/env node

/**
 * PHP Integration Installer
 * Auto-detects framework (Laravel, CodeIgniter, or Core PHP) and installs appropriate files
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

// Get the integration directory (ES modules don't have __dirname)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const INTEGRATION_DIR = __dirname;
let PROJECT_ROOT = process.cwd();

// Auto-detect if running from integration folder
if (path.basename(PROJECT_ROOT) === 'php-integration' || path.basename(PROJECT_ROOT) === 'SAP Analytics') {
  console.log('📁 Detected we\'re in integration folder, looking in parent directory...');
  PROJECT_ROOT = path.dirname(PROJECT_ROOT);
}

// Detect framework type
function detectFramework() {  
  // Check for Laravel
  if (fs.existsSync(path.join(PROJECT_ROOT, 'artisan')) && 
      fs.existsSync(path.join(PROJECT_ROOT, 'composer.json'))) {
    const composerJson = JSON.parse(fs.readFileSync(path.join(PROJECT_ROOT, 'composer.json'), 'utf8'));
    if (composerJson.name && composerJson.name.includes('laravel') || 
        (composerJson.require && composerJson.require['laravel/framework'])) {
      return 'laravel';
    }
  }
  
  // Check for CodeIgniter 4
  if (fs.existsSync(path.join(PROJECT_ROOT, 'spark')) && 
      fs.existsSync(path.join(PROJECT_ROOT, 'app', 'Config'))) {
    return 'codeigniter4';
  }
  
  // Check for CodeIgniter 3
  if (fs.existsSync(path.join(PROJECT_ROOT, 'application')) && 
      fs.existsSync(path.join(PROJECT_ROOT, 'system'))) {
    return 'codeigniter3';
  }
  
  // Core PHP
  return 'core-php';
}

// Generate API key
function generateApiKey() {
  return crypto.randomBytes(32).toString('hex');
}

// Read .env file
function readEnvFile() {
  const envPath = path.join(PROJECT_ROOT, '.env');
  if (!fs.existsSync(envPath)) {
    return {};
  }
  
  const envContent = fs.readFileSync(envPath, 'utf8');
  const env = {};
  envContent.split('\n').forEach(line => {
    line = line.trim();
    if (line && !line.startsWith('#') && line.includes('=')) {
      const [key, ...valueParts] = line.split('=');
      env[key.trim()] = valueParts.join('=').trim();
    }
  });
  return env;
}

// Write .env file
function writeEnvFile(env) {
  const envPath = path.join(PROJECT_ROOT, '.env');
  let envContent = '';
  
  if (fs.existsSync(envPath)) {
    envContent = fs.readFileSync(envPath, 'utf8');
  }
  
  // Update or add WEBMONITOR_API_KEY
  const lines = envContent.split('\n');
  let found = false;
  const updatedLines = lines.map(line => {
    if (line.startsWith('WEBMONITOR_API_KEY=')) {
      found = true;
      return `WEBMONITOR_API_KEY=${env.WEBMONITOR_API_KEY}`;
    }
    return line;
  });
  
  if (!found) {
    updatedLines.push(`WEBMONITOR_API_KEY=${env.WEBMONITOR_API_KEY}`);
  }
  
  fs.writeFileSync(envPath, updatedLines.join('\n'));
}

// Install Laravel
function installLaravel() {
  console.log('📦 Installing for Laravel...\n');
  
  // Copy controller
  const controllerTarget = path.join(PROJECT_ROOT, 'app', 'Http', 'Controllers', 'WebMonitorController.php');
  const controllerSource = path.join(INTEGRATION_DIR, 'laravel', 'WebMonitorController.php');
  
  // Copy common API class
  const commonTarget = path.join(PROJECT_ROOT, 'app', 'Http', 'Controllers', 'WebMonitorAPI.php');
  const commonSource = path.join(INTEGRATION_DIR, 'common', 'WebMonitorAPI.php');
  
  // Create directories if needed
  fs.mkdirSync(path.dirname(controllerTarget), { recursive: true });
  
  // Copy files
  let controllerContent = fs.readFileSync(controllerSource, 'utf8');
  // Fix the require path for Laravel
  controllerContent = controllerContent.replace(
    /require_once.*WebMonitorAPI\.php.*;/,
    `require_once __DIR__ . '/WebMonitorAPI.php';`
  );
  fs.writeFileSync(controllerTarget, controllerContent);
  
  fs.copyFileSync(commonSource, commonTarget);
  
  // Update routes/api.php
  const routesPath = path.join(PROJECT_ROOT, 'routes', 'api.php');
  if (fs.existsSync(routesPath)) {
    let routesContent = fs.readFileSync(routesPath, 'utf8');
    if (!routesContent.includes('WebMonitorController')) {
      routesContent += `\n// Web Monitor API Routes\n`;
      routesContent += `Route::prefix('webmonitor')->group(function () {\n`;
      routesContent += `    Route::get('/{endpoint}', [App\\Http\\Controllers\\WebMonitorController::class, 'handle']);\n`;
      routesContent += `});\n`;
      fs.writeFileSync(routesPath, routesContent);
      console.log('✅ Updated routes/api.php');
    } else {
      console.log('⚠️  Routes already configured');
    }
  }
  
  console.log(`✅ Installed WebMonitorController: ${controllerTarget}`);
  console.log(`✅ Installed WebMonitorAPI: ${commonTarget}`);
}

// Install CodeIgniter
function installCodeIgniter(version) {
  console.log(`📦 Installing for CodeIgniter ${version}...\n`);
  
  const controllerTarget = path.join(PROJECT_ROOT, 'app', 'Controllers', 'WebMonitorController.php');
  const controllerSource = path.join(INTEGRATION_DIR, 'codeigniter', 'WebMonitorController.php');
  
  // Copy common API class
  const commonTarget = path.join(PROJECT_ROOT, 'app', 'Controllers', 'WebMonitorAPI.php');
  const commonSource = path.join(INTEGRATION_DIR, 'common', 'WebMonitorAPI.php');
  
  // Create directories if needed
  fs.mkdirSync(path.dirname(controllerTarget), { recursive: true });
  
  // Copy files
  let controllerContent = fs.readFileSync(controllerSource, 'utf8');
  // Fix the require path for CodeIgniter
  controllerContent = controllerContent.replace(
    /require_once.*WebMonitorAPI\.php.*;/,
    `require_once __DIR__ . '/WebMonitorAPI.php';`
  );
  fs.writeFileSync(controllerTarget, controllerContent);
  
  fs.copyFileSync(commonSource, commonTarget);
  
  // Update routes
  const routesPath = path.join(PROJECT_ROOT, 'app', 'Config', 'Routes.php');
  if (fs.existsSync(routesPath)) {
    let routesContent = fs.readFileSync(routesPath, 'utf8');
    if (!routesContent.includes('WebMonitorController')) {
      routesContent += `\n// Web Monitor API Routes\n`;
      routesContent += `$routes->get('api/webmonitor/(:segment)', 'WebMonitorController::handle/$1');\n`;
      fs.writeFileSync(routesPath, routesContent);
      console.log('✅ Updated app/Config/Routes.php');
    } else {
      console.log('⚠️  Routes already configured');
    }
  }
  
  console.log(`✅ Installed WebMonitorController: ${controllerTarget}`);
  console.log(`✅ Installed WebMonitorAPI: ${commonTarget}`);
}

// Install Core PHP
function installCorePHP() {
  console.log('📦 Installing for Core PHP...\n');
  
  // Create api directory
  const apiDir = path.join(PROJECT_ROOT, 'api');
  fs.mkdirSync(apiDir, { recursive: true });
  
  // Copy webmonitor.php
  const webmonitorTarget = path.join(apiDir, 'webmonitor.php');
  const webmonitorSource = path.join(INTEGRATION_DIR, 'core-php', 'webmonitor.php');
  
  // Copy common API class
  const commonTarget = path.join(apiDir, 'WebMonitorAPI.php');
  const commonSource = path.join(INTEGRATION_DIR, 'common', 'WebMonitorAPI.php');
  
  // Copy files
  let webmonitorContent = fs.readFileSync(webmonitorSource, 'utf8');
  // Fix the require path
  webmonitorContent = webmonitorContent.replace(
    /require_once __DIR__ \. '\/\.\.\/common\/WebMonitorAPI\.php';/,
    `require_once __DIR__ . '/WebMonitorAPI.php';`
  );
  fs.writeFileSync(webmonitorTarget, webmonitorContent);
  
  fs.copyFileSync(commonSource, commonTarget);
  
  // Create .htaccess for Apache
  const htaccessPath = path.join(apiDir, '.htaccess');
  if (!fs.existsSync(htaccessPath)) {
    const htaccessContent = `RewriteEngine On
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule ^webmonitor/(.*)$ webmonitor.php?endpoint=$1 [QSA,L]`;
    fs.writeFileSync(htaccessPath, htaccessContent);
    console.log('✅ Created .htaccess for Apache');
  }
  
  console.log(`✅ Installed webmonitor.php: ${webmonitorTarget}`);
  console.log(`✅ Installed WebMonitorAPI.php: ${commonTarget}`);
}

// Main installation
function main() {
  console.log('🚀 Web Monitor PHP Integration - Installation\n');
  console.log(`📁 Project root: ${PROJECT_ROOT}\n`);
  
  // Detect framework
  const framework = detectFramework();
  console.log(`📦 Detected framework: ${framework}\n`);
  
  // Generate API key
  const env = readEnvFile();
  const apiKey = env.WEBMONITOR_API_KEY || generateApiKey();
  
  // Install based on framework
  switch (framework) {
    case 'laravel':
      installLaravel();
      break;
    case 'codeigniter4':
    case 'codeigniter3':
      installCodeIgniter(framework);
      break;
    case 'core-php':
      installCorePHP();
      break;
    default:
      console.error('❌ Could not detect framework. Please install manually.');
      process.exit(1);
  }
  
  // Update .env file
  env.WEBMONITOR_API_KEY = apiKey;
  writeEnvFile(env);
  console.log(`\n✅ Generated API key: ${apiKey.substring(0, 20)}...`);
  console.log(`✅ Updated .env with API key\n`);
  
  // Summary
  console.log('='.repeat(50));
  console.log('✅ Installation Complete!\n');
  console.log('📝 Next Steps:');
  console.log('   1. Restart your PHP server/web server');
  console.log('   2. Test the endpoint:');
  console.log(`      curl http://your-site.com/api/webmonitor/health \\\\`);
  console.log(`        -H "Authorization: Bearer ${apiKey}"`);
  console.log('   3. Add your site to Web Monitor Dashboard:');
  console.log(`      - URL: http://your-site.com`);
  console.log(`      - Platform: ${framework === 'laravel' ? 'Laravel' : framework === 'codeigniter4' || framework === 'codeigniter3' ? 'CodeIgniter' : 'PHP'}`);
  console.log(`      - API Key: ${apiKey}`);
  console.log('\n' + '='.repeat(50));
}

main();

