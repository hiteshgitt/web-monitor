# WordPress Plugin API Key Setup

## How It Works

### 1. Plugin Auto-Generates API Key

When you first install the plugin:
- ✅ Plugin automatically generates a secure 32-character API key
- ✅ Key is stored in WordPress database
- ✅ User **CANNOT** manually change the key
- ✅ Key is read-only (displayed in settings)

### 2. Settings Page

Go to: **WordPress Admin → Settings → Web Monitor API**

You'll see:

```
┌─────────────────────────────────────────────┐
│  Current API Key:                           │
│  ┌─────────────────────────────────────┐   │
│  │ abc123def456ghi789jkl012mno345pqr678 │   │
│  └─────────────────────────────────────┘   │
│  ⚠️ Important: Copy this key now...       │
└─────────────────────────────────────────────┘
[Generate New API Key]
```

### 3. User Actions

#### User CAN:
- ✅ View the API key (in read-only format)
- ✅ Copy the API key
- ✅ Generate a NEW API key (with confirmation)
- ✅ Set the Dashboard URL

#### User CANNOT:
- ❌ Manually edit the API key
- ❌ Type in a custom API key
- ❌ Delete the API key field

### 4. Adding Website to Dashboard

User flow:
1. **WordPress Admin** → Settings → Web Monitor API
2. **Copy** the API key shown
3. **Dashboard** → Add New Website
4. **Paste** the API key in the form
5. ✅ Website connects successfully

### 5. Generating New API Key

If user needs a new key:
1. Click "Generate New API Key" button
2. Confirmation dialog appears
3. Warning shown: "Will invalidate old key"
4. User confirms
5. New key is generated
6. Page reloads with new key
7. User must update it in Dashboard

## Security Features

✅ **Auto-Generated**: Keys are randomly generated
✅ **Read-Only**: User cannot manually edit
✅ **Secure Storage**: Stored in WordPress options
✅ **Permission Checked**: Only admins can generate new keys
✅ **Validation**: All API requests validate against stored key

## Technical Details

### Key Generation
```php
// Auto-generated on first activation
$api_key = wp_generate_password(32, false);
update_option('webmonitor_api_key', $api_key);
```

### Settings Registration
```php
// API key is NOT a registered setting
// This prevents users from saving it manually
register_setting('webmonitor_advanced_settings', 'webmonitor_app_url');
// Note: webmonitor_api_key is NOT registered
```

### AJAX Handler
```php
// Only way to change key
add_action('wp_ajax_webmonitor_generate_new_key', 'webmonitor_generate_new_api_key');
```

## User Instructions

### For WordPress Admins:

1. **Install Plugin**
   - Upload plugin to WordPress
   - Activate plugin

2. **Go to Settings**
   - Navigate to: Settings → Web Monitor API
   - API key is automatically generated

3. **Copy API Key**
   - Click and select the entire key
   - Copy to clipboard

4. **Add to Dashboard**
   - Open Web Monitor Dashboard
   - Click "Add New Website"
   - Paste the API key
   - Enter WordPress site URL
   - Click "Add Website"

5. **Verify Connection**
   - Website appears in dashboard
   - Real-time data starts flowing

### Generating New Key

**When you need a new key:**
1. Go to Settings → Web Monitor API
2. Click "Generate New API Key"
3. Confirm the action
4. New key is generated
5. **IMPORTANT**: Update the key in your Dashboard immediately

**Warning**: The old key will stop working!

## Benefits

### Security
- Keys are randomly generated
- Users cannot guess or reuse keys
- Keys are securely stored
- Only admins can generate new keys

### User Experience
- No manual key entry
- Clear display of current key
- Easy copy functionality
- One-click generation of new key

### Support
- No user confusion about key format
- Standard 32-character keys
- Clear instructions displayed
- Warning when regenerating

## Files Modified

- `wordpress-plugin/web-monitor-api-advanced.php`
  - Removed API key input field
  - Made key read-only
  - Added "Generate New Key" functionality
  - Added AJAX handler
  - Improved UI display

## Summary

✅ **API key is auto-generated** by the plugin
✅ **User cannot modify** the key manually
✅ **User can generate** a new key if needed
✅ **Display is read-only** - no editing possible
✅ **Secure and user-friendly**

The plugin now manages API keys automatically for the best security and user experience!

