# API Authentication Setup Guide

## 🔐 Complete Authentication Flow

This guide explains how to set up secure authentication between your WordPress sites and the Web Monitor Dashboard.

## Overview

The authentication works with **API Keys**:
1. **WordPress Plugin** generates/stores an API key in WordPress settings
2. **WordPress Plugin** validates requests using this API key
3. **Web Monitor Dashboard** stores the same API key when adding a website
4. **Backend** uses this key to authenticate requests to WordPress

---

## 🚀 Step-by-Step Setup

### Step 1: Install and Configure WordPress Plugin

#### 1.1 Install the Plugin
1. Copy `wordpress-plugin/web-monitor-api-advanced.php` to your WordPress site
2. Upload to WordPress:
   - WordPress Admin → Plugins → Add New → Upload Plugin
   - Choose the file and install
   - Click **Activate**

#### 1.2 Configure API Key
1. Go to **WordPress Admin → Settings → Web Monitor API**
2. You'll see:
   - A pre-generated API key (copy this!)
   - Option to enter your Web Monitor Dashboard URL
3. Click **Save Changes**
4. **IMPORTANT:** Copy the API key shown on this page - you'll need it in Step 2

---

### Step 2: Add Website to Web Monitor Dashboard

#### Option A: Via Backend API (Recommended for Testing)

```bash
# Test adding a WordPress site
curl -X POST http://localhost:5000/api/websites \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My WordPress Site",
    "url": "https://yoursite.com",
    "platform": "wordpress",
    "apiKey": "YOUR_API_KEY_FROM_WORDPRESS_HERE"
  }'
```

#### Option B: Via Frontend Script

1. Edit `add-your-wordpress-site.js` or create a similar script:

```javascript
const WORDPRESS_SITE = {
  name: 'My WordPress Site',
  url: 'https://yoursite.com',
  platform: 'wordpress',
  apiKey: 'YOUR_API_KEY_FROM_WORDPRESS_HERE' // Copy from WordPress Settings
};

const API_BASE_URL = 'http://localhost:5000/api';

async function addWordPressSite() {
  const response = await axios.post(`${API_BASE_URL}/websites`, WORDPRESS_SITE);
  console.log('Site added:', response.data);
}

addWordPressSite();
```

2. Run the script:
```bash
node add-your-wordpress-site.js
```

#### Option C: Via Frontend UI (Coming Soon)

The UI modal for adding websites is being implemented.

---

### Step 3: Verify Authentication

#### Test 1: Check WordPress Plugin is Working

```bash
# This should return your API key
curl https://yoursite.com/wp-json/webmonitor-advanced/v1/health \
  -H "Authorization: Bearer YOUR_API_KEY"
```

✅ **Expected:** Should return health data  
❌ **If blocked:** Authentication is working! Without the correct key, you'll get a 401 error.

#### Test 2: Test from Dashboard

1. Open your dashboard
2. Click on the added website
3. You should see data loading from WordPress

---

## 🔒 How Authentication Works

### WordPress Plugin Side

1. **Settings Storage:**
   ```php
   // Stores API key in WordPress options
   update_option('webmonitor_api_key', 'your_api_key_here');
   ```

2. **Request Validation:**
   ```php
   function webmonitor_advanced_validate_api_key($request) {
     $stored_api_key = get_option('webmonitor_api_key');
     $api_key = $request->get_header('authorization'); // Bearer token
     
     if ($api_key === $stored_api_key) {
       return true; // Request authorized
     }
     
     return new WP_Error('rest_forbidden', 'Invalid API key', array('status' => 401));
   }
   ```

3. **Protected Endpoints:**
   - `/wp-json/webmonitor-advanced/v1/health`
   - `/wp-json/webmonitor-advanced/v1/analytics`
   - `/wp-json/webmonitor-advanced/v1/performance`
   - `/wp-json/webmonitor-advanced/v1/seo`
   - `/wp-json/webmonitor-advanced/v1/security`
   - `/wp-json/webmonitor-advanced/v1/plugins`

