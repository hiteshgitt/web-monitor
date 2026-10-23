<?php
/**
 * Web Monitor endpoint for plain PHP sites (no framework).
 *
 * Install: put this file and WebMonitorCore.php in your-site/api/, put your key in
 * webmonitor-config.php (or the WEBMONITOR_API_KEY server environment variable),
 * and route /api/webmonitor/* here — see README.txt in the download.
 */

require_once __DIR__ . '/WebMonitorCore.php';

// Settings come from webmonitor-config.php next to this file (a PHP file, so the web server runs it
// instead of serving it — the key can't be downloaded), or from server environment variables.
$config = is_file(__DIR__ . '/webmonitor-config.php') ? (array) require __DIR__ . '/webmonitor-config.php' : [];
$apiKey = (string) ($config['api_key'] ?? getenv('WEBMONITOR_API_KEY') ?: '');
$siteUrl = ($config['site_url'] ?? getenv('WEBMONITOR_SITE_URL')) ?: null;

$endpoint = $_GET['endpoint'] ?? basename(parse_url($_SERVER['REQUEST_URI'] ?? '', PHP_URL_PATH) ?: 'health');
$authorization = $_SERVER['HTTP_AUTHORIZATION']
    ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION']
    ?? (function_exists('apache_request_headers') ? (apache_request_headers()['Authorization'] ?? null) : null);

$core = new Ruyalab\WebMonitor\WebMonitorCore([
    'apiKey' => $apiKey,
    'framework' => 'Core PHP',
    'frameworkVersion' => PHP_VERSION,
    'basePath' => dirname(__DIR__),
    'debug' => null,
    'siteUrl' => $siteUrl,
    'logPaths' => array_filter([ini_get('error_log') ?: null]),
]);

[$status, $data] = $core->handle($endpoint === 'plugins' ? 'packages' : $endpoint, $authorization);

http_response_code($status);
header('Content-Type: application/json');
header('Cache-Control: no-store');
echo json_encode($data);
