import { randomBytes, randomUUID } from 'crypto'
import http from 'http'
import { getThread } from '../db/repositories/threads.js'
import { allowToolForProject, isToolAllowedForProject } from '../db/repositories/tool-allowlist.js'

interface PendingPermission {
  threadId: string
  toolName: string
  resolve: (allow: boolean) => void
}

/** Mesmo padrão de `ask-user-question.ts`: mapa em nível de módulo porque o `POST /permission` do
 * hook (dentro do turno) e o `POST /api/threads/:id/permission` (fora, disparado pela UI) só
 * compartilham o `requestId`. */
const pending = new Map<string, PendingPermission>()

/**
 * Allowlist por thread + toolName — equivalente Claude Code "Yes, don't ask again" para aquela
 * ferramenta pelo resto da sessão do processo (file edits no CC: até o fim da sessão).
 * Bash no CC persiste no repo; aqui a sessão da thread cobre o caso sem settings.local.json.
 */
const allowedToolsByThread = new Map<string, Set<string>>()

export interface PermissionRequestInfo {
  requestId: string
  threadId: string
  toolName: string
  params: unknown
}

export interface PermissionServerHandle {
  port: number
  token: string
  close: () => void
}

function waitForDecision(requestId: string, threadId: string, toolName: string): Promise<boolean> {
  return new Promise((resolve) => {
    pending.set(requestId, { threadId, toolName, resolve })
  })
}

export function isToolAllowedForThread(threadId: string, toolName: string): boolean {
  if (allowedToolsByThread.get(threadId)?.has(toolName) === true) return true
  const thread = getThread(threadId)
  // Allowlist do projeto sobrevive ao restart; a da thread cobre só esta sessão.
  return thread !== null && isToolAllowedForProject(thread.projectId, toolName)
}

/** Claude Code "don't ask again" para a ferramenta — vale até o fim do processo / clear da thread. */
export function rememberAllowedTool(threadId: string, toolName: string): void {
  let set = allowedToolsByThread.get(threadId)
  if (!set) {
    set = new Set()
    allowedToolsByThread.set(threadId, set)
  }
  set.add(toolName)
}

export function clearAllowedToolsForThread(threadId: string): void {
  allowedToolsByThread.delete(threadId)
}

/**
 * Servidor HTTP loopback efêmero por turno — recebe o `POST /permission` do hook `PreToolUse`
 * (spawnado pelo CLI via `--settings`, ver `cli-driver.ts`), segura a resposta até
 * `resolvePermissionRequest` ser chamado por um request externo (`threads-handler.ts`), e devolve
 * `{allow}` pro hook decidir `permissionDecision: allow|deny`.
 *
 * Auto-allow quando: (1) accessLevel ≠ supervised, ou (2) tool já está na allowlist da thread
 * ("Permitir todos" / don't ask again).
 */
export function createPermissionServer(
  threadId: string,
  onRequest: (info: PermissionRequestInfo) => void
): Promise<PermissionServerHandle> {
  const token = randomBytes(24).toString('hex')

  const server = http.createServer((req, res) => {
    if (req.method !== 'POST' || req.url !== '/permission') {
      res.writeHead(404)
      res.end()
      return
    }
    if (req.headers['x-permission-token'] !== token) {
      res.writeHead(403)
      res.end()
      return
    }

    let body = ''
    req.on('data', (chunk: Buffer) => {
      body += chunk.toString()
    })
    req.on('end', () => {
      let parsed: { toolName?: unknown; toolInput?: unknown } = {}
      try {
        parsed = JSON.parse(body || '{}')
      } catch {
        parsed = {}
      }

      const toolName = typeof parsed.toolName === 'string' ? parsed.toolName : 'unknown'

      const current = getThread(threadId)
      if (current !== null && current.accessLevel !== 'supervised') {
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ allow: true }))
        return
      }

      if (isToolAllowedForThread(threadId, toolName)) {
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ allow: true }))
        return
      }

      const requestId = randomUUID()
      onRequest({ requestId, threadId, toolName, params: parsed.toolInput })
      waitForDecision(requestId, threadId, toolName).then((allow) => {
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ allow }))
      })
    })
  })

  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      const port = typeof address === 'object' && address ? address.port : 0
      resolve({
        port,
        token,
        close: () => {
          server.close()
        },
      })
    })
  })
}

/**
 * Resolve um pedido pendente. Com `always=true` e allow, grava a ferramenta na allowlist da thread
 * (Claude Code "Yes, don't ask again").
 * Retorna false se o requestId não existe; `{ toolName }` quando resolveu.
 */
export type PermissionScope = 'thread' | 'project'

export function resolvePermissionRequest(
  requestId: string,
  allow: boolean,
  always = false,
  scope: PermissionScope = 'thread'
): { ok: true; toolName: string } | { ok: false } {
  const entry = pending.get(requestId)
  if (!entry) return { ok: false }
  pending.delete(requestId)
  if (allow && always) {
    rememberAllowedTool(entry.threadId, entry.toolName)
    if (scope === 'project') {
      const thread = getThread(entry.threadId)
      if (thread !== null) allowToolForProject(thread.projectId, entry.toolName)
    }
  }
  entry.resolve(allow)
  return { ok: true, toolName: entry.toolName }
}

/** Nega toda permissão pendente de uma thread (cancel/erro/fim de turno) — mesmo contrato do
 * legado: "permission pendente no cancel → deny" (`_reversa_sdd/runner/requirements.md`). */
export function denyPendingPermissionsForThread(threadId: string): void {
  for (const [requestId, entry] of pending) {
    if (entry.threadId !== threadId) continue
    pending.delete(requestId)
    entry.resolve(false)
  }
}

/**
 * Libera permissões pendentes com allow (upgrade Supervised → Auto-accept/Full mid-turn).
 * Retorna os `requestId` resolvidos para o handler emitir `permission.resolved`.
 */
export function allowPendingPermissionsForThread(threadId: string): string[] {
  const resolvedIds: string[] = []
  for (const [requestId, entry] of pending) {
    if (entry.threadId !== threadId) continue
    pending.delete(requestId)
    entry.resolve(true)
    resolvedIds.push(requestId)
  }
  return resolvedIds
}

export function hasPendingPermission(threadId: string): boolean {
  for (const entry of pending.values()) {
    if (entry.threadId === threadId) return true
  }
  return false
}
