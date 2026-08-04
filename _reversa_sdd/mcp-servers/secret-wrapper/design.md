# secret-wrapper, Design Técnico

> Wrapper pass-through de segredos MCP.

## Interface

### WrapperArgs (argv)

| Campo | Posição | Validação |
|-------|---------|-----------|
| `serverName` | 1 | non-empty 🟢 |
| `tokenFilePath` | 2 | non-empty 🟢 |
| `specUrl` | 3 | `^https?://127\.0\.0\.1(:\d+)?/` 🟢 |

Uso CLI: `<execPath> dist/index.js <name> <tokenFile> <specUrl>` 🟢

### ServerSpec (resposta loopback)

| Campo | Tipo | Uso |
|-------|------|-----|
| `command` | string | Executável filho 🟢 |
| `args` | string[] | Args filho 🟢 |
| `env` | Record<string,string> | Merge sobre env scrubbed 🟢 |

Request: `GET <specUrl>?server=<name>` + `Authorization: Bearer <token>` 🟢

## Fluxo Principal

```
Provider spawns wrapper
  → parseArgs
  → readAndBurnToken(path)
  → fetchSpec → ServerSpec
  → spawn(command, args, { env: buildChildEnv, stdio: 'inherit' })
  → forward signals; exit on child exit
```

Confiança: 🟢 (`index.ts` + `protocol.ts`)

## buildChildEnv

1. Copia `process.env` 🟢
2. Remove chaves `SISTEMA_LEGADO_MCP_*` e `SISTEMA_LEGADO_SECRET_*` 🟢
3. Overlay `spec.env` do runner 🟢

## Fluxos Alternativos

- **Token file vazio:** throw → stderr → exit 1 🟢
- **fetchSpec non-OK:** throw com status 🟢
- **unlink falha:** ignorado; runner limpa dir no fim dispatch 🟢
- **child error event:** stderr + exit 1 🟢
- **child exit com signal:** repassa signal ao wrapper 🟢

## Dependências

- Node `child_process.spawn` 🟢
- Runner endpoint mcp-spec (loopback) 🟢
- Provider config apontando wrapper como MCP command 🟢

## Decisões de Design

| Decisão | Evidência | Confiança |
|---------|-----------|-----------|
| Token-por-arquivo (não argv) | protocol.ts comentário TRAVADA | 🟢 |
| stdio inherit (não pipe) | index.ts | 🟢 |
| Lógica pura separada do entry | protocol.ts + tests | 🟢 |

## Riscos e Lacunas

- 🟢 Loopback mcp-spec: pathname `/mcp-spec` (`runner/mcp-secrets.ts`) [Revisão]
- 🟡 Permissões owner-only do token file no OS
- 🟡 Timeout de fetchSpec se runner lento
