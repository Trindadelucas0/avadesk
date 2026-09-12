#!/bin/bash
# Atualiza Avadesk já instalado em /opt/avadesk.
# Não reescreve .env. Não recria avadesk-pg. Não para outros apps PM2.
# Primeira instalação: use deploy/avadesk-deploy.sh (só uma vez).
set -euo pipefail

cd /opt/avadesk
test -d .git
test -f .env
test -f package.json

git pull --ff-only

docker start avadesk-pg >/dev/null 2>&1 || true
for _ in $(seq 1 40); do
  if docker exec avadesk-pg pg_isready -U avadesk >/dev/null 2>&1; then
    echo PG_READY
    break
  fi
  sleep 2
done
docker exec avadesk-pg pg_isready -U avadesk

npm ci
npm run build
npm run migrate
npm run seed

pm2 restart avadesk-api avadesk-web --update-env
pm2 save

echo "--- git ---"
git log -1 --oneline
echo "--- pm2 ---"
pm2 ls --no-color
echo "--- health ---"
curl -sS http://127.0.0.1:4105/health || true
echo
curl -sSI http://127.0.0.1:3105/login | head -15 || true
echo "--- docker ---"
docker ps --filter name=avadesk-pg --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'
echo DEPLOY_UPDATE_DONE
