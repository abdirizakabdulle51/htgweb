#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/var/www/htgweb"
APP_NAME="manageone-hourly-monitoring"
SCRIPT_PATH="server/jobs/sync-manageone-hourly-monitoring.js"

cd "$APP_DIR"

if [[ ! -f ".env" ]]; then
  echo "Missing $APP_DIR/.env" >&2
  exit 1
fi

set -a
# shellcheck disable=SC1091
source .env
set +a

if [[ -z "${MANAGEONE_HOURLY_SYNC_URL:-}" || -z "${MANAGEONE_HOURLY_SYNC_SECRET:-}" ]]; then
  echo "Missing MANAGEONE_HOURLY_SYNC_URL or MANAGEONE_HOURLY_SYNC_SECRET in .env" >&2
  exit 1
fi

pm2 delete "$APP_NAME" >/dev/null 2>&1 || true

pm2 start "$SCRIPT_PATH" \
  --name "$APP_NAME" \
  --cron "0 * * * *" \
  --no-autorestart \
  --time \
  --update-env

pm2 save

cat <<'MSG'
Hourly monitoring PM2 job is enabled.

It runs once immediately when enabled, then every hour at minute 00.

Disable it with:
  scripts/disable-hourly-monitoring-pm2.sh

Check logs with:
  pm2 logs manageone-hourly-monitoring --lines 80
MSG
