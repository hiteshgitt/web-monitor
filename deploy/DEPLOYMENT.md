# Deploying Web Monitor to webmonitor.ruyalab.com

Everything runs on **one Linux server (VPS)**, with **Cloudflare** in front:

```
Visitor ──HTTPS──▶ Cloudflare (DNS, SSL, protection)
                        │
                        ▼
                  VPS: Nginx ──┬── /            website + dashboard (built files in dist/)
                               └── /api/*       Node API (PM2, port 5000) ──▶ MongoDB (localhost)
                                                   └─ checks every site each minute
```

| Piece | Where it runs | Cost |
|---|---|---|
| Website + dashboard (React) | VPS, served by Nginx | included |
| API + monitoring (Node/Express) | VPS, kept alive by PM2 | included |
| Database (MongoDB) | Same VPS, localhost only | free |
| Domain, SSL, DDoS protection | Cloudflare (you already have ruyalab.com) | free |
| Google sign-in | Google Cloud project "Web Monitor" | free |
| AI insights (Pro) | Gemini API key | free tier ~20 req/day; paid for launch |
| Backups | Daily `mongodump` on the VPS (+ optional off-site copy) | free |

**VPS to buy:** Ubuntu **24.04 LTS**, **2 vCPU / 2–4 GB RAM / 50 GB disk**, region close to your customers
(e.g. DigitalOcean *Bangalore*, AWS Lightsail *Mumbai*, Hetzner *Singapore*). Roughly $5–12/month.

> Why not Cloudflare Workers/Pages? The monitor must run continuously (a check every minute) next to
> MongoDB. That needs a normal server; Cloudflare stays in front for DNS, HTTPS and protection.

Commands below are run **on the VPS** unless the step says otherwise. Replace values in `<angle brackets>`.

---

## 1. Create the server

1. In your VPS provider, create an **Ubuntu 24.04** server with the size above.
2. Add your **SSH key** during creation (no password logins).
3. Note its **public IPv4 address** — you need it for Cloudflare.

Log in: `ssh root@<SERVER_IP>`

## 2. Basic server setup (security + updates)

```bash
apt update && apt -y upgrade
timedatectl set-timezone Asia/Kolkata

# App user (don't run the app as root)
adduser --disabled-password --gecos "" webmonitor
usermod -aG sudo webmonitor
rsync --archive --chown=webmonitor:webmonitor ~/.ssh /home/webmonitor

# Firewall: only SSH and web traffic
ufw allow OpenSSH
ufw allow 'Nginx Full' 2>/dev/null || { ufw allow 80/tcp; ufw allow 443/tcp; }
ufw --force enable

# Automatic security updates + brute-force protection
apt -y install unattended-upgrades fail2ban
dpkg-reconfigure -f noninteractive unattended-upgrades
```

From now on log in as `ssh webmonitor@<SERVER_IP>` and use `sudo` where shown.

## 3. Install Node 24, Nginx, Git, PM2

```bash
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
sudo apt -y install nodejs nginx git
sudo npm install -g pm2
node -v   # should print v24.x
```

## 4. Database: MongoDB on the same server

```bash
sudo apt -y install gnupg curl
curl -fsSL https://www.mongodb.org/static/pgp/server-8.0.asc | sudo gpg -o /usr/share/keyrings/mongodb-server-8.0.gpg --dearmor
echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-8.0.gpg ] https://repo.mongodb.org/apt/ubuntu noble/mongodb-org/8.0 multiverse" \
  | sudo tee /etc/apt/sources.list.d/mongodb-org-8.0.list
sudo apt update && sudo apt -y install mongodb-org
sudo systemctl enable --now mongod
```
(If mongodb.com lists a newer version for Ubuntu 24.04, use that number instead of 8.0.)

Create the users — pick two long random passwords (`openssl rand -hex 24`):

```bash
mongosh --quiet <<'EOF'
use admin
db.createUser({ user: "admin", pwd: "<ADMIN_DB_PASSWORD>", roles: ["root"] })
use webmonitor
db.createUser({ user: "webmonitor", pwd: "<APP_DB_PASSWORD>", roles: [{ role: "readWrite", db: "webmonitor" }] })
EOF
```

Turn on authentication and keep MongoDB private to the server — edit `/etc/mongod.conf`:

