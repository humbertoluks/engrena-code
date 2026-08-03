import type { IncomingMessage, ServerResponse } from 'http'
import { vaultService } from '../vault/vault-service.js'
import {
  skillsRepository,
  ContentTooLongError,
  SkillNameConflictError,
  SkillNotFoundError,
  ValidationError,
  type SkillCreateInput,
  type SkillUpdateInput,
} from '../db/repositories/skills.js'

const SESSION_HEADER = 'x-engrenacode-session'

function isAuthorized(req: IncomingMessage): boolean {
  const token = req.headers[SESSION_HEADER]
  if (typeof token !== 'string' || !token) return false
  const valid = vaultService.getSessionToken()
  return token === valid
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
    req.on('data', (chunk) => { body += chunk.toString() })
    req.on('end', () => resolve(body))
    req.on('error', reject)
  })
}

function parseBody<T>(raw: string): T | null {
  if (raw === '') return {} as T
  try { return JSON.parse(raw) as T } catch { return null }
}

function mapRepositoryError(res: ServerResponse, err: unknown): boolean {
  if (err instanceof SkillNameConflictError) {
    sendError(res, 409, 'skill_name_conflict', err.message)
    return true
  }
  if (err instanceof SkillNotFoundError) {
    sendError(res, 404, 'skill_not_found', err.message)
    return true
  }
  if (err instanceof ContentTooLongError) {
    sendError(res, 400, 'too_long', err.message)
    return true
  }
  if (err instanceof ValidationError) {
    sendError(res, 400, 'validation_error', err.message)
    return true
  }
  return false
}

// ── Handlers ────────────────────────────────────────────────────────────────

function handleList(_req: IncomingMessage, res: ServerResponse): void {
  sendJson(res, 200, { skills: skillsRepository.list() })
}

function handleCounts(_req: IncomingMessage, res: ServerResponse): void {
  sendJson(res, 200, skillsRepository.getCounts())
}

async function handleCreate(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const data = parseBody<SkillCreateInput>(await readBody(req))
  if (data === null) {
    return sendError(res, 400, 'invalid_json', 'Corpo inválido.')
  }
  try {
    const skill = skillsRepository.create(data)
    sendJson(res, 201, { skill })
  } catch (err) {
    if (!mapRepositoryError(res, err)) throw err
  }
}

async function handleUpdate(req: IncomingMessage, res: ServerResponse, id: string): Promise<void> {
  const data = parseBody<SkillUpdateInput>(await readBody(req))
  if (data === null) {
    return sendError(res, 400, 'invalid_json', 'Corpo inválido.')
  }
  try {
    const skill = skillsRepository.update(id, data)
    sendJson(res, 200, { skill })
  } catch (err) {
    if (!mapRepositoryError(res, err)) throw err
  }
}

function handleDelete(res: ServerResponse, id: string): void {
  try {
    skillsRepository.remove(id)
    sendJson(res, 200, { deleted: true })
  } catch (err) {
    if (!mapRepositoryError(res, err)) throw err
  }
}

function handleListForProject(res: ServerResponse, projectId: string): void {
  sendJson(res, 200, skillsRepository.listForProject(projectId))
}

async function handleLinkSkill(
  req: IncomingMessage,
  res: ServerResponse,
  projectId: string,
  skillId: string
): Promise<void> {
  const data = parseBody<{ enabled?: boolean; sortOrder?: number }>(await readBody(req))
  if (data === null) {
    return sendError(res, 400, 'invalid_json', 'Corpo inválido.')
  }
  try {
    const link = skillsRepository.linkSkill(projectId, skillId, data)
    sendJson(res, 200, link)
  } catch (err) {
    if (!mapRepositoryError(res, err)) throw err
  }
}

function handleUnlinkSkill(res: ServerResponse, projectId: string, skillId: string): void {
  skillsRepository.unlinkSkill(projectId, skillId)
  sendJson(res, 200, { unlinked: true })
}

async function handleCatalogOrder(req: IncomingMessage, res: ServerResponse, projectId: string): Promise<void> {
  const data = parseBody<{ kind?: string; items?: Array<{ id: string; enabled?: boolean; sortOrder: number }> }>(
    await readBody(req)
  )
  if (data === null || data.kind !== 'skills' || !Array.isArray(data.items)) {
    return sendError(res, 400, 'validation_error', 'Corpo inválido para catalog-order.')
  }
  skillsRepository.reorder(projectId, data.items)
  sendJson(res, 200, { reordered: true })
}

// ── Router ──────────────────────────────────────────────────────────────────

const SKILL_ID_RE = /^\/api\/skills\/([^/]+)$/
const PROJECT_SKILLS_RE = /^\/api\/projects\/([^/]+)\/skills$/
const PROJECT_SKILL_LINK_RE = /^\/api\/projects\/([^/]+)\/skills\/([^/]+)$/
const PROJECT_CATALOG_ORDER_RE = /^\/api\/projects\/([^/]+)\/catalog-order$/

export async function handleSkillsRequest(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  const pathname = (req.url ?? '').split('?')[0]
  const method = req.method ?? ''

  if (!isAuthorized(req)) {
    const isSkillsRoute = pathname.startsWith('/api/skills') || pathname.startsWith('/api/projects/')
    if (isSkillsRoute) {
      sendError(res, 401, 'unauthorized', 'Sessão inválida.')
      return true
    }
    return false
  }

  try {
    if (method === 'GET' && pathname === '/api/skills/counts') {
      handleCounts(req, res)
      return true
    }
    if (method === 'GET' && pathname === '/api/skills') {
      handleList(req, res)
      return true
    }
    if (method === 'POST' && pathname === '/api/skills') {
      await handleCreate(req, res)
      return true
    }

    let match = pathname.match(SKILL_ID_RE)
    if (match) {
      const [, id] = match
      if (method === 'PUT') {
        await handleUpdate(req, res, id)
        return true
      }
      if (method === 'DELETE') {
        handleDelete(res, id)
        return true
      }
    }

    match = pathname.match(PROJECT_CATALOG_ORDER_RE)
    if (match && method === 'PUT') {
      const [, projectId] = match
      await handleCatalogOrder(req, res, projectId)
      return true
    }

    match = pathname.match(PROJECT_SKILL_LINK_RE)
    if (match) {
      const [, projectId, skillId] = match
      if (method === 'PUT') {
        await handleLinkSkill(req, res, projectId, skillId)
        return true
      }
      if (method === 'DELETE') {
        handleUnlinkSkill(res, projectId, skillId)
        return true
      }
    }

    match = pathname.match(PROJECT_SKILLS_RE)
    if (match && method === 'GET') {
      const [, projectId] = match
      handleListForProject(res, projectId)
      return true
    }
  } catch (err) {
    console.error('[skills-handler] Unhandled error:', err)
    if (!res.headersSent) {
      sendError(res, 500, 'internal_error', 'Erro interno.')
    }
    return true
  }

  return false
}
