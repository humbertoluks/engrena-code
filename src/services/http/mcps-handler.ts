import type { IncomingMessage, ServerResponse } from 'http'
import { vaultService } from '../vault/vault-service.js'
import {
  createMcp,
  deleteMcp,
  getMcp,
  getMcpByName,
  listMcps,
  listProjectMcps,
  McpError,
  setProjectMcpLink,
  unlinkProjectMcp,
  updateMcp,
  type CreateMcpInput,
  type UpdateMcpInput,
} from '../db/repositories/mcps.js'
import { getMcpPreset, listMcpPresets } from '../mcps/catalog.js'
import { disconnectOauth, getOauthStatus, McpOauthError, saveClientId, startOauth } from '../mcps/oauth.js'

const SESSION_HEADER = 'x-engrenacode-session'
const SECRET_PREFIX = 'mcpSecrets:'

// ── Helpers ────────────────────────────────────────────────────────────────

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(body))
}

function sendError(res: ServerResponse, status: number, code: string, message: string): void {
  sendJson(res, status, { error: { code, message } })
}

async function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = ''
    req.on('data', (chunk) => { body += chunk.toString() })
    req.on('end', () => resolve(body))
    req.on('error', reject)
  })
}

function parseBody<T>(raw: string): T | null {
  if (raw.trim() === '') return {} as T
  try { return JSON.parse(raw) as T } catch { return null }
}

function guard(req: IncomingMessage, res: ServerResponse): boolean {
  if (vaultService.isLocked()) {
    sendError(res, 423, 'vault_locked', 'Cofre local travado. Desbloqueie antes de continuar.')
    return false
  }

  const token = req.headers[SESSION_HEADER]
  const valid = vaultService.getSessionToken()
  if (typeof token !== 'string' || !token || token !== valid) {
    sendError(res, 401, 'unauthorized', 'Sessão inválida.')
    return false
  }

  return true
}

function handleMcpError(res: ServerResponse, err: unknown): void {
  if (err instanceof McpError) {
    const status = err.code === 'mcp_name_conflict' ? 409 : err.code === 'mcp_not_found' ? 404 : 400
    sendError(res, status, err.code, err.message)
    return
  }
  if (err instanceof McpOauthError) {
    const status = err.code === 'vault_locked' ? 423 : err.code === 'oauth_flow_active' ? 409 : err.code === 'mcp_not_found' ? 404 : 400
    sendError(res, status, err.code, err.message)
    return
  }
  console.error('[mcps-handler] Unhandled error:', err)
  sendError(res, 500, 'internal_error', 'Erro interno.')
}

// ── CRUD ────────────────────────────────────────────────────────────────────

function handleListMcps(_req: IncomingMessage, res: ServerResponse): void {
  sendJson(res, 200, { mcps: listMcps() })
}

async function handleCreateMcp(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const data = parseBody<CreateMcpInput>(await readBody(req))
  if (data === null || typeof data.name !== 'string' || typeof data.transport !== 'string') {
    return sendError(res, 400, 'invalid_request', 'Corpo inválido.')
  }
  try {
    const mcp = createMcp(data)
    sendJson(res, 201, { mcp })
  } catch (err) {
    handleMcpError(res, err)
  }
}

async function handleUpdateMcp(req: IncomingMessage, res: ServerResponse, id: string): Promise<void> {
  const data = parseBody<UpdateMcpInput>(await readBody(req))
  if (data === null) return sendError(res, 400, 'invalid_request', 'Corpo inválido.')
  try {
    const mcp = updateMcp(id, data)
    if (mcp === null) return sendError(res, 404, 'mcp_not_found', 'MCP não encontrado.')
    sendJson(res, 200, { mcp })
  } catch (err) {
    handleMcpError(res, err)
  }
}

function handleDeleteMcp(_req: IncomingMessage, res: ServerResponse, id: string): void {
  const mcp = getMcp(id)
  if (mcp === null) return sendError(res, 404, 'mcp_not_found', 'MCP não encontrado.')
  deleteMcp(id)
  sendJson(res, 200, { deleted: true })
}

// ── Catálogo ────────────────────────────────────────────────────────────────

function handleListCatalog(_req: IncomingMessage, res: ServerResponse): void {
  sendJson(res, 200, { presets: listMcpPresets() })
}

function handleInstallPreset(_req: IncomingMessage, res: ServerResponse, presetId: string): void {
  const preset = getMcpPreset(presetId)
  if (preset === undefined) return sendError(res, 400, 'preset_not_found', 'Preset desconhecido.')

  const existing = getMcpByName(preset.name)
  if (existing !== null) {
    return sendJson(res, 409, { error: { code: 'mcp_already_installed', message: 'Preset já instalado.' }, mcp: existing })
  }

  const env: Record<string, string> = {}
  for (const [envVar, vaultKey] of Object.entries(preset.secretEnv ?? {})) {
    env[envVar] = `vault:${vaultKey}`
  }

  try {
    const mcp = createMcp({
      name: preset.name,
      description: preset.description,
      category: preset.category,
      transport: preset.transport,
      command: preset.command,
      args: preset.args,
      env,
      url: preset.remoteUrl,
      enabled: true,
      presetId: preset.id,
      authMode: preset.authMode,
    })
    sendJson(res, 201, { mcp })
  } catch (err) {
    handleMcpError(res, err)
  }
}

