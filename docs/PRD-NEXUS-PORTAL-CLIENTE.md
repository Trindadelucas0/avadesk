# PRD — Avadesk (portal de acompanhamento)

| Item | Valor |
|------|--------|
| Produto (UI) | **Avadesk** |
| Código / repo | NEXUS Client Portal |
| Versão do PRD | 2.0.0 — alinhado à implementação relacional 3.0.0 |
| Rotas | `/client/*` (cliente) · `/admin/*` (equipe) · `/portal` redireciona para `/client` |
| Fora de escopo | Chat, CRM, billing, IA, OAuth, painel white-label |

Este arquivo é o PRD de **produto**. Não é um prompt de implementação.

---

## 1. Visão

Empresas de software precisam mostrar evolução sem virar status meeting. O admin publica o que mudou em **menos de 30 segundos**. O cliente abre o celular e entende **o que está sendo feito agora**, **o que vem a seguir** e **o que já aconteceu** — sem métricas vazias nem jargão interno.

**Promessa:** o cliente nunca pergunta “e o sistema?” no WhatsApp porque a resposta já está no portal.

**Não-promessa:** Avadesk não substitui o sistema do cliente, o financeiro nem o suporte.

---

## 2. Personas

**Dono / ADMIN** — publica updates no intervalo entre reuniões. Quer lista de atenção (“quem está sem novidade”) e um CTA **Atualizar**.

**MANAGER** — mesma área admin; não é superusuário de infraestrutura, é equipe de entrega.

**CLIENT** — dono ou operacional da empresa contratante. Quer narrativa, acesso ao sistema e arquivos. Não quer Kanban interno nem updates “nota para o time”.

---

## 3. Princípios de UX

1. Narrativa **ANTES / AGORA / PRÓXIMO**, não dashboard de cards vazios.
2. Copy humana: **Em desenvolvimento**, **evolução estimada** (não é prazo contratual).
3. Primeiro acesso: texto de espera, nunca “0 updates”.
4. Releases só aparecem se existirem.
5. Bottom nav cliente: **Início / Evolução / Acesso**.
6. Sem dados fake. Sem marca NEXUS na UI.

---

## 4. Rotas reais

### Público

| Rota | Função |
|------|--------|
| `/login` | Entrar |
| `/forgot-password` | Pedir reset (mensagem genérica) |
| `/reset-password?token=` | Nova senha (token one-shot) |
| `/invite` | Encaminha ao login; cadastro é onboarding |

### Cliente (`CLIENT`)

| Rota | Função |
|------|--------|
| `/client` | Início — narrativa do projeto |
| `/client/updates` | Evolução (timeline visível) |
| `/client/access` | URL / usuário; senha só no revelar |
| `/client/projects`, `/client/projects/[id]` | Projetos |
| `/client/tasks` | Tarefas visíveis do tenant |
| `/client/releases` | Releases (empty se zero) |
| `/client/documentation`, `/client/files` | Docs e arquivos |
| `/client/notifications`, `/client/profile`, `/client/settings` | Conta |
| `/client/onboarding` | Primeiro acesso (obrigatório) |

### Admin (`ADMIN` \| `MANAGER`)

| Rota | Função |
|------|--------|
| `/admin` | Visão geral (KPIs + fila Precisa de você) |
| `/admin/clients`, `/admin/projects`, `/admin/projects/[id]` | Cadastros |
| `/admin/tasks` | **Kanban** (obrigatório manter) |
| `/admin/updates` | Lista + Quick Update |
| `/admin/releases` | CRUD de releases |
| `/admin/documentation`, `/admin/files` | Versões e upload em disco |
| `/admin/notifications`, `/admin/users`, `/admin/settings` | Operação |

---

## 5. Requisitos funcionais

| ID | Requisito |
|----|-----------|
| RF01 | Login e-mail/senha, erro genérico, rate limit |
| RF02 | Sessão cookie HttpOnly no :3000 (`avadesk_session` / `nexus_session`) |
| RF03 | RBAC ADMIN / MANAGER / CLIENT no servidor |
| RF04 | CLIENT isolado por empresa e, se houver, lista de projetos |
| RF05 | Quick Update <30s: título, detalhe, status, visível, Idempotency-Key |
| RF06 | Update visível atualiza `last_client_update_at` e enfileira e-mail (outbox) |
| RF07 | Falha de e-mail não desfaz o update |
| RF08 | Currently building / next step: campos explícitos ou último update visível correspondente |
| RF09 | Stale: não marcar pausado como PARADO; publicado/manutenção = sem novidade |
| RF10 | Credenciais de sistema criptografadas; reveal auditado; lista sem senha |
| RF11 | Documentos versionados; arquivos em disco privado; download autenticado |
| RF12 | Releases CRUD admin; cliente só as do tenant |
| RF13 | Notificações persistidas |
| RF14 | Reset de senha com token hashed, expira, one-shot, mensagem genérica |
| RF15 | Kanban admin persiste status da task |

Fora: chat, CRM, billing, IA, OAuth, white-label.

---

## 6. Status

