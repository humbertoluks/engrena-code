# Spec de UI: #principal — aba Grafo (Monitor de execução)

**Feature:** F29-monitor-de-execucao  
**Destino:** EngrenaCode  
**Componente destino:** `src/renderer/components/workspace/graph/*` montado em `PrincipalScreen`  
**Última atualização:** 2026-08-11

## Escopo

**Inclui:** terceira aba no header do painel central; canvas React Flow com nós/arestas customizados; empty state; inspector lateral ao clicar na aresta; light/dark.

**Exclui:** edição do grafo; mini-map detalhado obrigatório (MiniMap opcional do React Flow ok); streaming de tools internos do filho.

## Anatomia (topo → base)

### A) Header de abas (já existente)

1. Botões: Histórico · Diff · **Grafo**
2. Tab ativa: `bg-surface-2 text-fg`; inativa: `text-muted`
3. Deep-link `#principal?project=&thread=&tab=graph`

### B) Canvas (`ExecutionGraphPanel`)

1. Container irmão do scroll do chat: `flex-1 min-h-0` **sem** `overflow-y-auto` (React Flow exige altura fixa)
2. `<ReactFlow>` full-bleed no container com `Background`, `Controls`, `MiniMap` discreto
3. `colorMode` = `resolvedTheme` (`light` | `dark`)
4. Empty: copy `graph.empty` centrado quando não há thread / sem nós além do empty
5. Lazy: `React.lazy` + `Suspense` com fallback `graph.loading`

### C) Nó `AgentNode`

Ordem interna:
1. Dot de status (accent = running; green = completed; amber = timeout; red = error; muted = idle)
2. Título: provider/model (root) ou nome do subagent/stage/batch
3. Meta: tools count / actionCount · duração (mono tabular)
4. Kind stage: pill `Stage` + `stageId`
5. Kind batch: rótulo `Batch` + N filhos

Dimensão alvo: ~220×72 (layout usa width/height fixos para posicionar).

### D) Aresta `MessageEdge`

1. Path bezier padrão do React Flow
2. Label curto da task (truncado)
3. Se target `running`: `<circle>` com `<animateMotion>` pai→filho
4. Em `subagent.result`: pulso único filho→pai, depois estático
5. `motion-reduce`: sem animateMotion

### E) Inspector `MessageInspector`

Painel à direita do canvas (ou overlay estreito), abre ao clicar na aresta:
1. Header: From → To · Fechar
2. Status · horário início · duração
3. Task (pre/mono)
4. Retorno (texto truncável)

## Layout / tokens

| Região | Tokens |
|--------|--------|
| Tab ativa | `bg-surface-2 text-fg` |
| Canvas | `bg-surface` / React Flow `colorMode` |
| Nó | `rounded-lg border border-border bg-surface shadow-sm` |
| Nó running | ring/pulso `accent` |
| Edge label | `text-[10px] text-muted bg-surface-2` |
| Inspector | `border-l border-border bg-surface`, `max-w-[20rem]` |
| Empty / loading | `text-muted text-[13px]` |
| Focus | `focus-visible:ring-2 focus-visible:ring-accent` |

## Critérios de aceite visual

1. Aba Grafo visível e selecionável ao lado de Histórico/Diff.
2. Nó root sempre presente com thread selecionada.
3. Filho aparece ao vivo em delegação; aresta anima enquanto running.
4. Inspector abre/fecha sem sair da aba.
5. Light e dark sem hex solto; reduced-motion sem partículas animadas.
