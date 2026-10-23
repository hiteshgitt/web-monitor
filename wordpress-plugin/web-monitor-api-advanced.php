<?php
/**
 * Plugin Name: Web Monitor API (Advanced)
 * Description: Advanced REST API endpoints for the Web Monitor Dashboard. Exposes real, dynamic WordPress health, analytics, performance, SEO and security data (no simulated/random values).
 * Version: 1.1.0
 * Author: Web Monitor Team
 * Requires at least: 5.6
 * Tested up to: 7.0
 * Requires PHP: 7.0
 * License: MIT
 * Text Domain: web-monitor-api
 */

// Prevent direct access
if (!defined('ABSPATH')) {
    exit;
}

// Plugin settings page
add_action('admin_menu', 'webmonitor_advanced_admin_menu');
add_action('admin_init', 'webmonitor_advanced_settings_init');

// Register REST API routes
add_action('rest_api_init', 'webmonitor_advanced_register_routes');

// Auto-generate API key on plugin activation
register_activation_hook(__FILE__, 'webmonitor_advanced_activate');

function webmonitor_advanced_activate() {
    // Check if API key already exists
    $api_key = get_option('webmonitor_api_key');
    
    // If no API key exists, generate one
    if (empty($api_key)) {
        $api_key = wp_generate_password(32, false);
        update_option('webmonitor_api_key', $api_key);
    }
}

// Add admin menu
function webmonitor_advanced_admin_menu() {
    add_options_page(
        'Web Monitor API Settings',
        'Web Monitor API',
        'manage_options',
        'webmonitor-advanced',
        'webmonitor_advanced_settings_page'
    );
}

// AJAX handler for generating new API key
add_action('wp_ajax_webmonitor_generate_new_key', 'webmonitor_generate_new_api_key');
add_action('wp_ajax_webmonitor_generate_new_key', 'webmonitor_generate_new_api_key');

function webmonitor_generate_new_api_key() {
    check_ajax_referer('webmonitor_generate_key', 'nonce');
    
    if (!current_user_can('manage_options')) {
        wp_send_json_error('You do not have permission to perform this action.');
        return;
    }
    
    // Generate a new secure API key
    $new_key = wp_generate_password(32, false);
    update_option('webmonitor_api_key', $new_key);
    
    wp_send_json_success(array(
        'message' => 'New API key generated successfully.',
        'new_key' => $new_key
    ));
}

// Initialize settings
function webmonitor_advanced_settings_init() {
    register_setting('webmonitor_advanced_settings', 'webmonitor_app_url');
    
    add_settings_section(
        'webmonitor_advanced_main_section',
        'API Configuration',
        'webmonitor_advanced_settings_section_callback',
        'webmonitor-advanced'
    );
    
    // Add API key field (display-only, not registered as setting)
    add_settings_field(
        'webmonitor_api_key_display',
        'API Key',
        'webmonitor_advanced_api_key_callback',
        'webmonitor-advanced',
        'webmonitor_advanced_main_section'
    );
    
    add_settings_field(
        'webmonitor_app_url',
        'Web Monitor Dashboard URL',
        'webmonitor_advanced_app_url_callback',
        'webmonitor-advanced',
        'webmonitor_advanced_main_section'
    );
}

// Settings page callback
function webmonitor_advanced_settings_page() {
    ?>
    <div class="wrap">
        <h1>Web Monitor API Settings</h1>
        <form method="post" action="options.php">
            <?php
            settings_fields('webmonitor_advanced_settings');
            do_settings_sections('webmonitor-advanced');
            submit_button();
            ?>
        </form>
        <div class="notice notice-info">
            <h3>How to Connect Your WordPress Site to Web Monitor Dashboard</h3>
            <ol>
                <li>Copy the API Key shown above</li>
                <li>Go to your Web Monitor Dashboard</li>
                <li>Click "Add New Website"</li>
                <li>Enter your WordPress site URL</li>
                <li>Paste the API Key</li>
                <li>Click Save</li>
            </ol>
            <p><strong>Note:</strong> Keep this API key secure. Anyone with this key can access your site's data.</p>
        </div>
    </div>
    <?php
}

function webmonitor_advanced_settings_section_callback() {
    echo '<p>Configure your Web Monitor API settings below. After saving, copy the API key and use it in your Web Monitor Dashboard.</p>';
}

