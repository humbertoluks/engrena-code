import type { IncomingMessage, ServerResponse } from 'http'
import { readFileSync, readdirSync, statSync } from 'fs'
import { join, relative, resolve } from 'path'
import { guard, sendError, sendJson } from './_transport.js'
import { getProject } from '../db/repositories/projects.js'
import { resolveProjectFilePath } from '../project-files/path-guard.js'
import { filterIgnoredPaths, IGNORED_MESSAGE, isPathIgnored } from '../ignore/ignore-service.js'

export { resolveProjectFilePath }

const FILES_RE = /^\/api\/projects\/([^/]+)\/files$/
const FILE_RE = /^\/api\/projects\/([^/]+)\/file$/

/** Espelha F16 spec §3.2: lista a partir de `project.path`, não `worktreePath`. */
const IGNORED_DIRS = new Set(['.git', 'node_modules', '.engrenacode'])

/** Teto de entradas varridas por request — evita travar em repositórios enormes. */
const MAX_SCAN = 20000

/** Default/cap do menu `@` (F16). Explorer usa até `MAX_LIST_LIMIT`. */
const DEFAULT_LIST_LIMIT = 50
const MAX_LIST_LIMIT = 5000

/** Teto de leitura de texto no viewer (1,5 MiB). */
const MAX_FILE_BYTES = 1_500_000

/** Walk iterativo sob `root`; caminhos relativos sempre com `/`. */
export function walkProjectFiles(root: string): string[] {
  const results: string[] = []
  const stack: string[] = [root]
  let scanned = 0

  while (stack.length > 0 && scanned < MAX_SCAN) {
    const dir = stack.pop() as string
    let entries
    try {
      entries = readdirSync(dir, { withFileTypes: true })
    } catch {
      continue
    }

    for (const entry of entries) {
      if (scanned >= MAX_SCAN) break
      scanned++

      if (entry.isDirectory()) {
        if (IGNORED_DIRS.has(entry.name)) continue
        stack.push(join(dir, entry.name))
        continue
      }
      if (!entry.isFile()) continue

      const full = join(dir, entry.name)
      results.push(relative(root, full).split('\\').join('/'))
    }
  }

  return results
}


function looksBinary(sample: Buffer): boolean {
  return sample.includes(0)
}

async function handleListFiles(req: IncomingMessage, res: ServerResponse, projectId: string): Promise<void> {
  const project = getProject(projectId)
  if (project === null) return sendError(res, 404, 'project_not_found', 'Projeto não encontrado.')

  const url = new URL(req.url ?? '', 'http://127.0.0.1')

  const qRaw = url.searchParams.get('q')
  const q = qRaw !== null ? qRaw.trim().slice(0, 256).toLowerCase() : ''

  let limit = DEFAULT_LIST_LIMIT
  const limitRaw = url.searchParams.get('limit')
  if (limitRaw !== null) {
    const n = Number(limitRaw)
    if (!Number.isInteger(n) || n < 1 || n > MAX_LIST_LIMIT) {
      return sendError(res, 400, 'validation_error', `limit deve ser um inteiro entre 1 e ${MAX_LIST_LIMIT}.`)
    }
    limit = n
  }

  // `.engrenaignore` some da listagem inteira: explorer e menção `@` compartilham esta rota.
  const all = filterIgnoredPaths(project.path, walkProjectFiles(resolve(project.path)))
  const filtered = q === '' ? all : all.filter((p) => p.toLowerCase().includes(q))
  sendJson(res, 200, {
    files: filtered.slice(0, limit).map((path) => ({ path })),
    truncated: filtered.length > limit,
    total: filtered.length,
  })
}

async function handleReadFile(req: IncomingMessage, res: ServerResponse, projectId: string): Promise<void> {
  const project = getProject(projectId)
  if (project === null) return sendError(res, 404, 'project_not_found', 'Projeto não encontrado.')

  const url = new URL(req.url ?? '', 'http://127.0.0.1')
  const rawPath = url.searchParams.get('path') ?? ''
  const resolved = resolveProjectFilePath(project.path, rawPath)
  if (!resolved.ok) return sendError(res, 400, resolved.code, resolved.message)
  if (isPathIgnored(project.path, resolved.relPath)) {
    return sendError(res, 403, 'file_ignored', IGNORED_MESSAGE)
  }

  let st
  try {
    st = statSync(resolved.absPath)
  } catch {
    return sendError(res, 404, 'file_not_found', 'Arquivo não encontrado.')
  }
  if (!st.isFile()) return sendError(res, 400, 'validation_error', 'O caminho não é um arquivo.')
  if (st.size > MAX_FILE_BYTES) {
    return sendError(res, 413, 'file_too_large', 'Arquivo maior que o limite do viewer (1,5 MiB).')
  }

  let buf: Buffer
  try {
    buf = readFileSync(resolved.absPath)
  } catch {
    return sendError(res, 500, 'internal_error', 'Não foi possível ler o arquivo.')
  }
  if (looksBinary(buf.subarray(0, Math.min(buf.length, 8192)))) {
    return sendError(res, 415, 'file_binary', 'Arquivo binário não pode ser aberto no viewer.')
  }

  sendJson(res, 200, {
    path: resolved.relPath,
    content: buf.toString('utf8'),
    size: st.size,
  })
}

export async function handleProjectFilesRequest(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  const url = (req.url ?? '').split('?')[0]
  const method = req.method ?? ''

  const filesMatch = FILES_RE.exec(url)
  if (filesMatch) {
    if (method !== 'GET') return false
    if (!guard(req, res)) return true
    try {
      await handleListFiles(req, res, filesMatch[1])
    } catch (err) {
      console.error('[project-files-handler] list error:', err)
      if (!res.headersSent) sendError(res, 500, 'internal_error', 'Erro interno.')
    }
    return true
  }

  const fileMatch = FILE_RE.exec(url)
  if (fileMatch) {
    if (method !== 'GET') return false
    if (!guard(req, res)) return true
    try {
      await handleReadFile(req, res, fileMatch[1])
    } catch (err) {
      console.error('[project-files-handler] read error:', err)
      if (!res.headersSent) sendError(res, 500, 'internal_error', 'Erro interno.')
    }
    return true
  }

  return false
}
