# Análise de Código — sistema legado

> Gerado pelo Archaeologist em 2026-07-28  
> `doc_level`: essencial  
> Progresso: 13/14 módulos

## Visão geral

Monorepo TypeScript (pnpm) que empacota uma IDE desktop Electron: o **shell** sobe o processo main, o **server** roda HTTP+WS no localhost com SQLite, o **renderer** é a UI React, e **shared** é o catálogo de contratos tipados.

---

## Módulo: `shell`

**Path:** `packages/shell`  
**Propósito:** Processo Electron (main/preload/janela/tray). Hospeda o server in-process, serves o renderer via scheme `app://`, e expõe IPC mínimo ao renderer.  
**Complexidade:** medium  
**Confiança:** 🟢 CONFIRMADO

### Arquivos primários

| Arquivo | Papel |
|---------|-------|
| `packages/shell/src/main.ts` | Bootstrap, server, protocol `app://`, tray, IPC |
| `packages/shell/src/preload.ts` | `contextBridge` → `window.lioncode` |
| `packages/shell/src/window.ts` | `BrowserWindow` + guards de navegação |
| `packages/shell/src/bootstrap-cleanup.ts` | Cleanup parcial em falha de boot |

### Fluxo de controle (texto)

1. Antes de `ready`: fixa `LINUX_APP_ID = 'lioncode'` (WM_CLASS) e registra scheme privilegiado `app`.
2. `app.whenReady` → `startLocalServer()` (dynamic import ESM de `@lioncode/server`) → IPC de session token + dialog de diretório → `registerAppProtocol()` → `createMainWindow()` → tray.
3. Credenciais do cofre: **somente HTTP** (renderer ↔ server). Shell só entrega `getSessionToken` por IPC e push `lioncode:vault:locked`.
4. Shutdown: remove handlers, unhandle protocol, `server.close()`.

### Algoritmos / lógica não-trivial

| Nome | Local | Descrição | Confiança |
|------|-------|-----------|-----------|
| `serveBundle` | `main.ts` | Mapeia `app://bundle/<path>` → `renderer/dist`, bloqueia path traversal | 🟢 |
| `serveMedia` | `main.ts` | Serve áudio em `app://media/<projectId>/<rel>` sob `.lioncode/audio/`, com rejeição sintática, prefixo normalizado + `realpath` (anti-symlink), e suporte a `Range` (200/206/416) | 🟢 |
| `importEsmModule` | `main.ts` | `Function('specifier','return import(specifier)')` para importar ESM do server a partir do shell CJS | 🟢 |
| `isInAppNavigation` | `window.ts` | Só permite navegar em `app://bundle/` ou Vite dev URL; https externo vai ao browser do sistema | 🟢 |

### Segurança (shell)

- `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`
- Origin estável `app://bundle` (evita `Origin: null` de `file://`)
- E2E hermético: `LIONCODE_E2E_HERMETIC=1` injeta `createE2eDriverRegistry` e `openExternal` no-op

### Dados / estruturas

| Entidade | Campos relevantes | Confiança |
|----------|-------------------|-----------|
| `VaultSessionBridge` | `getSessionToken()`, `onLock()` | 🟢 |
| `LocalServerHandle` | `host`, `port`, `vault`, `repositories.projects`, `close()` | 🟢 |
| `SistemaLegadoBridge` (preload) | `pickDirectory`, `getSessionToken`, `onVaultLocked`, `versions` | 🟢 |

### Dependências

→ `server`, `shared` (estrutural/tipos)

---

## Módulo: `shared`

**Path:** `shared` (`@lioncode/shared`)  
**Propósito:** Fonte de verdade dos contratos tipados entre shell, server e renderer (sem runtime deps).  
**Complexidade:** medium  
**Confiança:** 🟢 CONFIRMADO

### Arquivos primários (amostra)

| Arquivo | Papel |
|---------|-------|
| `shared/src/index.ts` | Barrel de exports |
| `shared/src/thread.ts` | Provider, ThreadState, AccessLevel, ExecutionMode |
| `shared/src/models.ts` | Catálogo `PROVIDER_MODELS` |
| `shared/src/api.ts` | DTOs HTTP |
| `shared/src/stream-event.ts` | Eventos WebSocket |
| `shared/src/feature-pipeline.ts` / `feature-build.ts` | Contratos dos pipelines `/featdevelop` e `/featbuild` |
| `shared/src/vault.ts`, `mcp.ts`, `subagent.ts`, `skill.ts`, `rule.ts` | Domínios de catálogo |

### Domínios de tipos (resumo)

| Domínio | Tipos / constantes chave | Confiança |
|---------|--------------------------|-----------|
| Providers | `PROVIDERS = claude\|codex\|glm\|minimax\|grok\|kimi` | 🟢 |
| Thread lifecycle | `idle`, `running`, `awaiting-review`, `committed`, `pr-open`, `pr-merged`, `pr-closed`, `error` | 🟢 |
| Access | `supervised`, `auto-accept-edits`, `full-access` | 🟢 |
| Execution | `main` \| `worktree` | 🟢 |
| Reasoning | `low`…`ultrathink` (+ `ultra` Codex) | 🟢 |
| Dispatch limits | `DISPATCH_PROMPT_MAX_CHARS`, `DISPATCH_IMAGE_MAX_COUNT` + parsers | 🟢 |
| Memory/dream | limites de journal/memory + ratios de dreaming | 🟢 |
| Transcription | providers/MIME/timeouts | 🟢 |

### Regras embutidas (exemplos)

- `isProvider(value)` valida contra catálogo 🟢
- `canTransitionFeatureBuild` / `canTransitionBuildSprint` (máquinas de estado do build) 🟢
- `parseDispatchTaskRequest` / `validateEffectiveDispatchSelection` (validação de dispatch) 🟢

### Dependências

Nenhuma runtime. Consumido por `server`, `renderer`, `shell`.

---

## Módulo: `server-core`

**Path:** `packages/server/src` (bootstrap, http, middleware, db; exclui domínios especializados listados à parte)  
**Propósito:** Server local HTTP+WS no loopback; SQLite; cadeia de segurança; montagem de rotas e serviços.  
**Complexidade:** high  
**Confiança:** 🟢 CONFIRMADO

### Arquivos primários

| Arquivo | Papel |
|---------|-------|
| `packages/server/src/server.ts` | `createServer` — bootstrap completo |
| `packages/server/src/config.ts` | Host/porta, origin allowlist, rate limits |
| `packages/server/src/http/router.ts` | Match método+path, body JSON ≤1 MiB, middleware |
| `packages/server/src/middleware/index.ts` | Cadeia de middlewares |
| `packages/server/src/db/client.ts` | `openDatabase` / `resolveDatabasePath` |
| `packages/server/src/db/migrations/` | 001–062 migrations idempotentes |
| `packages/server/src/routes/` | ~88 handlers HTTP |

### Fluxo de bootstrap (texto)

1. Resolve config (`127.0.0.1:4477` default; `LIONCODE_LOCAL_HOST` / `LIONCODE_LOCAL_PORT`).
2. Abre SQLite (`LIONCODE_DB_PATH` > `userData/lioncode.db` > fallback SO), PRAGMAs + migrations.
3. Cria vault, registries (providers, skills, MCPs, rules, subagents, turns), brokers, codegraph, dreamer, transcription.
4. Monta router com `routes` + middleware; sobe HTTP + WebSocket hub.
5. Reconcilia pipelines/builds e faz GC de worktrees/refs no boot (quando habilitado).

### Cadeia de middleware (ordem)

```
originGuard → errorHandler → vaultGuard → sessionAuth
  → requestValidation → projectScope → transactionWrapper → handler
```

🟢 CONFIRMADO em `middleware/index.ts`.

### Algoritmos / lógica

| Nome | Local | Descrição | Confiança |
|------|-------|-----------|-----------|
| `resolveDatabasePath` | `db/client.ts` | Precedência dbPath → env → userData → default SO | 🟢 |
| `matchSegments` | `http/router.ts` | Match de rotas com params `:id` | 🟢 |
| `readBody` | `http/router.ts` | Acumula body, rejeita >1 MiB, parse JSON | 🟢 |
| `runMiddlewareChain` | `middleware/index.ts` | Dispatch recursivo index→next | 🟢 |
| `loadServerConfig` | `config.ts` | Valida porta 1..65535 no startup | 🟢 |

