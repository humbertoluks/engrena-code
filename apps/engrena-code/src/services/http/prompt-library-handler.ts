import type { IncomingMessage, ServerResponse } from 'node:http'
import { guard, parseBody, readBody, sendError, sendJson, sendTransportError } from './_transport.js'
import { getProject } from '../db/repositories/projects.js'
import {
  createChatMode,
  createSavedPrompt,
  deleteChatMode,
  deleteSavedPrompt,
  listChatModes,
  listSavedPrompts,
  updateChatMode,
  updateSavedPrompt,
  PromptNameConflictError,
  PromptNotFoundError,
  PromptValidationError,
  type ChatModePatch,
  type SavedPromptPatch,
} from '../db/repositories/prompt-library.js'
import { readModeFiles, readPromptFiles } from '../prompts/prompt-files.js'

/**
 * Prompts salvos e modos de chat (F28 §3.4) — equivalente a `*.prompt.md` / `*.chatmode.md`.
 *
 * A listagem junta duas origens: as linhas do banco (criadas na UI, editáveis) e os arquivos do
 * repositório (somente leitura). Em choque de nome o do banco vence — é o que o usuário acabou de
 * mexer nesta máquina.
 */

const PROJECT_PROMPTS_RE = /^\/api\/projects\/([^/]+)\/prompts$/
const PROMPT_ID_RE = /^\/api\/prompts\/([^/]+)$/
const PROJECT_MODES_RE = /^\/api\/projects\/([^/]+)\/modes$/
const MODE_ID_RE = /^\/api\/modes\/([^/]+)$/

export interface PromptListItem {
  id: string | null
  name: string
  description: string
  body: string
  source: 'db' | 'file'
  file: string | null
}

export interface ChatModeListItem {
  id: string | null
  name: string
  description: string
  provider: string | null
  model: string | null
  reasoningLevel: string | null
  accessLevel: string | null
  executionMode: string | null
  instructions: string
  /** Skills/rules do projeto que o modo deixa ativas; `null` = não filtra (F28 §3.4). */
  skills: string[] | null
  rules: string[] | null
  source: 'db' | 'file'
  file: string | null
}

export function listPromptsForProject(projectId: string, projectRoot: string): PromptListItem[] {
  const stored: PromptListItem[] = listSavedPrompts(projectId).map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    body: p.body,
    source: 'db',
    file: null,
  }))
  const taken = new Set(stored.map((p) => p.name))
  const fromFiles: PromptListItem[] = readPromptFiles(projectRoot)
    .filter((p) => !taken.has(p.name))
    .map((p) => ({ id: null, name: p.name, description: p.description, body: p.body, source: 'file', file: p.file }))
  return [...stored, ...fromFiles].sort((a, b) => a.name.localeCompare(b.name))
}

export function listModesForProject(projectId: string, projectRoot: string): ChatModeListItem[] {
  const stored: ChatModeListItem[] = listChatModes(projectId).map((m) => ({
    id: m.id,
    name: m.name,
    description: m.description,
    provider: m.provider,
    model: m.model,
    reasoningLevel: m.reasoningLevel,
    accessLevel: m.accessLevel,
    executionMode: m.executionMode,
    instructions: m.instructions,
    skills: m.skills,
    rules: m.rules,
    source: 'db',
    file: null,
  }))
  const taken = new Set(stored.map((m) => m.name))
  const fromFiles: ChatModeListItem[] = readModeFiles(projectRoot)
    .filter((m) => !taken.has(m.name))
    .map((m) => ({
      id: null,
      name: m.name,
      description: m.description,
      provider: m.provider,
      model: m.model,
      reasoningLevel: m.reasoningLevel,
      accessLevel: m.accessLevel,
      executionMode: m.executionMode,
      instructions: m.instructions,
      skills: m.skills,
      rules: m.rules,
      source: 'file',
      file: m.file,
    }))
  return [...stored, ...fromFiles].sort((a, b) => a.name.localeCompare(b.name))
}

function mapRepositoryError(res: ServerResponse, err: unknown): boolean {
  if (err instanceof PromptValidationError) {
    sendError(res, 400, 'validation_error', err.message)
    return true
  }
  if (err instanceof PromptNameConflictError) {
    sendError(res, 409, 'name_conflict', err.message)
    return true
  }
  if (err instanceof PromptNotFoundError) {
    sendError(res, 404, 'not_found', err.message)
    return true
  }
  return false
}

