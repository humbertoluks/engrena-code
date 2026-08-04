# mcp-servers, Design Técnico

> Arquitetura comum dos pacotes MCP first-party.

## Catálogo de Pacotes

| Diretório | Nome MCP | Integração |
|-----------|----------|------------|
| `slack/` | slack | Slack Web API 🟢 |
| `linear/` | linear | GraphQL Linear 🟢 |
| `n8n/` | n8n | REST v1 🟢 |
| `cartesia/` | cartesia | TTS → `.sistema-legado/audio/` 🟢 |
| `elevenlabs/` | elevenlabs | TTS (mesmo contrato) 🟢 |
| `sistema-legado-secret-wrapper/` | (wrapper) | Loopback mcp-spec 🟢 |
| `sistema-legado-subagents/` | sistema-legado | HTTP delegate bridge 🟢 |

## Padrão de Arquivos

| Arquivo | Papel |
|---------|-------|
| `src/index.ts` | McpServer + StdioServerTransport ou spawn wrapper 🟢 |
| `src/protocol.ts` | Config ENV, HTTP, helpers puros 🟢 |
| `test/protocol.test.ts` | node:test sem stdio 🟢 |
| `package.json` | `@sistema-legado/mcp-*` naming 🟢 |

## Fluxo Spawn (runner → MCP)

1. Runner resolve secrets vault → `env` do processo 🟢
2. Provider/SDK configura `command` + `args` (wrapper ou dist direto) 🟢
3. MCP stdio JSON-RPC ↔ provider 🟢
4. Fim dispatch: runner mata processo; wrapper encaminha sinais 🟢

## Contrato Tools (externos)

```
Entrada: args Zod-validados
Saída sucesso: { content: [{ type:'text', text: JSON }] }
Saída erro: { content: [...], isError: true }
```

Confiança: 🟢 (slack/index.ts padrão ok/fail)

## Contrato TTS (Cartesia/ElevenLabs)

| Campo | Descrição |
|-------|-----------|
| `audioRelPath` | Sob `.sistema-legado/audio/<uuid>.mp3` 🟢 |
| `mimeType` | audio/mpeg 🟢 |
| `text` | Texto sintetizado 🟢 |
| `durationSec` | Estimativa CBR 🟢 |

Pós-gravação: `ensureGitExcluded('/.sistema-legado/')` 🟢

## Dependências

- `@modelcontextprotocol/sdk`, `zod` 🟢
- APIs remotas (Slack, Linear, n8n, Cartesia, ElevenLabs) 🟢
- Runner loopback (mcp-spec, delegate) 🟢
- `pnpm-workspace.yaml` inclui `mcp-servers/*` 🟢

## Decisões de Design

| Decisão | Evidência | Confiança |
|---------|-----------|-----------|
| Lógica pura em protocol.ts | todos os pacotes | 🟢 |
| Truncamento uniforme listas/texto | code-analysis | 🟢 |
| Linear auth sem prefix Bearer | linear/protocol | 🟢 |
| n8n base URL sem trailing slash | n8n/protocol | 🟢 |

## Riscos e Lacunas

- 🔴 Versões exatas de API externas e breaking changes
- 🟡 OAuth MCPs (Slack/Linear) vs bot token-only no spawn
- 🟡 Matriz de quais providers usam wrapper vs dist direto
