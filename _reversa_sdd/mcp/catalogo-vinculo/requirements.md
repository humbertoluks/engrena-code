# catalogo-vinculo

> Spec do vínculo N:N entre MCPs e projetos + injeção de secrets no dispatch.  
> Nível: essencial · Confiança: afirmações marcadas 🟢/🟡/🔴

## Visão Geral

Sub-unit do módulo MCP: liga/desliga definições MCP a projetos via `project_mcps`, resolve o conjunto efectivo no dispatch e injeta segredos/OAuth apenas no momento do spawn. O cliente nunca recebe valores resolvidos. 🟢

## Responsabilidades

- Vínculo N:N `project_mcps` (link/unlink por projectId + mcpId) 🟢
- Listar MCPs disponíveis vs vinculados por projeto 🟢
- Resolver subset no dispatch conforme seleção do turno 🟢
- Injetar secrets do vault e bearer OAuth na resolução 🟢
- Reportar MCPs omitidos com reason (secret/OAuth/vault lock) 🟢

## Regras de Negócio

- Vínculo não copia secrets; só referencia def global 🟢
- Unlink remove row em `project_mcps`; def global permanece 🟢
- Dispatch usa MCPs vinculados ao projeto + filtros do turno 🟢
- Cofre travado ⇒ todos MCPs com secret omitidos 🟢
- Secret ausente ⇒ MCP omitido; turno continua 🟢
- Valores resolvidos só existem em `ResolvedMcpDef` (memória do dispatch) 🟢

## Requisitos Funcionais

| ID | Requisito | Prioridade | Critério de Aceite |
|----|-----------|------------|-------------------|
| RF-01 | PUT `/projects/:id/mcps/:mcpId` associa mcpId | Must | Row em project_mcps |
| RF-02 | DELETE `/projects/:id/mcps/:mcpId` remove associação | Must | Row ausente; def global intacta |
| RF-03 | GET lista MCPs do projeto com estado de vínculo | Must | UI distingue linked/available |
| RF-04 | Dispatch resolve só MCPs vinculados (ou ids explícitos) | Must | defs[] coerente com project_mcps |
| RF-05 | SecretResolver injeta env/headers no spawn | Must | ResolvedMcpDef sem refs |
| RF-06 | omitted[] documenta MCPs não entregues | Should | reason legível por MCP |

## Requisitos Não Funcionais

| Tipo | Requisito | Evidência | Confiança |
|------|-----------|-----------|-----------|
| Segurança | Secrets só no vault + resolução ephemeral | `mcp-secrets.ts` | 🟢 |
| Isolamento | MCPs de projeto A não vazam para projeto B | projectScope + registry | 🟢 |

## Critérios de Aceitação

```gherkin
Dado um MCP global "slack" e um projectId válido
Quando PUT /projects/:id/mcps/:mcpId
Então project_mcps contém o par e GET lista slack como vinculado

Dado um MCP vinculado com secretRef configurado no vault
Quando o dispatch inicia turno nesse projeto
Então ResolvedMcpDef contém env resolvido e o MCP entra em defs[]

Dado um MCP vinculado sem secret no vault
Quando o dispatch resolve
Então o MCP está em omitted[] e defs[] não o inclui

Dado cofre travado
Quando resolveForProject é chamado
Então MCPs que dependem de secret aparecem em omitted[] com reason de vault
```

## Prioridade (MoSCoW)

| Requisito | MoSCoW | Justificativa |
|-----------|--------|---------------|
| RF-01–RF-05 | Must | Sem vínculo não há tools por projeto |
| RF-06 | Should | UX/debug de MCPs omitidos |

## Rastreabilidade de Código

| Arquivo | Função / Classe | Cobertura |
|---------|-----------------|-----------|
| `packages/server/src/routes/mcps.ts` | link/unlink por projeto | 🟢 |
| `packages/server/src/runner/mcp-registry.ts` | `resolveForProject` | 🟢 |
| `packages/server/src/runner/mcp-secrets.ts` | SecretResolver | 🟢 |
| `packages/server/src/runner/dispatch.ts` | preparação MCP no turno | 🟢 |