### Dicionário de dados resumido (essencial)

Tabelas criadas/evoluídas via migrations (lista não exaustiva; Data Master aprofunda):

| Tabela | Origem | Papel |
|--------|--------|-------|
| `projects` | 001 | Projetos locais (path único) |
| `threads` | 001+ | Conversas/provider/estado/modos |
| `messages` / `tool_calls` / `diffs` / `log_entries` | 001 | Histórico e revisão |
| `quick_actions` | 001 | Atalhos por projeto |
| `subagents` / `project_subagents` / `subagent_runs` | 011+ | Catálogo e runs |
| `skills` / `project_skills` | 012 | Skills |
| `mcps` / `project_mcps` | 013 | MCPs |
| `rules` / `project_rules` | 015 | Rules |
| `commands` | 020 | Comandos `/…` |
| `model_pricing` / `usage_events` | 022 | Métricas/custo |
| `app_config` | 032 | Config global |
| `codegraph_runs` | 043 | Indexação CodeGraph |
| `feature_pipelines` (+ rounds/phases) | 047 | `/featdevelop` |
| `feature_builds` (+ sprints/rounds) | 050 | `/featbuild` |
| `data_seeds` | 045 | Seeds idempotentes |
| `schema_migrations` | runner | Controle de versão do schema |

### Config / env

| Variável | Default | Uso |
|----------|---------|-----|
| `LIONCODE_LOCAL_HOST` | `127.0.0.1` | Bind |
| `LIONCODE_LOCAL_PORT` | `4477` | Porta |
| `LIONCODE_DB_PATH` | userData | Path do SQLite |
| `LIONCODE_E2E_HERMETIC` | — | Fake drivers (shell) |

### Dependências

→ `shared`; orquestra `providers`, `runner`, `git`, `vault`, `mcp`, `memory`, `codegraph`, `metrics`, `terminal`

---

## Módulo: `providers`

**Path:** `packages/server/src/providers`  
**Propósito:** Camada de drivers de IA. Cada provider (claude, glm, minimax, codex, grok, kimi) implementa `ProviderDriver`: `dispatch` emite `RawStreamEvent` em ordem causal (sem `seq`); `cancel` interrompe o turno. O runner carimba `seq`/`threadId`, persiste e faz fan-out WS.  
**Complexidade:** high  
**Confiança:** 🟢 CONFIRMADO

### Arquivos primários

| Arquivo | Papel |
|---------|-------|
| `types.ts` | Contrato `ProviderDriver`, `DispatchOptions`, callbacks, `DispatchCancelledError` |
| `registry.ts` | `createDriverRegistry` — 6 drivers indexados por provider |
| `capabilities.ts` | Capabilities efetivas (subagents/skills/MCPs) por provider |
| `claude-agent.ts` | `ClaudeAgentDriver` (claude + GLM/Minimax compat via Agent SDK) |
| `codex.ts` | `CodexCliDriver` (app-server preferido, fallback `exec`) |
| `grok-acp.ts` / `kimi-acp.ts` | Drivers ACP (Agent Client Protocol / stdio) |
| `acp-shared.ts` | Helpers ACP: fila, `composePrompt`, normalização de tools |
| `subagent-bridge.ts` | Proxy HTTP + MCP stdio `lioncode-subagents` |
| `subagent-caller-gate.ts` | Gates estáticos/runtime de caller e allowlist |
| `cli-resolver.ts` | Resolve spawn shell-free (Windows unwrap de shims npm) |
| `claude-usage.ts` / `kimi-session-usage.ts` / `memory-session.ts` | Usage parsing e gate de re-injeção de memória |

### Fluxo de controle (texto)

1. Runner chama `registry.get(provider).dispatch(prompt, options)`.
2. **Família Claude:** monta MCP in-process `lioncode`, `canUseTool`, env nativo ou compat (`ANTHROPIC_BASE_URL` + token); `query()` do Agent SDK; resume com fallback se sessão missing.
3. **Codex:** valida access (só full-access no contrato comum); transport app-server ou exec; bridge MCP via proxy HTTP; usage cumulativo com delta em resume.
4. **Grok/Kimi ACP:** spawn CLI → `initialize` → session new/load → `prompt`; permissões via ACP; usage Grok de `_meta`, Kimi de `wire.jsonl`.
5. Cancel: `AbortController` do turno (Claude) ou SIGTERM/cancel ACP (Codex/Grok/Kimi) → `DispatchCancelledError`.

### Algoritmos / lógica não-trivial

| Nome | Local | Descrição | Confiança |
|------|-------|-----------|-----------|
| `parseClaudeUsage` | `claude-usage.ts` | Normaliza input com/sem cache; rejeita payloads inválidos | 🟢 |
| Usage delta Codex | `codex.ts` | Contadores cumulativos − baseline/`priorUsage` | 🟢 |
| Usage Kimi wire.jsonl | `kimi-session-usage.ts` | Delta por byte-offset; retry; arquivo encolhido → null | 🟢 |
| `MemorySessionGate` | `memory-session.ts` | SHA-256 + LRU 256: re-injeta só sessão nova ou hash mudou | 🟢 |
| `resolveCli` | `cli-resolver.ts` | PATH/override → unwrap `.cmd` → `node`/`codex.exe` sem shell | 🟢 |
| `startHarnessProxy` | `subagent-bridge.ts` | HTTP localhost + Bearer; rotas delegate/save-memory/repo-graph | 🟢 |
| Path-guard D13 | `claude-agent.ts` | Write/Edit fora do cwd do filho → deny sem prompt | 🟢 |
| Contained execution | claude/codex | Validador: sem integrações herdadas / HOME descartável | 🟢 |

### Regras de negócio (amostra)

| Regra | Confiança |
|-------|-----------|
| Drivers não tocam DB/WS nem conhecem `seq` | 🟢 |
| GLM/Minimax exigem key no cofre (`available=false` sem ela) | 🟢 |
| Claude: sem key → assinatura OAuth; strip `ANTHROPIC_*` herdado | 🟢 |
| `plan` tem precedência sobre `accessLevel` no permission mode | 🟢 |
| Codex: plan/supervised rejeitados; MCP/subagents exigem full-access | 🟢 |
| Subagent caller: claude/codex/grok/kimi ON; glm/minimax OFF | 🟢 |
| MCP caller: família Claude + grok/kimi ON; codex via própria + freio env | 🟢 |
| Allowlist de tools enforced em claude/glm/minimax/codex; não em grok/kimi | 🟢 |
| Freios env fail-closed: `SUBAGENT_CALLER_ENABLED_CODEX`, `MCP_CALLER_ENABLED_CODEX` | 🟢 |

### Dados / estruturas

| Entidade | Campos relevantes | Confiança |
|----------|-------------------|-----------|
| `ProviderDriver` | `name`, `available`, `dispatch`, `cancel` | 🟢 |
| `DispatchOptions` | threadId, worktreePath, accessLevel, resumeSessionId, subagents, skills, mcps, tools, closures | 🟢 |
| `RegistryDeps` | resolveClaudeKey, resolveGlmKey, resolveMinimaxKey | 🟢 |
| `CliInvocation` | command, prefixArgs, resolved, viaShell, env | 🟢 |
| `ParsedClaudeUsage` | input/output/cache tokens | 🟢 |

### Dependências

→ `shared`, Claude Agent SDK, ACP SDK; consumido por `runner`, `server.ts`, rotas de config, `memory/consolidator`

---

## Módulo: `runner`

**Path:** `packages/server/src/runner`  
**Propósito:** Núcleo de execução do servidor. Orquestra turnos de ponta a ponta: worktree, composição de contexto (rules/memory/codegraph/MCPs/skills/subagents), motores especializados (`workflow`, `/featdevelop`, `/featbuild`), consumo do stream do driver com allocate-then-emit de `seq`, persistência, diffs, cancel em cascata e delegação de subagentes.  
**Complexidade:** high  
**Confiança:** 🟢 CONFIRMADO

### Arquivos primários

