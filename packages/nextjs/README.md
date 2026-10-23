# @ruyalab/webmonitor-nextjs

Connect a Next.js site to **[Web Monitor](https://webmonitor.ruyalab.com)** — uptime, response time,
performance, SEO and security checks every minute.

## Install

```bash
npm install @ruyalab/webmonitor-nextjs
npx webmonitor-nextjs init
```

`init` creates the API route (`app/api/webmonitor/[...slug]/route` for the App Router, or
`pages/api/webmonitor/[...slug]` for the Pages Router) and saves a new `WEBMONITOR_API_KEY` in `.env.local`.

Then:

1. Add the same `WEBMONITOR_API_KEY` to your hosting environment variables and deploy.
2. In the Web Monitor dashboard click **Add site**, choose **Next.js**, and paste the key.

Optional: `WEBMONITOR_SITE_URL=https://your-site.com` sets the public URL used for SEO/security checks
(defaults to the URL the request came in on). `WEBMONITOR_LOG_FILE` shows an error log in the dashboard.

## What it reports

All values are measured on your server at request time:

| Endpoint | Data |
|---|---|
| `health` | status, Node and Next.js versions, memory, load |
| `performance` | memory, CPU load per core, disk space, production build |
| `seo` | homepage title, meta description, H1, image alt text, `lang`, canonical, links |
| `security` | HTTPS, supported Node version, production mode, security headers, `X-Powered-By` |
| `libraries` | dependencies with installed versions |
| `analytics` | `null` — visitor analytics need an analytics provider |

Requests must send `Authorization: Bearer <WEBMONITOR_API_KEY>`. Without a key (or with a short key) the
endpoint refuses to run.

## Manual setup

```ts
// app/api/webmonitor/[...slug]/route.ts
export { GET } from '@ruyalab/webmonitor-nextjs/app-router';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
```

```ts
// pages/api/webmonitor/[...slug].ts
export { default } from '@ruyalab/webmonitor-nextjs/pages-router';
```

MIT License · © Ruyalab
