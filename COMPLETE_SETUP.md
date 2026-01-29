# Complete WordPress Integration Setup Guide

## 🎯 What You Need to Do to Add WordPress Websites

### Step 1: Install WordPress Plugin

1. **Download the plugin file** from `wordpress-plugin/web-monitor-api.php`
2. **Upload to your WordPress site**:
   - Go to WordPress Admin → Plugins → Add New → Upload Plugin
   - Upload the `web-monitor-api.php` file
   - Activate the plugin
3. **Set API Key**:
   - Go to Settings → Web Monitor API
   - Set a secure API key (e.g., `your_secure_api_key_here`)
   - Save settings

### Step 2: Start Backend Server

```bash
# Start MongoDB (if using local)
sudo systemctl start mongodb

# Start backend server
cd backend
npm install
node setup.js
npm run dev
```

### Step 3: Add WordPress Site to Web Monitor

#### Option A: Via Frontend (Easiest)
1. Open Web Monitor Dashboard: `http://localhost:3000`
2. Click **"Add New Website"** button
3. Fill in:
   - **Name**: Your WordPress site name
   - **URL**: Your WordPress site URL
   - **Platform**: WordPress
   - **API Key**: The key you set in WordPress

#### Option B: Via API
```bash
curl -X POST http://localhost:5000/api/websites \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My WordPress Site",
    "url": "https://yoursite.com",
    "platform": "wordpress",
    "apiKey": "your_secure_api_key_here"
  }'
```

#### Option C: Via Script
```bash
# Edit add-wordpress-site.js with your site details
node add-wordpress-site.js
```

### Step 4: Test the Connection

1. **From Dashboard**: Click on your WordPress site to view its dashboard
2. **Manual Test**:
   ```bash
   curl -H "Authorization: Bearer your_secure_api_key_here" \
        https://yoursite.com/wp-json/webmonitor/v1/health
   ```

## 📊 What Data You'll See

### Real-time Data
- **Health Status**: Uptime, response time, database status
- **Performance**: Load time, page size, request count
- **Analytics**: Visitors, page views, bounce rate
- **SEO**: SEO score, meta tags, sitemap status
- **Security**: Security score, SSL status, plugin updates

### Monitoring Features
- **Automatic Health Checks**: Every 60 seconds
- **Real-time Alerts**: For issues and downtime
- **Historical Data**: Store monitoring history
- **Performance Trends**: Track improvements over time

## 🔧 Troubleshooting

### Common Issues

1. **Plugin Not Working**:
   - Check if plugin is activated
   - Verify API key is set correctly
   - Check WordPress error logs

2. **Connection Failed**:
   - Verify WordPress site URL is correct
   - Check if API endpoints are accessible
   - Ensure API key matches

3. **No Data Showing**:
   - Check backend server is running
   - Verify MongoDB connection
   - Check API endpoints manually

### Debug Commands

```bash
# Test WordPress API
curl https://yoursite.com/wp-json/webmonitor/v1/health

# Test backend API
curl http://localhost:5000/api/health

# Check MongoDB
mongosh mongodb://localhost:27017/webmonitor
```

## 🚀 Quick Start Commands

### Start Everything
```bash
# Start full stack
./start-full-stack.sh
```

### Start Backend Only
```bash
# Start backend
./start-backend.sh
```

### Add WordPress Site
```bash
# Add via script
node add-wordpress-site.js
```

## 📈 Next Steps

1. **Add Multiple Sites**: Add all your WordPress sites
2. **Set Up Alerts**: Configure notifications for issues
3. **Monitor Performance**: Track site improvements
4. **Add Other Platforms**: Next.js, Laravel, etc.
5. **Set Up Reporting**: Automated reports for stakeholders

## 🔒 Security Best Practices

1. **Use Strong API Keys**: At least 32 characters
2. **Rotate Keys Regularly**: Change API keys monthly
3. **Limit Access**: Restrict API access to trusted IPs
4. **Monitor Usage**: Watch for unusual API activity
5. **Keep Updated**: Update WordPress and plugins regularly

## 📞 Support

If you need help:
1. Check the setup guides
2. Verify all components are running
3. Test API endpoints manually
4. Check error logs
5. Ensure proper configuration

Your WordPress site is now fully integrated with Web Monitor and will provide real-time insights into its performance, security, and analytics!
