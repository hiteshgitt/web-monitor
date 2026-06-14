# Web Monitor API (Advanced) — WordPress Plugin

The **working** plugin for the Web Monitor Dashboard. It exposes real, dynamic
WordPress data (health, analytics, performance, SEO, security, plugins) over the
REST API. All values are measured from WordPress — no simulated/random data.

- **File:** `web-monitor-api-advanced.php` (this is the only file you need)
- **Version:** 1.1.0
- **Compatibility:** WordPress 5.6+ (tested up to 7.0), PHP 7.0+
- `old/` contains earlier experimental versions — **not used**, kept for reference only.

## Install on another website

Single-file plugin — two ways to install:

1. **Drop-in:** copy `web-monitor-api-advanced.php` into
   `wp-content/plugins/` on the target site.
2. **Zip:** zip the file and upload via **Plugins → Add New → Upload Plugin**.

Then **Plugins → Activate** "Web Monitor API (Advanced)".

On activation it auto-generates an API key. Find/copy it at
**Settings → Web Monitor API**.

## Connect it to the dashboard

In the dashboard, **Add Website** with:

| Field | Value |
|-------|-------|
| URL | the site root, e.g. `https://example.com` (no `/wp-json`) |
| Platform | `wordpress` |
| API Key | the key from **Settings → Web Monitor API** |

The dashboard backend then polls these endpoints every 60s with
`Authorization: Bearer <API key>`:

```
/wp-json/webmonitor-advanced/v1/health
/wp-json/webmonitor-advanced/v1/analytics
/wp-json/webmonitor-advanced/v1/performance
/wp-json/webmonitor-advanced/v1/seo
/wp-json/webmonitor-advanced/v1/security
/wp-json/webmonitor-advanced/v1/plugins
```

(`x-api-key: <API key>` is also accepted. If pretty permalinks are off, the
backend falls back to `?rest_route=/webmonitor-advanced/v1/...`.)

## Verify it's live

```bash
curl https://example.com/wp-json/webmonitor-advanced/v1/health \
  -H "Authorization: Bearer YOUR_API_KEY"
```

A JSON health response means it's working. A 404 usually means permalinks need
re-saving (**Settings → Permalinks → Save**) or the plugin isn't activated.

## What's real vs. not

- **Real:** content counts, active plugins, DB/query/memory timings, performance
  score, SSL status, SEO score, real outdated-plugin count, CPU from load average,
  alt-tag/link/heading scans, server uptime seconds.
- **Not available without integration:** visitor/page-view/bounce analytics
  (return `null` until you connect GA4/Jetpack/Matomo), and malware scanning
  (`malware_scan: not_available` — no scanner bundled).
</content>
</invoke>
