import type { IncomingMessage, ServerResponse } from 'http'
import { vaultService } from '../vault/vault-service.js'
import { getThread } from '../db/repositories/threads.js'
import { listMessagesForThread, listToolCallsForThread } from '../db/repositories/messages.js'
import { listDiffsForThread } from '../db/repositories/diffs.js'
import {
  cancelThread,
  dispatchFollowUp,
  dispatchNewThread,
  DispatchValidationError,
  type DispatchFollowUpInput,
  type DispatchNewThreadInput,
} from '../runner/dispatch.js'
import { LeaseBusyError } from '../runner/project-execution.js'
import { emit } from '../runner/ws-hub.js'

const SESSION_HEADER = 'x-engrenacode-session'
const PROVIDERS = ['claude', 'codex', 'kimi'] as const
const ACCESS_LEVELS = ['supervised', 'auto-accept-edits', 'full-access'] as const
const EXECUTION_MODES = ['main', 'worktree'] as const

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
    threadId: err.info.ownerThreadId,
    ownerType: err.info.ownerType,
    operation: err.info.operation,
    ownerThreadId: err.info.ownerThreadId,
    startedAt: err.info.startedAt,
  }
}

function handleDispatchError(res: ServerResponse, err: unknown): void {
  if (err instanceof LeaseBusyError) {
    sendError(res, 409, 'thread_busy', err.message, threadBusyDetails(err))
    return
  }
  if (err instanceof DispatchValidationError) {
    const status = err.code === 'project_not_found' || err.code === 'thread_not_found' ? 404 : 400
    sendError(res, status, err.code, err.message)
    return
  }
  console.error('[threads-handler] Unhandled dispatch error:', err)
  sendError(res, 500, 'internal_error', 'Erro interno.')
}

function streamPathFor(threadId: string): { ws: string } {
  return { ws: `/?threadId=${threadId}` }
}

// ── Dispatch handlers ────────────────────────────────────────────────────────

interface CreateThreadBody {
  prompt?: string
  provider?: string
  model?: string | null
  accessLevel?: string
  executionMode?: string
}

async function handleCreateThread(req: IncomingMessage, res: ServerResponse, projectId: string): Promise<void> {
  const data = parseBody<CreateThreadBody>(await readBody(req))
  if (data === null) return sendError(res, 400, 'invalid_request', 'Corpo inválido.')

  if (typeof data.prompt !== 'string' || data.prompt.trim() === '') {
    return sendError(res, 400, 'validation_error', 'prompt é obrigatório.')
  }
  if (typeof data.provider !== 'string' || !(PROVIDERS as readonly string[]).includes(data.provider)) {
    return sendError(res, 400, 'validation_error', 'provider deve ser claude, codex ou kimi.')
  }
  if (typeof data.accessLevel !== 'string' || !(ACCESS_LEVELS as readonly string[]).includes(data.accessLevel)) {
    return sendError(res, 400, 'validation_error', 'accessLevel inválido.')
  }
  if (typeof data.executionMode !== 'string' || !(EXECUTION_MODES as readonly string[]).includes(data.executionMode)) {
    return sendError(res, 400, 'validation_error', 'executionMode inválido.')
  }

  try {
    const thread = dispatchNewThread({
      projectId,
      prompt: data.prompt,
      provider: data.provider as DispatchNewThreadInput['provider'],
      model: data.model ?? null,
      accessLevel: data.accessLevel as DispatchNewThreadInput['accessLevel'],
      executionMode: data.executionMode as DispatchNewThreadInput['executionMode'],
    })
    sendJson(res, 201, { thread, stream: streamPathFor(thread.id) })
  } catch (err) {
    handleDispatchError(res, err)
  }
}

interface FollowUpBody {
  prompt?: string
  provider?: string
  model?: string | null
  accessLevel?: string
  executionMode?: string
}

async function handleFollowUp(req: IncomingMessage, res: ServerResponse, threadId: string): Promise<void> {
  const data = parseBody<FollowUpBody>(await readBody(req))
  if (data === null) return sendError(res, 400, 'invalid_request', 'Corpo inválido.')

  if (data.provider !== undefined) {
    return sendError(res, 400, 'validation_error', 'provider é imutável após a criação da thread.')
  }
  if (data.executionMode !== undefined) {
    return sendError(res, 400, 'validation_error', 'executionMode é travado após o primeiro envio.')
  }
  if (typeof data.prompt !== 'string' || data.prompt.trim() === '') {
    return sendError(res, 400, 'validation_error', 'prompt é obrigatório.')
  }
  if (data.accessLevel !== undefined && !(ACCESS_LEVELS as readonly string[]).includes(data.accessLevel)) {
    return sendError(res, 400, 'validation_error', 'accessLevel inválido.')
  }

  const input: DispatchFollowUpInput = { threadId, prompt: data.prompt }
  if (data.model !== undefined) input.model = data.model
  if (data.accessLevel !== undefined) input.accessLevel = data.accessLevel as DispatchFollowUpInput['accessLevel']

  try {
    const thread = dispatchFollowUp(input)
    sendJson(res, 201, { thread, stream: streamPathFor(thread.id) })
  } catch (err) {
    handleDispatchError(res, err)
  }
}