function webmonitor_advanced_api_key_callback() {
    $api_key = get_option('webmonitor_api_key');
    
    // Generate a new key if it doesn't exist
    if (empty($api_key)) {
        $api_key = wp_generate_password(32, false);
        update_option('webmonitor_api_key', $api_key);
    }
    
    // Show the API key in a read-only display
    echo '<div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin-bottom: 20px; border: 2px solid #2271b1;">';
    echo '<strong style="font-size: 14px; color: #2271b1;">Current API Key:</strong>';
    echo '<div style="margin: 10px 0; padding: 15px; background: white; border: 2px solid #2271b1; border-radius: 5px; font-family: monospace; font-size: 13px; word-break: break-all; color: #1d2327; font-weight: bold; cursor: pointer;" onclick="this.select(); document.execCommand(\'copy\'); alert(\'API key copied to clipboard!\')" title="Click to copy">' . esc_html($api_key) . '</div>';
    echo '<p style="margin: 10px 0 0 0; padding: 10px; background: #fff3cd; border-radius: 4px; border-left: 4px solid #f0ad4e; color: #856404;"><strong>⚠️ Important:</strong> Copy this key now. Click on the key above to copy it. This key is used to connect your WordPress site to the Web Monitor Dashboard.</p>';
    echo '</div>';
    
    // Add button to generate new key
    echo '<button type="button" id="generate_new_key" class="button button-secondary" style="margin-top: 10px; padding: 8px 15px; font-size: 13px;">Generate New API Key</button>';
    echo '<p class="description" style="margin-top: 10px; padding: 10px; background: #f8d7da; border-radius: 4px; border-left: 4px solid #dc3545; color: #721c24;"><strong>⚠️ Warning:</strong> Generating a new key will invalidate the old one. Make sure to update it in your Web Monitor Dashboard.</p>';
    
    // JavaScript to handle key generation
    echo '<script>
    jQuery(document).ready(function($) {
        $("#generate_new_key").on("click", function() {
            if (confirm("Are you sure you want to generate a new API key? This will invalidate the current key. Make sure to update it in your Web Monitor Dashboard.")) {
                $.post(ajaxurl, {
                    action: "webmonitor_generate_new_key",
                    nonce: "' . wp_create_nonce('webmonitor_generate_key') . '"
                }, function(response) {
                    if (response.success) {
                        alert("New API key generated successfully! Please copy it now and update it in your Web Monitor Dashboard.");
                        location.reload();
                    } else {
                        alert("Error: " + response.data);
                    }
                });
            }
        });
    });
    </script>';
}

function webmonitor_advanced_app_url_callback() {
    $app_url = get_option('webmonitor_app_url', 'http://localhost:5173');
    echo '<input type="url" name="webmonitor_app_url" value="' . esc_attr($app_url) . '" class="regular-text" placeholder="http://localhost:5173" />';
    echo '<p class="description">Enter your Web Monitor Dashboard URL (e.g., http://localhost:5173 or https://your-dashboard.com)</p>';
}

// Helper to robustly extract API key from request/server
function webmonitor_advanced_extract_api_key($request) {
    $api_key = '';

    // 1) WP REST request headers (normalized to lowercase)
    $headers = $request->get_headers();
    if (isset($headers['authorization'])) {
        $auth_header = is_array($headers['authorization']) ? $headers['authorization'][0] : $headers['authorization'];
        if (preg_match('/Bearer\s+(.+)$/i', $auth_header, $m)) {
            $api_key = trim($m[1]);
        }
    }
    if (empty($api_key) && isset($headers['x-api-key'])) {
        $api_key = is_array($headers['x-api-key']) ? trim($headers['x-api-key'][0]) : trim($headers['x-api-key']);
    }

    // 2) getallheaders (some servers strip headers from WP)
    if (empty($api_key) && function_exists('getallheaders')) {
        $all = array_change_key_case(getallheaders(), CASE_LOWER);
        if (isset($all['authorization']) && preg_match('/Bearer\s+(.+)$/i', $all['authorization'], $m2)) {
            $api_key = trim($m2[1]);
        } elseif (isset($all['x-api-key'])) {
            $api_key = trim($all['x-api-key']);
        }
    }

    // 3) $_SERVER fallbacks (Apache/FastCGI)
    if (empty($api_key)) {
        $server_auth = '';
        if (!empty($_SERVER['HTTP_AUTHORIZATION'])) {
            $server_auth = $_SERVER['HTTP_AUTHORIZATION'];
        } elseif (!empty($_SERVER['REDIRECT_HTTP_AUTHORIZATION'])) {
            $server_auth = $_SERVER['REDIRECT_HTTP_AUTHORIZATION'];
        }
        if ($server_auth && preg_match('/Bearer\s+(.+)$/i', $server_auth, $m3)) {
            $api_key = trim($m3[1]);
        }
        if (empty($api_key) && !empty($_SERVER['HTTP_X_API_KEY'])) {
            $api_key = trim($_SERVER['HTTP_X_API_KEY']);
        }
    }

    // 4) Query param fallback for manual tests
    if (empty($api_key)) {
        $api_key = trim($request->get_param('api_key'));
    }

    return $api_key;
}

// API Key verification function — used as the REST permission_callback.
function webmonitor_advanced_verify_api_key($request) {
    $stored_api_key = get_option('webmonitor_api_key');
    // Normalize stored key in case of accidental whitespace
    $stored_api_key = is_string($stored_api_key) ? trim($stored_api_key) : '';

    // If no API key is set, allow access (for initial setup)
    if (empty($stored_api_key)) {
        return true;
    }

    $received_key = webmonitor_advanced_extract_api_key($request);
    $received_key = is_string($received_key) ? trim($received_key) : '';

    if (!empty($received_key) && hash_equals($stored_api_key, $received_key)) {
        return true;
    }

    return new WP_Error(
        'rest_forbidden',
        'Invalid API key. Please copy the key from WordPress Settings → Web Monitor API and try again.',
        array('status' => 401)
    );
}

