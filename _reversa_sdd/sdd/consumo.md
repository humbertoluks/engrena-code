# Spec SDD: Consumo

> Selo 🟡 PLANEJADO. Componente do EngrenaCode.

**Componente:** consumo
**Feature:** F11
**Versão alvo:** 1.1
**Data:** 2026-07-31T10:45:00Z

## 1. Problema
🟡 Tokens e custo estimados ficam invisíveis até a fatura do provider; o usuário não consegue ajustar provider/modelo com informação.

## 2. Objetivos
🟡 Mostrar tokens e custo estimado por período com drill-down, preços editáveis e congelamento de `cost_usd` no fim do turno.

## 3. Não-objetivos
🟡 Fatura real dos providers; budget/alertas/projeção; export CSV/PDF; UsageLimits como feature de produto; repricing de eventos já precificados.

## 4. Requisitos funcionais
- 🟡 **RF-01:** Tela `#consumo` com períodos 7 dias / 30 dias / Tudo.
- 🟡 **RF-02:** Totais: input, output, cache read/write, total tokens, custo USD (ou — se incompleto).
- 🟡 **RF-03:** Flags parcial (⚠) e aproximado (~); 3 cards por billing mode (assinatura estimada, API key, token plan).
- 🟡 **RF-04:** Drill-down projeto → thread (share subagents) → evento (paginação 100, limite máx. 500).
- 🟡 **RF-05:** Preços editáveis USD/MTok; cadastro de modelos observados sem preço.
- 🟡 **RF-06:** `recalculateNullCosts` só em `cost_source=table` AND `cost_usd IS NULL`.
- 🟡 **RF-07:** Congelamento no fim do turno: Claude com custo SDK → `cost_source=sdk`; demais → `table` ou null.
- 🟡 **RF-08:** Todo turno válido agent/subagent gera `usage_event` ligado a project/thread/turnId.
- 🟡 **RF-09:** Nunca inventar custo quando faltar preço; totais parciais honestos.

## 5. Comportamentos
🟡 Banner “Modelos observados sem preço” com cadastro rápido.
🟡 Empty states honestos; erro → “Não foi possível carregar os dados.” + retry.
🟡 Cofre travado bloqueia leitura.

## 6. Casos de borda
- 🟡 Eventos sem preço → totais parciais, nunca custo inventado.
- 🟡 Editar preço não reescreve eventos `sdk` nem já precificados.
- 🟡 Share subagents = 0 se não houve delegação.
- 🟡 Limite 500 eventos no drill-down de evento.

## 7. Critérios de aceite
- 🟡 **Dado** turnos válidos, **Quando** abre Consumo, **Então** vê totais do período escolhido.
- 🟡 **Dado** delegação de subagent, **Quando** abre a thread no drill-down, **Então** share de subagents &gt; 0.
- 🟡 **Dado** Claude com custo SDK, **Quando** o turno termina, **Então** `cost_source=sdk` e valor congelado.
- 🟡 **Dado** edição de preço, **Quando** recalcula, **Então** só preenche nulls de `table`.
- 🟡 **Dado** eventos sem preço, **Quando** agrega, **Então** mostra parcial/— sem inventar USD.

## 8. Questões em aberto
- 🟡 ⚠️ ABERTO: tabela inicial de preços default por modelo (valores seed).

## 9. Relatório de avaliação
```
SCORE TOTAL: 85/100
```
Breakdown:
  Completude: 90/100 (peso 30%)
  Testabilidade: 85/100 (peso 25%)
  Clareza: 80/100 (peso 20%)
  Escopo: 90/100 (peso 15%)
  Edge Cases: 80/100 (peso 10%)
Gaps críticos:
  - Seed de preços default
Sugestões:
  1. Anexar tabela seed no plano F11
```

---
Gerado por reversa-spec-sdd em 2026-07-31T10:45:00Z
Fonte: prd.md