| Arquivo | Papel |
|---------|-------|
| `dispatch.ts` | `runDispatch` / `scheduleDispatch` — orquestrador (~4k LOC) |
| `delegate.ts` | `runDelegatedSubagent` — broker do filho efêmero |
| `turns.ts` | `TurnRegistry` — AbortController + árvore pai→filhos |
| `seq-allocator.ts` | Única fonte de `seq` monotônico por thread |
| `permission-broker.ts` / `question-broker.ts` | Ponte bloqueante tool-approval / AskUserQuestion |
| `delegation-lock.ts` | RW-lock por `parentCwd` (read compartilhado / write exclusivo) |
| `rendezvous.ts` | Correlação `call_subagent` ↔ `delegate` por conteúdo |
| `workflow-motor.ts` | Motor de planos workflow (estágios, barreira, integração) |
| `feature-pipeline-motor.ts` | Motor `/featdevelop` |
| `feature-build-motor.ts` | Motor `/featbuild` + journal write-ahead |
| `integrate.ts` | Extração de patch + integração determinística de children |
| `*-registry.ts` / `*-block.ts` / `mcp-secrets.ts` | Catálogos live e composição de blocos |

### Fluxo de controle (texto)

1. Rota monta `DispatchContext` → lease de projeto → `runDispatch`.
2. Registra turno (`TurnRegistry` + `AbortController`); resolve worktree (`main` = cwd vivo; `worktree` = branch `lioncode/<thread>`).
3. Snapshot de catálogos; compõe rules/memory/codegraph; prepara MCPs (secrets).
4. Se comando: despacha motor (workflow / feature-pipeline / feature-build).
5. `driver.dispatch` → loop allocate-then-emit (`seq` em text blocks e `tool_call.start`).
6. Delegação: rendezvous → `runDelegatedSubagent` (depth=1, RW-lock, watchdog idle/hard/plan).
7. Flush, diffs/`diff.ready`, thread → `idle`/`error`; finally limpa MCP/brokers/lease.

### Algoritmos / lógica não-trivial

| Nome | Local | Descrição | Confiança |
|------|-------|-----------|-----------|
| Allocate-then-emit | `seq-allocator.ts` + `dispatch.ts` | `next()` seed lazy MAX(seq)+1; controle/telemetria sem seq | 🟢 |
| Cancel cascade | `turns.ts` | abort controller + `driver.cancel` pai + cancel direto dos filhos | 🟢 |
| Delegation RW-lock | `delegation-lock.ts` | read-only → `acquireRead`; write → `acquireWrite`; live-write skip (M8) | 🟢 |
| Rendezvous | `rendezvous.ts` | chave canônica `{subagent,task,context}` + filas; timeout 5s | 🟢 |
| Watchdog filho | `delegate.ts` | idle 20min (silêncio), hard 2h, teto plano = min(hard, plano) | 🟢 |
| Isolamento D14 | `isolation-coercion.ts` | MCPs → live-write; write+shared-read → worktree | 🟢 |
| Feature-build journal | `build-state.ts` | write-ahead `prepared→running→completed`; recovery dangling | 🟢 |
| Integrate child | `integrate.ts` | merge-tree, stale-base, conflict retention | 🟢 |

### Regras de negócio (amostra)

| Regra | Confiança |
|-------|-----------|
| Único produtor de `seq` por thread; `diff.ready`/`state.change`/`token.usage` sem seq | 🟢 |
| Profundidade de delegação = 1; filho nunca recebe `subagents`/`delegate` | 🟢 |
| Erro do filho não derruba o pai; cancel → `status='cancelled'` | 🟢 |
| Memória só no pai; falha de leitura → turno segue sem bloco | 🟢 |
| Permission/question pendentes no cancel → deny / `{}` | 🟢 |
| Pipeline: `pending_resume` + scheduler onIdle; build: retomada explícita | 🟢 |
| Review pinado filtra metadados `docs/features/<slug>/` do diff pending | 🟢 |

### Dados / estruturas

| Entidade | Campos relevantes | Confiança |
|----------|-------------------|-----------|
| `DispatchContext` | repositories, ws, seqAllocator, brokers, registries, drivers, turns | 🟢 |
| `DispatchRequest` | thread, driver, prompt, repoPath, command?, lease? | 🟢 |
| `DelegateRequest` | parentThreadId, parentCwd, subagentDef, task, isolation, depth | 🟢 |
| `DelegateResult` | text, status, childThreadId, usage?, timeoutOrigin? | 🟢 |
| `SeqAllocator` | `next(threadId)`, `forget(threadId)` | 🟢 |
| `TurnRegistry` | register, abort, linkChild, complete | 🟢 |

### Dependências

→ `providers`, `git`, `vault`, `memory`, `codegraph`, `metrics`, `shared`, DB repos; consumido por rotas de dispatch/pipeline/build e `server.ts`

---

## Módulo: `git`

**Path:** `packages/server/src/git`  
**Propósito:** Infraestrutura Git do servidor: worktrees persistentes por thread, baselines de review, diffs, apply accept/reject, repo-lock, lease de execução longa, refs duráveis (`refs/lioncode/*`), child-worktrees e PR/push multi-provider (GitHub/GitLab/Bitbucket/Azure) com allowlist de hosts.  
**Complexidade:** high  
**Confiança:** 🟢 CONFIRMADO

### Arquivos primários

| Arquivo | Papel |
|---------|-------|
| `worktree.ts` / `worktree-remove.ts` | Worktrees persistentes `lioncode/<short>` + remoção 2 camadas |
| `child-worktree.ts` / `child-reconciliation.ts` | Children efêmeros + reconciliação pós-crash |
| `diff.ts` | Diffs worktree e entre refs + parse unified |
| `review-baseline.ts` / `tree-snapshot.ts` | Snapshots imutáveis para accept/reject |
| `apply.ts` | Apply no main com dry-run, rollback, finalize |
| `repo-lock.ts` / `project-execution.ts` | Mutex curto + lease longa (1 exec/repo) |
| `fork-refs.ts` / `conflict-patches.ts` | Refs `refs/lioncode/*` + GC |
| `pr.ts` / `vcs-provider.ts` / `vcs-registry.ts` | Commit → push → PR/MR |
| `providers/*` + `host-allowlist.ts` | Drivers VCS + bloqueio de exfiltração de token |
| `exec.ts` / `status.ts` / `branches.ts` | Exec git, status, branches |

### Fluxo de controle (texto)

1. Dispatch: lease → modo `main` (cwd vivo) ou `worktree` (reusa path ativo ou `createWorktree`).
2. Path determinístico em `tmpdir/lioncode-worktrees/<threadId>` (cwd estável = resume de sessão).
3. Review: `captureReviewBaseline` → turno → `generateDiffs` / `generateDiffsBetweenRefs` → diffs pending.
4. Accept: dry-run `--check` → commit interno no worktree → apply no main sob `withRepoLock`.
5. PR: resolve provider → `assertHostAllowed` → commit sob lock → push autenticado efêmero → openChangeRequest.

### Algoritmos / lógica não-trivial

| Nome | Local | Descrição | Confiança |
|------|-------|-----------|-----------|
| Worktree determinístico | `worktree.ts` | Path fixo + branch nomeada; recriação pós-sumiço | 🟢 |
| Review baseline | `review-baseline.ts` | Index temp → write-tree → refs sob `baselines/<id>/` | 🟢 |
| Repo-lock | `repo-lock.ts` | Fila Promise não-reentrante, timeout 30s | 🟢 |
| Host allowlist | `host-allowlist.ts` | Token nunca para host fora da lista (sem override) | 🟢 |
| Fork-refs GC | `fork-refs.ts` | forks 24h, conflicts/backups 30d; `update-ref --stdin` | 🟢 |
| Child pre-flight | `child-worktree.ts` | Git ≥2.40 + disco ≥ 1.5×N×checkout | 🟢 |

### Regras de negócio (amostra)

| Regra | Confiança |
|-------|-----------|
| Worktree não removido ao fim do turno; só delete/GC | 🟢 |
| GC não apaga thread viva, worktree ativo ou dir &lt; 60s | 🟢 |
| Reject bloqueado se HEAD/branch divergiu pós-turno | 🟢 |
| Uma execução longa por repo (`projectExecutionRegistry`) | 🟢 |
| Paths de diff: relativos, sem `..`, não absolutos | 🟢 |

