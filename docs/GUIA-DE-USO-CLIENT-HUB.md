# Guia de uso — Avadesk

Tutorial prático para o **dono (ADMIN)** e para o **CLIENTE**.  
Atualizado em 12/09/2026 · marca Avadesk · Acesso e Ambientes no admin · live no portal (SSE) · e-mail no login do cliente · avatar do header abre o perfil (leitura; Editar para alterar) · dados no Postgres relacional (`/v2`). Sessão HttpOnly. E-mail Resend + Web Push.

---

## 1. Visão geral

### O que é

A **Avadesk** é a plataforma em que você (dono / equipe) acompanha e publica a evolução dos sistemas dos clientes, e o cliente vê **agora / próximo / antes**, acesso e arquivos em um só lugar.

- Área **Admin** (`/admin`): visão geral dos sistemas, clientes, projetos, **Acesso** (login do sistema), **Ambientes** (.env só do dono), Quick Update, Kanban de chamados, usuários.
- Área **Cliente** (`/client`): Início, Evolução, Acesso.

### O que não é

Não é ERP, CRM, chat nem billing.

### Celular e computador

Com `npm run dev` (Web + API) e Postgres no ar, os dois usam o **mesmo banco**. Entre pelo IP do PC no telefone (`http://192.168.x.x:3000`).

---

## 2. Como entrar

| Item | Valor |
|------|--------|
| URL local | http://localhost:3000 → redireciona para `/login` |
| Subir só a UI | `npm run dev:web` — **não autentica** de verdade sem a API |
| Monorepo (API + Web) | `npm run dev` — obrigatório |

### Login do admin (dono)

| Campo | Valor |
|-------|--------|
| E-mail | `admin@clienthub.dev` |
| Senha | `Hub2026!` |

Após o login, um diálogo no **centro** da tela diz `Olá, {seu primeiro nome}` — use **Fechar** (ou espere ~3s). Depois você cai em `/admin` (**Visão geral**): quatro KPIs (parados, chamados abertos, aguardando cliente, sistemas no ar), mix do portfólio, fila **Precisa de você** e a lista de sistemas. Totais vêm de `GET /v2/admin/overview`; as listas vêm do bootstrap. Os dados vêm da API relacional (`/v2`), não de um JSON no navegador.

Esqueci a senha: `/forgot-password` envia um e-mail com visual Avadesk (se o e-mail existir). O token vale 1 hora e só pode ser usado uma vez; um pedido novo cancela o link anterior. Depois de 1 hora, ou se o token já foi usado, `/reset-password` mostra **Link inválido ou expirado** e o botão **Pedir novo link**. A tela de pedido nunca confirma se o e-mail está cadastrado. Em teste, o remetente `onboarding@resend.dev` só entrega para o e-mail da conta Resend. Sem `RESEND_API_KEY` no servidor, o pedido é só registrado no outbox.

Quando o admin cria o seu usuário, chega um e-mail de **boas-vindas** (obrigado, como entrar, chamados). A senha temporária **não** vem no e-mail — só no diálogo do admin.

Após o login, o navegador pode pedir permissão para **alertas**. No celular, instale a Avadesk na tela inicial (no iPhone isso é necessário para o alerta com o app fechado).

A tela de login **não mostra** e-mail nem senha de exemplo. O cartão usa o título **Acesse sua conta**; a marca Avadesk fica no rodapé do card.

---

## 3. Guia ADMIN (dono)

Você é o dono: cria clientes, projetos, convida usuários e publica atualizações.

### 3.1 Primeiro acesso (do zero)

Ordem recomendada:

1. Entrar como admin.
2. **Clientes** → criar o primeiro cliente.
3. **Projetos** → criar o projeto vinculado a esse cliente.
4. **Usuários** → convidar o login CLIENT desse cliente (precisa já existir um cliente).
5. Entregue e-mail + senha temporária `Hub2026!`.
6. O cliente entra e **completa o cadastro** (nome e senha nova; Instagrams opcionais) antes de ver o hub.
7. (Opcional) Depois publique o primeiro **Quick Update**.

