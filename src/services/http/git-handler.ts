import type { IncomingMessage, ServerResponse } from 'http'
import { randomUUID } from 'crypto'
import { vaultService } from '../vault/vault-service.js'
import { getThread, type Thread } from '../db/repositories/threads.js'
import { getProject, type Project } from '../db/repositories/projects.js'
import { createPullRequest, gitCommit, gitPush, GitError } from '../git/git-client.js'
import { generateGitText, TextgenError, type TextgenMode } from '../git/git-textgen.js'
import type { ProviderUsage } from '../runner/providers/provider-types.js'
import { acquireLease, LeaseBusyError, releaseLease } from '../runner/project-execution.js'
import { resolveThreadCwd } from '../runner/thread-cwd.js'
import { resolveBillingMode, resolveProviderApiKey, resolveTurnCost } from '../runner/provider-resolution.js'
import { createUsageEvent } from '../db/repositories/usage-events.js'
import { createLogEntry } from '../db/repositories/log-entries.js'

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

/** Bloqueio explícito por estado da thread (spec F14 §3.2) — além da lease de projeto, cobre o caso de UI mostrando ação disponível fora de sync. */
function checkThreadBusy(res: ServerResponse, thread: Thread): boolean {
  if (thread.state === 'running' || thread.state === 'stopping') {
    sendError(res, 409, 'thread_busy', 'Ação de git em andamento ou thread em execução.')
    return true
  }
  return false
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
  if (checkThreadBusy(res, resolved.thread)) return

  const data = parseBody<GitCommitBody>(await readBody(req))
  if (data === null || typeof data.subject !== 'string' || data.subject.trim() === '') {
    return sendError(res, 400, 'validation_error', 'subject é obrigatório.')
  }

  await withGitLease(res, resolved.project, threadId, 'git-commit', async () => {
    try {
      const result = await gitCommit(resolveThreadCwd(resolved.thread, resolved.project), data.subject as string, data.body)
      createLogEntry({
        threadId,
        kind: 'git',
        event: `Commit ${result.sha} criado: ${(data.subject as string).trim()}`,
      })
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
  if (checkThreadBusy(res, resolved.thread)) return

  const token = vaultService.getSecret('github:token')
  if (!token) {
    return sendError(res, 400, 'github_token_missing', 'Configure um token do GitHub em Configuração antes de fazer push.')
  }

  await withGitLease(res, resolved.project, threadId, 'git-push', async () => {
    try {
      const result = await gitPush(resolveThreadCwd(resolved.thread, resolved.project), token)
      createLogEntry({ threadId, kind: 'git', event: `Push da branch '${result.branch}' para origin.` })
      sendJson(res, 200, result)
    } catch (err) {
      if (err instanceof GitError) return sendError(res, 500, err.code, err.message)
      throw err
    }
  })
}

interface PrBody {
  title?: string
  body?: string
  branch?: string
  allowHostOverride?: boolean
}

/** Fallback do PRD (§6 Capacidades) quando textgen falhou ou o campo ficou vazio. */
function fallbackPrTitle(thread: Thread): string {
  return `EngrenaCode: ${thread.title ?? thread.id}`
}

async function handlePr(req: IncomingMessage, res: ServerResponse, threadId: string): Promise<void> {
  const resolved = resolveThreadProject(threadId)
  if ('error' in resolved) return sendError(res, 404, resolved.error, 'Não encontrado.')
  if (checkThreadBusy(res, resolved.thread)) return

  const data = parseBody<PrBody>(await readBody(req))
  if (data === null) return sendError(res, 400, 'invalid_request', 'Corpo inválido.')

  const token = vaultService.getSecret('github:token')
  if (!token) {
    return sendError(res, 400, 'github_token_missing', 'Configure um token do GitHub em Configuração antes de abrir PRs.')
  }

  const title = typeof data.title === 'string' && data.title.trim() !== '' ? data.title.trim() : fallbackPrTitle(resolved.thread)
  const body = typeof data.body === 'string' && data.body.trim() !== '' ? data.body : undefined

  await withGitLease(res, resolved.project, threadId, 'pr', async () => {
    try {
      const result = await createPullRequest(resolveThreadCwd(resolved.thread, resolved.project), token, {
        branch: data.branch,
        title,
        body,
      })
      createLogEntry({ threadId, kind: 'git', event: `PR aberto: ${result.url}` })
      sendJson(res, 200, result)
    } catch (err) {
      if (err instanceof GitError) {
        createLogEntry({ threadId, kind: 'git', event: `Falha ao abrir PR: ${err.message}` })
        return sendError(res, 500, err.code, err.message)
      }
      throw err
    }
  })
}

interface GitTextgenBody {
  mode?: string
}

const TEXTGEN_MODES = new Set<string>(['commit', 'pr'])

/** Grava `usage_events source='textgen'` quando o provider reportou tokens (spec F14 §5.4) — mesma regra de custo F11. */
function persistTextgenUsage(project: Project, thread: Thread, usage: ProviderUsage, costUsd: number | null | undefined): void {
  const cost = resolveTurnCost(thread.provider, thread.model, usage, costUsd)
  createUsageEvent({
    turnId: `textgen_${randomUUID()}`,
    projectId: project.id,
    threadId: thread.id,
    source: 'textgen',
    provider: thread.provider,
    model: thread.model,
    billingMode: resolveBillingMode(thread.provider),
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
    cacheReadTokens: usage.cacheReadTokens,
    cacheCreationTokens: usage.cacheCreationTokens,
    ...cost,
  })
}

async function handleGitTextgen(req: IncomingMessage, res: ServerResponse, threadId: string): Promise<void> {
  const resolved = resolveThreadProject(threadId)
  if ('error' in resolved) return sendError(res, 404, resolved.error, 'Não encontrado.')
  if (checkThreadBusy(res, resolved.thread)) return

  const data = parseBody<GitTextgenBody>(await readBody(req))
  if (data === null || typeof data.mode !== 'string' || !TEXTGEN_MODES.has(data.mode)) {
    return sendError(res, 400, 'validation_error', 'mode deve ser "commit" ou "pr".')
  }
  const mode = data.mode as TextgenMode

  await withGitLease(res, resolved.project, threadId, 'git-textgen', async () => {
    try {
      const result = await generateGitText({
        mode,
        provider: resolved.thread.provider,
        model: resolved.thread.model,
        apiKey: resolveProviderApiKey(resolved.thread.provider),
        cwd: resolveThreadCwd(resolved.thread, resolved.project),
      })

      if (result.usage) {
        persistTextgenUsage(resolved.project, resolved.thread, result.usage, result.costUsd)
      }

      sendJson(res, 200, { subject: result.subject, body: result.body, title: result.title })
    } catch (err) {
      if (err instanceof TextgenError) return sendError(res, 502, err.code, err.message)
      throw err
    }
  })
}

// ── Router ──────────────────────────────────────────────────────────────────

const GIT_COMMIT_RE = /^\/api\/threads\/([^/]+)\/git-commit$/
const GIT_PUSH_RE = /^\/api\/threads\/([^/]+)\/git-push$/
const PR_RE = /^\/api\/threads\/([^/]+)\/pr$/
const GIT_TEXTGEN_RE = /^\/api\/threads\/([^/]+)\/git-textgen$/

export async function handleGitRequest(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  const url = (req.url ?? '').split('?')[0]
  const method = req.method ?? ''

  const matches = GIT_COMMIT_RE.test(url) || GIT_PUSH_RE.test(url) || PR_RE.test(url) || GIT_TEXTGEN_RE.test(url)
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

    const textgenMatch = GIT_TEXTGEN_RE.exec(url)
    if (textgenMatch && method === 'POST') {
      await handleGitTextgen(req, res, textgenMatch[1])
      return true
    }
  } catch (err) {
    console.error('[git-handler] Unhandled error:', err)
    if (!res.headersSent) sendError(res, 500, 'internal_error', 'Erro interno.')
    return true
  }

  return false
}
