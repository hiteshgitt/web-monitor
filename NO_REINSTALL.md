# No reinstall needed – how to get new features

You do **not** need to reinstall anything. Update the existing plugin or integration files and the new endpoints (logs, recommendations, export, incidents) will work.

---

## WordPress (e.g. Widma)

**You do not need to reinstall the plugin.**

1. **Update the plugin file**
   - Replace the file on your server:  
     `wp-content/plugins/web-monitor-api-advanced/web-monitor-api-advanced.php`  
     (or whatever folder name you use) with the latest version from this project.
   - Or overwrite the same file via FTP / file manager / your editor.

2. **No WordPress admin steps**
   - Do **not** deactivate or uninstall the plugin.
   - Do **not** run “Install” again.
   - The plugin stays active; PHP will use the new code on the next request.

3. **Check on Widma**
   - Open your Web Monitor dashboard and open the Widma site.
   - Go to the **Logs** tab (error log + access summary).
   - Go to **Overview** and check **Recommended actions** and **Downtime history**.
   - Use **Download report (CSV)** in the header or in the Reports tab.

4. **Optional: enable PHP error log**
   - To see PHP errors in the Logs tab, in `wp-config.php` add or set:
     - `define('WP_DEBUG', true);`
     - `define('WP_DEBUG_LOG', true);`
   - Errors will be written to `wp-content/debug.log` and the plugin will read them (no SSH/cPanel needed).

---

## Next.js, Laravel, CodeIgniter, PHP

**You do not need to reinstall the integration.**  
Update the same route/controller files you already use.

### Next.js (App Router)

- **File:** `app/api/webmonitor/[...slug]/route.ts`
- **Action:** Replace it with the latest version from  
  `nextjs-integration/app-router/webmonitor/[...slug]/route.ts`  
  in this repo.
- New endpoints (no new install):
  - `GET /api/webmonitor/logs`
  - `GET /api/webmonitor/recommendations`
- Optional: create a `logs/error.log` (or similar) in the project root if you want the dashboard to show app log lines.

### Laravel

- **File:** `app/Http/Controllers/WebMonitorController.php`
- **Action:** Replace with the latest from  
  `php-integration/laravel/WebMonitorController.php`
- **Common API:** Ensure `php-integration/common/WebMonitorAPI.php` is the latest (it now has `getLogs()` and `getRecommendations()`).
- New endpoints (no new routes needed if you use a catch-all):
  - `GET /api/webmonitor/logs`
  - `GET /api/webmonitor/recommendations`
- Laravel logs are usually in `storage/logs/laravel.log`; the API will try to read them.

### CodeIgniter

- **File:** `app/Controllers/WebMonitorController.php`
- **Action:** Replace with the latest from  
  `php-integration/codeigniter/WebMonitorController.php`
- **Common API:** Same as Laravel – use the latest `WebMonitorAPI.php`.
- New endpoints:
  - `GET /api/webmonitor/logs`
  - `GET /api/webmonitor/recommendations`

### Core PHP

- If you use the common `WebMonitorAPI.php` and a single entry point (e.g. `api/webmonitor.php?endpoint=health`), add handling for `endpoint=logs` and `endpoint=recommendations` that call `$api->getLogs()` and `$api->getRecommendations()`.
- No reinstall; just update the script that dispatches to the API class.

---

## Summary

| Platform     | Reinstall? | What to do |
|-------------|------------|------------|
| WordPress   | **No**     | Replace `web-monitor-api-advanced.php` with the new version. |
| Next.js     | **No**     | Replace `app/api/webmonitor/[...slug]/route.ts` with the new version. |
| Laravel     | **No**     | Replace `WebMonitorController.php` and `WebMonitorAPI.php` with the new versions. |
| CodeIgniter | **No**     | Replace `WebMonitorController.php` and `WebMonitorAPI.php` with the new versions. |
| PHP (core)  | **No**     | Update your router/script to call `getLogs()` and `getRecommendations()`. |

After updating the files, the dashboard will use logs and recommendations for **all** these platforms (WordPress, Next.js, Laravel, CodeIgniter, PHP) without any reinstall.