function webmonitor_advanced_register_routes() {
    // Health endpoint
    register_rest_route('webmonitor-advanced/v1', '/health', array(
        'methods' => 'GET',
        'callback' => 'webmonitor_advanced_health_check',
        'permission_callback' => 'webmonitor_advanced_verify_api_key'
    ));
    
    register_rest_route('webmonitor-advanced/v1', '/analytics', array(
        'methods' => 'GET',
        'callback' => 'webmonitor_advanced_analytics',
        'permission_callback' => 'webmonitor_advanced_verify_api_key'
    ));
    
    register_rest_route('webmonitor-advanced/v1', '/performance', array(
        'methods' => 'GET',
        'callback' => 'webmonitor_advanced_performance',
        'permission_callback' => 'webmonitor_advanced_verify_api_key'
    ));
    
    register_rest_route('webmonitor-advanced/v1', '/seo', array(
        'methods' => 'GET',
        'callback' => 'webmonitor_advanced_seo',
        'permission_callback' => 'webmonitor_advanced_verify_api_key'
    ));
    
    register_rest_route('webmonitor-advanced/v1', '/security', array(
        'methods' => 'GET',
        'callback' => 'webmonitor_advanced_security',
        'permission_callback' => 'webmonitor_advanced_verify_api_key'
    ));
    
    register_rest_route('webmonitor-advanced/v1', '/plugins', array(
        'methods' => 'GET',
        'callback' => 'webmonitor_advanced_plugins',
        'permission_callback' => 'webmonitor_advanced_verify_api_key'
    ));
    
    register_rest_route('webmonitor-advanced/v1', '/alerts', array(
        'methods' => 'GET',
        'callback' => 'webmonitor_advanced_alerts',
        'permission_callback' => 'webmonitor_advanced_verify_api_key'
    ));
    
    register_rest_route('webmonitor-advanced/v1', '/logs', array(
        'methods' => 'GET',
        'callback' => 'webmonitor_advanced_logs',
        'permission_callback' => 'webmonitor_advanced_verify_api_key'
    ));
    
    register_rest_route('webmonitor-advanced/v1', '/recommendations', array(
        'methods' => 'GET',
        'callback' => 'webmonitor_advanced_recommendations',
        'permission_callback' => 'webmonitor_advanced_verify_api_key'
    ));
}

// Log each API request for access summary (no SSH/cPanel needed)
add_action('init', 'webmonitor_advanced_maybe_log_request', 1);
function webmonitor_advanced_maybe_log_request() {
    // Only log requests to our API (avoid logging every page view)
    if (strpos($_SERVER['REQUEST_URI'], 'webmonitor-advanced') === false) {
        return;
    }
    $log = get_option('webmonitor_request_log', array());
    if (!is_array($log)) $log = array();
    $entry = array(
        'time' => current_time('mysql'),
        'url' => isset($_SERVER['REQUEST_URI']) ? sanitize_text_field($_SERVER['REQUEST_URI']) : '',
        'method' => isset($_SERVER['REQUEST_METHOD']) ? sanitize_text_field($_SERVER['REQUEST_METHOD']) : 'GET',
        'ip' => isset($_SERVER['REMOTE_ADDR']) ? sanitize_text_field($_SERVER['REMOTE_ADDR']) : '',
        'status' => 200
    );
    array_unshift($log, $entry);
    $log = array_slice($log, 0, 200);
    update_option('webmonitor_request_log', $log, false);
}

