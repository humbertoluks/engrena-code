# bridge-subagents, Tarefas de Implementação

> Sequência para reimplementar o sistema-legado-subagents bridge.

## Pré-requisitos

- [ ] Runner expõe delegate/save-memory/repo-graph loopback
- [ ] Driver gera URL+token efêmeros por dispatch
- [ ] Catálogo subagents do projeto serializado em ENV

## Tarefas

- [ ] T-01, resolveBridgeConfig: parse ENV + validar ≥1 capability
  - Origem: `mcp-servers/sistema-legado-subagents/src/protocol.ts`
  - Critério de pronto: throw descritivo se config inválida
  - Confiança: 🟢

- [ ] T-02, proxyDelegate / proxySaveMemory / proxyRepoGraph
  - Origem: `mcp-servers/sistema-legado-subagents/src/protocol.ts`
  - Critério de pronto: Bearer header; fetch injetável; ok/error shape
  - Confiança: 🟢

- [ ] T-03, registerRepoGraphTools (7 tools + schemas Zod)
  - Origem: `mcp-servers/sistema-legado-subagents/src/index.ts`
  - Critério de pronto: cada tool proxy com isError em falha
  - Confiança: 🟢

- [ ] T-04, call_subagent com z.enum(names) + buildToolDescription
  - Origem: `mcp-servers/sistema-legado-subagents/src/index.ts`
  - Critério de pronto: nomes fora do enum rejeitados pelo schema
  - Confiança: 🟢

- [ ] T-05, Registro condicional save_memory (MEMORY=1)
  - Origem: `mcp-servers/sistema-legado-subagents/src/index.ts`
  - Critério de pronto: sem ENV ⇒ tool ausente no list_tools
  - Confiança: 🟢

- [ ] T-06, main: McpServer + StdioServerTransport + boot fail stderr
  - Origem: `mcp-servers/sistema-legado-subagents/src/index.ts`
  - Critério de pronto: stdout limpo; erro boot exit 1 stderr
  - Confiança: 🟢

- [ ] T-07, Testes protocol.test.ts
  - Origem: `mcp-servers/sistema-legado-subagents/test/protocol.test.ts`
  - Critério de pronto: config, proxy mocks, enum parsing
  - Confiança: 🟢

- [ ] T-08, Wiring CodexCliDriver TOML mcp_servers.sistema-legado
  - Origem: `packages/server/src/providers/` (Codex driver)
  - Critério de pronto: codex exec carrega MCP e invoca call_subagent
  - Confiança: 🟡

## Tarefas de Teste

- [ ] TT-01, Bridge só memory → save_memory listada; subagent ausente
- [ ] TT-02, call_subagent erro rede → isError sem crash
- [ ] TT-03, repo_graph_search ok → texto result
- [ ] TT-04, Smoke codex exec com bridge (integração)

## Ordem Sugerida

1. T-01, T-02, T-07 (protocol + tests)
2. T-03, T-04, T-05, T-06 (MCP registration)
3. T-08 (provider wiring)

## Lacunas Pendentes (🔴)

- Contrato HTTP exacto dos endpoints delegate/save-memory/repo-graph
