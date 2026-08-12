# Plano de Implementação: F29. Monitor de execução (grafo)

**Pré-requisitos:**
- F03 workspace (history + WS), F15 subagent_runs, F18 parallelBatchId, F22 pipeline
- `ui.md`/`copy.md` desta pasta escritos **antes** da fase de UI
- Dependência: `@xyflow/react` (sem elkjs / zustand novo / framer-motion)

### Fase 1: Scaffold e docs

**1. Dependência** — Adicionar `@xyflow/react` em `apps/engrena-code`, importar CSS em `index.css`, validar `tsc -b`.

**2. Docs** — `spec.md`, `plan.md`, `ui.md`, `copy.md`.

### Fase 2: Lógica pura + gap backend

**3. executionGraph.logic.ts** — Tipos + `buildExecutionGraph` + `applyLiveEvent` + `layoutExecutionGraph` + sibling test.

**4. pipeline_stages.subagent_run_id** — Expor `childThreadId` em `DelegationResult`; popular em `runStage`; teste em `pipeline-runner.test.ts`.

### Fase 3: UI

**5. Painel** — `ExecutionGraphPanel`, `AgentNode`, `MessageEdge` (SVG animateMotion), `colorMode` via `useTheme`.

**6. Wire tab** — `ThreadTab = 'history' | 'diff' | 'graph'`; overlay em `handleStreamEvent`; botão + container `flex-1 min-h-0` fora do scroll do chat; lazy load; deep-link `tab=graph`.

**7. Inspector** — `MessageInspector` ao clicar na aresta.

### Fase 4: Fechamento

**8. Gates** — `tsc -b`, `pnpm test` (duas vezes), smoke E2E + `smoke-results.md`, entrada F29 em PRD/PROGRESS (tabela Ondas).
