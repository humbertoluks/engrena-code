# Spec SDD: Registros

> Selo 🟡 PLANEJADO. Componente do EngrenaCode.

**Componente:** registros
**Feature:** F08
**Versão alvo:** 1.0
**Data:** 2026-07-31T10:45:00Z

## 1. Problema
🟡 Sem trilha auditável local de tasks, tools e git, o usuário não reconstrói o que o agente fez entre sessões.

## 2. Objetivos
🟡 Expor audit log somente leitura de eventos `task` | `tool` | `git` com filtro, paginação e navegação à thread.

## 3. Não-objetivos
🟡 Edição/exclusão individual de registro; export; purge automático; entrada manual de eventos.

## 4. Requisitos funcionais
- 🟡 **RF-01:** Tela `#registros` somente leitura sobre `log_entries`.
- 🟡 **RF-02:** Campos: timestamp, tipo (`task`|`tool`|`git`), evento, thread id.
- 🟡 **RF-03:** Paginação 100/página; filtro Todos / Tasks / Tool calls / Git flow.
- 🟡 **RF-04:** Eventos gerados automaticamente a partir do Workspace (dispatch, tools relevantes, fluxo git).
- 🟡 **RF-05:** Clique no thread id abre a thread no workspace.
- 🟡 **RF-06:** Apagar thread remove registros em cascade; sem edit/delete individual.
- 🟡 **RF-07:** Empty states distintos: sem registros vs filtro sem resultados.
- 🟡 **RF-08:** Cofre travado → lista vazia / 423.

## 5. Comportamentos
🟡 Falha de load: “Não foi possível carregar os registros.” + Tentar novamente.
🟡 Não há export na 1.0.

## 6. Casos de borda
- 🟡 Thread apagada: registros somem via cascade.
- 🟡 Filtro sem match: empty específico.
- 🟡 Cofre travado durante navegação: 423 / lista vazia.
- 🟡 Volume alto: paginação 100 sem travar a UI.

## 7. Critérios de aceite
- 🟡 **Dado** uso do workspace, **Quando** abre `#registros`, **Então** vê eventos task/tool/git gerados automaticamente.
- 🟡 **Dado** filtro Tool calls, **Quando** aplica, **Então** só eventos `tool` aparecem.
- 🟡 **Dado** um registro, **Quando** clica no thread id, **Então** abre a thread no workspace.
- 🟡 **Dado** a UI, **Quando** tenta editar/apagar/exportar um registro, **Então** não há controles para isso.

## 8. Questões em aberto
- 🟡 Nenhuma crítica para 1.0.

## 9. Relatório de avaliação
```
SCORE TOTAL: 86/100
```
Breakdown:
  Completude: 90/100 (peso 30%)
  Testabilidade: 85/100 (peso 25%)
  Clareza: 85/100 (peso 20%)
  Escopo: 90/100 (peso 15%)
  Edge Cases: 75/100 (peso 10%)
Gaps críticos:
  - Nenhum bloqueador
Sugestões:
  1. Definir retenção máxima futura (fora de 1.0)
```

---
Gerado por reversa-spec-sdd em 2026-07-31T10:45:00Z
Fonte: prd.md