### 3.1.1 Visão geral (Início)

Menu **Início** (`/admin`). Use os quatro números do topo: **Parados** (sistemas sem novidade visível há mais de 7 dias), **Chamados abertos**, **Aguardando cliente** e **Sistemas no ar**. Clique no card para ir à fila ou aos chamados filtrados. A lista **Sistemas** abre o detalhe; no celular vira card. Em **Atividade recente**, role a lista (até 40) e clique no card para ler o texto completo, status, visibilidade e o sistema. **Todos os updates** continua abrindo `/admin/updates`.

### 3.2 Criar cliente

1. Menu **Clientes** (`/admin/clients`).
2. **Novo cliente** (ou o botão no empty state).
3. Obrigatório: **nome**, **e-mail**, **telefone** e **WhatsApp**. Opcional: CNPJ (14 dígitos preenche a empresa se estiver vazia), empresa, segmento e mais informações.
4. Salvar → a lista deixa de estar vazia; abra o cliente pelo nome para editar a ficha depois.

### 3.3 Criar projeto

1. Menu **Projetos** (`/admin/projects`).
2. Se não houver cliente, o empty state aponta para criar cliente primeiro.
3. **Novo projeto** → escolha o cliente, nome, status inicial e resumo.
4. **Acesso** (`/admin/access`) → URL, usuário e senha do sistema que o cliente vai usar. Deixe a senha em branco para manter a atual.
5. Abrir o projeto (`/admin/projects/[id]`) para status, progresso e atalhos de Acesso / Ambientes.

### 3.3.1 Ambientes (.env) — só o dono

Menu **Ambientes** (`/admin/environments`) aparece **somente** para o papel Admin (não para Gerente). Por projeto há **Teste** e **Produção**: cole o arquivo, **Salvar**, e depois **Revelar** + **Copiar tudo** para colar no servidor. O cliente nunca vê isso. Não é um gerenciador de secrets de nuvem — é o seu cofre operacional.

### 3.4 Quick Update (&lt;30s)

Objetivo: publicar o que mudou sem abrir ticket.

Formas de abrir:

- Botão **+ Update** na barra superior.
- Atalho **⌘K** (Mac) / **Ctrl+K** (Windows) → comando Quick Update.
- Página **Updates** (`/admin/updates`).

No modal:

1. Selecione o **projeto**.
2. Título + texto curto.
3. Tipo (FEATURE, FIX, UPDATE, RELEASE, DOCUMENTATION).
4. Status (planejado / em andamento / concluído).
5. Marque **visível ao cliente** se o cliente deve ver.
6. Publicar → toast de sucesso; se visível, gera notificação para usuários CLIENT do tenant.

### 3.5 ⌘K (command menu)

- Abre o menu de comandos (navegação rápida + Quick Update).
- Use no dia a dia para não “caçar” menus.

### 3.6 Kanban de chamados

- `/admin/chamados` — quadro com as colunas Correção, Produção e Aguardando cliente. Encerrados não aparecem no quadro.
- Arraste o card (puxador à esquerda) para a coluna vizinha. Grava na hora (`PATCH /v2/tickets/:id`).
- Não dá para pular etapa. Só o cliente confirma o encerramento.
- Para ver o que já foi concluído: abra **Concluídos**, escolha **De** e **Até** (data em que o cliente confirmou) e toque em **Consultar**.
- Expanda o card para ler o contexto ou usar os botões de etapa (mesmo efeito do arraste).
- `/admin/tasks` (antigo Kanban de tasks internas) redireciona para esta tela.

### 3.6.1 Como o admin trata um chamado

