---
name: review-architecture
description: Revisa arquitetura do EngrenaCode — isolamento do renderer Electron, fluxo React → Preload → IPC → Main, HTTP loopback → handler → repositório, camadas, nomes de domínio e abstrações sem uso concreto. Use ao revisar diff, branch, PR, feature, ou com /review-architecture quanto a estrutura, acoplamento ou over-engineering.
---

# Review — Arquitetura

Revisão **somente leitura** de estrutura e fronteiras. Nunca edita código: observa, analisa e relata.

**Auditoria full-base / artefato:** quando o pedido for reauditoria da base completa ou “rodar as 3 reviews”, use a skill `audit-full-base` (orquestra esta frente + robustness + delivery e grava `apps/engrena-code/docs/AUDIT-CODE-REVIEW.md` categorizando achados por **Stack**: Electron, React, Node.js, SQLite, TypeScript, Vitest).

**Idioma:** relatório em português do Brasil. Nomes de arquivo, símbolos, canais IPC e comandos permanecem em inglês.

## Escopo

| Revisa aqui | Não revisa aqui |
|---|---|
| Isolamento do renderer (sem Node/Electron indevido) | Validação de payload, tipagem, duplicação, erros → `review-robustness` |
| Fluxo explícito React → Preload → IPC → Main | Testes, commits, cobertura → `review-delivery` |
| Fronteira HTTP loopback: service → handler → repositório | Fidelidade visual (`ui.md`/`copy.md`) — fora das três frentes |
| Direção das camadas e acoplamento entre elas | |
| Nomes baseados no domínio | |
| Abstração criada sem consumidor concreto | |

## Entrada

Formato livre. Default: **mudanças do branch** (`git diff --stat main...HEAD` + `git diff main...HEAD`).

Outras entradas aceitas: `uncommitted` (`git status` + `git diff HEAD`), caminhos explícitos, ou um id de feature `F<ID>` (revisa os arquivos citados no Component Overview de `docs/F<ID>-*/spec.md`).

Se o diff estiver vazio, pare e diga qual escopo foi tentado — não caia numa varredura do repositório inteiro.

## Mapa de fronteiras real deste repo

São **duas** fronteiras, com propósitos distintos. Confundi-las é o erro arquitetural mais caro aqui.

**1. Dados de domínio — HTTP loopback (caminho dominante):**

```
src/renderer/screens/*.tsx | components/**    (React, sem Node)
  → src/renderer/hooks/* ou services/<domínio>-service.ts
  → fetch http://127.0.0.1:5174 + header x-engrenacode-session
  → src/services/http/<domínio>-handler.ts    (registrado no roteador de unlock-handler.ts)
  → src/services/db/repositories/* | runner/* | git/* | vcs/* | vault/* | codegraph/* | voice/*
```

Eventos ao vivo: `src/renderer/services/ws-client.ts` ↔ `src/services/http/ws-upgrade.ts` + `src/services/runner/ws-hub.ts`.

Callback OAuth de MCP/VCS em portas efêmeras `5180–5199` (padrão F09) **não** é segundo servidor de API — domínio continua no loopback `:5174`.

**2. Capacidade nativa — IPC (superfície mínima):**

```
React → window.electronAPI.<grupo>.<ação>    (src/preload/index.ts, CommonJS)
  → ipcMain.handle('engrenacode:<domínio>:<ação>')    (src/main/index.ts)   request/response
  → ipcMain.on('engrenacode:<domínio>:<ação>')                              fire-and-forget (stream)
  → capacidade do SO / vaultService / PTY host
```

Grupos do `api` no preload: `vault`, `dialog`, `shell`, `terminal` — só isso. Canais nomeados: `vault:get-session|is-locked|lock` (+ evento `vault:locked`), `dialog:open-folder`, `shell:open-external`, `terminal:create|kill` via `handle`; `terminal:write|resize` via `on` e `terminal:data|exit` via `webContents.send` (PTY F26, registry em `src/services/terminal/`).

PTY pode resolver `cwd` via projects/threads — isso **não** autoriza CRUD de domínio via IPC. Nada de leitura/escrita de catálogo, vault keys, git de produto ou dispatch por IPC.

## Checklist

Marque cada item ✓ / ✗ / — e cite `arquivo:linha`.

### 1. Isolamento do renderer

