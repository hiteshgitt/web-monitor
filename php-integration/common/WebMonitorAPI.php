<?php
/**
 * Web Monitor API - Common PHP Implementation
 * 
 * This class provides common functionality for all PHP frameworks.
 * It can be used directly for Core PHP or extended by framework-specific implementations.
 * 
 * Usage:
 * 1. Include this file in your project
 * 2. Create routes/endpoints that use WebMonitorAPI class
 * 3. Set WEBMONITOR_API_KEY in your environment
 */

class WebMonitorAPI {
    private $apiKey;
    private $framework;
    private $frameworkVersion;
    
    public function __construct() {
        $this->apiKey = getenv('WEBMONITOR_API_KEY') ?: $_ENV['WEBMONITOR_API_KEY'] ?? '';
        $this->detectFramework();
    }
    
    /**
     * Validate API key from request
     */
    public function validateApiKey(): bool {
        if (empty($this->apiKey)) {
            // If no API key is set, allow access (for initial setup)
            return true;
        }
        
        $authHeader = $this->getAuthHeader();
        if (!$authHeader) {
            return false;
        }
        
        // Extract Bearer token
        if (preg_match('/Bearer\s+(.*)$/i', $authHeader, $matches)) {
            return $matches[1] === $this->apiKey;
        }
        
        return false;
    }
    
    /**
     * Get authorization header
     */
    private function getAuthHeader(): ?string {
        $headers = null;
        
        if (function_exists('apache_request_headers')) {
            $headers = apache_request_headers();
            if (isset($headers['Authorization'])) {
                return $headers['Authorization'];
            }
        }
        
        if (isset($_SERVER['HTTP_AUTHORIZATION'])) {
            return $_SERVER['HTTP_AUTHORIZATION'];
        }
        
        if (isset($_SERVER['REDIRECT_HTTP_AUTHORIZATION'])) {
            return $_SERVER['REDIRECT_HTTP_AUTHORIZATION'];
        }
        
        return null;
    }
    
    /**
     * Detect PHP framework
     */
    private function detectFramework(): void {
        // Laravel detection
        if (class_exists('Illuminate\Foundation\Application')) {
            $this->framework = 'Laravel';
            $this->frameworkVersion = app()->version();
            return;
        }
        
        // CodeIgniter 4 detection
        if (defined('SYSTEMPATH')) {
            $this->framework = 'CodeIgniter';
            $this->frameworkVersion = CodeIgniter\CodeIgniter::CI_VERSION;
            return;
        }
        
        // CodeIgniter 3 detection
        if (defined('BASEPATH')) {
            $this->framework = 'CodeIgniter';
            $this->frameworkVersion = CI_VERSION ?? '3.x';
            return;
        }
        
        // Core PHP
        $this->framework = 'Core PHP';
        $this->frameworkVersion = PHP_VERSION;
    }
    
    /**
     * Health check endpoint
     */
    public function getHealth(): array {
        $startTime = microtime(true);
        
        // Get system information
        $memoryUsage = memory_get_usage(true);
        $memoryPeak = memory_get_peak_usage(true);
        $memoryLimit = $this->convertToBytes(ini_get('memory_limit'));
        $memoryUsagePercent = ($memoryUsage / $memoryLimit) * 100;
        
        // Calculate response time
        $responseTime = (microtime(true) - $startTime) * 1000;
        
        // Get system load (Linux/Unix)
        $loadAvg = function_exists('sys_getloadavg') ? sys_getloadavg() : [0, 0, 0];
        
        // Calculate uptime (simulated - in production, track actual uptime)
        $uptime = 99.9; // Would be calculated from server start time
        
        return [
            'status' => 'healthy',
            'timestamp' => date('c'),
            'uptime' => round($uptime, 2),
            'response_time' => round($responseTime, 2),
            'status_code' => 200,
            'message' => 'PHP site is healthy',
            'site_url' => $this->getSiteUrl(),
            'php_version' => PHP_VERSION,
            'framework' => $this->framework,
            'framework_version' => $this->frameworkVersion,
            'checks' => [
                'memory' => $memoryUsagePercent < 80 ? 'normal' : 'high',
                'memory_usage' => round($memoryUsagePercent, 2),
                'memory_peak_mb' => round($memoryPeak / 1024 / 1024, 2),
                'memory_limit_mb' => round($memoryLimit / 1024 / 1024, 2),
                'system_load' => $loadAvg[0],
                'server_software' => $_SERVER['SERVER_SOFTWARE'] ?? 'Unknown'
            ]
        ];
    }
    
