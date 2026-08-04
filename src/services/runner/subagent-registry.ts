import type { Subagent, SubagentsRepository } from '../db/repositories/subagents.js'

export const CALL_SUBAGENT_TOOL_NAME = 'mcp__engrenacode__call_subagent'

/**
 * Catálogo do turno: subagents linked ∧ project.enabled ∧ subagent.enabled (MVP = sempre "dev").
 * Envelope fino sobre resolveTurnCatalog — separa a superfície do runner do detalhe de storage.
 */
export function resolveSubagentCatalog(repo: SubagentsRepository, projectId: string): Subagent[] {
  return repo.resolveTurnCatalog(projectId)
}

export function buildSubagentCatalogByName(repo: SubagentsRepository, projectId: string): Map<string, Subagent> {
  const catalog = resolveSubagentCatalog(repo, projectId)
  return new Map(catalog.map((s) => [s.name, s]))
}

export function findCatalogSubagent(repo: SubagentsRepository, projectId: string, name: string): Subagent | undefined {
  return buildSubagentCatalogByName(repo, projectId).get(name)
}
