import type { IncomingMessage, ServerResponse } from 'http'
import { guard, parseBody, readBody, sendError, sendJson } from './_transport.js'
import { getProject, setMemoryEnabled } from '../db/repositories/projects.js'
import { readJournal, getEntryCount, getLastEntryAt, getJournalSizeBytes } from '../vault/memory-service.js'

const STATUS_RE = /^\/api\/projects\/([^/]+)\/memory\/status$/
const JOURNAL_RE = /^\/api\/projects\/([^/]+)\/memory\/journal$/

interface MemoryStatusResponse {
  enabled: boolean
  entryCount: number
  lastEntryAt: string | null
  sizeBytes: number
  corrupted: boolean
}

function buildStatus(projectId: string, enabled: boolean): MemoryStatusResponse {
  const { corrupted } = readJournal(projectId)
  return {
    enabled,
    entryCount: getEntryCount(projectId),
    lastEntryAt: getLastEntryAt(projectId),
    sizeBytes: getJournalSizeBytes(projectId),
    corrupted,
  }
}

function handleGetStatus(res: ServerResponse, projectId: string): void {
  const project = getProject(projectId)
  if (project === null) return sendError(res, 404, 'project_not_found', 'Projeto não encontrado.')
  sendJson(res, 200, buildStatus(projectId, project.memoryEnabled))
}

async function handlePatchStatus(req: IncomingMessage, res: ServerResponse, projectId: string): Promise<void> {
  const project = getProject(projectId)
  if (project === null) return sendError(res, 404, 'project_not_found', 'Projeto não encontrado.')

  const data = parseBody<{ enabled?: unknown }>(await readBody(req))
  if (data === null || typeof data.enabled !== 'boolean') {
    return sendError(res, 400, 'validation_error', 'Campo "enabled" (boolean) é obrigatório.')
  }

  const updated = setMemoryEnabled(projectId, data.enabled)
  if (updated === null) return sendError(res, 404, 'project_not_found', 'Projeto não encontrado.')
  sendJson(res, 200, buildStatus(projectId, updated.memoryEnabled))
}

function handleGetJournal(res: ServerResponse, projectId: string): void {
  const project = getProject(projectId)
  if (project === null) return sendError(res, 404, 'project_not_found', 'Projeto não encontrado.')

  const { content, corrupted } = readJournal(projectId)
  sendJson(res, 200, { content, corrupted })
}

export async function handleMemoryRequest(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  const url = (req.url ?? '').split('?')[0]
  const method = req.method ?? ''

  const statusMatch = STATUS_RE.exec(url)
  if (statusMatch) {
    if (method !== 'GET' && method !== 'PATCH') return false
    if (!guard(req, res)) return true
    if (method === 'GET') {
      handleGetStatus(res, statusMatch[1] as string)
    } else {
      await handlePatchStatus(req, res, statusMatch[1] as string)
    }
    return true
  }

  const journalMatch = JOURNAL_RE.exec(url)
  if (journalMatch) {
    if (method !== 'GET') return false
    if (!guard(req, res)) return true
    handleGetJournal(res, journalMatch[1] as string)
    return true
  }

  return false
}
