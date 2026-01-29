# WordPress Integration Setup Guide

## 🚀 How to Add WordPress Websites to Web Monitor

### Step 1: Install WordPress Plugin

1. **Download the plugin file** (`web-monitor-api-advanced.php`) from the `wordpress-plugin` folder
2. **Upload to your WordPress site**:
   - Go to your WordPress admin dashboard
   - Navigate to **Plugins > Add New > Upload Plugin**
   - Upload the `web-monitor-api-advanced.php` file
   - Activate the plugin

3. **Configure API Key** (IMPORTANT):
   - Go to **Settings > Web Monitor API**
   - An API key will be automatically generated for you
   - **COPY THIS KEY** - you'll need it to add the site to your dashboard
   - (Optional) Enter your Web Monitor Dashboard URL
   - Click **Save Changes**

### Step 2: Add WordPress Site to Web Monitor

#### Option A: Via Frontend (Recommended)
1. Open your Web Monitor Dashboard at `http://localhost:5173`
2. Add your WordPress site using one of these methods:
   
   **Using curl command:**
   ```bash
   curl -X POST http://localhost:5000/api/websites \
     -H "Content-Type: application/json" \
     -d '{
       "name": "My WordPress Site",
       "url": "https://yoursite.com",
       "platform": "wordpress",
       "apiKey": "PASTE_API_KEY_FROM_WORDPRESS_HERE"
     }'
   ```
   
   **Using the add-your-wordpress-site.js script:**
   ```bash
   # Edit the script with your site details and API key
   node add-your-wordpress-site.js
   ```
   
   When adding, use:
   - **Name**: Your WordPress site name
   - **URL**: Your WordPress site URL (e.g., `https://yoursite.com`)
   - **Platform**: `wordpress`
   - **API Key**: The key you copied from WordPress Settings

#### Option B: Using the Helper Script

Edit `add-your-wordpress-site.js` with your details:
```javascript
const WORDPRESS_SITE = {
  name: 'Your Site Name',
  url: 'https://yoursite.com',
  platform: 'wordpress',
  apiKey: 'YOUR_API_KEY_FROM_WORDPRESS' // Paste from WordPress Settings
};
```

Then run:
```bash
node add-your-wordpress-site.js
```

### Step 3: Test the Connection

1. **Test from Web Monitor Dashboard**:
   - Click on your WordPress site
   - The dashboard will automatically test the connection
   - You should see live data from your WordPress site

2. **Test manually**:
   ```bash
   curl -H "Authorization: Bearer YOUR_API_KEY_FROM_WORDPRESS" \
        https://yoursite.com/wp-json/webmonitor-advanced/v1/health
   ```

## 📊 What Data You'll See

### Health Status
- **Uptime**: Site availability percentage
- **Response Time**: How fast your site responds
- **Database Status**: WordPress database health
- **Memory Usage**: Server memory utilization
- **Plugin Health**: Status of active plugins

### Analytics Data
- **Visitors**: Number of site visitors
- **Page Views**: Total page views
- **Bounce Rate**: Percentage of single-page visits
- **Session Duration**: Average time spent on site
- **Top Pages**: Most visited pages
- **Traffic Sources**: Where visitors come from
- **Device Types**: Desktop, mobile, tablet usage

### Performance Metrics
- **Load Time**: Page loading speed
- **Page Size**: Total page size
- **Request Count**: Number of HTTP requests
- **Cache Hit Rate**: Caching effectiveness
- **Database Queries**: Number of DB queries

### SEO Data
- **SEO Score**: Overall SEO health
- **Meta Tags**: Status of meta descriptions
- **Sitemap**: XML sitemap status
- **Robots.txt**: Search engine directives
- **SEO Issues**: Identified SEO problems

### Security Information
- **Security Score**: Overall security health
- **SSL Status**: SSL certificate validity
- **Plugin Updates**: Available plugin updates
- **Core Updates**: WordPress core updates
- **Security Alerts**: Security-related notifications

## 🔧 Advanced Configuration

### Custom API Endpoints

The plugin provides these **authenticated** endpoints:
- `/wp-json/webmonitor-advanced/v1/health` - Health check
- `/wp-json/webmonitor-advanced/v1/analytics` - Analytics data
- `/wp-json/webmonitor-advanced/v1/performance` - Performance metrics
- `/wp-json/webmonitor-advanced/v1/seo` - SEO data
- `/wp-json/webmonitor-advanced/v1/security` - Security information
- `/wp-json/webmonitor-advanced/v1/plugins` - Plugin information

**Note:** All endpoints require authentication with the API key set in WordPress Settings.

### Customizing Data

You can modify the plugin to:
- Add custom metrics
- Integrate with Google Analytics
- Connect to other monitoring tools
- Add custom security checks

## 🛠️ Troubleshooting

### Common Issues

1. **API Key Not Working**:
   - Check the API key in WordPress admin
   - Ensure the key matches in Web Monitor
   - Verify the Authorization header format

2. **CORS Errors**:
   - The plugin includes CORS headers
   - Check if your WordPress site allows cross-origin requests
   - Verify the API endpoints are accessible

3. **No Data Showing**:
   - Check if the plugin is activated
   - Verify the API endpoints are working
   - Check WordPress error logs

4. **Slow Response Times**:
   - Check server performance
   - Verify database optimization
   - Check for plugin conflicts

### Debug Commands

```bash
# Test health endpoint (with authentication)
curl -H "Authorization: Bearer YOUR_API_KEY_FROM_WORDPRESS" \
     https://yoursite.com/wp-json/webmonitor-advanced/v1/health

# Test analytics endpoint
curl -H "Authorization: Bearer YOUR_API_KEY_FROM_WORDPRESS" \
     https://yoursite.com/wp-json/webmonitor-advanced/v1/analytics

# Check if API key is required (should fail without key)
curl https://yoursite.com/wp-json/webmonitor-advanced/v1/health

# Check WordPress REST API
curl https://yoursite.com/wp-json/
```

## 📈 Real-time Monitoring

Once set up, your WordPress site will be automatically monitored:

- **Health checks** every 60 seconds
- **Performance monitoring** in real-time
- **Security scanning** for vulnerabilities
- **Analytics collection** for insights
- **Alert notifications** for issues

## 🎯 Next Steps

1. **Add multiple WordPress sites** to monitor
2. **Set up alerts** for critical issues
3. **Configure monitoring intervals** based on your needs
4. **Integrate with other platforms** (Next.js, Laravel, etc.)
5. **Set up automated reporting** for stakeholders

## 🔒 Security Best Practices

1. **Use strong API keys** (at least 32 characters)
2. **Rotate API keys** regularly
3. **Limit API access** to trusted IPs
4. **Monitor API usage** for anomalies
5. **Keep WordPress updated** for security patches

## 📞 Support

If you encounter issues:
1. Check the WordPress error logs
2. Verify the plugin is properly installed
3. Test the API endpoints manually
4. Check the Web Monitor backend logs
5. Ensure proper CORS configuration

Your WordPress site is now fully integrated with Web Monitor and will provide real-time insights into its performance, security, and analytics!
