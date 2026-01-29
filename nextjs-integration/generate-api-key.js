/**
 * Web Monitor API Key Generator
 * 
 * Usage: node generate-api-key.js
 * 
 * Generates a new API key and optionally updates .env.local
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PROJECT_ROOT = process.cwd();

function generateApiKey() {
  return crypto.randomBytes(32).toString('hex');
}

function updateEnvFile(apiKey) {
  const envFile = path.join(PROJECT_ROOT, '.env.local');
  
  let envContent = '';
  
  // Read existing .env.local if it exists
  if (fs.existsSync(envFile)) {
    envContent = fs.readFileSync(envFile, 'utf8');
  }
  
  // Add or update API key
  if (envContent.includes('WEBMONITOR_API_KEY')) {
    envContent = envContent.replace(/WEBMONITOR_API_KEY=.*/, `WEBMONITOR_API_KEY=${apiKey}`);
  } else {
    envContent += `\n# Web Monitor API Key\nWEBMONITOR_API_KEY=${apiKey}\n`;
  }
  
  fs.writeFileSync(envFile, envContent);
  console.log(`✅ Updated .env.local with new API key`);
}

function main() {
  console.log('🔑 Web Monitor API Key Generator\n');
  
  const apiKey = generateApiKey();
  
  console.log(`Generated API Key: ${apiKey}\n`);
  
  // Ask if user wants to update .env.local
  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  rl.question('Update .env.local with this key? (y/n): ', (answer) => {
    if (answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes') {
      updateEnvFile(apiKey);
      console.log('\n✅ Done! Restart your Next.js server to use the new key.');
    } else {
      console.log('\n📋 Copy this key to your .env.local manually:');
      console.log(`   WEBMONITOR_API_KEY=${apiKey}`);
    }
    
    rl.close();
  });
}

main();

