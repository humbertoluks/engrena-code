# metrics, Design Técnico

> Como o módulo Metrics é construído, com base no legado.

## Interface

### Rotas HTTP

| Método | Caminho | Saída | Confiança |
|--------|---------|-------|-----------|
| GET | `/metrics/summary` | UsageTotals + breakdown | 🟢 |
| GET | `/metrics/projects` | lista agregada por projeto | 🟢 |
| GET | `/metrics/projects/:id` | detalhe projeto | 🟢 |
| GET | `/metrics/threads/:id` | detalhe thread | 🟢 |
| GET/POST/PATCH | `/pricing/*` | ModelPricing CRUD | 🟢 |
| GET | `/usage-limits` | quotas por provider | 🟢 |

### Entidades

| Entidade | Campos relevantes | Confiança |
|----------|-------------------|-----------|
| `usage_events` | source, provider, model, tokens*, cost*, repoGraphCalls? | 🟢 |
| `model_pricing` | input/output/cacheRead/cacheWrite per MTok, approximate | 🟢 |
| `UsageTotals` | tokens, costUsd, eventsWithoutPricing, pricingComplete | 🟢 |
| `BillingMode` | subscription \| api-key \| token-plan | 🟢 |
| `UsageCostSource` | sdk \| table | 🟢 |

### calculateTableCost

```
cost = (uncached * input + cacheRead * cacheReadRate + cacheWrite * cacheWriteRate + output * outputRate) / 1e6
```

🟢 (`metrics/cost.ts`)

## Fluxo Principal

1. Driver emite `RawTokenUsage` durante/após turno 🟢
2. `persistUsage` (dispatch finally): valida input+output 🟢
3. `normalizeUsageCosts`: SDK Claude ou table; perModel divergence → fallback 🟢
4. Insert usage_events; repo_graph_calls na 1ª linha agent 🟢
5. UI Consumo: GET summary (+ worker se DB arquivo) 🟢
6. Admin pricing: update → recalculateNullCosts 🟢

## Fluxos Alternativos

- **perModel vs agregado diverge:** linha única + warning 🟢
- **DB :memory::** summary inline sem worker 🟢
- **Usage limits:** cada provider isolado; timeout 10s 🟢

## Dependências

- `runner/dispatch` — ponto de escrita 🟢
- `providers` — emissão RawTokenUsage 🟢
- vault/credenciais — usage-limits 🟢
- migration 022 seed model_pricing 🟢

## Decisões de Design Identificadas

| Decisão | Evidência | Confiança |
|---------|-----------|-----------|
| SDK cost só Claude confiável | cost.ts | 🟢 |
| Worker readonly para summary | usage-summary-worker | 🟢 |
| costApproximate quando source=table | shared/metrics | 🟢 |

## Estado Interno

| Estado | Onde | Notas |
|--------|------|-------|
| usage_events rows | SQLite | append por turno |
| model_pricing | SQLite | admin CRUD |
| Summary worker | thread ephemeral | DB arquivo only |

## Riscos e Lacunas

- 🔴 Seed completo migration 022 por modelo
- 🟡 Formato exacto perModel do SDK Claude
- 🟡 Endpoints quota por provider (Codex/Claude/GLM/etc.)
