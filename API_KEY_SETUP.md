# API Key Setup Guide

## 🔑 How to Get Your API Key

### Quick Answer: Use One of These Generated Keys

**Copy one of these API keys for immediate use:**

```
wm_my_wordpress_blog_mh4nnf3p_eb920731d619f9e38a0be62a45baa598
wm_company_website_mh4nnf3q_8e247e8ee26c213119dcc07967117c53
wm_e-commerce_store_mh4nnf3q_fad2ab9e7f4aeed16cb48783a0e181a1
wm_mysite_mh4nnf3r_2334ada0fa489ea9fbaf5336f9fec131
```

## 📋 Step-by-Step Setup

### Step 1: Set API Key in WordPress

1. **Go to your WordPress Admin Dashboard**
2. **Navigate to Settings → Web Monitor API**
3. **Paste one of the API keys above** in the "API Key" field
4. **Click "Save Changes"**

### Step 2: Add Site to Web Monitor Dashboard

1. **Open your Web Monitor Dashboard** at `http://localhost:3000`
2. **Click "Add New Website"**
3. **Fill in the details:**
   - **Name**: Your WordPress site name (e.g., "My Blog")
   - **URL**: Your WordPress site URL (e.g., `https://yoursite.com`)
   - **Platform**: WordPress
   - **API Key**: Use the same key you set in WordPress

### Step 3: Test the Connection

1. **Click on your WordPress site** in the dashboard
2. **The system will automatically test the connection**
3. **You should see live data from your WordPress site**

## 🔧 Alternative: Create Your Own API Key

If you want to create your own API key:

### Simple API Key Examples:
```
my_secure_wordpress_key_2024
webmonitor_api_key_abc123
my_site_monitoring_key_xyz789
```

### How to Create:
1. Use letters, numbers, and underscores
2. Make it at least 20-30 characters long
3. Include your site name or year
4. Keep it secure

## 🧪 Test Your Setup

### Test WordPress API:
```bash
curl -H "Authorization: Bearer YOUR_API_KEY" \
     https://yoursite.com/wp-json/webmonitor/v1/health
```

### Test Backend API:
```bash
curl http://localhost:5000/api/health
```

## 🔒 Security Notes

- **Keep your API key secure** - don't share it publicly
- **Use different keys** for different sites
- **Change keys regularly** for better security
- **Don't commit keys** to version control

## 🚨 Troubleshooting

### Common Issues:

1. **"Invalid API key" error**:
   - Check if the key matches exactly in both places
   - Ensure there are no extra spaces or characters

2. **"API key required" error**:
   - Make sure you've set the API key in WordPress
   - Check if the plugin is activated

3. **Connection failed**:
   - Verify your WordPress site URL is correct
   - Check if the plugin is working

### Debug Steps:

1. **Check WordPress plugin**:
   - Go to Settings → Web Monitor API
   - Verify the API key is saved

2. **Test API endpoint**:
   - Visit: `https://yoursite.com/wp-json/webmonitor/v1/health`
   - You should see a JSON response

3. **Check backend server**:
   - Make sure backend is running on port 5000
   - Test: `curl http://localhost:5000/api/health`

## 🎯 Quick Start

**For immediate testing, use this API key:**
```
wm_mysite_mh4nnf3r_2334ada0fa489ea9fbaf5336f9fec131
```

1. Set this key in WordPress Admin → Settings → Web Monitor API
2. Add your site to Web Monitor Dashboard with the same key
3. Test the connection

You're all set! Your WordPress site will now provide data to your Web Monitor Dashboard.