// ── Secrets ─────────────────────────────────────────────────────────────────

function handleListSecretKeys(_req: IncomingMessage, res: ServerResponse): void {
  const all = vaultService.getAllSecrets()
  const keys = Object.keys(all)
    .filter((k) => k.startsWith(SECRET_PREFIX))
    .map((k) => k.slice(SECRET_PREFIX.length))
  sendJson(res, 200, { keys })
}

async function handleSaveSecret(req: IncomingMessage, res: ServerResponse, key: string): Promise<void> {
  const data = parseBody<{ value?: string }>(await readBody(req))
  if (data === null || typeof data.value !== 'string' || data.value === '') {
    return sendError(res, 400, 'validation_error', 'Valor do segredo é obrigatório.')
  }
  vaultService.setSecret(`${SECRET_PREFIX}${key}`, data.value)
  sendJson(res, 200, { saved: true })
}

function handleDeleteSecret(_req: IncomingMessage, res: ServerResponse, key: string): void {
  vaultService.deleteSecret(`${SECRET_PREFIX}${key}`)
  sendJson(res, 200, { deleted: true })
}

// ── OAuth ───────────────────────────────────────────────────────────────────

async function handleOauthStart(_req: IncomingMessage, res: ServerResponse, id: string): Promise<void> {
  try {
    const result = await startOauth(id)
    if ('needsClientId' in result) {
      sendJson(res, 200, { status: 'needs-client-id' })
      return
    }
    sendJson(res, 200, { authorizeUrl: result.authorizeUrl })
  } catch (err) {
    handleMcpError(res, err)
  }
}

function handleOauthStatus(_req: IncomingMessage, res: ServerResponse, id: string): void {
  sendJson(res, 200, { status: getOauthStatus(id) })
}

function handleOauthDisconnect(_req: IncomingMessage, res: ServerResponse, id: string): void {
  disconnectOauth(id)
  sendJson(res, 200, { status: 'disconnected' })
}

async function handleOauthClient(req: IncomingMessage, res: ServerResponse, id: string): Promise<void> {
  const data = parseBody<{ clientId?: string }>(await readBody(req))
  if (data === null || typeof data.clientId !== 'string' || data.clientId.trim() === '') {
    return sendError(res, 400, 'validation_error', 'client_id é obrigatório.')
  }
  saveClientId(id, data.clientId.trim())
  sendJson(res, 200, { status: 'disconnected' })
}

async function handleOauthConvert(req: IncomingMessage, res: ServerResponse, id: string): Promise<void> {
  const data = parseBody<{ toPresetId?: string }>(await readBody(req))
  const preset = data?.toPresetId ? getMcpPreset(data.toPresetId) : undefined
  if (!preset || preset.authMode !== 'oauth' || !preset.remoteUrl) {
    return sendError(res, 400, 'invalid_request', 'Preset OAuth de destino inválido.')
  }

  const mcp = getMcp(id)
  if (mcp === null) return sendError(res, 404, 'mcp_not_found', 'MCP não encontrado.')

  const updated = updateMcp(id, { transport: preset.transport, url: preset.remoteUrl, authMode: 'oauth' })
  sendJson(res, 200, { mcp: updated })
}

// ── Vínculo por projeto ─────────────────────────────────────────────────────

function handleListProjectMcps(_req: IncomingMessage, res: ServerResponse, projectId: string): void {
  sendJson(res, 200, listProjectMcps(projectId))
}

async function handleSetProjectMcpLink(req: IncomingMessage, res: ServerResponse, projectId: string, mcpId: string): Promise<void> {
  const data = parseBody<{ enabled?: boolean; sortOrder?: number }>(await readBody(req))
  if (data === null) return sendError(res, 400, 'invalid_request', 'Corpo inválido.')
  try {
    const state = setProjectMcpLink(projectId, mcpId, data)
    sendJson(res, 200, { mcp: state })
  } catch (err) {
    handleMcpError(res, err)
  }
}

function handleUnlinkProjectMcp(_req: IncomingMessage, res: ServerResponse, projectId: string, mcpId: string): void {
  const unlinked = unlinkProjectMcp(projectId, mcpId)
  sendJson(res, 200, { unlinked })
}

// ── Router ──────────────────────────────────────────────────────────────────