### Dados / estruturas

| Entidade | Campos relevantes | Confiança |
|----------|-------------------|-----------|
| `WorktreeHandle` | path, repoPath, branch | 🟢 |
| `FileDiff` | file, additions, deletions, hunks | 🟢 |
| `CapturedReviewBaseline` | id, worktreeRef, indexRef, outputRef, headSha | 🟢 |
| `ProjectExecutionLease` | token, ownerType, operation, threadId? | 🟢 |
| `OpenPrParams` | repoPath, branch, files, snapshotRefs?, hostAllowlist | 🟢 |
| `VcsHostAllowlist` | hosts: ReadonlySet&lt;string&gt; | 🟢 |

### Dependências

→ `shared`, `exec`, DB (`review-baselines`); consumido por `runner`, rotas git/PR/accept, `server.ts` (GC boot)

---

## Módulo: `vault`

**Path:** `packages/server/src/vault` (+ middleware/rotas de gate)  
**Propósito:** Cofre local cifrado em repouso (`vault.enc`): desbloqueio por senha, credenciais só em memória, session token para o renderer, e gate HTTP (`vaultGuard` + `sessionAuth`).  
**Complexidade:** high  
**Confiança:** 🟢 CONFIRMADO

### Arquivos primários

| Arquivo | Papel |
|---------|-------|
| `vault/vault.ts` | `createVault`: unlock/lock, payload, backoff, session token |
| `vault/crypto.ts` | scrypt KDF + AES-256-GCM |
| `vault/store.ts` | Envelope JSON, write atômico (temp+fsync+rename), perms 0600 |
| `vault/index.ts` | Barrel de exports |
| `middleware/vault-guard.ts` | Bloqueia rotas não-`public` se cofre travado (423) |
| `middleware/session-auth.ts` | Exige header `X-sistema-legado-Session` (401 se inválido) |
| `routes/vault-unlock.ts` | `POST /vault/unlock` (única rota pública de negócio) |
| `http/rate-limiter.ts` | Teto global de unlock (janela fixa) |

### Fluxo de controle (texto)

1. Boot (`server.ts`): `createVault({ vaultDir })` — dir = `userDataPath` / ao lado do DB / cwd se `:memory:`.
2. Unlock: rate limit global → backoff por workspace → se sem arquivo, inicializa envelope; senão deriva chave, decifra, normaliza payload legado, emite session token.
3. Senha errada: `{ unlocked: false }` (+ `retryAfterMs` se backoff ativo); envelope ilegível → `VaultCorruptedError` (distinto).
4. Cadeia HTTP: `vaultGuard` → `sessionAuth` → handler. Token nunca em query/HTTP body de unlock.
5. Lock: zera chave em memória, invalida token, dispara `onLock` (WS 1008 + IPC `vault.locked`).
6. Leituras/escritas de credenciais exigem unlocked; persistência re-cifra o payload inteiro.

### Algoritmos / lógica não-trivial

| Nome | Local | Descrição | Confiança |
|------|-------|-----------|-----------|
| scrypt + AES-GCM | `crypto.ts` | N=2^15, r=8, p=1, keylen=32; authTag = verificador de senha | 🟢 |
| Backoff exponencial | `vault.ts` `clampDelay` | Após 5 falhas: 1s × 2^over, teto 60s; rejeita sem testar senha | 🟢 |
| Write atômico | `store.ts` | `.vault-<pid>-<ts>.tmp` → fsync → rename; limpa tmp em erro | 🟢 |
| Merge de provider keys | `setProviderKeys` | Campo vazio preserva valor já salvo (save parcial) | 🟢 |
| Session token | `vault.ts` | 32 bytes hex; `timingSafeEqual`; só via IPC shell→renderer | 🟢 |
| Normalização legado | `unlock` | `githubToken` → `vcsTokens.github`; campos ausentes → `{}` / default | 🟢 |
| Transcription batch | `updateTranscriptionKeys` | clone → mutate → persist → publica (rollback se write falha) | 🟢 |

### Regras de negócio (amostra)

| Regra | Confiança |
|-------|-----------|
| Senha nunca persistida; só chave derivada em runtime | 🟢 |
| Segredos MCP/OAuth/STT nunca no SQLite nem ecoados em HTTP | 🟢 |
| Anti-enumeração: senha errada ≠ cofre corrompido | 🟢 |
| Rate limit global de unlock complementa (não substitui) backoff por workspace | 🟢 |
| `claudeAuthMode` default = assinatura; só `api-key` explícito muda | 🟢 |
| Namespace OAuth MCP separado de `mcpSecrets` (não aparece em `listMcpSecretKeys`) | 🟢 |

### Dados / estruturas

| Entidade | Campos relevantes | Confiança |
|----------|-------------------|-----------|
| `VaultEnvelope` | version, workspace, kdf(+salt), cipher, iv, authTag, data | 🟢 |
| `VaultPayload` | providerKeys, githubToken, vcsTokens, claudeAuthMode, mcpSecrets, mcpOauth, transcriptionKeys | 🟢 |
| `McpOauthTokens` | accessToken, refreshToken?, expiresAt?, clientSecret?, connectedAt, lastError? | 🟢 |
| `UnlockedState` | workspace, key, salt, payload | 🟢 |
| `BackoffConfig` | threshold=5, baseMs=1000, maxMs=60000 | 🟢 |
| `EncryptedBlob` | iv (12B), authTag, ciphertext | 🟢 |

### Dependências

→ `shared` (tipos/keys); consumido por middleware, rotas config/mcp/vcs, runner, shell (IPC session), WS

---

## Módulo: `mcp`

**Path:** `packages/server/src/mcp` + rotas MCP + `runner/mcp-*`  
**Propósito:** Catálogo first-party de presets, CRUD/vínculo de defs MCP, OAuth 2.1 remoto, secrets via vault, e resolução segura no dispatch (SecretResolver + wrapper anti-leak em argv).  
**Complexidade:** high  
**Confiança:** 🟢 CONFIRMADO

### Arquivos primários

| Arquivo | Papel |
|---------|-------|
| `mcp/catalog.ts` | `MCP_CATALOG` (~14 presets) + `presetDefTemplate` / sentinelas |
| `mcp/oauth.ts` | `McpOauthManager`: discovery, PKCE, loopback, refresh, bearer |
| `routes/mcp-catalog.ts` | GET catálogo + POST install (idempotente, 409) |
| `routes/mcps.ts` | CRUD global + vínculo N:N por projeto |
| `routes/mcp-oauth.ts` | start/status/disconnect/client/convert |
| `routes/mcp-secrets.ts` | GET keys / PUT / DELETE (nunca ecoa valores) |
| `runner/mcp-registry.ts` | Query live: `resolveForProject` / `resolveByIds` |
| `runner/mcp-secrets.ts` | SecretResolver + loopback wrapper token-por-arquivo |

### Fluxo de controle (texto)

1. Install preset → cria def em `mcps` (OAuth: `headers.Authorization = {oauthRef}`; stdio: `{secretRef}` / `{literal}` no env). Sem placeholder no vault.
2. OAuth Connect: rate/vault check → discovery (WWW-Authenticate → RFC 9728 → RFC 8414) → client (static/CIMD/DCR/manual) → PKCE + loopback → tokens no vault; status público no DB.
3. Dispatch: registry (defs com refs) → SecretResolver (resolve secrets/OAuth, omite se ausente) → stdio com secretRef vira wrapper via loopback efêmero (segredo fora de argv/ps).
4. Sentinelas: `LIONCODE_NODE` → `execPath`; `LIONCODE_MCP_SERVER_DIST:<pkg>` → `mcp-servers/<pkg>/dist/index.js`.

### Algoritmos / lógica não-trivial

