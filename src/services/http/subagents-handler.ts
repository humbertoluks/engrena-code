import type { IncomingMessage, ServerResponse } from 'http'
import { getDb } from '../db/client.js'
import {
  CatalogOrderError,
  createSubagentsRepository,
  SubagentNameConflictError,
  SubagentNotFoundError,
  SubagentTooLongError,
  SubagentValidationError,
  type CatalogOrderItem,
  type SubagentInput,
  type SubagentPatch,
  type SubagentsRepository,
} from '../db/repositories/subagents.js'
import { vaultService } from '../vault/vault-service.js'

const SESSION_HEADER = 'x-engrenacode-session'

let repoOverride: SubagentsRepository | null = null

/** Só para testes: injeta um repositório (ex.: SQLite em memória) no lugar do singleton real. */
export function setSubagentsRepositoryForTests(repo: SubagentsRepository | null): void {
  repoOverride = repo
}

function getRepository(): SubagentsRepository {
  if (repoOverride) return repoOverride
  return createSubagentsRepository(getDb())
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const json = JSON.stringify(body)
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(json)
}

function sendError(res: ServerResponse, status: number, code: string, message: string): void {
  sendJson(res, status, { error: { code, message } })
}

async function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = ''
    req.on('data', (chunk) => {
      body += chunk.toString()
    })
    req.on('end', () => resolve(body))
    req.on('error', reject)
  })
}

