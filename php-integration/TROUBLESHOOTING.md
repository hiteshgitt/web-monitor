# PHP Integration Troubleshooting Guide

## Common Issues and Solutions

### 1. "Failed to load packages" Error

#### Issue
The dashboard shows: "Failed to load packages. Ensure the API key is valid and PHP server is running."

#### Solutions

**A. Check the URL in Dashboard**
- ❌ **Wrong**: `http://localhost` (if accessing from different machine/network)
- ✅ **Correct**: Use the actual domain name or IP address
  - Example: `http://192.168.1.100` or `http://your-domain.com`
  - Or: `http://localhost:8000` if using Laravel's built-in server

**B. Verify Laravel Route is Working**
```bash
# From your Laravel project root
php artisan route:list | grep webmonitor
```

Should show:
```
GET|HEAD   api/webmonitor/{endpoint} ........... WebMonitorController@handle
```

**C. Test the Endpoint Directly**
```bash
# Replace with your actual site URL
curl http://your-site.com/api/webmonitor/packages \
  -H "Authorization: Bearer YOUR_API_KEY"
```

**D. Check API Key**
1. Verify `.env` has the API key:
   ```bash
   grep WEBMONITOR_API_KEY .env
   ```
2. Ensure it matches the API key in the dashboard
3. Restart Laravel server after changing `.env`:
   ```bash
   php artisan config:clear
   php artisan cache:clear
   ```

**E. Check Laravel Server Status**
- If using `php artisan serve`, ensure it's running on the correct port
- If using Apache/Nginx, ensure virtual host is configured correctly
- Check Laravel logs: `storage/logs/laravel.log`

### 2. 404 Not Found Error

#### Possible Causes:
1. **Wrong URL**: Using `localhost` when you should use actual IP/domain
2. **Route not registered**: Routes not properly configured
3. **Server not running**: Laravel/PHP server is down

#### Solutions:
```bash
# 1. Check if route exists
php artisan route:list | grep webmonitor

# 2. Clear route cache
php artisan route:clear
php artisan config:clear

# 3. Test with actual URL (not localhost)
curl http://192.168.1.100/api/webmonitor/health \
  -H "Authorization: Bearer YOUR_API_KEY"
```

### 3. 401 Unauthorized Error

#### Issue
Authentication fails even with correct API key.

#### Solutions:
1. **Check `.env` file**:
   ```bash
   grep WEBMONITOR_API_KEY .env
   ```
   Should match the key in dashboard.

2. **Clear Laravel config cache**:
   ```bash
   php artisan config:clear
   php artisan cache:clear
   ```

3. **Restart Laravel server** after changing `.env`

4. **Verify Authorization header format**:
   ```
   Authorization: Bearer YOUR_API_KEY
   ```
   (Note: "Bearer" with capital B, space after it)

### 4. CORS Errors

#### Issue
Browser shows CORS errors when accessing the API.

#### Solution:
The `WebMonitorController` already includes CORS headers. If you still see errors:
1. Check if middleware is blocking requests
2. Verify `Access-Control-Allow-Origin: *` header is present
3. For Laravel, ensure CORS middleware is configured in `config/cors.php`

### 5. Class Not Found Error

#### Issue
Laravel can't find `WebMonitorAPI` class.

#### Solution:
1. Verify `WebMonitorAPI.php` is in `app/Http/Controllers/`
2. Check the require path in `WebMonitorController.php`:
   ```php
   require_once __DIR__ . '/WebMonitorAPI.php';
   ```
3. Ensure file permissions are correct

### 6. Packages Data Shows Empty

#### Issue
Packages endpoint returns empty or no data.

#### Solutions:
1. **Check `composer.json` exists**:
   ```bash
   ls -la composer.json
   ```

2. **Verify file permissions**:
   ```bash
   chmod 644 composer.json
   ```

3. **Check Laravel logs**:
   ```bash
   tail -f storage/logs/laravel.log
   ```

### 7. Network/Connection Issues

#### Issue
Backend can't reach PHP server.

#### Solutions:
1. **Use correct URL**:
   - If backend and PHP server on same machine: `http://localhost` or `http://127.0.0.1`
   - If on different machines: Use actual IP address or domain
   - Example: `http://192.168.1.100` or `http://your-domain.com`

2. **Check firewall**:
   ```bash
   # Check if port is accessible
   telnet YOUR_IP 80
   # or
   curl http://YOUR_IP/api/webmonitor/health
   ```

3. **Verify server is running**:
   ```bash
   # For Laravel built-in server
   ps aux | grep "php artisan serve"
   
   # For Apache
   systemctl status apache2
   
   # For Nginx
   systemctl status nginx
   ```

## Testing Checklist

✅ **Route is registered**: `php artisan route:list | grep webmonitor`  
✅ **API key in `.env`**: `grep WEBMONITOR_API_KEY .env`  
✅ **Server is running**: Check with `curl` or browser  
✅ **URL is correct**: Use actual domain/IP, not `localhost` if accessing remotely  
✅ **File permissions**: `WebMonitorAPI.php` and `WebMonitorController.php` are readable  
✅ **No PHP errors**: Check `storage/logs/laravel.log`  
✅ **CORS headers**: Present in response headers  

## Quick Test Commands

```bash
# 1. Test health endpoint
curl http://YOUR_URL/api/webmonitor/health \
  -H "Authorization: Bearer YOUR_API_KEY"

# 2. Test packages endpoint
curl http://YOUR_URL/api/webmonitor/packages \
  -H "Authorization: Bearer YOUR_API_KEY"

# 3. Check Laravel routes
php artisan route:list | grep webmonitor

# 4. Check Laravel logs
tail -f storage/logs/laravel.log

# 5. Clear Laravel caches
php artisan config:clear
php artisan route:clear
php artisan cache:clear
```

## Still Having Issues?

1. **Check backend logs**: Look at backend server console for detailed error messages
2. **Check Laravel logs**: `storage/logs/laravel.log`
3. **Verify URL in dashboard**: Must match the actual accessible URL
4. **Test endpoint directly**: Use `curl` to test if endpoint works before trying from dashboard

