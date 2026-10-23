<?php

/**
 * Web Monitor API Controller for CodeIgniter 4
 * 
 * Installation:
 * 1. Copy this file to: app/Controllers/WebMonitorController.php
 * 2. Add route in app/Config/Routes.php:
 *    $routes->get('api/webmonitor/(:segment)', 'WebMonitorController::handle/$1');
 * 3. Set WEBMONITOR_API_KEY in .env
 */

namespace App\Controllers;

use CodeIgniter\RESTful\ResourceController;

class WebMonitorController extends ResourceController
{
    private $api;
    
    public function __construct()
    {
        // WebMonitorAPI.php ships next to this controller (app/Controllers/)
        require_once __DIR__ . '/WebMonitorAPI.php';
        
        $this->api = new \WebMonitorAPI();
    }
    
    /**
     * Handle all Web Monitor API requests
     */
    public function handle($endpoint = 'health')
    {
        // Handle CORS preflight
        $this->api->handleCORS();
        
        // Validate API key
        if (!$this->api->validateApiKey()) {
            return $this->respond([
                'error' => 'Invalid API key. Please check your authorization header.'
            ], 401);
        }
        
        // Route to appropriate endpoint
        $data = match($endpoint) {
            'health' => $this->api->getHealth(),
            'analytics' => $this->api->getAnalytics(),
            'performance' => $this->api->getPerformance(),
            'seo' => $this->api->getSEO(),
            'security' => $this->api->getSecurity(),
            'packages' => $this->getComposerPackages(),
            'logs' => $this->api->getLogs(),
            'recommendations' => $this->api->getRecommendations(),
            default => null
        };
        
        if ($data === null) {
            return $this->respond([
                'error' => 'Endpoint not found. Available: health, analytics, performance, seo, security, packages, logs, recommendations'
            ], 404);
        }
        
        return $this->respond($data);
    }
    
    /**
     * Get Composer packages (CodeIgniter-specific)
     */
    private function getComposerPackages(): array
    {
        $composerPath = ROOTPATH . 'composer.json';
        
        if (!file_exists($composerPath)) {
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
                'codeigniter_version' => \CodeIgniter\CodeIgniter::CI_VERSION,
                'composer_path' => $composerPath,
                'timestamp' => date('c')
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
            'Framework' => ['codeigniter', 'symfony'],
            'Database' => ['doctrine'],
            'Authentication' => ['tymon/jwt-auth'],
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

