import type { IncomingMessage, ServerResponse } from 'http'
import { vaultService } from '../vault/vault-service.js'
import { getVcsStatus, gitInit, GitError } from '../git/git-client.js'
import {
  createProject,
  deleteProject,
  getProject,
  listProjects,
  ProjectError,
  type CreateProjectInput,
} from '../db/repositories/projects.js'

const SESSION_HEADER = 'x-engrenacode-session'

// ── Helpers ────────────────────────────────────────────────────────────────

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(body))
}

function sendError(res: ServerResponse, status: number, code: string, message: string, details?: object): void {
  sendJson(res, status, { error: { code, message, ...(details ? { details } : {}) } })
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
  if (raw.trim() === '') return {} as T
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
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

function handleProjectError(res: ServerResponse, err: unknown): void {
  if (err instanceof ProjectError) {
    const status = err.code === 'project_duplicate' ? 409 : 400
    sendError(res, status, err.code, err.message, err.details)
    return
  }
  console.error('[projects-handler] Unhandled error:', err)
  sendError(res, 500, 'internal_error', 'Erro interno.')
}

// ── CRUD handlers ────────────────────────────────────────────────────────────

function handleListProjects(_req: IncomingMessage, res: ServerResponse): void {
  sendJson(res, 200, { projects: listProjects() })
}

async function handleCreateProject(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const data = parseBody<CreateProjectInput>(await readBody(req))
  if (data === null || typeof data.path !== 'string') {
    return sendError(res, 400, 'invalid_request', 'Corpo inválido.')
  }

  try {
    const project = createProject(data)
    sendJson(res, 201, { project })
  } catch (err) {
    handleProjectError(res, err)
  }
}

function handleDeleteProject(_req: IncomingMessage, res: ServerResponse, id: string): void {
  const project = getProject(id)
  if (project === null) return sendError(res, 404, 'project_not_found', 'Projeto não encontrado.')
  deleteProject(id)
  sendJson(res, 204, undefined)
}

async function handleGitInit(_req: IncomingMessage, res: ServerResponse, id: string): Promise<void> {
  const project = getProject(id)
  if (project === null) return sendError(res, 404, 'project_not_found', 'Projeto não encontrado.')

  try {
    const result = await gitInit(project.path)
    sendJson(res, 200, result)
  } catch (err) {
    if (err instanceof GitError) return sendError(res, 500, err.code, err.message)
    console.error('[projects-handler] git-init error:', err)
    sendError(res, 500, 'internal_error', 'Não foi possível inicializar o Git.')
  }
}

async function handleVcsStatus(_req: IncomingMessage, res: ServerResponse, id: string): Promise<void> {
  const project = getProject(id)
  if (project === null) return sendError(res, 404, 'project_not_found', 'Projeto não encontrado.')

  try {
    const status = await getVcsStatus(project.path)
    sendJson(res, 200, status)
  } catch (err) {
    console.error('[projects-handler] vcs-status error:', err)
    sendError(res, 500, 'internal_error', 'Não foi possível ler o status do repositório.')
  }
}

// ── Router ──────────────────────────────────────────────────────────────────

const PROJECT_ID_RE = /^\/api\/projects\/([^/]+)$/
const GIT_INIT_RE = /^\/api\/projects\/([^/]+)\/git-init$/
const VCS_STATUS_RE = /^\/api\/projects\/([^/]+)\/vcs-status$/

export async function handleProjectsRequest(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  const url = (req.url ?? '').split('?')[0]
  const method = req.method ?? ''

  if (!url.startsWith('/api/projects')) return false
  if (url !== '/api/projects' && !PROJECT_ID_RE.test(url) && !GIT_INIT_RE.test(url) && !VCS_STATUS_RE.test(url)) {
    return false
  }

  if (!guard(req, res)) return true

  try {
    if (method === 'GET' && url === '/api/projects') {
      handleListProjects(req, res)
      return true
    }
    if (method === 'POST' && url === '/api/projects') {
      await handleCreateProject(req, res)
      return true
    }

    const idMatch = PROJECT_ID_RE.exec(url)
    if (idMatch && method === 'DELETE') {
      handleDeleteProject(req, res, idMatch[1])
      return true
    }

    const gitInitMatch = GIT_INIT_RE.exec(url)
    if (gitInitMatch && method === 'POST') {
      await handleGitInit(req, res, gitInitMatch[1])
      return true
    }

    const vcsMatch = VCS_STATUS_RE.exec(url)
    if (vcsMatch && method === 'GET') {
      await handleVcsStatus(req, res, vcsMatch[1])
      return true
    }
  } catch (err) {
    console.error('[projects-handler] Unhandled error:', err)
    if (!res.headersSent) sendError(res, 500, 'internal_error', 'Erro interno.')
    return true
  }

  return false
}
