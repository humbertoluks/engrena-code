import { resolveForProject, type Mcp } from '../db/repositories/mcps.js'

/** Envelope fino sobre o repositório — MCPs linked ∧ enabled no projeto ∧ mcp.enabled (spec §7.1). */
export const McpRegistry = {
  resolveForProject(projectId: string): Mcp[] {
    return resolveForProject(projectId)
  },
}
