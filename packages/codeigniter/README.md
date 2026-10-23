# ruyalab/webmonitor-codeigniter

Connect a CodeIgniter 4 app to **[Web Monitor](https://webmonitor.ruyalab.com)** — uptime, response time,
performance, SEO and security checks every minute.

## Install

```bash
composer require ruyalab/webmonitor-codeigniter
php spark webmonitor:install
```

CodeIgniter discovers the `GET api/webmonitor/(:segment)` route from the package automatically
(Config\Modules `discoverInComposer`, on by default). `webmonitor:install` saves a new
`WEBMONITOR_API_KEY` in `.env` and prints it with your site URL.

Then in the Web Monitor dashboard click **Add site**, choose **CodeIgniter**, and paste the key.

Set `app.baseURL` (or `WEBMONITOR_SITE_URL`) in `.env` to your public `https://` address — it is used for
the SEO and security checks. Run `php spark webmonitor:install --new` to rotate the key.

## What it reports

All values are measured on your server at request time: health, performance (memory, CPU load per core,
disk space, OPcache), SEO (homepage title, description, H1, alt text, links), security (HTTPS, supported PHP,
production environment, security headers), Composer packages with installed versions, and the latest
`writable/logs` entries. Visitor analytics are reported as `null` (they need an analytics provider).

Requests must send `Authorization: Bearer <WEBMONITOR_API_KEY>`. Supports CodeIgniter 4.4+, PHP 8.1+.

MIT License · © Ruyalab