| Nome | Local | Descrição | Confiança |
|------|-------|-----------|-----------|
| OAuth discovery em camadas | `oauth.ts` `discover` | 401+resource_metadata → well-known path/root → fallback legado | 🟢 |
| Client resolution | `ensureClient` | static → CIMD → DCR → needs-client-id | 🟢 |
| PKCE + loopback | `startInner` / `openLoopback` | S256; porta fixa se redirect cached; timeout 5 min | 🟢 |
| Refresh mutex | `getBearerToken` | Promise-chain por mcpId; margem 5 min; `invalid_grant` apaga tokens | 🟢 |
| Secret wrapper | `mcp-secrets.ts` | Loopback GET /mcp-spec + token file 0600; wrapper apaga file e spawna real | 🟢 |
| Flow slot reservation | `startingFlows` | Reserva sync antes do 1º await (anti double-click) | 🟢 |
| Endpoint safety | `assertSafeEndpoint` | https obrigatório; http só loopback | 🟢 |

### Regras de negócio (amostra)

| Regra | Confiança |
|-------|-----------|
| Nome `lioncode` reservado (broker); regex `^[a-z0-9][a-z0-9_-]*$` | 🟢 |
| `{secretRef}` em headers rejeitado (vaza em `--mcp-config`/argv) | 🟢 |
| Token/client_secret nunca em log, DB público ou HTTP response | 🟢 |
| Install não cria placeholder no vault | 🟢 |
| MCP omitido do dispatch se cofre travado / secret ausente / OAuth indisponível (não derruba turno) | 🟢 |
| Registry é query live (sem cache de boot) | 🟢 |
| Convert to OAuth é opt-in (nunca silencioso) | 🟢 |

### Dados / estruturas

| Entidade | Campos relevantes | Confiança |
|----------|-------------------|-----------|
| `McpCatalogPreset` | id, transport, secretKeys, literalKeys, authMode?, remoteUrl?, oauth? | 🟢 |
| `PresetDefTemplate` | command, args, url | 🟢 |
| `McpOauthClientInfo` | clientId, source, endpoints, resource, scopes?, redirectUri? | 🟢 |
| `McpDefWithRefs` | env/headers com `{secretRef}\|{literal}\|{oauthRef}` | 🟢 |
| `ResolvedMcpDef` | valores resolvidos (único tipo que cruza o driver) | 🟢 |
| `McpDispatchDelivery` | defs, omitted, cleanup | 🟢 |
| `OmittedMcp` | name, reason | 🟢 |

### Dependências

→ `vault`, `shared`, DB (`mcps`/`project_mcps`); consumido por `runner`/dispatch, rotas, UI de catálogo

---

## Módulo: `memory`

**Path:** `packages/server/src/memory` (+ rota + injeção no runner)  
**Propósito:** Memória de projeto em `<projeto>/.lioncode/`: journal determinístico (git events), `memory.md` curado (tool/UI), e dreaming/consolidação LLM fail-closed com CAS e backups.  
**Complexidade:** high  
**Confiança:** 🟢 CONFIRMADO

### Arquivos primários

| Arquivo | Papel |
|---------|-------|
| `project-memory-fs.ts` | FS base: ensure, anti-symlink, readBounded, writeAtomic |
| `journal.ts` | Gramática de linhas commit/push/pr; sanitize; tetos |
| `memory-file.ts` | Template 3 seções; dedupe; save_memory |
| `head-delta.ts` | Delta de HEAD no turno (ancestralidade + teto 20) |
| `config.ts` | Kill switches tri-state em `app_config` |
| `dreamer.ts` / `dreamer-state.ts` | Coordenador `pump()` + estado por projeto |
| `consolidator.ts` | Spawn LLM isolado (só família Claude, sem tools) |
| `routes/project-memory.ts` | GET/PUT memory, config, journal clear/reset |
| `runner/memory-block.ts` | Bloco markdown injetado no prompt (+ hint line) |

### Fluxo de controle (texto)

1. Eventos git / head-delta → append journal (chamador sob `withRepoLock`).
2. Tool `save_memory` / PUT UI → seção canônica + dedupe + teto bytes; CAS por hash.
3. Dreaming: gatilho (debounce / force / teto) → `pump` → se busy, arma e espera `onIdle` → LLM fora do lock → apply sob lock com CAS + 3 backups + report.
4. Runner: `composeMemoryBlock` injeta fatia limitada de memory+journal; hint line sempre.

### Algoritmos / lógica não-trivial

| Nome | Local | Descrição | Confiança |
|------|-------|-----------|-----------|
| Journal sanitize/format | `journal.ts` | Remove controles/`·`/brackets; timestamp com offset; gramática fechada | 🟢 |
| Dedupe por seção | `normalizeForDedupe` | trim → bullet → data → NFC → casefold → whitespace | 🟢 |
| Head delta | `head-delta.ts` | HEAD via FS (sem spawn); só se ancestral; teto 20 commits | 🟢 |
| Consolidation guardrails | `validateConsolidation` | headings, vazio, teto bytes, perda >50% linhas; refs perdidas = warn | 🟢 |
| Fail-closed consolidator | `consolidator.ts` | cwd tmp vazio, env mínimo, `--tools ""`, dado via stdin delimitado | 🟢 |
| UTF-8 boundary cut | `utf8BoundaryCut` | Não parte code point em leituras limitadas | 🟢 |
| Tri-state toggles | `config.ts` | projeto ?? global ?? ON; dreaming exige memory ON | 🟢 |

### Regras de negócio (amostra)

| Regra | Confiança |
|-------|-----------|
| Path nunca vem do cliente (`ProjectMemoryTarget`) | 🟢 |
| Só "Resetar journal" descarta verbatim do dono (P7) | 🟢 |
| Anomalia/truncado ⇒ `editable: false`, PUT/dream bloqueados | 🟢 |
| Codex/grok fora do dreaming (sem modo sem tools) | 🟢 |
| Conteúdo do memory é DADO, nunca instrução (boundary sanitize) | 🟢 |
| `.lioncode/` no git exclude (ensure-once) | 🟢 |

### Dados / estruturas

| Entidade | Campos relevantes | Confiança |
|----------|-------------------|-----------|
| `ProjectMemoryTarget` | projectId, projectPath, appConfig | 🟢 |
| `JournalEntryInput` | kind, branch, remote?, shortSha?, prNumber?, thread*, summary, now | 🟢 |
| `MemoryRead` | exists, content, truncated, bytes, hash | 🟢 |
| `MemorySection` | Decisões \| Restrições \| Pendências | 🟢 |
| `GuardrailVerdict` | ok, reason?, lostRefs | 🟢 |
| `DreamRequestMode` | force \| (debounce modes via dreamer-state) | 🟡 |

### Dependências

→ `shared`, `git` (repo-lock, project-execution), `providers` (claude env), `app_config`; consumido por runner, rotas git, UI memória

---

## Módulo: `codegraph`

**Path:** `packages/server/src/codegraph` (+ rotas + UI renderer + contratos shared)  
**Propósito:** Graph de código por projeto via CLI externa `codegraph`: writer exclusivo (build/reindex/update/repair), detecção de staleness, auto-sync, auto-install pinado, e tools read-only `repo_graph_*` injetadas no dispatch. O agente nunca spawna a CLI.  
**Complexidade:** high  
**Confiança:** 🟢 CONFIRMADO

### Arquivos primários

| Arquivo | Papel |
|---------|-------|
| `engine.ts` | Writer único: jobs, status efetivo, autoSync, injecção, cancel |
| `detect.ts` | Verdade no disco = `.codegraph/codegraph.db` + lock/PID |
| `cli.ts` | Resolver + sonda versão/capabilities; env mínimo; cache positivo |
| `queries.ts` | Backend `repo_graph_*` (caps, `--` posicional, fail-closed) |
| `staleness.ts` | Lazy HEAD/porcelain/pendingChanges; throttle 5min + epochs |
| `installer.ts` | Download sob demanda do bundle pinado (1.4.1) |
| `gitignore.ts` | Append idempotente de `.codegraph/` antes do init |
| `status-parse.ts` | Parse validado de `status --json` |
| `shared/src/codegraph.ts` | Contratos HTTP/WS/tools |
| `routes/codegraph-*.ts` | GET status, POST build/reindex/update/repair/cancel/suppress |
| `renderer/.../codegraph.logic.ts` | Gate de oferta, badge, heurísticas de UI |

### Fluxo de controle (texto)

