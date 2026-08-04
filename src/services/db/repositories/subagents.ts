import type { DatabaseSync } from 'node:sqlite'
import { randomUUID } from 'crypto'

export type SubagentProvider = 'claude' | 'codex' | 'kimi' | 'inherit'

export interface Subagent {
  id: string
  name: string
  description: string
  prompt: string
  provider: SubagentProvider
  model: string | null
  reasoningLevel: string | null
  tools: string[] | null
  category: string | null
  idleTimeoutMinutes: number | null
  enabled: boolean
  createdAt: number
  updatedAt: number
}

export interface SubagentLinkState extends Omit<Subagent, 'prompt'> {
  linked: boolean
  enabledInProject: boolean | null
  sortOrder: number | null
}

export type SubagentRunStatus = 'running' | 'completed' | 'cancelled' | 'error' | 'timeout'

export interface SubagentRun {
  childThreadId: string
  parentThreadId: string
  parentToolCallId: string | null
  subagentName: string
  provider: string
  model: string | null
  status: SubagentRunStatus
  text: string | null
  durationMs: number | null
  reasoningLevel: string | null
  actionCount: number
  createdAt: number
}

export interface SubagentInput {
  name: string
  description: string
  prompt: string
  provider: SubagentProvider
  model?: string | null
  reasoningLevel?: string | null
  tools?: string[] | null
  category?: string | null
  idleTimeoutMinutes?: number | null
  enabled?: boolean
}

export type SubagentPatch = Partial<SubagentInput>

export interface ProjectLinkPatch {
  enabled?: boolean
  sortOrder?: number
}

export interface CatalogOrderItem {
  id: string
  enabled: boolean
  sortOrder: number
}

export interface CreateRunInput {
  childThreadId: string
  parentThreadId: string
  parentToolCallId?: string | null
  subagentName: string
  provider: string
  model?: string | null
  status: SubagentRunStatus
  text?: string | null
  reasoningLevel?: string | null
}

export interface RunPatch {
  status?: SubagentRunStatus
  text?: string | null
  usageJson?: string | null
  durationMs?: number | null
  actionCount?: number
  actionsJson?: string | null
}

export class SubagentValidationError extends Error {}
export class SubagentTooLongError extends Error {}
export class SubagentNameConflictError extends Error {}
export class SubagentNotFoundError extends Error {}
export class CatalogOrderError extends Error {}

const PROVIDERS: readonly SubagentProvider[] = ['claude', 'codex', 'kimi', 'inherit']
export const SUBAGENT_PROMPT_MAX_BYTES = 1_048_576

export function isValidProvider(value: unknown): value is SubagentProvider {
  return typeof value === 'string' && (PROVIDERS as readonly string[]).includes(value)
}

export function promptExceedsLimit(prompt: string): boolean {
  return Buffer.byteLength(prompt, 'utf-8') > SUBAGENT_PROMPT_MAX_BYTES
}

function isUniqueConstraintError(err: unknown): boolean {
  return err instanceof Error && /UNIQUE constraint failed/i.test(err.message)
}

function serializeTools(tools: string[] | null | undefined): string | null {
  if (tools === undefined || tools === null) return null
  return JSON.stringify(tools)
}

function deserializeTools(json: unknown): string[] | null {
  if (typeof json !== 'string') return null
  return JSON.parse(json) as string[]
}

interface SubagentRow {
  id: string
  name: string
  description: string
  prompt: string
  provider: string
  model: string | null
  reasoning_level: string | null
  tools_json: string | null
  idle_timeout_minutes: number | null
  category: string | null
  enabled: number
  created_at: number
  updated_at: number
}