- `rg -n "from '(node:|fs|path|os|child_process|http|https|electron)'" src/renderer` → deve sair vazio. Qualquer acerto é 🔴.
- `rg -n "require\(" src/renderer` → vazio. 🔴.
- Import de `src/services/**` dentro de `src/renderer/**` só é aceito como **`import type`** (precedente: `type SubagentRun` em `WorkspaceSidebar.tsx`) ou como **constante pura sem efeito colateral de Node** (precedente: `composer.logic.ts` importando `ALLOWED_IMAGE_MIME_TYPES` de `runner/providers/composer-images.js`). Import de *valor* que puxe SQLite, `fs`, `electron` ou spawn é 🔴.
- `src/main/index.ts` mantém `nodeIntegration: false`, `contextIsolation: true` e `preload: preload.cjs`. Afrouxar qualquer um é 🔴 sem exceção.

### 2. Preload como única ponte nativa

- Capacidade nativa nova aparece como **método nomeado** dentro de um grupo do objeto `api`, com tipo de retorno explícito. Hoje **não existe** passthrough genérico (`invoke`/`send`/`on` cru) exposto ao renderer — expor um é 🔴, porque anula a allowlist de canais.
- Todo método novo do preload tem contraparte em `src/main/index.ts` no formato `engrenacode:<domínio>:<ação>`: `ipcMain.handle` quando há resposta, `ipcMain.on` quando é fire-and-forget de stream (precedente: `terminal:write` / `terminal:resize`). Método órfão (sem contraparte) ou canal do main sem método no preload é 🔴; usar `on` onde o chamador precisa do retorno é 🟡.
- Preload permanece CommonJS (`require('electron')`). Converter para `import` é 🔴 — `contextBridge` não é exportado em ESM (`CLAUDE.md`).
- Preload não contém regra de negócio, cache nem transformação de dados: só repassa. 🔴 se contiver.
- Retorno atravessa serializado (objeto plano). Devolver `BrowserWindow`, handle de stream, `Buffer` grande ou classe é 🔴.

### 3. Dados de domínio não passam por IPC

- Novo `ipcMain.handle` que leia/escreva SQLite, spawne agente, faça git ou toque credencial é 🔴 → pertence a um handler HTTP.
- `fetch(` dentro de `screens/` ou `components/` é 🔴. Única exceção existente: o unlock em `LoginScreen.tsx` (rota pública, pré-sessão). Todo o resto passa por `src/renderer/services/<domínio>-service.ts`.
- Service novo do renderer usa `BASE_URL = 'http://127.0.0.1:5174'` e o header `x-engrenacode-session`. BASE_URL divergente, porta hard-coded diferente ou header renomeado é 🔴.
- Handler novo está registrado no roteador de `src/services/http/unlock-handler.ts` e devolve `false` para rota que não é dele (contrato de encadeamento). Handler não registrado é 🔴; handler que devolve `true` para rota alheia é 🔴 (engole a rota dos seguintes).
- Rota nova sob `/api/...`, nunca um segundo servidor HTTP de API nem outra porta de domínio. `5174` é reservada ao loopback; Vite nunca a usa (`CLAUDE.md`). Callback OAuth `listen(0)` / faixa `5180–5199` e servidores por turno (`ask-user`, memory-write, MCP secrets) são exceções de design já estabelecidas — não use isso como precedente para API paralela.
- Push ao vivo passa pelo WS hub existente. Polling novo em paralelo a um evento que o hub já emite é 🟡 com justificativa exigida. Precedentes aceitos: Dashboard agregado (sem evento WS) e card OAuth pending (`VcsOauthCard`).

### 4. Direção das camadas

- `rg -n "renderer/" src/services src/main` → vazio. `src/services/**` e `src/main/**` nunca importam do renderer. 🔴.
- `src/main/index.ts` é fino: janela, menu, IPC nativo, boot do unlock server. Regra de negócio nova ali é 🔴 → vai para `src/services/**`.
- Acesso a SQLite passa por `src/services/db/repositories/*`. Novo `getDb()` fora de `src/services/db/**` é 🟡 com motivo explícito; CRUD comum sem repositório é 🔴.
- Arquivo sob `src/services/db/repositories/` **deve** persistir via `getDb()`/SQLite (e migration quando houver tabela nova). Persistência alternativa (`*.json` + `fs`, Electron `app.getPath`) nesse path é 🟡 — ou migre para SQLite, ou mova o módulo para fora de `db/repositories/` e documente na spec. Dívida conhecida: `skills.ts` → `skills.json` (F05 pediu tabelas).
- Migration nova entra em `src/services/db/migrations/NNN_<assunto>.ts` na ordem numérica, nunca alterando migration já aplicada. Editar migration existente é 🔴.
- Import ciclado entre módulos de `src/services/**` é 🔴.

