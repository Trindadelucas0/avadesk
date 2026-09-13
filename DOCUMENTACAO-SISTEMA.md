# Avadesk — Documentação do Sistema

| Item | Valor |
|------|--------|
| Versão do sistema | 3.16.0 — Usuários e arquivos |
| Última atualização | 13/09/2026 (editar/excluir usuário e arquivo) |
| Fonte oficial | Este arquivo |
| Guia de uso | [docs/GUIA-DE-USO-CLIENT-HUB.md](docs/GUIA-DE-USO-CLIENT-HUB.md) |
| PRD / wireframes | [docs/PRD-NEXUS-PORTAL-CLIENTE.md](docs/PRD-NEXUS-PORTAL-CLIENTE.md) |
| Marca na UI | **Avadesk** (`organizationName`, padrão Avadesk). Não hardcodar NEXUS na UI. |

## 1. Como usar este documento

Mapa tela → comportamento → código. Regras de negócio e autorização estão no **servidor** (`apps/api`). O Zustand na web é cache de UI, não fonte da verdade.

Tutorial: **[docs/GUIA-DE-USO-CLIENT-HUB.md](docs/GUIA-DE-USO-CLIENT-HUB.md)**.

## 2. Tecnologias utilizadas

| Camada | Stack |
|--------|--------|
| Web | Next.js 15 App Router, TypeScript, Tailwind, hub kit |
| Estado UI | Zustand em memória, hidratado por `GET /api/v2/bootstrap`. Live: `GET /v2/events` (SSE) dispara refresh; poll 30s permanece como fallback |
| Auth | Cookie HttpOnly `avadesk_session` / `nexus_session` no host :3000 via BFF |
| API | Express + `pg` + Zod. Sem Prisma, Redis, S3 |
| Banco | PostgreSQL via `DATABASE_URL` (`localhost:5434/nexus`). Testes: `DATABASE_URL_TEST` (`nexus_test`). Esta app **não** usa `DB_HOST` / `DB_PORT=5432` / `JWT_SECRET` |
| Arquivos | Disco privado `apps/api/storage/` + download autenticado |
| E-mail | `email_outbox` + Resend. Templates Avadesk: reset, update, **boas-vindas** (sem senha), **chamado por etapa**. Sem key → `logged`. Sandbox `onboarding@resend.dev` só entrega para o e-mail da conta Resend |
| PWA | `manifest.webmanifest` (`id`/`scope`, ícones `any` e `maskable` separados) + `public/sw.js` (`avadesk-shell-v6`). Meta `apple-mobile-web-app-capable`. Web Push VAPID obrigatório no `.env` da API. Sem VAPID: `GET /health` `push: false` e zero `push_subscriptions`. iOS 16.4+: ícone na tela inicial + toque em **Ativar alertas**. |

### 2.1 Histórico de versões

