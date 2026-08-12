# Smoke: F29. Monitor de execução (grafo)

**Data:** 2026-08-11  
**Método:** `pnpm dev` (Electron + Vite reais, `ELECTRON_EXTRA_LAUNCH_ARGS=--no-sandbox`) + `playwright-cli` em `http://localhost:5173`, com `ENGRENACODE_USER_DATA` isolado (`%TEMP%\engrenacode_claude_f29_*` — vault real intocado). Thread/subagent_run semeados no SQLite do fixture (sem turno real de agente nesta rodada).

## Confirmado ao vivo

1. **Aba Grafo** aparece ao lado de Histórico/Diff no `#principal` (copy `Grafo`).
2. **Empty sem thread:** canvas mostra "Selecione uma thread para ver a execução."
3. **Grafo com delegação:** thread fixture com `call_subagent` + `subagent_runs` renderiza nó root (`claude · claude-sonnet-4-6`, ocioso) → aresta com label da task → nó `reviewer` (concluído, 5 ações, 4s).
4. **Inspector:** clique na aresta abre painel "Mensagem" com From/To, status, início, duração, task e retorno.
5. **Lazy load:** abrir a aba carrega o painel React Flow sem quebrar o restante do workspace.
6. **Light/dark:** screenshots em ambos os temas; tokens do Design Lock (sem hex solto).
7. **Deep-link `tab=graph`:** aceito em `PrincipalScreen` (aplicado no primeiro mount com query).

## Não exercitado neste smoke

- Overlay live `subagent.start` durante turno real (coberto por unitários de `applyLiveEvent` + wiring no hook).
- Pipeline stages / batch paralelo na UI (cobertos por unitários de `buildExecutionGraph`).
- Streaming de `tool_call.*` do filho no WS do pai (fora de escopo — próximo passo na spec).

## Screenshots

- `smoke/f29_graph_empty_dark.png` — empty sem thread
- `smoke/f29_graph_with_subagent_light.png` / `f29_graph_with_subagent_dark.png` — root + reviewer
- `smoke/f29_graph_inspector_light.png` / `f29_graph_inspector_dark.png` — inspector aberto
