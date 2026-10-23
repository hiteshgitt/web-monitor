# Deploying Web Monitor on Cloudflare (free)

Everything runs on Cloudflare's free plan — no server to rent or maintain:

```
Visitor ──▶ webmonitor.ruyalab.com ──▶ Cloudflare Worker "web-monitor"
                                         ├── /            website + dashboard (static files from dist/)
                                         ├── /api/*       API (worker/src)
                                         ├── cron * * * * *  the monitor: checks every site each minute
                                         └── D1 database "web-monitor" (SQLite)
```

| Piece | Cloudflare product | Free plan |
|---|---|---|
| Website, dashboard, downloads | Workers static assets | included |
| API | Workers | 100,000 requests/day |
| Monitor | Cron Trigger (every minute) | included |
| Database | D1 | 5 GB, 100k row writes/day, 5M row reads/day |
| Domain + HTTPS | Custom domain on ruyalab.com | included |

**Capacity on the free plan:** about **30 monitored sites** (each site uses ~2 database writes per minute)
and up to **45 sites per minute** of checks. Beyond that, the **Workers Paid plan ($5/month)** removes
these limits — no code changes needed.

**Monitored sites must have public hostnames** (e.g. `https://example.com`). Cloudflare can't reach
`localhost`, private IPs like `192.168.x.x`, or bare IP addresses.

---

## One-time setup

You need **Node.js 22 or newer** (this project uses 24: `nvm install 24 && nvm use 24`).

### 1. Install and sign in to Cloudflare

```bash
cd worker
npm install
npx wrangler login        # opens the browser; approve access for your Cloudflare account
```

### 2. Create the database

```bash
npx wrangler d1 create web-monitor
```

Copy the printed `database_id` into `worker/wrangler.jsonc` (replace `REPLACE_WITH_D1_DATABASE_ID`), then
create the tables:

```bash
npm run db:migrate:remote
```

### 3. Add the secrets

Each command asks you to paste the value (it is stored encrypted by Cloudflare, never in the code):

```bash
npx wrangler secret put JWT_SECRET          # paste the output of: openssl rand -hex 48
npx wrangler secret put GOOGLE_AI_API_KEY   # Gemini key for the Zealot assistant (Pro); optional
```

Non-secret settings (admin emails, Google client ID, retention…) are in `vars` in `worker/wrangler.jsonc`.

### 4. Frontend setting

In the project root, `.env` must contain the Google sign-in client ID (see `.env.example`):

```
VITE_GOOGLE_CLIENT_ID=111600729792-qmdiib16v9bsibq288nho36drdm4piu5.apps.googleusercontent.com
```

### 5. Deploy

```bash
cd worker
npm run deploy             # builds the website/dashboard, then uploads everything to Cloudflare
```

The first deploy also attaches **webmonitor.ruyalab.com** (DNS record and HTTPS certificate are created
automatically, because ruyalab.com is on the same Cloudflare account).

Open **https://webmonitor.ruyalab.com** — the website loads; `/app` is the dashboard.

### 6. Google sign-in

Google Cloud → project **Web Monitor** → Google Auth Platform:
- **Clients → Web client → Authorized JavaScript origins** includes `https://webmonitor.ruyalab.com`.
- **Audience → Publish app** so every customer can sign in with Google.
- Reset the client secret (it was shared in chat; the app doesn't use it).

### 7. First run

1. Sign up at `https://webmonitor.ruyalab.com/signup` with **hiteshgml@gmail.com** — it becomes admin
   automatically (`ADMIN_EMAILS`).
2. Install the integration on each site (guides and downloads: `https://webmonitor.ruyalab.com/integrations`),
   then **Add site** with its public URL and API key.
3. Customers sign up themselves; Pro requests appear under **Customers** (👥 in the left bar).

### 8. Watch it

- Cloudflare dashboard → **Workers & Pages → web-monitor**: requests, errors, cron runs and logs
  (*Observability* is enabled in `wrangler.jsonc`).
- **D1 → web-monitor → Metrics**: daily reads/writes against the free limits.
- Optional: add `https://webmonitor.ruyalab.com/api/health` to a free external uptime checker.

---

## Releasing updates

```bash
cd worker && npm run deploy
```

Database changes go in a new file in `worker/migrations/` and are applied with `npm run db:migrate:remote`
before deploying.

Optional: Cloudflare **Workers Builds** can deploy automatically on every push to GitHub
(Workers & Pages → web-monitor → Settings → Builds → connect `hiteshgitt/web-monitor`,
root directory `worker`, build command `npm run build:web`, deploy command `npx wrangler deploy`).

## Local development

```bash
cd worker
cp .dev.vars.example .dev.vars          # then fill in the values
npm run db:migrate:local
npm run build:web                        # rebuild after frontend changes, then restart dev
npm run dev                              # http://localhost:8787
curl "http://localhost:8787/cdn-cgi/handler/scheduled?cron=*+*+*+*+*"   # run one monitor cycle
```

## Backups

```bash
npx wrangler d1 export web-monitor --remote --output=backup-$(date +%F).sql
```
D1 also keeps **Time Travel** (point-in-time restore of the last 7 days on the free plan):
`npx wrangler d1 time-travel restore web-monitor --timestamp=<ISO time>`.
