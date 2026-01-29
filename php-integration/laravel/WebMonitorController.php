<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\File;

/**
 * Web Monitor API Controller for Laravel
 * 
 * Installation:
 * 1. Copy this file to: app/Http/Controllers/WebMonitorController.php
 * 2. Add route in routes/api.php:
 *    Route::prefix('webmonitor')->group(function () {
 *        Route::get('/{endpoint}', [WebMonitorController::class, 'handle']);
 *    });
 * 3. Set WEBMONITOR_API_KEY in .env
 */

class WebMonitorController extends Controller
{
    private $api;
    
    public function __construct()
    {
        // Load the common PHP API class
        require_once base_path('vendor/../SAP Analytics/php-integration/common/WebMonitorAPI.php');
        // Or if placed in app/Http/Controllers:
        // require_once __DIR__ . '/../../../../php-integration/common/WebMonitorAPI.php';
        
        $this->api = new \WebMonitorAPI();
    }
    
    /**
     * Handle all Web Monitor API requests
     */
    public function handle(Request $request, string $endpoint): JsonResponse
    {
        // Handle CORS preflight
        $this->api->handleCORS();
        
        // Validate API key
        if (!$this->api->validateApiKey()) {
            return response()->json([
                'error' => 'Invalid API key. Please check your authorization header.'
            ], 401)->withHeaders([
                'Access-Control-Allow-Origin' => '*',
                'Access-Control-Allow-Methods' => 'GET, OPTIONS',
                'Access-Control-Allow-Headers' => 'Authorization, Content-Type',
            ]);
        }
        
        // Route to appropriate endpoint
        $data = match($endpoint) {
            'health' => $this->api->getHealth(),
            'analytics' => $this->api->getAnalytics(),
            'performance' => $this->api->getPerformance(),
            'seo' => $this->api->getSEO(),
            'security' => $this->api->getSecurity(),
            'packages' => $this->getComposerPackages(),
            default => null
        };
        
        if ($data === null) {
            return response()->json([
                'error' => 'Endpoint not found. Available: health, analytics, performance, seo, security, packages'
            ], 404)->withHeaders([
                'Access-Control-Allow-Origin' => '*',
                'Access-Control-Allow-Methods' => 'GET, OPTIONS',
                'Access-Control-Allow-Headers' => 'Authorization, Content-Type',
            ]);
        }
        
        return response()->json($data)->withHeaders([
            'Content-Type' => 'application/json',
            'Cache-Control' => 'no-store, no-cache, must-revalidate',
            'Access-Control-Allow-Origin' => '*',
            'Access-Control-Allow-Methods' => 'GET, OPTIONS',
            'Access-Control-Allow-Headers' => 'Authorization, Content-Type',
        ]);
    }
    
    /**
     * Get Composer packages (Laravel-specific)
     */
    private function getComposerPackages(): array
    {
        $composerPath = base_path('composer.json');
        
        if (!File::exists($composerPath)) {
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
            $composerJson = json_decode(File::get($composerPath), true);
            $require = $composerJson['require'] ?? [];
            $requireDev = $composerJson['require-dev'] ?? [];
            
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
                        'outdated' => false
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
                'outdated_count' => 0,
                'php_version' => PHP_VERSION,
                'laravel_version' => app()->version(),
                'composer_path' => $composerPath,
                'timestamp' => now()->toIso8601String()
            ];
        } catch (\Exception $e) {
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
     * Categorize packages
     */
    private function getPackageCategory(string $name): string
    {
        $categories = [
            'Framework' => ['laravel', 'symfony'],
            'Database' => ['doctrine', 'illuminate/database'],
            'Authentication' => ['laravel/passport', 'tymon/jwt-auth'],
            'Testing' => ['phpunit'],
            'Utilities' => ['guzzle', 'monolog'],
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
}

