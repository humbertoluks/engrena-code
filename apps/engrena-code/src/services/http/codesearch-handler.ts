import type { IncomingMessage, ServerResponse } from 'node:http'
import { guard, sendError, sendJson } from './_transport.js'
import { getProject } from '../db/repositories/projects.js'
import { indexProject, searchProject } from '../codesearch/code-index.js'

const CODESEARCH_RE = /^\/api\/projects\/([^/]+)\/codesearch$/

const DEFAULT_LIMIT = 3
const MAX_LIMIT = 10

/**
 * `#codebase`: busca trechos relevantes do projeto para virarem contexto do turno.
 *
 * A indexação roda aqui, no pedido, e é incremental por mtime — o primeiro uso paga o custo do
 * repositório inteiro e os seguintes só o que mudou.
 */
export async function handleCodesearchRequest(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  const url = (req.url ?? '').split('?')[0]
  const match = CODESEARCH_RE.exec(url)
  if (!match || (req.method ?? '') !== 'GET') return false
  if (!guard(req, res)) return true

  const project = getProject(match[1])
  if (project === null) {
    sendError(res, 404, 'project_not_found', 'Projeto não encontrado.')
    return true
  }

  const params = new URL(req.url ?? '', 'http://127.0.0.1').searchParams
  const query = params.get('q') ?? ''
  if (query.trim() === '') {
    sendError(res, 400, 'validation_error', 'q é obrigatório.')
    return true
  }
  const rawLimit = Number.parseInt(params.get('limit') ?? '', 10)
  const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), MAX_LIMIT) : DEFAULT_LIMIT

  try {
    indexProject(project.id, project.path)
  } catch (err: unknown) {
    // Índice é conveniência: falhar aqui não pode impedir a busca no que já existe.
    console.error('[codesearch] indexação falhou:', err)
  }

  sendJson(res, 200, { hits: searchProject(project.id, query, limit) })
  return true
}
