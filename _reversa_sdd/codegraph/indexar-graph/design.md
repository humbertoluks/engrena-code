# indexar-graph, Design Técnico

> Jobs de indexação CodeGraph e persistência em codegraph_runs.

## Interface

### Kinds de run

| Kind | CLI invocado | Quando | Confiança |
|------|--------------|--------|-----------|
| build | init (+ index implícito) | primeiro setup | 🟢 |
| reindex | index --force | full rebuild | 🟢 |
| update | sync | incremental / auto-sync | 🟢 |
| repair | wipe + init | corrupção / recovery | 🟢 |

### Tabela codegraph_runs

| Campo | Tipo | Notas | Confiança |
|-------|------|-------|-----------|
| id | uuid | PK | 🟢 |
| projectId | string | FK projects | 🟢 |
| kind | CodegraphRunKind | build/reindex/update/repair | 🟢 |
| status | running/done/error/cancelled | 🟡 |
| output | text | stdout agregado | 🟢 |
| error | text | stderr/motivo | 🟢 |
| durationMs | number | pós-exit | 🟢 |
| statsJson | json | file/node/edge counts | 🟢 |

### Watchdogs

| Limite | Acção | Confiança |
|--------|-------|-----------|
| 10 min total | SIGTERM→SIGKILL | 🟢 |
| 90s idle output | kill job | 🟢 |
| stdin | FECHADO no spawn | 🟢 |

## Fluxo Principal (startJob)

1. Secção síncrona: resolve CLI, check slot, lock externo, lease delete/repair 🟢
2. gitignore append (build/repair) 🟢
3. createRun → row running 🟢
4. spawn detached: init / index --force / sync / wipe+init 🟢
5. pipe stdout/stderr; watchdogs activos 🟢
6. on exit: update run, stats parse, projects.* cache 🟢
7. corrupção reindex → queue repair 🟢

## Fluxos Alternativos

- **CLI ausente:** installer download pinado 1.4.1 + consent 🟢
- **Slot ocupado:** 409 ou skip silencioso (auto-sync) 🟢
- **Cancel:** fora slot; killJob process group 🟢
- **Init com db:** no-op responde estado actual (J4) 🟢

## Dependências

- CLI codegraph no PATH ou managed dir 🟢
- FS `.codegraph/codegraph.db` 🟢
- SQLite codegraph_runs 🟢

## Decisões de Design Identificadas

| Decisão | Evidência | Confiança |
|---------|-----------|-----------|
| Jobs detached (não block HTTP) | engine spawn | 🟢 |
| Repair encadeado pós corrupção | engine reindex handler | 🟢 |
| Build/reindex sem projectExecutions lease | code-analysis | 🟢 |

## Riscos e Lacunas

- 🟢 Schema status enum `codegraph_runs`: `running|done|error|cancelled` (migration `043_codegraph.ts`) [Revisão]
- 🟡 Output truncation limits no persist
- 🟡 Prune policy de runs antigos
