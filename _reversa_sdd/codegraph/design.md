# codegraph, Design Técnico

> Como o módulo CodeGraph é construído, com base no legado.

## Interface

### Status efetivo

| Status | Condição | Confiança |
|--------|----------|-----------|
| absent | sem codegraph.db | 🟢 |
| building | run activo ou lock vivo sem job nosso | 🟢 |
| ready | db presente, não stale | 🟢 |
| stale | HEAD≠indexed ou dirty/pendingChanges | 🟢 |
| error | lastInitError ou estado inválido | 🟢 |

### Tools repo_graph_* (server-side only)

| Tool | Papel | Confiança |
|------|-------|-----------|
| repo_graph_status | caps e stats | 🟢 |
| repo_graph_search | busca símbolos | 🟢 |
| repo_graph_minimal_context | contexto mínimo | 🟢 |
| repo_graph_impact | impacto变更 | 🟢 |
| repo_graph_node | detalhe nó | 🟢 |
| repo_graph_callers / callees | grafo chamadas | 🟢 |

### Rotas HTTP

| Método | Caminho | Papel | Confiança |
|--------|---------|-------|-----------|
| GET | `/projects/:id/codegraph/status` | status+stats | 🟢 |
| POST | `.../build` | init/index full | 🟢 |
| POST | `.../reindex` | index --force | 🟢 |
| POST | `.../update` | sync incremental | 🟢 |
| POST | `.../repair` | wipe+init | 🟢 |
| POST | `.../cancel` | kill job | 🟢 |

## Fluxo Principal

1. UI: gate absent+indexável → consent → POST build 🟢
2. Engine: slot sync, lock externo, createRun, spawn detached 🟢
3. Watchdogs: 10min total / 90s idle; stdin FECHADO 🟢
4. Status GET: matriz effective + staleness lazy 🟢
5. Dispatch: getInjectionState → inject tools se injectable 🟢
6. runTool: CLI query fail-closed; erro JSON ao agente 🟢

## Fluxos Alternativos

- **Auto-sync:** fire-and-forget update; throttle 30s 🟢
- **Auto-install:** installer pinado 1.4.1 + SHA256 🟢
- **Lock stale:** PID vivo + lock >10min ⇒ morto 🟢
- **Init repetido com db:** no-op (J4) 🟢

## Dependências

- CLI `codegraph` externa (managed install) 🟢
- DB `codegraph_runs` + campos `projects.*` 🟢
- `git` project-execution (repair lease) 🟢
- `runner/dispatch` — injecção tools 🟢

## Decisões de Design Identificadas

| Decisão | Evidência | Confiança |
|---------|-----------|-----------|
| Agente nunca spawna CLI | engine writer único | 🟢 |
| Graph nunca removido | repair substitui uninit | 🟢 |
| Cancel fora slot exclusão | engine.ts | 🟢 |
| `.codegraph/` no gitignore idempotente | gitignore.ts | 🟢 |

## Estado Interno

| Estado | Onde | Notas |
|--------|------|-------|
| Jobs Map | engine.ts | pid, kind, runId |
| codegraph.db | `.codegraph/` projeto | writer CLI |
| projects.stats_json | SQLite | cache stats |

## Riscos e Lacunas

- 🟢 Versão pinada CodeGraph: `CODEGRAPH_PINNED_VERSION = '1.4.1'` (`codegraph/installer.ts`) [Revisão]; caps CLI seguem o binário pinado
- 🟡 Heurísticas exactas UI offer gate (renderer)
- 🟡 Matriz repair vs projectExecutions lease
