# Deploy Avadesk na VPS (adição isolada)

Publicar **sem** desligar ou reescrever outros sites/túneis. Código só via GitHub.

## Fonte

```bash
git clone https://github.com/Trindadelucas0/avadesk.git /opt/avadesk
# atualizar: git -C /opt/avadesk pull
```

Não copiar `.env` do PC. Não usar `scp` como fonte principal.

## Portas (loopback)

Não reutilizar 3000, 4000 nem as demais ocupadas no host.

| Serviço | Bind | Unit / container |
|---------|------|------------------|
| Web (único origin no Cloudflare) | `127.0.0.1:3105` | `avadesk-web.service` |
| API | `127.0.0.1:4105` | `avadesk-api.service` |
| Postgres | `127.0.0.1:5436` | container `avadesk-pg` |

Se alguma estiver ocupada, subir 1 (ex. 3107). API e Postgres **não** entram no túnel.

## Cloudflare

No Zero Trust → Public hostname **novo**:

- Type: HTTP
- URL: `127.0.0.1:3105`

Não apagar hostnames existentes. Depois no `/opt/avadesk/.env`:

```env
WEB_ORIGIN=https://SEU-SUBDOMINIO
```

Reiniciar só `avadesk-web` e `avadesk-api`.

Se o túnel for arquivo local, **inserir** um `hostname` no topo do ingress, acima do catch-all `http_status:404`.

## Units

Arquivos em `deploy/avadesk-api.service` e `deploy/avadesk-web.service`. Copiar para `/etc/systemd/system/` e:

```bash
systemctl daemon-reload
systemctl enable --now avadesk-api avadesk-web
```

## Health

```bash
curl -sS http://127.0.0.1:4105/health
curl -sSI http://127.0.0.1:3105/login
```

Login público só depois do hostname HTTPS no Cloudflare.

## Admin (seed)

`npm run seed` **não** apaga dados. Cria/atualiza só `admin@clienthub.dev` com `SEED_PASSWORD` do `.env` da VPS (não commitar).
