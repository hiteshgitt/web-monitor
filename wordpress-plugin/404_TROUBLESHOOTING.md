# WordPress 404 – Request failed with status 404

If the dashboard shows **"request failed with status 404"** when loading your WordPress site (e.g. Widma), use this checklist.

---

## 1. Confirm the correct plugin is active

You must use the **Web Monitor API (Advanced)** plugin, not a different or “simple” version.

- In WordPress: **Plugins → Installed Plugins**
- Find **"Web Monitor API (Advanced)"** – Plugin Name in the file is exactly that
- Status must be **Active**
- The main file must be **web-monitor-api-advanced.php** (the one that has `/logs` and `/recommendations` routes)

If you only have "Web Monitor API" (without "Advanced") or another plugin, replace it with **web-monitor-api-advanced.php** from this project and activate it.

---

## 2. Permalinks already “Post name” but still 404?

If permalinks are already set to **Post name** and you still get 404, the dashboard backend now **retries automatically** using the `?rest_route=` format (works when rewrites fail). **Restart the backend** so it uses this fallback.

Then test both URLs in the browser (replace with your site):

- Pretty: `http://localhost/widma/wp-json/webmonitor-advanced/v1/health`
- Fallback: `http://localhost/widma/?rest_route=/webmonitor-advanced/v1/health`

If the **fallback URL** returns JSON (or 401), the plugin is working and the backend will use it after restart. If **both** return 404, see steps 1 and 5 (plugin and routes).

---

## 3. Check the site URL in the dashboard

The URL stored for the website must be the real WordPress root URL, **without** a trailing slash.

- **Good:** `http://localhost/widma` or `https://yoursite.com`
- **Bad:** `http://localhost/widma/` (trailing slash can cause 404 on some setups)

In the Web Monitor dashboard, edit the website and set the URL to the root of the WordPress site (no path to a subfolder unless WordPress really lives there). The backend now strips a trailing slash automatically; if you still get 404, try saving the URL without the slash.

---

## 4. Fix permalinks (if still using Plain)

The REST API needs **pretty permalinks**. If you use **Plain**, switch:

1. In WordPress: **Settings → Permalinks**
2. Choose **Post name** (or any option other than **Plain**)
3. Click **Save Changes** (flushes rewrite rules)

## 5. Test the REST API directly

Open this URL in your browser (replace with your site URL and add the API key only if your plugin requires it):

```
https://YOUR-WORDPRESS-SITE/wp-json/webmonitor-advanced/v1/health
```

Examples:

- Local: `http://localhost/widma/wp-json/webmonitor-advanced/v1/health`
- With port: `http://localhost:8080/widma/wp-json/webmonitor-advanced/v1/health`

**If you get 404:**

- Permalinks are wrong or not flushed → do **step 2** again
- Wrong plugin or plugin not active → do **step 1**
- WordPress is in a subdirectory → use that full URL (e.g. `http://localhost/widma`) in the dashboard

**If you get 401 Unauthorized:**

- The API is found; the problem is the API key. In WordPress go to **Settings → Web Monitor API**, copy the key, and in the dashboard edit the website and paste the same key.

**If you get JSON with `"status":"healthy"`:**

- The API works. The 404 in the dashboard was likely due to permalinks or URL (steps 2 and 3).

---

## 6. Test the logs endpoint

After `/health` works, test:

```
https://YOUR-WORDPRESS-SITE/wp-json/webmonitor-advanced/v1/logs
```

With API key (e.g. in curl):

```bash
curl -H "Authorization: Bearer YOUR_API_KEY" "http://localhost/widma/wp-json/webmonitor-advanced/v1/logs"
```

- If this returns 404 but `/health` works, the plugin file might be old and missing the `logs` route. Replace it with the latest **web-monitor-api-advanced.php** from this project.
- If it returns JSON, the dashboard should be able to load logs (after refreshing the dashboard or reopening the site).

---

## 7. Server / .htaccess (if you use Apache)

If WordPress is in a subdirectory (e.g. `/widma`) and you still get 404:

- Ensure the subdirectory has its own **.htaccess** with the usual WordPress rules, or
- That the main server config routes that subdirectory to WordPress.

For **Nginx**, the REST API must be passed to `index.php`; standard WordPress Nginx configs usually do this.

---

## 8. Debug in wp-config.php (optional)

You already enabled debug. You can also log REST API errors:

```php
define('WP_DEBUG', true);
define('WP_DEBUG_LOG', true);
define('WP_DEBUG_DISPLAY', false);
```

Then check `wp-content/debug.log` after opening the dashboard or calling the API. Any PHP or REST routing errors will appear there.

---

## Summary checklist

- [ ] Plugin **"Web Monitor API (Advanced)"** is active (web-monitor-api-advanced.php)
- [ ] **Settings → Permalinks** is not “Plain” and you clicked **Save**
- [ ] Website URL in dashboard is the WordPress root, no trailing slash
- [ ] `/wp-json/webmonitor-advanced/v1/health` opens in the browser (no 404)
- [ ] API key in dashboard matches **Settings → Web Monitor API** in WordPress

After these, the “request failed with status 404” should be resolved. If 404 persists, the exact URL you see in the browser when you get 404 (and, if possible, one line from `wp-content/debug.log`) helps to narrow it down.
