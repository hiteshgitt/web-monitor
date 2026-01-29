# 🔧 How to Fix Missing API Key

## Problem
The API key is not showing in WordPress settings page.

## Solution
You need to reactivate the plugin to generate the API key automatically.

### Steps:

1. **Go to WordPress Admin → Plugins**

2. **Find "Web Monitor API (Advanced)" plugin**

3. **Deactivate and Reactivate**:
   - Click "Deactivate"
   - Wait 2 seconds
   - Click "Activate"

4. **Or Just Reactivate**:
   - If already active, click "Deactivate"
   - Then click "Activate"

### After Reactivation:

1. **Go to**: Settings → Web Monitor API

2. **You should now see**:
   ```
   ┌─────────────────────────────────────────┐
   │  Current API Key:                        │
   │  ┌───────────────────────────────────┐ │
   │  │ abc123def456ghi789...              │ │
   │  └───────────────────────────────────┘ │
   │  Click to copy                          │
   └─────────────────────────────────────────┘
   [Generate New API Key]
   ```

3. **Copy the key** (click on it to copy)

4. **Use in Dashboard** when adding your website

---

## Why This Happens

The plugin auto-generates an API key on activation. If you installed the plugin before I added the activation hook, it didn't generate a key.

By reactivating:
- ✅ Activation hook runs
- ✅ API key is auto-generated
- ✅ Key appears in settings

---

## Quick Fix

### Via Plugin File (if you have access):

Add this to the top of your plugin:
```php
// Auto-generate on activation
register_activation_hook(__FILE__, function() {
    $api_key = get_option('webmonitor_api_key');
    if (empty($api_key)) {
        $api_key = wp_generate_password(32, false);
        update_option('webmonitor_api_key', $api_key);
    }
});
```

### Or Manually Generate (via WordPress):

1. Install the updated plugin file
2. Reactivate it
3. Key will be generated automatically

---

## After Reactivation

1. Go to **Settings → Web Monitor API**
2. **API Key should appear** in a blue box
3. Click on the key to copy it
4. Go to your Dashboard
5. Add website with this key
6. ✅ Connection successful!

---

## Verification

To check if key exists:

1. Go to Settings → Web Monitor API
2. You should see the API key displayed
3. If you see an empty space or nothing → Reactivate plugin
4. If you see a long random string → ✅ Ready to use!

---

The plugin file has been updated to auto-generate keys on activation. Just reactivate and you'll be ready to go!

