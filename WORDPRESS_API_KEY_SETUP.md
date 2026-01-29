# WordPress API Key Setup - Troubleshooting Guide

## 🔍 Current Status

✅ **WordPress Site**: `http://localhost/widma` is accessible  
✅ **WordPress REST API**: Working properly  
✅ **Web Monitor Plugin**: Installed and active  
❌ **API Key**: Not properly configured  

## 🔧 How to Fix the API Key Issue

### Step 1: Access WordPress Admin

1. **Open your browser** and go to: `http://localhost/widma/wp-admin/`
2. **Log in** to your WordPress admin dashboard

### Step 2: Configure the Web Monitor Plugin

1. **Go to Settings** → **Web Monitor API**
2. **Set the API Key** to: `wm_my_wordpress_blog_mh4nnf3p_eb920731d619f9e38a0be62a45baa598`
3. **Click "Save Changes"**

### Step 3: Verify the Setup

After saving the API key, test it with this command:

```bash
curl -H "Authorization: Bearer wm_my_wordpress_blog_mh4nnf3p_eb920731d619f9e38a0be62a45baa598" \
     http://localhost/widma/wp-json/webmonitor/v1/health
```

You should see a JSON response with health data instead of an error.

### Step 4: Add to Web Monitor Dashboard

Once the API key is working, add your site to the dashboard:

```bash
node add-your-wordpress-site.cjs
```

## 🚨 Alternative: Check Plugin Installation

If you don't see "Web Monitor API" in Settings:

### Option 1: Re-upload the Plugin
1. **Download** the plugin file: `wordpress-plugin/web-monitor-api.php`
2. **Go to** Plugins → Add New → Upload Plugin
3. **Upload** the file again
4. **Activate** the plugin

### Option 2: Manual Plugin Installation
1. **Create a folder** in your WordPress plugins directory: `/wp-content/plugins/web-monitor-api/`
2. **Upload** the `web-monitor-api.php` file to that folder
3. **Activate** the plugin from the Plugins page

## 🧪 Test Commands

### Test WordPress API (should work):
```bash
curl http://localhost/widma/wp-json/
```

### Test Web Monitor Plugin (should work after API key setup):
```bash
curl -H "Authorization: Bearer wm_my_wordpress_blog_mh4nnf3p_eb920731d619f9e38a0be62a45baa598" \
     http://localhost/widma/wp-json/webmonitor/v1/health
```

### Test Analytics Endpoint:
```bash
curl -H "Authorization: Bearer wm_my_wordpress_blog_mh4nnf3p_eb920731d619f9e38a0be62a45baa598" \
     http://localhost/widma/wp-json/webmonitor/v1/analytics
```

## 📋 Quick Checklist

- [ ] WordPress site accessible at `http://localhost/widma`
- [ ] WordPress admin accessible at `http://localhost/widma/wp-admin/`
- [ ] Web Monitor plugin installed and activated
- [ ] API key set in Settings → Web Monitor API
- [ ] API key test successful
- [ ] Site added to Web Monitor Dashboard

## 🎯 Next Steps

1. **Fix the API key** in WordPress admin
2. **Test the connection** with the curl commands above
3. **Add the site** to Web Monitor Dashboard
4. **View real-time data** in the dashboard

Once the API key is properly set, your WordPress site will provide comprehensive monitoring data including health status, performance metrics, analytics, SEO data, and security information!
