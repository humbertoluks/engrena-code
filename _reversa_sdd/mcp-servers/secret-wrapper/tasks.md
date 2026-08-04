# secret-wrapper, Tarefas de Implementação

> Sequência para reimplementar o sistema-legado-secret-wrapper.

## Pré-requisitos

- [ ] Runner expõe GET mcp-spec autenticado por Bearer
- [ ] Runner grava token file efêmero por dispatch
- [ ] Registry MCP aponta wrapper como command

## Tarefas

- [ ] T-01, Implementar parseArgs com regex 127.0.0.1
  - Origem: `mcp-servers/sistema-legado-secret-wrapper/src/protocol.ts`
  - Critério de pronto: URLs externas rejeitadas; 3 posicionais OK
  - Confiança: 🟢

- [ ] T-02, Implementar readAndBurnToken com fs injetável
  - Origem: `mcp-servers/sistema-legado-secret-wrapper/src/protocol.ts`
  - Critério de pronto: lê UTF-8 trim; unlink best-effort; vazio throw
  - Confiança: 🟢

- [ ] T-03, Implementar fetchSpec com validação ServerSpec
  - Origem: `mcp-servers/sistema-legado-secret-wrapper/src/protocol.ts`
  - Critério de pronto: Bearer header; JSON command/args/env
  - Confiança: 🟢

- [ ] T-04, Implementar buildChildEnv scrub SISTEMA_LEGADO_* channels
  - Origem: `mcp-servers/sistema-legado-secret-wrapper/src/protocol.ts`
  - Critério de pronto: filho não herda vars de entrega
  - Confiança: 🟢

- [ ] T-05, Entry index: spawn inherit + signal forward + exit propagate
  - Origem: `mcp-servers/sistema-legado-secret-wrapper/src/index.ts`
  - Critério de pronto: SIGTERM/SIGINT chegam ao filho; exit code espelhado
  - Confiança: 🟢

- [ ] T-06, Testes protocol.test.ts (mock fetch/fs)
  - Origem: `mcp-servers/sistema-legado-secret-wrapper/test/protocol.test.ts`
  - Critério de pronto: casos burn, scrub, parse cobertos
  - Confiança: 🟢

## Tarefas de Teste

- [ ] TT-01, Integração smoke: wrapper → filho slack stdio
- [ ] TT-02, specUrl http://localhost rejeitado (só 127.0.0.1)
- [ ] TT-03, Token file removido após leitura

## Ordem Sugerida

1. T-01 → T-04 (protocol puro)
2. T-06 (testes)
3. T-05 (entry integração)

## Lacunas Pendentes (🔴)

- Contrato OpenAPI/formal da rota mcp-spec no server
