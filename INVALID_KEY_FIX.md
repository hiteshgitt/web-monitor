# 🔧 Fixing "Invalid API Key" Issue

## Why This Happens

1. **API key not generated** in WordPress database
2. **API key format mismatch** (extra spaces, wrong encoding)
3. **Plugin not activated** or updated
4. **Headers not being sent** properly

## Solutions

### Solution 1: Test API Key

1. **Upload the test file** to WordPress root:
   - File: `TEST_API_KEY.php`
   - Upload to: `/var/www/html/widma/TEST_API_KEY.php`

2. **Access it**:
   ```
   http://localhost/widma/TEST_API_KEY.php
   ```

3. **What it does**:
   - Shows your API key
   - Tests the key with WordPress API
   - Shows if key works
   - Lets you copy the key

### Solution 2: Generate API Key Manually

1. **Get current key from database**:
   ```php
   $key = get_option('webmonitor_api_key');
   echo $key; // Shows the key
   ```

2. **Or generate new key**:
   ```php
   $new_key = wp_generate_password(32, false);
   update_option('webmonitor_api_key', $new_key);
   echo "New key: " . $new_key;
   ```

### Solution 3: Reactivate Plugin

1. **Go to Plugins**
2. **Deactivate** "Web Monitor API (Advanced)"
3. **Activate** again
4. **Go to Settings → Web Monitor API**
5. API key should be visible now

### Solution 4: Update Plugin File

The plugin file has been updated with:
- Better header parsing
- Debug logging
- Improved error messages

1. **Upload updated plugin**
2. **Deactivate and reactivate**
3. **API key will be visible**

## Debugging Steps

### Step 1: Check if Key Exists
```php
// Add to wp-config.php temporarily
$api_key = get_option('webmonitor_api_key');
error_log('API Key: ' . $api_key);
```

### Step 2: Check WordPress Logs
```bash
tail -f /var/www/html/widma/wp-content/debug.log
```

Look for:
```
Stored API Key: ...
Received API Key: ...
Keys match: YES/NO
```

### Step 3: Test Manually
```bash
# Get your API key from WordPress
# Then test:
curl -H "Authorization: Bearer YOUR_API_KEY" \
     http://localhost/widma/wp-json/webmonitor-advanced/v1/health
```

## Common Issues

### Issue 1: Empty API Key
**Symptom**: "Invalid key" but key looks correct

**Solution**: 
1. Generate new key using TEST_API_KEY.php
2. Or reactivate plugin

### Issue 2: Key Has Extra Spaces
**Symptom**: Copy/paste includes spaces

**Solution**: 
- Make sure no leading/trailing spaces
- Key should be exactly 32 characters
- No line breaks

### Issue 3: Plugin Not Activated
**Symptom**: 404 error when testing endpoint

**Solution**:
1. Make sure plugin is activated
2. Check: Plugins → Web Monitor API (Advanced) = Active

### Issue 4: Wrong URL
**Symptom**: Connection refused

**Solution**:
- Use correct WordPress URL
- Include http:// or https://
- No trailing slash
- Example: http://localhost/widma

## Updated Features

### Better Validation
- ✅ Improved header parsing
- ✅ Debug logging added
- ✅ Clearer error messages
- ✅ Better error handling

### Debug Logs
The plugin now logs:
```
Stored API Key: abc123...
Received API Key: xyz789...
Keys match: NO
```

Check logs at:
```bash
tail -f /var/www/html/widma/wp-content/debug.log
```

## Quick Fix Checklist

1. ✅ Plugin activated?
2. ✅ API key visible in Settings?
3. ✅ Copy key exactly (no spaces)?
4. ✅ WordPress URL correct?
5. ✅ Test with TEST_API_KEY.php?

## Test the Key

Use the test file I created:

1. **Upload** `TEST_API_KEY.php` to WordPress root
2. **Access**: http://localhost/widma/TEST_API_KEY.php
3. **Copy** the displayed API key
4. **Use in Dashboard** when adding website

The test file will:
- Show your API key
- Test if it works
- Let you copy it easily

## Still Not Working?

1. **Check WordPress logs** for debug messages
2. **Verify plugin is activated**
3. **Try generating new key** via test file
4. **Test endpoint manually** with curl
5. **Check browser console** for errors

The plugin has been updated with better debugging and error messages!

