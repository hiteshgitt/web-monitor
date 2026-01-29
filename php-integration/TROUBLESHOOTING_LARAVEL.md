# Laravel Troubleshooting Guide

## Error: "API endpoint not found" (404)

This error means Laravel is returning a 404 page (HTML) instead of JSON. The route is not being found.

### Step 1: Verify Installation

Run the verification script from your Laravel project root:

```bash
node /var/www/html/SAP\ Analytics/php-integration/verify-installation.js
```

This will check:
- ✅ Controller files exist
- ✅ Routes are configured
- ✅ API key is set

### Step 2: Check Routes Are Registered

```bash
# From your Laravel project root
php artisan route:list | grep webmonitor
```

If you see nothing, the routes are not loaded.

### Step 3: Verify API Routes Are Enabled

Laravel API routes need to be enabled. Check `app/Providers/RouteServiceProvider.php`:

```php
public function boot()
{
    // Make sure this line exists:
    $this->routes(function () {
        Route::middleware('api')
            ->prefix('api')
            ->group(base_path('routes/api.php'));
    });
}
```

### Step 4: Check routes/api.php

Open `routes/api.php` and verify it contains:

```php
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\WebMonitorController;

Route::prefix('webmonitor')->group(function () {
    Route::get('/{endpoint}', [WebMonitorController::class, 'handle']);
});
```

**Important:** The route must be INSIDE the `Route::middleware('api')` group if your RouteServiceProvider uses it.

### Step 5: Clear Route Cache

```bash
php artisan route:clear
php artisan cache:clear
php artisan config:clear
```

### Step 6: Check Controller File Path

Verify the controller exists:
```bash
ls -la app/Http/Controllers/WebMonitorController.php
ls -la app/Http/Controllers/WebMonitorAPI.php
```

### Step 7: Test Directly

Test the endpoint directly (replace with your URL and API key):

```bash
curl http://your-laravel-url/api/webmonitor/health \
  -H "Authorization: Bearer YOUR_API_KEY"
```

Expected response: JSON with `{"status": "healthy", ...}`

If you get HTML (404 page), the route is not registered.

### Step 8: Check Web Server Configuration

If using Apache, ensure `.htaccess` is working:

```bash
# Test if .htaccess is being read
curl -I http://your-laravel-url/api/webmonitor/health
```

If using Nginx, ensure proper rewrite rules are configured.

### Step 9: Manual Route Installation

If automatic installation didn't work, manually add to `routes/api.php`:

```php
<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\WebMonitorController;

// ... existing routes ...

// Web Monitor API Routes
Route::prefix('webmonitor')->group(function () {
    Route::get('/{endpoint}', [WebMonitorController::class, 'handle']);
});
```

### Step 10: Check Laravel Version

Some older Laravel versions require different route syntax:

**Laravel 8+ (Recommended):**
```php
Route::get('/{endpoint}', [WebMonitorController::class, 'handle']);
```

**Laravel 7 and below:**
```php
Route::get('/{endpoint}', 'WebMonitorController@handle');
```

### Common Issues

1. **Routes not in api.php**: Make sure routes are in `routes/api.php`, not `routes/web.php`
2. **Route cache**: Clear route cache after adding routes
3. **Middleware**: Check if API middleware is blocking requests
4. **URL prefix**: Make sure your Laravel app URL matches (e.g., if in subdirectory, use full path)

### Still Not Working?

1. Check Laravel logs: `storage/logs/laravel.log`
2. Enable debug mode in `.env`: `APP_DEBUG=true`
3. Check browser/backend console for detailed error messages
4. Verify the URL in the dashboard matches your actual Laravel URL

