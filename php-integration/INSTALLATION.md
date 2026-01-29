# PHP Integration Installation Guide

## Quick Install

Run from your PHP project root:

```bash
node /path/to/SAP\ Analytics/php-integration/install.js
```

The script will:
- Auto-detect your framework (Laravel, CodeIgniter, or Core PHP)
- Install the appropriate files
- Generate an API key
- Configure environment variables

## Manual Installation

### Laravel

1. **Copy Files:**
   ```bash
   cp php-integration/common/WebMonitorAPI.php app/Http/Controllers/
   cp php-integration/laravel/WebMonitorController.php app/Http/Controllers/
   ```

2. **Update Controller:**
   Edit `app/Http/Controllers/WebMonitorController.php` and ensure the require path is correct:
   ```php
   require_once __DIR__ . '/WebMonitorAPI.php';
   ```

3. **Add Route** in `routes/api.php`:
   ```php
   Route::prefix('webmonitor')->group(function () {
       Route::get('/{endpoint}', [App\Http\Controllers\WebMonitorController::class, 'handle']);
   });
   ```

4. **Set API Key** in `.env`:
   ```env
   WEBMONITOR_API_KEY=your_generated_api_key_here
   ```

5. **Generate API Key:**
   ```bash
   node php-integration/generate-api-key.js
   ```

### CodeIgniter 4

1. **Copy Files:**
   ```bash
   cp php-integration/common/WebMonitorAPI.php app/Controllers/
   cp php-integration/codeigniter/WebMonitorController.php app/Controllers/
   ```

2. **Update Controller:**
   Edit `app/Controllers/WebMonitorController.php` and ensure the require path is correct:
   ```php
   require_once __DIR__ . '/WebMonitorAPI.php';
   ```

3. **Add Route** in `app/Config/Routes.php`:
   ```php
   $routes->get('api/webmonitor/(:segment)', 'WebMonitorController::handle/$1');
   ```

4. **Set API Key** in `.env`:
   ```env
   WEBMONITOR_API_KEY=your_generated_api_key_here
   ```

### Core PHP

1. **Copy Files:**
   ```bash
   mkdir -p api
   cp php-integration/common/WebMonitorAPI.php api/
   cp php-integration/core-php/webmonitor.php api/
   ```

2. **Configure Web Server:**

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

3. **Set API Key** in `.env` or `config.php`:
   ```php
   $_ENV['WEBMONITOR_API_KEY'] = 'your_generated_api_key_here';
   ```

## Testing

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
  ...
}
```

## Available Endpoints

- `GET /api/webmonitor/health` - Health check
- `GET /api/webmonitor/analytics` - Analytics data
- `GET /api/webmonitor/performance` - Performance metrics
- `GET /api/webmonitor/seo` - SEO information
- `GET /api/webmonitor/security` - Security status
- `GET /api/webmonitor/packages` - Composer packages (Laravel/CodeIgniter)

## Troubleshooting

### 404 Not Found
- Check your routes are configured correctly
- Verify the API endpoint path
- Check web server configuration

### 401 Unauthorized
- Verify API key is set in `.env`
- Check the Authorization header format: `Bearer YOUR_KEY`
- Ensure API key matches in dashboard

### Class Not Found
- Verify `WebMonitorAPI.php` is in the correct location
- Check the require path in your controller
- Ensure autoloader includes the class

