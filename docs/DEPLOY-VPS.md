# Deploy Avadesk na VPS (adição isolada)

Publicar **sem** desligar ou reescrever outros sites/túneis. Código só via GitHub.

## Fonte

```bash
git clone https://github.com/Trindadelucas0/avadesk.git /opt/avadesk
```

Não copiar `.env` do PC. Não usar `scp` como fonte principal.

## Atualizar (dia a dia)

Já instalado em `/opt/avadesk`. **Não** rode `deploy/avadesk-deploy.sh` de novo: ele reescreve `.env`.

Playbook no PC: [`ATUALIZAR-VPS.txt`](../ATUALIZAR-VPS.txt) (mesmo texto em [`deploy/ATUALIZAR-VPS.txt`](../deploy/ATUALIZAR-VPS.txt)). Na VPS: `/root/ATUALIZAR-AVADESK.txt` ou:

```bash
bash /opt/avadesk/deploy/avadesk-update.sh
```

Isso faz `git pull --ff-only`, confirma o container `avadesk-pg` (só `docker start` se estiver parado; **não** recria), `npm ci`, build, migrate, seed (não apaga dados), `pm2 restart` só de `avadesk-api` e `avadesk-web`.

Antes do pull na VPS: `git push origin main` neste PC. Sem push, a VPS não recebe o Cursor.

## Portas (loopback)

Não reutilizar 3000, 4000 nem as demais ocupadas no host.

| Serviço | Bind | Unit / container |
|---------|------|------------------|
| Web (único origin no Cloudflare) | `127.0.0.1:3105` | PM2 `avadesk-web` |
| API | `127.0.0.1:4105` | PM2 `avadesk-api` |
| Postgres | `127.0.0.1:5436` | container `avadesk-pg` |

Se alguma estiver ocupada, subir 1 (ex. 3107). API e Postgres **não** entram no túnel.

## Cloudflare

No Zero Trust → Public hostname **novo**:

- Type: HTTP
- URL: `127.0.0.1:3105`

Não apagar hostnames existentes. Hostname deste projeto:

- Hostname: `suporte.avadesk.com.br`
- Path: `*`
- Origin: `http://127.0.0.1:3105`

No `/opt/avadesk/.env`:

```env
WEB_ORIGIN=https://suporte.avadesk.com.br
```

Reiniciar só `avadesk-web` e `avadesk-api`.

Se o túnel for arquivo local, **inserir** um `hostname` no topo do ingress, acima do catch-all `http_status:404`.

## PM2

Não parar `crm`, `app-rft`, `exito-formulario` nem outros apps. Só criar/reiniciar `avadesk-api` e `avadesk-web`:

```bash
bash /opt/avadesk/deploy/avadesk-pm2-start.sh
pm2 save
```

Units systemd em `deploy/avadesk-*.service` são opcionais (a VPS Hostinger usa PM2).

## Health

```bash
curl -sS http://127.0.0.1:4105/health
curl -sSI http://127.0.0.1:3105/login
```

Login público só depois do hostname HTTPS no Cloudflare.

## Admin (seed)

`npm run seed` **não** apaga dados. Cria/atualiza só `admin@clienthub.dev` com `SEED_PASSWORD` do `.env` da VPS (não commitar).
