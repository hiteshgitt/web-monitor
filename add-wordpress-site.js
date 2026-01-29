const axios = require('axios');

// Configuration
const API_BASE_URL = 'http://localhost:5000/api';
const WORDPRESS_SITES = [
  {
    name: 'My WordPress Blog',
    url: 'https://your-wordpress-site.com',
    platform: 'wordpress',
    apiKey: 'your_secure_api_key_here'
  },
  {
    name: 'Company Website',
    url: 'https://company-site.com',
    platform: 'wordpress',
    apiKey: 'another_secure_api_key'
  }
];

async function addWordPressSite(siteData) {
  try {
    console.log(`Adding WordPress site: ${siteData.name}`);
    
    const response = await axios.post(`${API_BASE_URL}/websites`, siteData);
    
    console.log(`✅ Successfully added: ${siteData.name}`);
    console.log(`   URL: ${siteData.url}`);
    console.log(`   ID: ${response.data._id}`);
    
    return response.data;
  } catch (error) {
    console.error(`❌ Failed to add ${siteData.name}:`, error.response?.data || error.message);
    return null;
  }
}

async function testWordPressConnection(siteData) {
  try {
    console.log(`Testing connection to: ${siteData.name}`);
    
    const response = await axios.post(`${API_BASE_URL}/websites/${siteData._id}/test`);
    
    console.log(`✅ Connection test successful: ${siteData.name}`);
    console.log(`   Status: ${response.data.status}`);
    console.log(`   Response Time: ${response.data.responseTime}ms`);
    
    return true;
  } catch (error) {
    console.error(`❌ Connection test failed for ${siteData.name}:`, error.response?.data || error.message);
    return false;
  }
}

async function main() {
  console.log('🚀 Adding WordPress Sites to Web Monitor...\n');
  
  const addedSites = [];
  
  for (const siteData of WORDPRESS_SITES) {
    const addedSite = await addWordPressSite(siteData);
    if (addedSite) {
      addedSites.push(addedSite);
    }
    console.log(''); // Empty line for readability
  }
  
  if (addedSites.length > 0) {
    console.log('🧪 Testing connections...\n');
    
    for (const site of addedSites) {
      await testWordPressConnection(site);
      console.log(''); // Empty line for readability
    }
  }
  
  console.log('🎉 WordPress sites setup complete!');
  console.log(`\n📊 Added ${addedSites.length} WordPress sites to Web Monitor`);
  console.log('🌐 Open your Web Monitor Dashboard to see the sites');
  console.log('🔗 Dashboard URL: http://localhost:3000');
}

// Run the script
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { addWordPressSite, testWordPressConnection };