const MCP_ID_RE = /^\/api\/mcps\/([^/]+)$/
const MCP_OAUTH_START_RE = /^\/api\/mcps\/([^/]+)\/oauth\/start$/
const MCP_OAUTH_STATUS_RE = /^\/api\/mcps\/([^/]+)\/oauth\/status$/
const MCP_OAUTH_DISCONNECT_RE = /^\/api\/mcps\/([^/]+)\/oauth\/disconnect$/
const MCP_OAUTH_CONVERT_RE = /^\/api\/mcps\/([^/]+)\/oauth\/convert$/
const MCP_OAUTH_CLIENT_RE = /^\/api\/mcps\/([^/]+)\/oauth\/client$/
const CATALOG_INSTALL_RE = /^\/api\/mcp-catalog\/([^/]+)\/install$/
const SECRET_KEY_RE = /^\/api\/mcp-secrets\/([^/]+)$/
const PROJECT_MCPS_RE = /^\/api\/projects\/([^/]+)\/mcps$/
const PROJECT_MCP_LINK_RE = /^\/api\/projects\/([^/]+)\/mcps\/([^/]+)$/

function isMcpsUrl(url: string): boolean {
  return (
    url.startsWith('/api/mcps') ||
    url.startsWith('/api/mcp-catalog') ||
    url.startsWith('/api/mcp-secrets') ||
    (url.startsWith('/api/projects/') && (PROJECT_MCPS_RE.test(url) || PROJECT_MCP_LINK_RE.test(url)))
  )
}

export async function handleMcpsRequest(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  const url = (req.url ?? '').split('?')[0]
  const method = req.method ?? ''

  if (!isMcpsUrl(url)) return false
  if (!guard(req, res)) return true

  try {
    if (method === 'GET' && url === '/api/mcps') {
      handleListMcps(req, res)
      return true
    }
    if (method === 'POST' && url === '/api/mcps') {
      await handleCreateMcp(req, res)
      return true
    }

    if (method === 'GET' && url === '/api/mcp-catalog') {
      handleListCatalog(req, res)
      return true
    }

    if (method === 'GET' && url === '/api/mcp-secrets') {
      handleListSecretKeys(req, res)
      return true
    }

    const startMatch = MCP_OAUTH_START_RE.exec(url)
    if (startMatch && method === 'POST') {
      await handleOauthStart(req, res, startMatch[1])
      return true
    }

    const statusMatch = MCP_OAUTH_STATUS_RE.exec(url)
    if (statusMatch && method === 'GET') {
      handleOauthStatus(req, res, statusMatch[1])
      return true
    }

    const disconnectMatch = MCP_OAUTH_DISCONNECT_RE.exec(url)
    if (disconnectMatch && method === 'POST') {
      handleOauthDisconnect(req, res, disconnectMatch[1])
      return true
    }

    const convertMatch = MCP_OAUTH_CONVERT_RE.exec(url)
    if (convertMatch && method === 'POST') {
      await handleOauthConvert(req, res, convertMatch[1])
      return true
    }

    const clientMatch = MCP_OAUTH_CLIENT_RE.exec(url)
    if (clientMatch && method === 'PUT') {
      await handleOauthClient(req, res, clientMatch[1])
      return true
    }

    const installMatch = CATALOG_INSTALL_RE.exec(url)
    if (installMatch && method === 'POST') {
      handleInstallPreset(req, res, installMatch[1])
      return true
    }

    const secretMatch = SECRET_KEY_RE.exec(url)
    if (secretMatch && method === 'PUT') {
      await handleSaveSecret(req, res, secretMatch[1])
      return true
    }
    if (secretMatch && method === 'DELETE') {
      handleDeleteSecret(req, res, secretMatch[1])
      return true
    }

    const mcpIdMatch = MCP_ID_RE.exec(url)
    if (mcpIdMatch && method === 'PUT') {
      await handleUpdateMcp(req, res, mcpIdMatch[1])
      return true
    }
    if (mcpIdMatch && method === 'DELETE') {
      handleDeleteMcp(req, res, mcpIdMatch[1])
      return true
    }

    const projectMcpsMatch = PROJECT_MCPS_RE.exec(url)
    if (projectMcpsMatch && method === 'GET') {
      handleListProjectMcps(req, res, projectMcpsMatch[1])
      return true
    }

    const linkMatch = PROJECT_MCP_LINK_RE.exec(url)
    if (linkMatch && method === 'PUT') {
      await handleSetProjectMcpLink(req, res, linkMatch[1], linkMatch[2])
      return true
    }
    if (linkMatch && method === 'DELETE') {
      handleUnlinkProjectMcp(req, res, linkMatch[1], linkMatch[2])
      return true
    }
  } catch (err) {
    console.error('[mcps-handler] Unhandled error:', err)
    if (!res.headersSent) sendError(res, 500, 'internal_error', 'Erro interno.')
    return true
  }

  return false
}
