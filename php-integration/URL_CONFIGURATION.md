# URL Configuration Guide

## Problem: "API endpoint not found" (404)

If you're getting a 404 error, the URL in your dashboard might be incorrect.

### Step 1: Find Your Correct Laravel URL

The URL depends on how your Laravel app is configured:

#### Option A: Laravel in Root Directory
If your Laravel `public` folder is the web root:
- **URL:** `http://your-domain.com` or `http://192.168.x.x`
- **Example:** `http://192.168.2.66`

#### Option B: Laravel in Subdirectory
If Laravel is in a subdirectory (e.g., `/var/www/html/siu-dubai`):
- **URL:** `http://your-domain.com/siu-dubai/public` or use Apache virtual host
- **Example:** `http://192.168.2.66/siu-dubai/public`

#### Option C: Using Laravel's Built-in Server (Development)
- **URL:** `http://localhost:8000` or `http://127.0.0.1:8000`
- **Start server:** `php artisan serve`

### Step 2: Test the URL

Test the health endpoint directly:

```bash
# Replace with your actual URL
curl http://YOUR_LARAVEL_URL/api/webmonitor/health \
  -H "Authorization: Bearer YOUR_API_KEY"
```

**Expected response:** JSON with `{"status": "healthy", ...}`

**If you get HTML 404:** The URL is wrong or Apache isn't routing correctly.

### Step 3: Check Apache Configuration

If using Apache, ensure it's configured to route to Laravel's `public` folder:

**Apache Virtual Host Example:**
```apache
<VirtualHost *:80>
    ServerName your-domain.com
    DocumentRoot /var/www/html/siu-dubai/public
    
    <Directory /var/www/html/siu-dubai/public>
        AllowOverride All
        Require all granted
    </Directory>
</VirtualHost>
```

### Step 4: Common URL Mistakes

❌ **Wrong:**
- `http://localhost/api/webmonitor/packages` (if accessing from different machine)
- `http://127.0.0.1` (if Laravel is in subdirectory)
- `http://your-domain.com/public/api/webmonitor/packages` (if public is web root)

✅ **Correct:**
- `http://192.168.2.66/api/webmonitor/packages` (actual IP/domain)
- `http://your-domain.com/api/webmonitor/packages` (if public is web root)
- `http://localhost:8000/api/webmonitor/packages` (if using Laravel serve)

### Step 5: Update Dashboard URL

1. Go to your Web Monitor Dashboard
2. Edit the website entry
3. Update the URL to match your actual Laravel URL
4. Save and test again

### Step 6: Verify Route is Accessible

From your Laravel project root:
```bash
php artisan route:list | grep webmonitor
```

Should show:
```
GET|HEAD   api/webmonitor/{endpoint} ........... WebMonitorController@handle
```

### Troubleshooting

**If still getting 404:**

1. **Check if Laravel is running:**
   ```bash
   php artisan serve
   # Then test: curl http://localhost:8000/api/webmonitor/health
   ```

2. **Check Apache/Web Server logs:**
   ```bash
   tail -f /var/log/apache2/error.log
   ```

3. **Verify public/.htaccess exists:**
   ```bash
   ls -la public/.htaccess
   ```

4. **Test with full path:**
   ```bash
   curl http://YOUR_IP/siu-dubai/public/api/webmonitor/health \
     -H "Authorization: Bearer YOUR_API_KEY"
   ```

### Quick Test Script

Create a test file to verify your setup:

```bash
# Save as test-webmonitor.sh
#!/bin/bash
URL="http://YOUR_LARAVEL_URL"
API_KEY="YOUR_API_KEY"

echo "Testing: $URL/api/webmonitor/health"
curl -s "$URL/api/webmonitor/health" \
  -H "Authorization: Bearer $API_KEY" | head -20

echo -e "\n\nTesting: $URL/api/webmonitor/packages"
curl -s "$URL/api/webmonitor/packages" \
  -H "Authorization: Bearer $API_KEY" | head -20
```

Run it:
```bash
chmod +x test-webmonitor.sh
./test-webmonitor.sh
```

