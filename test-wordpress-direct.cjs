const axios = require('axios');

const WORDPRESS_URL = 'http://localhost/widma';

async function testWordPressDirect() {
  console.log('🧪 Testing WordPress Direct Connection...');
  console.log(`🌐 WordPress URL: ${WORDPRESS_URL}`);
  
  try {
    // Test basic WordPress API
    console.log('\n1️⃣ Testing basic WordPress API...');
    const wpResponse = await axios.get(`${WORDPRESS_URL}/wp-json/wp/v2/posts?per_page=1`);
    console.log('✅ WordPress API is working');
    console.log(`   Status: ${wpResponse.status}`);
    
    // Test Web Monitor plugin endpoints
    console.log('\n2️⃣ Testing Web Monitor plugin endpoints...');
    const pluginResponse = await axios.get(`${WORDPRESS_URL}/wp-json/webmonitor/v1/`);
    console.log('✅ Web Monitor plugin is active');
    console.log(`   Available endpoints: ${Object.keys(pluginResponse.data.routes).length}`);
    
    // Test health endpoint without auth
    console.log('\n3️⃣ Testing health endpoint without authentication...');
    try {
      const healthResponse = await axios.get(`${WORDPRESS_URL}/wp-json/webmonitor/v1/health`);
      console.log('⚠️  Health endpoint accessible without authentication');
      console.log(`   Response: ${JSON.stringify(healthResponse.data, null, 2)}`);
    } catch (error) {
      if (error.response && error.response.status === 401) {
        console.log('✅ Health endpoint requires authentication (as expected)');
      } else {
        console.log('❌ Unexpected error:', error.message);
      }
    }
    
    // Test with different API keys
    console.log('\n4️⃣ Testing different API keys...');
    const apiKeys = [
      'test123',
      'wm_my_wordpress_blog_mh4nnf3p_eb920731d619f9e38a0be62a45baa598',
      'my_api_key',
      'webmonitor_key'
    ];
    
    for (const apiKey of apiKeys) {
      try {
        const response = await axios.get(`${WORDPRESS_URL}/wp-json/webmonitor/v1/health`, {
          headers: {
            'Authorization': `Bearer ${apiKey}`
          }
        });
        console.log(`✅ API key working: ${apiKey.substring(0, 20)}...`);
        console.log(`   Response: ${JSON.stringify(response.data, null, 2)}`);
        break;
      } catch (error) {
        if (error.response && error.response.status === 401) {
          console.log(`❌ API key not working: ${apiKey.substring(0, 20)}...`);
        } else {
          console.log(`❌ Error with API key ${apiKey.substring(0, 20)}...: ${error.message}`);
        }
      }
    }
    
  } catch (error) {
    console.log('❌ WordPress connection failed');
    console.log(`   Error: ${error.message}`);
  }
}

testWordPressDirect();
