const axios = require('axios');

// Test different API key formats and approaches
const WORDPRESS_URL = 'http://localhost/widma';
const API_KEYS = [
  'wm_my_wordpress_blog_mh4nnf3p_eb920731d619f9e38a0be62a45baa598',
  'test123',
  'my_api_key',
  'webmonitor_key_2024'
];

async function testApiKey(apiKey) {
  console.log(`\n🧪 Testing API Key: ${apiKey.substring(0, 20)}...`);
  
  try {
    const response = await axios.get(`${WORDPRESS_URL}/wp-json/webmonitor/v1/health`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`
      },
      timeout: 10000
    });
    
    console.log('✅ SUCCESS! API key is working!');
    console.log(`   Status: ${response.data.status}`);
    console.log(`   Response: ${JSON.stringify(response.data, null, 2)}`);
    return true;
  } catch (error) {
    if (error.response && error.response.status === 401) {
      console.log('❌ API key not recognized');
      console.log(`   Error: ${error.response.data.message}`);
    } else {
      console.log('❌ Connection error');
      console.log(`   Error: ${error.message}`);
    }
    return false;
  }
}

async function testWithoutAuth() {
  console.log('\n🧪 Testing without authentication...');
  
  try {
    const response = await axios.get(`${WORDPRESS_URL}/wp-json/webmonitor/v1/health`, {
      timeout: 10000
    });
    
    console.log('✅ SUCCESS! No authentication required');
    console.log(`   Response: ${JSON.stringify(response.data, null, 2)}`);
    return true;
  } catch (error) {
    if (error.response && error.response.status === 401) {
      console.log('✅ Authentication is required (as expected)');
      return false;
    } else {
      console.log('❌ Unexpected error');
      console.log(`   Error: ${error.message}`);
      return false;
    }
  }
}

async function main() {
  console.log('🔍 Testing WordPress API Key Setup...');
  console.log(`🌐 WordPress URL: ${WORDPRESS_URL}`);
  
  // Test without authentication first
  await testWithoutAuth();
  
  // Test different API keys
  let workingKey = null;
  for (const apiKey of API_KEYS) {
    const isWorking = await testApiKey(apiKey);
    if (isWorking) {
      workingKey = apiKey;
      break;
    }
  }
  
  console.log('\n📊 Test Results:');
  if (workingKey) {
    console.log('🎉 Found working API key!');
    console.log(`   Key: ${workingKey}`);
    console.log('\n📋 Next steps:');
    console.log('1. Use this working API key in your WordPress admin');
    console.log('2. Add your site to Web Monitor Dashboard');
    console.log('3. Start monitoring your WordPress site!');
  } else {
    console.log('❌ No working API keys found');
    console.log('\n🔧 Troubleshooting:');
    console.log('1. Check if the API key is saved in WordPress admin');
    console.log('2. Verify the plugin is activated');
    console.log('3. Try setting a simple API key like "test123"');
    console.log('4. Check WordPress error logs');
  }
}

main().catch(console.error);