1. Oferta (UI): `absent` + arquivos indexáveis + CLI ok/auto-installable + oferta não suprimida → consent → POST build.
2. Job: seção síncrona (CLI, slot, lock externo, lease delete/repair) → gitignore (build/repair) → createRun → spawn detached (`init` / `index --force` / `sync` / wipe+`init`) → watchdogs 10min total / 90s idle.
3. Status efetivo (matriz): run build/reindex/repair OU lock vivo sem job nosso ⇒ `building`; senão db ausente ⇒ absent/error; senão stale detector ⇒ ready|stale.
4. Auto-sync fire-and-forget (`update`): abertura de thread, início de dispatch, pós-commit app, e quando GET detecta stale (throttle 30s).
5. Dispatch: `getInjectionState` (ready|stale + CLI + fileCount>0 + não parcial) → tools `repo_graph_*` via `runTool` (nunca crasham o turno).
6. Corrupção SQLite em reindex ⇒ mensagem instrutiva + encadeia `repair` automático após liberar o slot.

### Algoritmos / lógica não-trivial

| Nome | Local | Descrição | Confiança |
|------|-------|-----------|-----------|
| Matriz de status efetivo | `engine.getStatus` | building por run/lock; stale via detector; partial index gate | 🟢 |
| Kill process group | `killJob` | POSIX `kill(-pid)` SIGTERM→SIGKILL; Win `taskkill /T /F` | 🟢 |
| Protocolo DELETE × job | `startJob` | Sem await entre check lease delete e registro no Map | 🟢 |
| Staleness + epochs | `staleness.ts` | HEAD≠indexed / dirty mtime / pendingChanges; invalidate race-safe | 🟢 |
| Argv tool safety | `queries.buildCommand` | Rejeita `-` inicial + posicional após `--` | 🟢 |
| Lock age heuristic | `detect.ts` | PID "vivo" + lock >10min ⇒ tratado como morto (PID reciclado) | 🟢 |
| CLI probe | `cli.ts` | `>=1.0.1 <2.0.0` + help com `node`/`explore`; negativos não cacheiam | 🟢 |
| Managed install | `installer.ts` | Consent via POST job; SHA256; prune versões antigas do alvo | 🟢 |

### Regras de negócio (amostra)

| Regra | Confiança |
|-------|-----------|
| Verdade de "inicializado" = existência de `codegraph.db`, não do diretório | 🟢 |
| Graph jamais se remove; db corrompido converge para `repair` | 🟢 |
| Build/reindex NÃO adquirem lease de `projectExecutions` (só repair) | 🟢 |
| Cancel fica FORA do slot de exclusão mútua | 🟢 |
| Init repetido com db presente = no-op (responde estado, J4) | 🟢 |
| Oferta suprimida (projeto/global) nunca bloqueia injeção | 🟢 |
| Stdin do job FECHADO (CLI pendura com stdin aberto) | 🟢 |
| Tools falham como `{ok:false,error}` — nunca crash do turno | 🟢 |
| Auto-sync nunca lança; skip silencioso se busy/ausente/throttle | 🟢 |

### Dados / estruturas

| Entidade | Campos relevantes | Confiança |
|----------|-------------------|-----------|
| `CodegraphStatus` | absent \| building \| ready \| stale \| error | 🟢 |
| `CodegraphRunKind` | build \| reindex \| update \| repair | 🟢 |
| `CodegraphStats` | fileCount, nodeCount, edgeCount, dbSizeBytes, lastIndexed, pendingChanges, reindexRecommended, builtWithVersion? | 🟢 |
| `CodegraphStatusResponse` | cli*, status, hasIndexableFiles, stats?, run?, suppressed*, lastInitError | 🟢 |
| `CodegraphInjectionState` | status, injectable, stats, cliAvailable | 🟢 |
| `CodegraphDiskState` | dbPresent, lockPid, lockAlive, lockStaleByAge | 🟢 |
| Persistido (`projects`) | codegraph_status, indexed_commit, last_indexed_at, stats_json, offer_suppressed | 🟢 |
| `codegraph_runs` | id, projectId, kind, status, output, error, durationMs, statsJson | 🟢 |
| `RepoGraphTool` | status, search, minimal_context, impact, node, callers, callees | 🟢 |

### Dependências

→ `shared`, `git` (project-execution), `providers` (cli-resolver), DB (`projects` + `codegraph_runs` + `app_config`); consumido por dispatch/runner, rotas, UI codegraph

---

## Módulo: `metrics`

**Path:** `packages/server/src/metrics` (+ `usage-events`/`pricing` + rotas `/metrics/*`, `/usage-limits`, `/pricing/*`)  
**Propósito:** Contabilidade de tokens e custo por turno (agent/subagent), tabela de preços por modelo, agregações de consumo (summary/projetos/threads) e limites de assinatura das CLIs conectadas.  
**Complexidade:** medium  
**Confiança:** 🟢 CONFIRMADO

### Arquivos primários

| Arquivo | Papel |
|---------|-------|
| `metrics/cost.ts` | Validação de tokens, custo por tabela, normalização SDK vs table |
| `db/repositories/usage-events.ts` | Persistência + agregações SQL + worker de summary |
| `db/repositories/usage-summary-worker.ts` | Worker thread readonly para summary em DB em arquivo |
| `db/repositories/pricing.ts` | CRUD `model_pricing` |
| `routes/metrics-*.ts` | GET summary / projects / project detail / thread detail |
| `routes/metrics-period.ts` | Parse de `from`/`to` ISO e paginação limit≤500 |
| `routes/pricing-*.ts` | List/create/update pricing + recalc de custos null |
| `routes/usage-limits.ts` | Quotas de assinatura (Codex/Claude/GLM/MiniMax/Kimi) |
| `shared/src/metrics.ts` | Contratos DTOs |
| `runner/dispatch.ts` `persistUsage` | Ponto de escrita no fim do turno |

### Fluxo de controle (texto)

1. Driver emite `RawTokenUsage` → `persistUsage` (só se input+output presentes).
2. `normalizeUsageCosts`: Claude pode usar custo SDK/`perModel`; demais → tabela `model_pricing`.
3. Persistência em `usage_events` (1 linha agregada ou N por modelo); `repo_graph_calls` só na 1ª linha agent.
4. UI Consumo: GET `/metrics/summary` (+ worker se DB em disco) e `/metrics/projects`; drill-down por projeto/thread.
5. CRUD pricing: create/update recalcula `cost_usd IS NULL AND cost_source='table'`.
6. Sidebar Limites: GET `/usage-limits` consulta cada provider isolado (falha → unavailable, nunca 500).

### Algoritmos / lógica não-trivial

| Nome | Local | Descrição | Confiança |
|------|-------|-----------|-----------|
| `calculateTableCost` | `cost.ts` | uncached + cacheRead + cacheWrite + output / 1e6 | 🟢 |
| `normalizeUsageCosts` | `cost.ts` | Preferência SDK; se perModel diverge do agregado → fallback linha única + warning; ajuste de delta no modelo efetivo | 🟢 |
| `isValidReportedCost` | `cost.ts` | Custo ≥0 finito; se tokens>0 exige cost>0 | 🟢 |
| Summary worker | `usage-events` | DB arquivo → Worker readonly; in-memory → yield entre queries | 🟢 |
| `recalculateNullCosts` | `usage-events` | Só linhas table com cost null | 🟢 |
| Usage limits isolation | `usage-limits.ts` | Timeout 10s; % usado; nunca rotaciona refresh token | 🟢 |

### Regras de negócio (amostra)

| Regra | Confiança |
|-------|-----------|
| Cache (read+creation) ≤ inputTokens | 🟢 |
| totalTokens = input + output | 🟢 |
| reasoningTokens ≤ outputTokens (parcela já em output) | 🟢 |
| Custo SDK só confiável para família Claude; outros providers usam tabela | 🟢 |
| `pricingComplete` / `eventsWithoutPricing` quando cost_usd null | 🟢 |
| `costApproximate` propagado da tabela quando fonte=table | 🟢 |
| Grok fora de `/usage-limits` (sem endpoint conhecido) | 🟢 |
| `repo_graph_calls` só no evento agent do turno | 🟢 |

### Dados / estruturas

