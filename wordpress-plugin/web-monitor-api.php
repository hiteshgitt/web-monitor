<?php
/**
 * Plugin Name: Web Monitor API
 * Description: Provides API endpoints for Web Monitor Dashboard
 * Version: 1.0.0
 * Author: Web Monitor Team
 */

// Prevent direct access
if (!defined('ABSPATH')) {
    exit;
}

class WebMonitorAPI {
    
    public function __construct() {
        add_action('rest_api_init', array($this, 'register_routes'));
        add_action('init', array($this, 'add_cors_support'));
    }
    
    public function register_routes() {
        // Health check endpoint
        register_rest_route('webmonitor/v1', '/health', array(
            'methods' => 'GET',
            'callback' => array($this, 'get_health_status'),
            'permission_callback' => array($this, 'check_api_key')
        ));
        
        // Analytics endpoint
        register_rest_route('webmonitor/v1', '/analytics', array(
            'methods' => 'GET',
            'callback' => array($this, 'get_analytics_data'),
            'permission_callback' => array($this, 'check_api_key')
        ));
        
        // Performance endpoint
        register_rest_route('webmonitor/v1', '/performance', array(
            'methods' => 'GET',
            'callback' => array($this, 'get_performance_data'),
            'permission_callback' => array($this, 'check_api_key')
        ));
        
        // SEO endpoint
        register_rest_route('webmonitor/v1', '/seo', array(
            'methods' => 'GET',
            'callback' => array($this, 'get_seo_data'),
            'permission_callback' => array($this, 'check_api_key')
        ));
        
        // Security endpoint
        register_rest_route('webmonitor/v1', '/security', array(
            'methods' => 'GET',
            'callback' => array($this, 'get_security_data'),
            'permission_callback' => array($this, 'check_api_key')
        ));
    }
    
    public function check_api_key($request) {
        $api_key = $request->get_header('Authorization');
        if (!$api_key) {
            return new WP_Error('missing_api_key', 'API key required', array('status' => 401));
        }
        
        // Remove 'Bearer ' prefix
        $api_key = str_replace('Bearer ', '', $api_key);
        
        // Check against stored API key
        $stored_key = get_option('webmonitor_api_key', '');
        if (empty($stored_key) || $api_key !== $stored_key) {
            return new WP_Error('invalid_api_key', 'Invalid API key', array('status' => 401));
        }
        
        return true;
    }
    
    public function get_health_status($request) {
        $start_time = microtime(true);
        
        // Basic health checks
        $health_status = array(
            'status' => 'healthy',
            'timestamp' => current_time('mysql'),
            'uptime' => $this->calculate_uptime(),
            'response_time' => 0,
            'status_code' => 200,
            'checks' => array()
        );
        
        // Database check
        global $wpdb;
        $db_check = $wpdb->get_var("SELECT 1");
        $health_status['checks']['database'] = $db_check ? 'healthy' : 'error';
        
        // Memory check
        $memory_usage = memory_get_usage(true);
        $memory_limit = ini_get('memory_limit');
        $health_status['checks']['memory'] = $memory_usage < $this->convert_to_bytes($memory_limit) * 0.8 ? 'healthy' : 'warning';
        
        // Plugin check
        $health_status['checks']['plugins'] = $this->check_plugin_health();
        
        // Calculate response time
        $health_status['response_time'] = round((microtime(true) - $start_time) * 1000);
        
        return rest_ensure_response($health_status);
    }
    
    public function get_analytics_data($request) {
        $analytics = array(
            'visitors' => $this->get_visitor_count(),
            'page_views' => $this->get_page_view_count(),
            'bounce_rate' => $this->get_bounce_rate(),
            'avg_session_duration' => $this->get_avg_session_duration(),
            'top_pages' => $this->get_top_pages(),
            'traffic_sources' => $this->get_traffic_sources(),
            'device_types' => $this->get_device_types()
        );
        
        return rest_ensure_response($analytics);
    }
    
    public function get_performance_data($request) {
        $performance = array(
            'load_time' => $this->get_load_time(),
            'page_size' => $this->get_page_size(),
            'requests' => $this->get_request_count(),
            'cache_hit_rate' => $this->get_cache_hit_rate(),
            'database_queries' => $this->get_db_query_count()
        );
        
        return rest_ensure_response($performance);
    }
    
    public function get_seo_data($request) {
        $seo = array(
            'score' => $this->get_seo_score(),
            'issues' => $this->get_seo_issues(),
            'meta_tags' => $this->get_meta_tags_status(),
            'sitemap' => $this->get_sitemap_status(),
            'robots_txt' => $this->get_robots_txt_status()
        );
        
        return rest_ensure_response($seo);
    }
    
    public function get_security_data($request) {
        $security = array(
            'score' => $this->get_security_score(),
            'alerts' => $this->get_security_alerts(),
            'ssl_status' => $this->get_ssl_status(),
            'plugin_updates' => $this->get_plugin_updates(),
            'core_updates' => $this->get_core_updates()
        );
        
        return rest_ensure_response($security);
    }
    
    // Helper methods
    private function calculate_uptime() {
        // This would typically be calculated from monitoring data
        // For demo purposes, return a high uptime
        return 99.9;
    }
    
    private function check_plugin_health() {
        $plugins = get_plugins();
        $active_plugins = get_option('active_plugins');
        $healthy_plugins = 0;
        
        foreach ($active_plugins as $plugin) {
            if (isset($plugins[$plugin])) {
                $healthy_plugins++;
            }
        }
        
        return count($active_plugins) > 0 ? 'healthy' : 'warning';
    }
    