function webmonitor_advanced_logs($request) {
    webmonitor_advanced_verify_api_key($request);
    
    $error_log_lines = array();
    // Consider enabled if WP_DEBUG + WP_DEBUG_LOG are on, or if debug.log exists and is readable
    $debug_log_on = defined('WP_DEBUG') && WP_DEBUG && defined('WP_DEBUG_LOG') && WP_DEBUG_LOG;
    $log_file = defined('WP_DEBUG_LOG') && WP_DEBUG_LOG && is_string(WP_DEBUG_LOG)
        ? WP_DEBUG_LOG
        : (defined('WP_CONTENT_DIR') ? WP_CONTENT_DIR . '/debug.log' : dirname(__FILE__, 2) . '/debug.log');
    $log_file_exists = file_exists($log_file) && is_readable($log_file);
    $error_log_enabled = ($debug_log_on || $log_file_exists);

    $log_message = '';
    if (!$debug_log_on && !$log_file_exists) {
        $log_message = 'Logging is DISABLED. Please add define("WP_DEBUG", true); and define("WP_DEBUG_LOG", true); to your wp-config.php.';
    } elseif ($debug_log_on && !$log_file_exists) {
        $log_message = 'Logging is ENABLED, but the log file has not been created yet at ' . str_replace(ABSPATH, '', $log_file) . '. WordPress only creates this file when the first error occurs.';
    } elseif ($log_file_exists && !is_readable($log_file)) {
        $log_message = 'Log file found at ' . str_replace(ABSPATH, '', $log_file) . ' but it is NOT READABLE by the web server. Check file permissions.';
    }

    if ($log_file_exists) {
        $lines = @file($log_file, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
        if ($lines !== false) {
            $lines = array_slice($lines, -200);
            foreach ($lines as $line) {
                $error_log_lines[] = array(
                    'raw' => $line,
                    'time' => preg_match('/^\[([^\]]+)\]/', $line, $m) ? $m[1] : ''
                );
            }
        }
    }
    
    // Access summary from our request log (stored by plugin)
    $request_log = get_option('webmonitor_request_log', array());
    if (!is_array($request_log)) $request_log = array();
    
    $by_status = array();
    $by_url = array();
    foreach ($request_log as $entry) {
        $s = isset($entry['status']) ? (int) $entry['status'] : 200;
        $by_status[$s] = (isset($by_status[$s]) ? $by_status[$s] : 0) + 1;
        $url = isset($entry['url']) ? $entry['url'] : '';
        if ($url) {
            $by_url[$url] = (isset($by_url[$url]) ? $by_url[$url] : 0) + 1;
        }
    }
    arsort($by_url);
    $top_urls = array();
    $i = 0;
    foreach ($by_url as $url => $count) {
        if ($i >= 20) break;
        $top_urls[] = array('url' => $url, 'count' => $count);
        $i++;
    }
    
    return array(
        'error_log' => array(
            'enabled' => $error_log_enabled,
            'log_file_path' => str_replace(ABSPATH, '', $log_file),
            'message' => $log_message,
            'lines' => array_slice($error_log_lines, -100),
            'count' => count($error_log_lines)
        ),
        'access_summary' => array(
            'by_status' => $by_status,
            'top_urls' => $top_urls,
            'total_requests' => count($request_log)
        )
    );
}

function webmonitor_advanced_recommendations($request) {
    webmonitor_advanced_verify_api_key($request);
    
    $perf = webmonitor_advanced_performance($request);
    $seo = webmonitor_advanced_seo($request);
    $sec = webmonitor_advanced_security($request);
    
    $with_source = array();
    foreach (array('performance' => (isset($perf['recommendations']) ? $perf['recommendations'] : array()), 'seo' => (isset($seo['recommendations']) ? $seo['recommendations'] : array()), 'security' => (isset($sec['recommendations']) ? $sec['recommendations'] : array())) as $src => $list) {
        foreach ((array) $list as $r) {
            if (is_string($r)) {
                $with_source[] = array('text' => $r, 'source' => $src);
            }
        }
    }
    
    return array(
        'recommendations' => $with_source,
        'count' => count($with_source)
    );
}

function webmonitor_advanced_health_check($request) {
    // Real health check data
    $start_time = microtime(true);
    
    // Test database connection
    global $wpdb;
    $db_status = $wpdb->get_var("SELECT 1") ? 'connected' : 'error';
    
    // Test memory usage
    $memory_usage = memory_get_usage(true);
    $memory_limit = ini_get('memory_limit');
    $memory_percentage = ($memory_usage / wp_convert_hr_to_bytes($memory_limit)) * 100;
    
    // Test plugins
    $active_plugins = get_option('active_plugins', array());
    $plugin_count = count($active_plugins);
    
    // Calculate response time
    $response_time = round((microtime(true) - $start_time) * 1000, 2);

    // Real server uptime (seconds) from the kernel, when available.
    // Note: an uptime *percentage* over time is computed by the monitoring
    // backend from repeated health checks, not fabricated here.
    $uptime_seconds = null;
    if (@is_readable('/proc/uptime')) {
        $proc = @file_get_contents('/proc/uptime');
        if ($proc !== false) {
            $uptime_seconds = (int) floatval(strtok($proc, ' '));
        }
    }

    // Report what the checks above actually found instead of always "healthy"
    $status = 'healthy';
    $message = 'WordPress site is healthy - Advanced Plugin!';
    if ($db_status !== 'connected') {
        $status = 'error';
        $message = 'Database connection check failed';
    } elseif ($memory_percentage >= 90) {
        $status = 'warning';
        $message = 'Memory usage is above 90% of the PHP memory limit';
    }

    return array(
        'status' => $status,
        'timestamp' => current_time('mysql'),
        'uptime_seconds' => $uptime_seconds,
        'response_time' => $response_time,
        'status_code' => 200,
        'message' => $message,
        'site_url' => home_url(),
        'wordpress_version' => get_bloginfo('version'),
        'plugin_version' => '1.0.0 (Advanced)',
        'checks' => array(
            'database' => $db_status,
            'memory' => $memory_percentage < 80 ? 'normal' : 'high',
            'plugins' => $plugin_count . ' active plugins',
            'memory_usage' => round($memory_percentage, 2) . '%',
            'memory_limit' => $memory_limit
        )
    );
}

function webmonitor_advanced_analytics($request) {
    global $wpdb;
    
    // Real analytics data from WordPress
    $total_posts = wp_count_posts()->publish;
    $total_pages = wp_count_posts('page')->publish;
    $total_comments = wp_count_comments()->approved;
    $total_users = count_users()['total_users'];
    
    // Get real post views from WordPress
    $recent_posts = get_posts(array(
        'numberposts' => 5,
        'post_status' => 'publish',
        'orderby' => 'date',
        'order' => 'DESC'
    ));
    
    // Real page views: only counted when an analytics plugin has stored the
    // '_post_views' meta. No estimates/fallbacks — unknown stays 0.
    $top_pages = array();
    $real_views_total = 0;
    $has_view_data = false;
    foreach ($recent_posts as $post) {
        $view_count = (int) get_post_meta($post->ID, '_post_views', true);
        if ($view_count > 0) {
            $has_view_data = true;
        }
        $real_views_total += $view_count;
        $top_pages[] = array(
            'page' => '/' . $post->post_name,
            'views' => $view_count,
            'title' => $post->post_title
        );
    }

    // Visitors / page views / bounce rate / session duration cannot be measured
    // from WordPress alone. They require a real analytics source (GA4, Jetpack,
    // Matomo, etc.). Report what is actually known; null = not available.
    return array(
        'totalVisitors' => null,
        'pageViews' => $has_view_data ? $real_views_total : null,
        'bounceRate' => null,
        'avgSessionDuration' => null,
        'analytics_source' => $has_view_data ? 'post_views_meta' : 'unavailable',
        'analytics_note' => $has_view_data
            ? 'Page views from stored _post_views meta. Visitors/bounce/session require an external analytics integration.'
            : 'No real traffic source connected. Connect GA4/Jetpack/Matomo for real visitor analytics.',
        'top_pages' => $top_pages,
        'content_stats' => array(
            'total_posts' => $total_posts,
            'total_pages' => $total_pages,
            'total_comments' => $total_comments,
            'total_users' => $total_users
        )
    );
}

function webmonitor_advanced_performance($request) {
    // Real performance data
    $start_time = microtime(true);
    
    // Test database query performance
    global $wpdb;
    $query_start = microtime(true);
    $wpdb->get_results("SELECT ID, post_title FROM {$wpdb->posts} WHERE post_status = 'publish' LIMIT 10");
    $query_time = (microtime(true) - $query_start) * 1000;
    
    // Memory usage
    $memory_usage = memory_get_usage(true);
    $memory_peak = memory_get_peak_usage(true);
    $memory_limit = wp_convert_hr_to_bytes(ini_get('memory_limit'));
    
    // Server response time
    $response_time = (microtime(true) - $start_time) * 1000;
    
    // Get active plugins for performance impact
    $active_plugins = get_option('active_plugins', array());
    $plugin_count = count($active_plugins);
    
    // Calculate performance score
    $performance_score = 100;
    if ($query_time > 100) $performance_score -= 20;
    if ($memory_usage / $memory_limit > 0.8) $performance_score -= 15;
    if ($plugin_count > 20) $performance_score -= 10;
    if ($response_time > 500) $performance_score -= 25;
    
    $recommendations = array();
    if ($query_time > 100) $recommendations[] = 'Optimize database queries';
    if ($memory_usage / $memory_limit > 0.8) $recommendations[] = 'Increase memory limit or optimize memory usage';
    if ($plugin_count > 20) $recommendations[] = 'Consider deactivating unused plugins';
    if ($response_time > 500) $recommendations[] = 'Enable caching or optimize server';
    
    // Real CPU utilisation derived from the kernel load average and core count.
    // Unavailable on some hosts (e.g. Windows) -> null rather than a fake value.
    $cpu_usage = null;
    $cpu_load_avg = null;
    if (function_exists('sys_getloadavg')) {
        $load = sys_getloadavg();
        if (is_array($load) && isset($load[0])) {
            $cpu_load_avg = round($load[0], 2);
            $cores = 1;
            if (@is_readable('/proc/cpuinfo')) {
                $cores = max(1, substr_count(@file_get_contents('/proc/cpuinfo'), 'processor'));
            }
            $cpu_usage = round(min(100, ($load[0] / $cores) * 100), 2);
        }
    }

    return array(
        'load_time' => round($response_time, 2),
        'server_response_time' => round($response_time, 2),
        'database_query_time' => round($query_time, 2),
        'memory_usage' => round(($memory_usage / $memory_limit) * 100, 2),
        'memory_peak' => round(($memory_peak / $memory_limit) * 100, 2),
        'cpu_usage' => $cpu_usage,
        'cpu_load_avg' => $cpu_load_avg,
        'performance_score' => max(0, $performance_score),
        'active_plugins' => $plugin_count,
        'recommendations' => $recommendations
    );
}

function webmonitor_advanced_seo($request) {
    // Real SEO data from WordPress
    $total_posts = wp_count_posts()->publish;
    $total_pages = wp_count_posts('page')->publish;
    
    // Check meta tags
    $meta_title = get_option('blogname');
    $meta_description = get_option('blogdescription');
    
    // Calculate SEO score based on real data
    $seo_score = 70; // Base score
    
    if (!empty($meta_title)) $seo_score += 10;
    if (!empty($meta_description)) $seo_score += 10;
    if ($total_posts > 10) $seo_score += 5;
    if ($total_pages > 5) $seo_score += 5;
    
    // Check for SSL
    if (is_ssl()) $seo_score += 10;
    
    $seo_score = min(100, $seo_score);
    
    // Get recent posts for SEO analysis
    $recent_posts = get_posts(array(
        'numberposts' => 20,
        'post_status' => 'publish',
        'orderby' => 'date',
        'order' => 'DESC'
    ));

    // Scan real post content for images, links and headings.
    $seo_issues = array();
    $img_total = 0;
    $img_with_alt = 0;
    $internal_links = 0;
    $external_links = 0;
    $posts_with_heading = 0;
    $home_host = parse_url(home_url(), PHP_URL_HOST);

    foreach ($recent_posts as $post) {
        if (empty($post->post_excerpt)) {
            $seo_issues[] = 'Post "' . $post->post_title . '" missing excerpt';
        }

        $content = $post->post_content;

        // Real alt-tag coverage
        if (preg_match_all('/<img\b[^>]*>/i', $content, $imgs)) {
            foreach ($imgs[0] as $img_tag) {
                $img_total++;
                if (preg_match('/\balt\s*=\s*("|\')(.*?)\1/i', $img_tag, $alt) && trim($alt[2]) !== '') {
                    $img_with_alt++;
                }
            }
        }

        // Real internal vs external link counts
        if (preg_match_all('/<a\b[^>]*href\s*=\s*("|\')(.*?)\1/i', $content, $links)) {
            foreach ($links[2] as $href) {
                $host = parse_url($href, PHP_URL_HOST);
                if (empty($host) || $host === $home_host) {
                    $internal_links++;
                } else {
                    $external_links++;
                }
            }
        }

        // Real heading presence
        if (preg_match('/<h[1-3]\b/i', $content)) {
            $posts_with_heading++;
        }
    }

    $alt_tag_coverage = $img_total > 0 ? round(($img_with_alt / $img_total) * 100) : null;
    $scanned = count($recent_posts);
    $heading_structure = $scanned > 0
        ? ($posts_with_heading >= ($scanned * 0.7) ? 'good' : 'needs_improvement')
        : 'unknown';
    
    $recommendations = array();
    if (empty($meta_description)) $recommendations[] = 'Add site description';
    if ($total_posts < 10) $recommendations[] = 'Create more content';
    if (!is_ssl()) $recommendations[] = 'Enable SSL certificate';
    if (count($seo_issues) > 0) $recommendations[] = 'Fix SEO issues in recent posts';
    
    return array(
        'score' => $seo_score,
        'meta_tags' => !empty($meta_title) && !empty($meta_description) ? 'complete' : 'incomplete',
        'alt_tags' => $alt_tag_coverage, // Real coverage from scanned posts (null = no images found)
        'heading_structure' => $heading_structure,
        'internal_links' => $internal_links,
        'external_links' => $external_links,
        'posts_scanned' => $scanned,
        'ssl_enabled' => is_ssl(),
        'site_title' => $meta_title,
        'site_description' => $meta_description,
        'total_content' => $total_posts + $total_pages,
        'seo_issues' => $seo_issues,
        'recommendations' => $recommendations
    );
}

function webmonitor_advanced_security($request) {
    // Real security data from WordPress
    $wp_version = get_bloginfo('version');
    $active_plugins = get_option('active_plugins', array());
    $plugin_count = count($active_plugins);
    
    // Check for security plugins
    $security_plugins = array();
    foreach ($active_plugins as $plugin) {
        if (strpos($plugin, 'security') !== false || 
            strpos($plugin, 'firewall') !== false || 
            strpos($plugin, 'malware') !== false) {
            $security_plugins[] = $plugin;
        }
    }
    
    // Calculate security score
    $security_score = 60; // Base score
    
    if (is_ssl()) $security_score += 20;
    if (count($security_plugins) > 0) $security_score += 15;
    if ($plugin_count < 20) $security_score += 5;

    // Real outdated-plugin count from WordPress' update data (populated by the
    // wp-cron update check). Reads the cached transient; no fabrication.
    $update_data = get_site_transient('update_plugins');
    $outdated_plugins = (is_object($update_data) && !empty($update_data->response))
        ? count($update_data->response)
        : 0;
    // Penalty capped at 30 so a large real outdated count doesn't floor the score.
    if ($outdated_plugins > 0) $security_score -= min(30, $outdated_plugins * 3);

    $security_score = max(0, min(100, $security_score));
    
    $recommendations = array();
    if (!is_ssl()) $recommendations[] = 'Enable SSL certificate';
    if (count($security_plugins) == 0) $recommendations[] = 'Install a security plugin';
    if ($plugin_count > 20) $recommendations[] = 'Review and deactivate unused plugins';
    if ($outdated_plugins > 0) $recommendations[] = 'Update outdated plugins';
    
    return array(
        'ssl_status' => is_ssl() ? 'enabled' : 'disabled',
        'firewall' => count($security_plugins) > 0 ? 'active' : 'none',
        'malware_scan' => 'not_available', // No real scanner integrated; was previously hardcoded 'clean'
        'vulnerability_scan' => $outdated_plugins == 0 ? 'passed' : 'issues_found',
        'security_score' => $security_score,
        'security_plugins' => count($security_plugins),
        'total_plugins' => $plugin_count,
        'outdated_plugins' => $outdated_plugins,
        'wordpress_version' => $wp_version,
        'recommendations' => $recommendations
    );
}

function webmonitor_advanced_plugins($request) {
    // Get all plugins and active list
    $active_plugins = get_option('active_plugins', array());
    $all_plugins = get_plugins();

    $all = array();
    $active = array();
    $inactive = array();
    $outdated = array();
    $potentially_unused = array();

    foreach ($all_plugins as $plugin_file => $plugin_data) {
        $plugin_name = $plugin_data['Name'];
        $plugin_version = $plugin_data['Version'];
        $plugin_description = $plugin_data['Description'];
        $plugin_author = $plugin_data['Author'];

        $is_active = in_array($plugin_file, $active_plugins, true);

        // Heuristics for potentially unused
        $is_potentially_unused = false;
        $unused_reasons = array();
        $lower_name = strtolower($plugin_name);
        if (strpos($lower_name, 'hello dolly') !== false) { $is_potentially_unused = true; $unused_reasons[] = 'Default WordPress plugin'; }
        if (strpos($lower_name, 'sample') !== false) { $is_potentially_unused = true; $unused_reasons[] = 'Sample/test plugin'; }
        if (strpos($lower_name, 'test') !== false) { $is_potentially_unused = true; $unused_reasons[] = 'Test plugin'; }
        if (strpos($lower_name, 'demo') !== false) { $is_potentially_unused = true; $unused_reasons[] = 'Demo plugin'; }

        // Outdated check based on last modified timestamp
        $plugin_path = WP_PLUGIN_DIR . '/' . $plugin_file;
        $last_modified = file_exists($plugin_path) ? filemtime($plugin_path) : 0;
        $days_since_update = $last_modified ? (time() - $last_modified) / (60 * 60 * 24) : null;
        $is_outdated = $days_since_update !== null && $days_since_update > 365;
        if ($is_outdated) { $unused_reasons[] = 'Not updated in over a year'; }

        $info = array(
            'name' => $plugin_name,
            'version' => $plugin_version,
            'description' => $plugin_description,
            'author' => $plugin_author,
            'file' => $plugin_file,
            'is_active' => $is_active,
            'is_outdated' => $is_outdated,
            'potentially_unused' => $is_potentially_unused,
            'unused_reasons' => $unused_reasons,
            'last_modified' => $last_modified ? date('Y-m-d', $last_modified) : 'Unknown'
        );

        $all[] = $info;
        if ($is_active) { $active[] = $info; } else { $inactive[] = $info; }
        if ($is_outdated) { $outdated[] = $info; }
        if ($is_potentially_unused) { $potentially_unused[] = $info; }
    }

    return array(
        'total_plugins' => count($all_plugins),
        'active_count' => count($active),
        'inactive_count' => count($inactive),
        'outdated_count' => count($outdated),
        'potentially_unused_count' => count($potentially_unused),
        'all_plugins' => $all,
        'active_plugins' => $active,
        'inactive_plugins' => $inactive,
        'outdated_plugins' => $outdated,
        'potentially_unused_plugins' => $potentially_unused,
        'recommendations' => array(
            'Review inactive and potentially unused plugins',
            'Update outdated plugins to the latest versions',
            'Remove plugins that are not actively maintained'
        )
    );
}

function webmonitor_advanced_alerts($request) {
    // Generate real-time alerts based on site status
    $alerts = array();
    
    // 1. SSL Certificate Check
    if (!is_ssl()) {
        $alerts[] = array(
            'id' => 'ssl_disabled',
            'title' => 'SSL Certificate Disabled',
            'message' => 'SSL certificate is disabled - Enable SSL for better security and SEO',
            'priority' => 'high',
            'type' => 'security',
            'timestamp' => current_time('mysql'),
            'details' => array(
                'current_status' => 'Disabled',
                'impact' => 'Security and SEO',
                'recommendation' => 'Enable SSL certificate through your hosting provider or CDN',
                'steps' => array(
                    'Contact your hosting provider to enable SSL',
                    'Configure SSL certificate in your hosting control panel',
                    'Update your site URL to use HTTPS',
                    'Test SSL configuration and redirect HTTP to HTTPS'
                )
            )
        );
    }
    
    // 2. Security Score Check
    $wp_version = get_bloginfo('version');
    $active_plugins = get_option('active_plugins', array());
    $plugin_count = count($active_plugins);
    
    $security_plugins = array();
    foreach ($active_plugins as $plugin) {
        if (strpos($plugin, 'security') !== false || 
            strpos($plugin, 'firewall') !== false || 
            strpos($plugin, 'malware') !== false) {
            $security_plugins[] = $plugin;
        }
    }
    
    $security_score = 60;
    if (is_ssl()) $security_score += 20;
    if (count($security_plugins) > 0) $security_score += 15;
    if ($plugin_count < 20) $security_score += 5;
    $security_score = max(0, min(100, $security_score));
    
    if ($security_score < 70) {
        $alerts[] = array(
            'id' => 'security_score_low',
            'title' => 'Security Score Below Threshold',
            'message' => "Security score is {$security_score}/100 - Below recommended threshold",
            'priority' => 'medium',
            'type' => 'security',
            'timestamp' => current_time('mysql'),
            'details' => array(
                'current_score' => $security_score,
                'recommended_score' => 70,
                'impact' => 'Site security and vulnerability',
                'recommendation' => 'Improve security score to 70 or above',
                'steps' => array(
                    is_ssl() ? null : 'Enable SSL certificate',
                    count($security_plugins) == 0 ? 'Install a security plugin' : null,
                    'Keep WordPress and plugins updated',
                    'Use strong passwords',
                    'Implement two-factor authentication',
                    'Regular security audits'
                )
            )
        );
    }
    
    // 3. Outdated Plugins Check
    $all_plugins = get_plugins();
    $outdated_count = 0;
    foreach ($all_plugins as $plugin_file => $plugin_data) {
        if (!in_array($plugin_file, $active_plugins)) continue;
        
        $plugin_path = WP_PLUGIN_DIR . '/' . $plugin_file;
        $last_modified = file_exists($plugin_path) ? filemtime($plugin_path) : 0;
        $days_since_update = $last_modified ? (time() - $last_modified) / (60 * 60 * 24) : null;
        if ($days_since_update !== null && $days_since_update > 365) {
            $outdated_count++;
        }
    }
    
    if ($outdated_count > 0) {
        $alerts[] = array(
            'id' => 'outdated_plugins',
            'title' => 'Outdated Plugins Detected',
            'message' => "{$outdated_count} outdated plugin(s) detected - Update recommended",
            'priority' => 'medium',
            'type' => 'security',
            'timestamp' => current_time('mysql'),
            'details' => array(
                'outdated_count' => $outdated_count,
                'impact' => 'Security vulnerabilities and performance issues',
                'recommendation' => 'Update outdated plugins to latest versions',
                'steps' => array(
                    'Go to WordPress Admin → Plugins',
                    'Check for available updates',
                    'Update outdated plugins one by one',
                    'Backup site before updating',
                    'Test site functionality after updates'
                )
            )
        );
    }
    
    // 4. SEO Meta Tags Check
    $meta_title = get_option('blogname');
    $meta_description = get_option('blogdescription');
    
    if (empty($meta_description)) {
        $alerts[] = array(
            'id' => 'meta_tags_incomplete',
            'title' => 'Meta Tags Incomplete',
            'message' => 'Meta tags are incomplete - Complete meta tags for better SEO',
            'priority' => 'low',
            'type' => 'seo',
            'timestamp' => current_time('mysql'),
            'details' => array(
                'current_status' => 'Incomplete',
                'impact' => 'SEO performance and search rankings',
                'recommendation' => 'Complete meta tags for better SEO',
                'steps' => array(
                    'Add site description in WordPress settings',
                    'Configure SEO plugin if available',
                    'Add meta descriptions to posts and pages',
                    'Optimize title tags',
                    'Add Open Graph and Twitter card meta tags'
                )
            )
        );
    }
    
    // 5. SEO Issues Check
    $total_posts = wp_count_posts()->publish;
    $recent_posts = get_posts(array(
        'numberposts' => 10,
        'post_status' => 'publish',
        'orderby' => 'date',
        'order' => 'DESC'
    ));
    
    $seo_issues = array();
    foreach ($recent_posts as $post) {
        if (empty($post->post_excerpt)) {
            $seo_issues[] = 'Post "' . $post->post_title . '" missing excerpt';
        }
    }
    
    if (count($seo_issues) > 0) {
        $alerts[] = array(
            'id' => 'seo_issues_found',
            'title' => 'SEO Issues Found',
            'message' => count($seo_issues) . ' SEO issue(s) found - Review and fix',
            'priority' => 'medium',
            'type' => 'seo',
            'timestamp' => current_time('mysql'),
            'details' => array(
                'issues_count' => count($seo_issues),
                'issues' => array_slice($seo_issues, 0, 5),
                'impact' => 'SEO performance and search rankings',
                'recommendation' => 'Fix SEO issues to improve search visibility',
                'steps' => array(
                    'Review each SEO issue listed below',
                    'Add missing excerpts to posts',
                    'Complete meta descriptions',
                    'Optimize content for target keywords',
                    'Fix broken links and images',
                    'Regular SEO audits and monitoring'
                )
            )
        );
    }
    
    return array(
        'total_alerts' => count($alerts),
        'high_priority' => count(array_filter($alerts, function($a) { return $a['priority'] === 'high'; })),
        'medium_priority' => count(array_filter($alerts, function($a) { return $a['priority'] === 'medium'; })),
        'low_priority' => count(array_filter($alerts, function($a) { return $a['priority'] === 'low'; })),
        'alerts' => $alerts
    );
}
?>
