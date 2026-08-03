# metrics, Tarefas de Implementação

> Sequência para reimplementar o módulo Metrics a partir do legado.

## Pré-requisitos

- [ ] Migrations `usage_events` / `model_pricing` (022)
- [ ] dispatch persistUsage hook
- [ ] Contratos `shared/src/metrics.ts`

## Tarefas

- [ ] T-01, cost.ts: calculateTableCost, normalizeUsageCosts, isValidReportedCost
  - Origem no legado: `packages/server/src/metrics/cost.ts`
  - Critério de pronto: tokens validation; SDK vs table
  - Confiança: 🟢

- [ ] T-02, usage-events repo: insert + agregações SQL
  - Origem no legado: `packages/server/src/db/repositories/usage-events.ts`
  - Critério de pronto: summary/projects queries correctas
  - Confiança: 🟢

- [ ] T-03, persistUsage no finally do dispatch
  - Origem no legado: `packages/server/src/runner/dispatch.ts`
  - Critério de pronto: skip se tokens incompletos; repo_graph_calls 1ª linha
  - Confiança: 🟢

- [ ] T-04, Rotas GET metrics summary/projects/thread + period parse
  - Origem no legado: `packages/server/src/routes/metrics-*.ts`, `metrics-period.ts`
  - Critério de pronto: limit≤500; from/to ISO
  - Confiança: 🟢

- [ ] T-05, pricing CRUD + recalculateNullCosts
  - Origem no legado: `packages/server/src/db/repositories/pricing.ts`, `routes/pricing-*.ts`
  - Critério de pronto: update recalca table nulls
  - Confiança: 🟢

- [ ] T-06, usage-summary-worker para DB arquivo
  - Origem no legado: `packages/server/src/db/repositories/usage-summary-worker.ts`
  - Critério de pronto: readonly worker; yield em :memory:
  - Confiança: 🟢

- [ ] T-07, GET /usage-limits isolado por provider
  - Origem no legado: `packages/server/src/routes/usage-limits.ts`
  - Critério de pronto: timeout 10s; unavailable per provider
  - Confiança: 🟢

## Tarefas de Teste

- [ ] TT-01, Turno com tokens → row usage_events
- [ ] TT-02, Pricing update → null costs recalculated
- [ ] TT-03, Summary período vazio → zeros
- [ ] TT-04, Usage-limits provider down → unavailable not 500

## Ordem Sugerida

1. T-01 → T-02 (cost + repo)
2. T-03 (dispatch write)
3. T-04 → T-06 (read path)
4. T-05, T-07 (admin + limits)

## Lacunas Pendentes (🔴)

- Seed pricing completo por modelo/provider