**Projeto:** `planning`, `development`, `testing`, `homologation`, `published`, `maintenance`, `paused`.  
UI: `development` → **Em desenvolvimento**.

**Update:** `planejado`, `em_andamento`, `concluido`.

---

## 7. Wireframes ASCII

### 7.1 Login (desktop = mobile estreito)

```text
┌─────────────────────────────┐
│           Avadesk           │
│      {organizationName}     │
│  E-mail                     │
│  Senha            [revelar] │
│  [ ] Lembrar   Esqueci      │
│  [        Entrar         ]  │
└─────────────────────────────┘
```

Destinos: Entrar → `/admin` ou `/client` ou `/client/onboarding`. Esqueci → `/forgot-password`.

### 7.2 Cliente Início — desktop

```text
┌──────────────────────────────────────────────────────────┐
│ Avadesk          Início  Evolução  Acesso  …             │
├──────────────────────────────────────────────────────────┤
│ Olá, Ana · 11 set                                        │
│ Nome do projeto                    [Em desenvolvimento]  │
│ Evolução estimada · 72%                                  │
│ [Ver projeto] [Acesso ao sistema]                        │
│ ████████████░░░░  Evolução estimada                      │
│ ┌──────── Agora ────────┐  ┌────── Próximo ──────┐       │
│ │ Módulo X em construção│  │ Homologação do Y    │       │
│ └───────────────────────┘  └─────────────────────┘       │
│ Antes — atualizações recentes          [Ver evolução]    │
│  · … (se não houver: copy de primeiro acesso)            │
│ (Release só se existir)                                  │
└──────────────────────────────────────────────────────────┘
```

### 7.3 Cliente Início — mobile

```text
┌─────────────────────┐
│ Avadesk        ☰    │
│ Projeto             │
│ Evolução estimada   │
│ Agora | Próximo     │
│ Antes (timeline)    │
├─────────────────────┤
│ Início Evolução Acesso │  ← bottom nav
└─────────────────────┘
```

### 7.4 Admin atenção + Quick Update

```text
┌──────────────────────────────────────────────────────────┐
│ Avadesk     [⌘K]  [+ Update]                             │
│ Atenção                                                  │
│ ⚠ Ops Platform  sem update visível >7d    [Atualizar]    │
│ (Pausado não aparece. Publicado: “sem novidade”)         │
└──────────────────────────────────────────────────────────┘

Modal Quick Update
┌─────────────────────────────────┐
│ Projeto [select]                │
│ Título                          │
│ Detalhe                         │
│ Tipo / Status                   │
│ [x] Visível ao cliente          │
│ [Cancelar] [Publicar]           │
└─────────────────────────────────┘
```

Publicar → toast “Update publicado”; se visível, “e-mail pode chegar em seguida”.

### 7.5 Acesso cliente

```text
URL     https://…     [abrir] [copiar]
Usuário acme.ops      [copiar]
Senha   ••••••••••    [revelar] → POST reveal + audit
```

### 7.6 Kanban admin (`/admin/tasks`)

Colunas backlog / a fazer / em progresso / revisão / concluído. Arrastar persiste.

---

## 8. Mapa botão → rota (resumo)

| Superfície | Controle | Destino |
|------------|----------|---------|
| Login | Entrar | `/admin` ou `/client` |
| Client bottom | Início | `/client` |
| Client bottom | Evolução | `/client/updates` |
| Client bottom | Acesso | `/client/access` |
| Admin + Update | Modal | POST `/v2/updates` |
| Admin atenção | Atualizar | Quick Update do projeto |
| Admin | Tasks | `/admin/tasks` |
| Docs | Baixar | `GET /api/v2/files/:id/download` |

---

## 9. Segurança (produto)

- Autorização só no servidor: sessão → organização → projeto → recurso.
- IDOR: outro tenant recebe **404** quando possível, sem vazar existência útil.
- Senha de login: bcrypt. Credencial do sistema do cliente: AES-256-GCM. Reveal auditado.
- CLIENT nunca recebe senha de acesso em GET de lista.
- Cookie HttpOnly; proibido `document.cookie` com id de usuário.
- Reset: token hashed, 1 hora, one-shot, copy genérica.
- Arquivos fora da web root; download autenticado; sem path traversal.
- Outbox de e-mail após commit.

Stack fechada: Next.js 15, Express, pg + Zod, Tailwind/hub kit. Sem Prisma, Redis, S3.

---

## 10. Critérios de aceite

1. Admin publica update visível em <30s; cliente vê na Evolução; update interno não aparece.
2. Cliente A não lê projeto B.
3. Reveal só com acesso; lista sem senha.
4. Segundo POST com o mesmo Idempotency-Key não duplica.
5. Resend fora do ar: update permanece.
6. Kanban continua em `/admin/tasks`.
7. UI diz Avadesk, não NEXUS.
8. Documentação oficial (`DOCUMENTACAO-SISTEMA.md`) descreve o comportamento vivo.

---

## 11. Fora deste PRD

Chat, CRM, billing, IA generativa, OAuth, white-label, DROP de `hub_state` (a tabela pode permanecer até cutover operacional).