async function handleCreatePrompt(req: IncomingMessage, res: ServerResponse, projectId: string): Promise<void> {
  const data = parseBody<{ name?: string; description?: string; body?: string }>(await readBody(req))
  if (data === null) return sendError(res, 400, 'invalid_request', 'Corpo inválido.')
  if (typeof data.name !== 'string' || typeof data.body !== 'string') {
    return sendError(res, 400, 'validation_error', 'name e body são obrigatórios.')
  }
  try {
    const prompt = createSavedPrompt({
      projectId,
      name: data.name,
      description: data.description,
      body: data.body,
    })
    sendJson(res, 201, { prompt })
  } catch (err) {
    if (!mapRepositoryError(res, err)) throw err
  }
}

async function handleUpdatePrompt(req: IncomingMessage, res: ServerResponse, id: string): Promise<void> {
  const data = parseBody<SavedPromptPatch>(await readBody(req))
  if (data === null) return sendError(res, 400, 'invalid_request', 'Corpo inválido.')
  try {
    sendJson(res, 200, { prompt: updateSavedPrompt(id, data) })
  } catch (err) {
    if (!mapRepositoryError(res, err)) throw err
  }
}

async function handleCreateMode(req: IncomingMessage, res: ServerResponse, projectId: string): Promise<void> {
  const data = parseBody<Omit<ChatModePatch, 'name'> & { name?: string }>(await readBody(req))
  if (data === null) return sendError(res, 400, 'invalid_request', 'Corpo inválido.')
  if (typeof data.name !== 'string') {
    return sendError(res, 400, 'validation_error', 'name é obrigatório.')
  }
  try {
    const mode = createChatMode({ ...data, projectId, name: data.name })
    sendJson(res, 201, { mode })
  } catch (err) {
    if (!mapRepositoryError(res, err)) throw err
  }
}

async function handleUpdateMode(req: IncomingMessage, res: ServerResponse, id: string): Promise<void> {
  const data = parseBody<ChatModePatch>(await readBody(req))
  if (data === null) return sendError(res, 400, 'invalid_request', 'Corpo inválido.')
  try {
    sendJson(res, 200, { mode: updateChatMode(id, data) })
  } catch (err) {
    if (!mapRepositoryError(res, err)) throw err
  }
}

export function matchesPromptLibraryRoute(pathname: string): boolean {
  return (
    PROJECT_PROMPTS_RE.test(pathname) ||
    PROMPT_ID_RE.test(pathname) ||
    PROJECT_MODES_RE.test(pathname) ||
    MODE_ID_RE.test(pathname)
  )
}

export async function handlePromptLibraryRequest(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  const pathname = (req.url ?? '').split('?')[0]
  const method = req.method ?? ''
  if (!matchesPromptLibraryRoute(pathname)) return false
  if (!guard(req, res)) return true

  try {
    let match = PROJECT_PROMPTS_RE.exec(pathname)
    if (match) {
      const project = getProject(match[1])
      if (project === null) {
        sendError(res, 404, 'project_not_found', 'Projeto não encontrado.')
        return true
      }
      if (method === 'GET') {
        sendJson(res, 200, { prompts: listPromptsForProject(project.id, project.path) })
        return true
      }
      if (method === 'POST') {
        await handleCreatePrompt(req, res, project.id)
        return true
      }
    }

    match = PROJECT_MODES_RE.exec(pathname)
    if (match) {
      const project = getProject(match[1])
      if (project === null) {
        sendError(res, 404, 'project_not_found', 'Projeto não encontrado.')
        return true
      }
      if (method === 'GET') {
        sendJson(res, 200, { modes: listModesForProject(project.id, project.path) })
        return true
      }
      if (method === 'POST') {
        await handleCreateMode(req, res, project.id)
        return true
      }
    }

    match = PROMPT_ID_RE.exec(pathname)
    if (match) {
      if (method === 'PUT') {
        await handleUpdatePrompt(req, res, match[1])
        return true
      }
      if (method === 'DELETE') {
        try {
          deleteSavedPrompt(match[1])
          sendJson(res, 200, { deleted: true })
        } catch (err) {
          if (!mapRepositoryError(res, err)) throw err
        }
        return true
      }
    }

    match = MODE_ID_RE.exec(pathname)
    if (match) {
      if (method === 'PUT') {
        await handleUpdateMode(req, res, match[1])
        return true
      }
      if (method === 'DELETE') {
        try {
          deleteChatMode(match[1])
          sendJson(res, 200, { deleted: true })
        } catch (err) {
          if (!mapRepositoryError(res, err)) throw err
        }
        return true
      }
    }
  } catch (err) {
    if (sendTransportError(res, err)) return true
    console.error('[prompt-library-handler] Unhandled error:', err)
    if (!res.headersSent) sendError(res, 500, 'internal_error', 'Erro interno.')
    return true
  }

  return false
}
