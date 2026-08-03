# runner, Design Técnico

> Como o módulo de execução (`packages/server/src/runner`) é construído, com base no legado.

## Interface

### Entrada principal (`DispatchRequest`)

| Campo | Tipo | Papel | Confiança |
|-------|------|-------|-----------|
| `thread` | Thread | Alvo do turno | 🟢 |
| `driver` | ProviderDriver | Runtime de IA | 🟢 |
| `prompt` | string | Entrada do usuário/comando | 🟢 |
| `repoPath` | string | cwd efetivo (main ou worktree) | 🟢 |
| `command?` | Command | Strategy workflow/pipeline/build | 🟢 |
| `lease?` | ProjectExecutionLease | Token de execução longa | 🟢 |

### `DispatchContext` (injeção)

| Campo | Papel | Confiança |
|-------|-------|-----------|
| `repositories` | DB access | 🟢 |
| `ws` | Fan-out WebSocket | 🟢 |
| `seqAllocator` | Fonte única de seq | 🟢 |
| `permissionBroker` / `questionBroker` | Aprovações bloqueantes | 🟢 |
| `turns` | TurnRegistry | 🟢 |
| `registries` | skills/subagents/MCPs live | 🟢 |
| `drivers` | mapa provider→driver | 🟢 |

### Motores especializados

| Motor | Arquivo | Acionado por | Confiança |
|-------|---------|--------------|-----------|
| Workflow | `workflow-motor.ts` | command strategy `workflow` | 🟢 |
| Feature Pipeline | `feature-pipeline-motor.ts` | `/featdevelop` | 🟢 |
| Feature Build | `feature-build-motor.ts` | `/featbuild` | 🟢 |

## Fluxo Principal

1. Rota monta `DispatchContext` → `scheduleDispatch` adquire lease de projeto 🟢
2. `runDispatch`: registra turno (`TurnRegistry` + AbortController) 🟢
3. Resolve cwd: `main` = repo vivo; `worktree` = branch `lioncode/<thread>` 🟢
4. Snapshot catálogos; compõe rules/memory/codegraph; prepara MCPs (secrets vault) 🟢
5. Se comando: despacha motor adequado (workflow / pipeline / build) 🟢
6. `driver.dispatch` → loop allocate-then-emit (`seq` em text blocks e `tool_call.start`) 🟢
7. Delegação: rendezvous → `runDelegatedSubagent` (depth=1, RW-lock, watchdog) 🟢
8. Flush, diffs/`diff.ready`, thread → `idle`/`error`; finally limpa MCP/brokers/lease 🟢

## Fluxos Alternativos

- **Cancel:** abort controller → `driver.cancel` pai + cancel direto filhos 🟢
- **Delegação read vs write:** `acquireRead` compartilhado; `acquireWrite` exclusivo; live-write skip (M8) 🟢
- **Rendezvous timeout:** chave canônica `{subagent,task,context}`; timeout 5s 🟢
- **Integrate child:** merge-tree, stale-base, conflict retention (`integrate.ts`) 🟢
- **Erro operacional:** thread → `error`; lease liberada no finally 🟢

## Dependências

- `providers` — drivers de IA 🟢
- `git` — worktree, diffs, apply 🟢
- `vault` — secrets MCP/provider 🟢
- `memory`, `codegraph` — blocos de contexto 🟢
- `shared` — tipos Thread, Command, FeaturePipeline/Build 🟢
- DB repositories — messages, tool_calls, diffs, pipelines/builds 🟢

## Decisões de Design Identificadas

| Decisão | Evidência no código | Confiança |
|---------|---------------------|-----------|
| allocate-then-emit (seq antes de WS) | `seq-allocator.ts` + `dispatch.ts` | 🟢 |
| Profundidade delegação = 1 | `delegate.ts` | 🟢 |
| Filho efêmero sem row em threads | `subagent.ts` / delegate | 🟢 |
| Memória só no pai | comentários dispatch | 🟢 |
| Motores substituem loop genérico do driver | `*-motor.ts` | 🟢 |

## Estado Interno

| Estado | Onde | Evolução |
|--------|------|----------|
| TurnRegistry entries | in-memory | register → abort/complete |
| SeqAllocator counters | in-memory por threadId | lazy seed MAX(seq)+1 |
| Permission/Question pending | brokers in-memory | resolve ou deny no cancel |
| Delegation RW-lock | `delegation-lock.ts` | read/write por parentCwd |
| Rendezvous queues | `rendezvous.ts` | correlate call_subagent ↔ delegate |

## Observabilidade

- Eventos WS com seq para streaming UI 🟢
- `token.usage` sem seq (telemetria) 🟢
- Métricas de dispatch 🟡 (integração parcial)

## Riscos e Lacunas

- 🔴 Matriz fina PermissionBroker × provider × AccessLevel
- 🟡 Detalhe exacto de gates adversarial no pipeline reducer
- 🟡 Transições runtime `pr-merged` / `pr-closed` (fora do runner directo)
