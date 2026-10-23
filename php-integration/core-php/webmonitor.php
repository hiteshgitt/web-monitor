<?php
/**
 * Web Monitor API - Core PHP Implementation
 * 
 * Installation:
 * 1. Copy this file to: your-project/api/webmonitor.php
 * 2. Set WEBMONITOR_API_KEY in .env or $_ENV
 * 3. Configure your web server to route /api/webmonitor/* to this file
 * 
 * For Apache (.htaccess):
 * RewriteEngine On
 * RewriteCond %{REQUEST_FILENAME} !-f
 * RewriteCond %{REQUEST_FILENAME} !-d
 * RewriteRule ^api/webmonitor/(.*)$ api/webmonitor.php?endpoint=$1 [QSA,L]
 * 
 * For Nginx:
 * location /api/webmonitor/ {
 *     try_files $uri $uri/ /api/webmonitor.php?endpoint=$uri;
 * }
 */

// WebMonitorAPI.php ships next to this file (e.g. both in your-site/api/)
require_once __DIR__ . '/WebMonitorAPI.php';

// Load WEBMONITOR_API_KEY from a .env file in this folder or the site root (the folder above)
foreach ([__DIR__ . '/.env', __DIR__ . '/../.env'] as $envFile) {
    if (!file_exists($envFile)) continue;
    $lines = file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    foreach ($lines as $line) {
        if (strpos(trim($line), '#') === 0 || strpos($line, '=') === false) continue;
        list($key, $value) = explode('=', $line, 2);
        $_ENV[trim($key)] = trim($value);
    }
    break;
}

$api = new WebMonitorAPI();
$api->handleCORS();

// Validate API key
if (!$api->validateApiKey()) {
    $api->sendError('Invalid API key. Please check your authorization header.', 401);
}

// Get endpoint from URL
$requestUri = $_SERVER['REQUEST_URI'] ?? '';
$pathParts = explode('/', trim(parse_url($requestUri, PHP_URL_PATH), '/'));
$endpoint = end($pathParts);

// If endpoint not in path, check query parameter
if (empty($endpoint) || $endpoint === 'webmonitor.php') {
    $endpoint = $_GET['endpoint'] ?? 'health';
}

// Route to appropriate endpoint
switch ($endpoint) {
    case 'health':
        $api->sendJson($api->getHealth());
        break;
        
    case 'analytics':
        $api->sendJson($api->getAnalytics());
        break;
        
    case 'performance':
        $api->sendJson($api->getPerformance());
        break;
        
    case 'seo':
        $api->sendJson($api->getSEO());
        break;
        
    case 'security':
        $api->sendJson($api->getSecurity());
        break;
        
    case 'packages':
        $api->sendJson($api->getPackages());
        break;
        
    default:
        $api->sendError('Endpoint not found. Available: health, analytics, performance, seo, security, packages', 404);
}

