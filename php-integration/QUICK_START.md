# PHP Integration - Quick Start Guide

## ✅ Yes, Common Code Works for All!

The `WebMonitorAPI.php` class is **shared** across all PHP frameworks:
- ✅ Laravel
- ✅ CodeIgniter (3.x & 4.x)
- ✅ Core PHP

Each framework just needs its own **controller/routes** to use the common class.

---

## 🚀 Installation (3 Easy Steps)

### Method 1: Automated Installation (Recommended)

**From your PHP project root:**

```bash
cd /path/to/your/php-project
node /var/www/html/SAP\ Analytics/php-integration/install.js
```

That's it! The script will:
1. ✅ Auto-detect your framework
2. ✅ Copy the right files
3. ✅ Generate API key
4. ✅ Configure routes
5. ✅ Update .env file

### Method 2: Manual Installation

#### For Laravel Projects

1. **Copy files:**
   ```bash
   cp php-integration/common/WebMonitorAPI.php app/Http/Controllers/
   cp php-integration/laravel/WebMonitorController.php app/Http/Controllers/
   ```

2. **Add route** in `routes/api.php`:
   ```php
   Route::prefix('webmonitor')->group(function () {
       Route::get('/{endpoint}', [App\Http\Controllers\WebMonitorController::class, 'handle']);
   });
   ```

3. **Set API key** in `.env`:
   ```env
   WEBMONITOR_API_KEY=your_generated_api_key_here
   ```

4. **Generate API key:**
   ```bash
   node php-integration/generate-api-key.js
   ```

#### For CodeIgniter 4 Projects

1. **Copy files:**
   ```bash
   cp php-integration/common/WebMonitorAPI.php app/Controllers/
   cp php-integration/codeigniter/WebMonitorController.php app/Controllers/
   ```

2. **Add route** in `app/Config/Routes.php`:
   ```php
   $routes->get('api/webmonitor/(:segment)', 'WebMonitorController::handle/$1');
   ```

3. **Set API key** in `.env`:
   ```env
   WEBMONITOR_API_KEY=your_generated_api_key_here
   ```

#### For Core PHP Projects

1. **Copy files:**
   ```bash
   mkdir -p api
   cp php-integration/common/WebMonitorAPI.php api/
   cp php-integration/core-php/webmonitor.php api/
   ```

2. **Configure web server:**

   **Apache (.htaccess):**
   ```apache
   RewriteEngine On
   RewriteCond %{REQUEST_FILENAME} !-f
   RewriteCond %{REQUEST_FILENAME} !-d
   RewriteRule ^api/webmonitor/(.*)$ api/webmonitor.php?endpoint=$1 [QSA,L]
   ```

   **Nginx:**
   ```nginx
   location /api/webmonitor/ {
       try_files $uri $uri/ /api/webmonitor.php?endpoint=$uri;
   }
   ```

3. **Set API key** in `.env` or `config.php`:
   ```php
   $_ENV['WEBMONITOR_API_KEY'] = 'your_generated_api_key_here';
   ```

---

## 🧪 Testing

After installation, test the endpoint:

```bash
curl http://your-site.com/api/webmonitor/health \
  -H "Authorization: Bearer YOUR_API_KEY"
```

Expected response:
```json
{
  "status": "healthy",
  "timestamp": "2025-01-01T12:00:00+00:00",
  "uptime": 99.9,
  "response_time": 12.5,
  "php_version": "8.2.0",
  "framework": "Laravel",
  "framework_version": "10.0.0"
}
```

---

## 📋 Available Endpoints

All frameworks support the same endpoints:

- `GET /api/webmonitor/health` - Health check
- `GET /api/webmonitor/analytics` - Analytics data
- `GET /api/webmonitor/performance` - Performance metrics
- `GET /api/webmonitor/seo` - SEO information
- `GET /api/webmonitor/security` - Security status
- `GET /api/webmonitor/packages` - Composer packages (Laravel/CodeIgniter)

---

## 🔑 Generating API Key

If you need to generate a new API key:

```bash
node php-integration/generate-api-key.js
```

This will:
- Generate a secure random key
- Show it to you
- Auto-update `.env` if it exists

---

## ❓ Troubleshooting

### 404 Not Found
- ✅ Check routes are configured correctly
- ✅ Verify file paths are correct
- ✅ Restart PHP server/web server

### 401 Unauthorized
- ✅ Verify API key in `.env` matches dashboard
- ✅ Check Authorization header: `Bearer YOUR_KEY`
- ✅ Ensure no extra spaces in API key

### Class Not Found
- ✅ Verify `WebMonitorAPI.php` is in correct location
- ✅ Check require path in controller
- ✅ Ensure autoloader includes the class

---

## 📝 Next Steps

1. ✅ Install integration in your PHP project
2. ✅ Test the health endpoint
3. ✅ Add site to Web Monitor Dashboard:
   - URL: Your site URL
   - Platform: Laravel/CodeIgniter/PHP
   - API Key: From `.env` file

That's it! Your PHP site will now be monitored. 🎉