1. Menu **Chamados** (`/admin/chamados`) ou o bloco no projeto.
2. **Abrir chamado** — escolha projeto, tipo (Bug, Implementação, Funcionalidade nova, Rotina ou Outra coisa) e origem **Relato do cliente** se veio de WhatsApp/reunião. Imagens (print) são opcionais — PNG, JPG ou WebP, até 4 arquivos.
3. Expanda o card para ler o contexto (e as imagens, se houver). Use **Baixar PDF** para levar o chamado ao Cursor (texto dos campos, histórico e conversa; prints ficam só como nomes). Se **você** abriu o chamado e ele ainda não saiu de Correção (ninguém avançou a etapa), use **Editar** para corrigir tipo, título e campos. Depois que a etapa andar — ou se o chamado for reaberto — o Editar some; o PDF continua.
4. Avance **Correção → Produção → Resolvido** (um passo por vez), arrastando ou pelos botões. A etapa atual gira no card do cliente; as feitas ficam verdes. Cada avanço envia **e-mail + notificação** para o **e-mail de login** do usuário CLIENT da empresa (e alerta no celular se o cliente autorizou). Se o cliente estiver com o portal aberto, o card atualiza **na hora**, sem ele precisar recarregar.
5. Quando estiver em Resolvido, o cliente confirma. Você **não** fecha no lugar dele. O card some da fila; o histórico fica em **Concluídos**.
6. Se faltar dado (print, CNPJ, acesso), expanda o card, escreva em **Pedir informação ao cliente** e envie. O card ganha o selo **Aguardando resposta [nome]**. Quando o cliente responder, o selo some e chega aviso para o time. Isso **não** é a coluna Aguardando cliente (Resolvido).

O cliente também pode abrir sozinho em `/client/chamados` ou no projeto. Lá a visão é lista, não quadro. `/client/tasks` redireciona para Chamados.

### 3.7 Arquivos (inclui documentação)

- `/admin/files` — abra o **projeto** (card), depois a **pasta** (Documentação, Outros ou uma categoria que você criar, ex. Nota fiscal).
- Envie arquivos no nível da pasta ou do projeto (projeto já escolhido). Disco privado `apps/api/storage`; download exige login.
- **Nova categoria…** (nome, 2–60 caracteres) vira uma pasta **só naquele projeto**. Ex.: “Nota fiscal”.
- Manuais e contrato: envie na pasta **Documentação**. Fichas antigas de Docs também aparecem nessa pasta.
- `/admin/documentation` redireciona para Arquivos (o menu Docs não existe mais).

### 3.9 Notificações

- `/admin/notifications` — caixa do admin.
- Updates visíveis ao cliente também notificam os logins CLIENT do mesmo tenant.

### 3.10 Usuários (convidar / criar / editar login)

A lista em **Usuários** mostra a equipe (ADMIN, MANAGER) e os logins CLIENT. Filtros: **Todos** / **CLIENT** / **MANAGER** / **ADMIN** + busca por nome ou e-mail. Criar um gerente **não apaga** e **não esconde** os outros.

1. Primeiro crie a **empresa** em `/admin/clients` e os **projetos** dela.
2. Abra **Usuários** (barra inferior no celular, ou **Menu** no canto superior esquerdo → Usuários).
3. E-mail + papel **CLIENT** + empresa (ou **MANAGER** / **ADMIN** para a equipe — sem empresa).
4. No login de cliente, marque **quais projetos** essa pessoa vê, ou “Todos os projetos desta empresa”.
5. **Criar usuário** → abre um diálogo no **centro** da tela (não some sozinho) com e-mail, senha temporária `Hub2026!`, **Copiar acesso** e **Fechar**. O usuário também recebe e-mail de boas-vindas **sem** a senha.
6. Dá para criar **vários usuários** na mesma empresa, cada um com projetos diferentes.
7. Se você reusar um e-mail já cadastrado e escolher MANAGER ou ADMIN, o login **sai da empresa** e continua na lista como equipe.
8. Na **primeira entrada**, o cliente completa:
   - nome completo
   - e-mail
   - nova senha + confirmação
   - Instagram da empresa (opcional)
   - Instagram pessoal (opcional)