| Entidade | Campos relevantes | Confiança |
|----------|-------------------|-----------|
| `UsageTotals` | tokens*, costUsd, eventsWithoutPricing, pricingComplete, hasApproximatePricing | 🟢 |
| `UsageEventRow` | source agent\|subagent, provider, model, billingMode, tokens*, cost*, repoGraphCalls? | 🟢 |
| `ModelPricing` | input/output/cacheRead/cacheWrite per MTok, approximate, source | 🟢 |
| `BillingMode` | subscription \| api-key \| token-plan | 🟢 |
| `UsageCostSource` | sdk \| table | 🟢 |
| Tabelas | `usage_events`, `model_pricing` (seed migration 022) | 🟢 |

### Dependências

→ `shared`, `runner`/`providers` (emissão de usage), vault/credenciais (usage-limits); consumido por UI Consumo e sidebar Limites

---

## Módulo: `terminal`

**Path:** `packages/server/src/terminal` (+ rota HTTP + hub WS `pty.*` + UI xterm)  
**Propósito:** Duas superfícies de shell: (1) execução one-shot `POST /projects/:id/terminal` com stream WS `terminal.*`; (2) PTY interativo real (`node-pty`) via mensagens `pty.*` no WebSocket, renderizado com xterm.js.  
**Complexidade:** medium  
**Confiança:** 🟢 CONFIRMADO

### Arquivos primários

| Arquivo | Papel |
|---------|-------|
| `terminal/exec.ts` | Spawn one-shot com shell, timeout 5min, emit stdout/stderr/exit |
| `terminal/pty.ts` | Lazy-load `node-pty`; shell de login; handle write/resize/kill |
| `routes/terminal-exec.ts` | POST comando confinado ao cwd do projeto |
| `ws/server.ts` `handlePtyMessage` | Roteia pty.open/input/resize/close; cwd do projectId |
| `renderer/api/pty.ts` | Cliente WS dedicado + buffer pré-open |
| `renderer/components/XtermView.tsx` | xterm.js + FitAddon |
| `shared` | `TerminalExecRequest/Response`, `terminal.output`/`terminal.exit` |

### Fluxo de controle (texto)

**One-shot:** UI/quick-action → POST `{command}` → `runTerminalCommand(cwd do projectScope)` → chunks `terminal.output` no canal projectId → `terminal.exit` + body agregado. Replay WS **exclui** `terminal.*` (live-only).

**PTY:** renderer abre WS (subprotocolo session) → `pty.open` (sessionId, projectId, cols/rows) → server resolve `projects.path` como cwd → spawn shell `-l` (POSIX) → `pty.data`/`pty.exit` só para aquele client. Cap 16 PTYs/cliente. Input/resize enfileirados até open.

### Algoritmos / lógica não-trivial

| Nome | Local | Descrição | Confiança |
|------|-------|-----------|-----------|
| `runTerminalCommand` | `exec.ts` | spawn+shell; SIGKILL no timeout; exitCode -1 se sinal | 🟢 |
| `spawnPty` lazy | `pty.ts` | `createRequire` + cache; não carrega nativo no import Node/testes | 🟢 |
| `clampDim` | `pty.ts` / WS | cols/rows em [1, 1000] | 🟢 |
| Cwd server-side | `handlePtyMessage` | Nunca aceita cwd do cliente; usa `project.path` | 🟢 |
| Pending I/O buffer | `pty.ts` (renderer) | write/resize antes do open drenados após `pty.open` | 🟢 |

### Regras de negócio (amostra)

| Regra | Confiança |
|-------|-----------|
| Confinamento ao cwd do projeto (projectScope / projectId) | 🟢 |
| ANSI preservado (sem strip) em one-shot e PTY | 🟢 |
| exitCode ≠ 0 não é erro HTTP; spawn impossível → TerminalExecError | 🟢 |
| node-pty precisa rebuild Electron (ABI nativo) | 🟢 |
| Shell login POSIX (`-l`); Windows = powershell / spawn default | 🟢 |
| `terminal.*` e `codegraph.status` fora do replay WS | 🟢 |

### Dados / estruturas

| Entidade | Campos relevantes | Confiança |
|----------|-------------------|-----------|
| `TerminalExecRequest` | command | 🟢 |
| `TerminalExecResponse` | stdout, stderr, exitCode, execId | 🟢 |
| `TerminalOutputEvent` | projectId, execId, stream stdout\|stderr, chunk | 🟢 |
| `TerminalExitEvent` | projectId, execId, exitCode, signal? | 🟢 |
| `PtyHandle` | write, resize, kill/close | 🟢 |
| Controles WS | pty.open/input/resize/close ↔ pty.data/exit | 🟢 |

### Dependências

→ `shared`, `server-core` (WS/rotas/projectScope), `node-pty` (nativo); consumido por renderer (XtermView, quick-actions)

---

## Módulo: `renderer`

**Path:** `packages/renderer` (`@lioncode/renderer`)  
**Propósito:** UI React/Vite/Tailwind da IDE desktop: gate de cofre, workspace de três painéis (chat/streaming/diff/terminal), telas de catálogo (subagents/skills/mcps/rules), consumo/métricas e configuração. Fala só com o server local (HTTP+WS) e com o bridge Electron (`window.lioncode`).  
**Complexidade:** high  
**Confiança:** 🟢 CONFIRMADO

### Arquivos primários

| Arquivo | Papel |
|---------|-------|
| `main.tsx` / `App.tsx` | Bootstrap; lazy AppShell após unlock; token via IPC |
| `router/routes.ts` + `useHashRoute.ts` | Hash routes + guarda de cofre |
| `api/client.ts` / `http.ts` / `ws.ts` / `pty.ts` | Client tipado, session header, WS+dedupe, PTY |
| `screens/PrincipalScreen.tsx` + `usePrincipalWorkspace.ts` | Workspace 3 painéis + estado elevado |
| `hooks/useThreadConversation.ts` | Histórico + reducer de stream por `seq` |
| `hooks/useMessageQueue.tsx` | Fila persistente de follow-ups (localStorage) |
| `components/TaskComposer.tsx` | Composer (modelo, mentions, imagens, voz) |
| `components/ThreadDetail.tsx` / `ChatHistory` | Timeline + abas Histórico/Prompt/Diff |
| `components/TerminalDock.tsx` + `XtermView` | PTY interativo |
| `components/CommandPalette/*` | Palette acionado via WorkspaceContext |
| Domínios UI | `codegraph/`, `pipeline/`, `build/`, `memory/`, `mcps/`, `skills/`, `rules/`, `subagents/` |

### Fluxo de controle (texto)

1. Boot: tema em `useTheme` (antes do render) → LoginScreen (unlock vault) → IPC `getSessionToken` → `X-sistema-legado-Session` → lazy AppShell.
2. Hash: rotas protegidas com cofre travado → `#login` (memoriza intended); unlock → resume.
3. Principal: seleciona projeto → lista threads; abre thread → `useThreadConversation` (history + `subscribeThread`); composer → dispatch/follow-up; WS eventos → reducer; meta (state/diff) sobe para pills/sidebar.
4. Reconexão WS: backoff + re-hidrata history; dedupe `message.delta` por high-water `seq`; tool calls idempotentes no reducer.
5. Vault lock IPC → descarta token, `unlocked=false`, volta ao login.
6. Telas lazy (consumo, registros, catálogos, config) montadas pelo AppShell conforme hash.

### Algoritmos / lógica não-trivial

| Nome | Local | Descrição | Confiança |
|------|-------|-----------|-----------|
| Seq dedupe WS | `api/ws.ts` | Só gateia `message.delta` com `seq < lastSeq` | 🟢 |
| Conversation reducer | `useThreadConversation` | mergeHistory + applyEvent; subagents aninhados por parentToolCallId | 🟢 |
| Message queue | `useMessageQueue` | Persistência local; poll; lease atômico via sendMessage no server | 🟢 |
| Context window derive | `lib/contextWindow.ts` | % used/remaining a partir do último usage event | 🟢 |
| Codegraph offer gate | `codegraph.logic` + store | Oferta só absent+indexável+não suppressed | 🟢 |
| Hash vault guard | `useHashRoute` | Redirect + intendedRef + resumeAfterUnlock | 🟢 |

### Regras de negócio (amostra)

