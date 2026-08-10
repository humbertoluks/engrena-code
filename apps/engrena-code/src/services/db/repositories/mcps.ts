import { randomUUID } from 'crypto'
import { getDb } from '../client.js'
import { vaultService } from '../../vault/vault-service.js'
import type { McpAuthMode, McpTransport } from '../../mcps/catalog.js'

export const RESERVED_MCP_NAME = 'engrenacode'
const NAME_RE = /^[a-z0-9][a-z0-9_-]*$/
const ENV_KEY_RE = /^[A-Za-z_][A-Za-z0-9_]*$/

export interface Mcp {
  id: string
  name: string
  description: string | null
  transport: McpTransport
  command: string | null
  args: string[]
  env: Record<string, string>
  url: string | null
  headers: Record<string, string>
  category: string | null
  enabled: boolean
  presetId: string | null
  authMode: McpAuthMode
  oauthStatus: string | null
  oauthClientId: string | null
  createdAt: number
  updatedAt: number
}

export interface McpLinkState extends Mcp {
  linked: boolean
  enabledInProject: boolean
  sortOrder: number | null
  needsCredential: boolean
}

export class McpError extends Error {
  code: string

  constructor(code: string, message: string) {
    super(message)
    this.code = code
  }
}

interface McpRow {
  id: string
  name: string
  description: string | null
  transport: string
  command: string | null
  args_json: string | null
  env_json: string | null
  url: string | null
  headers_json: string | null
  category: string | null
  enabled: number
  preset_id: string | null
  auth_mode: string
  oauth_status: string | null
  oauth_client_json: string | null
  created_at: number
  updated_at: number
}

interface McpLinkRow extends McpRow {
  link_enabled: number | null
  link_sort_order: number | null
}

