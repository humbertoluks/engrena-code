# Spec SDD: SubAgents

> Selo 🟡 PLANEJADO. Componente do EngrenaCode.

**Componente:** subagents
**Feature:** F07
**Versão alvo:** MVP
**Data:** 2026-07-31T10:45:00Z

## 1. Problema
🟡 Tarefas grandes estouram o contexto de um agente só; não há delegação controlada a especialistas com revisão unificada de diffs.

## 2. Objetivos
🟡 Cadastrar subagents invocáveis (`call_subagent`), vincular `kind=dev` a projetos, exibir runs na timeline e revisar diffs do filho na revisão do pai.

## 3. Não-objetivos
🟡 Subagents `kind=pipeline`; MCP no filho no MVP; row persistente em `threads` para o filho; write paralelo multi-estágio; workflows.

## 4. Requisitos funcionais
- 🟡 **RF-01:** CRUD com name, description, prompt (~1 MiB), provider `Claude|Codex|Kimi|inherit`, model, reasoningLevel, tools (`null`=tudo / lista / `[]`=restrito extremo), category, `idleTimeoutMinutes` default 20.
- 🟡 **RF-02:** Vínculo ao projeto apenas `kind=dev` no MVP; recomendação ≤ 10 vinculados.
- 🟡 **RF-03:** `call_subagent` cria run efêmero; resultado volta ao pai; sem row em `threads`.
- 🟡 **RF-04:** Diffs do filho entram na mesma revisão do pai.
- 🟡 **RF-05:** Codex como pai só delega com `full-access` explícito.
- 🟡 **RF-06:** Idle timeout encerra run com status visível na UI.
- 🟡 **RF-07:** Name duplicado → conflito; provider do filho indisponível → falha da delegação com mensagem no pai.
- 🟡 **RF-08:** Filho sem MCP no MVP.

## 5. Comportamentos
🟡 Tela `#subagents`; card “Subagents” na sidebar do workspace (runs, status, duração).
🟡 Timeline aninhada mostra runs filhos.
🟡 Usage source=subagent alimenta Consumo (F11) quando existir.

## 6. Casos de borda
- 🟡 Codex pai sem full-access: delegação bloqueada.
- 🟡 Timeout de idle: run encerrado, status visível.
- 🟡 Provider filho offline: erro no pai, sem travar o app.
- 🟡 Tools `[]`: restrição extrema respeitada no filho.

## 7. Critérios de aceite
- 🟡 **Dado** subagent `kind=dev` vinculado, **Quando** o pai chama `call_subagent`, **Então** um run efêmero aparece na timeline.
- 🟡 **Dado** filho que gerou diffs, **Quando** o usuário revisa, **Então** os arquivos do filho estão na revisão do pai.
- 🟡 **Dado** Codex pai sem full-access, **Quando** tenta delegar, **Então** a delegação não ocorre.
- 🟡 **Dado** idle &gt; 20 min (default), **Quando** o timeout dispara, **Então** o run encerra com status visível.

## 8. Questões em aberto
- 🟡 ⚠️ ABERTO: hard cap de 10 vínculos ou só recomendação.

## 9. Relatório de avaliação
```
SCORE TOTAL: 86/100
```
Breakdown:
  Completude: 90/100 (peso 30%)
  Testabilidade: 85/100 (peso 25%)
  Clareza: 85/100 (peso 20%)
  Escopo: 85/100 (peso 15%)
  Edge Cases: 80/100 (peso 10%)
Gaps críticos:
  - Nenhum bloqueador
Sugestões:
  1. Fechar política de cap de vínculos
```

---
Gerado por reversa-spec-sdd em 2026-07-31T10:45:00Z
Fonte: prd.md
