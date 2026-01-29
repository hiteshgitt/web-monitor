const axios = require('axios');

// Your WordPress site configuration
const WORDPRESS_SITE = {
  name: 'Widma WordPress Site', // Your site name
  url: 'http://localhost/widma', // Your WordPress site URL
  platform: 'wordpress',
  apiKey: 'wm_my_wordpress_blog_mh4nnf3p_eb920731d619f9e38a0be62a45baa598'
};

const API_BASE_URL = 'http://localhost:5000/api';

async function addWordPressSite() {
  console.log('🚀 Adding your WordPress site to Web Monitor...');
  console.log(`📝 Site Name: ${WORDPRESS_SITE.name}`);
  console.log(`🌐 URL: ${WORDPRESS_SITE.url}`);
  console.log(`🔑 API Key: ${WORDPRESS_SITE.apiKey.substring(0, 20)}...`);
  console.log('');

  try {
    // Add the site to Web Monitor
    console.log('1️⃣ Adding site to Web Monitor...');
    const response = await axios.post(`${API_BASE_URL}/websites`, WORDPRESS_SITE);
    
    console.log('✅ Site added successfully!');
    console.log(`   ID: ${response.data._id}`);
    console.log(`   Name: ${response.data.name}`);
    console.log(`   URL: ${response.data.url}`);
    console.log('');

    // Test the connection
    console.log('2️⃣ Testing connection...');
    const testResponse = await axios.post(`${API_BASE_URL}/websites/${response.data._id}/test`);
    
    console.log('✅ Connection test successful!');
    console.log(`   Status: ${testResponse.data.status}`);
    console.log(`   Response Time: ${testResponse.data.response_time}ms`);
    console.log('');

    console.log('🎉 Your WordPress site is now connected to Web Monitor!');
    console.log('');
    console.log('📊 What you can do now:');
    console.log('1. Open your Web Monitor Dashboard at http://localhost:3000');
    console.log('2. Click on your WordPress site to view its dashboard');
    console.log('3. See real-time data including:');
    console.log('   - Health status and uptime');
    console.log('   - Performance metrics');
    console.log('   - Analytics data');
    console.log('   - SEO information');
    console.log('   - Security alerts');
    console.log('');
    console.log('🔄 The system will automatically monitor your site every 60 seconds');
    
  } catch (error) {
    console.log('❌ Failed to add WordPress site!');
    console.log(`   Error: ${error.message}`);
    
    if (error.response) {
      console.log(`   Status: ${error.response.status}`);
      console.log(`   Response: ${JSON.stringify(error.response.data, null, 2)}`);
    }
    
    console.log('');
    console.log('🔧 Troubleshooting:');
    console.log('1. Make sure your backend server is running: cd backend && npm run dev');
    console.log('2. Check if your WordPress site URL is correct');
    console.log('3. Verify the API key is set correctly in WordPress');
    console.log('4. Ensure your WordPress plugin is activated');
  }
}

// Run the script
addWordPressSite();
