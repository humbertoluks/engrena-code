# Spec SDD: Rules

> Selo 🟡 PLANEJADO. Componente do EngrenaCode.

**Componente:** rules
**Feature:** F06
**Versão alvo:** MVP
**Data:** 2026-07-31T10:45:00Z

## 1. Problema
🟡 Instruções permanentes (padrões de código, review, PR) são recolocadas a cada turno; leads não têm override local por projeto sem poluir o contexto.

## 2. Objetivos
🟡 CRUD de rules globais e por projeto, com override de supressão e injeção em todo turno sob precedência explícita.

## 3. Não-objetivos
🟡 Rules que executam código; sync multi-máquina; RBAC de edição; import automático de marketplaces.

## 4. Requisitos funcionais
- 🟡 **RF-01:** CRUD com `name` sem CR/LF, `content` markdown (~1 MiB prático), `enabled`, `isGlobal`.
- 🟡 **RF-02:** Rules não-globais só valem nos projetos vinculados; globais valem em todos, com override off por projeto.
- 🟡 **RF-03:** Precedência: rule de projeto &gt; rule global &gt; `CLAUDE.md` / `AGENTS.md` do repo.
- 🟡 **RF-04:** Bloco de rules resolvido é injetado inline em todo turno, antes do system prompt da thread.
- 🟡 **RF-05:** Name inválido (CR/LF) ou duplicado é rejeitado.
- 🟡 **RF-06:** Recomendação ≤ 15 rules ativas por projeto (globais + locais).
- 🟡 **RF-07:** Cofre travado impede resolução de rules no turno.

## 5. Comportamentos
🟡 Tela `#rules`; vínculo/supressão no Workspace.
🟡 Contagens alimentam o dashboard (F04).

## 6. Casos de borda
- 🟡 Override off em projeto: rule global some só naquele projeto.
- 🟡 Rule disabled: ausente da resolução.
- 🟡 Conflito de names: rejeição.
- 🟡 Arquivos do repo presentes: só aplicam após rules do dono na precedência.

## 7. Critérios de aceite
- 🟡 **Dado** rule global enabled, **Quando** um turno roda em projeto sem override, **Então** o content entra no bloco injetado.
- 🟡 **Dado** override off no projeto, **Quando** o turno roda, **Então** aquela rule global não entra.
- 🟡 **Dado** rule de projeto e global com temas sobrepostos, **Quando** resolve, **Então** a de projeto tem precedência.
- 🟡 **Dado** name com CR/LF, **Quando** salva, **Então** é rejeitado.

## 8. Questões em aberto
- 🟡 ⚠️ ABERTO: hard cap de 15 ativas ou só warning.

## 9. Relatório de avaliação
```
SCORE TOTAL: 85/100
```
Breakdown:
  Completude: 85/100 (peso 30%)
  Testabilidade: 90/100 (peso 25%)
  Clareza: 85/100 (peso 20%)
  Escopo: 85/100 (peso 15%)
  Edge Cases: 75/100 (peso 10%)
Gaps críticos:
  - Nenhum bloqueador
Sugestões:
  1. Fechar hard cap vs soft warning
```

---
Gerado por reversa-spec-sdd em 2026-07-31T10:45:00Z
Fonte: prd.md
