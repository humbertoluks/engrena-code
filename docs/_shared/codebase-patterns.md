# Codebase Patterns Brief

| Campo | Valor |
|-------|-------|
| wave | 4 |
| generated_at | 2026-08-07T09:30:00-03:00 |
| git_sha | 5908e27678e93fc833cfae92974cfa04b7dffa2e |
| foundation_state | complete |
| features_in_batch | F20, F21, F23, F26 |
| status | fresh |

---

## 1. Camada 1 — Baseline (checklist fixo)

| Categoria | Achado | Path exemplo |
|-----------|--------|--------------|
| Runtime e linguagem | Electron 43 desktop + Node main; TypeScript 6 ESM (`"type": "module"`); `__dirname` via `fileURLToPath` no main; preload CommonJS (`preload.cjs`) | `src/main/index.ts`, `src/preload/index.ts`, `package.json` |
| Framework e layout do projeto | Vite 8 + React 19 + Tailwind 4 (`@tailwindcss/vite`); `vite-plugin-electron` orquestra main+renderer; UI em `src/renderer/screens` + `src/renderer/components/<domínio>`; domínio/HTTP em `src/services/` | `vite.config.ts`, `src/renderer/App.tsx`, `docs/DEVELOPMENT.md` |
| Banco de dados e acesso a dados | SQLite via `node:sqlite` `DatabaseSync` → `engrenacode.db` em userData; migrations numeradas + `schema_migrations`; skills em `skills.json` (não SQLite); subagents/rules/mcps/threads/consumo em SQLite; override `ENGRENACODE_USER_DATA` / `ENGRENACODE_DB_PATH`; testes com `openDb(':memory:')` | `src/services/db/client.ts`, `src/services/db/repositories/subagents.ts` |
| Autenticação | Vault AES (`vault.enc`); unlock HTTP público; session token em memória (1 por processo) + header `x-engrenacode-session`; IPC `engrenacode:vault:*`; 401 `unauthorized` / 423 `vault_locked`; WS auth via subprotocolo `engrenacode-session.<token>` | `src/services/vault/vault-service.ts`, `src/services/http/unlock-handler.ts` |
| Estilo de API / ponto de entrada | HTTP loopback `127.0.0.1:5174` (`createUnlockServer`); handlers `handle*Request(req,res)→boolean` no server único; JSON `{ error: { code, message } }`; delegação (`call_subagent`) usa loopback separado port/token por turno | `src/services/http/unlock-handler.ts`, `src/services/http/*-handler.ts` |
| Validação | Manual nos handlers/repos (sem Zod, não é dependência do projeto); códigos estáveis (`validation_error`, `*_conflict`); validadores dedicados por provider de key (`validate<Provider>Key`) | `src/services/vault/provider-keys.ts`, `src/services/http/subagents-handler.ts` |
| Framework e estilo de testes | Vitest (`pnpm test` = `vitest run`); co-local `*.test.ts`; HTTP real com `http.createServer` + axios `validateStatus: () => true`; unlock de teste via `vaultService.unlock(...)` | `src/services/db/repositories/subagents.test.ts`, `src/services/runner/dispatch.test.ts` |
| Tratamento de erros | Classes de domínio (`SkillNameConflictError`, `SubagentNameConflictError`, `LeaseConflictError` `thread_busy`); HTTP 400/401/404/409/423/500 com `code`; falha não-crítica → log via `createLogEntry` e segue (não bloqueia o turno) | `src/services/runner/project-execution.ts`, `src/services/db/repositories/log-entries.ts` |
| Estrutura de pastas e nomenclatura | Docs: `docs/F<ID>-<kebab>/` (`spec.md`, `plan.md`, opcional `ui.md`/`copy.md`); código: `src/{main,preload,renderer,services}`; screens `*Screen.tsx`; handlers `*-handler.ts`; repos kebab; rotas hash `#dashboard`, `#skills`, `#subagents`, `#configuracao` | `docs/F10-api-keys-providers/`, `src/renderer/screens/`, `src/services/` |

---

## 2. Camada 2 — Padrões amplos (máx. 15 bullets)

