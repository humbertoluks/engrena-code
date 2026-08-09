import { randomBytes, randomUUID } from 'crypto'
import http from 'http'

interface PendingPermission {
  threadId: string
  resolve: (allow: boolean) => void
}

/** Mesmo padrão de `ask-user-question.ts`: mapa em nível de módulo porque o `POST /permission` do
 * hook (dentro do turno) e o `POST /api/threads/:id/permission` (fora, disparado pela UI) só
 * compartilham o `requestId`. */
const pending = new Map<string, PendingPermission>()

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

function waitForDecision(requestId: string, threadId: string): Promise<boolean> {
  return new Promise((resolve) => {
    pending.set(requestId, { threadId, resolve })
  })
}

/**
 * Servidor HTTP loopback efêmero por turno — recebe o `POST /permission` do hook `PreToolUse`
 * (spawnado pelo CLI via `--settings`, ver `cli-driver.ts`), segura a resposta até
 * `resolvePermissionRequest` ser chamado por um request externo (`threads-handler.ts`), e devolve
 * `{allow}` pro hook decidir `permissionDecision: allow|deny`.
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
      const requestId = randomUUID()
      const toolName = typeof parsed.toolName === 'string' ? parsed.toolName : 'unknown'
      onRequest({ requestId, threadId, toolName, params: parsed.toolInput })
      waitForDecision(requestId, threadId).then((allow) => {
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

/** No-op silencioso se `requestId` já foi resolvido/expirou — mesma tolerância de `resolveAskUserQuestion`. */
export function resolvePermissionRequest(requestId: string, allow: boolean): boolean {
  const entry = pending.get(requestId)
  if (!entry) return false
  pending.delete(requestId)
  entry.resolve(allow)
  return true
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

export function hasPendingPermission(threadId: string): boolean {
  for (const entry of pending.values()) {
    if (entry.threadId === threadId) return true
  }
  return false
}
