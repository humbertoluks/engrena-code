# bridge-subagents, Design Técnico

> Bridge MCP stdio lioncode-subagents.

## Interface ENV (`BridgeConfig`)

| Variável | Obrigatório | Papel |
|----------|-------------|-------|
| `LIONCODE_DELEGATE_URL` | Sim* | Endpoint loopback delegate 🟢 |
| `LIONCODE_DELEGATE_TOKEN` | Sim* | Bearer uso único 🟢 |
| `LIONCODE_SUBAGENTS` | Cap opcional | JSON `[{name,description}]` 🟢 |
| `LIONCODE_MEMORY` | Cap opcional | `1` habilita save_memory 🟢 |
| `LIONCODE_REPO_GRAPH` | Cap opcional | `1` habilita repo_graph_* 🟢 |

\* Obrigatórios se alguma cap ativa; ≥1 cap required 🟢

## Tools MCP

| Tool | Condição | Proxy |
|------|----------|-------|
| `call_subagent` | subagents cap | `proxyDelegate` 🟢 |
| `save_memory` | memory cap | `proxySaveMemory` 🟢 |
| `repo_graph_status` … `callees` | repoGraph cap | `proxyRepoGraph` 🟢 |

### call_subagent schema

| Arg | Tipo | Notas |
|-----|------|-------|
| `subagent` | z.enum(names) | Só vinculados ao projeto 🟢 |
| `task` | string | Prompt filho 🟢 |
| `context` | record optional | JSON extra 🟢 |

### repo_graph_* schemas

Espelham família Claude; caps server-side no engine 🟢 (`index.ts` registerRepoGraphTools)

## Fluxo Principal

1. `resolveBridgeConfig()` parse ENV 🟢
2. `new McpServer({ name: MCP_SERVER_NAME })` 🟢
3. Registra tools condicionais (memory → repoGraph → subagents) 🟢
4. `StdioServerTransport.connect` 🟢
5. Invocação tool → proxy HTTP → `{ content, isError? }` 🟢

## proxyDelegate

- POST `LIONCODE_DELEGATE_URL` 🟢
- Header `Authorization: Bearer <token>` 🟢
- Body: subagentName, task, context? 🟢
- Ligado ao AbortController do turno pai no driver 🟢

## Integração Provider (Codex)

```toml
mcp_servers.lioncode.command = "<node>"
mcp_servers.lioncode.args = ["<.../dist/index.js>"]
```

Montado por `CodexCliDriver` com escaping TOML 🟡

## Dependências

- `@modelcontextprotocol/sdk`, `zod` 🟢
- Runner delegate endpoint efêmero por dispatch 🟢
- Catálogo subagents serializado pelo runner no spawn 🟢

## Decisões de Design

| Decisão | Evidência | Confiança |
|---------|-----------|-----------|
| Tools fantasma evitadas (registro condicional) | index.ts caps | 🟢 |
| HTTP proxy vs in-process delegate | comentário index.ts | 🟢 |
| isError espelha política PermissionBroker | catch handlers | 🟢 |
| buildToolDescription dinâmico por catálogo | protocol.ts | 🟢 |

## Riscos e Lacunas

- 🔴 Formato exacto JSON de erro do endpoint delegate
- 🟡 Smoke Codex 0.128.0 bypass documentado vs produção
- 🟡 Quais providers além Codex/Grok usam este bridge
