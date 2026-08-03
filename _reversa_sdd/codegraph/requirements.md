# codegraph

> Spec de requisitos do módulo CodeGraph (`packages/server/src/codegraph`).  
> Nível: essencial · Confiança: afirmações marcadas 🟢/🟡/🔴

## Visão Geral

Graph de símbolos por projeto via CLI externa `codegraph`. Writer exclusivo server-side (build/reindex/update/repair), detecção de staleness, auto-sync fire-and-forget e tools read-only `repo_graph_*` injetadas no dispatch. O agente nunca spawna a CLI. 🟢

## Responsabilidades

- Engine: jobs, status efetivo, autoSync, injecção, cancel 🟢
- Detect: verdade no disco = `.codegraph/codegraph.db` + lock/PID 🟢
- CLI resolver: versão pinada, probe capabilities, auto-install 🟢
- Queries: backend `repo_graph_*` fail-closed 🟢
- Staleness: HEAD≠indexed, dirty mtime, pendingChanges 🟢
- UI gate: oferta absent+indexável+não suppressed 🟢

## Regras de Negócio

- Verdade de "inicializado" = existência de `codegraph.db`, não do diretório 🟢
- Graph jamais se remove; db corrompido converge para `repair` 🟢
- Tools falham como `{ok:false,error}` — nunca crash do turno 🟢
- Auto-sync nunca lança; skip silencioso se busy/ausente/throttle 🟢
- Oferta suprimida nunca bloqueia injeção 🟢
- Agente só consulta via tools server-side; nunca CLI directa 🟢

## Requisitos Funcionais

| ID | Requisito | Prioridade | Critério de Aceite |
|----|-----------|------------|-------------------|
| RF-01 | GET status retorna cli*, status, stats, run | Must | Matriz effective status |
| RF-02 | POST build/reindex/update/repair iniciam job | Must | Run persistido em codegraph_runs |
| RF-03 | POST cancel mata job fora do slot exclusão | Must | Process group killed |
| RF-04 | getInjectionState gateia tools repo_graph_* | Must | injectable só ready/stale+stats |
| RF-05 | runTool executa queries fail-closed | Must | argv safety (-- posicional) |
| RF-06 | Auto-sync em abertura thread, dispatch, pós-commit | Should | throttle 30s em GET stale |

## Requisitos Não Funcionais

| Tipo | Requisito | Evidência | Confiança |
|------|-----------|-----------|-----------|
| Disponibilidade | Tools nunca crasham turno | queries.ts | 🟢 |
| Performance | Staleness throttle 5min + epochs | staleness.ts | 🟢 |
| Segurança | Argv rejeita `-` inicial | buildCommand | 🟢 |

## Critérios de Aceitação

```gherkin
Dado projeto absent com arquivos indexáveis e CLI ok
Quando UI oferece build e usuário consente
Então POST build cria run e status passa a building

Dado graph ready com fileCount>0
Quando dispatch chama getInjectionState
Então injectable=true e tools repo_graph_* disponíveis

Dado tool repo_graph_search com args inválidos
Quando runTool executa
Então retorna {ok:false,error} sem abortar turno

Dado db corrompido em reindex
Quando job falha com erro SQLite
Então repair é encadeado após liberar slot
```

## Prioridade (MoSCoW)

| Requisito | MoSCoW | Justificativa |
|-----------|--------|---------------|
| RF-01–RF-05 | Must | Graph é contexto estrutural do agente |
| RF-06 | Should | Freshness sem bloquear UX |

## Rastreabilidade de Código

| Arquivo | Função / Classe | Cobertura |
|---------|-----------------|-----------|
| `packages/server/src/codegraph/engine.ts` | jobs, status, autoSync | 🟢 |
| `packages/server/src/codegraph/queries.ts` | repo_graph_* tools | 🟢 |
| `packages/server/src/codegraph/detect.ts` | disk state | 🟢 |
| `packages/server/src/codegraph/staleness.ts` | stale detector | 🟢 |
| `shared/src/codegraph.ts` | contratos | 🟢 |
