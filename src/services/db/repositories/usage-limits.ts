import { getDb } from '../client.js'

export type UsageLimitScope = 'global' | 'project'
export type UsageLimitMode = 'warn' | 'block'

export interface UsageLimit {
  id: string
  scope: UsageLimitScope
  projectId: string | null
  limitUsd: number
  mode: UsageLimitMode
  updatedAt: number
}

interface UsageLimitRow {
  id: string
  scope: string
  project_id: string | null
  limit_usd: number
  mode: string
  updated_at: number
}

function toUsageLimit(row: UsageLimitRow): UsageLimit {
  return {
    id: row.id,
    scope: row.scope as UsageLimitScope,
    projectId: row.project_id,
    limitUsd: row.limit_usd,
    mode: row.mode as UsageLimitMode,
    updatedAt: row.updated_at,
  }
}

/** `ulim_global` para o escopo global, `ulim_<projectId>` para projeto (spec §6) — id determinístico, upsert é idempotente. */
function idFor(scope: UsageLimitScope, projectId: string | null): string {
  return scope === 'global' ? 'ulim_global' : `ulim_${projectId}`
}

export function listUsageLimits(): UsageLimit[] {
  const rows = getDb().prepare(`SELECT * FROM usage_limits ORDER BY scope, project_id`).all() as unknown as UsageLimitRow[]
  return rows.map(toUsageLimit)
}

export function getGlobalUsageLimit(): UsageLimit | null {
  const row = getDb().prepare(`SELECT * FROM usage_limits WHERE scope = 'global'`).get() as UsageLimitRow | undefined
  return row === undefined ? null : toUsageLimit(row)
}

export function getProjectUsageLimit(projectId: string): UsageLimit | null {
  const row = getDb().prepare(`SELECT * FROM usage_limits WHERE scope = 'project' AND project_id = ?`).get(projectId) as
    | UsageLimitRow
    | undefined
  return row === undefined ? null : toUsageLimit(row)
}

export interface UpsertUsageLimitInput {
  scope: UsageLimitScope
  projectId: string | null
  limitUsd: number
  mode: UsageLimitMode
}

/** Upsert por `(scope, projectId)` — spec §5.2: um global e um por projeto, `id` determinístico garante idempotência. */
export function upsertUsageLimit(input: UpsertUsageLimitInput): UsageLimit {
  const id = idFor(input.scope, input.projectId)
  const now = Date.now()

  getDb()
    .prepare(
      `INSERT INTO usage_limits (id, scope, project_id, limit_usd, mode, updated_at)
       VALUES (@id, @scope, @projectId, @limitUsd, @mode, @updatedAt)
       ON CONFLICT(id) DO UPDATE SET limit_usd = @limitUsd, mode = @mode, updated_at = @updatedAt`
    )
    .run({ id, scope: input.scope, projectId: input.projectId, limitUsd: input.limitUsd, mode: input.mode, updatedAt: now })

  return toUsageLimit(getDb().prepare(`SELECT * FROM usage_limits WHERE id = ?`).get(id) as UsageLimitRow)
}

/** Remove o limite do escopo (spec §5.2: `limitUsd: null` = remover). No-op se não existir. */
export function clearUsageLimit(scope: UsageLimitScope, projectId: string | null): void {
  getDb().prepare(`DELETE FROM usage_limits WHERE id = ?`).run(idFor(scope, projectId))
}