| Versão | Nome | Mudança |
|--------|------|---------|
| 3.16.0 | Usuários e arquivos | Lista de usuários: **Editar** (ficha) e **Excluir** (apaga o login, com confirmação). Não apaga a si mesmo; MANAGER não apaga ADMIN; último admin não some (409). Switch Ativo permanece; desativar o último admin ativo também 409. `updates.author_id` fica NULL se o autor for excluído (`012_user_delete_and_file_crud.sql`). Arquivos (pasta Documentação e demais): staff **renomeia**, **muda de pasta** e **exclui** (disco + linha). Fichas `documents`: título e exclusão. Cliente continua só **Baixar**. |
| 3.15.9 | Chamados | Card resolvido (cliente): **Confirmar** e **Ainda não está ok** em `flex-wrap`; texto pode quebrar no botão (`whitespace-normal`). Não cortam no card estreito (lista em 2 colunas). Sem mudança de API. |
| 3.15.6 | Chamados | **Baixar PDF** só no card do staff (`mode=admin`). `GET /v2/tickets/:id/pdf`: CLIENT 404 (não revela o recurso); staff 200; outro tenant 404; sem sessão 401. Portal do cliente sem o botão. |
| 3.15.5 | Chamados | iOS: meta `apple-mobile-web-app-capable` (Next 15 só emitia `mobile-web-app-capable`). Manifest com `id`/`scope` e ícones `any` separados de `maskable`. SW iOS sem vibrate. `GET /health` diz se e-mail e push estão configurados. Sem `RESEND_API_KEY` o outbox fica `logged` (não envia). Sem VAPID o Web Push não inscreve. |
| 3.15.4 | Chamados | Alerta PWA passa a aparecer na tela do celular: envio `urgency=high`, `showNotification` com vibrate/renotify, permissão só com toque em **Ativar alertas**, SW `avadesk-shell-v6` sem cache HTTP. iOS continua exigindo ícone na tela inicial (16.4+). |
| 3.15.3 | Chamados | Atualizar sozinho: [`ATUALIZAR-VPS.txt`](ATUALIZAR-VPS.txt) (`git push` no PC + bloco na VPS). Público `https://suporte.avadesk.com.br`. Não usar `avadesk-deploy.sh` no dia a dia (reescreve `.env`). Sem mudança de telas ou regras. |
| 3.15.2 | Chamados | Card expandido: **Baixar PDF** (admin e cliente, aberto ou concluído). `GET /v2/tickets/:id/pdf` (texto + nomes das imagens; sem bytes). Outro tenant 404. PDF **não** entra em anexo do chamado. |
| 3.15.1 | Chamados | No portal, o cliente só abre **Bug** ou **Outra coisa** (nome 2–60 + detalhes; foto opcional). Staff continua com Implementação / Funcionalidade / Rotina. `POST`/`PATCH content`: CLIENT com outro tipo → 403. Tipo `other` no CHECK (`011_ticket_type_other.sql`). Tickets antigos permanecem. |
| 3.15.0 | Aparência | Tema **claro** e **escuro**. Claro é o padrão no primeiro acesso; a escolha fica em `localStorage["avadesk-theme"]` (por dispositivo, fora do banco e da API). Interruptor no header e cards **Aparência** em `/client/settings` e `/admin/settings`. Anel, número e barras de evolução saem do azul `--accent` e passam a usar `--progress` (verde). Sem mudança de API, `progressPct`, etapas ou permissões. |
| 3.14.9 | Perfil | `/admin/profile` e `/client/profile` abrem em leitura. **Editar** mostra o formulário; **Cancelar** descarta; **Salvar** usa as mesmas APIs (`PATCH /v2/auth/me`, `PATCH /v2/clients/:id`). Onboarding inalterado. |
| 3.14.8 | Deploy VPS | Produção isolada em `127.0.0.1:3105` (web), `:4105` (API), `:5436` (Postgres). Clone [avadesk.git](https://github.com/Trindadelucas0/avadesk.git) em `/opt/avadesk`. Cloudflare aponta HTTP `127.0.0.1:3105`. Guia: [docs/DEPLOY-VPS.md](docs/DEPLOY-VPS.md). API aceita `HOST` (VPS: `127.0.0.1`). Sem mudança de telas ou regras. |
| 1.0.0 | Portal V1 | API + UI lean `/admin` `/portal` |
| 2.0.x | Client Hub | UI `/client` `/admin`, hub_state JSON |
| 3.14.7 | Chamados | `next dev --port 3000` (webpack, porta fixa). SW `avadesk-shell-v5`: navegação network-first, não cacheia resposta `status >= 400`. Um único Next em localhost:3000. |
| 3.14.6 | Chamados | Visual de todo o hub alinhado às referências de Chamados e cadastro: `hub-surface`/`hub-dialog`, filtros com glow, ícone no `PageHeader`, kanban com cor por etapa. Encerrados continuam só em **Concluídos** (por data). Sem mudança de API, etapas ou permissões. |
| 3.14.5 | Chamados | Tela de chamados lista só `stage <> closed`. Encerrados em **Concluídos** com De/Até (`GET /v2/tickets?stage=closed&from=&to=`). Bootstrap só carrega abertos (limite 100). |
| 3.14.4 | Acesso e ambientes | Identidade visual unificada: tokens/bordas com glow, kanban de chamados por cor de etapa, cadastro (`/client/onboarding`) e convite no casco `AuthShell`. Sem mudança de regras, API ou etapas. |
| 3.14.3 | Acesso e ambientes | Cartão de `/login`, `/forgot-password` e `/reset-password`: casco `AuthShell` (ícone + título, glow, campos com ícone, CTA largo). Partículas também em forgot/reset. Auth inalterada. |
| 3.14.2 | Acesso e ambientes | `/login`: fundo canvas de partículas conectadas (`ConnectedParticles`). Auth inalterada. Sem partículas em forgot/reset. |
| 3.14.1 | Acesso e ambientes | Recuperar senha: `expires_at` 1h no servidor; `POST /reset` recusa token vencido; novo forgot invalida links anteriores. `/reset-password` sem token ou 400 mostra **Link inválido ou expirado**. |
| 3.14.0 | Acesso e ambientes | Admin cadastra URL/usuário/senha do sistema em `/admin/access`. Cofre de `.env` teste/produção em `/admin/environments` só para `admin` (AES, reveal auditado, sem bootstrap). |
| 3.13.0 | Usuários | Ficha `/admin/users/:id`: editar nome/e-mail/papel/empresa/projetos/ativo e definir senha (`POST /v2/users/:id/password`). Lista mostra todos os papéis. `PATCH` grava e-mail único. |
| 3.12.3 | Cadastro cliente | Admin: Kanban em `/admin/chamados` (cards de chamado). Menu Tasks e Tarefas do cliente saem da UI. `/admin/tasks` e `/client/tasks` redirecionam. Tabela `tasks` permanece no banco. |
| 3.12.0 | Cadastro cliente | Ficha da empresa: nome, e-mail, telefone e WhatsApp obrigatórios; CNPJ, empresa, segmento e observações opcionais. Admin cria/edita em `/admin/clients`; CLIENT completa em `/client/profile`. `PATCH /v2/clients/:id` com ownership (404 em outro tenant). Consulta CNPJ via backend (`GET /v2/clients/cnpj/:cnpj`). |
| 3.11.1 | Chamados | Quem abriu o chamado pode **Editar** tipo/título/campos só enquanto está em Correção e ninguém moveu a etapa. Outra pessoa (mesmo admin) não edita. Reaberto não volta a ser editável. `PATCH /v2/tickets/:id/content`. |
| 3.11.0 | Chamados | Time pede informação no card; selo **Aguardando resposta [nome]** até o cliente responder. `POST /v2/tickets/:id/messages`; overlay `awaiting_reply_from_user_id` (não é nova etapa). |
| 3.10.1 | Acesso e ambientes | Admin cadastra URL/usuário/senha do sistema em `/admin/access`. Cofre de `.env` teste/produção em `/admin/environments` só para `admin` (AES, reveal auditado, sem bootstrap). |
| 3.9.0 | Cadastro cliente | Ficha da empresa: nome, e-mail, telefone e WhatsApp obrigatórios; CNPJ, empresa, segmento e observações opcionais. Admin cria/edita em `/admin/clients`; CLIENT completa em `/client/profile`. `PATCH /v2/clients/:id` com ownership (404 em outro tenant). Consulta CNPJ via backend (`GET /v2/clients/cnpj/:cnpj`). |
| 3.7.3 | Chamados | Chamado resolvido (cliente): **Ainda não está ok** em `danger` + `lg`; título da nota maior; subtítulo vermelho “volta para Correção”; **Reabrir chamado** deixa de ser `sm`. Confirmar sobe para `lg`. Sem mudança de API. |
| 3.7.2 | Chamados | Imagens opcionais (PNG/JPG/WebP, até 4 × 2 MB) na abertura do chamado. Sem campo Prazo desejado. Anexos em `ticket_attachments`, não em Arquivos. |
| 3.7.0 | Arquivos | Arquivos em pastas: card do projeto → card da categoria (Documentação, Nota fiscal, Outros…) → lista com data `dd/mm/aaaa`. Menu Docs removido; `/client/documentation` e `/admin/documentation` redirecionam para Arquivos. Fichas `documents` aparecem na pasta Documentação do projeto. |
| 3.6.6 | Live | Chamado resolvido (cliente): **Ainda não está ok** em `danger` + `lg`; título da nota maior; subtítulo vermelho “volta para Correção”; **Reabrir chamado** deixa de ser `sm`. Confirmar sobe para `lg`. Sem mudança de API. |
| 3.6.5 | Live | Portal atualiza na hora via SSE (`GET /v2/events`) em chamado/update/arquivo/projeto. E-mail de chamado no `users.email` do CLIENT. Poll 30s de reserva. |
| 3.6.5 | Chamados | Imagens opcionais (PNG/JPG/WebP, até 4 × 2 MB) na abertura do chamado. Sem campo Prazo desejado. Anexos em `ticket_attachments`, não em Arquivos. |
| 3.6.3 | Live | Portal atualiza na hora via SSE (`GET /v2/events`) em chamado/update/arquivo/projeto. E-mail de chamado no `users.email` do CLIENT. Poll 30s de reserva. |
| 3.6.4 | Avisos | Toque no alerta PWA/SO abre o href e um `CenterNotice` com título/corpo. Admin `POST /v2/notifications` e updates visíveis também disparam Web Push. `href` só path relativo. Lista do sino não mostra popup. |
| 3.6.1 | Avisos | Toque no alerta PWA/SO abre o href e um `CenterNotice` com título/corpo. Admin `POST /v2/notifications` e updates visíveis também disparam Web Push. `href` só path relativo. Lista do sino não mostra popup. |
| 3.6.0 | Usuários | Ficha `/admin/users/:id`: editar nome/e-mail/papel/empresa/projetos/ativo e definir senha (`POST /v2/users/:id/password`). Lista mostra todos os papéis. `PATCH` grava e-mail único. |
| 3.5.2 | Avisos | Toque no alerta PWA/SO abre o href e um `CenterNotice` com título/corpo. Admin `POST /v2/notifications` e updates visíveis também disparam Web Push. `href` só path relativo. Lista do sino não mostra popup. |
| 3.5.1 | Live | Admin: Kanban em `/admin/chamados` (cards de chamado). Menu Tasks e Tarefas do cliente saem da UI. `/admin/tasks` e `/client/tasks` redirecionam. Tabela `tasks` permanece no banco. |
| 3.5.0 | Live | Chamado/update/arquivo/projeto: SSE `GET /v2/events` atualiza o portal na hora (sem F5). Poll 30s fica de reserva. E-mail de chamado continua no `users.email` do CLIENT. |
| 3.4.8 | Atividade recente | Círculo com iniciais + nome no header abre o perfil (`/client/profile` ou `/admin/profile`). Sair continua só logout. `PATCH /v2/auth/me` só altera o próprio nome. |
| 3.4.7 | Atividade recente | Home `/client` com 2+ sistemas: anéis empilhados; Agora/Próximo só ao expandir o card (um aberto por vez). 1 sistema continua com a narrativa visível. |
| 3.4.6 | Atividade recente | Home `/admin`: Atividade recente lista até 40 updates em área com scroll; card mostra tipo, status, visibilidade, empresa, data; clique abre modal com texto completo. O mesmo detalhe vale em `/admin/updates` e na timeline do cliente (sem chip de visibilidade). |
| 3.4.2 | Arquivos | `PATCH /v2/users/:id` grava `role` + `client_id` juntos (`admin`/`manager` sem empresa; `client` com empresa). Ativar/desativar cliente não gera 500 no check `users_client_role_check`. |
| 3.4.1 | Arquivos | `npm test` usa `DATABASE_URL_TEST` (`nexus_test`) e recusa o banco da UI (`nexus`). Fixture Acme/Northwind só no banco de teste. |
| 3.4.0 | Arquivos | Admin cria categoria personalizada na hora do upload (nome 2–60). Vale só naquele projeto. Cliente vê chips das categorias que têm arquivo, além de Todos / Contrato e Documentação do Sistema / Outros. |
| 3.3.1 | Visão geral | Rótulos de tipo de update em português (Novidade, Correção, Melhoria, Versão nova, Documentação) no filtro, no badge e no Quick Update. Valores no banco continuam FEATURE/FIX/UPDATE/RELEASE/DOCUMENTATION. |
| 3.3.0 | Visão geral | Home `/admin`: KPIs oficiais (`GET /v2/admin/overview`), mix de status, fila Precisa de você, lista por sistema. Chamados aceitam `?stage=` / `?type=`. |
| 3.2.0 | Avisos | Boas-vindas ao criar usuário (sem senha no e-mail). Chamado: e-mail + in-app + Web Push em cada etapa (Correção, Produção, Resolvido, encerrar, reabrir). |
| 3.1.3 | Chamados | E-mails (reset de senha e atualização de projeto) usam HTML Avadesk e Resend quando `RESEND_API_KEY` está no `.env`. Sem e-mail ao criar usuário. |
| 3.1.2 | Chamados | Home `/client`: um anel de evolução estimada + Agora/Próximo **por projeto**; Antes continua agregado |
| 3.1.1 | Chamados | Login: `/api/hub/login` e GET `/api/hub/state` encaminham para `/v2` (PWA antigo). Service worker `avadesk-shell-v2` não cacheia `/login` nem `/api`. |
| 3.1.0 | Chamados | Cliente e admin abrem chamado (bug / implementação / funcionalidade / rotina). Card compacto que expande. Etapas Correção → Produção → Resolvido; só o cliente confirma (`closed`) |
| 3.0.4 | API relacional | `npm run seed` só garante `admin@clienthub.dev` (sem TRUNCATE). Login e “Usuário criado” usam diálogo central (`CenterNotice`), não toast de canto |
| 3.0.3 | API relacional | Login só em `users` (`admin@clienthub.dev`); Express `trust proxy` para o BFF |
| 3.0.2 | API relacional | Next `/api/hub/*` retorna 410; V1 `/projects` não devolve `access_password` |
| 3.0.1 | API relacional | Arquivos: categorias `contrato_documentacao` e `outro`; admin escolhe no upload |
| 3.0.0 | API relacional | Tabelas + `/v2` + BFF; UI deixa de usar snapshot completo e `userPasswords` |

## 3. Mapa de telas / conexões

```text
/login | /forgot-password | /reset-password | /invite
     ↓ POST /api/v2/auth/login (BFF → Express /v2)
/client/*  ← CLIENT            header avatar → /client/profile
/admin/*   ← ADMIN | MANAGER   header avatar → /admin/profile
/admin/access ← ADMIN | MANAGER
/admin/environments ← só ADMIN
/portal/*  → redirect → /client/*
```

## 4. Papéis e acesso

| Role DB | Role UI | Rotas | Isolamento |
|---------|---------|-------|------------|
| `admin` | ADMIN | `/admin/*` incl. Acesso e Ambientes | Todos os tenants (servidor) |
| `manager` | MANAGER | `/admin/*` exceto cofre `.env` | Idem; `GET/PUT/POST/DELETE .../env` → 403 |
| `client` | CLIENT | `/client/*` | `client_id` + `user_project_access` |

Cookie: `avadesk_session` e `nexus_session` (HMAC, HttpOnly). Middleware Next só verifica presença. Autorização real em cada rota `/v2`.

Seed: `npm run seed` **não apaga** clientes, usuários, projetos nem updates. Só faz INSERT de `admin@clienthub.dev` se o e-mail não existir, ou atualiza o hash da senha desse admin a partir de `SEED_PASSWORD` (padrão `Hub2026!`). Não existe script `seed:reset`. Login 401 se esse admin nunca foi criado (ex.: dump antigo só com `admin@acme.dev`). Express usa `trust proxy` 1 porque o BFF envia `X-Forwarded-For`.

## 5. Onde olhar no código

| Peça | Path |
|------|------|
| Migration relacional | `db/migrations/003_relational.sql` |
| Migration ficha cliente | `db/migrations/009_client_profile.sql` |
| Clientes API | `apps/api/src/v2/rest.ts` (`GET/POST/PATCH /v2/clients`, `GET /v2/clients/cnpj/:cnpj`) |
| Migration tickets | `db/migrations/004_tickets.sql` |
| Migration tipo Outra coisa | `db/migrations/011_ticket_type_other.sql` |
| Migration exclusão de usuário | `db/migrations/012_user_delete_and_file_crud.sql` (`updates.author_id` SET NULL) |
| Migration mensagens chamado | `db/migrations/008_ticket_messages.sql` |
| Chamados API | `apps/api/src/v2/tickets.ts` |
| PDF do chamado | `apps/api/src/lib/ticket-pdf.ts` (`GET /v2/tickets/:id/pdf`) |
| Kanban chamados | `apps/web/src/components/hub/ticket-board.tsx` |
| Concluídos (data) | `apps/web/src/components/hub/closed-tickets-panel.tsx` |
| Auth cookie | `apps/api/src/lib/auth.ts` |
| Cartão de acesso | `apps/web/src/components/hub/auth-shell.tsx` (`AuthShell` / `AuthCard` / `AuthField`) |
| Authz projeto | `apps/api/src/lib/access.ts` |
| Router v2 | `apps/api/src/v2/` |
| Overview admin | `apps/api/src/v2/overview.ts` (`GET /v2/admin/overview`) |
| Home admin | `apps/web/src/app/admin/page.tsx` |
| BFF | `apps/web/src/app/api/v2/[...path]/route.ts` |
| Client HTTP | `apps/web/src/lib/v2-client.ts` |
| Store | `apps/web/src/stores/hub-store.ts` |
| Credenciais AES | `apps/api/src/lib/crypto-secret.ts` |
| Cofre .env | `apps/api/src/v2/project-env.ts`, `db/migrations/010_project_env_vault.sql` |
| Admin Acesso | `apps/web/src/app/admin/access/page.tsx` |
| Admin Ambientes | `apps/web/src/app/admin/environments/page.tsx` |
| Migration push | `db/migrations/005_push_and_outbox.sql` |
| Outbox | `apps/api/src/lib/email.ts` |
| Templates de e-mail | `apps/api/src/lib/email-templates.ts` |
| Notify (in-app + e-mail + push) | `apps/api/src/lib/notify.ts` |
| Live SSE | `apps/api/src/lib/live.ts`, `apps/api/src/v2/events.ts` (`GET /v2/events`) |
| Sync UI | `apps/web/src/lib/hub-sync.ts` (EventSource + poll 30s) |
| Web Push | `apps/api/src/lib/push.ts`, `apps/api/src/v2/push.ts`, `apps/api/src/lib/push-href.ts` |
| Popup toque PWA | `apps/web/src/components/hub/push-notice-host.tsx`, `apps/web/public/sw.js` (`avadesk-shell-v6`) |
| Inscrição push | `apps/web/src/lib/web-push-subscribe.ts`, `apps/web/src/components/pwa-register.tsx` |
| Dev web | `apps/web/package.json` → `next dev --port 3000` (sem Turbopack; porta extra falha em vez de 3001+) |
| Migrate hub_state | `apps/api/src/scripts/migrate-hub-state.ts` |
| Tokens dos temas | `apps/web/src/app/globals.css` (`:root` / `[data-theme="light"]` e `[data-theme="dark"]`) |
| Runtime do tema | `apps/web/src/lib/theme.ts`, `apps/web/src/components/theme-provider.tsx` |
| UI do tema | `apps/web/src/components/hub/theme-toggle.tsx` (header), `theme-picker.tsx` (Configurações) |

### Auth

| Tela | Path | Código |
|------|------|--------|
| Login | `/login` | `app/login/` → `POST /api/v2/auth/login`; título **Acesse sua conta**; aviso `Olá, {nome}` em `CenterNotice`; casco `AuthShell` + `ConnectedParticles` |
| Diálogo central | overlay | `apps/web/src/components/hub/center-notice.tsx` |
| Esqueci senha | `/forgot-password` | `POST /v2/auth/forgot` (mensagem genérica). Mesmo casco + partículas. Outbox HTML Avadesk + `flushOutbox` |
| Reset | `/reset-password?token=` | `POST /v2/auth/reset` (token hash, one-shot, 1h). Mesmo casco + partículas |
| Usuários | `/admin/users` | `app/admin/users/page.tsx` — lista todos os papéis; `GET /v2/users` hidrata `projectIds`; criar em `CenterNotice` |
| Ficha do usuário | `/admin/users/:id` | `app/admin/users/[id]/page.tsx` — `GET/PATCH /v2/users/:id` + `POST /v2/users/:id/password` |
| Perfil (header) | `/client/profile` · `/admin/profile` | Leitura default; Editar → `OwnProfileCard` / ficha; `PATCH /v2/auth/me` |
| Clientes | `/admin/clients` | `app/admin/clients/page.tsx` + `[id]/page.tsx` — ficha em `clients` |

### Client / Admin

Rotas UI permanecem `/client/*` e `/admin/*`. Home admin: **Visão geral** (`/admin`). Kanban de chamados: `/admin/chamados`. Cliente: `/client/chamados` (lista). `/admin/tasks` e `/client/tasks` redirecionam. Bottom nav cliente: Início / Evolução / Acesso. Header: círculo com iniciais + nome → `/client/profile` (CLIENT) ou `/admin/profile` (ADMIN/MANAGER). No portal, o header **não** mostra o papel `CLIENT`; staff continua vendo `ADMIN`/`MANAGER` abaixo do nome. O botão Sair ao lado só faz logout.

## 6. Telas e fluxos

### 6.1 Login

E-mail + senha → BFF grava cookie HttpOnly em :3000 → diálogo no **centro** da tela (`Olá, {primeiro nome}`) com **Fechar** (pode fechar sozinho em ~3s só neste fluxo) → depois `/admin`, `/client` ou onboarding. Erro de validação fica inline no formulário. Rate limit no login. Cartão: ícone + **Acesse sua conta**, campos com ícone interno, CTA **Entrar →**; marca **Avadesk** no rodapé do card (`apps/web/src/components/hub/auth-shell.tsx`). Fundo decorativo: canvas de partículas conectadas (cor do token `--particles-rgb`, acompanha o tema ativo); `pointer-events: none`; pausa com aba oculta; estático se `prefers-reduced-motion` (`connected-particles.tsx`). O mesmo casco e o canvas valem em `/forgot-password`, `/reset-password`, `/invite` e `/client/onboarding` (**Complete seu cadastro**). Telas autenticadas (sidebar, `PageHeader` com ícone, cards `hub-surface`, tabelas, KPIs, modais `hub-dialog`, kanban) usam os mesmos tokens de borda/glow; **não muda regras**.

### 6.1.1 Usuários (admin)

Lista em `/admin/users` mostra **todos** os papéis. Empty state só quando não há nenhum usuário. Filtro local Todos / CLIENT / MANAGER / ADMIN + busca nome/e-mail: filtro vazio mostra texto curto, não esconde a página. Nome e **Editar** levam à ficha `/admin/users/:id`. **Excluir** (lista e ficha) pede confirmação e chama `DELETE /v2/users/:id` — some o login; e-mail fica livre. Não dá para excluir a própria conta (400). MANAGER não exclui ADMIN (403). Último usuário `role=admin` não é excluído (409). Updates antigos ficam com `author_id` nulo (UI: **Autor removido**). Criar usuário: sucesso abre diálogo no **centro** com e-mail, senha temporária, **Copiar acesso** e **Fechar**. Também dispara e-mail de **boas-vindas** (agradecimento, como usar o portal, CTA `/login`). **A senha não vai no e-mail.** Switch **Ativo** na lista chama `PATCH /v2/users/:id` sem soltar o `client_id` do CLIENT. Desativar ou rebaixar o último **admin ativo** → 409. Reusar um e-mail já cadastrado atualiza o registro (promover a ADMIN/MANAGER zera a empresa).

Ficha: seções Identidade, Acesso, Conta (**Salvar alterações** → `PATCH`) e Senha (**Definir senha** → `POST /v2/users/:id/password`, 8–200, rate limit 10/15 min). Senha nova aparece uma vez no `CenterNotice` (copiar). Hash nunca volta na API. Cookie HMAC antigo pode valer até 7d; desativar a conta bloqueia o próximo request.

| Aba / seção | Campo | O que é | Obrigatório | Quem preenche | De onde vem | Para onde conecta | Como funciona | Regra / bloqueio | Onde olhar no código |
|-------------|-------|---------|-------------|---------------|-------------|-------------------|---------------|------------------|----------------------|
| Lista | Filtro papel | Todos / CLIENT / MANAGER / ADMIN | Não | Staff | local | tabela | Esconde linhas, não a página | Empty do filtro ≠ empty global | `apps/web/src/app/admin/users/page.tsx` |
| Lista | Busca | Nome ou e-mail | Não | Staff | local | tabela | `includes` case-insensitive | — | `apps/web/src/app/admin/users/page.tsx` |
| Lista | Editar | Link da ficha | Sim | Staff | `User.id` | `/admin/users/:id` | `GET /v2/users/:id` | CLIENT 403 | `apps/web/src/app/admin/users/[id]/page.tsx` |
| Lista / ficha | Excluir | Apaga o login | Não | Staff | `User.id` | `DELETE /v2/users/:id` | Modal de confirmação; some da lista | Própria conta 400; MANAGER→ADMIN 403; último admin 409 | `apps/api/src/v2/rest.ts` |
| Identidade | Nome | Nome de exibição | Sim (edição) | Staff | `users.name` | PATCH | Recalcula iniciais | 1–120 | `apps/api/src/v2/rest.ts` |
| Identidade | E-mail | Login | Sim | Staff | `users.email` | PATCH | `lower/trim`; unique | 400 se outro id já usa | `PATCH /v2/users/:id` |
| Acesso | Papel | ADMIN / MANAGER / CLIENT | Sim | Staff | `users.role` | PATCH | Staff zera empresa | CLIENT exige `clientId` | `users_client_role_check` |
| Acesso | Empresa / projetos | Escopo CLIENT | Condicional | Staff | `client_id` + `user_project_access` | PATCH | “Todos” ou lista | Sem projeto marcado e sem “todos” → toast | ficha |
| Conta | Ativo | Liga/desliga login | Sim | Staff | `users.active` | PATCH | Inativo → 401 no próximo request | CLIENT 403; último admin ativo → 409 | `getUserFromRequest` |
| Senha | Nova / Confirmar / Gerar | Define hash | Sim no bloco | Staff | form | `POST /v2/users/:id/password` | bcrypt 12; diálogo com senha uma vez | min 8; sem e-mail; rate limit | `apps/web/src/app/admin/users/[id]/page.tsx` |

### 6.1.2 Recuperar senha

`/forgot-password` → `POST /v2/auth/forgot`. Resposta sempre genérica. Se o usuário existir e estiver ativo: token 1h (hash, one-shot), **invalida tokens anteriores não usados** desse usuário + `email_outbox` com HTML Avadesk + `flushOutbox`. Sem `RESEND_API_KEY`, a linha fica `logged`. Com o remetente sandbox `onboarding@resend.dev`, o Resend só entrega para o e-mail da conta Resend (outro destinatário → `failed`). Link: `/reset-password?token=`. `POST /v2/auth/reset` só aceita `used_at IS NULL AND expires_at > NOW()` — depois de 1 hora o servidor recusa e a senha não muda. Sem token na URL, ou 400 no reset, a tela mostra **Link inválido ou expirado** e **Pedir novo link** (`/forgot-password`).

| Aba / seção | Campo | O que é | Obrigatório | Quem preenche | De onde vem | Para onde conecta | Como funciona | Regra / bloqueio | Onde olhar no código |
|-------------|-------|---------|-------------|---------------|-------------|-------------------|---------------|------------------|----------------------|
| Esqueci senha | E-mail | Destino do link | Sim | Usuário | form | `POST /v2/auth/forgot` | Sempre a mesma mensagem | Rate limit; não enumera cadastro | `apps/web/src/app/forgot-password/page.tsx` |
| E-mail | CTA Redefinir senha | Link 1h | — | Sistema | `password_reset_tokens` | `/reset-password?token=` | HTML Avadesk via outbox/Resend | Token hash; one-shot; pedido novo invalida o anterior | `apps/api/src/lib/email-templates.ts` |
| Nova senha | Senha / Confirmar | 8+ caracteres | Sim | Usuário | form | `POST /v2/auth/reset` | Atualiza hash e marca token usado | Token inválido/expirado → **Link inválido ou expirado** (servidor: `expires_at > NOW()`) | `apps/web/src/app/reset-password/reset-form.tsx` |

### 6.2 Client Início (ANTES / AGORA / PRÓXIMO)

Um anel de evolução estimada (não é prazo) **por projeto** vinculado à conta. Com 1 sistema, o título da página é o nome do projeto; anel, **Agora** e **Próximo** ficam visíveis. Com 2+, o título é a empresa (`client.company`) ou “Seus sistemas”; cada card compacto traz nome, status, anel e **Ver projeto**; **Agora** e **Próximo** só aparecem ao clicar no card (um aberto por vez). **Antes** = timeline visível agregada de todos os sistemas; primeiro acesso não diz “0 updates”. Bloco de releases só se houver.

Currently building: campos explícitos do projeto, senão último update visível `em_andamento`. Próximo: campos explícitos, senão último `planejado`. Código: `apps/web/src/app/client/page.tsx`.

| Aba / seção | Campo | O que é | Obrigatório | Quem preenche | De onde vem | Para onde conecta | Como funciona | Regra / bloqueio | Onde olhar no código |
|-------------|-------|---------|-------------|---------------|-------------|-------------------|---------------|------------------|----------------------|
| Header | Título | 1 projeto = nome; N = empresa ou “Seus sistemas” | Sim | Sistema | `clientProjects` / `client.company` | — | Identifica o tenant na home | Sem projetos → empty state | `apps/web/src/app/client/page.tsx` |
| Card do sistema | Anel Progresso | `%` circular `progressPct` | Sim | Admin no projeto | `Project.progressPct` | `/client/projects/:id` | Um anel por sistema; anel, número e barras usam `--progress` (verde), não o accent azul | Disclaimer se não houver `summary` | `apps/web/src/components/hub/progress.tsx` |
| Card do sistema | Agora / Próximo | Narrativa daquele projeto | Não | Admin | `currentlyBuilding` / `nextSteps` | Detalhe do projeto | 1 sistema: sempre visível. 2+: no expandir do card; um aberto por vez | Textos vazios se não houver dados | `apps/web/src/app/client/page.tsx` (`SystemProgressCard`) |
| Antes | Timeline | Updates visíveis de todos os sistemas | Não | Admin (visível ao cliente) | `visibleUpdates` | `/client/updates` e `/client/projects/:id` | Agregada; clique no card abre o modal de detalhe (sem visibilidade interna) | Primeiro acesso: espera, não “0” | `apps/web/src/app/client/page.tsx` |

### 6.3 Admin visão geral

Home `/admin` (menu Início). Título **Visão geral**. Totais oficiais vêm de `GET /v2/admin/overview` (staff). Listas e tabela usam o bootstrap. Pausado não é PARADO. Publicado/manutenção sem novidade = “sem novidade”, não PARADO. `last_client_update_at` = max update visível. Stale no SQL: `last_client_update_at` não nulo e >7 dias, status ativo (não paused/published/maintenance).

| Aba / seção | Campo | O que é | Obrigatório | Quem preenche | De onde vem | Para onde conecta | Como funciona | Regra / bloqueio | Onde olhar no código |
|-------------|-------|---------|-------------|---------------|-------------|-------------------|---------------|------------------|----------------------|
| KPIs | Parados | Sistemas ativos sem novidade visível >7d | Sim | Cálculo | `GET /v2/admin/overview` | `#precisa` | Card com tom warning se >0 | Só ADMIN/MANAGER; CLIENT 403 | `apps/api/src/v2/overview.ts` |
| KPIs | Chamados abertos | Tickets `stage <> closed` | Sim | Cálculo | overview `tickets.open` | `/admin/chamados?stage=fix` | Hint com bugs abertos | Snapshot da lista = bootstrap até 100 abertos | `apps/web/src/app/admin/page.tsx` |
| KPIs | Aguard. cliente | Tickets `resolved` | Sim | Cálculo | overview `byStage.resolved` | `/admin/chamados?stage=resolved` | Deep link foca a coluna no quadro | Só cliente confirma (`closed`) | `apps/web/src/app/admin/chamados/page.tsx` |
| KPIs | Sistemas no ar | `published + maintenance` | Sim | Cálculo | overview `byStatus` | `/admin/projects` | Não inclui paused/dev | Arquivados fora | `apps/web/src/lib/admin-overview.ts` |
| Portfólio | Mix de status | Contagem por status | Sim | Cálculo | `systems.byStatus` | — | Barra empilhada + chips | Soma = total não arquivado | `apps/web/src/components/hub/status-mix.tsx` |
| Precisa de você | Fila | Stale + bug em correção + resolved | Não | Sistema | store (projects/tickets) | projeto ou chamados | CTA Atualizar / Chamado / Abrir | Empty: nada parado | `buildNeedYouItems` |
| Sistemas | Tabela / cards | Uma linha por projeto | Não | Admin cadastro | store + tickets abertos | `/admin/projects/:id` | Desktop tabela; mobile cards | Busca + filtro de status | `apps/web/src/app/admin/page.tsx` |
| Atividade | Timeline | Até 40 updates | Não | Admin | store `updates` | `/admin/updates` | Scroll + modal de detalhe | — | `apps/web/src/components/hub/timeline.tsx` |

Erro do overview: banner + números aproximados do store. Loading: skeleton nos KPIs. Empty de portfólio: CTA Criar cliente. Quick Update e ⌘K inalterados.

### 6.4 Quick Update

Lock de double-submit, header `Idempotency-Key`, toast publicado vs e-mail em seguida.

### 6.5 Acesso

Lista **sem senha**. `POST /v2/projects/:id/credentials/reveal` + audit `credential_revealed`. Rate limit 30/min. URL do sistema só `http:`/`https:`.

**Admin** (`/admin/access`, ADMIN e MANAGER): cadastra URL, usuário e senha por projeto (`PATCH /v2/projects/:id`). Senha vazia **mantém** a atual. O cliente passa a ver os mesmos dados em `/client/access`.

| Aba / seção | Campo | O que é | Obrigatório | Quem preenche | De onde vem | Para onde conecta | Como funciona | Regra / bloqueio | Onde olhar no código |
|-------------|-------|---------|-------------|---------------|-------------|-------------------|---------------|------------------|----------------------|
| Admin Acesso | URL do sistema | Endereço que o cliente abre | Não | Staff | form | `project_credentials.system_url` | Lista + link no cliente | Só http(s); `javascript:` → 400 | `apps/web/src/app/admin/access/page.tsx` |
| Admin Acesso | Usuário | Login do sistema entregue | Não | Staff | form | `access_user` | Visível na lista | — | `apps/api/src/v2/projects-updates.ts` |
| Admin Acesso | Senha | Senha do sistema | Não | Staff | form | `password_ciphertext` AES | Reveal auditado | Lista nunca devolve plaintext | `crypto-secret.ts` |
| Cliente Acesso | Revelar | Mostra senha agora | — | Cliente do projeto | POST reveal | auditoria | Olho / copiar | Outro tenant 404 | `apps/web/src/app/client/access/page.tsx` |

### 6.5.1 Ambientes (.env)

Só **ADMIN** (`role = admin`). MANAGER e CLIENT: API **403**; menu Ambientes oculto para gerente. Conteúdo **não** entra no bootstrap, overview, logs nem listagens.

Criptografia AES-256-GCM (`CREDENTIALS_KEY`, mesma chave das senhas de acesso). Dois ambientes por projeto: `test` e `production`. Copiar é local (clipboard) após reveal.

| Aba / seção | Campo | O que é | Obrigatório | Quem preenche | De onde vem | Para onde conecta | Como funciona | Regra / bloqueio | Onde olhar no código |
|-------------|-------|---------|-------------|---------------|-------------|-------------------|---------------|------------------|----------------------|
| Ambientes | Teste / Produção | Abas do cofre | Sim (um por vez) | Admin | UI | `project_env_vault.environment` | Metadados no GET; texto só no reveal | Enum `test`\|`production` | `apps/web/src/app/admin/environments/page.tsx` |
| Ambientes | Conteúdo | Texto do `.env` | Sim ao salvar | Admin | textarea | `ciphertext` | PUT criptografa; DELETE limpa | 1–65536 chars; vazio → 400 | `apps/api/src/v2/project-env.ts` |
| Ambientes | Revelar / Copiar | Ver e colar no servidor | — | Admin | POST reveal | auditoria `env_revealed` | Some de novo em 2 min na UI | Rate limit 30/min; 403 não-admin | idem |

Endpoints: `GET /v2/projects/:id/env`, `PUT /v2/projects/:id/env/:environment`, `POST .../reveal`, `DELETE`. Audit `env_saved` / `env_revealed` / `env_cleared` com `meta` = ambiente, nunca o texto. Migration: `db/migrations/010_project_env_vault.sql`.

### 6.6 Arquivos / releases

Arquivos no disco, download autenticado. Admin CRUD de releases em `/admin/releases`. Notificações persistidas.

**Arquivos** (`/admin/files` upload + editar/excluir, `/client/files` leitura). Três níveis na UI (query `?project=` e `?category=`): cards de **projeto** → cards de **pasta/categoria** → lista de arquivos com data absoluta. Categorias de sistema persistidas: `contrato_documentacao` (rótulo de pasta **Documentação**; no banco o nome longo continua “Contrato e Documentação do Sistema”) e `outro` (**Outros**). O admin cria **categoria personalizada** no upload (`Nova categoria…` + nome, ex. Nota fiscal); o slug vai em `files.category` e o nome em `files.category_label`. A categoria nova **só reaparece no mesmo projeto**. Cliente só vê pastas com pelo menos 1 item. Admin vê pastas de sistema mesmo vazias para poder enviar. Fichas versionadas (`documents`) entram na pasta Documentação daquele projeto. Staff **renomeia**, **move de pasta** (`PATCH /v2/files/:id`) e **exclui** (`DELETE /v2/files/:id`: disco + linha; audit `delete_file`). Não troca o binário nem o projeto. Fichas: `PATCH` título e `DELETE /v2/documents/:id` (não apaga o `files` ligado). Menu **Docs** não existe; `/client/documentation` e `/admin/documentation` redirecionam para Arquivos. Manuais novos: upload de arquivo na pasta Documentação.

| Aba / seção | Campo | O que é | Obrigatório | Quem preenche | De onde vem | Para onde conecta | Como funciona | Regra / bloqueio | Onde olhar no código |
|-------------|-------|---------|-------------|---------------|-------------|-------------------|---------------|------------------|----------------------|
| Admin Arquivos | Card do projeto | Pasta do sistema | Sim (nível 1) | — | `projects` | `?project=` | Clique abre as categorias | Projeto fora da lista → nível 1 | `apps/web/src/app/admin/files/page.tsx` |
| Admin Arquivos | Card da categoria | Pasta (Documentação, Outros, custom) | Sim (nível 2) | Admin no upload | `files.category` + `documents` | `?category=` | Clique lista os arquivos | Custom só se já houver arquivo; sistema vazio aparece para staff | `apps/web/src/lib/file-folders.ts` |
| Admin Arquivos | Categoria (envio) | Classificação no upload | Sim (default Documentação) | Admin | select + arquivos do projeto | `files.category` | Sistema, custom já usadas neste projeto, ou Nova categoria… | POST `/v2/files` valida slug/label; no nível 3 o envio fica preso à pasta | `apps/api/src/lib/file-category.ts` |
| Admin Arquivos | Nome da categoria | Rótulo da pasta nova | Condicional | Admin | input | `files.category_label` | Gera slug (ex. Nota fiscal → `nota_fiscal`) | 2–60 chars; sem controle; slug reservado → 400; upload bloqueado se vazio | `apps/web/src/app/admin/files/page.tsx` |
| Cliente Arquivos | Card do projeto | Sistemas que o login vê | Sim | — | `clientAccessibleProjects` | `?project=` | Um card por projeto (mesmo vazio) | UUID fora do tenant é ignorado (volta ao nível 1, sem 404) | `apps/web/src/app/client/files/page.tsx` |
| Cliente Arquivos | Card da categoria | Pastas com arquivo/doc | Não | Admin no upload | arquivos + docs do projeto | `?category=` | Clique abre a lista com data `dd/mm/aaaa` | Sem chip Todos; pasta vazia não aparece | idem |
| Cliente Arquivos | Lista | Nome, tamanho, data, baixar | — | Admin | `files` / `documents` | `GET /v2/files/:id/download` | Ordenado do mais recente | Download só com sessão e projeto acessível; sem Editar/Excluir | `apps/web/src/components/hub/cards.tsx` |
| Admin Arquivos | Editar arquivo | Nome e pasta | Sim no modal | Staff | `files` | `PATCH /v2/files/:id` | Modal; move some da pasta atual | Qualquer CLIENT 403 (rota staff); download de outro tenant 404 | `apps/api/src/v2/rest.ts` |
| Admin Arquivos | Excluir arquivo | Some do disco e da lista | Não | Staff | `files.id` | `DELETE /v2/files/:id` | Modal de confirmação | CLIENT 403; path só UUID; ENOENT segue | idem |
| Admin Arquivos | Ficha legado | Título / exclusão | Título no editar | Staff | `documents` | `PATCH`/`DELETE /v2/documents/:id` | Pasta Documentação | Não apaga o arquivo ligado | `apps/web/src/app/admin/files/page.tsx` |

Categorias antigas (`contrato` → `contrato_documentacao`; `briefing` / `design` / `entrega` / desconhecido → `outro`) são normalizadas na leitura. Slug custom válido não é convertido para `outro`. Coluna `category_label`: `db/migrations/006_file_category_label.sql`.

### 6.7 Chamados

Lista em `/client/chamados`. O cliente só escolhe **Bug** ou **Outra coisa** (ícones no formulário). Staff em `/admin/chamados` usa **Kanban** (colunas Correção / Produção / Aguardando cliente) e ainda abre Implementação, Funcionalidade nova e Rotina, além dos dois tipos do portal. Encerrados **não** entram na lista/quadro: ficam no painel **Concluídos** (De / Até = data em que o cliente confirmou), abaixo do quadro, com borda verde. Visual do quadro: borda/glow e título coloridos por etapa (azul / roxo / âmbar). Filtros Projeto/Tipo/Pendência ficam na mesma faixa do CTA **Abrir chamado**. CTA no projeto do cliente (`/client/projects/[id]`). Card compacto no quadro; clique no cabeçalho expande o contexto (um aberto por vez). Tasks internas saíram da UI; `/admin/tasks` redireciona para chamados.

| Aba / seção | Campo | O que é | Obrigatório | Quem preenche | De onde vem | Para onde conecta | Como funciona | Regra / bloqueio | Onde olhar no código |
|-------------|-------|---------|-------------|---------------|-------------|-------------------|---------------|------------------|----------------------|
| Novo chamado | Tipo | Cliente: Bug ou Outra coisa. Staff: também Implementação, Funcionalidade nova, Rotina | Sim | Cliente ou admin | select | `tickets.type` | Troca os campos do formulário | CLIENT POST/PATCH `implementation`/`feature`/`routine` → 403 (exceto PATCH que mantém o tipo legado). API rejeita `fields` de outro tipo | `apps/web/src/components/hub/ticket-form.tsx` |
| Novo chamado | Título | Nome do card | Sim (Bug e tipos do staff) | Quem abre | input | `tickets.title` | Aparece no card compacto | 1–200 chars. Em Outra coisa o título **é** o nome (`fields.customName`) | `apps/api/src/v2/tickets.ts` |
| Bug | O que está acontecendo / Onde | Relato | Sim | Quem abre | form | `tickets.fields` JSONB | Só no expandido | `problem` + `where` | idem |
| Outra coisa | Como você chama isso? / O que você precisa? | Pedido livre | Sim | Quem abre | form | `fields.customName` `fields.what` | Nome vira título do card | Nome 2–60; detalhe 1–4000 | idem |
| Implementação | O que / Por quê | Pedido | Sim | Staff | form | `fields.what` `fields.why` | Expandido | Sem prazo desejado; CLIENT 403 | idem |
| Novo chamado | Imagens | Prints opcionais | Não | Quem abre | file | `ticket_attachments` | Até 4 PNG/JPG/WebP, 2 MB; thumbs no card | SVG/PDF 400; outro tenant 404 | `POST /v2/tickets/:id/attachments` |
| Feature | O que o usuário passa a fazer | Pedido | Sim | Quem abre | form | `fields.whatUserDoes` | Expandido | — | idem |
| Rotina | Qual rotina / O que muda | Pedido | Sim | Quem abre | form | `fields.routineName` `fields.whatChanges` | Expandido | — | idem |
| Admin quadro | Colunas | fix / production / resolved | — | Admin arrasta | PATCH | `tickets.stage` | HTML5 DnD pelo puxador; um passo | Sem coluna Encerrados; salto: toast, sem PATCH | `ticket-board.tsx` |
| Concluídos | De / Até | Arquivo dos encerrados | Sim (na consulta) | Admin ou cliente | date | `client_confirmed_at` | `GET /v2/tickets?stage=closed&from=&to=` | Sem datas = 400; intervalo máx. 366 dias; limite 100 | `closed-tickets-panel.tsx` |
| Card | Etapas | fix / production / resolved | — | Admin move | PATCH | `tickets.stage` | Spinner na atual; V verde nas feitas e em Resolvido; botões no expandido | Não pula etapa; não vai a `closed` | `ticket-card.tsx` |
| Card expandido | Editar | Corrige tipo, título e campos | Condicional | Quem abriu | PATCH content | `tickets.type` `title` `fields` | Botão só se intacto; form no card | Não-autor 403; outro tenant 404; já iniciado/reaberto 409 | `PATCH /v2/tickets/:id/content` |
| Card expandido | Baixar PDF | Demanda para o Cursor | Não | Só staff (admin/manager) | GET | arquivo gerado | Texto com rótulos do form + histórico + conversa + nomes das imagens | CLIENT 404 (sem botão); outro tenant 404; sem sessão 401; 30/min (não-staff); não é anexo | `GET /v2/tickets/:id/pdf` |
| Aviso | E-mail + in-app + push | Copy da etapa (Produção, Resolvido, etc.) | — | Sistema | `notifyUsers` | outbox + `notifications` + Web Push | Omite o ator; falha de envio não desfaz o PATCH | Tenant / staff | `apps/api/src/lib/notify.ts` |
| Card expandido | Confirmar | Cliente diz que está ok | Condicional | CLIENT | POST confirm | `stage=closed` | `accent` + `lg`; `flex-wrap` + texto quebra no botão; só se `resolved` | Admin 403; outro tenant 404 | `POST /v2/tickets/:id/confirm` |
| Card expandido | Ainda não está ok | Abre o formulário de reabertura | Condicional | CLIENT | clique | formulário no card | `danger` + `lg`; mesmo grupo wrap; só se `resolved` | Admin não vê | `ticket-card.tsx` |
| Card expandido | O que ainda não está ok? | Motivo da reabertura | Sim (no form) | CLIENT | textarea | POST reopen | Título `text-base`; subtítulo vermelho: volta para Correção | Botão **Reabrir chamado** disabled sem texto | `POST /v2/tickets/:id/reopen` |
| Card compacto | Selo | Pendência de resposta | Condicional | Sistema | `awaiting_reply_from_user_id` | nome do destinatário | Texto **Aguardando resposta {nome}** | Some quando o cliente responde | `ticket-card.tsx` |
| Card expandido | Pedir informação | Pergunta ao cliente | Sim (no envio) | admin/manager | textarea + destinatário | `ticket_messages` kind=request | Sempre marca pendência | Chamado `closed` 409; sem CLIENT no projeto 400 | `POST /v2/tickets/:id/messages` |
| Card expandido | Destinatário | Quem deve responder | Condicional | Admin | select | `waitForUserId` | Padrão: quem abriu, se for CLIENT | Só CLIENT do mesmo tenant/projeto | `ticket-card.tsx` |
| Card expandido | Conversa | Thread de pedido/resposta | — | Time e cliente | `ticket_messages` | lista no card | Texto puro (`whitespace-pre-wrap`) | Sem HTML | `ticket-card.tsx` |
| Card expandido | Resposta | Cliente responde a pendência | Sim (no envio) | CLIENT | textarea | kind=reply | Limpa `awaiting_reply_from_user_id`; CLIENT pode complementar mesmo sem pendência | Outro tenant 404; `closed` 409; 30/h | `POST /v2/tickets/:id/messages` |
| Admin filtro | Pendência | Só aguardando resposta | Não | Admin | select | overlay, não `stage` | Distinto de coluna Aguardando cliente (`resolved`) | `?awaiting=1` | `apps/web/src/app/admin/chamados/page.tsx` |
| Admin origem | Relato do cliente | Chamado criado por você | Não | Admin | radio | `tickets.origin` | `admin_report` ou `portal` | CLIENT sempre `portal` | `/admin/chamados` |
| Filtro URL | `?stage=` | Foco da coluna ou arquivo | Não | Deep link KPI | query | `fix`/`production`/`resolved` destacam coluna; `closed` abre **Concluídos** (mês atual) | Não esconde as outras colunas abertas | `?type=` ainda filtra | `apps/web/src/app/admin/chamados/page.tsx` |
| Live | Tela do cliente | Badge/status sem F5 | — | Sistema | SSE `hub.changed` | `GET /v2/events` → bootstrap | Toast “Chamado atualizado” em `/client/*` (1x/5s); card expandido permanece | Sem sessão 401; outro tenant não recebe | `apps/web/src/lib/hub-sync.ts` |

Endpoints: `GET/POST /v2/tickets`, `GET/PATCH /v2/tickets/:id`, `GET /v2/tickets/:id/pdf`, `PATCH /v2/tickets/:id/content`, `POST /v2/tickets/:id/confirm`, `POST /v2/tickets/:id/reopen`, `POST /v2/tickets/:id/messages`, `POST /v2/tickets/:id/attachments`, `GET /v2/tickets/:id/attachments/:attId/download`. `GET /v2/tickets` default `stage=open` (`<> closed`). Arquivo: `stage=closed` exige `from` e `to` (`YYYY-MM-DD`); outro tenant não vê. Bootstrap inclui até 100 chamados **abertos** do tenant (metadados de anexo e mensagens, sem bytes). Mudança de etapa também emite SSE (`reason: ticket`); o cliente autenticado faz `refresh` do bootstrap. Edição de conteúdo emite SSE, sem e-mail/push. Pedido/resposta de informação notifica o destinatário (cliente) ou o time e emite SSE.

### 6.8 Perfil (header)

O círculo com iniciais e o nome no header são um único link (`aria-label="Perfil"`). CLIENT vai a `/client/profile`; ADMIN/MANAGER a `/admin/profile`. A linha do papel (`session.role`) só aparece para ADMIN/MANAGER; o portal do cliente não mostra `CLIENT`. O botão Sair fica fora do link. Sem ID na URL: o PATCH usa a sessão (`req.user.id`). As telas de perfil próprio abrem em **leitura**. **Editar** mostra o formulário; **Cancelar** restaura o rascunho; **Salvar** chama a API. Conta e ficha da empresa têm Editar independentes. Onboarding (`/client/onboarding`) continua formulário de primeiro acesso.

| Aba / seção | Campo | O que é | Obrigatório | Quem preenche | De onde vem | Para onde conecta | Como funciona | Regra / bloqueio | Onde olhar no código |
|-------------|-------|---------|-------------|---------------|-------------|-------------------|---------------|------------------|----------------------|
| Header | Avatar + nome | Atalho para o próprio perfil | — | Sessão | `session.avatarInitials` | `/client/profile` ou `/admin/profile` | Clique / Enter navega; CLIENT sem linha de papel | Sair não faz parte do link | `apps/web/src/components/hub/app-shell.tsx` |
| Header | Papel | Enum da sessão abaixo do nome | — | Só staff | `session.role` | — | ADMIN/MANAGER vêem o papel; CLIENT não | Não muda permissão | `apps/web/src/components/hub/app-shell.tsx` |
| Perfil | Nome de exibição | Nome na sessão e nas iniciais | Sim (3–120) | Usuário logado | `PATCH /v2/auth/me` | `users.name` + `avatar_initials` | Leitura default; Editar → input; Cancelar descarta; Recalcula iniciais no servidor | Só a própria conta; sem ID na URL; input só no modo edição | `apps/web/src/components/hub/own-profile-card.tsx` |
| Perfil cliente | Instagram | Leitura | Não | Onboarding | `users` | — | Só se preenchido | Não altera login | `apps/web/src/app/client/profile/page.tsx` |
| Perfil cliente | Dados da empresa | Ficha compartilhada do tenant | Nome, e-mail, telefone, WhatsApp sim; resto não | Cliente logado | `PATCH /v2/clients/:id` | `clients` | Leitura default (`—` se vazio); aviso se faltar obrigatório; Editar abre `ClientDataFields`; e-mail de contato ≠ e-mail de login | Só `id = session.client_id`; outro tenant 404; CLIENT não POST | `apps/web/src/app/client/profile/page.tsx` |

### 6.8.1 Clientes (admin)

Lista em `/admin/clients`. **Novo cliente** exige nome, e-mail de contato, telefone e WhatsApp. CNPJ (14 dígitos), empresa, segmento e mais informações são opcionais. Com 14 dígitos o backend consulta a BrasilAPI e preenche empresa se estiver vazia. Detalhe `/admin/clients/:id` edita a mesma ficha. `primary_contact` legado recebe o telefone. Clientes antigos continuam válidos (colunas novas nullable); a obrigatoriedade vale ao salvar a ficha.

| Aba / seção | Campo | O que é | Obrigatório | Quem preenche | De onde vem | Para onde conecta | Como funciona | Regra / bloqueio | Onde olhar no código |
|-------------|-------|---------|-------------|---------------|-------------|-------------------|---------------|------------------|----------------------|
| Novo cliente | Nome | Contato / nome da ficha | Sim | Staff | form | `clients.name` | Lista e título do detalhe | 1–200 | `POST /v2/clients` |
| Novo cliente | E-mail | Contato da empresa | Sim | Staff | form | `clients.contact_email` | Distinto do login `users.email` | E-mail válido | idem |
| Novo cliente | Telefone / WhatsApp | Números BR | Sim | Staff | form | `clients.phone` `whatsapp` | Só dígitos no banco; 10–13 | Podem ser iguais | `apps/api/src/lib/br-contact.ts` |
| Novo cliente | CNPJ | Identificação fiscal | Não | Staff ou cliente | form / BrasilAPI | `clients.cnpj` | Unique se preenchido | 14 dígitos ou vazio; lookup no servidor | `GET /v2/clients/cnpj/:cnpj` |
| Novo cliente | Empresa / Segmento / Mais informações | Dados extras | Não | Staff ou cliente | form | `company` `segment` `notes` | Empresa pode nascer da consulta CNPJ | notes ≤ 2000 | `ClientDataFields` |

Endpoints: `GET/POST /v2/clients`, `PATCH /v2/clients/:id` (staff qualquer id; CLIENT só o próprio), `GET /v2/clients/cnpj/:cnpj` (sessão, rate limit). Migration: `db/migrations/009_client_profile.sql`.

### 6.9 Notificações (toque no alerta)

Lista in-app em `/client/notifications` e `/admin/notifications`: o item é um link para `href` (sem popup). Sino do header só abre a caixa.

Toque no alerta do sistema/PWA: o service worker abre o `href` relativo e o `PushNoticeHost` mostra `CenterNotice` no centro (título + corpo + Fechar). App fechado, em segundo plano ou já aberto. Query `fromPush`/`pt`/`pb` é limpa depois. Clique na lista **não** dispara esse overlay.

O envio Web Push usa `TTL` 24h e `urgency: high` para o celular acordar e mostrar o banner na tela (não só no sino in-app). O `showNotification` inclui `vibrate`, `renotify` e `requireInteraction`.

Permissão: depois do login aparece o cartão **Ativar alertas**. O pedido ao sistema só roda no toque (iOS recusa pedido automático). Ao aceitar a permissão o cartão **some na hora** (não espera o `POST /v2/push/subscribe`). Se a inscrição falhar depois, o card não volta. **Agora não** / **X** também fecham. Se a permissão já foi dada, o app reinscreve sozinho e o cartão não reaparece. iPhone: é preciso abrir pelo ícone da tela inicial (Safari na aba não recebe push). Em `/client/settings` o botão **Ativar alertas na tela do celular** faz o mesmo gesto e fecha o cartão de baixo.

`POST /v2/notifications` (staff) e updates visíveis ao cliente também enviam Web Push, além de `notifyUsers` nos chamados.

| Aba / seção | Campo | O que é | Obrigatório | Quem preenche | De onde vem | Para onde conecta | Como funciona | Regra / bloqueio | Onde olhar no código |
|-------------|-------|---------|-------------|---------------|-------------|-------------------|---------------|------------------|----------------------|
| Ativar | Botão **Ativar alertas** | Pedido de permissão + `push_subscriptions` | Condicional | Destinatário | gesto do usuário | `POST /v2/push/subscribe` | Só no toque; o card some ao aceitar a permissão; iOS precisa do PWA na tela inicial | Sem gesto → iOS nega; Android 13 pode silenciar; inscrição `unavailable` não reabre o card | `apps/web/src/components/pwa-register.tsx` |
| Alerta SO | Título / corpo | Texto do aviso | — | Sistema ou admin | payload Web Push | `CenterNotice` | Só no toque do alerta | `href` só path `/…`, sem `//` nem URL absoluta | `apps/web/public/sw.js` |
| Destino | href | Tela aberta atrás do popup | Sim (default `/client`) | Admin ou sistema | `notifications.href` | rota interna | SW sanitiza; API rejeita externo | Open redirect → `/` ou `/admin`/`/client` | `apps/api/src/lib/push-href.ts` |
| Lista | Item | Aviso persistido | — | Destinatário | bootstrap | `Link` `item.href` | Marca lida no clique | Sem overlay | `apps/web/src/components/hub/cards.tsx` |

### 6.10 Aparência (tema claro / escuro)

Dois temas: **Claro** (padrão) e **Escuro** (a paleta antiga do hub). A escolha é **preferência local do dispositivo**: `localStorage["avadesk-theme"]` com `"light"` ou `"dark"`. Valor ausente ou inválido cai em `light`. **Não** existe endpoint, coluna ou campo de bootstrap para tema; nada disso entra em `notificationPrefs` nem em `users`.

As cores vivem em tokens CSS: `:root` / `[data-theme="light"]` e `[data-theme="dark"]` em `globals.css`. Componentes continuam lendo `var(--bg-elevated)`, `var(--text-primary)`, `var(--accent)`, etc., então trocar o tema não exige mudança de tela. Superfícies antes fixas em hex escuro (`hub-surface`, `hub-dialog`, `hub-control`, `auth-card`, `auth-field`, kanban, cards de chamado, empty state, skeleton) usam tokens compostos (`--surface-bg`, `--surface-shadow`, `--control-bg`, `--empty-bg`, `--shimmer`, `--ticket-bg`).

Um script inline no documento aplica `data-theme` **antes do primeiro paint** (`THEME_INIT_SCRIPT`), então não há flash do tema errado no F5. Esse mesmo valor controla `color-scheme`, a `meta[name="theme-color"]` e o tema do Sonner. Trocar o tema em outra aba sincroniza esta (evento `storage`). Login, forgot, reset, invite e onboarding herdam o tema do documento; o interruptor aparece só no header autenticado e nas Configurações.

O accent azul continua sendo marca/ação (CTA, foco, item ativo do menu, selo do sino). **Evolução** (anel, número e barras) usa `--progress`: `#0f7a5a` no claro e `#3ddc97` no escuro.

| Aba / seção | Campo | O que é | Obrigatório | Quem preenche | De onde vem | Para onde conecta | Como funciona | Regra / bloqueio | Onde olhar no código |
|-------------|-------|---------|-------------|---------------|-------------|-------------------|---------------|------------------|----------------------|
| Header | Sol / Lua | Alterna claro ↔ escuro | Não | Usuário logado | `localStorage["avadesk-theme"]` | `html[data-theme]` | Um clique troca e grava; `aria-label` diz o destino | Só troca aparência; nenhuma chamada de API | `apps/web/src/components/hub/theme-toggle.tsx` |
| Configurações | Aparência | Cards **Claro (padrão)** / **Escuro** com miniatura | Não | Usuário logado | mesma chave | `html[data-theme]` | `aria-pressed` no selecionado; miniatura mostra a própria paleta | Vale só neste dispositivo/navegador | `apps/web/src/components/hub/theme-picker.tsx` |
| Documento | `data-theme` | Tema ativo | Sim (default `light`) | Script inline | `localStorage` | tokens do `globals.css` | Roda antes do paint; `classList` `dark` acompanha o Tailwind | Só `"light"` ou `"dark"`; storage bloqueado → tema da sessão | `apps/web/src/lib/theme.ts` |

## 7. Regras de negócio

1. CLIENT nunca vê `visible_to_client=false`.
2. CLIENT só vê projetos do `client_id` (e access list se não for “todos”).
3. Stale: ver §6.3. Status projeto: `planning`, `development`, `testing`, `homologation`, `published`, `maintenance`, `paused`. Totais da home admin só no servidor (`GET /v2/admin/overview`); CLIENT 403.
4. Status update: `planejado`, `em_andamento`, `concluido`.
5. Falha Resend ou Web Push não desfaz o POST do update, o reset nem o PATCH do chamado (outbox `failed`).
6. CLIENT nunca recebe `access_password` em listagens.
7. Login: bcrypt em `users.password_hash`. Credenciais de sistema **e** cofre `.env`: AES-256-GCM (`CREDENTIALS_KEY`).
8. CLIENT não confirma chamado de outro projeto/tenant (404). Só CLIENT confirma; admin não fecha como `closed`.
9. Chamado: `stage` anda só um passo (fix ↔ production ↔ resolved). `closed` só via confirm. Reabrir só de `resolved` → `fix`. Conteúdo (`type`/`title`/`fields`) só o autor edita, e só com `stage=fix` sem evento de transição (`from_stage` nulo). Não muda projeto, origem nem etapa nesse PATCH. CLIENT só **cria** `bug` ou `other`; outro tipo no POST → 403. No PATCH content, CLIENT não troca para `implementation`/`feature`/`routine` (pode manter o tipo se o chamado já era legado).
10. Esqueci senha: mesma resposta se o e-mail existir ou não. HTML escapado. Token 1h no servidor (`expires_at > NOW()`); pedido novo invalida tokens anteriores não usados. Boas-vindas **sem senha** no e-mail. Push: `user_id` só da sessão; VAPID private só no backend.
11. Usuário: `admin`/`manager` exigem `client_id` nulo; `client` exige empresa. `GET/PATCH /v2/users/:id` e `POST /v2/users/:id/password` só para staff; CLIENT 403. PATCH persiste e-mail único. Promover cliente a staff zera a empresa. Rebaixar staff a cliente sem `clientId` → 400. Senha definida pelo admin não vai no e-mail; sessão HMAC antiga não é revogada até expirar ou logout; `active=false` bloqueia o próximo request.
12. Live: `GET /v2/events` exige sessão. O evento só tem `{ type, reason }` (sem PII). CLIENT só recebe se o `client_id` da sessão for o do recurso; staff recebe todos; o ator da mutação não recebe. Poll 30s cobre SSE caído. Sem Redis: um processo Node.
13. Web Push `href` só path relativo (`/`…, sem `//` nem protocolo). `POST /v2/notifications` rejeita URL absoluta (400). Envio com `urgency: high`. Toque no alerta abre popup central; clique na lista do sino não. Permissão de alerta só após gesto (**Ativar alertas**).
14. Chamado: imagens opcionais só na abertura (PNG/JPEG/WebP, magic bytes, máx. 4 × 2 MB). Download autenticado; CLIENT de outro tenant 404. Não entram em `files`. `desiredDate` no POST é 400. PDF do chamado (`GET /v2/tickets/:id/pdf`) só staff (`isStaff`); CLIENT 404; outro tenant 404; não vira `ticket_attachments`.
15. Ficha da empresa (`clients`): POST só staff. PATCH staff qualquer id; CLIENT só `id = client_id` (outro tenant 404). Criar/salvar pelo cliente exige nome, e-mail de contato, telefone e WhatsApp. CNPJ unique se preenchido. Consulta CNPJ só no backend (host fixo BrasilAPI).
16. Chamado: pedido de informação é overlay (`awaiting_reply_from_user_id`), não etapa. Staff POST `messages` kind=request; CLIENT kind=reply (ignora `waitForUserId`). Destinatário só CLIENT do mesmo tenant/projeto. Outro tenant 404. `closed` 409. WaitFor de outro tenant 400.
17. Cofre `.env` só `admin`. MANAGER/CLIENT → 403. GET lista só `hasContent`/`updatedAt`. Conteúdo só no POST reveal. URL de acesso só http(s).
18. Lista de chamados: bootstrap e `GET /v2/tickets` default só `stage <> closed`. Consulta de encerrados exige `from`/`to` no servidor (`bindClientFilter` igual); intervalo >366 dias ou datas invertidas → 400. Confirm tira o card da fila da UI.

## 8. Como usar

**[docs/GUIA-DE-USO-CLIENT-HUB.md](docs/GUIA-DE-USO-CLIENT-HUB.md)**.

Subir: `npm run migrate` → `npm run seed` (opcional; **não limpa o banco**) → `npm run migrate:hub -w @nexus/api` (se houver snapshot antigo) → `npm run dev`.

Banco local: `DATABASE_URL=postgresql://postgres:postgres@localhost:5434/nexus` (`.env` / `.env.example`). Docker mapeia host **5434** → container 5432. Não configure `DB_HOST`, `DB_PORT=5432` nem `JWT_SECRET` para esta app.

`npm test` **não** usa o banco da tela. Aponta para `DATABASE_URL_TEST` (`.../nexus_test`), cria o database se faltar, aplica migrations e só então faz TRUNCATE + fixture. Se a URL de teste for `nexus` (ou o nome não contiver `test`), o comando aborta.

E-mail: `RESEND_API_KEY` só no `.env` da API (nunca `NEXT_PUBLIC_*`). `EMAIL_FROM=Avadesk <onboarding@resend.dev>` em teste. Sem a key, o outbox marca `logged`. Recuperar senha: `/login` → Esqueci a senha. Criar usuário dispara boas-vindas. Chamado em Produção (e demais etapas) dispara e-mail + notificação **no e-mail de login** do usuário CLIENT. Com a aba `/client/chamados` aberta, o badge muda na hora (SSE). No celular, toque em **Ativar alertas** (e no iPhone abra pelo ícone da tela inicial, iOS 16.4+). Sem esse toque o aviso fica só no sino.

## 9. Checklist de validação

- [ ] Login admin; cookie HttpOnly (não `document.cookie` com user id)
- [ ] CLIENT A não lê projeto B (`404`)
- [ ] Reveal: dono ok; outro tenant `404`; lista sem senha
- [ ] Quick Update <30s + Idempotency-Key
- [ ] Outbox não bloqueia publish
- [ ] Reset one-shot
- [ ] Kanban de chamados: três colunas (Correção / Produção / Aguardando cliente); arraste um passo persiste; salto mostra toast; Encerrados só em Concluídos por data
- [ ] Menu admin sem Tasks; `/admin/tasks` abre `/admin/chamados`
- [ ] Cliente sem Tarefas; `/client/tasks` abre `/client/chamados`
- [ ] Download de arquivo exige sessão
- [ ] Arquivos: cards de projeto → pasta (Documentação / custom / Outros) → lista com data; Docs redireciona para Arquivos; cliente não vê projeto de outro tenant
- [ ] `npm test` usa `nexus_test`; recusa se a URL de teste for o banco da UI (`nexus`)
- [ ] `npm run seed` não apaga clientes/projetos; F5 após criar usuário ainda mostra o registro
- [ ] Chamados: cliente abre bug ou Outra coisa; admin avança etapas; cliente confirma; outro tenant 404; CLIENT POST `feature` 403
- [ ] Chamados: fila sem encerrados; Concluídos com De/Até lista só o período; `stage=closed` sem datas 400; CLIENT B não vê o arquivo de A
- [ ] Chamado: abrir sem imagem; anexar PNG; SVG/PDF 400; outro tenant 404 no download; Implementação sem Prazo desejado
- [ ] Card expandido: **Baixar PDF** só no admin (aberto e Concluídos); portal cliente sem botão; CLIENT GET pdf 404; staff 200; outro tenant 404; sem sessão 401; PDF contém rótulos do form
- [ ] Chamado intacto: autor (cliente ou admin) vê **Editar** e grava; outro usuário 403; após Produção ou Reabrir some o botão (API 409)
- [ ] Chamado `resolved` (cliente): Confirmar `accent`/`lg`; Ainda não está ok `danger`/`lg`; os dois rótulos inteiros no card estreito (wrap, sem corte); form com subtítulo vermelho; Reabrir disabled sem nota
- [ ] Card compacto expande no clique; um aberto por vez
- [ ] Aba nova sem `localStorage`: hub abre **claro**, sem flash escuro; F5 mantém o tema escolhido
- [ ] Sol/Lua no header e cards de Aparência (`/client/settings` e `/admin/settings`) mudam o mesmo valor; toast e `meta[name="theme-color"]` acompanham
- [ ] `/client`: anel, `%` e barras em verde; **+ Update**, item ativo do menu e selo do sino seguem azuis
- [ ] `/login`, `/forgot-password` e `/invite` legíveis nos dois temas (card, campos e partículas)
- [ ] `npm run typecheck -w @nexus/web` e build
- [ ] Home `/client`: 1 projeto = anel + Agora/Próximo visíveis; 2+ = anéis compactos, Agora/Próximo no clique (um aberto); Antes único
- [ ] Forgot: mensagem genérica; e-mail Avadesk se usuário ativo; reset one-shot; token com `expires_at` no passado 400; segundo forgot invalida o anterior; `/reset-password` sem token mostra **Link inválido ou expirado**
- [ ] Sem `RESEND_API_KEY`, outbox fica `logged`; sandbox só entrega ao e-mail da conta Resend
- [ ] Criar usuário: diálogo com senha + e-mail de boas-vindas **sem** senha
- [ ] `/admin/users`: lista ADMIN/MANAGER/CLIENT; filtro vazio não esconde Criar; Abrir abre ficha
- [ ] Ficha: salvar nome/e-mail; e-mail duplicado 400; definir senha 8+ e login com a senha nova
- [ ] Switch Ativo em `/admin/users` em um CLIENT: 200, empresa permanece; CLIENT não GET/PATCH `/v2/users` nem POST senha
- [ ] Chamado → Produção: in-app “em produção” + e-mail; ator não recebe
- [ ] `GET /health` → `ok`; `email` e `push` true só com `RESEND_API_KEY` e VAPID no `.env`
- [ ] Login: cartão **Ativar alertas** (toque) some ao aceitar a permissão do aparelho; grava `push_subscriptions` (`POST /v2/push/subscribe`) em seguida; se a inscrição falhar o card não volta; iOS na aba do Safari mostra o aviso de tela inicial, não o pedido de permissão
- [ ] App fechado no celular: avanço de chamado/update gera banner na tela (não só o sino); toque abre href + `CenterNotice`
- [ ] Home `/admin`: 4 KPIs = SQL; CLIENT 403 em `GET /v2/admin/overview`; deep link `?stage=` nos chamados
- [ ] Admin salva URL/usuário/senha em `/admin/access`; cliente revela a mesma senha; lista sem plaintext
- [ ] Ambientes: só ADMIN; MANAGER/CLIENT 403 em `/v2/projects/:id/env`; GET sem conteúdo; Copiar após reveal
- [ ] Atividade recente: até 40 itens com scroll; clique abre modal; empty inalterado; cliente não vê chip “Só a equipe”
- [ ] Header: clique na inicial (e no nome) abre o perfil; Sair só faz logout
- [ ] `/admin/profile` e `/client/profile`: chegam em leitura (sem input); Editar → Salvar nome via `PATCH /v2/auth/me` (3–120 chars); Cancelar não chama API; sem ID na URL
- [ ] Novo cliente: sem e-mail/telefone/WhatsApp não salva; CNPJ 14 dígitos opcional; detalhe edita a ficha
- [ ] `/client/profile`: ficha da empresa em leitura; Editar para completar; CLIENT B PATCH empresa A → 404; CLIENT não POST `/v2/clients`
- [ ] Admin marca chamado Resolvido → aba `/client/chamados` aberta atualiza sem F5; outro tenant não muda
- [ ] `GET /v2/events` sem cookie = 401; PATCH resolved grava `email_outbox` no e-mail de login do CLIENT
- [ ] Toque no alerta PWA abre o href + `CenterNotice`; lista `/client/notifications` só navega
- [ ] Admin pede informação no chamado → selo Aguardando resposta {nome}; cliente de outro tenant 404; cliente responde → selo some
- [ ] `POST /v2/notifications` com `https://evil.com` → 400; href `/client/updates` → 201

## 10. Segurança

- Autorização: sessão → tenant → ownership do projeto → recurso. 404 para não vazar outro tenant.
- Consulta CNPJ: backend chama só `https://brasilapi.com.br/api/cnpj/v1/{14 dígitos}`; rate limit; timeout 5s.
- SQL parametrizado. Sem secrets no frontend / logs.
- Cookie: HttpOnly, SameSite=Lax, Secure em production.
- Rate limit login/forgot/reset, `POST /v2/users/:id/password` (staff, 10/15 min), POST de chamado e POST de imagem no chamado (CLIENT, 10/hora e 20/hora), PATCH content de chamado (CLIENT, 10/hora), POST mensagem de chamado (CLIENT, 30/hora), GET PDF do chamado (não-staff 30/min, depois 404), subscribe de push e reveal de senha/`.env` (30/min).
- SSE: cookie de sessão; payload sem PII; isolamento por `client_id` no servidor.
- Web Push: endpoint https (localhost http ok); subscription amarrada ao usuário da sessão. Payload `href` só path relativo (API + SW). Envio com `urgency: high`. `sw.js` com `Cache-Control: no-store`.
- Uploads: extensão/MIME allowlist + magic bytes nas imagens de chamado, nome armazenado UUID, path traversal bloqueado. JSON da API até 12 MB.

## 11. Deploy / ambiente

`.env.example`: `DATABASE_URL` (`localhost:5434/nexus`), `DATABASE_URL_TEST` (`localhost:5434/nexus_test`, só `npm test`), `SESSION_SECRET`, `CREDENTIALS_KEY`, `RESEND_API_KEY` (vazio no example), `EMAIL_FROM` (`Avadesk <onboarding@resend.dev>`), `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `NEXT_PUBLIC_VAPID_PUBLIC_KEY` (pública no frontend; privada só na API), `WEB_ORIGIN`, `API_URL`. Sem `DB_HOST` / `JWT_SECRET`. Não commitar `.env`. Remetente sandbox só entrega para o e-mail da conta Resend.

Web em desenvolvimento: um processo Next em **http://localhost:3000** (`next dev --port 3000`, webpack). Feche extras em 3001–3005. API em **http://localhost:4000** (um processo). `npm run dev` na raiz sobe os dois.

Produção VPS (Hostinger, **somente adicionar**): pasta `/opt/avadesk`, clone de [https://github.com/Trindadelucas0/avadesk.git](https://github.com/Trindadelucas0/avadesk.git). Público: **https://suporte.avadesk.com.br** (Cloudflare hostname `*` → HTTP `127.0.0.1:3105`). `WEB_ORIGIN=https://suporte.avadesk.com.br`. Web `127.0.0.1:3105`, API `HOST=127.0.0.1` `PORT=4105`, Postgres `avadesk-pg` em `127.0.0.1:5436`. Atualizar sozinho: **[ATUALIZAR-VPS.txt](ATUALIZAR-VPS.txt)** (passo a passo [docs/DEPLOY-VPS.md](docs/DEPLOY-VPS.md)). **Não** rerodar `avadesk-deploy.sh` (reescreve `.env`). Não reutilizar 3000/4000 nem parar serviços alheios. `chamados.avadesk.com.br` não existe no DNS.

E-mail e Web Push **não funcionam** se `RESEND_API_KEY` / `VAPID_*` estiverem vazios no `/opt/avadesk/.env` (`GET /health` → `email`/`push` false; outbox `logged`; `push_subscriptions` vazio). `EMAIL_FROM` sandbox `onboarding@resend.dev` só entrega para o e-mail da conta Resend — em produção use domínio verificado no Resend.

Rotas legado Express `/auth` `/projects` `/updates` `/hub` ainda existem (ops/migrate). Next `POST /api/hub/login` encaminha para `/v2/auth/login`; `GET /api/hub/state` encaminha para `/v2/bootstrap` (compat PWA). A UI nova usa `/api/v2`. V1 `/projects` não devolve `access_password`.

## 12. Ao atualizar este documento

Mudança de tela, regra, rota ou API: atualizar capa, §2.1 e a ficha na mesma entrega.