function rowToSubagent(row: SubagentRow): Subagent {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    prompt: row.prompt,
    provider: row.provider as SubagentProvider,
    model: row.model,
    reasoningLevel: row.reasoning_level,
    tools: deserializeTools(row.tools_json),
    category: row.category,
    idleTimeoutMinutes: row.idle_timeout_minutes,
    enabled: Boolean(row.enabled),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

interface RunRow {
  child_thread_id: string
  parent_thread_id: string
  parent_tool_call_id: string | null
  subagent_name: string
  provider: string
  model: string | null
  status: string
  text: string | null
  duration_ms: number | null
  reasoning_level: string | null
  action_count: number
  created_at: number
}

function rowToRun(row: RunRow): SubagentRun {
  return {
    childThreadId: row.child_thread_id,
    parentThreadId: row.parent_thread_id,
    parentToolCallId: row.parent_tool_call_id,
    subagentName: row.subagent_name,
    provider: row.provider,
    model: row.model,
    status: row.status as SubagentRunStatus,
    text: row.text,
    durationMs: row.duration_ms,
    reasoningLevel: row.reasoning_level,
    actionCount: row.action_count,
    createdAt: row.created_at,
  }
}

function validateInput(input: SubagentPatch, opts: { partial: boolean }): void {
  if (!opts.partial || input.name !== undefined) {
    if (typeof input.name !== 'string' || input.name.trim().length === 0) {
      throw new SubagentValidationError('name é obrigatório.')
    }
  }
  if (!opts.partial || input.description !== undefined) {
    if (typeof input.description !== 'string' || input.description.trim().length === 0) {
      throw new SubagentValidationError('description é obrigatório.')
    }
  }
  if (!opts.partial || input.prompt !== undefined) {
    if (typeof input.prompt !== 'string' || input.prompt.length === 0) {
      throw new SubagentValidationError('prompt é obrigatório.')
    }
    if (promptExceedsLimit(input.prompt)) {
      throw new SubagentTooLongError('prompt acima de 1 MiB.')
    }
  }
  if (!opts.partial || input.provider !== undefined) {
    if (!isValidProvider(input.provider)) {
      throw new SubagentValidationError('provider inválido.')
    }
  }
  if (input.idleTimeoutMinutes !== undefined && input.idleTimeoutMinutes !== null) {
    if (
      !Number.isInteger(input.idleTimeoutMinutes) ||
      input.idleTimeoutMinutes < 1 ||
      input.idleTimeoutMinutes > 480
    ) {
      throw new SubagentValidationError('idleTimeoutMinutes deve ser 1..480 ou null.')
    }
  }
}

export function createSubagentsRepository(db: DatabaseSync) {
  function getById(id: string): Subagent | undefined {
    const row = db.prepare('SELECT * FROM subagents WHERE id = ?').get(id) as SubagentRow | undefined
    return row ? rowToSubagent(row) : undefined
  }

  function getByName(name: string): Subagent | undefined {
    const row = db.prepare('SELECT * FROM subagents WHERE name = ?').get(name) as SubagentRow | undefined
    return row ? rowToSubagent(row) : undefined
  }

  function list(): Subagent[] {
    const rows = db.prepare('SELECT * FROM subagents ORDER BY name COLLATE NOCASE').all() as unknown as SubagentRow[]
    return rows.map(rowToSubagent)
  }

  function create(input: SubagentInput): Subagent {
    validateInput(input, { partial: false })
    const now = Date.now()
    const id = randomUUID()
    try {
      db.prepare(
        `INSERT INTO subagents
          (id, name, description, prompt, provider, model, reasoning_level, tools_json, idle_timeout_minutes, category, enabled, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        id,
        input.name,
        input.description,
        input.prompt,
        input.provider,
        input.model ?? null,
        input.reasoningLevel ?? null,
        serializeTools(input.tools),
        input.idleTimeoutMinutes ?? null,
        input.category ?? null,
        input.enabled ?? true ? 1 : 0,
        now,
        now
      )
    } catch (err) {
      if (isUniqueConstraintError(err)) {
        throw new SubagentNameConflictError(`Já existe um subagent com o nome "${input.name}".`)
      }
      throw err
    }
    return getById(id) as Subagent
  }

  function update(id: string, patch: SubagentPatch): Subagent {
    const existing = getById(id)
    if (!existing) {
      throw new SubagentNotFoundError(`Subagent ${id} não encontrado.`)
    }
    validateInput(patch, { partial: true })

    const merged: SubagentInput = {
      name: patch.name ?? existing.name,
      description: patch.description ?? existing.description,
      prompt: patch.prompt ?? existing.prompt,
      provider: patch.provider ?? existing.provider,
      model: patch.model !== undefined ? patch.model : existing.model,
      reasoningLevel: patch.reasoningLevel !== undefined ? patch.reasoningLevel : existing.reasoningLevel,
      tools: patch.tools !== undefined ? patch.tools : existing.tools,
      category: patch.category !== undefined ? patch.category : existing.category,
      idleTimeoutMinutes:
        patch.idleTimeoutMinutes !== undefined ? patch.idleTimeoutMinutes : existing.idleTimeoutMinutes,
      enabled: patch.enabled !== undefined ? patch.enabled : existing.enabled,
    }

    try {
      db.prepare(
        `UPDATE subagents SET
          name = ?, description = ?, prompt = ?, provider = ?, model = ?, reasoning_level = ?,
          tools_json = ?, idle_timeout_minutes = ?, category = ?, enabled = ?, updated_at = ?
         WHERE id = ?`
      ).run(
        merged.name,
        merged.description,
        merged.prompt,
        merged.provider,
        merged.model ?? null,
        merged.reasoningLevel ?? null,
        serializeTools(merged.tools),
        merged.idleTimeoutMinutes ?? null,
        merged.category ?? null,
        merged.enabled ?? true ? 1 : 0,
        Date.now(),
        id
      )
    } catch (err) {
      if (isUniqueConstraintError(err)) {
        throw new SubagentNameConflictError(`Já existe um subagent com o nome "${merged.name}".`)
      }
      throw err
    }
    return getById(id) as Subagent
  }

  function remove(id: string): boolean {
    const result = db.prepare('DELETE FROM subagents WHERE id = ?').run(id)
    return Number(result.changes) > 0
  }

  function getLinkState(projectId: string, subagentId: string): SubagentLinkState {
    const row = db
      .prepare(
        `SELECT s.*, ps.project_id AS link_project_id, ps.enabled AS link_enabled, ps.sort_order AS link_sort_order
         FROM subagents s
         LEFT JOIN project_subagents ps ON ps.subagent_id = s.id AND ps.project_id = ?
         WHERE s.id = ?`
      )
      .get(projectId, subagentId) as
      | (SubagentRow & { link_project_id: string | null; link_enabled: number | null; link_sort_order: number | null })
      | undefined
    if (!row) throw new SubagentNotFoundError(`Subagent ${subagentId} não encontrado.`)
    const linked = row.link_project_id !== null
    const { prompt: _prompt, ...rest } = rowToSubagent(row)
    return {
      ...rest,
      linked,
      enabledInProject: linked ? Boolean(row.link_enabled) : null,
      sortOrder: linked ? row.link_sort_order : null,
    }
  }

  function listProjectSubagents(projectId: string): SubagentLinkState[] {
    const rows = db
      .prepare(
        `SELECT s.*, ps.project_id AS link_project_id, ps.enabled AS link_enabled, ps.sort_order AS link_sort_order
         FROM subagents s
         LEFT JOIN project_subagents ps ON ps.subagent_id = s.id AND ps.project_id = ?
         ORDER BY s.name COLLATE NOCASE`
      )
      .all(projectId) as unknown as (SubagentRow & {
      link_project_id: string | null
      link_enabled: number | null
      link_sort_order: number | null
    })[]

    return rows.map((row) => {
      const linked = row.link_project_id !== null
      const { prompt: _prompt, ...rest } = rowToSubagent(row)
      return {
        ...rest,
        linked,
        enabledInProject: linked ? Boolean(row.link_enabled) : null,
        sortOrder: linked ? row.link_sort_order : null,
      }
    })
  }

  function getMaxSortOrder(projectId: string): number {
    const row = db
      .prepare('SELECT MAX(sort_order) as m FROM project_subagents WHERE project_id = ?')
      .get(projectId) as { m: number | null }
    return row.m == null ? -1 : row.m
  }

  function upsertProjectLink(projectId: string, subagentId: string, patch: ProjectLinkPatch): SubagentLinkState {
    if (!getById(subagentId)) {
      throw new SubagentNotFoundError(`Subagent ${subagentId} não encontrado.`)
    }
    const existing = db
      .prepare('SELECT * FROM project_subagents WHERE project_id = ? AND subagent_id = ?')
      .get(projectId, subagentId) as { enabled: number; sort_order: number } | undefined

    if (!existing) {
      const sortOrder = patch.sortOrder ?? getMaxSortOrder(projectId) + 1
      const enabled = patch.enabled ?? true
      db.prepare(
        'INSERT INTO project_subagents (project_id, subagent_id, enabled, sort_order, created_at) VALUES (?, ?, ?, ?, ?)'
      ).run(projectId, subagentId, enabled ? 1 : 0, sortOrder, Date.now())
    } else {
      const enabled = patch.enabled ?? Boolean(existing.enabled)
      const sortOrder = patch.sortOrder ?? existing.sort_order
      db.prepare(
        'UPDATE project_subagents SET enabled = ?, sort_order = ? WHERE project_id = ? AND subagent_id = ?'
      ).run(enabled ? 1 : 0, sortOrder, projectId, subagentId)
    }

    return getLinkState(projectId, subagentId)
  }

  function unlinkProject(projectId: string, subagentId: string): boolean {
    const result = db
      .prepare('DELETE FROM project_subagents WHERE project_id = ? AND subagent_id = ?')
      .run(projectId, subagentId)
    return Number(result.changes) > 0
  }

  function setCatalogOrder(projectId: string, items: CatalogOrderItem[]): SubagentLinkState[] {
    const linkedRows = db
      .prepare('SELECT subagent_id FROM project_subagents WHERE project_id = ?')
      .all(projectId) as { subagent_id: string }[]
    const linkedIds = new Set(linkedRows.map((r) => r.subagent_id))

    if (items.length !== linkedIds.size) {
      throw new CatalogOrderError('catalog-order deve incluir todos os subagents vinculados ao projeto.')
    }
    const seenOrders = new Set<number>()
    for (const item of items) {
      if (!linkedIds.has(item.id)) {
        throw new CatalogOrderError(`Subagent ${item.id} não está vinculado a este projeto.`)
      }
      seenOrders.add(item.sortOrder)
    }
    if (seenOrders.size !== items.length) {
      throw new CatalogOrderError('sortOrder deve ser contíguo e único (0..N-1).')
    }
    for (let i = 0; i < items.length; i++) {
      if (!seenOrders.has(i)) {
        throw new CatalogOrderError('sortOrder deve ser contíguo e único (0..N-1).')
      }
    }

    db.exec('BEGIN')
    try {
      for (const item of items) {
        db.prepare(
          'UPDATE project_subagents SET enabled = ?, sort_order = ? WHERE project_id = ? AND subagent_id = ?'
        ).run(item.enabled ? 1 : 0, item.sortOrder, projectId, item.id)
      }
      db.exec('COMMIT')
    } catch (err) {
      db.exec('ROLLBACK')
      throw err
    }

    return listProjectSubagents(projectId).filter((s) => s.linked)
  }

  function getCounts(): { global: number; linkedByProject: Record<string, number> } {
    const global = (db.prepare('SELECT COUNT(*) as c FROM subagents').get() as { c: number }).c
    const rows = db
      .prepare('SELECT project_id, COUNT(*) as c FROM project_subagents GROUP BY project_id')
      .all() as { project_id: string; c: number }[]
    const linkedByProject: Record<string, number> = {}
    for (const row of rows) linkedByProject[row.project_id] = row.c
    return { global, linkedByProject }
  }

  function resolveTurnCatalog(projectId: string): Subagent[] {
    const rows = db
      .prepare(
        `SELECT s.* FROM subagents s
         JOIN project_subagents ps ON ps.subagent_id = s.id
         WHERE ps.project_id = ? AND ps.enabled = 1 AND s.enabled = 1
         ORDER BY ps.sort_order ASC`
      )
      .all(projectId) as unknown as SubagentRow[]
    return rows.map(rowToSubagent)
  }

  function createRun(input: CreateRunInput): SubagentRun {
    db.prepare(
      `INSERT INTO subagent_runs
        (child_thread_id, parent_thread_id, parent_tool_call_id, subagent_name, provider, model, status, text, reasoning_level, action_count, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`
    ).run(
      input.childThreadId,
      input.parentThreadId,
      input.parentToolCallId ?? null,
      input.subagentName,
      input.provider,
      input.model ?? null,
      input.status,
      input.text ?? null,
      input.reasoningLevel ?? null,
      Date.now()
    )
    return getRun(input.childThreadId) as SubagentRun
  }

  function getRun(childThreadId: string): SubagentRun | undefined {
    const row = db.prepare('SELECT * FROM subagent_runs WHERE child_thread_id = ?').get(childThreadId) as
      | RunRow
      | undefined
    return row ? rowToRun(row) : undefined
  }

  function updateRun(childThreadId: string, patch: RunPatch): SubagentRun | undefined {
    const existing = getRun(childThreadId)
    if (!existing) return undefined
    db.prepare(
      `UPDATE subagent_runs SET
        status = ?, text = ?, usage_json = ?, duration_ms = ?, action_count = ?, actions_json = ?
       WHERE child_thread_id = ?`
    ).run(
      patch.status ?? existing.status,
      patch.text !== undefined ? patch.text : existing.text,
      patch.usageJson ?? null,
      patch.durationMs !== undefined ? patch.durationMs : existing.durationMs,
      patch.actionCount !== undefined ? patch.actionCount : existing.actionCount,
      patch.actionsJson ?? null,
      childThreadId
    )
    return getRun(childThreadId)
  }

  function listRunsForParentThread(parentThreadId: string): SubagentRun[] {
    const rows = db
      .prepare('SELECT * FROM subagent_runs WHERE parent_thread_id = ? ORDER BY created_at ASC')
      .all(parentThreadId) as unknown as RunRow[]
    return rows.map(rowToRun)
  }

  return {
    getById,
    getByName,
    list,
    create,
    update,
    remove,
    listProjectSubagents,
    upsertProjectLink,
    unlinkProject,
    setCatalogOrder,
    getCounts,
    resolveTurnCatalog,
    createRun,
    getRun,
    updateRun,
    listRunsForParentThread,
  }
}

export type SubagentsRepository = ReturnType<typeof createSubagentsRepository>
