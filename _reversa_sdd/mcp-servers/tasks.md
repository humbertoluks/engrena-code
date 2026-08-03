# mcp-servers, Tarefas de Implementação

> Sequência para reimplementar o workspace MCP first-party.

## Pré-requisitos

- [ ] `@modelcontextprotocol/sdk` + `zod` no workspace
- [ ] Runner com rotas mcp-spec e spawn registry
- [ ] Vault → env resolution no server

## Tarefas

- [ ] T-01, Scaffold pacote MCP padrão (index + protocol + test)
  - Origem: `mcp-servers/slack/src/index.ts`, `protocol.ts`
  - Critério de pronto: McpServer connect stdio; ok/fail helpers
  - Confiança: 🟢

- [ ] T-02, Implementar slack (list_channels, read_messages, post_message)
  - Origem: `mcp-servers/slack/src/*`
  - Critério de pronto: SLACK_BOT_TOKEN required; truncamento
  - Confiança: 🟢

- [ ] T-03, Implementar linear (issues GraphQL + fallback search)
  - Origem: `mcp-servers/linear/src/protocol.ts`
  - Critério de pronto: get_issue fallback; updateIssue stateName
  - Confiança: 🟢

- [ ] T-04, Implementar n8n (workflows, executions, webhook)
  - Origem: `mcp-servers/n8n/src/*`
  - Critério de pronto: N8N_BASE_URL + N8N_API_KEY normalizados
  - Confiança: 🟢

- [ ] T-05, Implementar cartesia + elevenlabs TTS
  - Origem: `mcp-servers/cartesia/`, `mcp-servers/elevenlabs/`
  - Critério de pronto: AudioResultPayload; git exclude
  - Confiança: 🟢

- [ ] T-06, lioncode-secret-wrapper (parseArgs, burn, fetch, spawn)
  - Origem: `mcp-servers/lioncode-secret-wrapper/src/*`
  - Critério de pronto: stdio inherit; signal forward; env scrub
  - Confiança: 🟢

- [ ] T-07, lioncode-subagents bridge (caps + proxy tools)
  - Origem: `mcp-servers/lioncode-subagents/src/*`
  - Critério de pronto: tools condicionais; isError em falha
  - Confiança: 🟢

- [ ] T-08, Testes protocol.test.ts por pacote
  - Origem: `mcp-servers/*/test/protocol.test.ts`
  - Critério de pronto: node:test passa sem rede real (mocks)
  - Confiança: 🟢

## Tarefas de Teste

- [ ] TT-01, Slack tool error não mata processo
- [ ] TT-02, Wrapper rejeita specUrl não-loopback
- [ ] TT-03, Bridge sem capabilities → boot fail claro
- [ ] TT-04, TTS grava mp3 e retorna audioRelPath

## Ordem Sugerida

1. T-01 (template)
2. T-06, T-07 (infra interna)
3. T-02–T-05 (integrações externas)
4. T-08 (testes)

## Lacunas Pendentes (🔴)

- Documentação de registro no runner (`LIONCODE_MCP_SERVER_DIST`)
