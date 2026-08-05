import type { IncomingMessage, ServerResponse } from 'http'
import { vaultService } from '../vault/vault-service.js'
import {
  distinctUnpricedModels,
  getProjectThreadUsage,
  getSummary,
  getThreadEvents,
  listProjectUsage,
  type PeriodFilter,
} from '../db/repositories/usage-events.js'
import {
  createPricing,
  listPricing,
  PricingError,
  updatePricing,
  type CreatePricingInput,
  type UpdatePricingInput,
} from '../db/repositories/pricing.js'
import { getProject } from '../db/repositories/projects.js'
import { getThread } from '../db/repositories/threads.js'

const SESSION_HEADER = 'x-engrenacode-session'
const DEFAULT_LIMIT = 100
const ISO_8601_TZ_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/

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

async function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = ''
    req.on('data', (chunk: Buffer) => {
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

/** `from`/`to` (spec F11 §5): ISO 8601 com timezone; ausentes = sem filtro. */
function parsePeriod(searchParams: URLSearchParams): { period: PeriodFilter } | { error: string } {
  const fromRaw = searchParams.get('from')
  const toRaw = searchParams.get('to')

  let fromMs: number | undefined
  let toMs: number | undefined

  if (fromRaw !== null) {
    if (!ISO_8601_TZ_RE.test(fromRaw) || !Number.isFinite(Date.parse(fromRaw))) {
      return { error: 'Query inválida: from deve ser timestamp ISO 8601 com timezone.' }
    }
    fromMs = Date.parse(fromRaw)
  }

  if (toRaw !== null) {
    if (!ISO_8601_TZ_RE.test(toRaw) || !Number.isFinite(Date.parse(toRaw))) {
      return { error: 'Query inválida: to deve ser timestamp ISO 8601 com timezone.' }
    }
    toMs = Date.parse(toRaw)
  }

  if (fromMs !== undefined && toMs !== undefined && fromMs > toMs) {
    return { error: 'Período inválido: from deve ser anterior ou igual a to.' }
  }

  return { period: { fromMs, toMs } }
}

/** `limit` 1–500 (default 100), `offset` ≥0 (default 0) — spec F11 §5.1. */
function parsePage(searchParams: URLSearchParams): { limit: number; offset: number } | { error: string } {
  const limitRaw = searchParams.get('limit')
  const offsetRaw = searchParams.get('offset')

  let limit = DEFAULT_LIMIT
  if (limitRaw !== null) {
    if (!/^\d+$/.test(limitRaw) || !Number.isSafeInteger(Number(limitRaw))) {
      return { error: 'Query inválida: limit deve ser inteiro entre 1 e 500.' }
    }
    limit = Number(limitRaw)
    if (limit < 1 || limit > 500) {
      return { error: 'Query inválida: limit deve ser inteiro entre 1 e 500.' }
    }
  }

  let offset = 0
  if (offsetRaw !== null) {
    if (!/^\d+$/.test(offsetRaw) || !Number.isSafeInteger(Number(offsetRaw))) {
      return { error: 'Query inválida: offset deve ser inteiro >= 0.' }
    }
    offset = Number(offsetRaw)
  }

  return { limit, offset }
}

// ── Métricas (§5.1) ─────────────────────────────────────────────────────────

function handleGetSummary(req: IncomingMessage, res: ServerResponse): void {
  const url = new URL(req.url ?? '', 'http://localhost')
  const parsed = parsePeriod(url.searchParams)
  if ('error' in parsed) return sendError(res, 400, 'validation_error', parsed.error)

  sendJson(res, 200, getSummary(parsed.period))
}

function handleGetProjects(req: IncomingMessage, res: ServerResponse): void {
  const url = new URL(req.url ?? '', 'http://localhost')
  const parsed = parsePeriod(url.searchParams)
  if ('error' in parsed) return sendError(res, 400, 'validation_error', parsed.error)

  sendJson(res, 200, { projects: listProjectUsage(parsed.period) })
}

function handleGetProjectDetail(req: IncomingMessage, res: ServerResponse, projectId: string): void {
  if (getProject(projectId) === null) return sendError(res, 404, 'not_found', 'Projeto não encontrado.')

  const url = new URL(req.url ?? '', 'http://localhost')
  const parsed = parsePeriod(url.searchParams)
  if ('error' in parsed) return sendError(res, 400, 'validation_error', parsed.error)

  sendJson(res, 200, { threads: getProjectThreadUsage(projectId, parsed.period) })
}

function handleGetThreadEvents(req: IncomingMessage, res: ServerResponse, threadId: string): void {
  if (getThread(threadId) === null) return sendError(res, 404, 'not_found', 'Thread não encontrada.')

  const url = new URL(req.url ?? '', 'http://localhost')
  const period = parsePeriod(url.searchParams)
  if ('error' in period) return sendError(res, 400, 'validation_error', period.error)

  const page = parsePage(url.searchParams)
  if ('error' in page) return sendError(res, 400, 'validation_error', page.error)

  sendJson(res, 200, getThreadEvents(threadId, period.period, page.limit, page.offset))
}

// ── Preços (§5.2) ────────────────────────────────────────────────────────────

function handleListPricing(_req: IncomingMessage, res: ServerResponse): void {
  sendJson(res, 200, { pricing: listPricing(), unpricedModels: distinctUnpricedModels() })
}

interface PricingRequestBody {
  provider?: unknown
  model?: unknown
  inputPerMTok?: unknown
  outputPerMTok?: unknown
  cacheReadPerMTok?: unknown
  cacheWritePerMTok?: unknown
  approximate?: unknown
  source?: unknown
}

function validateRate(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
}

function validateOptionalRate(value: unknown): value is number | null | undefined {
  return value === undefined || value === null || validateRate(value)
}

async function handleCreatePricing(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const body = parseBody<PricingRequestBody>(await readBody(req))
  if (body === null) return sendError(res, 400, 'validation_error', 'Corpo inválido.')

  if (typeof body.provider !== 'string' || body.provider.trim() === '' || typeof body.model !== 'string' || body.model.trim() === '') {
    return sendError(res, 400, 'validation_error', 'provider e model são obrigatórios.')
  }
  if (!validateRate(body.inputPerMTok) || !validateRate(body.outputPerMTok)) {
    return sendError(res, 400, 'validation_error', 'Preencha os preços de entrada e saída.')
  }
  if (!validateOptionalRate(body.cacheReadPerMTok) || !validateOptionalRate(body.cacheWritePerMTok)) {
    return sendError(res, 400, 'validation_error', 'Os preços devem ser números maiores ou iguais a zero.')
  }

  const input: CreatePricingInput = {
    provider: body.provider,
    model: body.model,
    inputPerMTok: body.inputPerMTok,
    outputPerMTok: body.outputPerMTok,
    cacheReadPerMTok: (body.cacheReadPerMTok as number | null | undefined) ?? null,
    cacheWritePerMTok: (body.cacheWritePerMTok as number | null | undefined) ?? null,
    approximate: Boolean(body.approximate),
    source: typeof body.source === 'string' && body.source.trim() !== '' ? body.source.trim() : null,
  }

  try {
    const result = createPricing(input)
    sendJson(res, 201, result)
  } catch (err) {
    handlePricingError(res, err)
  }
}

async function handleUpdatePricing(req: IncomingMessage, res: ServerResponse, id: string): Promise<void> {
  const body = parseBody<PricingRequestBody>(await readBody(req))
  if (body === null) return sendError(res, 400, 'validation_error', 'Corpo inválido.')

  if (body.inputPerMTok !== undefined && !validateRate(body.inputPerMTok)) {
    return sendError(res, 400, 'validation_error', 'Os preços devem ser números maiores ou iguais a zero.')
  }
  if (body.outputPerMTok !== undefined && !validateRate(body.outputPerMTok)) {
    return sendError(res, 400, 'validation_error', 'Os preços devem ser números maiores ou iguais a zero.')
  }
  if (!validateOptionalRate(body.cacheReadPerMTok) || !validateOptionalRate(body.cacheWritePerMTok)) {
    return sendError(res, 400, 'validation_error', 'Os preços devem ser números maiores ou iguais a zero.')
  }

  const input: UpdatePricingInput = {
    inputPerMTok: body.inputPerMTok as number | undefined,
    outputPerMTok: body.outputPerMTok as number | undefined,
    cacheReadPerMTok: body.cacheReadPerMTok as number | null | undefined,
    cacheWritePerMTok: body.cacheWritePerMTok as number | null | undefined,
    approximate: body.approximate === undefined ? undefined : Boolean(body.approximate),
    source: body.source === undefined ? undefined : typeof body.source === 'string' && body.source.trim() !== '' ? body.source.trim() : null,
  }

  try {
    const result = updatePricing(id, input)
    sendJson(res, 200, result)
  } catch (err) {
    handlePricingError(res, err)
  }
}

function handlePricingError(res: ServerResponse, err: unknown): void {
  if (err instanceof PricingError) {
    const status = err.code === 'pricing_conflict' ? 409 : err.code === 'not_found' ? 404 : 400
    sendError(res, status, err.code, err.message)
    return
  }
  console.error('[consumo-handler] Unhandled pricing error:', err)
  sendError(res, 500, 'internal_error', 'Erro interno.')
}

// ── Router ──────────────────────────────────────────────────────────────────

const PROJECT_DETAIL_RE = /^\/api\/metrics\/projects\/([^/]+)$/
const THREAD_EVENTS_RE = /^\/api\/metrics\/threads\/([^/]+)$/
const PRICING_ID_RE = /^\/api\/pricing\/([^/]+)$/

function isConsumoUrl(url: string): boolean {
  return url.startsWith('/api/metrics/') || url === '/api/pricing' || PRICING_ID_RE.test(url)
}

export async function handleConsumoRequest(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  const url = (req.url ?? '').split('?')[0]
  const method = req.method ?? ''

  if (!isConsumoUrl(url)) return false
  if (!guard(req, res)) return true

  try {
    if (method === 'GET' && url === '/api/metrics/summary') {
      handleGetSummary(req, res)
      return true
    }
    if (method === 'GET' && url === '/api/metrics/projects') {
      handleGetProjects(req, res)
      return true
    }

    const projectDetailMatch = PROJECT_DETAIL_RE.exec(url)
    if (projectDetailMatch && method === 'GET') {
      handleGetProjectDetail(req, res, projectDetailMatch[1])
      return true
    }

    const threadEventsMatch = THREAD_EVENTS_RE.exec(url)
    if (threadEventsMatch && method === 'GET') {
      handleGetThreadEvents(req, res, threadEventsMatch[1])
      return true
    }

    if (method === 'GET' && url === '/api/pricing') {
      handleListPricing(req, res)
      return true
    }
    if (method === 'POST' && url === '/api/pricing') {
      await handleCreatePricing(req, res)
      return true
    }

    const pricingIdMatch = PRICING_ID_RE.exec(url)
    if (pricingIdMatch && method === 'PUT') {
      await handleUpdatePricing(req, res, pricingIdMatch[1])
      return true
    }
  } catch (err) {
    console.error('[consumo-handler] Unhandled error:', err)
    if (!res.headersSent) sendError(res, 500, 'internal_error', 'Erro interno.')
    return true
  }

  return false
}
