import { randomUUID } from 'node:crypto'
import { getDb } from '../client.js'
import {
  normalizeNameList,
  validateModeCatalog,
  validateModeInstructions,
  validatePromptFields,
} from '../../prompts/prompt-spec.js'

/**
 * Prompts salvos e modos de chat criados pela UI (F28 §3.4). Os que vivem em arquivo do repo
 * (`.engrena/prompts`, `.engrena/modes`) não passam por aqui — ver `prompts/prompt-files.ts`.
 */

export class PromptValidationError extends Error {
  field: string

  constructor(field: string, message: string) {
    super(message)
    this.name = 'PromptValidationError'
    this.field = field
  }
}

export class PromptNameConflictError extends Error {
  constructor(name: string) {
    super(`Já existe um item chamado "${name}" neste projeto.`)
    this.name = 'PromptNameConflictError'
  }
}

export class PromptNotFoundError extends Error {
  constructor() {
    super('Item não encontrado.')
    this.name = 'PromptNotFoundError'
  }
}

export interface SavedPrompt {
  id: string
  projectId: string
  name: string
  description: string
  body: string
  createdAt: number
  updatedAt: number
}

export interface SavedPromptInput {
  projectId: string
  name: string
  description?: string
  body: string
}

interface SavedPromptRow {
  id: string
  project_id: string
  name: string
  description: string
  body: string
  created_at: number
  updated_at: number
}

