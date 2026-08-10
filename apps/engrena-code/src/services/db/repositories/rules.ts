import { randomUUID } from 'crypto'
import { getDb } from '../client.js'

export const MAX_CONTENT_BYTES = 1024 * 1024

export interface Rule {
  id: string
  name: string
  description: string | null
  content: string
  category: string | null
  isGlobal: boolean
  enabled: boolean
  createdAt: number
  updatedAt: number
}

export interface RuleLinkState extends Omit<Rule, 'content'> {
  linked: boolean
  activeInProject: boolean
  suppressedHere: boolean
  enabledInProject: boolean | null
  sortOrder: number | null
  /** Byte length of the omitted content, for the project overlay's KB aggregate footer. */
  contentBytes: number
}

interface RuleWithLinkState extends Rule {
  linked: boolean
  activeInProject: boolean
  suppressedHere: boolean
  enabledInProject: boolean | null
  sortOrder: number | null
}

export class RuleError extends Error {
  code: string

  constructor(code: string, message: string) {
    super(message)
    this.code = code
  }
}

interface RuleRow {
  id: string
  name: string
  description: string | null
  content: string
  category: string | null
  is_global: number
  enabled: number
  created_at: number
  updated_at: number
}

interface RuleLinkRow extends RuleRow {
  link_enabled: number | null
  link_sort_order: number | null
}

function toRule(row: RuleRow): Rule {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    content: row.content,
    category: row.category,
    isGlobal: row.is_global === 1,
    enabled: row.enabled === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function toRuleWithLinkState(row: RuleLinkRow): RuleWithLinkState {
  const rule = toRule(row)
  const hasLink = row.link_enabled !== null
  const linkEnabled = row.link_enabled === 1
  const linked = rule.isGlobal ? true : hasLink
  const activeInProject = rule.isGlobal ? !hasLink || linkEnabled : hasLink && linkEnabled
  const suppressedHere = rule.isGlobal && hasLink && !linkEnabled

  return {
    ...rule,
    linked,
    activeInProject,
    suppressedHere,
    enabledInProject: hasLink ? linkEnabled : null,
    sortOrder: hasLink ? row.link_sort_order : null,
  }
}

function stripContent(rule: RuleWithLinkState): RuleLinkState {
  const { content, ...rest } = rule
  return { ...rest, contentBytes: Buffer.byteLength(content, 'utf-8') }
}

function isControlOrNewline(value: string): boolean {
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i)
    if (code === 10 || code === 13) return true
    if (code < 32 && code !== 9) return true
  }
  return false
}

export function validateRuleName(name: string): void {
  if (name.trim() === '') {
    throw new RuleError('validation_error', 'Nome é obrigatório.')
  }
  if (isControlOrNewline(name)) {
    throw new RuleError('invalid_request', 'O nome não pode conter quebras de linha ou caracteres de controle.')
  }
}

export function validateRuleContent(content: string): void {
  if (content.trim() === '') {
    throw new RuleError('validation_error', 'Conteúdo é obrigatório.')
  }
  if (Buffer.byteLength(content, 'utf-8') > MAX_CONTENT_BYTES) {
    throw new RuleError('too_long', 'Conteúdo acima de 1 MiB. Reduza o tamanho para salvar.')
  }
}

function mapUniqueViolation(err: unknown): never {
  if (err instanceof Error && /UNIQUE constraint failed/.test(err.message)) {
    throw new RuleError('rule_name_conflict', 'Já existe uma rule com este nome. Escolha outro.')
  }
  throw err
}

// ── CRUD ─────────────────────────────────────────────────────────────────────

export interface CreateRuleInput {
  name: string
  description?: string | null
  content: string
  category?: string | null
  isGlobal?: boolean
  enabled?: boolean
}

export interface UpdateRuleInput {
  name?: string
  description?: string | null
  content?: string
  category?: string | null
  isGlobal?: boolean
  enabled?: boolean
}

export function listRules(): Rule[] {
  const rows = getDb().prepare('SELECT * FROM rules ORDER BY name ASC').all() as unknown as RuleRow[]
  return rows.map(toRule)
}

export function getRule(id: string): Rule | null {
  const row = getDb().prepare('SELECT * FROM rules WHERE id = ?').get(id) as RuleRow | undefined
  return row === undefined ? null : toRule(row)
}