9. Depois disso a senha temporária **deixa de funcionar**.
10. Use o switch **Ativo** para desativar acesso sem apagar o usuário (o sistema mantém o vínculo com a empresa).
11. Para **ver ou editar**: clique no nome ou em **Abrir**. Na ficha mude nome, e-mail, papel, empresa, projetos e ativo, depois **Salvar alterações**.
12. Para **trocar a senha**: na ficha, bloco Senha → digite (ou **Gerar**) → **Definir senha**. A senha aparece uma vez no diálogo do centro. Não vai por e-mail. Uma sessão já aberta pode continuar até expirar; desative a conta se precisar bloquear agora.

Fluxo mínimo para o cliente ver o hub:

```text
Cliente cadastrado → Usuário CLIENT do mesmo clientId
→ Login com senha temporária → Onboarding obrigatório
→ Projeto + Update visível (quando você publicar)
```

### 3.11 Settings

- `/admin/settings` — nome da empresa + preferências. Auditoria fica no servidor (`audit_logs`).

### 3.11.1 Perfil (header)

No canto direito do header, o círculo com a sua letra (e o nome no computador) abre **o seu perfil** (`/admin/profile`): e-mail, papel e nome de exibição em leitura. Para alterar o nome, use **Editar** e depois **Salvar** (ou **Cancelar**). **Sair** ao lado só encerra a sessão — não é o perfil.

### 3.12 Celular (Admin)

No telefone a lista lateral do computador **não aparece**. Use:

1. O botão **Menu** (três linhas) no canto superior esquerdo — abre Acesso, Ambientes (só Admin), Updates, Arquivos, Notificações, Configurações e o restante.
2. A barra inferior para atalhos: Home, Empresas, Projetos, Usuários.
3. A lupa no header para buscar (mesmo atalho do ⌘K no computador).
4. O círculo com a letra no canto direito — abre o perfil; o ícone de sair ao lado encerra a sessão.

Toque fora do menu, no X ou em um item para fechar.

---

## 4. Guia CLIENTE

O cliente só vê o que está ligado ao **seu** `clientId` e updates com **visível ao cliente**.

### 4.1 Acesso (primeira vez)

1. O admin cria seu usuário (papel CLIENT) e envia e-mail + senha temporária (`Hub2026!`).
2. Abra http://localhost:3000/login.
3. Entre com a senha temporária.
4. Na primeira vez aparece **Complete seu cadastro** (`/client/onboarding`). Não dá para pular.
   - Nome completo
   - E-mail
   - Nova senha (e confirmação)
   - Instagram da empresa (`@empresa`) — opcional
   - Instagram pessoal (`@voce`) — opcional
5. **Concluir e entrar** → cai em `/client`. A senha antiga não vale mais.

Se ainda não houver projeto vinculado: empty state “Nenhum projeto ativo”.

### 4.2 Dashboard

Quando há projeto:

- Um anel de **evolução estimada** por sistema (projeto) vinculado à sua conta — não é prazo contratual.
- Com um sistema: o nome dele no título, status e atalho **Ver projeto**.
- Com vários: título da empresa (ou “Seus sistemas”); cada card compacto tem nome, status, anel e **Ver projeto**. Toque no card para ver **Agora** e **Próximo** daquele sistema (só um aberto por vez).
- **Antes**: timeline de updates visíveis de todos os sistemas (no primeiro acesso, texto de espera — não “0 updates”). Clique no card para ler o detalhe completo.
- Última release só se existir.
- Atalho para **Acesso**.

### 4.3 Updates

- `/client/updates` — timeline do que o time publicou para você. Clique no card para o texto completo e o atalho do sistema.
- Updates internos (não visíveis) **nunca** aparecem aqui.

### 4.3.1 Chamados

