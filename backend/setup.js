const mongoose = require('mongoose');
const Website = require('./models/Website');
require('dotenv').config({ path: './config.env' });

// Sample data to populate the database
const sampleWebsites = [
  {
    name: 'WordPress Portal',
    url: 'https://portal.company.com',
    platform: 'wordpress',
    apiKey: 'your_wordpress_api_key_here',
    status: 'healthy',
    uptime: 99.9,
    responseTime: 245,
    monitoringEnabled: true,
    settings: {
      checkInterval: 60000,
      timeout: 10000,
      alertThresholds: {
        responseTime: 5000,
        uptime: 95
      }
    },
    analytics: {
      totalVisitors: 12450,
      totalPageViews: 45620,
      bounceRate: 42.3,
      avgSessionDuration: 225,
      seoScore: 85,
      securityScore: 92
    }
  },
  {
    name: 'Next.js E-Commerce',
    url: 'https://shop.company.com',
    platform: 'nextjs',
    apiKey: 'your_nextjs_api_key_here',
    status: 'warning',
    uptime: 98.2,
    responseTime: 312,
    monitoringEnabled: true,
    settings: {
      checkInterval: 60000,
      timeout: 10000,
      alertThresholds: {
        responseTime: 5000,
        uptime: 95
      }
    },
    analytics: {
      totalVisitors: 8920,
      totalPageViews: 32150,
      bounceRate: 38.7,
      avgSessionDuration: 198,
      seoScore: 78,
      securityScore: 88
    }
  },
  {
    name: 'Laravel API',
    url: 'https://api.company.com',
    platform: 'laravel',
    apiKey: 'your_laravel_api_key_here',
    status: 'healthy',
    uptime: 99.7,
    responseTime: 189,
    monitoringEnabled: true,
    settings: {
      checkInterval: 60000,
      timeout: 10000,
      alertThresholds: {
        responseTime: 5000,
        uptime: 95
      }
    },
    analytics: {
      totalVisitors: 15680,
      totalPageViews: 67890,
      bounceRate: 35.2,
      avgSessionDuration: 267,
      seoScore: 92,
      securityScore: 95
    }
  },
  {
    name: 'CodeIgniter Analytics',
    url: 'https://analytics.company.com',
    platform: 'codeigniter',
    apiKey: 'your_codeigniter_api_key_here',
    status: 'healthy',
    uptime: 99.5,
    responseTime: 267,
    monitoringEnabled: true,
    settings: {
      checkInterval: 60000,
      timeout: 10000,
      alertThresholds: {
        responseTime: 5000,
        uptime: 95
      }
    },
    analytics: {
      totalVisitors: 5430,
      totalPageViews: 18920,
      bounceRate: 45.1,
      avgSessionDuration: 156,
      seoScore: 73,
      securityScore: 89
    }
  }
];

async function setupDatabase() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/webmonitor', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    
    console.log('Connected to MongoDB');
    
    // Check if there are existing websites
    const existingCount = await Website.countDocuments({});
    
    if (existingCount > 0) {
      console.log(`⚠️  Found ${existingCount} existing website(s) in database.`);
      console.log('⚠️  Skipping sample data insertion to preserve your existing websites.');
      console.log('⚠️  If you want to reset with sample data, delete all websites first.');
      return;
    }
    
    // Only insert sample data if database is empty
    console.log('Database is empty. Inserting sample data...');
    const websites = await Website.insertMany(sampleWebsites);
    console.log(`Inserted ${websites.length} sample websites`);
    
    console.log('Database setup completed successfully!');
    console.log('\nSample websites created:');
    websites.forEach(website => {
      console.log(`- ${website.name} (${website.platform}) - ${website.url}`);
    });
    
  } catch (error) {
    console.error('Error setting up database:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\nDatabase connection closed');
  }
}

// Run setup if this file is executed directly
if (require.main === module) {
  setupDatabase();
}

module.exports = setupDatabase;
