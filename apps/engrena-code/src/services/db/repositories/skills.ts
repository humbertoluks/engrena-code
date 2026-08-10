import { existsSync, mkdirSync, readFileSync, renameSync } from 'fs'
import { join } from 'path'
import { randomUUID } from 'crypto'
import { app } from 'electron'
import { getDb } from '../client.js'

export const CONTENT_MAX_BYTES = 1_048_576

export interface Skill {
  id: string
  name: string
  description: string
  content: string
  category: string | null
  enabled: boolean
  createdAt: number
  updatedAt: number
}

export interface SkillLinkState extends Omit<Skill, 'content'> {
  linked: boolean
  enabledInProject: boolean | null
  sortOrder: number | null
}

export interface ProjectSkillLink {
  projectId: string
  skillId: string
  enabled: boolean
  sortOrder: number
  createdAt: number
}

export interface SkillCreateInput {
  name: string
  description: string
  content: string
  category?: string | null
  enabled?: boolean
}

export type SkillUpdateInput = Partial<SkillCreateInput>

export interface SkillCounts {
  global: number
  linkedByProject: Record<string, number>
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ValidationError'
  }
}

export class ContentTooLongError extends Error {
  constructor() {
    super('Content excede o teto de 1 MiB.')
    this.name = 'ContentTooLongError'
  }
}

export class SkillNameConflictError extends Error {
  constructor() {
    super('Já existe uma skill com este nome.')
    this.name = 'SkillNameConflictError'
  }
}

export class SkillNotFoundError extends Error {
  constructor() {
    super('Skill não encontrada.')
    this.name = 'SkillNotFoundError'
  }
}

interface SkillRow {
  id: string
  name: string
  description: string
  content: string
  category: string | null
  enabled: number
  created_at: number
  updated_at: number
}

interface SkillLinkRow extends SkillRow {
  link_enabled: number | null
  link_sort_order: number | null
}

interface LegacySkillsJson {
  skills?: Array<{
    id: string
    name: string
    description: string
    content: string
    category: string | null
    enabled: boolean
    createdAt: number
    updatedAt: number
  }>
  projectSkills?: Array<{
    projectId: string
    skillId: string
    enabled: boolean
    sortOrder: number
    createdAt: number
  }>
}

