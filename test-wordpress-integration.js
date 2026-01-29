const axios = require('axios');

// Test configuration
const BACKEND_URL = 'http://localhost:5000/api';
const WORDPRESS_URL = 'https://your-wordpress-site.com'; // Replace with your WordPress site URL
const API_KEY = 'your_secure_api_key_here'; // Replace with your API key

async function testBackendAPI() {
  console.log('🧪 Testing Backend API...');
  
  try {
    const response = await axios.get(`${BACKEND_URL}/health`);
    console.log('✅ Backend API is running');
    console.log(`   Status: ${response.data.status}`);
    console.log(`   Uptime: ${response.data.uptime}s`);
    return true;
  } catch (error) {
    console.log('❌ Backend API is not running');
    console.log(`   Error: ${error.message}`);
    return false;
  }
}

async function testWordPressAPI() {
  console.log('\n🧪 Testing WordPress API...');
  
  try {
    const response = await axios.get(`${WORDPRESS_URL}/wp-json/webmonitor/v1/health`, {
      headers: {
        'Authorization': `Bearer ${API_KEY}`
      },
      timeout: 10000
    });
    
    console.log('✅ WordPress API is working');
    console.log(`   Status: ${response.data.status}`);
    console.log(`   Uptime: ${response.data.uptime}%`);
    console.log(`   Response Time: ${response.data.response_time}ms`);
    return true;
  } catch (error) {
    console.log('❌ WordPress API is not working');
    console.log(`   Error: ${error.message}`);
    console.log(`   Status: ${error.response?.status}`);
    return false;
  }
}

async function testWordPressAnalytics() {
  console.log('\n🧪 Testing WordPress Analytics...');
  
  try {
    const response = await axios.get(`${WORDPRESS_URL}/wp-json/webmonitor/v1/analytics`, {
      headers: {
        'Authorization': `Bearer ${API_KEY}`
      },
      timeout: 10000
    });
    
    console.log('✅ WordPress Analytics is working');
    console.log(`   Visitors: ${response.data.visitors}`);
    console.log(`   Page Views: ${response.data.page_views}`);
    console.log(`   Bounce Rate: ${response.data.bounce_rate}%`);
    return true;
  } catch (error) {
    console.log('❌ WordPress Analytics is not working');
    console.log(`   Error: ${error.message}`);
    return false;
  }
}

async function testWordPressPerformance() {
  console.log('\n🧪 Testing WordPress Performance...');
  
  try {
    const response = await axios.get(`${WORDPRESS_URL}/wp-json/webmonitor/v1/performance`, {
      headers: {
        'Authorization': `Bearer ${API_KEY}`
      },
      timeout: 10000
    });
    
    console.log('✅ WordPress Performance is working');
    console.log(`   Load Time: ${response.data.load_time}ms`);
    console.log(`   Page Size: ${response.data.page_size}KB`);
    console.log(`   Requests: ${response.data.requests}`);
    return true;
  } catch (error) {
    console.log('❌ WordPress Performance is not working');
    console.log(`   Error: ${error.message}`);
    return false;
  }
}

async function testWordPressSEO() {
  console.log('\n🧪 Testing WordPress SEO...');
  
  try {
    const response = await axios.get(`${WORDPRESS_URL}/wp-json/webmonitor/v1/seo`, {
      headers: {
        'Authorization': `Bearer ${API_KEY}`
      },
      timeout: 10000
    });
    
    console.log('✅ WordPress SEO is working');
    console.log(`   SEO Score: ${response.data.score}/100`);
    console.log(`   Issues: ${response.data.issues.length}`);
    return true;
  } catch (error) {
    console.log('❌ WordPress SEO is not working');
    console.log(`   Error: ${error.message}`);
    return false;
  }
}

async function testWordPressSecurity() {
  console.log('\n🧪 Testing WordPress Security...');
  
  try {
    const response = await axios.get(`${WORDPRESS_URL}/wp-json/webmonitor/v1/security`, {
      headers: {
        'Authorization': `Bearer ${API_KEY}`
      },
      timeout: 10000
    });
    
    console.log('✅ WordPress Security is working');
    console.log(`   Security Score: ${response.data.score}/100`);
    console.log(`   Alerts: ${response.data.alerts.length}`);
    return true;
  } catch (error) {
    console.log('❌ WordPress Security is not working');
    console.log(`   Error: ${error.message}`);
    return false;
  }
}

async function main() {
  console.log('🚀 Testing WordPress Integration...\n');
  
  const tests = [
    testBackendAPI,
    testWordPressAPI,
    testWordPressAnalytics,
    testWordPressPerformance,
    testWordPressSEO,
    testWordPressSecurity
  ];
  
  let passedTests = 0;
  
  for (const test of tests) {
    const result = await test();
    if (result) passedTests++;
  }
  
  console.log('\n📊 Test Results:');
  console.log(`✅ Passed: ${passedTests}/${tests.length}`);
  console.log(`❌ Failed: ${tests.length - passedTests}/${tests.length}`);
  
  if (passedTests === tests.length) {
    console.log('\n🎉 All tests passed! Your WordPress integration is working perfectly!');
    console.log('🌐 Open your Web Monitor Dashboard to see the data');
  } else {
    console.log('\n⚠️  Some tests failed. Please check the setup and try again.');
  }
}

// Run the tests
if (require.main === module) {
  main().catch(console.error);
}

module.exports = {
  testBackendAPI,
  testWordPressAPI,
  testWordPressAnalytics,
  testWordPressPerformance,
  testWordPressSEO,
  testWordPressSecurity
};