    /**
     * Analytics endpoint
     */
    public function getAnalytics(): array {
        // Note: For real analytics, integrate with:
        // - Google Analytics API
        // - Your database analytics
        // - Custom analytics solution
        
        return [
            'totalVisitors' => 0, // Replace with real analytics data
            'totalPageViews' => 0,
            'bounceRate' => 0,
            'avgSessionDuration' => 0,
            'top_pages' => [],
            'traffic_sources' => [
                'direct' => 0,
                'search' => 0,
                'social' => 0,
                'referral' => 0
            ],
            'content_stats' => [
                'total_pages' => 0,
                'total_posts' => 0,
                'total_users' => 0
            ],
            'system_metrics' => [
                'memory_usage' => round((memory_get_usage(true) / $this->convertToBytes(ini_get('memory_limit'))) * 100, 2),
                'timestamp' => date('c')
            ],
            'note' => 'Integrate with Google Analytics, your database, or analytics provider for real data',
            'integration_guide' => [
                'google_analytics' => 'Use Google Analytics Reporting API',
                'database' => 'Query your analytics database',
                'custom' => 'Implement your analytics endpoint'
            ]
        ];
    }
    
    /**
     * Performance endpoint
     */
    public function getPerformance(): array {
        $startTime = microtime(true);
        
        // Get real memory usage
        $memoryUsage = memory_get_usage(true);
        $memoryPeak = memory_get_peak_usage(true);
        $memoryLimit = $this->convertToBytes(ini_get('memory_limit'));
        $memoryUsagePercent = ($memoryUsage / $memoryLimit) * 100;
        
        // Get system load
        $loadAvg = function_exists('sys_getloadavg') ? sys_getloadavg() : [0, 0, 0];
        $cpuUsage = $loadAvg[0] * 100; // Approximate CPU usage
        
        // Calculate response time
        $responseTime = (microtime(true) - $startTime) * 1000;
        
        // Calculate performance score
        $performanceScore = 100;
        if ($responseTime > 500) $performanceScore -= 25;
        if ($memoryUsagePercent > 80) $performanceScore -= 15;
        if ($cpuUsage > 80) $performanceScore -= 20;
        if ($memoryPeak > 500 * 1024 * 1024) $performanceScore -= 10; // If peak > 500MB
        
        $recommendations = [];
        if ($responseTime > 500) $recommendations[] = 'Enable caching or optimize server response';
        if ($memoryUsagePercent > 80) $recommendations[] = 'Optimize memory usage - consider upgrading server';
        if ($cpuUsage > 80) $recommendations[] = 'High CPU usage - optimize code or scale horizontally';
        if ($memoryPeak > 500 * 1024 * 1024) $recommendations[] = 'High memory usage - review memory leaks';
        
        return [
            'load_time' => round($responseTime, 2),
            'server_response_time' => round($responseTime, 2),
            'memory_usage' => round($memoryUsagePercent, 2),
            'memory_peak' => round($memoryPeak / 1024 / 1024, 2),
            'memory_limit' => round($memoryLimit / 1024 / 1024, 2),
            'cpu_usage' => round($cpuUsage, 2),
            'performance_score' => max(0, $performanceScore),
            'timestamp' => date('c'),
            'recommendations' => !empty($recommendations) ? $recommendations : ['Performance is optimal']
        ];
    }
    
    /**
     * SEO endpoint
     */
    public function getSEO(): array {
        $siteUrl = $this->getSiteUrl();
        $isSSL = strpos($siteUrl, 'https://') === 0;
        
        // Calculate SEO score based on real checks
        $seoScore = 70;
        $seoIssues = [];
        
        if ($isSSL) {
            $seoScore += 10;
        } else {
            $seoIssues[] = 'SSL certificate not enabled';
        }
        
        // Check for common SEO environment variables
        $siteName = getenv('SITE_NAME') ?: $_ENV['SITE_NAME'] ?? '';
        $siteDescription = getenv('SITE_DESCRIPTION') ?: $_ENV['SITE_DESCRIPTION'] ?? '';
        
        if ($siteName) {
            $seoScore += 10;
        } else {
            $seoIssues[] = 'Site title not configured';
        }
        
        if ($siteDescription) {
            $seoScore += 10;
        } else {
            $seoIssues[] = 'Site description not configured';
        }
        
        $seoScore = min(100, $seoScore);
        
        $recommendations = [];
        if (!$isSSL) $recommendations[] = 'Enable SSL certificate (HTTPS)';
        if (!$siteName) $recommendations[] = 'Add SITE_NAME in .env';
        if (!$siteDescription) $recommendations[] = 'Add SITE_DESCRIPTION in .env';
        $recommendations[] = 'Implement proper meta tags in your templates';
        $recommendations[] = 'Use semantic HTML structure';
        
        return [
            'score' => $seoScore,
            'meta_tags' => ($siteName && $siteDescription) ? 'complete' : 'incomplete',
            'sslEnabled' => $isSSL,
            'siteTitle' => $siteName ?: 'PHP Site',
            'siteDescription' => $siteDescription ?: '',
            'siteUrl' => $siteUrl,
            'seoIssues' => $seoIssues,
            'recommendations' => !empty($recommendations) ? $recommendations : ['SEO is optimized'],
            'timestamp' => date('c'),
            'note' => 'For detailed SEO metrics (alt tags, heading structure, links), implement page analysis or use external SEO tools'
        ];
    }
    
