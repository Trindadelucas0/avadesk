# Avadesk

Portal de acompanhamento da evolução de software (**Avadesk**).
Monorepo: **Web (Next.js 15)** + **API (Express + PostgreSQL)**.

A fonte da verdade é o banco relacional (`/v2`). A UI em `/client` e `/admin` não carrega o snapshot JSON completo nem senhas de login no navegador.

## Estrutura

```text
d:\sistema\
  apps\api\          Express + pg + Zod (/v2 + legado)
  apps\web\          Next.js Avadesk
  db\migrations\     001_init, 002_hub_state, 003_relational
  docs\
  DOCUMENTACAO-SISTEMA.md
```

## Quick start

```powershell
cd d:\sistema
Copy-Item .env.example .env
npm install
npm run migrate
npm run seed
npm run dev
```

Opcional — copiar snapshot antigo `hub_state` (não apaga a tabela):

```powershell
npm run migrate:hub -w @nexus/api
```

Abra **http://localhost:3000/login** (não use 3001–3005). Feche outros `next dev` se a porta 3000 já estiver ocupada.

| Role | E-mail | Senha |
|------|--------|-------|
| ADMIN | `admin@clienthub.dev` | `Hub2026!` (`SEED_PASSWORD`) |

Banco: `DATABASE_URL` aponta para **localhost:5434 / nexus** (veja `.env.example`). Testes: `DATABASE_URL_TEST` → **nexus_test** (nunca o banco da tela). Esta app **não** usa `DB_HOST`, `DB_PORT=5432` nem `JWT_SECRET`.

`npm run seed` **não limpa dados**. Só cria o admin se o e-mail ainda não existir.

Crie clientes, projetos e usuários CLIENT pela UI. Guia: **[docs/GUIA-DE-USO-CLIENT-HUB.md](docs/GUIA-DE-USO-CLIENT-HUB.md)**.

`npm run dev:web` sozinho **não autentica** de verdade (precisa da API).

## Rotas

| Área | Paths |
|------|--------|
| Auth | `/login`, `/forgot-password`, `/reset-password`, `/invite` |
| Client | `/client` (Início), `/client/updates` (Evolução), `/client/access`, projetos, chamados, releases, docs, files, notifications, profile, settings |
| Admin | `/admin`, clients, projects, `/admin/chamados` (Kanban), updates, releases, docs, files, notifications, users, settings |
| Legacy | `/portal` → `/client` |

API: http://localhost:4000 — contrato vivo em `/v2/*`. BFF same-origin: `/api/v2/*` (cookie no :3000). `POST /api/hub/login` e `GET /api/hub/state` encaminham para o v2 (compat PWA antigo).

## Scripts

| Script | Efeito |
|--------|--------|
| `npm run dev` | API (:4000) + Web (`next dev --port 3000`, webpack). Só um Next; extras devem falhar em vez de subir em 3001+ |
| `npm run migrate` | Aplica SQL em `db/migrations/` |
| `npm run seed` | Garante `admin@clienthub.dev` (INSERT ou atualiza só a senha desse admin). **Não** TRUNCATE / não apaga clientes, usuários, projetos ou updates |
| `npm test` | Testes da API em `nexus_test` (não toca o banco da UI) |
| `npm run typecheck -w @nexus/web` | `tsc` web |
| `npm run build -w @nexus/web` | Build Next |

Se `next dev` estiver no ar e o build falhar no cache:

```powershell
$env:NEXT_DIST_DIR='.next-build'; npm run build -w @nexus/web
```

## Segurança (resumo)

- Sessão HttpOnly (`avadesk_session` / `nexus_session`).
- Authz no servidor; CLIENT isolado por empresa/projeto.
- Login: bcrypt. Credenciais de sistema: AES-256-GCM (`CREDENTIALS_KEY`).
- Reveal auditado; senha fora das listagens.
- E-mail via outbox (falha Resend não desfaz update).

## Documentação

- Tutorial: [docs/GUIA-DE-USO-CLIENT-HUB.md](docs/GUIA-DE-USO-CLIENT-HUB.md)
- Comportamento oficial: [DOCUMENTACAO-SISTEMA.md](DOCUMENTACAO-SISTEMA.md)
- PRD: [docs/PRD-NEXUS-PORTAL-CLIENTE.md](docs/PRD-NEXUS-PORTAL-CLIENTE.md)
