# Spec SDD: Dashboard

> Selo 🟡 PLANEJADO. Componente do EngrenaCode.

**Componente:** dashboard
**Feature:** F04
**Versão alvo:** MVP
**Data:** 2026-07-31T10:45:00Z

## 1. Problema
🟡 Sem visão agregada multi-projeto, threads running, diffs pendentes e erros ficam escondidos no scroll do terminal ou espalhados por repos.

## 2. Objetivos
🟡 Oferecer a primeira tela pós-unlock com saúde da config, inbox acionável e atalhos para workspace/catálogo, sem mutar estado de threads.

## 3. Não-objetivos
🟡 Disparar turnos, aceitar/rejeitar diffs, commit/push/PR, edição de catálogo inline, automação de refresh agressiva em background com app em outra tela.

## 4. Requisitos funcionais
- 🟡 **RF-01:** Pós-unlock a primeira tela é `#dashboard` (separada do workspace).
- 🟡 **RF-02:** Exibe saúde da configuração (Claude, CLIs, GitHub, prompt global) e CTA “Completar configuração” → `#configuracao`.
- 🟡 **RF-03:** Exibe 4 cards numéricos: projetos, running, diffs pendentes, erros.
- 🟡 **RF-04:** Inbox lista até 20 itens de atenção (running, diff pendente, erro, setup incompleto).
- 🟡 **RF-05:** Clique em item da inbox abre workspace no projeto/thread; diff pendente abre aba Diff; running abre Histórico.
- 🟡 **RF-06:** Contadores de skills/rules/subagents navegam para `#skills`, `#rules`, `#subagents`.
- 🟡 **RF-07:** Mostra grade de projetos e últimas 10 threads; refresh ao abrir + botão Atualizar; refresh opcional a cada 30s com tela visível.
- 🟡 **RF-08:** Dashboard não aceita diff, não dispara turno e não faz git mutável.

## 5. Comportamentos
🟡 Empty: “Adicione um projeto…”, “Nada pendente…”, banner de setup incompleto.
🟡 Dados vêm de F02 (saúde), F03 (projetos/threads/diffs), F05–F07 (contagens).

## 6. Casos de borda
- 🟡 Inbox vazia vs setup incompleto: empty states distintos.
- 🟡 Mais de 20 itens: só 20 visíveis (sem paginação MVP).
- 🟡 Thread apagada referenciada: item some no próximo refresh sem crash.
- 🟡 Cofre travado: dashboard inacessível.

## 7. Critérios de aceite
- 🟡 **Dado** unlock bem-sucedido, **Quando** a navegação inicial ocorre, **Então** `#dashboard` é a primeira tela.
- 🟡 **Dado** diff pendente, **Quando** o usuário clica no item, **Então** abre workspace na aba Diff.
- 🟡 **Dado** setup incompleto, **Quando** clica “Completar configuração”, **Então** vai a `#configuracao`.
- 🟡 **Dado** dashboard aberto, **Quando** tenta ação de diff/turno, **Então** não há controles que executem essas ações.

## 8. Questões em aberto
- 🟡 ⚠️ ABERTO: refresh 30s é default on ou opt-in na UI.

## 9. Relatório de avaliação
```
SCORE TOTAL: 85/100
```
Breakdown:
  Completude: 90/100 (peso 30%)
  Testabilidade: 85/100 (peso 25%)
  Clareza: 85/100 (peso 20%)
  Escopo: 85/100 (peso 15%)
  Edge Cases: 70/100 (peso 10%)
Gaps críticos:
  - Nenhum bloqueador
Sugestões:
  1. Definir default do auto-refresh 30s
```

---
Gerado por reversa-spec-sdd em 2026-07-31T10:45:00Z
Fonte: prd.md
