import type { IncomingMessage, ServerResponse } from 'http'
import { vaultService } from '../vault/vault-service.js'
import { listLogEntries, type LogKind } from '../db/repositories/log-entries.js'

const SESSION_HEADER = 'x-engrenacode-session'
const DEFAULT_LIMIT = 100
const VALID_KINDS: ReadonlySet<LogKind> = new Set(['task', 'tool', 'git'])

// ── Helpers ────────────────────────────────────────────────────────────────

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(body))
}

function sendError(res: ServerResponse, status: number, code: string, message: string): void {
  sendJson(res, status, { error: { code, message } })
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

/** Parseia um inteiro >= 0 de query string; retorna undefined se ausente, null se inválido. */
function parseNonNegativeInt(raw: string | null): number | undefined | null {
  if (raw === null) return undefined
  const value = Number(raw)
  if (!Number.isInteger(value) || value < 0) return null
  return value
}

// ── Handler ────────────────────────────────────────────────────────────────

function handleGetLogs(req: IncomingMessage, res: ServerResponse): void {
  const url = new URL(req.url ?? '', 'http://localhost')

  const kindRaw = url.searchParams.get('kind')
  if (kindRaw !== null && !VALID_KINDS.has(kindRaw as LogKind)) {
    return sendError(res, 400, 'validation_error', 'kind deve ser task, tool ou git.')
  }

  const limit = parseNonNegativeInt(url.searchParams.get('limit'))
  if (limit === null) return sendError(res, 400, 'validation_error', 'limit deve ser inteiro >= 0.')

  const offset = parseNonNegativeInt(url.searchParams.get('offset'))
  if (offset === null) return sendError(res, 400, 'validation_error', 'offset deve ser inteiro >= 0.')

  const entries = listLogEntries({
    ...(kindRaw !== null ? { kind: kindRaw as LogKind } : {}),
    limit: limit ?? DEFAULT_LIMIT,
    offset: offset ?? 0,
  })

  sendJson(res, 200, { entries })
}

// ── Router ──────────────────────────────────────────────────────────────────

export function handleLogsRequest(req: IncomingMessage, res: ServerResponse): boolean {
  const url = (req.url ?? '').split('?')[0]
  const method = req.method ?? ''

  if (url !== '/api/logs') return false
  if (!guard(req, res)) return true

  try {
    if (method === 'GET') {
      handleGetLogs(req, res)
      return true
    }
  } catch (err) {
    console.error('[logs-handler] Unhandled error:', err)
    if (!res.headersSent) sendError(res, 500, 'internal_error', 'Erro interno.')
    return true
  }

  return false
}
