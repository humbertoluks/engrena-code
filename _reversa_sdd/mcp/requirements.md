# mcp

> Spec de requisitos do módulo MCP (`packages/server/src/mcp` + rotas + runner).  
> Nível: essencial · Confiança: afirmações marcadas 🟢/🟡/🔴

## Visão Geral

Catálogo first-party de presets MCP, CRUD de definições globais, OAuth 2.1 para transports remotos (http/sse), resolução de segredos via vault e entrega segura no dispatch. Suporta stdio, http e sse; segredos nunca cruzam argv/ps nem respostas HTTP. 🟢

## Responsabilidades

- Manter `MCP_CATALOG` (~14 presets) e instalação idempotente 🟢
- CRUD de defs em `mcps` com refs `{secretRef}`, `{literal}`, `{oauthRef}` 🟢
- OAuth: discovery em camadas, PKCE, loopback, refresh mutex 🟢
- Registry live (`resolveForProject` / `resolveByIds`) sem cache de boot 🟢
- SecretResolver + wrapper anti-leak para stdio com secretRef 🟢
- Sentinelas `LIONCODE_NODE` e `LIONCODE_MCP_SERVER_DIST:<pkg>` 🟢

## Regras de Negócio

- Nome `lioncode` reservado (broker interno); regex `^[a-z0-9][a-z0-9_-]*$` 🟢
- `{secretRef}` em headers rejeitado (vazaria em `--mcp-config`/argv) 🟢
- Install não cria placeholder no vault 🟢
- MCP omitido do dispatch se cofre travado / secret ausente / OAuth indisponível (não derruba turno) 🟢
- Token/client_secret nunca em log, DB público ou HTTP response 🟢
- Convert to OAuth é opt-in (nunca silencioso) 🟢
- Endpoint remoto: https obrigatório; http só loopback 🟢

## Requisitos Funcionais

| ID | Requisito | Prioridade | Critério de Aceite |
|----|-----------|------------|-------------------|
| RF-01 | GET catálogo expõe presets com transport, secretKeys e authMode | Must | UI lista presets instaláveis |
| RF-02 | POST install cria def em `mcps`; idempotente (409 se já existe) | Must | Reinstall não duplica |
| RF-03 | CRUD global de MCPs com validação de nome e transport | Must | Def inválida → 422 |
| RF-04 | OAuth Connect: discovery → client → PKCE → tokens no vault | Must | Status público no DB; tokens no vault |
| RF-05 | Dispatch resolve refs → `ResolvedMcpDef`; omite MCPs indisponíveis | Must | Turno continua; `omitted[]` preenchido |
| RF-06 | stdio com secretRef usa wrapper loopback (segredo fora de argv) | Must | ps/argv não expõe secret |
| RF-07 | GET/PUT/DELETE mcp-secrets nunca ecoa valores | Must | Só keys no GET |

## Requisitos Não Funcionais

| Tipo | Requisito inferido | Evidência no código | Confiança |
|------|--------------------|---------------------|-----------|
| Segurança | Anti-leak em argv via secret wrapper | `runner/mcp-secrets.ts` | 🟢 |
| Segurança | Refresh OAuth mutex por mcpId | `mcp/oauth.ts` `getBearerToken` | 🟢 |
| Disponibilidade | Omitir MCP ausente não aborta dispatch | `runner/mcp-registry.ts` | 🟢 |
| Performance | Registry query live (sem stale cache) | `mcp-registry.ts` | 🟢 |

## Critérios de Aceitação

```gherkin
Dado um preset MCP stdio com secretKeys
Quando o usuário instala via POST /mcp-catalog/:id/install
Então uma def é criada em mcps com {secretRef} no env e nenhum placeholder no vault

Dado um MCP OAuth com tokens válidos no vault
Quando o dispatch resolve defs para o projeto
Então headers.Authorization contém bearer resolvido e o MCP entra em defs[]

Dado um MCP stdio cujo secretRef não existe no vault
Quando o dispatch tenta resolver
Então o MCP aparece em omitted[] com reason e o turno prossegue

Dado um MCP remoto com URL http://127.0.0.1:8080
Quando assertSafeEndpoint valida
Então o endpoint é aceito; URL http externa é rejeitada
```

## Prioridade (MoSCoW)

| Requisito | MoSCoW | Justificativa |
|-----------|--------|---------------|
| RF-01–RF-06 | Must | MCP é extensão central de tools |
| RF-07 | Must | Segredos nunca vazam por HTTP |

## Rastreabilidade de Código

| Arquivo | Função / Classe | Cobertura |
|---------|-----------------|-----------|
| `packages/server/src/mcp/catalog.ts` | `MCP_CATALOG`, `presetDefTemplate` | 🟢 |
| `packages/server/src/mcp/oauth.ts` | `McpOauthManager` | 🟢 |
| `packages/server/src/routes/mcp-catalog.ts` | install preset | 🟢 |
| `packages/server/src/routes/mcps.ts` | CRUD global | 🟢 |
| `packages/server/src/runner/mcp-registry.ts` | `resolveForProject` | 🟢 |
| `packages/server/src/runner/mcp-secrets.ts` | SecretResolver, wrapper | 🟢 |