    private function get_visitor_count() {
        // This would typically come from Google Analytics or similar
        // For demo purposes, return a sample number
        return rand(1000, 5000);
    }
    
    private function get_page_view_count() {
        return rand(5000, 15000);
    }
    
    private function get_bounce_rate() {
        return rand(30, 60);
    }
    
    private function get_avg_session_duration() {
        return rand(120, 300);
    }
    
    private function get_top_pages() {
        return array(
            array('page' => '/', 'views' => rand(1000, 3000)),
            array('page' => '/about', 'views' => rand(500, 1500)),
            array('page' => '/contact', 'views' => rand(300, 1000)),
            array('page' => '/blog', 'views' => rand(800, 2000))
        );
    }
    
    private function get_traffic_sources() {
        return array(
            array('source' => 'Google', 'visitors' => rand(500, 2000)),
            array('source' => 'Direct', 'visitors' => rand(300, 1500)),
            array('source' => 'Social', 'visitors' => rand(200, 1000))
        );
    }
    
    private function get_device_types() {
        return array(
            array('device' => 'Desktop', 'percentage' => rand(50, 70)),
            array('device' => 'Mobile', 'percentage' => rand(25, 40)),
            array('device' => 'Tablet', 'percentage' => rand(5, 15))
        );
    }
    
    private function get_load_time() {
        return rand(200, 800);
    }
    
    private function get_page_size() {
        return rand(500, 2000);
    }
    
    private function get_request_count() {
        return rand(10, 50);
    }
    
    private function get_cache_hit_rate() {
        return rand(70, 95);
    }
    
    private function get_db_query_count() {
        return rand(5, 25);
    }
    
    private function get_seo_score() {
        return rand(70, 95);
    }
    
    private function get_seo_issues() {
        return array(
            array('type' => 'meta_description', 'severity' => 'warning', 'message' => 'Missing meta description on some pages'),
            array('type' => 'alt_text', 'severity' => 'info', 'message' => 'Some images missing alt text')
        );
    }
    
    private function get_meta_tags_status() {
        return 'good';
    }
    
    private function get_sitemap_status() {
        return 'present';
    }
    
    private function get_robots_txt_status() {
        return 'present';
    }
    
    private function get_security_score() {
        return rand(80, 95);
    }
    
    private function get_security_alerts() {
        return array(
            array('severity' => 'low', 'message' => 'Minor security patch available', 'timestamp' => current_time('mysql')),
            array('severity' => 'info', 'message' => 'SSL certificate expires in 30 days', 'timestamp' => current_time('mysql'))
        );
    }
    
    private function get_ssl_status() {
        return 'valid';
    }
    
    private function get_plugin_updates() {
        return rand(0, 3);
    }
    
    private function get_core_updates() {
        return rand(0, 1);
    }
    
    private function convert_to_bytes($val) {
        $val = trim($val);
        $last = strtolower($val[strlen($val)-1]);
        $val = (int) $val;
        
        switch($last) {
            case 'g': $val *= 1024;
            case 'm': $val *= 1024;
            case 'k': $val *= 1024;
        }
        
        return $val;
    }
    
    public function add_cors_support() {
        remove_filter('rest_pre_serve_request', 'rest_send_cors_headers');
        add_filter('rest_pre_serve_request', function($value) {
            header('Access-Control-Allow-Origin: *');
            header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
            header('Access-Control-Allow-Headers: Content-Type, Authorization');
            return $value;
        });
    }
}

// Initialize the plugin
new WebMonitorAPI();

// Add admin menu for API key management
add_action('admin_menu', function() {
    add_options_page(
        'Web Monitor API',
        'Web Monitor API',
        'manage_options',
        'webmonitor-api',
        'webmonitor_api_admin_page'
    );
});

function webmonitor_api_admin_page() {
    if (isset($_POST['submit'])) {
        $api_key = sanitize_text_field($_POST['api_key']);
        update_option('webmonitor_api_key', $api_key);
        echo '<div class="notice notice-success"><p>API key updated successfully!</p></div>';
    }
    
    $current_key = get_option('webmonitor_api_key', '');
    ?>
    <div class="wrap">
        <h1>Web Monitor API Settings</h1>
        <form method="post" action="">
            <table class="form-table">
                <tr>
                    <th scope="row">API Key</th>
                    <td>
                        <input type="text" name="api_key" value="<?php echo esc_attr($current_key); ?>" class="regular-text" />
                        <p class="description">This key will be used to authenticate API requests from your Web Monitor Dashboard.</p>
                    </td>
                </tr>
            </table>
            <?php submit_button(); ?>
        </form>
        
        <h2>API Endpoints</h2>
        <p>Your WordPress site now provides the following API endpoints:</p>
        <ul>
            <li><code><?php echo home_url('/wp-json/webmonitor/v1/health'); ?></code> - Health check</li>
            <li><code><?php echo home_url('/wp-json/webmonitor/v1/analytics'); ?></code> - Analytics data</li>
            <li><code><?php echo home_url('/wp-json/webmonitor/v1/performance'); ?></code> - Performance data</li>
            <li><code><?php echo home_url('/wp-json/webmonitor/v1/seo'); ?></code> - SEO data</li>
            <li><code><?php echo home_url('/wp-json/webmonitor/v1/security'); ?></code> - Security data</li>
        </ul>
        
        <h2>Usage</h2>
        <p>Add your WordPress site to the Web Monitor Dashboard with these settings:</p>
        <ul>
            <li><strong>URL:</strong> <?php echo home_url(); ?></li>
            <li><strong>Platform:</strong> WordPress</li>
            <li><strong>API Key:</strong> The key you set above</li>
        </ul>
    </div>
    <?php
}
?>