- [MCP interno `engrenacode`]: servidor stdio único (script gerado em `userData/subagent-mcp-server.mjs`), tools condicionais por flag (`--skills-snapshot` → `load_skill`; `--port`/`--token` → `call_subagent`); nova tool (ex.: `ask_user_question` p/ F21) entra no mesmo padrão — `listTools()` condicional + `handleToolsCall` roteando por `params.name`. Ex.: `src/services/runner/subagent-mcp-server.ts`
- [MCP `engrenacode` exige `ELECTRON_RUN_AS_NODE=1`]: `process.execPath` no main é o binário Electron; sem essa env var o CLI spawna a GUI em vez do script MCP e o handshake stdio falha silenciosamente (achado real do smoke F15). Qualquer novo tool no mesmo processo herda essa env var. Ex.: `src/services/runner/subagent-mcp-server.ts:222`
- [Wiring do MCP interno no turno]: `dispatch.ts` monta `buildEngrenaCodeMcpDef({ skillsSnapshotPath, port, token })` uma vez por turno antes de disparar o provider; um novo par flag/tool (F21) segue o mesmo ponto de montagem. Ex.: `src/services/runner/dispatch.ts:268-293`
- [Snapshot por turno, não live DB]: `load_skill` lê de um snapshot JSON gravado no início do turno (`skill-snapshots/*.json`), não do DB — edição mid-turn não afeta o que já foi anunciado ao modelo; padrão a considerar para journal de memória (F20) se precisar de imutabilidade por turno. Ex.: `src/services/runner/skill-registry.ts`
- [Vault KV + secret namespacing]: `vaultService.setSecret/getSecret` (Record em memória, persistido cifrado em `vault.enc`); keys de provider já usam prefixo `keys:<provider>` (`keys:claude`, `keys:codex`, `keys:minimax`) — F23 (GLM/Grok) estende o mesmo namespace (`keys:glm`, `keys:grok`); F20 (journal) precisaria de um novo namespace tipo `memory:<projectId>` ou store dedicado, pois hoje só há string→string, não blob por projeto. Ex.: `src/services/vault/vault-service.ts`
- [Padrão de card de API key F10]: schema fixo por provider (`validate<Provider>Key(key): ProviderKeyValidation`, `{ ok:true, action:'skip'|'save' }` ou `{ ok:false, message }`); string vazia = "preservar key atual" (merge, não clear); handler HTTP aplica todos os campos enviados em lote. F23 clona esse arquivo/padrão adicionando `validateGlmKey`/`validateGrokKey`. Ex.: `src/services/vault/provider-keys.ts`
- [`ThreadProvider` fechado]: `type ThreadProvider = 'claude' | 'codex' | 'kimi' | 'minimax'` — F23 precisa estender esse union (`'glm' | 'grok'`) e os 3 pontos que fazem switch nele: resolução de key, billing mode, e picker do composer. Ex.: `src/services/db/repositories/threads.ts:4`, `src/services/runner/provider-resolution.ts`
- [`ThreadState` fechado — gap para F21]: `type ThreadState = 'running' | 'idle' | 'committed' | 'error' | 'stopping'` — **não** existe `waiting_user`; F21 exige adicionar esse estado e garantir que ele não conta como `running` para lease/`thread_busy` (`acquireLease`/`releaseLease`/`isLeased`). Ex.: `src/services/db/repositories/threads.ts:7`, `src/services/runner/project-execution.ts`
- [Lease de projeto / thread_busy]: `acquireLease(projectId)`/`releaseLease(projectId)` em `project-execution.ts`; erro de domínio `thread_busy` (`LeaseConflictError`-like) quando já há turno rodando no projeto; F20/F21/F26 leem/gravam nesse ciclo sem precisar de lease próprio (F20 lê início/escreve fim de turno; F21 pausa mid-turno; F26 é fora do ciclo de turno). Ex.: `src/services/runner/project-execution.ts`
- [Bloco injetado no system prompt — padrão F06 Rules]: `composeRulesBlock(rules)` gera preâmbulo + seções delimitadas (`--- rule: <name> [scope] ---`) + rodapé, sanitizando linhas que colidem com o delimitador; F20 deve seguir o mesmo formato de bloco (preâmbulo + seção "memória" delimitada) para o "mesmo mecanismo de precedência de F06 Rules" citado no PRD. Ex.: `src/services/runner/rules-block.ts`
- [WS Hub por thread]: `subscribe(threadId, socket)`/`emit(threadId, event)` — pub/sub escopado a uma thread específica via `Map<threadId, Set<WebSocket>>`; não há canal global nem por-projeto. F26 (terminal PTY, não amarrado a uma thread) e o "sem reload" do painel de Memória (F20) precisam avaliar se reusam esse hub (com um `threadId` sintético) ou se abrem canal próprio. Ex.: `src/services/runner/ws-hub.ts`
- [Painéis do Repo Harness / WorkspaceSidebar]: cada domínio (Rules/Skills/SubAgents/MCPs) é uma seção com contagem (`useState<number|null>` + `useEffect` buscando `*Service.counts()`/`listForProject`) e um botão que abre `Project<Domínio>Modal`; F20 (painel "Memória") deve seguir esse mesmo formato de seção+contagem+modal (aqui: toggle + link "ver/editar journal" em vez de contagem). Ex.: `src/renderer/components/workspace/WorkspaceSidebar.tsx`
- [xterm já no bundle, sem PTY backend]: `@xterm/xterm` + `@xterm/addon-fit` já são dependências instaladas; `src/renderer/theme/xterm-theme.ts` já constrói um `XtermThemeMap` a partir das CSS vars do Design Lock (comentário no arquivo: "Consumers (F03) should call this after theme is applied"), mas **nenhum componente do app importa esse arquivo hoje** — é fundação pronta e não conectada. Não há `node-pty`, `child_process.spawn` de shell interativo, nem nenhum equivalente de PTY no repo — F26 precisa adicionar `node-pty` (ou equivalente) como dependência nova de zero, mais um canal IPC/WS para stream de stdin/stdout do processo. Ex.: `src/renderer/theme/xterm-theme.ts`, `package.json`
- [Sem child_process de shell interativo hoje]: os únicos usos de processo filho no repo são spawn do CLI do provider (`cli-driver.ts`) e do git (`git-client.ts`), ambos processos curtos/não-interativos com stdout parseado; nenhum é reutilizável como PTY genérico para F26. Ex.: `src/services/runner/providers/cli-driver.ts`, `src/services/git/git-client.ts`
- [Idle timeout / gate de subagent como referência de pausa]: `subagent-caller-gate.ts` + `idleTimeoutMinutes` em subagents já modelam "aguardar sem contar como erro"; útil como referência de UX/estado para o `waiting_user` sem timeout automático do F21 (PRD explicita "sem timeout automático nesta versão"). Ex.: `src/services/runner/subagent-caller-gate.ts`
- [Lint/format/build]: Biome; typecheck `tsc -b` no build; sem Zod no projeto (validação manual tipada é o padrão em todo o codebase, inclusive para os 4 do lote). Ex.: `package.json`

