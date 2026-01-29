const crypto = require('crypto');

function generateApiKey(siteName = 'wordpress') {
  // Generate a random string
  const randomString = crypto.randomBytes(16).toString('hex');
  
  // Create a timestamp
  const timestamp = Date.now().toString(36);
  
  // Combine with site name
  const apiKey = `wm_${siteName}_${timestamp}_${randomString}`;
  
  return apiKey;
}

function generateMultipleKeys(sites) {
  const keys = {};
  
  sites.forEach(site => {
    keys[site] = generateApiKey(site.replace(/\s+/g, '_').toLowerCase());
  });
  
  return keys;
}

// Example usage
console.log('🔑 Generated API Keys:');
console.log('');

const sampleSites = ['My WordPress Blog', 'Company Website', 'E-commerce Store'];
const apiKeys = generateMultipleKeys(sampleSites);

Object.entries(apiKeys).forEach(([site, key]) => {
  console.log(`${site}: ${key}`);
});

console.log('');
console.log('📋 How to use these keys:');
console.log('1. Copy one of the keys above');
console.log('2. Go to your WordPress Admin → Settings → Web Monitor API');
console.log('3. Paste the key in the "API Key" field');
console.log('4. Save the settings');
console.log('5. Use the same key when adding the site to Web Monitor Dashboard');

// Generate a single key for immediate use
console.log('');
console.log('🎯 Quick API Key for immediate use:');
console.log(generateApiKey('mysite'));
