#!/usr/bin/env bash
set -euo pipefail

APP_NAME="manageone-hourly-monitoring"

pm2 stop "$APP_NAME" >/dev/null 2>&1 || true
pm2 save

echo "Hourly monitoring PM2 job is stopped and saved."
