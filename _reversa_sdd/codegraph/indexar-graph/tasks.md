# indexar-graph, Tarefas de Implementação

> Jobs de indexação e codegraph_runs.

## Pré-requisitos

- [ ] Engine codegraph base (detect, cli, status)
- [ ] Migration codegraph_runs
- [ ] CLI codegraph instalável

## Tarefas

- [ ] T-01, createRun + persistência codegraph_runs
  - Origem no legado: `packages/server/src/codegraph/engine.ts`
  - Critério de pronto: row running→terminal com statsJson
  - Confiança: 🟢

- [ ] T-02, Spawn detached por kind (init/index/sync/repair)
  - Origem no legado: `packages/server/src/codegraph/engine.ts`
  - Critério de pronto: stdin closed; cwd = project.path
  - Confiança: 🟢

- [ ] T-03, Watchdogs 10min/90s + killJob cross-platform
  - Origem no legado: `packages/server/src/codegraph/engine.ts`
  - Critério de pronto: POSIX kill(-pid); Win taskkill /T
  - Confiança: 🟢

- [ ] T-04, gitignore append idempotente pre-init
  - Origem no legado: `packages/server/src/codegraph/gitignore.ts`
  - Critério de pronto: `.codegraph/` uma vez só
  - Confiança: 🟢

- [ ] T-05, status-parse de `status --json` pós-job
  - Origem no legado: `packages/server/src/codegraph/status-parse.ts`
  - Critério de pronto: stats_json em projects actualizado
  - Confiança: 🟢

- [ ] T-06, Encadeamento repair após corrupção reindex
  - Origem no legado: `packages/server/src/codegraph/engine.ts`
  - Critério de pronto: repair queued após slot free
  - Confiança: 🟢

- [ ] T-07, Managed installer SHA256 + prune
  - Origem no legado: `packages/server/src/codegraph/installer.ts`
  - Critério de pronto: download pinado verificado
  - Confiança: 🟢

## Tarefas de Teste

- [ ] TT-01, build absent → db created
- [ ] TT-02, update incremental após commit
- [ ] TT-03, cancel during run → status cancelled/error
- [ ] TT-04, corrupt reindex → repair scheduled

## Ordem Sugerida

1. T-01 → T-02 (run lifecycle)
2. T-03 (watchdog)
3. T-04 → T-05 (gitignore + parse)
4. T-06 → T-07 (recovery + install)

## Lacunas Pendentes (🔴)

- Enum exacto de status em codegraph_runs
