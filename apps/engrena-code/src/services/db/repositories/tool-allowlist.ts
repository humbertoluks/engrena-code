import { getDb } from '../client.js'

/**
 * Ferramentas com aprovação permanente por projeto. A allowlist da thread (em memória, no
 * `permission-broker`) cobre a sessão; esta sobrevive ao restart, como o auto-approve por
 * settings do VS Code.
 */
export interface AllowedTool {
  projectId: string
  toolName: string
  createdAt: number
}

interface AllowedToolRow {
  project_id: string
  tool_name: string
  created_at: number
}

export function allowToolForProject(projectId: string, toolName: string): void {
  getDb()
    .prepare(
      `INSERT INTO tool_allowlist (project_id, tool_name, created_at) VALUES (?, ?, ?)
       ON CONFLICT(project_id, tool_name) DO NOTHING`
    )
    .run(projectId, toolName, Date.now())
}

export function isToolAllowedForProject(projectId: string, toolName: string): boolean {
  const row = getDb()
    .prepare('SELECT 1 AS ok FROM tool_allowlist WHERE project_id = ? AND tool_name = ?')
    .get(projectId, toolName) as { ok: number } | undefined
  return row !== undefined
}

export function listAllowedToolsForProject(projectId: string): AllowedTool[] {
  const rows = getDb()
    .prepare('SELECT * FROM tool_allowlist WHERE project_id = ? ORDER BY tool_name ASC')
    .all(projectId) as unknown as AllowedToolRow[]
  return rows.map((row) => ({ projectId: row.project_id, toolName: row.tool_name, createdAt: row.created_at }))
}

export function revokeToolForProject(projectId: string, toolName: string): boolean {
  const result = getDb()
    .prepare('DELETE FROM tool_allowlist WHERE project_id = ? AND tool_name = ?')
    .run(projectId, toolName)
  return Number(result.changes) > 0
}
