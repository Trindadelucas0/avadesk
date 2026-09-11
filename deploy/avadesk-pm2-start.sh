#!/bin/bash
set -euo pipefail
cd /opt/avadesk

# Locate Next binary (workspaces)
NEXT_BIN=""
for p in \
  /opt/avadesk/apps/web/node_modules/next/dist/bin/next \
  /opt/avadesk/node_modules/next/dist/bin/next \
  /opt/avadesk/node_modules/@nexus/web/node_modules/next/dist/bin/next
do
  if [ -f "$p" ]; then NEXT_BIN="$p"; break; fi
done
if [ -z "$NEXT_BIN" ]; then
  NEXT_BIN=$(find /opt/avadesk -path '*node_modules/next/dist/bin/next' | head -1)
fi
echo "NEXT_BIN=$NEXT_BIN"
test -n "$NEXT_BIN"

NODE=/usr/local/bin/node

if pm2 describe avadesk-api >/dev/null 2>&1; then
  pm2 delete avadesk-api
fi
if pm2 describe avadesk-web >/dev/null 2>&1; then
  pm2 delete avadesk-web
fi

pm2 start "$NODE" --name avadesk-api --cwd /opt/avadesk -- --env-file=/opt/avadesk/.env apps/api/dist/index.js
pm2 start "$NODE" --name avadesk-web --cwd /opt/avadesk/apps/web -- --env-file=/opt/avadesk/.env "$NEXT_BIN" start -H 127.0.0.1 -p 3105
pm2 save
sleep 3
pm2 ls --no-color
echo "--- api logs ---"
pm2 logs avadesk-api --lines 20 --nostream --no-color || true
echo "--- web logs ---"
pm2 logs avadesk-web --lines 20 --nostream --no-color || true
echo "--- health ---"
curl -sS http://127.0.0.1:4105/health || true
echo
curl -sSI http://127.0.0.1:3105/login | head -15 || true
echo "--- docker ---"
docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'
echo "--- seed ---"
# print only seed line for operator login
grep '^SEED_PASSWORD=' /opt/avadesk/.env
echo PM2_START_DONE
