#!/usr/bin/env node

/**
 * Generate API Key for PHP Integration
 */

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

function generateApiKey() {
  return crypto.randomBytes(32).toString('hex');
}

const apiKey = generateApiKey();

console.log('🔑 Generated API Key:');
console.log(apiKey);
console.log('\n📝 Add this to your .env file:');
console.log(`WEBMONITOR_API_KEY=${apiKey}\n`);

// Try to auto-update .env if found
let projectRoot = process.cwd();
if (path.basename(projectRoot) === 'php-integration') {
  projectRoot = path.dirname(projectRoot);
}

const envPath = path.join(projectRoot, '.env');
if (fs.existsSync(envPath)) {
  let envContent = fs.readFileSync(envPath, 'utf8');
  const lines = envContent.split('\n');
  let found = false;
  
  const updatedLines = lines.map(line => {
    if (line.startsWith('WEBMONITOR_API_KEY=')) {
      found = true;
      return `WEBMONITOR_API_KEY=${apiKey}`;
    }
    return line;
  });
  
  if (!found) {
    updatedLines.push(`WEBMONITOR_API_KEY=${apiKey}`);
  }
  
  fs.writeFileSync(envPath, updatedLines.join('\n'));
  console.log('✅ Auto-updated .env file');
} else {
  console.log('⚠️  .env file not found. Please add the key manually.');
}