function toPrompt(row: SavedPromptRow): SavedPrompt {
  return {
    id: row.id,
    projectId: row.project_id,
    name: row.name,
    description: row.description,
    body: row.body,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function assertPromptFields(input: { name?: unknown; description?: unknown; body?: unknown }): void {
  const err = validatePromptFields(input)
  if (err !== null) throw new PromptValidationError(err.field, err.message)
}

export function listSavedPrompts(projectId: string): SavedPrompt[] {
  const rows = getDb()
    .prepare('SELECT * FROM saved_prompts WHERE project_id = ? ORDER BY name')
    .all(projectId) as unknown as SavedPromptRow[]
  return rows.map(toPrompt)
}

export function getSavedPrompt(id: string): SavedPrompt | null {
  const row = getDb().prepare('SELECT * FROM saved_prompts WHERE id = ?').get(id) as SavedPromptRow | undefined
  return row === undefined ? null : toPrompt(row)
}

export function createSavedPrompt(input: SavedPromptInput): SavedPrompt {
  assertPromptFields(input)
  const now = Date.now()
  const prompt: SavedPrompt = {
    id: randomUUID(),
    projectId: input.projectId,
    name: input.name,
    description: input.description ?? '',
    body: input.body,
    createdAt: now,
    updatedAt: now,
  }
  try {
    getDb()
      .prepare(
        `INSERT INTO saved_prompts (id, project_id, name, description, body, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(prompt.id, prompt.projectId, prompt.name, prompt.description, prompt.body, now, now)
  } catch (err) {
    if (isUniqueViolation(err)) throw new PromptNameConflictError(input.name)
    throw err
  }
  return prompt
}

export type SavedPromptPatch = Partial<Omit<SavedPromptInput, 'projectId'>>

export function updateSavedPrompt(id: string, patch: SavedPromptPatch): SavedPrompt {
  const existing = getSavedPrompt(id)
  if (existing === null) throw new PromptNotFoundError()
  assertPromptFields(patch)

  const next: SavedPrompt = {
    ...existing,
    name: patch.name ?? existing.name,
    description: patch.description ?? existing.description,
    body: patch.body ?? existing.body,
    updatedAt: Date.now(),
  }
  try {
    getDb()
      .prepare('UPDATE saved_prompts SET name = ?, description = ?, body = ?, updated_at = ? WHERE id = ?')
      .run(next.name, next.description, next.body, next.updatedAt, id)
  } catch (err) {
    if (isUniqueViolation(err)) throw new PromptNameConflictError(next.name)
    throw err
  }
  return next
}

export function deleteSavedPrompt(id: string): void {
  const result = getDb().prepare('DELETE FROM saved_prompts WHERE id = ?').run(id)
  if (result.changes === 0) throw new PromptNotFoundError()
}

// ── Modos de chat ────────────────────────────────────────────────────────────

export interface ChatMode {
  id: string
  projectId: string
  name: string
  description: string
  provider: string | null
  model: string | null
  reasoningLevel: string | null
  accessLevel: string | null
  executionMode: string | null
  instructions: string
  /** Skills do projeto que o modo deixa ativas; `null` = modo não filtra (ver migração 020). */
  skills: string[] | null
  /** Rules do projeto que o modo deixa ativas; `null` = modo não filtra. */
  rules: string[] | null
  createdAt: number
  updatedAt: number
}

export interface ChatModeInput {
  projectId: string
  name: string
  description?: string
  provider?: string | null
  model?: string | null
  reasoningLevel?: string | null
  accessLevel?: string | null
  executionMode?: string | null
  instructions?: string
  skills?: string[] | null
  rules?: string[] | null
}

interface ChatModeRow {
  id: string
  project_id: string
  name: string
  description: string
  provider: string | null
  model: string | null
  reasoning_level: string | null
  access_level: string | null
  execution_mode: string | null
  instructions: string
  skills_json: string | null
  rules_json: string | null
  created_at: number
  updated_at: number
}

/** Coluna TEXT com JSON de array; qualquer coisa fora disso vira `null` (modo não filtra). */
function readNameColumn(raw: string | null): string[] | null {
  if (raw === null) return null
  try {
    return normalizeNameList(JSON.parse(raw))
  } catch {
    return null
  }
}

function writeNameColumn(names: string[] | null): string | null {
  return names === null ? null : JSON.stringify(names)
}

function toMode(row: ChatModeRow): ChatMode {
  return {
    id: row.id,
    projectId: row.project_id,
    name: row.name,
    description: row.description,
    provider: row.provider,
    model: row.model,
    reasoningLevel: row.reasoning_level,
    accessLevel: row.access_level,
    executionMode: row.execution_mode,
    instructions: row.instructions,
    skills: readNameColumn(row.skills_json),
    rules: readNameColumn(row.rules_json),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function assertModeFields(input: {
  name?: unknown
  description?: unknown
  instructions?: unknown
  skills?: unknown
  rules?: unknown
}): void {
  const nameErr = validatePromptFields({ name: input.name, description: input.description })
  if (nameErr !== null) throw new PromptValidationError(nameErr.field, nameErr.message)
  const instrErr = validateModeInstructions(input.instructions)
  if (instrErr !== null) throw new PromptValidationError(instrErr.field, instrErr.message)
  for (const err of [validateModeCatalog(input.skills, 'skills'), validateModeCatalog(input.rules, 'rules')]) {
    if (err !== null) throw new PromptValidationError(err.field, err.message)
  }
}

export function listChatModes(projectId: string): ChatMode[] {
  const rows = getDb()
    .prepare('SELECT * FROM chat_modes WHERE project_id = ? ORDER BY name')
    .all(projectId) as unknown as ChatModeRow[]
  return rows.map(toMode)
}

export function getChatMode(id: string): ChatMode | null {
  const row = getDb().prepare('SELECT * FROM chat_modes WHERE id = ?').get(id) as ChatModeRow | undefined
  return row === undefined ? null : toMode(row)
}

export function getChatModeByName(projectId: string, name: string): ChatMode | null {
  const row = getDb()
    .prepare('SELECT * FROM chat_modes WHERE project_id = ? AND name = ?')
    .get(projectId, name) as ChatModeRow | undefined
  return row === undefined ? null : toMode(row)
}

export function createChatMode(input: ChatModeInput): ChatMode {
  assertModeFields(input)
  const now = Date.now()
  const mode: ChatMode = {
    id: randomUUID(),
    projectId: input.projectId,
    name: input.name,
    description: input.description ?? '',
    provider: input.provider ?? null,
    model: input.model ?? null,
    reasoningLevel: input.reasoningLevel ?? null,
    accessLevel: input.accessLevel ?? null,
    executionMode: input.executionMode ?? null,
    instructions: input.instructions ?? '',
    skills: normalizeNameList(input.skills),
    rules: normalizeNameList(input.rules),
    createdAt: now,
    updatedAt: now,
  }
  try {
    getDb()
      .prepare(
        `INSERT INTO chat_modes
           (id, project_id, name, description, provider, model, reasoning_level, access_level, execution_mode, instructions, skills_json, rules_json, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        mode.id,
        mode.projectId,
        mode.name,
        mode.description,
        mode.provider,
        mode.model,
        mode.reasoningLevel,
        mode.accessLevel,
        mode.executionMode,
        mode.instructions,
        writeNameColumn(mode.skills),
        writeNameColumn(mode.rules),
        now,
        now
      )
  } catch (err) {
    if (isUniqueViolation(err)) throw new PromptNameConflictError(input.name)
    throw err
  }
  return mode
}

export type ChatModePatch = Partial<Omit<ChatModeInput, 'projectId'>>

export function updateChatMode(id: string, patch: ChatModePatch): ChatMode {
  const existing = getChatMode(id)
  if (existing === null) throw new PromptNotFoundError()
  assertModeFields(patch)

  const next: ChatMode = {
    ...existing,
    name: patch.name ?? existing.name,
    description: patch.description ?? existing.description,
    provider: patch.provider !== undefined ? patch.provider : existing.provider,
    model: patch.model !== undefined ? patch.model : existing.model,
    reasoningLevel: patch.reasoningLevel !== undefined ? patch.reasoningLevel : existing.reasoningLevel,
    accessLevel: patch.accessLevel !== undefined ? patch.accessLevel : existing.accessLevel,
    executionMode: patch.executionMode !== undefined ? patch.executionMode : existing.executionMode,
    instructions: patch.instructions ?? existing.instructions,
    skills: patch.skills !== undefined ? normalizeNameList(patch.skills) : existing.skills,
    rules: patch.rules !== undefined ? normalizeNameList(patch.rules) : existing.rules,
    updatedAt: Date.now(),
  }
  try {
    getDb()
      .prepare(
        `UPDATE chat_modes SET name = ?, description = ?, provider = ?, model = ?, reasoning_level = ?,
           access_level = ?, execution_mode = ?, instructions = ?, skills_json = ?, rules_json = ?,
           updated_at = ? WHERE id = ?`
      )
      .run(
        next.name,
        next.description,
        next.provider,
        next.model,
        next.reasoningLevel,
        next.accessLevel,
        next.executionMode,
        next.instructions,
        writeNameColumn(next.skills),
        writeNameColumn(next.rules),
        next.updatedAt,
        id
      )
  } catch (err) {
    if (isUniqueViolation(err)) throw new PromptNameConflictError(next.name)
    throw err
  }
  return next
}

export function deleteChatMode(id: string): void {
  const result = getDb().prepare('DELETE FROM chat_modes WHERE id = ?').run(id)
  if (result.changes === 0) throw new PromptNotFoundError()
}

function isUniqueViolation(err: unknown): boolean {
  return err instanceof Error && /UNIQUE constraint failed/i.test(err.message)
}
