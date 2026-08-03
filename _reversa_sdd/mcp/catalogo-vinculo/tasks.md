# catalogo-vinculo, Tarefas de Implementação

> Vínculo projeto↔MCP e injeção de secrets no dispatch.

## Pré-requisitos

- [ ] Módulo mcp base (CRUD + registry + secrets) concluído
- [ ] Tabela `project_mcps` migrada
- [ ] Vault unlock integrado ao dispatch

## Tarefas

- [ ] T-01, Endpoints link/unlink/list por projectId
  - Origem no legado: `packages/server/src/routes/mcps.ts`
  - Critério de pronto: link idempotente; unlink remove row
  - Confiança: 🟢

- [ ] T-02, `resolveForProject(projectId)` consulta project_mcps
  - Origem no legado: `packages/server/src/runner/mcp-registry.ts`
  - Critério de pronto: só MCPs vinculados retornados
  - Confiança: 🟢

- [ ] T-03, Integrar SecretResolver no início do dispatch
  - Origem no legado: `packages/server/src/runner/dispatch.ts`
  - Critério de pronto: defs resolvidas; omitted[] populado
  - Confiança: 🟢

- [ ] T-04, Wrapper loopback para stdio+secretRef no delivery
  - Origem no legado: `packages/server/src/runner/mcp-secrets.ts`
  - Critério de pronto: spawn real sem secret em argv
  - Confiança: 🟢

- [ ] T-05, cleanup() no finally do dispatch
  - Origem no legado: `packages/server/src/runner/dispatch.ts`
  - Critério de pronto: wrappers/processos efêmeros encerrados
  - Confiança: 🟢

## Tarefas de Teste

- [ ] TT-01, Link + dispatch → MCP presente em defs[]
- [ ] TT-02, Unlink → MCP ausente no próximo dispatch
- [ ] TT-03, Secret ausente → omitted; turno completa
- [ ] TT-04, Dois projetos → MCPs isolados por project_mcps

## Ordem Sugerida

1. T-01 (HTTP vínculo)
2. T-02 (registry)
3. T-03 → T-04 → T-05 (dispatch path)

## Lacunas Pendentes (🔴)

- _(resolvido na revisão)_ Paths HTTP: PUT/DELETE `/projects/:id/mcps/:mcpId`
