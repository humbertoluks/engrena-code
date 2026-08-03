# catalogo-vinculo, Design Técnico

> Vínculo projeto↔MCP e injeção de secrets no dispatch.

## Interface

### Rotas de vínculo

| Método | Caminho | Entrada | Saída | Confiança |
|--------|---------|---------|-------|-----------|
| GET | `/projects/:id/mcps` | projectId | mcps[] + linked flag | 🟢 |
| PUT | `/projects/:id/mcps/:mcpId` | — | vínculo criado/atualizado | 🟢 |
| DELETE | `/projects/:id/mcps/:mcpId` | — | `{ unlinked }` | 🟢 |

### Resolução no dispatch

| Etapa | Componente | Entrada | Saída | Confiança |
|-------|------------|---------|-------|-----------|
| 1 | `mcp-registry` | projectId, mcpIds? | `McpDefWithRefs[]` | 🟢 |
| 2 | `SecretResolver` | defs + vault session | `ResolvedMcpDef[]`, omitted[] | 🟢 |
| 3 | wrapper (stdio) | def com secretRef | spawn seguro | 🟢 |
| 4 | driver | ResolvedMcpDef[] | MCP client conectado | 🟢 |

## Fluxo Principal

1. UI catálogo MCP lista defs globais; por projeto mostra vínculos 🟢
2. Link cria row `(project_id, mcp_id)` em `project_mcps` 🟢
3. Turno: dispatch snapshot → `resolveForProject(projectId)` 🟢
4. SecretResolver: para cada def, resolve `{secretRef}` → valor vault; `{oauthRef}` → bearer; `{literal}` → string 🟢
5. stdio com secretRef: wrapper loopback GET /mcp-spec + token file 0600 🟢
6. Entrega `McpDispatchDelivery { defs, omitted, cleanup }` ao runner 🟢
7. finally: cleanup() fecha wrappers/processos efêmeros 🟢

## Fluxos Alternativos

- **MCP ids explícitos no turno:** `resolveByIds` ignora vínculo parcial 🟢
- **OAuth indisponível:** omitted reason; refresh tentado antes 🟢
- **Isolation coercion D14:** MCPs forçados live-write em certos modos 🟡

## Dependências

- `mcps` + `project_mcps` (SQLite) 🟢
- `vault` (unlock obrigatório para secrets) 🟢
- `runner/dispatch.ts` — orquestrador 🟢

## Decisões de Design Identificadas

| Decisão | Evidência | Confiança |
|---------|-----------|-----------|
| Vínculo N:N separado de defs globais | schema 013 | 🟢 |
| Omitir ≠ falhar turno | dispatch delivery | 🟢 |
| Wrapper anti-leak só stdio+secretRef | mcp-secrets.ts | 🟢 |

## Estado Interno

| Estado | Onde | Notas |
|--------|------|-------|
| `project_mcps` rows | SQLite | UNIQUE(project_id, mcp_id) 🟡 |
| Resolved defs | memória dispatch | ephemeral; nunca persistido 🟢 |
| Token files wrapper | FS tmp | mode 0600; deleted pós-spawn 🟢 |

## Riscos e Lacunas

- 🟢 Contrato HTTP link/unlink: `PUT` + `DELETE` `/projects/:id/mcps/:mcpId` (`routes/mcps.ts`) [Revisão]
- 🟡 Interacção com isolation-coercion no dispatch
- 🟡 Filtro de MCPs seleccionados na UI vs todos vinculados
