# metrics

> Spec de requisitos do módulo Metrics (`packages/server/src/metrics`).  
> Nível: essencial · Confiança: afirmações marcadas 🟢/🟡/🔴

## Visão Geral

Contabilidade de tokens e custo por turno (agent/subagent), tabela de preços por modelo (`model_pricing`), agregações de consumo (summary/projetos/threads) e limites de assinatura das CLIs conectadas. Escrita no fim do turno via `persistUsage`. 🟢

## Responsabilidades

- Normalizar `RawTokenUsage` do driver → custos USD 🟢
- Persistir `usage_events` (1 linha agregada ou N por modelo) 🟢
- CRUD `model_pricing` + recalc custos null 🟢
- GET summary/projects/thread detail com paginação 🟢
- GET `/usage-limits` por provider (timeout 10s, fail soft) 🟢
- Worker readonly para summary em DB em arquivo 🟢

## Regras de Negócio

- persistUsage só se input+output presentes 🟢
- Custo SDK só confiável família Claude; demais → tabela 🟢
- cache (read+creation) ≤ inputTokens 🟢
- totalTokens = input + output 🟢
- reasoningTokens ≤ outputTokens 🟢
- `repo_graph_calls` só na 1ª linha agent do turno 🟢
- Grok fora de `/usage-limits` (sem endpoint) 🟢
- pricingComplete/eventsWithoutPricing quando cost_usd null 🟢

## Requisitos Funcionais

| ID | Requisito | Prioridade | Critério de Aceite |
|----|-----------|------------|-------------------|
| RF-01 | persistUsage grava usage_events no fim do turno | Must | 1+ rows por turno válido |
| RF-02 | normalizeUsageCosts: SDK vs table | Must | Claude prefere SDK; outros table |
| RF-03 | GET /metrics/summary agrega período | Must | UsageTotals coerente |
| RF-04 | GET /metrics/projects e drill-down thread | Must | paginação limit≤500 |
| RF-05 | CRUD pricing create/update recalc null costs | Must | só cost_source=table |
| RF-06 | GET /usage-limits consulta providers isolados | Should | falha → unavailable, não 500 |

## Requisitos Não Funcionais

| Tipo | Requisito | Evidência | Confiança |
|------|-----------|-----------|-----------|
| Performance | Summary worker em DB arquivo | usage-summary-worker.ts | 🟢 |
| Disponibilidade | Usage limits timeout 10s | usage-limits.ts | 🟢 |
| Precisão | calculateTableCost per MTok | cost.ts | 🟢 |

## Critérios de Aceitação

```gherkin
Dado turno Claude com RawTokenUsage completo
Quando persistUsage executa
Então usage_events contém tokens, cost_usd e cost_source sdk ou table

Dado model_pricing actualizado para modelo X
Quando recalculateNullCosts corre
Então linhas table com cost null recebem custo calculado

Dado GET /metrics/summary?from=&to=
Quando período válido
Então retorna tokens totais, costUsd, pricingComplete

Dado provider Codex indisponível em usage-limits
Quando GET /usage-limits
Então entry unavailable sem HTTP 500 global
```

## Prioridade (MoSCoW)

| Requisito | MoSCoW | Justificativa |
|-----------|--------|---------------|
| RF-01–RF-05 | Must | Consumo é feature visível |
| RF-06 | Should | Sidebar limites |

## Rastreabilidade de Código

| Arquivo | Função / Classe | Cobertura |
|---------|-----------------|-----------|
| `packages/server/src/metrics/cost.ts` | calculateTableCost, normalize | 🟢 |
| `packages/server/src/db/repositories/usage-events.ts` | persist, aggregate | 🟢 |
| `packages/server/src/db/repositories/pricing.ts` | model_pricing CRUD | 🟢 |
| `packages/server/src/routes/metrics-*.ts` | summary/projects | 🟢 |
| `packages/server/src/routes/usage-limits.ts` | quotas CLI | 🟢 |
| `packages/server/src/runner/dispatch.ts` | persistUsage | 🟢 |
| `shared/src/metrics.ts` | DTOs | 🟢 |
