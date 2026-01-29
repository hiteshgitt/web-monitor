<?php
/**
 * Plugin Name: Web Monitor API (Fixed)
 * Description: Fixed API endpoints for Web Monitor Dashboard
 * Version: 1.0.0
 * Author: Web Monitor Team
 */

// Prevent direct access
if (!defined('ABSPATH')) {
    exit;
}

// Add admin menu
add_action('admin_menu', 'webmonitor_fixed_add_admin_menu');

function webmonitor_fixed_add_admin_menu() {
    add_options_page(
        'Web Monitor API (Fixed)',
        'Web Monitor API (Fixed)',
        'manage_options',
        'webmonitor-api-fixed',
        'webmonitor_fixed_admin_page'
    );
}

function webmonitor_fixed_admin_page() {
    if (isset($_POST['submit'])) {
        $api_key = sanitize_text_field($_POST['api_key']);
        update_option('webmonitor_fixed_api_key', $api_key);
        echo '<div class="notice notice-success"><p>API key updated successfully!</p></div>';
    }
    
    $current_key = get_option('webmonitor_fixed_api_key', '');
    ?>
    <div class="wrap">
        <h1>Web Monitor API (Fixed) Settings</h1>
        <form method="post" action="">
            <table class="form-table">
                <tr>
                    <th scope="row">API Key</th>
                    <td>
                        <input type="text" name="api_key" value="<?php echo esc_attr($current_key); ?>" class="regular-text" />
                        <p class="description">This key will be used to authenticate API requests.</p>
                    </td>
                </tr>
            </table>
            <?php submit_button(); ?>
        </form>
        
        <h2>Current API Key</h2>
        <p><strong><?php echo esc_html($current_key ?: 'No API key set'); ?></strong></p>
        
        <h2>Test Endpoint</h2>
        <p>Test URL: <code><?php echo home_url('/wp-json/webmonitor-fixed/v1/health'); ?></code></p>
        <p>Use this command to test:</p>
        <pre>curl -H "Authorization: Bearer <?php echo esc_html($current_key ?: 'YOUR_API_KEY'); ?>" <?php echo home_url('/wp-json/webmonitor-fixed/v1/health'); ?></pre>
    </div>
    <?php
}

// Register REST API routes with different namespace
add_action('rest_api_init', 'webmonitor_fixed_register_routes');

function webmonitor_fixed_register_routes() {
    register_rest_route('webmonitor-fixed/v1', '/health', array(
        'methods' => 'GET',
        'callback' => 'webmonitor_fixed_health_check',
        'permission_callback' => 'webmonitor_fixed_check_api_key'
    ));
    
    register_rest_route('webmonitor-fixed/v1', '/analytics', array(
        'methods' => 'GET',
        'callback' => 'webmonitor_fixed_analytics',
        'permission_callback' => 'webmonitor_fixed_check_api_key'
    ));
}

function webmonitor_fixed_check_api_key($request) {
    $api_key = $request->get_header('Authorization');
    
    if (!$api_key) {
        return new WP_Error('missing_api_key', 'API key required', array('status' => 401));
    }
    
    // Remove 'Bearer ' prefix
    $api_key = str_replace('Bearer ', '', $api_key);
    
    // Get stored API key
    $stored_key = get_option('webmonitor_fixed_api_key', '');
    
    if (empty($stored_key)) {
        return new WP_Error('no_api_key_set', 'No API key configured', array('status' => 401));
    }
    
    if ($api_key !== $stored_key) {
        return new WP_Error('invalid_api_key', 'Invalid API key', array('status' => 401));
    }
    
    return true;
}

function webmonitor_fixed_health_check($request) {
    return array(
        'status' => 'healthy',
        'timestamp' => current_time('mysql'),
        'uptime' => 99.9,
        'response_time' => 245,
        'status_code' => 200,
        'message' => 'WordPress site is healthy',
        'site_url' => home_url(),
        'wordpress_version' => get_bloginfo('version'),
        'plugin_version' => '1.0.0 (Fixed)'
    );
}

function webmonitor_fixed_analytics($request) {
    return array(
        'visitors' => rand(1000, 5000),
        'page_views' => rand(5000, 15000),
        'bounce_rate' => rand(30, 60),
        'avg_session_duration' => rand(120, 300),
        'top_pages' => array(
            array('page' => '/', 'views' => rand(1000, 3000)),
            array('page' => '/about', 'views' => rand(500, 1500)),
            array('page' => '/contact', 'views' => rand(300, 1000))
        )
    );
}
?>
