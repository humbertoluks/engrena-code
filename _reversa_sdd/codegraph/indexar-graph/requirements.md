# indexar-graph

> Spec de execuções de indexação CodeGraph (full/incremental).  
> Nível: essencial · Confiança: afirmações marcadas 🟢/🟡/🔴

## Visão Geral

Sub-unit CodeGraph: runs persistidos em `codegraph_runs`, jobs detached para build (init), reindex (full `--force`), update (sync incremental) e repair (wipe+init). Writer exclusivo com slot, lock externo, watchdogs e encadeamento repair em corrupção. 🟢

## Responsabilidades

- createRun por kind: build | reindex | update | repair 🟢
- Spawn detached CLI com stdin fechado 🟢
- Persist output, error, durationMs, statsJson 🟢
- Watchdog 10min total / 90s idle 🟢
- killJob: POSIX process group / Win taskkill 🟢
- Reindex corrompido → repair automático pós-slot 🟢

## Regras de Negócio

- Build/reindex NÃO adquirem lease projectExecutions (só repair) 🟢
- Cancel fica FORA do slot de exclusão mútua 🟢
- Init repetido com db presente = no-op (J4) 🟢
- gitignore append `.codegraph/` antes init (build/repair) 🟢
- Managed install exige consent via POST job 🟢
- Stdin do job FECHADO (CLI pendura com stdin aberto) 🟢

## Requisitos Funcionais

| ID | Requisito | Prioridade | Critério de Aceite |
|----|-----------|------------|-------------------|
| RF-01 | POST build spawna `init` quando absent | Must | run status running→done/error |
| RF-02 | POST reindex spawna `index --force` | Must | full reindex |
| RF-03 | POST update spawna `sync` incremental | Must | auto-sync usa mesmo path |
| RF-04 | POST repair wipe+init com lease se aplicável | Must | converge após corrupção |
| RF-05 | codegraph_runs persiste kind, status, stats | Must | histórico consultável |
| RF-06 | Watchdog mata job idle >90s ou total >10min | Should | run error com motivo |

## Requisitos Não Funcionais

| Tipo | Requisito | Evidência | Confiança |
|------|-----------|-----------|-----------|
| Disponibilidade | DELETE×job race protocol | startJob | 🟢 |
| Integridade | SHA256 no managed install | installer.ts | 🟢 |

## Critérios de Aceitação

```gherkin
Dado projeto absent e CLI disponível
Quando POST build
Então codegraph_runs row kind=build status=running e CLI init detached

Dado graph ready e HEAD avançou
Quando POST update (auto-sync)
Então kind=update executa sync sem bloquear UI

Dado reindex falha com erro SQLite corrupt
Quando slot é libertado
Então repair é encadeado automaticamente

Dado job running >90s sem output
Quando watchdog idle dispara
Então processo morto e run status=error
```

## Prioridade (MoSCoW)

| Requisito | MoSCoW | Justificativa |
|-----------|--------|---------------|
| RF-01–RF-05 | Must | Sem indexação não há graph |
| RF-06 | Should | Evita jobs zumbi |

## Rastreabilidade de Código

| Arquivo | Função / Classe | Cobertura |
|---------|-----------------|-----------|
| `packages/server/src/codegraph/engine.ts` | startJob, killJob | 🟢 |
| `packages/server/src/codegraph/installer.ts` | managed install | 🟢 |
| `packages/server/src/codegraph/gitignore.ts` | append .codegraph/ | 🟢 |
| `packages/server/src/codegraph/status-parse.ts` | parse status --json | 🟢 |
| `packages/server/src/db/migrations/*043*` | codegraph_runs | 🟢 |