export function createRule(input: CreateRuleInput): Rule {
  validateRuleName(input.name)
  validateRuleContent(input.content)

  const now = Date.now()
  const id = randomUUID()
  const description = input.description?.trim() ? input.description : null
  const category = input.category?.trim() ? input.category : null

  try {
    getDb()
      .prepare(
        `INSERT INTO rules (id, name, description, content, category, is_global, enabled, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        id,
        input.name,
        description,
        input.content,
        category,
        input.isGlobal === true ? 1 : 0,
        input.enabled === false ? 0 : 1,
        now,
        now
      )
  } catch (err) {
    mapUniqueViolation(err)
  }

  return getRule(id) as Rule
}

export function updateRule(id: string, patch: UpdateRuleInput): Rule | null {
  const existing = getRule(id)
  if (existing === null) return null

  if (patch.name !== undefined) validateRuleName(patch.name)
  if (patch.content !== undefined) validateRuleContent(patch.content)

  const next = {
    name: patch.name ?? existing.name,
    description:
      patch.description !== undefined ? (patch.description?.trim() ? patch.description : null) : existing.description,
    content: patch.content ?? existing.content,
    category: patch.category !== undefined ? (patch.category?.trim() ? patch.category : null) : existing.category,
    isGlobal: patch.isGlobal ?? existing.isGlobal,
    enabled: patch.enabled ?? existing.enabled,
  }

  try {
    getDb()
      .prepare(
        `UPDATE rules SET name = ?, description = ?, content = ?, category = ?, is_global = ?, enabled = ?, updated_at = ?
         WHERE id = ?`
      )
      .run(next.name, next.description, next.content, next.category, next.isGlobal ? 1 : 0, next.enabled ? 1 : 0, Date.now(), id)
  } catch (err) {
    mapUniqueViolation(err)
  }

  return getRule(id)
}

export function deleteRule(id: string): boolean {
  const result = getDb().prepare('DELETE FROM rules WHERE id = ?').run(id)
  return Number(result.changes) > 0
}

// ── Project link / override ────────────────────────────────────────────────

export interface ProjectRuleLinkInput {
  enabled?: boolean
  sortOrder?: number
}

function listProjectRulesInternal(projectId: string): RuleWithLinkState[] {
  const rows = getDb()
    .prepare(
      `SELECT r.*, pr.enabled as link_enabled, pr.sort_order as link_sort_order
       FROM rules r
       LEFT JOIN project_rules pr ON pr.rule_id = r.id AND pr.project_id = ?
       ORDER BY r.is_global DESC, r.name ASC`
    )
    .all(projectId) as unknown as RuleLinkRow[]

  return rows.map(toRuleWithLinkState)
}

export function listProjectRules(projectId: string): RuleLinkState[] {
  return listProjectRulesInternal(projectId).map(stripContent)
}

export function setProjectRuleLink(projectId: string, ruleId: string, input: ProjectRuleLinkInput): RuleLinkState {
  const rule = getRule(ruleId)
  if (rule === null) throw new RuleError('rule_not_found', 'Rule não encontrada.')

  const db = getDb()
  const now = Date.now()

  if (rule.isGlobal) {
    if (input.enabled === false) {
      db.prepare(
        `INSERT INTO project_rules (project_id, rule_id, enabled, sort_order, created_at)
         VALUES (?, ?, 0, ?, ?)
         ON CONFLICT(project_id, rule_id) DO UPDATE SET enabled = 0`
      ).run(projectId, ruleId, input.sortOrder ?? 0, now)
    } else {
      db.prepare('DELETE FROM project_rules WHERE project_id = ? AND rule_id = ?').run(projectId, ruleId)
    }
  } else {
    const enabled = input.enabled ?? true
    const existing = db
      .prepare('SELECT sort_order FROM project_rules WHERE project_id = ? AND rule_id = ?')
      .get(projectId, ruleId) as { sort_order: number } | undefined
    const sortOrder = input.sortOrder ?? existing?.sort_order ?? 0

    db.prepare(
      `INSERT INTO project_rules (project_id, rule_id, enabled, sort_order, created_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(project_id, rule_id) DO UPDATE SET enabled = excluded.enabled, sort_order = excluded.sort_order`
    ).run(projectId, ruleId, enabled ? 1 : 0, sortOrder, now)
  }

  const state = listProjectRulesInternal(projectId).find((r) => r.id === ruleId)
  return stripContent(state as RuleWithLinkState)
}

export function unlinkProjectRule(projectId: string, ruleId: string): boolean {
  const result = getDb().prepare('DELETE FROM project_rules WHERE project_id = ? AND rule_id = ?').run(projectId, ruleId)
  return Number(result.changes) > 0
}

// ── Runtime resolution ───────────────────────────────────────────────────────

export function resolveForTurn(projectId: string): Rule[] {
  const active = listProjectRulesInternal(projectId).filter((r) => r.enabled && r.activeInProject)

  const globals = active
    .filter((r) => r.isGlobal)
    .sort((a, b) => a.name.localeCompare(b.name))

  const projectOnly = active
    .filter((r) => !r.isGlobal)
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name))

  return [...globals, ...projectOnly].map(({ linked: _linked, activeInProject: _a, suppressedHere: _s, enabledInProject: _e, sortOrder: _so, ...rule }) => rule)
}

// ── Counts (F04) ─────────────────────────────────────────────────────────────

export function getCounts(): { global: number; activeByProject: Record<string, number> } {
  const db = getDb()
  const globalRow = db.prepare('SELECT COUNT(*) as c FROM rules WHERE is_global = 1 AND enabled = 1').get() as { c: number }

  const projectIds = (
    db.prepare('SELECT DISTINCT project_id FROM project_rules').all() as Array<{ project_id: string }>
  ).map((r) => r.project_id)

  const activeByProject: Record<string, number> = {}
  for (const projectId of projectIds) {
    activeByProject[projectId] = resolveForTurn(projectId).length
  }

  return { global: globalRow.c, activeByProject }
}
