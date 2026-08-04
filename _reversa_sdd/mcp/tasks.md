# mcp, Tarefas de Implementação

> Sequência para reimplementar o módulo MCP a partir do legado.

## Pré-requisitos

- [ ] Vault com namespaces `mcpSecrets` e `mcpOauth` operacionais
- [ ] Migrations `mcps` / `project_mcps` (013) aplicadas
- [ ] Pacotes `mcp-servers/*` buildados para sentinela DIST

## Tarefas

- [ ] T-01, Implementar `MCP_CATALOG` e `presetDefTemplate` com sentinelas NODE/DIST
  - Origem no legado: `packages/server/src/mcp/catalog.ts`
  - Critério de pronto: ~14 presets; install gera def com refs corretas
  - Confiança: 🟢

- [ ] T-02, Rotas GET catálogo + POST install idempotente (409)
  - Origem no legado: `packages/server/src/routes/mcp-catalog.ts`
  - Critério de pronto: reinstall retorna 409; def persistida em mcps
  - Confiança: 🟢

- [ ] T-03, CRUD `/mcps` com validação de nome regex e transport
  - Origem no legado: `packages/server/src/routes/mcps.ts`
  - Critério de pronto: nome `sistema-legado` rejeitado; CRUD completo
  - Confiança: 🟢

- [ ] T-04, `McpOauthManager`: discovery, PKCE, loopback, refresh mutex
  - Origem no legado: `packages/server/src/mcp/oauth.ts`
  - Critério de pronto: tokens no vault; bearer refresh com margem 5 min
  - Confiança: 🟢

- [ ] T-05, Rotas OAuth start/status/disconnect/client/convert
  - Origem no legado: `packages/server/src/routes/mcp-oauth.ts`
  - Critério de pronto: convert opt-in; status público sem tokens
  - Confiança: 🟢

- [ ] T-06, Rotas mcp-secrets GET keys / PUT / DELETE (nunca ecoa valor)
  - Origem no legado: `packages/server/src/routes/mcp-secrets.ts`
  - Critério de pronto: GET lista keys; PUT grava no vault
  - Confiança: 🟢

- [ ] T-07, `mcp-registry`: resolveForProject / resolveByIds (query live)
  - Origem no legado: `packages/server/src/runner/mcp-registry.ts`
  - Critério de pronto: retorna McpDefWithRefs[] por projeto
  - Confiança: 🟢

- [ ] T-08, SecretResolver + wrapper loopback para stdio+secretRef
  - Origem no legado: `packages/server/src/runner/mcp-secrets.ts`
  - Critério de pronto: segredo fora de argv; cleanup após spawn
  - Confiança: 🟢

## Tarefas de Teste

- [ ] TT-01, Install preset stdio → def com secretRef; vault vazio
- [ ] TT-02, Dispatch com secret ausente → omitted; turno OK
- [ ] TT-03, OAuth refresh invalid_grant → tokens apagados
- [ ] TT-04, `{secretRef}` em header → rejeitado na validação

## Tarefas de Migração de Dados (se aplicável)

- [ ] TM-01, Seed presets via install ou migration inicial 🟡

## Ordem Sugerida

1. T-01 → T-02 → T-03 (catálogo e CRUD)
2. T-04 → T-05 (OAuth)
3. T-06 (secrets HTTP)
4. T-07 → T-08 (dispatch path)

## Lacunas Pendentes (🔴)

- Lista exacta de presets e transports por id
- Política DCR/CIMD por provider OAuth remoto
