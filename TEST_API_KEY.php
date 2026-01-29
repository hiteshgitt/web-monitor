<?php
/**
 * Test API Key Validation
 * 
 * This file helps debug API key issues
 * Upload to WordPress root directory and access via: http://yoursite.com/TEST_API_KEY.php
 */

// Load WordPress
require_once('wp-load.php');

echo "<h1>API Key Test</h1>";

// Get stored API key
$stored_key = get_option('webmonitor_api_key');
echo "<h2>1. Stored API Key</h2>";
if (empty($stored_key)) {
    echo "<p style='color: red;'>❌ No API key found in database!</p>";
    echo "<p>Generating a new key...</p>";
    $stored_key = wp_generate_password(32, false);
    update_option('webmonitor_api_key', $stored_key);
    echo "<p style='color: green;'>✅ New key generated and saved</p>";
} else {
    echo "<p style='color: green;'>✅ API key exists</p>";
}
echo "<p><strong>Key (first 20 chars):</strong> " . substr($stored_key, 0, 20) . "...</p>";
echo "<p><strong>Full Key:</strong> <code>" . esc_html($stored_key) . "</code></p>";

// Test the API endpoint
echo "<h2>2. Test API Endpoint</h2>";
$site_url = home_url();
$test_url = $site_url . '/wp-json/webmonitor-advanced/v1/health';

echo "<p><strong>Test URL:</strong> " . $test_url . "</p>";

// Try with valid key
$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, $test_url);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, array(
    'Authorization: Bearer ' . $stored_key
));
$response = curl_exec($ch);
$http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

echo "<p><strong>Response Code:</strong> " . $http_code . "</p>";

if ($http_code == 200) {
    echo "<p style='color: green;'>✅ API key works! Connection successful.</p>";
    echo "<pre>" . htmlspecialchars($response) . "</pre>";
} else {
    echo "<p style='color: red;'>❌ API key failed! Response code: " . $http_code . "</p>";
    echo "<pre>" . htmlspecialchars($response) . "</pre>";
}

// Show copy button for API key
echo "<h2>3. Copy API Key</h2>";
echo "<div style='background: #f5f5f5; padding: 20px; border-radius: 8px;'>";
echo "<strong>Click to copy this key:</strong>";
echo "<p id='api_key' style='padding: 15px; background: white; border: 2px solid #2271b1; border-radius: 5px; font-family: monospace; font-size: 13px; cursor: pointer;' onclick='this.select(); document.execCommand(\"copy\"); alert(\"API key copied!\")'>" . esc_html($stored_key) . "</p>";
echo "</div>";

echo "<h2>4. Instructions</h2>";
echo "<ol>";
echo "<li>Copy the API key above</li>";
echo "<li>Go to your Web Monitor Dashboard</li>";
echo "<li>Click 'Add New Website'</li>";
echo "<li>Enter your WordPress URL: <code>" . $site_url . "</code></li>";
echo "<li>Paste the API key</li>";
echo "<li>Click 'Add Website'</li>";
echo "</ol>";

?>

