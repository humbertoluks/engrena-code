import { resolveSubagentTurnCatalog, type Subagent } from '../db/repositories/subagents.js'

export const CALL_SUBAGENT_TOOL_NAME = 'mcp__engrenacode__call_subagent'

/**
 * Catálogo do turno: subagents linked ∧ project.enabled ∧ subagent.enabled (MVP = sempre "dev").
 * Envelope fino sobre resolveTurnCatalog — separa a superfície do runner do detalhe de storage.
 */
export function resolveSubagentCatalog(projectId: string): Subagent[] {
  return resolveSubagentTurnCatalog(projectId)
}

export function buildSubagentCatalogByName(projectId: string): Map<string, Subagent> {
  const catalog = resolveSubagentCatalog(projectId)
  return new Map(catalog.map((s) => [s.name, s]))
}

export function findCatalogSubagent(projectId: string, name: string): Subagent | undefined {
  return buildSubagentCatalogByName(projectId).get(name)
}
