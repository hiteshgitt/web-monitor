#!/usr/bin/env bash
# Deploy the latest code on the server. Run from anywhere: /var/www/webmonitor/deploy/update.sh
set -euo pipefail

APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$APP_DIR"

echo "→ Pulling latest code"
git pull --ff-only

echo "→ Building website + dashboard"
npm ci
npm run build

echo "→ Installing API dependencies"
(cd backend && npm ci --omit=dev)

echo "→ Restarting API"
pm2 reload deploy/ecosystem.config.cjs --update-env
pm2 save

echo "✓ Deployed $(git log -1 --format='%h %s')"
