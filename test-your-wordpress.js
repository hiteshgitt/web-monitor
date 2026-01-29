const axios = require('axios');

// Your configuration
const WORDPRESS_URL = 'http://localhost/widma'; // Your WordPress site URL
const API_KEY = 'wm_my_wordpress_blog_mh4nnf3p_eb920731d619f9e38a0be62a45baa598';

async function testWordPressConnection() {
  console.log('🧪 Testing your WordPress site connection...');
  console.log(`🌐 WordPress URL: ${WORDPRESS_URL}`);
  console.log(`🔑 API Key: ${API_KEY.substring(0, 20)}...`);
  console.log('');

  try {
    // Test health endpoint
    console.log('1️⃣ Testing health endpoint...');
    const healthResponse = await axios.get(`${WORDPRESS_URL}/wp-json/webmonitor/v1/health`, {
      headers: {
        'Authorization': `Bearer ${API_KEY}`
      },
      timeout: 10000
    });
    
    console.log('✅ Health endpoint working!');
    console.log(`   Status: ${healthResponse.data.status}`);
    console.log(`   Uptime: ${healthResponse.data.uptime}%`);
    console.log(`   Response Time: ${healthResponse.data.response_time}ms`);
    console.log('');

    // Test analytics endpoint
    console.log('2️⃣ Testing analytics endpoint...');
    const analyticsResponse = await axios.get(`${WORDPRESS_URL}/wp-json/webmonitor/v1/analytics`, {
      headers: {
        'Authorization': `Bearer ${API_KEY}`
      },
      timeout: 10000
    });
    
    console.log('✅ Analytics endpoint working!');
    console.log(`   Visitors: ${analyticsResponse.data.visitors}`);
    console.log(`   Page Views: ${analyticsResponse.data.page_views}`);
    console.log(`   Bounce Rate: ${analyticsResponse.data.bounce_rate}%`);
    console.log('');

    console.log('🎉 Your WordPress site is ready for Web Monitor!');
    console.log('');
    console.log('📋 Next steps:');
    console.log('1. Start your backend server: cd backend && npm run dev');
    console.log('2. Add your site to Web Monitor Dashboard');
    console.log('3. Use the same API key when adding the site');
    
  } catch (error) {
    console.log('❌ Connection test failed!');
    console.log(`   Error: ${error.message}`);
    
    if (error.response) {
      console.log(`   Status: ${error.response.status}`);
      console.log(`   Response: ${JSON.stringify(error.response.data, null, 2)}`);
    }
    
    console.log('');
    console.log('🔧 Troubleshooting:');
    console.log('1. Make sure your WordPress site URL is correct');
    console.log('2. Verify the plugin is activated');
    console.log('3. Check if the API key is set correctly');
    console.log('4. Ensure your site is accessible');
  }
}

// Run the test
testWordPressConnection();
