import type { IncomingMessage, ServerResponse } from 'http'
import { readdirSync } from 'fs'
import { join, relative, resolve } from 'path'
import { vaultService } from '../vault/vault-service.js'
import { getProject } from '../db/repositories/projects.js'

const SESSION_HEADER = 'x-engrenacode-session'
const FILES_RE = /^\/api\/projects\/([^/]+)\/files$/

/** Espelha F16 spec §3.2 (Auto-Aceitar): `@file` lista a partir de `project.path`, não `worktreePath`. */
const IGNORED_DIRS = new Set(['.git', 'node_modules', '.engrenacode'])

/** Teto de entradas varridas por request — evita travar em repositórios enormes (não documentado na spec, defensivo). */
const MAX_SCAN = 20000

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

/** Walk iterativo sob `root`; caminhos relativos sempre com `/`, nunca escapam de `root` (spec F16 §5.2). */
function walkProjectFiles(root: string): string[] {
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

async function handleListFiles(req: IncomingMessage, res: ServerResponse, projectId: string): Promise<void> {
  const project = getProject(projectId)
  if (project === null) return sendError(res, 404, 'project_not_found', 'Projeto não encontrado.')

  const url = new URL(req.url ?? '', 'http://127.0.0.1')

  const qRaw = url.searchParams.get('q')
  const q = qRaw !== null ? qRaw.trim().slice(0, 256).toLowerCase() : ''

  let limit = 50
  const limitRaw = url.searchParams.get('limit')
  if (limitRaw !== null) {
    const n = Number(limitRaw)
    if (!Number.isInteger(n) || n < 1 || n > 50) {
      return sendError(res, 400, 'validation_error', 'limit deve ser um inteiro entre 1 e 50.')
    }
    limit = n
  }

  const all = walkProjectFiles(resolve(project.path))
  const filtered = q === '' ? all : all.filter((p) => p.toLowerCase().includes(q))
  sendJson(res, 200, { files: filtered.slice(0, limit).map((path) => ({ path })) })
}

export async function handleProjectFilesRequest(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  const url = (req.url ?? '').split('?')[0]
  const method = req.method ?? ''

  const match = FILES_RE.exec(url)
  if (!match) return false
  if (method !== 'GET') return false

  if (!guard(req, res)) return true

  try {
    await handleListFiles(req, res, match[1])
  } catch (err) {
    console.error('[project-files-handler] Unhandled error:', err)
    if (!res.headersSent) sendError(res, 500, 'internal_error', 'Erro interno.')
  }

  return true
}
