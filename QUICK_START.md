# 🚀 Quick Start Guide - Adding Websites with Authentication

## What I Fixed

1. ✅ **Added "Add Website" Modal** - Now you can add websites directly from the UI
2. ✅ **Implemented API Key Authentication** - WordPress plugin now requires and validates API keys
3. ✅ **Real Data from WordPress** - Backend fetches actual data from your WordPress sites
4. ✅ **Fixed CORS Issues** - Backend now allows connections from frontend

---

## 🎯 How to Use

### Step 1: Install WordPress Plugin

1. Copy `wordpress-plugin/web-monitor-api-advanced.php` to your WordPress site
2. Upload and activate the plugin
3. Go to **WordPress Admin → Settings → Web Monitor API**
4. **Copy the API key** shown on that page

### Step 2: Add Website in the App

1. **Start the backend server** (if not running):
   ```bash
   cd backend
   npm install
   npm run dev
   ```

2. **Start the frontend** (if not running):
   ```bash
   npm install
   npm run dev
   ```

3. Open the app at `http://localhost:5173`

4. Click **"Add New Website"** button

5. Fill in the form:
   - **Website Name**: Your site name
   - **Website URL**: Your WordPress site URL (e.g., `https://mysite.com`)
   - **Platform**: WordPress
   - **API Key**: Paste the key you copied from WordPress Settings

6. Click **"Add Website"**

### Step 3: Monitor Your Website

- Click on your website card to view the dashboard
- See real-time data from your WordPress site
- All data is fetched securely using the API key

---

## 🔧 Troubleshooting

### Problem: "Add Website" button doesn't work

**Solution:** Make sure both backend and frontend are running:
```bash
# Terminal 1 - Backend
cd backend && npm run dev

# Terminal 2 - Frontend
npm run dev
```

### Problem: Getting "Connection failed" error

**Solution:** 
1. Check that the backend is running on port 5000
2. Check the browser console for errors
3. Verify MongoDB is running

### Problem: WordPress data not showing

**Solution:**
1. Verify the API key is correct (go to WordPress Settings)
2. Test the WordPress endpoint manually:
   ```bash
   curl -H "Authorization: Bearer YOUR_API_KEY" \
        https://yoursite.com/wp-json/webmonitor-advanced/v1/health
   ```
3. Check that the plugin is activated in WordPress

### Problem: "Invalid API key" error

**Solution:**
1. Go to WordPress Settings → Web Monitor API
2. Copy the API key exactly (no spaces)
3. Update the website with the correct key in the app

---

## 📝 Quick Test

Test your WordPress connection:

```bash
# 1. Get API key from WordPress Settings
# 2. Test the connection
curl -H "Authorization: Bearer YOUR_API_KEY" \
     https://yoursite.com/wp-json/webmonitor-advanced/v1/health

# Should return health data from WordPress
```

---

## 🎉 What's New

### ✅ Add Website Modal
- Beautiful UI for adding websites
- Form validation
- Clear instructions for getting API keys
- Error handling

### ✅ Authentication
- WordPress plugin generates secure API keys
- All endpoints require authentication
- Invalid keys return 401 error

### ✅ Real Data
- Backend fetches actual data from WordPress
- No more static/demo data
- Updates in real-time

### ✅ Better UX
- Clear error messages
- Loading states
- Smooth transitions

---

## 🔐 Security

- All endpoints require API key authentication
- Keys are stored securely in WordPress and MongoDB
- CORS is properly configured
- Rate limiting enabled on backend

---

## 📚 Next Steps

1. Add multiple websites
2. Monitor all sites from one dashboard
3. View detailed analytics
4. Get security alerts
5. Use AI insights

Your Web Monitor is now fully functional with authentication! 🎉

