import type { IncomingMessage, ServerResponse } from 'http'
import { vaultService } from '../vault/vault-service.js'
import {
  createRule,
  deleteRule,
  getCounts,
  getRule,
  listProjectRules,
  listRules,
  RuleError,
  setProjectRuleLink,
  unlinkProjectRule,
  updateRule,
  type CreateRuleInput,
  type UpdateRuleInput,
} from '../db/repositories/rules.js'

const SESSION_HEADER = 'x-engrenacode-session'

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

function handleRuleError(res: ServerResponse, err: unknown): void {
  if (err instanceof RuleError) {
    const status = err.code === 'rule_name_conflict' ? 409 : err.code === 'rule_not_found' ? 404 : err.code === 'too_long' ? 400 : 400
    sendError(res, status, err.code, err.message)
    return
  }
  console.error('[rules-handler] Unhandled error:', err)
  sendError(res, 500, 'internal_error', 'Erro interno.')
}

// ── CRUD handlers ─────────────────────────────────────────────────────────────

function handleListRules(_req: IncomingMessage, res: ServerResponse): void {
  sendJson(res, 200, { rules: listRules() })
}

async function handleCreateRule(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const data = parseBody<CreateRuleInput>(await readBody(req))
  if (data === null || typeof data.name !== 'string' || typeof data.content !== 'string') {
    return sendError(res, 400, 'invalid_request', 'Corpo inválido.')
  }

  try {
    const rule = createRule(data)
    sendJson(res, 201, { rule })
  } catch (err) {
    handleRuleError(res, err)
  }
}

async function handleUpdateRule(req: IncomingMessage, res: ServerResponse, id: string): Promise<void> {
  const data = parseBody<UpdateRuleInput>(await readBody(req))
  if (data === null) return sendError(res, 400, 'invalid_request', 'Corpo inválido.')

  try {
    const rule = updateRule(id, data)
    if (rule === null) return sendError(res, 404, 'rule_not_found', 'Rule não encontrada.')
    sendJson(res, 200, { rule })
  } catch (err) {
    handleRuleError(res, err)
  }
}

function handleDeleteRule(_req: IncomingMessage, res: ServerResponse, id: string): void {
  const rule = getRule(id)
  if (rule === null) return sendError(res, 404, 'rule_not_found', 'Rule não encontrada.')
  deleteRule(id)
  sendJson(res, 200, { deleted: true })
}

function handleCounts(_req: IncomingMessage, res: ServerResponse): void {
  sendJson(res, 200, getCounts())
}

// ── Project link handlers ─────────────────────────────────────────────────────

function handleListProjectRules(_req: IncomingMessage, res: ServerResponse, projectId: string): void {
  sendJson(res, 200, { rules: listProjectRules(projectId) })
}

async function handleSetProjectRuleLink(
  req: IncomingMessage,
  res: ServerResponse,
  projectId: string,
  ruleId: string
): Promise<void> {
  const data = parseBody<{ enabled?: boolean; sortOrder?: number }>(await readBody(req))
  if (data === null) return sendError(res, 400, 'invalid_request', 'Corpo inválido.')

  try {
    const state = setProjectRuleLink(projectId, ruleId, data)
    sendJson(res, 200, { rule: state })
  } catch (err) {
    handleRuleError(res, err)
  }
}

function handleUnlinkProjectRule(_req: IncomingMessage, res: ServerResponse, projectId: string, ruleId: string): void {
  const unlinked = unlinkProjectRule(projectId, ruleId)
  sendJson(res, 200, { unlinked })
}

// ── Router ──────────────────────────────────────────────────────────────────

const RULE_ID_RE = /^\/api\/rules\/([^/]+)$/
const PROJECT_RULES_RE = /^\/api\/projects\/([^/]+)\/rules$/
const PROJECT_RULE_LINK_RE = /^\/api\/projects\/([^/]+)\/rules\/([^/]+)$/

export async function handleRulesRequest(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  const url = (req.url ?? '').split('?')[0]
  const method = req.method ?? ''

  if (!url.startsWith('/api/rules') && !url.startsWith('/api/projects/')) return false
  if (url.startsWith('/api/projects/') && !PROJECT_RULES_RE.test(url) && !PROJECT_RULE_LINK_RE.test(url)) return false

  if (!guard(req, res)) return true

  try {
    if (method === 'GET' && url === '/api/rules') {
      handleListRules(req, res)
      return true
    }
    if (method === 'GET' && url === '/api/rules/counts') {
      handleCounts(req, res)
      return true
    }
    if (method === 'POST' && url === '/api/rules') {
      await handleCreateRule(req, res)
      return true
    }

    const ruleIdMatch = RULE_ID_RE.exec(url)
    if (ruleIdMatch && method === 'PUT') {
      await handleUpdateRule(req, res, ruleIdMatch[1])
      return true
    }
    if (ruleIdMatch && method === 'DELETE') {
      handleDeleteRule(req, res, ruleIdMatch[1])
      return true
    }

    const projectRulesMatch = PROJECT_RULES_RE.exec(url)
    if (projectRulesMatch && method === 'GET') {
      handleListProjectRules(req, res, projectRulesMatch[1])
      return true
    }

    const linkMatch = PROJECT_RULE_LINK_RE.exec(url)
    if (linkMatch && method === 'PUT') {
      await handleSetProjectRuleLink(req, res, linkMatch[1], linkMatch[2])
      return true
    }
    if (linkMatch && method === 'DELETE') {
      handleUnlinkProjectRule(req, res, linkMatch[1], linkMatch[2])
      return true
    }
  } catch (err) {
    console.error('[rules-handler] Unhandled error:', err)
    if (!res.headersSent) sendError(res, 500, 'internal_error', 'Erro interno.')
    return true
  }

  return false
}