### 5. Nomes de domínio

Vocabulário do projeto: Vault, Session, Project, Thread, Message, Diff, Skill, Rule, SubAgent, Mcp, UsageEvent, LogEntry, Worktree, Provider, Dispatch, Delegate, Vcs, Memory, Codegraph, Pipeline, Voice, Terminal.

- Símbolo ou arquivo novo usa esse vocabulário. `manager`, `helper`, `utils`, `service2`, `data`, `wrapper`, `handleStuff` são 🟡 e devem ser renomeados para o conceito de domínio.
- Convenções de nome de arquivo: `src/services/**` em kebab-case (`rules-handler.ts`, `provider-keys.ts`); componentes React em PascalCase; regra extraída de componente em `<nome>.logic.ts`; repositório com o nome plural da entidade (`repositories/rules.ts`).
- Marca: só EngrenaCode/engrenacode. Qualquer `Lion*`/`LionCode` em código, copy ou doc novo é 🔴 (`CLAUDE.md`).
- Nome mente sobre o que o símbolo faz (ex.: `validate*` que também persiste) é 🟡.

### 6. Abstração sem uso concreto

- Todo símbolo exportado no diff tem pelo menos um consumidor de **produção** fora do próprio teste. Verifique: `rg -n "<nomeDoSímbolo>" src`. Só teste → 🟡 (torne local); zero consumidores → 🔴 "abstração sem uso concreto: remova ou ligue". Precedentes registrados no artefato: `injectTokenIntoHttpsUrl` órfã após F24 (`ByKind`); `getTokens` exportado só para uso interno em `vcs/oauth.ts`.
- `session-middleware.ts` (Express-style paralelo ao `guard()`) **já foi removido**. Não reintroduza middleware/auth paralelo ao `guard()` de `_transport` / handlers — 🔴.
- 🔴 para: interface/`type` de porta com uma única implementação e um único chamador; factory/registry para dois casos; camada genérica (`BaseHandler`, `Repository<T>`, `createCrudRoutes`) introduzida junto com o primeiro uso; flag de configuração sem UI nem consumidor.
- 🟡 para: parâmetro opcional que nenhum chamador passa; branch de código inalcançável no diff; `export` de algo usado só dentro do próprio arquivo (deveria ser local).
- Duplicação de regra de negócio (ex.: `validate*Key` no renderer e no vault) é 🔴 de `review-robustness` — aqui só aponte se revelar fronteira mal posta (mesma regra nos dois lados sem módulo puro compartilhado). Precedente conforme: `composer.logic.ts` importa constantes de `composer-images.ts`.

## Formato de saída

```
Review Arquitetura — <escopo revisado>
Veredito: aprovado | ressalvas | bloqueado

🔴 Bloqueia merge
- `caminho:linha` — <problema em uma linha>. Correção: <ação concreta>.

🟡 Ajustar antes de fechar a feature
- `caminho:linha` — <problema>. Correção: <ação>.

🟢 Opcional
- `caminho:linha` — <observação>.

Checklist:
✓ 1. Isolamento do renderer — <evidência>
✗ 4. Direção das camadas — <o que falta>
— 2. Preload — nenhum canal IPC neste diff

Não verificado:
- <o que não deu para checar e por quê>
```

Veredito: **bloqueado** com qualquer 🔴; **ressalvas** com só 🟡/🟢; **aprovado** sem achados.

Exemplo de relatório completo: [references/examples.md](references/examples.md).

## Sempre

- Rodar os comandos `rg` da checklist em vez de julgar de memória.
- Citar `arquivo:linha` em todo achado, com correção concreta em uma linha.
- Ler `docs/F<ID>-*/spec.md` quando o diff pertence a uma feature, antes de chamar algo de desvio arquitetural — pode estar especificado.
- Classificar como 🔴 apenas o que quebra fronteira, isolamento ou contrato de camada.
- Declarar em "Não verificado" o que não deu para checar.

## Nunca

- Editar, formatar ou "corrigir de passagem" qualquer arquivo — a saída é o relatório.
- Flagrar `import type` cruzando renderer/services: é o padrão aceito aqui.
- Flagrar os helpers duplicados dos handlers (`sendJson`, `guard`, `readBody`): duplicação é de `review-robustness`.
- Exigir camada, interface, DI ou padrão que o repo não usa — KISS é a regra, não a exceção.
- Propor renomear módulo existente inteiro por causa de um arquivo novo no diff.
- Reclamar de estilo/formatação: `biome` decide isso.
