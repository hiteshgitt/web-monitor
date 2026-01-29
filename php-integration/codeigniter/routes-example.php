<?php
/**
 * CodeIgniter 4 Routes Example
 * 
 * Add this to your app/Config/Routes.php file:
 */

$routes->get('api/webmonitor/(:segment)', 'WebMonitorController::handle/$1');

// Or with specific endpoints:
// $routes->get('api/webmonitor/health', 'WebMonitorController::handle/health');
// $routes->get('api/webmonitor/analytics', 'WebMonitorController::handle/analytics');
// $routes->get('api/webmonitor/performance', 'WebMonitorController::handle/performance');
// $routes->get('api/webmonitor/seo', 'WebMonitorController::handle/seo');
// $routes->get('api/webmonitor/security', 'WebMonitorController::handle/security');
// $routes->get('api/webmonitor/packages', 'WebMonitorController::handle/packages');