---

## 3. Conflitos resolvidos

| Conflito | Escolha | Regra aplicada |
|----------|---------|----------------|
| Novo estado de thread (F21): `waiting_user` como valor de `ThreadState` vs. flag booleana separada (`isWaitingUser`) | Estender o union `ThreadState` com `'waiting_user'` (mesmo padrão fechado já usado por `running/idle/committed/error/stopping`); lease/`thread_busy` tratam `waiting_user` como não-`running` | mais frequente (segue o padrão existente de estado único fechado, não introduz campo paralelo) |
| Journal de memória (F20): novo namespace no vault (`memory:<projectId>`) vs. arquivo cifrado separado por projeto vs. tabela SQLite | Vault secret namespaced (`memory:<projectId>` → conteúdo do `journal.md` cifrado) — reaproveita `vaultService.setSecret/getSecret` sem esquema novo; PRD já fala em "cofre para armazenar o journal cifrado junto dos demais segredos do projeto" | alinhado ao PRD F20 §Consome + mais frequente (vault já é o mecanismo de segredo por projeto, ex. keys de MCP OAuth) |
| Novos providers (F23): estender union `ThreadProvider` existente vs. campo de provider dinâmico/genérico | Estender o union fechado (`'glm' \| 'grok'` somados a `'claude'\|'codex'\|'kimi'\|'minimax'`) e replicar os 3 pontos de switch já identificados (key resolution, billing mode, picker) | mais frequente — é como Minimax foi adicionado em F10, sem generalizar o tipo |
| Terminal PTY (F26): reusar `node-pty` (nativo, precisa rebuild por versão do Electron) vs. `child_process.spawn` de shell sem pseudo-tty | Não fixado pelo Research — decisão de dependência nova cabe ao writer/plan de F26; documentar aqui apenas que **nenhuma das duas existe hoje** no repo, e que `@xterm/xterm` (frontend) já está pronto esperando por um backend | n/a — sem precedente no código para decidir por frequência; registrar como decisão em aberto do plan F26 |
| Canal de stream do terminal (F26) e "sem reload" do painel de Memória (F20) | Não fixado pelo Research — `ws-hub.ts` é hoje escopado a `threadId`, não há canal global/por-painel; writers de F20/F26 decidem se estendem o hub existente (com id sintético) ou abrem canal IPC/WS próprio | n/a — sem precedente equivalente no código |

---

## 4. Docs canônicos (preferir antes de explorar)

