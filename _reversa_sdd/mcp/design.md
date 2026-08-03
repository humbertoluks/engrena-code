# mcp, Design Técnico

> Como o módulo MCP é construído, com base no legado.

## Interface

### Transports suportados

| Transport | Resolução de auth | Entrega no driver | Confiança |
|-----------|-------------------|-------------------|-----------|
| stdio | env `{secretRef}` / `{literal}` | spawn processo (wrapper se secretRef) | 🟢 |
| http | headers `{oauthRef}` ou `{literal}` | URL remota + headers resolvidos | 🟢 |
| sse | idem http | stream SSE remoto | 🟢 |

### Rotas HTTP

| Método | Caminho | Entrada | Saída | Confiança |
|--------|---------|---------|-------|-----------|
| GET | `/mcp-catalog` | — | presets[] | 🟢 |
| POST | `/mcp-catalog/:id/install` | — | def criada / 409 | 🟢 |
| GET/POST/PATCH/DELETE | `/mcps` | CRUD body | def(s) | 🟢 |
| POST | `/mcps/:id/oauth/start` | — | flowId, redirect | 🟢 |
| GET/PUT/DELETE | `/mcp-secrets/:mcpId/*` | key/value | keys only no GET | 🟢 |

### Tipos de domínio (shared/runner)

| Tipo | Campos relevantes | Confiança |
|------|-------------------|-----------|
| `McpDefWithRefs` | name, transport, command, args, env, headers, url | 🟢 |
| `ResolvedMcpDef` | valores resolvidos (único tipo que cruza o driver) | 🟢 |
| `McpDispatchDelivery` | defs[], omitted[], cleanup() | 🟢 |
| `OmittedMcp` | name, reason | 🟢 |

## Fluxo Principal

1. Admin/UI instala preset → row em `mcps` com refs, sem vault placeholder 🟢
2. Usuário configura secrets via PUT mcp-secrets ou OAuth Connect 🟢
3. Vínculo N:N em `project_mcps` (ver unit `catalogo-vinculo`) 🟢
4. Dispatch: `mcp-registry.resolveForProject` → defs com refs 🟢
5. `SecretResolver` resolve secrets/OAuth; stdio+secretRef → wrapper loopback 🟢
6. Driver recebe `ResolvedMcpDef[]`; finally chama `cleanup()` 🟢

## Fluxos Alternativos

- **OAuth discovery em camadas:** 401+resource_metadata → well-known path/root → fallback legado 🟢
- **Refresh mutex:** Promise-chain por mcpId; margem 5 min; `invalid_grant` apaga tokens 🟢
- **Flow slot reservation:** `startingFlows` reserva sync antes do 1º await (anti double-click) 🟢
- **Convert to OAuth:** opt-in explícito; nunca silencioso 🟢

## Dependências

- `vault` — mcpSecrets, mcpOauth 🟢
- DB — `mcps`, `project_mcps` 🟢
- `runner/dispatch` — consumidor principal 🟢
- `mcp-servers/*` — pacotes stdio first-party via sentinela DIST 🟢

## Decisões de Design Identificadas

| Decisão | Evidência no código | Confiança |
|---------|---------------------|-----------|
| Registry live sem cache de boot | `mcp-registry.ts` | 🟢 |
| Wrapper loopback para secretRef stdio | `mcp-secrets.ts` | 🟢 |
| `{secretRef}` proibido em headers | validação em routes/runner | 🟢 |
| MCP omitido ≠ erro de turno | dispatch delivery | 🟢 |

## Estado Interno

| Estado | Onde | Evolução |
|--------|------|----------|
| `startingFlows` | oauth.ts | reserva por mcpId durante OAuth |
| Refresh chains | oauth.ts | Promise-chain por mcpId |
| Wrapper token files | mcp-secrets.ts | 0600; apagados após spawn |

Persistência: `mcps`, `project_mcps` (SQLite); tokens OAuth e secrets no vault. 🟢

## Observabilidade

- `omitted[]` no dispatch delivery (reason por MCP) 🟢
- OAuth `lastError` no vault metadata 🟡
- Sem métricas dedicadas de MCP 🟡

## Riscos e Lacunas

- 🔴 Matriz completa de presets e secretKeys por preset (ver catálogo runtime)
- 🟡 Comportamento exacto de DCR vs CIMD por provider OAuth
- 🟡 Timeout exacto de loopback OAuth (5 min inferido)