| Regra | Confiança |
|-------|-----------|
| Token de sessão só em header HTTP / subprotocolo WS — nunca query string | 🟢 |
| Rotas protegidas inacessíveis com cofre travado | 🟢 |
| Badge sintético pipeline/build usa campo `synthetic`, não matching de prefixo | 🟢 |
| Tool call status explícito (`running`/`done`/`interrompido`), não inferido de result null | 🟢 |
| Fila de follow-up: falha retém item; sem retry otimista após reload | 🟢 |
| Defaults API `localhost:4477` (CSP); override `VITE_LIONCODE_*` | 🟢 |
| `terminalRunning` no WorkspaceContext sempre false (dívida pós-PTY) | 🟢 |

### Dados / estruturas (UI)

| Entidade | Campos relevantes | Confiança |
|----------|-------------------|-----------|
| `RouteId` | login, principal, consumo, registros, subagents, skills, mcps, rules, configuracao | 🟢 |
| `ConversationMessage` | id, role, content, seq, streaming, images?, synthetic? | 🟢 |
| `ConversationToolCall` | id, toolName, params, result, status, seq | 🟢 |
| `ConversationSubagent` | id (=childThreadId), parentToolCallId, nested timeline | 🟢 |
| `QueuedMessage` | threadId, prompt, imageIds, status pending\|sending\|paused\|failed | 🟢 |
| `PrincipalNavigationState` | selectedProject/Thread, expandedProjectIds | 🟢 |
| `ContextWindowSnapshot` | used/max tokens, percentages, compacted | 🟢 |
| `WorkspaceContextValue` | projects/threads + ações nomeadas p/ palette | 🟢 |

### Dependências

→ `shared`, server local (HTTP/WS), shell bridge (`window.lioncode`); xterm, shiki, react-markdown, Tailwind

---

## Módulo: `mcp-servers`

**Path:** `mcp-servers/*` (workspace pnpm)  
**Propósito:** Pacotes MCP stdio first-party do catálogo do sistema legado: bridge interna (`lioncode` / secret-wrapper) e integrações externas (Slack, Linear, n8n, Cartesia, ElevenLabs). Cada pacote é processo separado spawnado pelo runner/provider; lógica pura em `protocol.ts` (testável sem stdio/rede).  
**Complexidade:** medium  
**Confiança:** 🟢 CONFIRMADO

### Pacotes

| Pacote | Nome npm | Papel |
|--------|----------|-------|
| `lioncode-secret-wrapper` | `@lioncode/mcp-secret-wrapper` | Pass-through: lê/apaga token file → GET loopback mcp-spec → spawna server real |
| `lioncode-subagents` | `@lioncode/mcp-subagents-bridge` | Bridge `lioncode`: `call_subagent`, `save_memory`, `repo_graph_*` via HTTP loopback |
| `slack` | MCP `slack` | Canais / mensagens / post (Slack Web API) |
| `linear` | MCP `linear` | Issues/projects (GraphQL Linear) |
| `n8n` | MCP `n8n` | Workflows/execuções/webhook (REST v1) |
| `cartesia` | MCP `cartesia` | TTS → `.lioncode/audio/<uuid>.mp3` |
| `elevenlabs` | MCP `elevenlabs` | TTS (mesmo contrato de áudio) |

### Arquivos primários

| Arquivo | Papel |
|---------|-------|
| `*/src/index.ts` | Entrypoint MCP (McpServer + StdioServerTransport) ou spawn wrapper |
| `*/src/protocol.ts` | Config ENV, HTTP/GraphQL, formatação enxuta, helpers testáveis |
| `*/test/protocol.test.ts` | Testes `node:test` da lógica pura |

### Fluxo de controle (texto)

1. **Secret wrapper:** `parseArgs` (3 posicionais; `specUrl` só `127.0.0.1`) → `readAndBurnToken` → `fetchSpec` Bearer → `spawn(command,args)` com env limpo (sem `LIONCODE_MCP_*` / `LIONCODE_SECRET_*`) + `stdio: inherit` → encaminha SIGTERM/SIGINT.
2. **Bridge subagents:** `resolveBridgeConfig` (exige URL+token e ≥1 capability) → registra tools condicionais → proxy `POST /delegate|/save-memory|/repo-graph` → resultado texto / `isError` (nunca derruba o server).
3. **Catálogo externo:** resolve ENV (boot fail se segredo ausente) → tools Zod → API remota com `fetch` injetável → JSON enxuto ou `isError`; stdout = JSON-RPC, logs só stderr.
4. **TTS (Cartesia/ElevenLabs):** resolve voz (arg > ENV) → `performTts` → grava mp3 em `.lioncode/audio/` → `ensureGitExcluded` (`/.lioncode/`) → payload `{ audioRelPath, mimeType, text, durationSec }`.

### Algoritmos / lógica não-trivial

| Nome | Local | Descrição | Confiança |
|------|-------|-----------|-----------|
| Token-burn + mcp-spec | `secret-wrapper/protocol.ts` | Arquivo owner-only apagado na hora; spec só via loopback autenticado | 🟢 |
| Env scrub do filho | `buildChildEnv` | Remove canal de entrega antes do spawn do server 3rd-party | 🟢 |
| Capabilities por ENV | `resolveBridgeConfig` | Subagents / memory / repoGraph independentes; sem fantasma de tool | 🟢 |
| Proxy delegate/cancel | `proxyDelegate` | Endpoint efêmero ligado ao AbortController do turno pai | 🟢 |
| get_issue fallback | `linear/protocol.ts` | `issue(id:)` → se falhar, `issueSearch` | 🟢 |
| stateName→stateId | `updateIssue` | Resolve nos states do team da issue (case-insensitive) | 🟢 |
| Contrato de áudio | cartesia/elevenlabs | Rel-path sob `.lioncode/`; duração estimada CBR; git exclude idempotente | 🟢 |
| Dados enxutos | slack/linear/n8n | `clampLimit` ≤50; `truncateText`; erros sem ecoar segredo | 🟢 |

### Regras de negócio (amostra)

| Regra | Confiança |
|-------|-----------|
| Segredos só via `process.env` no spawn (vault → runner); nunca em argv/log/result | 🟢 |
| `specUrl` do wrapper restrito a `http(s)://127.0.0.1` | 🟢 |
| Bridge exige ≥1 de SUBAGENTS / MEMORY=1 / REPO_GRAPH=1 | 🟢 |
| Erros de tool → `isError` + texto; não derrubam o processo MCP | 🟢 |
| TTS sem voiceId (arg nem ENV) → `isError`, não boot fail | 🟢 |
| Linear auth: header `Authorization: <key>` sem Bearer | 🟢 |
| n8n: `N8N_BASE_URL` + `N8N_API_KEY`; base normalizada sem barra final | 🟢 |
| Listas/textos truncados (MAX 50 itens / ~4k chars) | 🟢 |

### Dados / estruturas

| Entidade | Campos relevantes | Confiança |
|----------|-------------------|-----------|
| `WrapperArgs` / `ServerSpec` | serverName, tokenFilePath, specUrl / command, args, env | 🟢 |
| `BridgeConfig` | delegateUrl, delegateToken, subagents?, memory, repoGraph | 🟢 |
| `BridgeSubagent` | name, description | 🟢 |
| `AudioResultPayload` | audioRelPath, mimeType, text, durationSec? | 🟢 |
| `SlackChannelSummary` / `SlackMessageSummary` | id, name… / ts, user, text | 🟢 |
| `LinearIssueSummary` / `LinearIssueDetail` | identifier, title, state… + description, comments | 🟢 |
| `N8nWorkflowSummary` / execution summaries | id, name, active… | 🟢 |

### Dependências

→ `@modelcontextprotocol/sdk` + `zod` (servers MCP); APIs Slack/Linear/n8n/Cartesia/ElevenLabs; loopback do runner (`mcp`/`runner` modules). Workspace: `mcp-servers/*` no `pnpm-workspace.yaml`.

---

## Progresso dos módulos

| # | Módulo | Status |
|---|--------|--------|
| 1–13 | shell … renderer | ✅ |
| 14 | mcp-servers | ✅ |

**Fase Escavação concluída.** Todos os 14 módulos do plano foram analisados.
