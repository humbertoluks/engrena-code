import type { IncomingMessage, ServerResponse } from 'http'
import { guard, sendError, sendJson } from './_transport.js'
import { listLogEntries, type LogKind } from '../db/repositories/log-entries.js'

const DEFAULT_LIMIT = 100
const VALID_KINDS: ReadonlySet<LogKind> = new Set(['task', 'tool', 'git'])

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
