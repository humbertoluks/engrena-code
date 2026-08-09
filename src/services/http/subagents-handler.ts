import type { IncomingMessage, ServerResponse } from 'http'
import { guard, parseBody, readBody, sendError, sendJson, sendTransportError } from './_transport.js'
import {
  CatalogOrderError,
  createSubagent,
  getSubagentCounts,
  listProjectSubagents,
  listSubagents,
  removeSubagent,
  setSubagentCatalogOrder,
  SubagentNameConflictError,
  SubagentNotFoundError,
  SubagentTooLongError,
  SubagentValidationError,
  unlinkProjectSubagent,
  updateSubagent,
  upsertProjectSubagentLink,
  type CatalogOrderItem,
  type SubagentInput,
  type SubagentPatch,
} from '../db/repositories/subagents.js'

/**
 * Narrowing na fronteira HTTP antes do cast pro repositório (R-http-body-narrowing-gap).
 * `name`/`description`/`prompt`/`provider`/`kind`/`idleTimeoutMinutes` já são `typeof`/enum-checados
 * dentro de `validateInput` no repositório (`SubagentValidationError` → 400 `validation_error`) — não
 * duplicar aqui, ou o mesmo campo passaria a devolver dois `error.code` diferentes dependendo de qual
 * checagem roda primeiro. O gap real é `model`/`reasoningLevel`/`category`/`tools`/`enabled`: nenhum
 * deles é validado em lugar nenhum hoje, então um tipo errado nunca vira 400 — no melhor caso é
 * gravado errado no SQLite (`enabled` truthy mesmo com `"false"` string), no pior derruba o bind do
 * better-sqlite3 (`TypeError` não tratado → 500).
 */
function invalidSubagentInputField(data: Partial<SubagentInput>): string | null {
  if (data.model !== undefined && data.model !== null && typeof data.model !== 'string') return 'model'
  if (data.reasoningLevel !== undefined && data.reasoningLevel !== null && typeof data.reasoningLevel !== 'string') return 'reasoningLevel'
  if (data.category !== undefined && data.category !== null && typeof data.category !== 'string') return 'category'
  if (
    data.tools !== undefined &&
    data.tools !== null &&
    (!Array.isArray(data.tools) || data.tools.some((t) => typeof t !== 'string'))
  ) {
    return 'tools'
  }
  if (data.enabled !== undefined && typeof data.enabled !== 'boolean') return 'enabled'
  return null
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
  if (!guard(req, res)) return
  sendJson(res, 200, { subagents: listSubagents() })
}

async function handleCreate(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (!guard(req, res)) return
  const data = parseBody<Partial<SubagentInput>>(await readBody(req))
  if (data === null) {
    return sendError(res, 400, 'invalid_request', 'Corpo inválido.')
  }
  const invalidField = invalidSubagentInputField(data)
  if (invalidField !== null) {
    return sendError(res, 400, 'invalid_request', `Campo "${invalidField}" tem tipo inválido.`)
  }
  try {
    const subagent = createSubagent(data as SubagentInput)
    sendJson(res, 201, { subagent })
  } catch (err) {
    if (!handleKnownError(res, err)) throw err
  }
}

async function handleUpdate(req: IncomingMessage, res: ServerResponse, id: string): Promise<void> {
  if (!guard(req, res)) return
  const data = parseBody<SubagentPatch>(await readBody(req))
  if (data === null) {
    return sendError(res, 400, 'invalid_request', 'Corpo inválido.')
  }
  const invalidField = invalidSubagentInputField(data)
  if (invalidField !== null) {
    return sendError(res, 400, 'invalid_request', `Campo "${invalidField}" tem tipo inválido.`)
  }
  try {
    const subagent = updateSubagent(id, data)
    sendJson(res, 200, { subagent })
  } catch (err) {
    if (!handleKnownError(res, err)) throw err
  }
}

async function handleDelete(req: IncomingMessage, res: ServerResponse, id: string): Promise<void> {
  if (!guard(req, res)) return
  removeSubagent(id)
  sendJson(res, 200, { deleted: true })
}

async function handleCounts(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (!guard(req, res)) return
  sendJson(res, 200, getSubagentCounts())
}

// ── /api/projects/:id/subagents* ────────────────────────────────────────────

async function handleListProjectLinks(req: IncomingMessage, res: ServerResponse, projectId: string): Promise<void> {
  if (!guard(req, res)) return
  sendJson(res, 200, listProjectSubagents(projectId))
}

async function handleUpsertLink(
  req: IncomingMessage,
  res: ServerResponse,
  projectId: string,
  subagentId: string
): Promise<void> {
  if (!guard(req, res)) return
  const data = parseBody<{ enabled?: boolean; sortOrder?: number }>(await readBody(req))
  if (data === null) {
    return sendError(res, 400, 'invalid_request', 'Corpo inválido.')
  }
  try {
    const link = upsertProjectSubagentLink(projectId, subagentId, data)
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
  if (!guard(req, res)) return
  unlinkProjectSubagent(projectId, subagentId)
  sendJson(res, 200, { deleted: true })
}

async function handleCatalogOrder(req: IncomingMessage, res: ServerResponse, projectId: string): Promise<void> {
  if (!guard(req, res)) return
  const data = parseBody<{ kind?: string; items?: CatalogOrderItem[] }>(await readBody(req))
  if (data === null || data.kind !== 'subagents' || !Array.isArray(data.items)) {
    return sendError(res, 400, 'invalid_request', 'kind deve ser "subagents" e items é obrigatório.')
  }
  try {
    const subagents = setSubagentCatalogOrder(projectId, data.items)
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
    if (sendTransportError(res, err)) return true
    console.error('[subagents-handler] Unhandled error:', err)
    if (!res.headersSent) {
      sendError(res, 500, 'internal_error', 'Erro interno.')
    }
    return true
  }

  return false
}
