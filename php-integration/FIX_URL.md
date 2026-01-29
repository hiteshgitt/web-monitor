# 🔧 Quick Fix: Update Dashboard URL

## Problem
The dashboard shows "Invalid data received from server - expected object" because the URL is wrong.

## Solution

### Option 1: Update via Dashboard UI (Easiest)

1. Go to your Web Monitor Dashboard
2. Find the "sui dubai" website entry
3. Click **Edit** (pencil icon)
4. Change the **URL** field to:
   ```
   http://127.0.0.1:8000
   ```
   (Or use your actual IP if accessing from different machine: `http://YOUR_IP:8000`)
5. **Save** the changes
6. Click **"Click to retry"** in the Packages tab

### Option 2: Update via API

```bash
# First, find the website ID
curl http://localhost:5000/api/websites

# Then update the URL (replace WEBSITE_ID with actual ID)
curl -X PUT http://localhost:5000/api/websites/WEBSITE_ID \
  -H "Content-Type: application/json" \
  -d '{
    "url": "http://127.0.0.1:8000"
  }'
```

### Option 3: Verify Laravel Server is Running

Make sure Laravel server is running on port 8000:

```bash
cd /var/www/html/siu-dubai
php artisan serve --host=0.0.0.0 --port=8000
```

### Test the URL

Test if the URL works:

```bash
curl http://127.0.0.1:8000/api/webmonitor/packages \
  -H "Authorization: Bearer 79428950189c32c6ce50b2c374486ba258d7488e2c98200094e4f3345b954f4d"
```

**Expected:** JSON with packages data  
**If HTML 404:** Wrong URL or server not running

## Current Status

✅ **Port 8000:** Working perfectly (returns JSON)  
❌ **Port 8001:** Returns 404 HTML page  
❌ **No port:** Returns 404 HTML page

## Recommendation

Use: `http://127.0.0.1:8000` (or your IP:8000)

