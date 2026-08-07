import type { IncomingMessage, ServerResponse } from 'http'
import { guard, sendError, sendJson } from './_transport.js'
import { getProject } from '../db/repositories/projects.js'
import { buildIndex } from '../codegraph/indexer.js'
import { getStatusPayload } from '../codegraph/store.js'

const STATUS_RE = /^\/api\/projects\/([^/]+)\/codegraph\/status$/
const REINDEX_RE = /^\/api\/projects\/([^/]+)\/codegraph\/reindex$/

async function handleStatus(res: ServerResponse, projectId: string): Promise<void> {
  const project = getProject(projectId)
  if (project === null) return sendError(res, 404, 'project_not_found', 'Projeto não encontrado.')
  sendJson(res, 200, getStatusPayload(projectId, project.path))
}

async function handleReindex(res: ServerResponse, projectId: string): Promise<void> {
  const project = getProject(projectId)
  if (project === null) return sendError(res, 404, 'project_not_found', 'Projeto não encontrado.')

  try {
    buildIndex(projectId, project.path)
    sendJson(res, 200, getStatusPayload(projectId, project.path))
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[codegraph] reindex failed:', err)
    sendError(res, 500, 'codegraph_index_failed', `Falha ao indexar CodeGraph: ${message}`)
  }
}

export async function handleCodegraphRequest(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  const url = (req.url ?? '').split('?')[0]
  const method = req.method ?? ''

  const statusMatch = STATUS_RE.exec(url)
  if (statusMatch) {
    if (method !== 'GET') return false
    if (!guard(req, res)) return true
    await handleStatus(res, statusMatch[1] as string)
    return true
  }

  const reindexMatch = REINDEX_RE.exec(url)
  if (reindexMatch) {
    if (method !== 'POST') return false
    if (!guard(req, res)) return true
    await handleReindex(res, reindexMatch[1] as string)
    return true
  }

  return false
}