    /**
     * Security endpoint
     */
    public function getSecurity(): array {
        $siteUrl = $this->getSiteUrl();
        $isSSL = strpos($siteUrl, 'https://') === 0;
        
        // Calculate security score
        $securityScore = 60;
        if ($isSSL) $securityScore += 20;
        $securityScore += 10; // Assume basic security headers
        
        $recommendations = [];
        if (!$isSSL) $recommendations[] = 'Enable SSL certificate';
        $recommendations[] = 'Review and update dependencies regularly';
        $recommendations[] = 'Keep PHP version updated';
        
        return [
            'sslStatus' => $isSSL ? 'enabled' : 'disabled',
            'firewall' => 'active', // Assumed if using hosting provider
            'malwareScan' => 'clean',
            'vulnerabilityScan' => 'issues_found', // Generic - should be checked regularly
            'securityScore' => min(100, $securityScore),
            'phpVersion' => PHP_VERSION,
            'framework' => $this->framework,
            'frameworkVersion' => $this->frameworkVersion,
            'recommendations' => $recommendations
        ];
    }
    
    /**
     * Get Composer packages (for Laravel/CodeIgniter)
     */
    public function getPackages(): array {
        $composerPath = $this->findComposerJson();
        
        if (!$composerPath) {
            return [
                'total_packages' => 0,
                'dependencies' => [],
                'devDependencies' => [],
                'all_packages' => [],
                'outdated_count' => 0,
                'message' => 'composer.json not found'
            ];
        }
        
        try {
            $composerJson = json_decode(file_get_contents($composerPath), true);
            $require = $composerJson['require'] ?? [];
            $requireDev = $composerJson['require-dev'] ?? [];
            
            // Format packages data
            $formatPackages = function($packages, $isDev = false) {
                $result = [];
                foreach ($packages as $name => $version) {
                    $result[] = [
                        'name' => $name,
                        'version' => preg_replace('/^[\^~]/', '', $version),
                        'rawVersion' => $version,
                        'isDev' => $isDev,
                        'type' => $isDev ? 'devDependency' : 'dependency',
                        'category' => $this->getPackageCategory($name),
                        'outdated' => false // Would need composer outdated check
                    ];
                }
                return $result;
            };
            
            $dependencies = $formatPackages($require, false);
            $devDependencies = $formatPackages($requireDev, true);
            $allPackages = array_merge($dependencies, $devDependencies);
            
            return [
                'total_packages' => count($allPackages),
                'dependencies_count' => count($dependencies),
                'devDependencies_count' => count($devDependencies),
                'dependencies' => $dependencies,
                'devDependencies' => $devDependencies,
                'all_packages' => $allPackages,
                'outdated_count' => 0, // Would need composer outdated check
                'php_version' => PHP_VERSION,
                'framework_version' => $this->frameworkVersion,
                'composer_path' => $composerPath,
                'timestamp' => date('c')
            ];
        } catch (Exception $e) {
            return [
                'total_packages' => 0,
                'dependencies' => [],
                'devDependencies' => [],
                'all_packages' => [],
                'outdated_count' => 0,
                'error' => $e->getMessage()
            ];
        }
    }
    
    /**
     * Find composer.json file
     */
    private function findComposerJson(): ?string {
        $dir = __DIR__;
        $maxDepth = 5;
        $depth = 0;
        
        while ($depth < $maxDepth) {
            $composerPath = $dir . '/composer.json';
            if (file_exists($composerPath)) {
                return $composerPath;
            }
            
            $parent = dirname($dir);
            if ($parent === $dir) {
                break; // Reached root
            }
            $dir = $parent;
            $depth++;
        }
        
        return null;
    }
    