- `docs/DEVELOPMENT.md` — setup Vite/Electron/pnpm, pastas, portas 5173/5174, build
- `docs/PROGRESS.md` — status F01–F17 feitas; F18–F27 pendentes (backlog 1.3); Onda 4 = F04,F08,F09,F11,F12,F13,F14,F15,F16 (feitas) + F20,F21,F23,F26 (pendentes, alvo deste lote)
- `docs/PRD.md` §5 (histórias) e §6 (Consome/Provê/Capacidades/Experiência/Tratamento de Erros) — F20 linhas 230-235 e 827-859; F21 linhas 236-240 e 860-882; F23 linhas 247-251 e 921-944; F26 linhas 262-266 e 992-1009; ACs em §9 linhas 1342-1347 (F20), 1348-1353 (F21), 1361-1366 (F23), 1379-1384 (F26)
- `docs/design-system/design-system.md` (+ `tokens.md`, `color-palette.md`, `spacing.md`, `typography.md`) — Design Lock; `fontFamily.mono` já referenciado por `xterm-theme.ts` (relevante a F26)
- `docs/F01-vault-e-sessao-local/spec.md` (+ `ui.md`/`copy.md`) — vault, secrets, session; base de F20 (journal cifrado) e F23 (API keys)
- `docs/F03-workspace/spec.md` (+ `ui.md`/`copy.md`) — ciclo de dispatch, estados de thread, WS, Repo Harness; base dos 4 do lote
- `docs/F10-api-keys-providers/spec.md` (+ `ui.md`/`copy.md`) — padrão de card de key/validação/toggle que F23 clona para GLM/Grok
- `docs/F12-runtime-de-skills/spec.md` — padrão MCP interno `engrenacode` + snapshot por turno, referência direta para a tool `ask_user_question` de F21
- `docs/F15-runtime-de-subagents/spec.md` — `call_subagent` via MCP interno + delegação HTTP loopback, mesmo padrão de tool registration citado no brief para F21
- `CLAUDE.md` — regras aprendidas (portas, smoke, naming EngrenaCode, `ELECTRON_RUN_AS_NODE`)

---

## 5. Specs existentes

| Feature | Path | Uma linha de decisão / escopo | ui.md / copy.md |
|---------|------|-------------------------------|------------------|
| F20 | _(pasta `docs/F20-*` inexistente)_ | Spec/plan ainda não escritos — alvo deste lote | não / não |
| F21 | _(pasta `docs/F21-*` inexistente)_ | Spec/plan ainda não escritos — alvo deste lote | não / não |
| F23 | _(pasta `docs/F23-*` inexistente)_ | Spec/plan ainda não escritos — alvo deste lote | não / não |
| F26 | _(pasta `docs/F26-*` inexistente)_ | Spec/plan ainda não escritos — alvo deste lote | não / não |

Confirmado via `Glob` (`docs/F20-*`, `docs/F21-*`, `docs/F23-*`, `docs/F26-*`): nenhum diretório existe ainda no repo. Specs relacionadas já existentes (F01, F03, F05, F07, F10, F12, F15 — ver seção 4) servem de precedente mas não substituem a spec própria de cada feature do lote.

---

## 6. Onda — Consome/Provê (opcional, compacto)

| Feature | Consome | Provê |
|---------|---------|-------|
| F20 Memória Persistente | F01 (cofre p/ journal cifrado); F01.1 (tokens p/ painel); F03 (ciclo de dispatch — leitura no início, escrita/consolidação no fim do turno) | Bloco de memória (resumo + últimas entradas) injetado no system prompt do turno, mesmo mecanismo de precedência de F06 Rules — usado por F03; F22 (Onda 6) consome memória do projeto como contexto de entrada por estágio |
| F21 AskUserQuestion | F01.1 (tokens p/ card inline); F03 (ciclo de dispatch, estado da thread p/ pausar/retomar) | Estado de thread `waiting_user` com pergunta estruturada pendente — usado por F03; evento visível em F08 Registros; F22 (Onda 6) consome `ask_user_question` para checkpoints de aprovação entre estágios |
| F23 Providers GLM e Grok | F01 (vault p/ API keys); F02 (card "API keys dos providers" reaproveitado); F10 (padrão de validação/toggle já usado por Codex/Minimax) | GLM e Grok como `ThreadProvider` disponíveis para nova thread quando a key é válida — usado por F03 |
| F26 Terminal PTY no Dock | F01.1 (tokens de superfície, mono JetBrains já usado no xterm do chat); F03 (cwd do projeto/thread ativo) | Nenhuma outra feature do PRD consome dados de F26 nesta versão (superfície própria, dock) |

---

Fora do lote (referência rápida, não expandir): F22 (Onda 6) depende de F18/F19/F20/F21 — só pode começar após este lote fechar F20/F21.
