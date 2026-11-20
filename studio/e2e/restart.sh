#!/usr/bin/env bash
# Redémarre un serveur de production local avec une base vierge (tests).
set -e
cd "$(dirname "$0")/.."
pkill -f "next-server" || true
pkill -f "next start" || true
sleep 1.5
rm -rf "${STUDIO_DATA_DIR:-./data-e2e}" e2e/artifacts
STUDIO_DATA_DIR="${STUDIO_DATA_DIR:-./data-e2e}" nohup npx next start -p "${PORT:-3100}" > e2e/server.log 2>&1 &
for i in $(seq 1 40); do curl -s -o /dev/null http://localhost:${PORT:-3100}/login && exit 0; sleep 0.5; done
echo "Le serveur n'a pas démarré"; exit 1
