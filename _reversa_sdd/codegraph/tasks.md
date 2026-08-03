# codegraph, Tarefas de Implementação

> Sequência para reimplementar o módulo CodeGraph a partir do legado.

## Pré-requisitos

- [ ] Migration `codegraph_runs` (043) e campos em `projects`
- [ ] CLI codegraph instalável (installer pinado)
- [ ] Contratos `shared/src/codegraph.ts`

## Tarefas

- [ ] T-01, detect.ts: dbPresent, lockPid, lockStaleByAge
  - Origem no legado: `packages/server/src/codegraph/detect.ts`
  - Critério de pronto: lock >10min + PID reciclado ⇒ stale lock
  - Confiança: 🟢

- [ ] T-02, cli.ts: resolver, probe versão, cache positivo
  - Origem no legado: `packages/server/src/codegraph/cli.ts`
  - Critério de pronto: >=1.0.1 <2.0.0 aceite
  - Confiança: 🟢

- [ ] T-03, engine.ts: getStatus matriz, jobs, cancel, autoSync
  - Origem no legado: `packages/server/src/codegraph/engine.ts`
  - Critério de pronto: building/ready/stale/absent corretos
  - Confiança: 🟢

- [ ] T-04, queries.ts: repo_graph_* + argv safety
  - Origem no legado: `packages/server/src/codegraph/queries.ts`
  - Critério de pronto: {ok:false} em falha; nunca throw no turno
  - Confiança: 🟢

- [ ] T-05, staleness.ts: HEAD, porcelain, pendingChanges
  - Origem no legado: `packages/server/src/codegraph/staleness.ts`
  - Critério de pronto: throttle 5min; epochs race-safe
  - Confiança: 🟢

- [ ] T-06, Rotas HTTP status/build/reindex/update/repair/cancel
  - Origem no legado: `packages/server/src/routes/codegraph-*.ts`
  - Critério de pronto: POSTs criam runs; GET reflecte job activo
  - Confiança: 🟢

- [ ] T-07, Injeção dispatch: getInjectionState + runTool
  - Origem no legado: `engine.ts` + runner integration
  - Critério de pronto: tools só quando injectable
  - Confiança: 🟢

## Tarefas de Teste

- [ ] TT-01, Build feliz → ready + stats fileCount>0
- [ ] TT-02, Tool com arg inválido → ok:false
- [ ] TT-03, Cancel mata process group
- [ ] TT-04, Auto-sync skip quando building

## Ordem Sugerida

1. T-01 → T-02 (detect + CLI)
2. T-03 → T-06 (engine + rotas)
3. T-04 → T-05 (queries + staleness)
4. T-07 (dispatch)

## Lacunas Pendentes (🔴)

- Versão exacta pinada no installer runtime