- Menu **Chamados** ou no detalhe do projeto: **Abrir chamado**.
- Escolha **Bug** (algo quebrou) ou **Outra coisa** (você dá o nome e descreve). Implementação, funcionalidade nova e rotina só o time abre. Não há prazo desejado. Se quiser, anexe prints (opcional).
- O card fica pequeno (título + etapas). Toque para ver o relato completo e as imagens. **Baixar PDF** gera o texto da demanda para colar no Cursor (aberto ou em Concluídos).
- Se **você** abriu o chamado e o time ainda não avançou a etapa, aparece **Editar**. Depois que for para Produção (ou for reaberto), não dá mais para mudar o relato.
- Etapa atual: ícone girando. Etapas feitas e Resolvido: V verde.
- Quando o time pedir mais informação, o card sobe na lista com o selo **Aguardando resposta [seu nome]**. Abra, leia a conversa e use **Enviar resposta**.
- Quando o time marcar Resolvido, o card muda na hora se você estiver com a tela aberta (aparece o aviso **Chamado atualizado**). Abra o card e use **Confirmar que está ok** (botão azul). Se não estiver, **Ainda não está ok** (botão vermelho, maior). Explique o que falta; o aviso vermelho lembra que o chamado volta para Correção e o time é avisado. Depois use **Reabrir chamado**.
- Depois de confirmar, o chamado sai da lista. Para ver encerrados: abra **Concluídos**, escolha **De** e **Até** e toque em **Consultar**.
- Cada etapa (incluindo **Produção**) chega por e-mail **no endereço com que você entra no portal** e na lista **Notificações**.

### 4.4 Releases

- `/client/releases` — versões / notas de release do(s) projeto(s) do tenant.

### 4.5 Arquivos

- `/client/files` — um card por **projeto**. Clique no projeto para ver as **pastas** (Documentação, Nota fiscal se o admin criou, Outros…). Clique na pasta para ver os arquivos com **data**.
- `/client/documentation` redireciona para Arquivos. Manuais e contrato ficam na pasta **Documentação**.
- Empty states até o admin enviar algo naquele projeto.

### 4.6 Acesso (revelar / copiar)

- `/client/access` — URL e usuário vêm na lista; a senha só aparece ao **Revelar** (auditoria no servidor).
- Use **Copiar** na área de transferência (toast confirma).

### 4.7 Notificações

- `/client/notifications` — avisos (ex.: novo update). Clique na lista abre o link daquele aviso (sem popup).
- Marque como lidas na própria tela.
- Se o celular mostrar um alerta da Avadesk, o toque abre o app na tela certa **e** um diálogo no meio da tela com o texto. Use **Fechar** para continuar.

### 4.8 Mobile / PWA

- Layout client tem navegação inferior no mobile.
- O botão **Menu** no header também abre a lista completa (Projetos, Chamados, Updates, Arquivos, Acesso, etc.).
- Em **Configurações** (`/client/settings`) há opção de **instalar como app (PWA)** quando o navegador oferecer.
- Manifest + service worker (`avadesk-shell-v5`) cobrem shell offline básico (não cacheiam página 404). Depois de atualizar o app, o toque no alerta do sistema passa a trazer o texto no centro da tela.

### 4.9 Perfil

- No header, o círculo com a sua letra (e o nome no computador) abre `/client/profile`.
- A tela abre em **leitura**. **Editar** na conta altera o nome de exibição; **Editar** na empresa abre a ficha. **Cancelar** descarta sem gravar.
- **Sua conta:** e-mail de login, Instagrams (se informados no onboarding) e **nome de exibição**.
- **Dados da empresa:** nome, e-mail de contato, telefone e WhatsApp (obrigatórios ao salvar); CNPJ, empresa, segmento e mais informações opcionais. Se faltar obrigatório, aparece o aviso **Complete os dados da empresa**.
- O ícone **Sair** ao lado do avatar só encerra a sessão.

---

## 5. Fluxo recomendado do dia a dia

```text
Admin (manhã/tarde)
  → abre projeto / Chamados (Kanban)
  → ⌘K ou + Update → Quick Update (<30s)
  → marca “visível ao cliente” quando for comunicação externa
  → avança etapas dos chamados no quadro; espera o cliente confirmar o resolvido
  → (opcional) sobe arquivo, ajusta Acesso (`/admin/access`) ou copia .env em Ambientes

Cliente
  → entra no Hub
  → dashboard + Updates / Notificações / Chamados
  → consulta Acesso se for usar o sistema
  → consulta Acesso se for usar o sistema
  → baixa arquivos em Arquivos (pasta do projeto) quando precisar
```