function handleHistory(_req: IncomingMessage, res: ServerResponse, threadId: string): void {
  const thread = getThread(threadId)
  if (thread === null) return sendError(res, 404, 'thread_not_found', 'Thread não encontrada.')
  sendJson(res, 200, {
    messages: listMessagesForThread(threadId),
    toolCalls: listToolCallsForThread(threadId),
  })
}

function handleDiffsList(_req: IncomingMessage, res: ServerResponse, threadId: string): void {
  const thread = getThread(threadId)
  if (thread === null) return sendError(res, 404, 'thread_not_found', 'Thread não encontrada.')
  sendJson(res, 200, { diffs: listDiffsForThread(threadId) })
}

function handleCancel(_req: IncomingMessage, res: ServerResponse, threadId: string): void {
  const thread = getThread(threadId)
  if (thread === null) return sendError(res, 404, 'thread_not_found', 'Thread não encontrada.')
  const cancelled = cancelThread(threadId)
  sendJson(res, 200, { cancelled })
}

interface PermissionBody {
  requestId?: string
  allow?: boolean
}

async function handlePermission(req: IncomingMessage, res: ServerResponse, threadId: string): Promise<void> {
  const thread = getThread(threadId)
  if (thread === null) return sendError(res, 404, 'thread_not_found', 'Thread não encontrada.')

  const data = parseBody<PermissionBody>(await readBody(req))
  if (data === null || typeof data.requestId !== 'string' || typeof data.allow !== 'boolean') {
    return sendError(res, 400, 'invalid_request', 'Corpo inválido.')
  }

  emit(threadId, { type: 'permission.resolved', threadId, requestId: data.requestId, allow: data.allow })
  sendJson(res, 200, { resolved: true })
}

// ── Router ──────────────────────────────────────────────────────────────────

const CREATE_THREAD_RE = /^\/api\/projects\/([^/]+)\/threads$/
const MESSAGES_RE = /^\/api\/threads\/([^/]+)\/messages$/
const HISTORY_RE = /^\/api\/threads\/([^/]+)\/history$/
const DIFFS_RE = /^\/api\/threads\/([^/]+)\/diffs$/
const CANCEL_RE = /^\/api\/threads\/([^/]+)\/cancel$/
const PERMISSION_RE = /^\/api\/threads\/([^/]+)\/permission$/

export async function handleThreadsRequest(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  const url = (req.url ?? '').split('?')[0]
  const method = req.method ?? ''

  const matchesThreadsRoute =
    CREATE_THREAD_RE.test(url) ||
    MESSAGES_RE.test(url) ||
    HISTORY_RE.test(url) ||
    DIFFS_RE.test(url) ||
    CANCEL_RE.test(url) ||
    PERMISSION_RE.test(url)

  if (!matchesThreadsRoute) return false

  if (!guard(req, res)) return true

  try {
    const createMatch = CREATE_THREAD_RE.exec(url)
    if (createMatch && method === 'POST') {
      await handleCreateThread(req, res, createMatch[1])
      return true
    }

    const messagesMatch = MESSAGES_RE.exec(url)
    if (messagesMatch && method === 'POST') {
      await handleFollowUp(req, res, messagesMatch[1])
      return true
    }

    const historyMatch = HISTORY_RE.exec(url)
    if (historyMatch && method === 'GET') {
      handleHistory(req, res, historyMatch[1])
      return true
    }

    const diffsMatch = DIFFS_RE.exec(url)
    if (diffsMatch && method === 'GET') {
      handleDiffsList(req, res, diffsMatch[1])
      return true
    }

    const cancelMatch = CANCEL_RE.exec(url)
    if (cancelMatch && method === 'POST') {
      handleCancel(req, res, cancelMatch[1])
      return true
    }

    const permissionMatch = PERMISSION_RE.exec(url)
    if (permissionMatch && method === 'POST') {
      await handlePermission(req, res, permissionMatch[1])
      return true
    }
  } catch (err) {
    console.error('[threads-handler] Unhandled error:', err)
    if (!res.headersSent) sendError(res, 500, 'internal_error', 'Erro interno.')
    return true
  }

  return false
}
