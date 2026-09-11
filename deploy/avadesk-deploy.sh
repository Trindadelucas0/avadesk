#!/bin/bash
set -euo pipefail
umask 077

FORBIDDEN=' 3000 4000 22 8082 3300 3880 4243 3333 8885 3538 3090 3935 4334 3737 31301 6767 3010 3001 5050 34554 4444 8887 4441 6999 3847 7177 9527 3618 3789 34668 '
WEB_PORT=3105
API_PORT=4105
PG_PORT=5436

port_used() {
  ss -tln | awk '{print $4}' | grep -E ":${1}$" >/dev/null 2>&1
}

bump_if_needed() {
  local p=$1
  while echo "$FORBIDDEN" | grep -q " $p " || port_used "$p"; do
    p=$((p + 1))
  done
  echo "$p"
}

WEB_PORT=$(bump_if_needed "$WEB_PORT")
API_PORT=$(bump_if_needed "$API_PORT")
PG_PORT=$(bump_if_needed "$PG_PORT")
echo "PORTS web=$WEB_PORT api=$API_PORT pg=$PG_PORT"

if [ ! -d /opt/avadesk/.git ]; then
  git clone https://github.com/Trindadelucas0/avadesk.git /opt/avadesk
else
  git -C /opt/avadesk pull --ff-only
fi
test -f /opt/avadesk/package.json

if [ ! -f /opt/avadesk/.env ]; then
  PG_PASS=$(openssl rand -hex 16)
  SEED_PASS="Avadesk$(openssl rand -hex 8)"
  SESS=$(openssl rand -hex 32)
  CRED=$(openssl rand -hex 32)
else
  set -a
  # shellcheck disable=SC1091
  source /opt/avadesk/.env
  set +a
  SEED_PASS="${SEED_PASSWORD:-Avadesk$(openssl rand -hex 8)}"
  SESS="${SESSION_SECRET:-$(openssl rand -hex 32)}"
  CRED="${CREDENTIALS_KEY:-$(openssl rand -hex 32)}"
  if [ -n "${POSTGRES_PASSWORD:-}" ]; then
    PG_PASS="$POSTGRES_PASSWORD"
  elif [ -n "${DATABASE_URL:-}" ]; then
    PG_PASS="${DATABASE_URL#*://}"
    PG_PASS="${PG_PASS#*:}"
    PG_PASS="${PG_PASS%%@*}"
  else
    PG_PASS=$(openssl rand -hex 16)
  fi
fi

if ! docker inspect avadesk-pg >/dev/null 2>&1; then
  docker run -d --name avadesk-pg --restart unless-stopped \
    -e POSTGRES_USER=avadesk \
    -e POSTGRES_PASSWORD="$PG_PASS" \
    -e POSTGRES_DB=avadesk \
    -p "127.0.0.1:${PG_PORT}:5432" \
    postgres:16-alpine
else
  echo "avadesk-pg already exists — not recreating"
fi

for _ in $(seq 1 40); do
  if docker exec avadesk-pg pg_isready -U avadesk >/dev/null 2>&1; then
    echo PG_READY
    break
  fi
  sleep 2
done
docker exec avadesk-pg pg_isready -U avadesk

umask 077
cat > /opt/avadesk/.env <<EOF
DATABASE_URL=postgresql://avadesk:${PG_PASS}@127.0.0.1:${PG_PORT}/avadesk
POSTGRES_PASSWORD=${PG_PASS}
SESSION_SECRET=${SESS}
HUB_SYNC_SECRET=${SESS}
HOST=127.0.0.1
PORT=${API_PORT}
WEB_ORIGIN=http://127.0.0.1:${WEB_PORT}
NEXT_PUBLIC_API_URL=http://127.0.0.1:${API_PORT}
API_URL=http://127.0.0.1:${API_PORT}
RESEND_API_KEY=
EMAIL_FROM=Avadesk <onboarding@resend.dev>
SEED_PASSWORD=${SEED_PASS}
CREDENTIALS_KEY=${CRED}
NODE_ENV=production
EOF
chmod 600 /opt/avadesk/.env

cd /opt/avadesk
npm ci
npm run build
npm run migrate
npm run seed

set -a
# shellcheck disable=SC1091
source /opt/avadesk/.env
set +a
export NODE_ENV=production HOST=127.0.0.1 PORT="$API_PORT"

if pm2 describe avadesk-api >/dev/null 2>&1; then
  pm2 restart avadesk-api --update-env
else
  pm2 start apps/api/dist/index.js --name avadesk-api --cwd /opt/avadesk
fi

if pm2 describe avadesk-web >/dev/null 2>&1; then
  pm2 restart avadesk-web --update-env
else
  pm2 start /opt/avadesk/node_modules/next/dist/bin/next --name avadesk-web --cwd /opt/avadesk/apps/web -- start -H 127.0.0.1 -p "$WEB_PORT"
fi

pm2 save
echo DEPLOY_DONE
echo WEB_PORT="$WEB_PORT"
echo API_PORT="$API_PORT"
echo PG_PORT="$PG_PORT"