```yaml
net:
  port: 27017
  bindIp: 127.0.0.1      # never expose MongoDB to the internet
security:
  authorization: enabled
```

```bash
sudo systemctl restart mongod
```

Your connection string (used in step 6):
`mongodb://webmonitor:<APP_DB_PASSWORD>@127.0.0.1:27017/webmonitor?authSource=webmonitor`

> **Alternative – managed database:** MongoDB Atlas (free M0 = 512 MB, enough for roughly a dozen sites
> with 90-day retention). Create a cluster, add a database user, allow your VPS IP under *Network Access*,
> and use its `mongodb+srv://…` string in step 6 instead. Then skip the install above.

## 5. Get the code

The repo is `github.com/hiteshgitt/web-monitor`. If it's private, give the server read access:

```bash
ssh-keygen -t ed25519 -C "webmonitor-server" -f ~/.ssh/github_deploy -N ""
cat ~/.ssh/github_deploy.pub
```
Add that key on GitHub → repo → **Settings → Deploy keys → Add deploy key** (read-only). Then:

```bash
cat >> ~/.ssh/config <<'EOF'
Host github.com
  IdentityFile ~/.ssh/github_deploy
EOF
sudo mkdir -p /var/www/webmonitor && sudo chown webmonitor:webmonitor /var/www/webmonitor
git clone git@github.com:hiteshgitt/web-monitor.git /var/www/webmonitor
cd /var/www/webmonitor
git checkout main     # after merging layoutchage into main (or: git checkout layoutchage)
```

## 6. Configure the app

**Backend** – create `backend/config.env` (never commit this file):

```bash
cp backend/config.env.example backend/config.env
nano backend/config.env
```

Set at least:

```ini
NODE_ENV=production
PORT=5000
MONGODB_URI=mongodb://webmonitor:<APP_DB_PASSWORD>@127.0.0.1:27017/webmonitor?authSource=webmonitor

JWT_SECRET=<output of: openssl rand -hex 48>
JWT_EXPIRES_IN=30d
ADMIN_EMAILS=hiteshgml@gmail.com
GOOGLE_CLIENT_ID=111600729792-qmdiib16v9bsibq288nho36drdm4piu5.apps.googleusercontent.com

CORS_ORIGINS=https://webmonitor.ruyalab.com
TRUST_PROXY=2            # Cloudflare + Nginx in front: lets rate limits see real visitor IPs
RATE_LIMIT_MAX=1000

MONITORING_INTERVAL=60000
MONITORING_RETENTION_DAYS=90
GOOGLE_AI_API_KEY=<Gemini key from the Web Monitor Google Cloud project>
AI_INSIGHTS_CACHE_HOURS=12
```
Optional keys for Pro sections: `PAGESPEED_API_KEY`, `VIRUSTOTAL_API_KEY`, `SSLLABS_API_KEY` (see the example file).
Paste secrets straight into this file on the server — not into chats or tickets.

**Frontend** – create `.env` in the project root:

```bash
cp .env.example .env
echo "VITE_GOOGLE_CLIENT_ID=111600729792-qmdiib16v9bsibq288nho36drdm4piu5.apps.googleusercontent.com" > .env
```

## 7. Build and start

```bash
cd /var/www/webmonitor
npm ci && npm run build                 # creates dist/ (website + dashboard)
(cd backend && npm ci --omit=dev)
pm2 start deploy/ecosystem.config.cjs   # starts the API + monitoring loop
pm2 save
pm2 startup systemd -u webmonitor --hp /home/webmonitor   # run the command it prints (starts on reboot)
pm2 install pm2-logrotate               # keeps log files small
curl -s localhost:5000/api/health        # → {"status":"healthy",...}
```

## 8. Cloudflare

In the Cloudflare dashboard for **ruyalab.com**:

1. **DNS → Records → Add record**: Type `A`, Name `webmonitor`, IPv4 `<SERVER_IP>`, Proxy **ON** (orange cloud).
2. **SSL/TLS → Overview**: encryption mode **Full (strict)**.
3. **SSL/TLS → Origin Server → Create certificate**: keep defaults (RSA, `*.ruyalab.com, ruyalab.com`, 15 years).
   Copy both boxes onto the server:
   ```bash
   sudo mkdir -p /etc/ssl/cloudflare
   sudo nano /etc/ssl/cloudflare/webmonitor.pem   # paste "Origin Certificate"
   sudo nano /etc/ssl/cloudflare/webmonitor.key   # paste "Private Key"
   sudo chmod 600 /etc/ssl/cloudflare/webmonitor.key
   ```
