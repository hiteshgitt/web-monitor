#!/usr/bin/env bash
# Daily MongoDB backup, keeping the last 14 days.
# Cron (as the app user):  30 2 * * * /var/www/webmonitor/deploy/backup-mongo.sh
# Restore a backup:        mongorestore --uri="$MONGODB_URI" --gzip --archive=FILE --drop
set -euo pipefail

APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/webmonitor}"
KEEP_DAYS="${KEEP_DAYS:-14}"
MONGODB_URI="$(grep -E '^MONGODB_URI=' "$APP_DIR/backend/config.env" | cut -d= -f2-)"

mkdir -p "$BACKUP_DIR"
mongodump --uri="$MONGODB_URI" --gzip --archive="$BACKUP_DIR/webmonitor-$(date +%F).archive.gz" --quiet
find "$BACKUP_DIR" -name 'webmonitor-*.archive.gz' -mtime +"$KEEP_DAYS" -delete
