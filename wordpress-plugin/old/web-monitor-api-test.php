<?php
/**
 * Plugin Name: Web Monitor API (Test)
 * Description: Test API endpoints for Web Monitor Dashboard - No Authentication Required
 * Version: 1.0.0
 * Author: Web Monitor Team
 */

// Prevent direct access
if (!defined('ABSPATH')) {
    exit;
}

// Register REST API routes
add_action('rest_api_init', 'webmonitor_test_register_routes');

function webmonitor_test_register_routes() {
    // Test endpoint without authentication
    register_rest_route('webmonitor-test/v1', '/health', array(
        'methods' => 'GET',
        'callback' => 'webmonitor_test_health_check',
        'permission_callback' => '__return_true'
    ));
    
    register_rest_route('webmonitor-test/v1', '/analytics', array(
        'methods' => 'GET',
        'callback' => 'webmonitor_test_analytics',
        'permission_callback' => '__return_true'
    ));
}

function webmonitor_test_health_check($request) {
    return array(
        'status' => 'healthy',
        'timestamp' => current_time('mysql'),
        'uptime' => 99.9,
        'response_time' => 245,
        'status_code' => 200,
        'message' => 'WordPress site is healthy - Test Plugin Working!',
        'site_url' => home_url(),
        'wordpress_version' => get_bloginfo('version'),
        'plugin_version' => '1.0.0 (Test - No Auth)',
        'authentication' => 'disabled_for_testing'
    );
}

function webmonitor_test_analytics($request) {
    return array(
        'visitors' => rand(1000, 5000),
        'page_views' => rand(5000, 15000),
        'bounce_rate' => rand(30, 60),
        'avg_session_duration' => rand(120, 300),
        'top_pages' => array(
            array('page' => '/', 'views' => rand(1000, 3000)),
            array('page' => '/about', 'views' => rand(500, 1500)),
            array('page' => '/contact', 'views' => rand(300, 1000))
        ),
        'message' => 'Analytics data - Test Plugin Working!'
    );
}
?>