**Regra de ouro:** se o cliente precisa saber, publique update **visível**. Se é nota interna, deixe desmarcado.

Projetos **em desenvolvimento** sem novidade visível há **≥ 7 dias** pedem atenção no admin. **Pausado** não entra como parado. **Publicado** / **manutenção** sem novidade não são rotulados como PARADO.

---

## 6. Credenciais após o seed

| Papel | E-mail | Senha | Observação |
|-------|--------|-------|------------|
| ADMIN (dono) | `admin@clienthub.dev` | `Hub2026!` | Seed só garante este login; não apaga os demais |
| MANAGER | — | `Hub2026!` (temp) | Criados pelo admin |
| CLIENT | — | `Hub2026!` (só 1ª entrada) | Depois usa a senha do onboarding |

Persistência: Postgres relacional em `DATABASE_URL` (`localhost:5434/nexus`). `npm test` usa outro banco (`DATABASE_URL_TEST` / `nexus_test`) e **não** apaga o que está na tela. `hub_state` pode existir por migração antiga e **não** é mais a fonte da UI. O navegador **não** guarda senhas nem o snapshot completo.

`npm run seed` **não apaga** clientes, usuários, projetos ou updates. Só cria `admin@clienthub.dev` se faltar, ou atualiza a senha desse admin (`SEED_PASSWORD`, padrão `Hub2026!`). Não há `seed:reset`. Para copiar um snapshot antigo do Hub: `npm run migrate:hub -w @nexus/api`.

---

## 7. Troubleshooting rápido

| Problema | O que fazer |
|----------|-------------|
| Login falha com admin | E-mail `admin@clienthub.dev` e senha `Hub2026!` (ou `SEED_PASSWORD`). Rode `npm run seed` se o admin não existir. |
| Login mostra “hub_state foi desativado” | Cache PWA antigo. Recarregue com Ctrl+F5. As rotas `/api/hub` agora encaminham para `/api/v2`. E-mail `admin@clienthub.dev` senha `Hub2026!`. |
| Ainda vejo dados demo antigos | Recarregue logado; a UI hidrata `/api/v2/bootstrap`. |
| Cliente some ao recarregar | Confira `npm run dev` (API + Postgres), não só `dev:web`. |
| API vs UI | Sem API no ar o Hub não autentica nem grava. |
| Cliente não vê updates | Update precisa de “visível ao cliente”; usuário CLIENT precisa do mesmo `clientId` do projeto. |
| Não consigo criar projeto | Crie um **cliente** antes. |
| Cliente novo não entra após criar | Senha temporária é `Hub2026!`; usuário precisa estar **Ativo** e vinculado a um cliente. |
| Cliente cai no hub sem cadastro | Recarregue; `/client/*` redireciona para `/client/onboarding` até concluir. |
| Senha temporária não funciona depois do cadastro | Esperado — use a senha nova definida no onboarding. |
| Não consigo convidar CLIENT | Crie um **cliente** em `/admin/clients` antes. |
| E-mail de chamado não chega | O aviso vai para o **e-mail de login** do usuário CLIENT (`/admin/users`), não para o campo Contato da empresa. Sem `RESEND_API_KEY` fica só no outbox. Sandbox Resend só entrega para o e-mail da conta Resend. |
| Cliente não vê Resolvido na hora | Confira se ele está logado na mesma empresa. Recarregar ainda funciona; o portal tenta atualizar sozinho. |
| Quick Update sem projetos | Crie ao menos um projeto antes. |
| Porta 3000 ocupada / build estranho | Pare o `next dev` antigo ou use `NEXT_DIST_DIR=.next-build` no build. |

---

## Documentação relacionada

- Comportamento oficial: [DOCUMENTACAO-SISTEMA.md](../DOCUMENTACAO-SISTEMA.md)
- README do monorepo: [README.md](../README.md)
- PRD: [PRD-NEXUS-PORTAL-CLIENTE.md](./PRD-NEXUS-PORTAL-CLIENTE.md)