4. **SSL/TLS → Edge Certificates**: turn on **Always Use HTTPS**.
5. **Caching → Cache Rules → Create rule**: name `No cache for API`, when *URI Path starts with* `/api/`
   → **Bypass cache**. (Live data must never be served from cache.)

## 9. Nginx (web server)

```bash
sudo cp deploy/nginx-webmonitor.conf /etc/nginx/sites-available/webmonitor
sudo ln -s /etc/nginx/sites-available/webmonitor /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
```

Open **https://webmonitor.ruyalab.com** — you should see the website; `/app` opens the dashboard.

## 10. Google sign-in

In Google Cloud → project **Web Monitor** → **Google Auth Platform**:
- **Clients → Web client → Authorized JavaScript origins** contains `https://webmonitor.ruyalab.com`.
- **Audience → Publish app** (status "In production") so every customer can use Google sign-in.
- Reset the client secret once (it was shared in chat); the app doesn't use it.

## 11. First run

1. Go to `https://webmonitor.ruyalab.com/signup` and sign up with **hiteshgml@gmail.com** — this account
   becomes admin automatically (ADMIN_EMAILS).
2. On each WordPress site you monitor, upload/update the plugin from `wordpress-plugin/web-monitor-api-advanced.php`
   (WP Admin → Plugins, or copy into `wp-content/plugins/`), then copy its API key from
   *Settings → Web Monitor API*.
3. In the dashboard click **Add site** with the site's **public URL** (not `localhost`) and that API key.
4. Customers sign up themselves; Pro requests appear under **Customers** (👥 in the left bar) → **Make Pro**.

> Start the production database fresh. Local test data points at `http://localhost/widma`, which a public
> server can't reach. (If you ever need to move data: `mongodump` locally, `mongorestore` on the server,
> then run `node backend/scripts/migrate-legacy-response-times.js`.)

## 12. Backups

```bash
chmod +x deploy/backup-mongo.sh deploy/update.sh
sudo mkdir -p /var/backups/webmonitor && sudo chown webmonitor:webmonitor /var/backups/webmonitor
deploy/backup-mongo.sh && ls -lh /var/backups/webmonitor     # test it once
crontab -e     # add:  30 2 * * * /var/www/webmonitor/deploy/backup-mongo.sh
```
Keeps 14 days of daily backups. For an off-site copy, sync `/var/backups/webmonitor` to Cloudflare R2
(free tier) or another storage with `rclone`.

## 13. Watch the watcher

Add `https://webmonitor.ruyalab.com/api/health` to a free external uptime checker (e.g. UptimeRobot or
Cloudflare Health Checks) so you're alerted if Web Monitor itself goes down.

Useful commands: `pm2 status`, `pm2 logs webmonitor-api`, `sudo systemctl status nginx mongod`.

## 14. Releasing updates

On your machine: commit and push to GitHub. On the server:

```bash
/var/www/webmonitor/deploy/update.sh
```
(pulls, rebuilds the site, installs API dependencies, reloads the API without downtime)

---

## Go-live checklist

- [ ] VPS created, firewall on, app user set up
- [ ] MongoDB installed with authentication, bound to 127.0.0.1
- [ ] `backend/config.env` and `.env` filled (new JWT_SECRET, DB password, Gemini key)
- [ ] `pm2 status` shows `webmonitor-api` online; survives a reboot
- [ ] Cloudflare DNS (proxied), Full (strict), origin certificate, API cache bypass
- [ ] Site loads at https://webmonitor.ruyalab.com; `/privacy` and `/terms` work
- [ ] Google sign-in works; Google app published; client secret reset
- [ ] Admin account created; Customers page works
- [ ] WordPress plugin updated on monitored sites; sites added with public URLs
- [ ] Daily backup cron in place and tested; external uptime check added

## Later: mobile app

The Capacitor app (next phase) talks to `https://webmonitor.ruyalab.com/api`. Publishing needs a
**Google Play Console** account (one-time fee) and an **Apple Developer** account (yearly fee), plus
Android/iOS OAuth clients added to the same Google Cloud project.