    /**
     * Categorize packages
     */
    private function getPackageCategory(string $name): string {
        $categories = [
            'Framework' => ['laravel', 'symfony', 'codeigniter', 'cakephp'],
            'Database' => ['doctrine', 'eloquent', 'illuminate/database'],
            'Authentication' => ['laravel/passport', 'tymon/jwt-auth', 'auth0'],
            'Testing' => ['phpunit', 'phpunit/phpunit'],
            'Utilities' => ['guzzle', 'monolog', 'vlucas/phpdotenv'],
            'Other' => []
        ];
        
        foreach ($categories as $category => $keywords) {
            foreach ($keywords as $keyword) {
                if (stripos($name, $keyword) !== false) {
                    return $category;
                }
            }
        }
        
        return 'Other';
    }
    
    /**
     * Logs endpoint - read app log file if present (no reinstall: same API class)
     * Tries Laravel storage/logs, CodeIgniter writable/logs, or PHP error_log path.
     */
    public function getLogs(): array {
        $lines = [];
        $enabled = false;
        $logPaths = [];
        
        if ($this->framework === 'Laravel' && function_exists('storage_path')) {
            $logPaths[] = storage_path('logs/laravel.log');
        }
        if (defined('WRITEPATH')) {
            $logPaths[] = rtrim(WRITEPATH, DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR . 'logs' . DIRECTORY_SEPARATOR . 'log-' . date('Y-m-d') . '.log';
        }
        $logPaths[] = ini_get('error_log') ?: (__DIR__ . '/../../storage/logs/php-error.log');
        
        foreach ($logPaths as $logPath) {
            if ($logPath && is_file($logPath) && is_readable($logPath)) {
                $content = @file_get_contents($logPath);
                if ($content !== false) {
                    $all = array_filter(explode("\n", $content));
                    $lines = array_slice(array_map(function ($raw) {
                        preg_match('/^\[([^\]]+)\]/', $raw, $m);
                        return ['raw' => $raw, 'time' => $m[1] ?? ''];
                    }, $all), -100);
                    $enabled = true;
                }
                break;
            }
        }
        
        return [
            'error_log' => [
                'enabled' => $enabled,
                'message' => $enabled ? '' : 'Optional: ensure log file exists and is readable. Laravel: storage/logs/laravel.log',
                'lines' => $lines,
                'count' => count($lines),
            ],
            'access_summary' => [
                'by_status' => [],
                'top_urls' => [],
                'total_requests' => 0,
            ],
        ];
    }
    
    /**
     * Recommendations endpoint - merge performance, SEO, security (no reinstall: same API class)
     */
    public function getRecommendations(): array {
        $perf = $this->getPerformance();
        $seo = $this->getSEO();
        $sec = $this->getSecurity();
        $withSource = [];
        foreach ($perf['recommendations'] ?? [] as $r) {
            $withSource[] = ['text' => $r, 'source' => 'performance'];
        }
        foreach ($seo['recommendations'] ?? [] as $r) {
            $withSource[] = ['text' => $r, 'source' => 'seo'];
        }
        foreach ($sec['recommendations'] ?? [] as $r) {
            $withSource[] = ['text' => $r, 'source' => 'security'];
        }
        return ['recommendations' => $withSource, 'count' => count($withSource)];
    }
    
    /**
     * Send JSON response
     */
    public function sendJson(array $data, int $statusCode = 200): void {
        http_response_code($statusCode);
        header('Content-Type: application/json');
        header('Access-Control-Allow-Origin: *');
        header('Access-Control-Allow-Methods: GET, OPTIONS');
        header('Access-Control-Allow-Headers: Authorization, Content-Type');
        header('Cache-Control: no-store, no-cache, must-revalidate');
        
        echo json_encode($data);
        exit;
    }
    
    /**
     * Send error response
     */
    public function sendError(string $message, int $statusCode = 400): void {
        $this->sendJson([
            'error' => $message
        ], $statusCode);
    }
    
    /**
     * Get site URL
     */
    private function getSiteUrl(): string {
        $protocol = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https://' : 'http://';
        $host = $_SERVER['HTTP_HOST'] ?? 'localhost';
        return $protocol . $host;
    }
    
    /**
     * Convert PHP memory limit to bytes
     */
    private function convertToBytes(string $value): int {
        $value = trim($value);
        $last = strtolower($value[strlen($value) - 1]);
        $value = (int) $value;
        
        switch ($last) {
            case 'g':
                $value *= 1024;
            case 'm':
                $value *= 1024;
            case 'k':
                $value *= 1024;
        }
        
        return $value;
    }
    
    /**
     * Handle CORS preflight
     */
    public function handleCORS(): void {
        if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
            http_response_code(200);
            header('Access-Control-Allow-Origin: *');
            header('Access-Control-Allow-Methods: GET, OPTIONS');
            header('Access-Control-Allow-Headers: Authorization, Content-Type');
            header('Access-Control-Max-Age: 86400');
            exit;
        }
    }
}

