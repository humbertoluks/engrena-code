# Catálogo de copy: F29-monitor-de-execucao

**Produto:** EngrenaCode  
**Última atualização:** 2026-08-11

Strings literais para a aba Grafo. Ids `graph.*`.

## Convenção

`graph.{{slot}}`

## Strings

| Id | Texto | Notas |
|----|-------|-------|
| `graph.tab` | Grafo | botão de aba |
| `graph.loading` | Carregando grafo… | Suspense fallback |
| `graph.empty.noThread` | Selecione uma thread para ver a execução. | sem thread |
| `graph.empty.idle` | Ainda não há delegações nesta thread. | só root, sem filhos |
| `graph.node.root` | Agente | fallback se provider/model ausentes |
| `graph.node.batch` | Batch | rótulo de agrupamento paralelo |
| `graph.node.stage` | Stage | pill de estágio de pipeline |
| `graph.status.running` | em execução | |
| `graph.status.completed` | concluído | |
| `graph.status.error` | erro | |
| `graph.status.timeout` | timeout | |
| `graph.status.idle` | ocioso | |
| `graph.status.waiting_user` | aguardando | |
| `graph.meta.tools` | {n} tools | contador no root |
| `graph.meta.actions` | {n} ações | actionCount no subagent |
| `graph.inspector.title` | Mensagem | header do painel |
| `graph.inspector.from` | De | |
| `graph.inspector.to` | Para | |
| `graph.inspector.status` | Status | |
| `graph.inspector.started` | Início | |
| `graph.inspector.duration` | Duração | |
| `graph.inspector.task` | Task | |
| `graph.inspector.return` | Retorno | |
| `graph.inspector.close` | Fechar | aria + botão |
| `graph.inspector.emptyReturn` | (sem retorno ainda) | |

## Telas

### principal (aba)

| Id | Uso |
|----|-----|
| `graph.tab` | botão ao lado de Histórico/Diff |
| `graph.loading` / `graph.empty.*` | estados do canvas |
| `graph.inspector.*` | painel lateral da aresta |