function toMcp(row: McpRow): Mcp {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    transport: row.transport as McpTransport,
    command: row.command,
    args: row.args_json ? (JSON.parse(row.args_json) as string[]) : [],
    env: row.env_json ? (JSON.parse(row.env_json) as Record<string, string>) : {},
    url: row.url,
    headers: row.headers_json ? (JSON.parse(row.headers_json) as Record<string, string>) : {},
    category: row.category,
    enabled: row.enabled === 1,
    presetId: row.preset_id,
    authMode: row.auth_mode as McpAuthMode,
    oauthStatus: row.oauth_status,
    oauthClientId: row.oauth_client_json ? (JSON.parse(row.oauth_client_json) as { clientId: string }).clientId : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function needsCredential(mcp: Mcp): boolean {
  if (mcp.authMode === 'oauth') return mcp.oauthStatus !== 'connected'
  if (vaultService.isLocked()) return false
  for (const value of Object.values(mcp.env)) {
    if (value.startsWith('vault:')) {
      const key = value.slice('vault:'.length)
      if (!vaultService.getSecret(`mcpSecrets:${key}`)) return true
    }
  }
  return false
}

function toMcpLinkState(row: McpLinkRow): McpLinkState {
  const mcp = toMcp(row)
  const linked = row.link_enabled !== null
  return {
    ...mcp,
    linked,
    enabledInProject: row.link_enabled === 1,
    sortOrder: linked ? row.link_sort_order : null,
    needsCredential: needsCredential(mcp),
  }
}

function mapUniqueViolation(err: unknown): never {
  if (err instanceof Error && /UNIQUE constraint failed/.test(err.message)) {
    throw new McpError('mcp_name_conflict', 'Já existe um MCP com este nome. Escolha outro.')
  }
  throw err
}

// ── Validation ──────────────────────────────────────────────────────────────

export function validateMcpName(name: string): void {
  if (name === RESERVED_MCP_NAME) {
    throw new McpError('validation_error', `O nome "${RESERVED_MCP_NAME}" é reservado (broker interno).`)
  }
  if (!NAME_RE.test(name)) {
    throw new McpError('validation_error', 'Use minúsculas, dígitos, "_" e "-" (começando por letra ou dígito).')
  }
}

function isHttpsOrLoopback(url: string): boolean {
  try {
    const parsed = new URL(url)
    if (parsed.protocol === 'https:') return true
    if (parsed.protocol === 'http:') return parsed.hostname === '127.0.0.1' || parsed.hostname === 'localhost'
    return false
  } catch {
    return false
  }
}

function validateEnv(env: Record<string, string>): void {
  for (const key of Object.keys(env)) {
    if (!ENV_KEY_RE.test(key)) {
      throw new McpError('validation_error', `Chave de env inválida: "${key}".`)
    }
  }
}

function validateHeaders(headers: Record<string, string>): void {
  for (const [key, value] of Object.entries(headers)) {
    if (key.trim() === '' || /[\r\n]/.test(key)) {
      throw new McpError('validation_error', `Header inválido: "${key}".`)
    }
    if (value.startsWith('vault:')) {
      throw new McpError('invalid_request', `Header secreto não é suportado no v1 (${key}): vault:<chave> só vale em env.`)
    }
  }
}

function validateTransportFields(input: {
  transport: McpTransport
  command?: string | null
  url?: string | null
}): void {
  if (input.transport === 'stdio') {
    if (!input.command || input.command.trim() === '') {
      throw new McpError('validation_error', 'Comando é obrigatório para transporte stdio.')
    }
    return
  }
  if (!input.url || input.url.trim() === '') {
    throw new McpError('validation_error', 'URL é obrigatória para transportes http/sse.')
  }
  if (!isHttpsOrLoopback(input.url)) {
    throw new McpError('validation_error', 'URL remota exige HTTPS (HTTP só é aceito em loopback).')
  }
}

// ── CRUD ────────────────────────────────────────────────────────────────────

export interface CreateMcpInput {
  name: string
  description?: string | null
  transport: McpTransport
  command?: string | null
  args?: string[]
  env?: Record<string, string>
  url?: string | null
  headers?: Record<string, string>
  category?: string | null
  enabled?: boolean
  presetId?: string | null
  authMode?: McpAuthMode
}

export type UpdateMcpInput = Partial<CreateMcpInput>

export function listMcps(): Mcp[] {
  const rows = getDb().prepare('SELECT * FROM mcps ORDER BY name ASC').all() as unknown as McpRow[]
  return rows.map(toMcp)
}

export function getMcp(id: string): Mcp | null {
  const row = getDb().prepare('SELECT * FROM mcps WHERE id = ?').get(id) as McpRow | undefined
  return row === undefined ? null : toMcp(row)
}

export function getMcpByName(name: string): Mcp | null {
  const row = getDb().prepare('SELECT * FROM mcps WHERE name = ?').get(name) as McpRow | undefined
  return row === undefined ? null : toMcp(row)
}

export function createMcp(input: CreateMcpInput): Mcp {
  validateMcpName(input.name)
  const env = input.env ?? {}
  const headers = input.headers ?? {}
  validateTransportFields(input)
  validateEnv(env)
  validateHeaders(headers)

  const now = Date.now()
  const id = randomUUID()

  try {
    getDb()
      .prepare(
        `INSERT INTO mcps (id, name, description, transport, command, args_json, env_json, url, headers_json, category, enabled, preset_id, auth_mode, oauth_status, oauth_client_json, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        id,
        input.name,
        input.description?.trim() ? input.description : null,
        input.transport,
        input.command?.trim() ? input.command : null,
        JSON.stringify(input.args ?? []),
        JSON.stringify(env),
        input.url?.trim() ? input.url : null,
        JSON.stringify(headers),
        input.category?.trim() ? input.category : null,
        input.enabled === false ? 0 : 1,
        input.presetId ?? null,
        input.authMode ?? 'key',
        input.authMode === 'oauth' ? 'disconnected' : null,
        null,
        now,
        now
      )
  } catch (err) {
    mapUniqueViolation(err)
  }

  return getMcp(id) as Mcp
}

export function updateMcp(id: string, patch: UpdateMcpInput): Mcp | null {
  const existing = getMcp(id)
  if (existing === null) return null

  if (patch.name !== undefined) validateMcpName(patch.name)

  const next = {
    name: patch.name ?? existing.name,
    description: patch.description !== undefined ? (patch.description?.trim() ? patch.description : null) : existing.description,
    transport: patch.transport ?? existing.transport,
    command: patch.command !== undefined ? (patch.command?.trim() ? patch.command : null) : existing.command,
    args: patch.args ?? existing.args,
    env: patch.env ?? existing.env,
    url: patch.url !== undefined ? (patch.url?.trim() ? patch.url : null) : existing.url,
    headers: patch.headers ?? existing.headers,
    category: patch.category !== undefined ? (patch.category?.trim() ? patch.category : null) : existing.category,
    enabled: patch.enabled ?? existing.enabled,
  }

  validateTransportFields(next)
  validateEnv(next.env)
  validateHeaders(next.headers)

  try {
    getDb()
      .prepare(
        `UPDATE mcps SET name = ?, description = ?, transport = ?, command = ?, args_json = ?, env_json = ?, url = ?, headers_json = ?, category = ?, enabled = ?, updated_at = ?
         WHERE id = ?`
      )
      .run(
        next.name,
        next.description,
        next.transport,
        next.command,
        JSON.stringify(next.args),
        JSON.stringify(next.env),
        next.url,
        JSON.stringify(next.headers),
        next.category,
        next.enabled ? 1 : 0,
        Date.now(),
        id
      )
  } catch (err) {
    mapUniqueViolation(err)
  }

  return getMcp(id)
}

export function deleteMcp(id: string): boolean {
  const result = getDb().prepare('DELETE FROM mcps WHERE id = ?').run(id)
  return Number(result.changes) > 0
}

// ── OAuth state (persisted, tokens live in vault) ──────────────────────────

export function setOauthStatus(id: string, status: string): void {
  getDb().prepare('UPDATE mcps SET oauth_status = ?, updated_at = ? WHERE id = ?').run(status, Date.now(), id)
}

export function setOauthClientId(id: string, clientId: string): void {
  getDb()
    .prepare('UPDATE mcps SET oauth_client_json = ?, updated_at = ? WHERE id = ?')
    .run(JSON.stringify({ clientId }), Date.now(), id)
}

export function convertToOauth(id: string, sibling: { transport: McpTransport; url: string }): Mcp | null {
  const existing = getMcp(id)
  if (existing === null) return null
  getDb()
    .prepare(
      `UPDATE mcps SET transport = ?, url = ?, auth_mode = 'oauth', oauth_status = 'disconnected', updated_at = ?
       WHERE id = ?`
    )
    .run(sibling.transport, sibling.url, Date.now(), id)
  return getMcp(id)
}

// ── Project link ────────────────────────────────────────────────────────────

export interface ProjectMcpLinkInput {
  enabled?: boolean
  sortOrder?: number
}

function listProjectMcpsInternal(projectId: string): McpLinkState[] {
  const rows = getDb()
    .prepare(
      `SELECT m.*, pm.enabled as link_enabled, pm.sort_order as link_sort_order
       FROM mcps m
       LEFT JOIN project_mcps pm ON pm.mcp_id = m.id AND pm.project_id = ?
       ORDER BY m.name ASC`
    )
    .all(projectId) as unknown as McpLinkRow[]

  return rows.map(toMcpLinkState)
}

export function listProjectMcps(projectId: string): McpLinkState[] {
  return listProjectMcpsInternal(projectId)
}

export function setProjectMcpLink(projectId: string, mcpId: string, input: ProjectMcpLinkInput): McpLinkState {
  const mcp = getMcp(mcpId)
  if (mcp === null) throw new McpError('mcp_not_found', 'MCP não encontrado.')

  const db = getDb()
  const now = Date.now()
  const enabled = input.enabled ?? true
  const existing = db
    .prepare('SELECT sort_order FROM project_mcps WHERE project_id = ? AND mcp_id = ?')
    .get(projectId, mcpId) as { sort_order: number } | undefined
  const sortOrder = input.sortOrder ?? existing?.sort_order ?? 0

  db.prepare(
    `INSERT INTO project_mcps (project_id, mcp_id, enabled, sort_order, created_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(project_id, mcp_id) DO UPDATE SET enabled = excluded.enabled, sort_order = excluded.sort_order`
  ).run(projectId, mcpId, enabled ? 1 : 0, sortOrder, now)

  const state = listProjectMcpsInternal(projectId).find((m) => m.id === mcpId)
  return state as McpLinkState
}

export function unlinkProjectMcp(projectId: string, mcpId: string): boolean {
  const result = getDb().prepare('DELETE FROM project_mcps WHERE project_id = ? AND mcp_id = ?').run(projectId, mcpId)
  return Number(result.changes) > 0
}

export function reorderProjectMcp(projectId: string, mcpId: string, direction: 'up' | 'down'): McpLinkState[] {
  const linked = listProjectMcpsInternal(projectId)
    .filter((m) => m.linked)
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))

  const index = linked.findIndex((m) => m.id === mcpId)
  const swapWith = direction === 'up' ? index - 1 : index + 1
  if (index === -1 || swapWith < 0 || swapWith >= linked.length) return listProjectMcpsInternal(projectId)

  const db = getDb()
  const now = Date.now()
  const a = linked[index]
  const b = linked[swapWith]
  db.prepare('UPDATE project_mcps SET sort_order = ? WHERE project_id = ? AND mcp_id = ?').run(b.sortOrder, projectId, a.id)
  db.prepare('UPDATE project_mcps SET sort_order = ? WHERE project_id = ? AND mcp_id = ?').run(a.sortOrder, projectId, b.id)
  void now

  return listProjectMcpsInternal(projectId)
}

// ── Runtime resolution (F03 dispatch) ──────────────────────────────────────

/** MCPs linked ∧ enabled no projeto ∧ mcp.enabled — candidatos à resolução do turno (spec §7.1). */
export function resolveForProject(projectId: string): Mcp[] {
  return listProjectMcpsInternal(projectId)
    .filter((m) => m.linked && m.enabledInProject && m.enabled)
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name))
    .map(({ linked: _linked, enabledInProject: _e, sortOrder: _so, needsCredential: _n, ...mcp }) => mcp)
}

// ── Counts (F04) ─────────────────────────────────────────────────────────────

export function getMcpCounts(): { total: number; linkedByProject: Record<string, number> } {
  const db = getDb()
  const totalRow = db.prepare('SELECT COUNT(*) as c FROM mcps').get() as { c: number }

  const projectIds = (
    db.prepare('SELECT DISTINCT project_id FROM project_mcps').all() as Array<{ project_id: string }>
  ).map((r) => r.project_id)

  const linkedByProject: Record<string, number> = {}
  for (const projectId of projectIds) {
    linkedByProject[projectId] = resolveForProject(projectId).length
  }

  return { total: totalRow.c, linkedByProject }
}
