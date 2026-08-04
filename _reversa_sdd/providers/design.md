# providers, Design Técnico

> Camada de drivers de IA e registry.

## Interface

### `ProviderDriver`

| Membro | Tipo | Papel |
|--------|------|-------|
| `name` | `Provider` | claude \| codex \| glm \| minimax \| grok \| kimi |
| `available` | `boolean` | Credencial/CLI ok |
| `dispatch` | `(prompt, DispatchOptions) => AsyncIterable<RawStreamEvent>` | Stream causal |
| `cancel` | `(threadId) => void` | Abort inflight |

🟢 `packages/server/src/providers/types.ts`

### `createDriverRegistry(deps)`

| Driver | Implementação | Auth / notas |
|--------|---------------|--------------|
| `claude` | `ClaudeAgentDriver` | Key opcional; OAuth default |
| `glm` | `ClaudeAgentDriver` compat | Key obrigatória |
| `minimax` | `ClaudeAgentDriver` compat | Key obrigatória |
| `codex` | `CodexCliDriver` | ~/.codex/auth.json |
| `grok` | `GrokAcpDriver` | ACP stdio |
| `kimi` | `KimiAcpDriver` | ACP stdio |

Instância **única** por provider no registry (estado cancel compartilhado). 🟢

### `DispatchOptions` (injetado pelo runner)

Campos-chave: `threadId`, `worktreePath`, `accessLevel`, `resumeSessionId`, closures (`delegate`, `saveMemory`, `repoGraphQuery`, `requestPermission`, `requestQuestion`), `abortController`, catálogos (`subagents`, `skills`, `mcps`). 🟢

Drivers **não** leem DB — snapshot vem no options.

## Fluxo Principal

1. Runner resolve provider da thread → `registry.get(provider)` 🟢
2. Monta `DispatchOptions` (cwd worktree, brokers, abortController do turno) 🟢
3. `for await (const raw of driver.dispatch(prompt, options))` 🟢
4. Runner allocate-then-emit `seq`, persiste, `ws.emit` 🟢
5. Fim ou erro → usage + state transition 🟢

## Fluxos por Família

- **Claude-family:** Agent SDK `query()`, MCP in-process `sistema-legado`, `canUseTool` → brokers 🟢
- **Codex:** app-server ou exec; MCP via proxy; usage cumulativo com delta 🟢
- **ACP (grok/kimi):** spawn CLI → initialize → session → prompt; cancel SIGTERM/ACP 🟢

## Dependências

- `@sistema-legado/shared` — Provider, RawStreamEvent, AccessLevel 🟢
- Claude Agent SDK — claude/glm/minimax 🟢
- ACP SDK — grok/kimi 🟢
- Consumido por `runner/dispatch.ts`, rotas config, `memory/consolidator` 🟢

## Decisões de Design

| Decisão | Evidência | Confiança |
|---------|-----------|-----------|
| RawStreamEvent sem seq no driver | types.ts EN-09 | 🟢 |
| GLM/Minimax reutilizam ClaudeAgentDriver | registry.ts | 🟢 |
| `abortController` do runner é handle real de cancel | DispatchOptions | 🟢 |
| Contained execution para validador build | `containedExecution` flag | 🟢 |

## Estado Interno

| Estado | Onde |
|--------|------|
| Map threadId → AbortController / process | cada driver |
| Sessões provider (resume ids) | driver + callback onSession |
| CLI resolved paths | cli-resolver cache |

## Observabilidade

- `transportName` opcional por driver 🟢
- Usage parsers isolados (`claude-usage.ts`, `kimi-session-usage.ts`) 🟢

## Riscos e Lacunas

- 🔴 Matriz fina permission mode × provider × tool
- 🟡 Comportamento exacto quando CLI codex ausente no PATH
- 🟡 Semântica usage GLM/Minimax vs Claude family 🟡