### Backend Server Side

1. **Sending Requests:**
   ```javascript
   const response = await axios.get(`${website.url}/wp-json/webmonitor-advanced/v1/health`, {
     headers: {
       'Authorization': `Bearer ${website.apiKey}` // From database
     }
   });
   ```

2. **Website Storage:**
   ```javascript
   const website = {
     name: 'My Site',
     url: 'https://yoursite.com',
     platform: 'wordpress',
     apiKey: 'stored_api_key_from_wordpress' // Matches WordPress key
   };
   ```

---

## 🛠️ Security Best Practices

1. **Use Strong API Keys**
   - At least 32 characters
   - Mix of letters, numbers, and symbols
   - WordPress auto-generates secure keys

2. **Keep Keys Secret**
   - Never commit API keys to version control
   - Use environment variables in production
   - Rotate keys periodically

3. **Use HTTPS**
   - Always use HTTPS for WordPress sites
   - Never send API keys over HTTP
   - WordPress enforces HTTPS when available

4. **Limit Access**
   - Only share API keys with trusted parties
   - Monitor API usage for anomalies
   - Set up IP whitelisting if needed

---

## 📝 Example: Complete Setup Flow

### Complete Setup Example

```javascript
// 1. Get API key from WordPress Settings
const apiKey = 'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6'; // From WordPress

// 2. Add website to backend
const site = {
  name: 'My Blog',
  url: 'https://myblog.com',
  platform: 'wordpress',
  apiKey: apiKey
};

// 3. Backend calls WordPress with the key
fetch('https://myblog.com/wp-json/webmonitor-advanced/v1/health', {
  headers: {
    'Authorization': `Bearer ${apiKey}`
  }
});

// 4. WordPress validates the key
// 5. WordPress returns data if key matches
// 6. Backend stores the data
// 7. Dashboard displays the data
```

---

## 🐛 Troubleshooting

### Problem: "Invalid API key" Error

**Solution:**
1. Check WordPress Settings → Web Monitor API
2. Verify the API key matches exactly (no extra spaces)
3. Ensure you're using `Authorization: Bearer` header format
4. Check that the API key was saved in WordPress

### Problem: "Unauthorized" Error

**Solution:**
1. Go to WordPress Settings → Web Monitor API
2. Generate a new API key
3. Update the website in Web Monitor Dashboard with the new key
4. Test the connection again

### Problem: No Data Showing in Dashboard

**Solution:**
1. Test WordPress endpoints directly with curl:
   ```bash
   curl https://yoursite.com/wp-json/webmonitor-advanced/v1/health \
     -H "Authorization: Bearer YOUR_API_KEY"
   ```
2. Check backend logs for errors
3. Verify the backend is running on the correct port
4. Ensure MongoDB is running and connected

### Problem: Plugin Settings Page Not Showing

**Solution:**
1. Verify the plugin is activated
2. Clear browser cache
3. Check file permissions on the plugin file
4. Look for PHP errors in WordPress debug.log

---

## ✅ Quick Checklist

- [ ] WordPress plugin installed and activated
- [ ] API key configured in WordPress Settings
- [ ] API key copied from WordPress
- [ ] Website added to Web Monitor with API key
- [ ] Test connection successful
- [ ] Data appearing in dashboard
- [ ] HTTPS enabled on WordPress site (recommended)

---

## 📚 Additional Resources

- [WordPress Plugin Documentation](../wordpress-plugin/web-monitor-api-advanced.php)
- [Backend API Documentation](../backend/README.md)
- [API Routes](../backend/routes/websites.js)

---

## 🎯 Summary

The authentication system is now secure:

1. ✅ WordPress plugin generates and stores API key
2. ✅ Plugin validates all requests with this key
3. ✅ Web Monitor Dashboard stores the same key
4. ✅ Backend sends requests with the key
5. ✅ Only requests with matching keys are authorized

Your WordPress sites are now properly secured and only accessible with the correct API key!

