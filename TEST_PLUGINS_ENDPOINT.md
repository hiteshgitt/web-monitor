# Testing Plugins Endpoint

## Current Issue
The plugins endpoint is returning 401 Unauthorized, meaning the API key validation is still failing.

## To Fix:

1. **Open WordPress Admin**: http://localhost/widma/wp-admin
2. **Go to**: Settings → Web Monitor API
3. **Copy the API key** shown on that page
4. **Test with the correct key**:

```bash
curl -H "Authorization: Bearer YOUR_ACTUAL_API_KEY_FROM_WORDPRESS" \
     http://localhost/widma/wp-json/webmonitor-advanced/v1/plugins
```

## Expected Response:

Should return:
```json
{
  "active_plugins": [...],
  "inactive_plugins": [...],
  "outdated_plugins": [...],
  "total_plugins": 42,
  "active_count": 42,
  "inactive_count": 0,
  "outdated_count": 0
}
```

## Quick Steps:

1. Get API key from WordPress Settings
2. The key you used in the Dashboard (2sohSUeOgnXape3sxRA51vWSTFHqRa7h) - verify it's correct
3. Check if plugin is activated
4. Check backend logs for errors

## Alternative: Check Directly in Database

```bash
# Via PHP CLI
cd /var/www/html/widma
wp option get webmonitor_api_key
```

Or use the TEST_API_KEY.php file I created earlier!

