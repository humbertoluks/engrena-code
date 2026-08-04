import type { IncomingMessage, ServerResponse } from 'http'
import { vaultService } from '../vault/vault-service.js'
import { getThread, type Thread } from '../db/repositories/threads.js'
import { getProject, type Project } from '../db/repositories/projects.js'
import { createPullRequest, gitCommit, gitPush, GitError } from '../git/git-client.js'
import { acquireLease, LeaseBusyError, releaseLease } from '../runner/project-execution.js'

const SESSION_HEADER = 'x-engrenacode-session'

// ── Helpers ────────────────────────────────────────────────────────────────

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(body === undefined ? undefined : JSON.stringify(body))
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

function threadBusyDetails(err: LeaseBusyError): object {
  return {
    ownerType: err.info.ownerType,
    operation: err.info.operation,
    ownerThreadId: err.info.ownerThreadId,
    startedAt: err.info.startedAt,
  }
}

interface Resolved {
  thread: Thread
  project: Project
}

function resolveThreadProject(threadId: string): Resolved | { error: 'thread_not_found' | 'project_not_found' } {
  const thread = getThread(threadId)
  if (thread === null) return { error: 'thread_not_found' }
  const project = getProject(thread.projectId)
  if (project === null) return { error: 'project_not_found' }
  return { thread, project }
}

function withGitLease<T>(res: ServerResponse, project: Project, threadId: string, operation: string, run: () => Promise<T>): Promise<T | undefined> {
  try {
    acquireLease(project.id, 'git', operation, threadId)
  } catch (err) {
    if (err instanceof LeaseBusyError) {
      sendError(res, 409, 'thread_busy', err.message, threadBusyDetails(err))
      return Promise.resolve(undefined)
    }
    throw err
  }

  return run().finally(() => releaseLease(project.id))
}

// ── Handlers ────────────────────────────────────────────────────────────────

interface GitCommitBody {
  subject?: string
  body?: string
}

async function handleGitCommit(req: IncomingMessage, res: ServerResponse, threadId: string): Promise<void> {
  const resolved = resolveThreadProject(threadId)
  if ('error' in resolved) return sendError(res, 404, resolved.error, 'Não encontrado.')

  const data = parseBody<GitCommitBody>(await readBody(req))
  if (data === null || typeof data.subject !== 'string' || data.subject.trim() === '') {
    return sendError(res, 400, 'validation_error', 'subject é obrigatório.')
  }

  await withGitLease(res, resolved.project, threadId, 'git-commit', async () => {
    try {
      const result = await gitCommit(resolved.project.path, data.subject as string, data.body)
      sendJson(res, 200, result)
    } catch (err) {
      if (err instanceof GitError) return sendError(res, 500, err.code, err.message)
      throw err
    }
  })
}

async function handleGitPush(_req: IncomingMessage, res: ServerResponse, threadId: string): Promise<void> {
  const resolved = resolveThreadProject(threadId)
  if ('error' in resolved) return sendError(res, 404, resolved.error, 'Não encontrado.')

  await withGitLease(res, resolved.project, threadId, 'git-push', async () => {
    try {
      const token = vaultService.getSecret('github:token')
      const result = await gitPush(resolved.project.path, token ?? null)
      sendJson(res, 200, result)
    } catch (err) {
      if (err instanceof GitError) return sendError(res, 500, err.code, err.message)
      throw err
    }
  })
}

interface PrBody {
  branch?: string
  allowHostOverride?: boolean
}

async function handlePr(req: IncomingMessage, res: ServerResponse, threadId: string): Promise<void> {
  const resolved = resolveThreadProject(threadId)
  if ('error' in resolved) return sendError(res, 404, resolved.error, 'Não encontrado.')

  const data = parseBody<PrBody>(await readBody(req))
  if (data === null) return sendError(res, 400, 'invalid_request', 'Corpo inválido.')

  const token = vaultService.getSecret('github:token')
  if (!token) {
    return sendError(res, 400, 'github_token_missing', 'Configure um token do GitHub em Configuração antes de abrir PRs.')
  }

  await withGitLease(res, resolved.project, threadId, 'pr', async () => {
    try {
      const result = await createPullRequest(resolved.project.path, token, {
        branch: data.branch,
        title: `EngrenaCode: ${resolved.thread.title ?? resolved.thread.id}`,
      })
      sendJson(res, 200, result)
    } catch (err) {
      if (err instanceof GitError) return sendError(res, 500, err.code, err.message)
      throw err
    }
  })
}

// ── Router ──────────────────────────────────────────────────────────────────

const GIT_COMMIT_RE = /^\/api\/threads\/([^/]+)\/git-commit$/
const GIT_PUSH_RE = /^\/api\/threads\/([^/]+)\/git-push$/
const PR_RE = /^\/api\/threads\/([^/]+)\/pr$/

export async function handleGitRequest(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  const url = (req.url ?? '').split('?')[0]
  const method = req.method ?? ''

  const matches = GIT_COMMIT_RE.test(url) || GIT_PUSH_RE.test(url) || PR_RE.test(url)
  if (!matches) return false

  if (!guard(req, res)) return true

  try {
    const commitMatch = GIT_COMMIT_RE.exec(url)
    if (commitMatch && method === 'POST') {
      await handleGitCommit(req, res, commitMatch[1])
      return true
    }

    const pushMatch = GIT_PUSH_RE.exec(url)
    if (pushMatch && method === 'POST') {
      await handleGitPush(req, res, pushMatch[1])
      return true
    }

    const prMatch = PR_RE.exec(url)
    if (prMatch && method === 'POST') {
      await handlePr(req, res, prMatch[1])
      return true
    }
  } catch (err) {
    console.error('[git-handler] Unhandled error:', err)
    if (!res.headersSent) sendError(res, 500, 'internal_error', 'Erro interno.')
    return true
  }

  return false
}