function parseBody<T>(raw: string): T | null {
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

/** Retorna true se a sessão é válida; caso contrário já escreveu 401/423 na resposta. */
function requireSession(req: IncomingMessage, res: ServerResponse): boolean {
  if (vaultService.isLocked()) {
    sendError(res, 423, 'vault_locked', 'Cofre local travado. Desbloqueie antes de continuar.')
    return false
  }
  const token = req.headers[SESSION_HEADER]
  if (typeof token !== 'string' || !token || token !== vaultService.getSessionToken()) {
    sendError(res, 401, 'unauthorized', 'Sessão inválida.')
    return false
  }
  return true
}

function handleKnownError(res: ServerResponse, err: unknown): boolean {
  if (err instanceof SubagentNotFoundError) {
    sendError(res, 404, 'subagent_not_found', err.message)
    return true
  }
  if (err instanceof SubagentNameConflictError) {
    sendError(res, 409, 'subagent_name_conflict', err.message)
    return true
  }
  if (err instanceof SubagentTooLongError) {
    sendError(res, 400, 'too_long', err.message)
    return true
  }
  if (err instanceof SubagentValidationError) {
    sendError(res, 400, 'validation_error', err.message)
    return true
  }
  if (err instanceof CatalogOrderError) {
    sendError(res, 400, 'invalid_request', err.message)
    return true
  }
  return false
}

// ── /api/subagents CRUD ─────────────────────────────────────────────────────

async function handleList(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (!requireSession(req, res)) return
  sendJson(res, 200, { subagents: getRepository().list() })
}

async function handleCreate(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (!requireSession(req, res)) return
  const data = parseBody<Partial<SubagentInput>>(await readBody(req))
  if (data === null) {
    return sendError(res, 400, 'invalid_request', 'Corpo inválido.')
  }
  try {
    const subagent = getRepository().create(data as SubagentInput)
    sendJson(res, 201, { subagent })
  } catch (err) {
    if (!handleKnownError(res, err)) throw err
  }
}

async function handleUpdate(req: IncomingMessage, res: ServerResponse, id: string): Promise<void> {
  if (!requireSession(req, res)) return
  const data = parseBody<SubagentPatch>(await readBody(req))
  if (data === null) {
    return sendError(res, 400, 'invalid_request', 'Corpo inválido.')
  }
  try {
    const subagent = getRepository().update(id, data)
    sendJson(res, 200, { subagent })
  } catch (err) {
    if (!handleKnownError(res, err)) throw err
  }
}

async function handleDelete(req: IncomingMessage, res: ServerResponse, id: string): Promise<void> {
  if (!requireSession(req, res)) return
  getRepository().remove(id)
  sendJson(res, 200, { deleted: true })
}

async function handleCounts(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (!requireSession(req, res)) return
  sendJson(res, 200, getRepository().getCounts())
}

// ── /api/projects/:id/subagents* ────────────────────────────────────────────

async function handleListProjectLinks(req: IncomingMessage, res: ServerResponse, projectId: string): Promise<void> {
  if (!requireSession(req, res)) return
  sendJson(res, 200, getRepository().listProjectSubagents(projectId))
}

async function handleUpsertLink(
  req: IncomingMessage,
  res: ServerResponse,
  projectId: string,
  subagentId: string
): Promise<void> {
  if (!requireSession(req, res)) return
  const data = parseBody<{ enabled?: boolean; sortOrder?: number }>(await readBody(req))
  if (data === null) {
    return sendError(res, 400, 'invalid_request', 'Corpo inválido.')
  }
  try {
    const link = getRepository().upsertProjectLink(projectId, subagentId, data)
    sendJson(res, 200, { subagent: link })
  } catch (err) {
    if (!handleKnownError(res, err)) throw err
  }
}

async function handleUnlink(
  req: IncomingMessage,
  res: ServerResponse,
  projectId: string,
  subagentId: string
): Promise<void> {
  if (!requireSession(req, res)) return
  getRepository().unlinkProject(projectId, subagentId)
  sendJson(res, 200, { deleted: true })
}

async function handleCatalogOrder(req: IncomingMessage, res: ServerResponse, projectId: string): Promise<void> {
  if (!requireSession(req, res)) return
  const data = parseBody<{ kind?: string; items?: CatalogOrderItem[] }>(await readBody(req))
  if (data === null || data.kind !== 'subagents' || !Array.isArray(data.items)) {
    return sendError(res, 400, 'invalid_request', 'kind deve ser "subagents" e items é obrigatório.')
  }
  try {
    const subagents = getRepository().setCatalogOrder(projectId, data.items)
    sendJson(res, 200, { subagents })
  } catch (err) {
    if (!handleKnownError(res, err)) throw err
  }
}

// ── Router ──────────────────────────────────────────────────────────────────

const SUBAGENT_ID_RE = /^\/api\/subagents\/([^/]+)$/
const PROJECT_SUBAGENTS_RE = /^\/api\/projects\/([^/]+)\/subagents$/
const PROJECT_SUBAGENT_LINK_RE = /^\/api\/projects\/([^/]+)\/subagents\/([^/]+)$/
const PROJECT_CATALOG_ORDER_RE = /^\/api\/projects\/([^/]+)\/catalog-order$/

export async function handleSubagentsRequest(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  const url = req.url ?? ''
  const method = req.method ?? ''

  try {
    if (method === 'GET' && url === '/api/subagents') {
      await handleList(req, res)
      return true
    }
    if (method === 'POST' && url === '/api/subagents') {
      await handleCreate(req, res)
      return true
    }
    if (method === 'GET' && url === '/api/subagents/counts') {
      await handleCounts(req, res)
      return true
    }

    const idMatch = url.match(SUBAGENT_ID_RE)
    if (idMatch) {
      const id = decodeURIComponent(idMatch[1])
      if (method === 'PUT') {
        await handleUpdate(req, res, id)
        return true
      }
      if (method === 'DELETE') {
        await handleDelete(req, res, id)
        return true
      }
    }

    const catalogOrderMatch = url.match(PROJECT_CATALOG_ORDER_RE)
    if (catalogOrderMatch && method === 'PUT') {
      await handleCatalogOrder(req, res, decodeURIComponent(catalogOrderMatch[1]))
      return true
    }

    const linkMatch = url.match(PROJECT_SUBAGENT_LINK_RE)
    if (linkMatch) {
      const projectId = decodeURIComponent(linkMatch[1])
      const subagentId = decodeURIComponent(linkMatch[2])
      if (method === 'PUT') {
        await handleUpsertLink(req, res, projectId, subagentId)
        return true
      }
      if (method === 'DELETE') {
        await handleUnlink(req, res, projectId, subagentId)
        return true
      }
    }

    const projectSubagentsMatch = url.match(PROJECT_SUBAGENTS_RE)
    if (projectSubagentsMatch && method === 'GET') {
      await handleListProjectLinks(req, res, decodeURIComponent(projectSubagentsMatch[1]))
      return true
    }
  } catch (err) {
    console.error('[subagents-handler] Unhandled error:', err)
    if (!res.headersSent) {
      sendError(res, 500, 'internal_error', 'Erro interno.')
    }
    return true
  }

  return false
}
