# F11 Smoke Results

**Feature:** F11 Consumo
**Data:** 2026-08-05 (~19:16–19:18 BRT)
**Ambiente:** `pnpm dev` (Electron real) com `ENGRENACODE_USER_DATA=%TEMP%\engrena-smoke-onda-final` + Playwright em `http://localhost:5173`
**Dados:** `usage_events` reais gerados pelos 3 turnos da smoke F03 (1 erro de ambiente, 1 erro de permissão, 1 sucesso) + 1 `usage_event` semeado (`cost_source='table'`, sem preço) para exercitar a seção Preços sem gastar turno real extra

## UI `#consumo` — Playwright

| # | Passo | Esperado | Resultado |
|---|-------|----------|-----------|
| U1 | Mount pós-turno real | 6 cards resumo populados | pass — `$0.1727` assinatura, `14/964` tokens, `93.6%` cache read |
| U2 | Seletor de período | `30 dias` default, pressed | pass |
| U3 | Drill-down projeto → thread | tabela Threads mostra 3 threads reais do projeto scratch | pass |
| U4 | Drill-down thread → evento | 1 evento com `billing=subscription`, `fonte custo=sdk`, `$0.0536` | pass |
| U5 | Flag `⚠ parcial` | aparece no agregado do projeto quando há evento sem custo | pass (após seed do evento sem preço) |
| U6 | Seção Preços — banner "Modelos observados sem preço" | lista modelo `minimax / smoke-unpriced-model` | pass |
| U7 | Cadastrar preço rápido (`+ modelo`) | form Entrada/Saída/Cache/Fonte/Aproximado | pass |
| U8 | Salvar preço | card "API key (equivalente)" recalcula: `$0.0045` (= 1000×$1.5/1M + 500×$6/1M) | pass — cálculo conferido manualmente |
| U9 | Evento `sdk` intocado após salvar preço | `$0.1727` (assinatura) inalterado | pass — `recalculateNullCosts` só preencheu nulls de `table` |
| U10 | Light + dark | tokens Design Lock, sem hex solto | pass — `f11-consumo-light.png` / `f11-consumo-dark.png` |
| U11 | Copy vs `copy.md` | título, subtítulo, labels de card, seção Preços | pass — strings literais batem (`consumo.title`, `consumo.subtitle`, `consumo.card.*`, `consumo.section.pricing.hint`) |

## Referência visual

`docs/F11-consumo/ui/consumo-referencia.png` criado nesta rodada (era `TODO` em `ui.md`) — screenshot dark, período 30 dias, projeto com dados reais, seção Preços com card recém-cadastrado.

## Não coberto nesta rodada

- Empty state / erro de load: lógica já coberta por unitário pré-existente (`consumo-handler.test.ts`), não reexercitada visualmente nesta rodada (a tela já tinha dados reais desde o início do smoke).
- Share de subagents > 0: nenhum `call_subagent` real foi disparado nesta sessão (ver `docs/F03-workspace/smoke-results.md`), então a coluna "Share subagents" mostrou apenas `—` nos 3 threads.

## Critérios PRD §9

| Critério | Status |
|----------|--------|
| Todo turno válido agent/subagent gera `usage_event` ligado a project/thread/turnId | **pass** (real) |
| Drill-down projeto → thread → evento; share subagents > 0 após delegação | **parcial** — drill-down pass; share subagents não exercitado (sem `call_subagent` real) |
| Claude com custo SDK grava `cost_source=sdk`; demais usam `table` ou null | **pass** (real + seed) |
| Editar preço preenche só nulls de table; eventos sdk e já precificados intactos | **pass** (real) |
| Flags parcial/aproximado visíveis; empty e erro de load cobertos | **parcial** — flag parcial pass; empty/erro não reexercitados nesta rodada |