function toSkill(row: SkillRow): Skill {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    content: row.content,
    category: row.category,
    enabled: row.enabled === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function toSkillLinkState(row: SkillLinkRow): SkillLinkState {
  const skill = toSkill(row)
  const { content: _content, ...summary } = skill
  const hasLink = row.link_enabled !== null
  return {
    ...summary,
    linked: hasLink,
    enabledInProject: hasLink ? row.link_enabled === 1 : null,
    sortOrder: hasLink ? row.link_sort_order : null,
  }
}

function contentByteLength(content: string): number {
  return Buffer.byteLength(content, 'utf-8')
}

function validateCreate(input: SkillCreateInput): void {
  if (!input.name || input.name.trim() === '') {
    throw new ValidationError('Nome é obrigatório.')
  }
  if (!input.description || input.description.trim() === '') {
    throw new ValidationError('Descrição é obrigatória.')
  }
  if (!input.content || input.content.trim() === '') {
    throw new ValidationError('Conteúdo é obrigatório.')
  }
  if (contentByteLength(input.content) > CONTENT_MAX_BYTES) {
    throw new ContentTooLongError()
  }
}

function mapUniqueViolation(err: unknown): never {
  if (err instanceof Error && /UNIQUE constraint failed/.test(err.message)) {
    throw new SkillNameConflictError()
  }
  throw err
}

function resolveUserData(): string {
  const override = process.env.ENGRENACODE_USER_DATA
  if (override) {
    mkdirSync(override, { recursive: true })
    return override
  }
  return app.getPath('userData')
}

// ── Migração única do skills.json legado (A01 — dívida R-skills-json-outside-sqlite) ──

let legacyMigrationChecked = false

/** Importa skills.json legado pra tabela `skills`/`project_skills` uma única vez por processo. */
function ensureLegacyJsonMigrated(): void {
  if (legacyMigrationChecked) return
  legacyMigrationChecked = true

  const legacyPath = join(resolveUserData(), 'skills.json')
  if (!existsSync(legacyPath)) return

  const db = getDb()
  const { c: existingCount } = db.prepare('SELECT COUNT(*) as c FROM skills').get() as { c: number }
  if (existingCount > 0) {
    renameSync(legacyPath, `${legacyPath}.migrated`)
    return
  }

  let legacy: LegacySkillsJson
  try {
    legacy = JSON.parse(readFileSync(legacyPath, 'utf-8')) as LegacySkillsJson
  } catch {
    renameSync(legacyPath, `${legacyPath}.corrupted`)
    return
  }

  const insertSkill = db.prepare(
    `INSERT INTO skills (id, name, description, content, category, enabled, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  )
  const insertLink = db.prepare(
    `INSERT INTO project_skills (project_id, skill_id, enabled, sort_order, created_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(project_id, skill_id) DO NOTHING`
  )

  for (const skill of legacy.skills ?? []) {
    insertSkill.run(
      skill.id,
      skill.name,
      skill.description,
      skill.content,
      skill.category ?? null,
      skill.enabled ? 1 : 0,
      skill.createdAt,
      skill.updatedAt
    )
  }
  for (const link of legacy.projectSkills ?? []) {
    insertLink.run(link.projectId, link.skillId, link.enabled ? 1 : 0, link.sortOrder, link.createdAt)
  }

  renameSync(legacyPath, `${legacyPath}.migrated`)
}

// ── CRUD ─────────────────────────────────────────────────────────────────────

export function listSkills(): Skill[] {
  ensureLegacyJsonMigrated()
  const rows = getDb().prepare('SELECT * FROM skills ORDER BY name ASC').all() as unknown as SkillRow[]
  return rows.map(toSkill)
}

export function getSkill(id: string): Skill | null {
  ensureLegacyJsonMigrated()
  const row = getDb().prepare('SELECT * FROM skills WHERE id = ?').get(id) as SkillRow | undefined
  return row === undefined ? null : toSkill(row)
}

export function createSkill(input: SkillCreateInput): Skill {
  ensureLegacyJsonMigrated()
  validateCreate(input)

  const now = Date.now()
  const id = randomUUID()

  try {
    getDb()
      .prepare(
        `INSERT INTO skills (id, name, description, content, category, enabled, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(id, input.name, input.description, input.content, input.category ?? null, input.enabled === false ? 0 : 1, now, now)
  } catch (err) {
    mapUniqueViolation(err)
  }

  return getSkill(id) as Skill
}

export function updateSkill(id: string, patch: SkillUpdateInput): Skill {
  ensureLegacyJsonMigrated()
  const existing = getSkill(id)
  if (existing === null) throw new SkillNotFoundError()

  if (patch.name !== undefined && patch.name.trim() === '') {
    throw new ValidationError('Nome é obrigatório.')
  }
  if (patch.description !== undefined && patch.description.trim() === '') {
    throw new ValidationError('Descrição é obrigatória.')
  }
  if (patch.content !== undefined) {
    if (patch.content.trim() === '') throw new ValidationError('Conteúdo é obrigatório.')
    if (contentByteLength(patch.content) > CONTENT_MAX_BYTES) throw new ContentTooLongError()
  }

  const next = {
    name: patch.name ?? existing.name,
    description: patch.description ?? existing.description,
    content: patch.content ?? existing.content,
    category: patch.category !== undefined ? patch.category : existing.category,
    enabled: patch.enabled ?? existing.enabled,
  }

  try {
    getDb()
      .prepare(
        `UPDATE skills SET name = ?, description = ?, content = ?, category = ?, enabled = ?, updated_at = ?
         WHERE id = ?`
      )
      .run(next.name, next.description, next.content, next.category, next.enabled ? 1 : 0, Date.now(), id)
  } catch (err) {
    mapUniqueViolation(err)
  }

  return getSkill(id) as Skill
}

export function deleteSkill(id: string): void {
  ensureLegacyJsonMigrated()
  const result = getDb().prepare('DELETE FROM skills WHERE id = ?').run(id)
  if (Number(result.changes) === 0) throw new SkillNotFoundError()
}

// ── Project link ─────────────────────────────────────────────────────────────

export function getSkillCounts(): SkillCounts {
  ensureLegacyJsonMigrated()
  const db = getDb()
  const { c: global } = db.prepare('SELECT COUNT(*) as c FROM skills').get() as { c: number }
  const projectIds = (
    db.prepare('SELECT DISTINCT project_id FROM project_skills').all() as Array<{ project_id: string }>
  ).map((r) => r.project_id)

  const linkedByProject: Record<string, number> = {}
  for (const projectId of projectIds) {
    const { c } = db
      .prepare('SELECT COUNT(*) as c FROM project_skills WHERE project_id = ?')
      .get(projectId) as { c: number }
    linkedByProject[projectId] = c
  }

  return { global, linkedByProject }
}

function listProjectSkillsInternal(projectId: string): SkillLinkRow[] {
  return getDb()
    .prepare(
      `SELECT s.*, ps.enabled as link_enabled, ps.sort_order as link_sort_order
       FROM skills s
       LEFT JOIN project_skills ps ON ps.skill_id = s.id AND ps.project_id = ?
       ORDER BY s.name ASC`
    )
    .all(projectId) as unknown as SkillLinkRow[]
}

export function listProjectSkills(projectId: string): SkillLinkState[] {
  ensureLegacyJsonMigrated()
  return listProjectSkillsInternal(projectId).map(toSkillLinkState)
}

export function linkSkill(
  projectId: string,
  skillId: string,
  patch: { enabled?: boolean; sortOrder?: number }
): SkillLinkState {
  ensureLegacyJsonMigrated()
  const skill = getSkill(skillId)
  if (skill === null) throw new SkillNotFoundError()

  const db = getDb()
  const existing = db
    .prepare('SELECT enabled, sort_order FROM project_skills WHERE project_id = ? AND skill_id = ?')
    .get(projectId, skillId) as { enabled: number; sort_order: number } | undefined

  const enabled = patch.enabled ?? (existing ? existing.enabled === 1 : true)
  const sortOrder = patch.sortOrder ?? existing?.sort_order ?? 0

  db.prepare(
    `INSERT INTO project_skills (project_id, skill_id, enabled, sort_order, created_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(project_id, skill_id) DO UPDATE SET enabled = excluded.enabled, sort_order = excluded.sort_order`
  ).run(projectId, skillId, enabled ? 1 : 0, sortOrder, Date.now())

  const row = listProjectSkillsInternal(projectId).find((r) => r.id === skillId)
  return toSkillLinkState(row as SkillLinkRow)
}

export function unlinkSkill(projectId: string, skillId: string): void {
  ensureLegacyJsonMigrated()
  getDb().prepare('DELETE FROM project_skills WHERE project_id = ? AND skill_id = ?').run(projectId, skillId)
}

export function reorderProjectSkills(
  projectId: string,
  items: Array<{ id: string; enabled?: boolean; sortOrder: number }>
): void {
  ensureLegacyJsonMigrated()
  for (const item of items) {
    linkSkill(projectId, item.id, { enabled: item.enabled, sortOrder: item.sortOrder })
  }
}

// ── Runtime resolution ───────────────────────────────────────────────────────

export function resolveSkillsForProject(projectId: string): Skill[] {
  ensureLegacyJsonMigrated()
  const rows = getDb()
    .prepare(
      `SELECT s.*
       FROM skills s
       JOIN project_skills ps ON ps.skill_id = s.id
       WHERE ps.project_id = ? AND ps.enabled = 1 AND s.enabled = 1
       ORDER BY s.name ASC`
    )
    .all(projectId) as unknown as SkillRow[]
  return rows.map(toSkill)
}
