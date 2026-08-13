import { randomBytes, randomUUID } from 'crypto'
import http from 'http'
import { getThread, updateThread, type ThreadAccessLevel } from '../db/repositories/threads.js'
import { allowToolForProject, isToolAllowedForProject } from '../db/repositories/tool-allowlist.js'
import { PERMISSION_BODY_MAX_BYTES } from './buffer-cap.js'
import { permissionPolicyDecision } from './permission-policy.js'
import { emit } from './ws-hub.js'

/** Fail-closed: sem resposta do usuário, a tool é negada e o HTTP do hook não fica preso 10+ min. */
export const PERMISSION_TIMEOUT_MS = 2 * 60 * 1000

interface PendingPermission {
  threadId: string
  toolName: string
  params: unknown
  createdAt: number
  resolve: (allow: boolean) => void
  timeoutId: ReturnType<typeof setTimeout>
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
  createdAt?: number
}

export interface PermissionServerHandle {
  port: number
  token: string
  close: () => void
}

export interface PermissionServerOptions {
  /** Override do fail-closed (testes usam ms curtos). Default: `PERMISSION_TIMEOUT_MS`. */
  timeoutMs?: number
}

function maybeRestoreRunningAfterPermission(threadId: string): void {
  if (hasPendingPermission(threadId)) return
  const thread = getThread(threadId)
  if (thread?.state !== 'waiting_permission') return
  updateThread(threadId, { state: 'running' })
  emit(threadId, { type: 'state.change', threadId, state: 'running' })
}

function clearPendingEntry(requestId: string): PendingPermission | undefined {
  const entry = pending.get(requestId)
  if (!entry) return undefined
  pending.delete(requestId)
  clearTimeout(entry.timeoutId)
  return entry
}

function waitForDecision(
  requestId: string,
  threadId: string,
  toolName: string,
  params: unknown,
  timeoutMs: number
): Promise<boolean> {
  return new Promise((resolve) => {
    const createdAt = Date.now()
    const timeoutId = setTimeout(() => {
      const entry = clearPendingEntry(requestId)
      if (!entry) return
      entry.resolve(false)
      emit(threadId, {
        type: 'permission.resolved',
        threadId,
        requestId,
        allow: false,
      })
      maybeRestoreRunningAfterPermission(threadId)
    }, timeoutMs)

    pending.set(requestId, { threadId, toolName, params, createdAt, resolve, timeoutId })
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
 * Snapshot consultável das permissões pendentes de uma thread (reconnect / GET /permissions).
 * Sem `resolve` nem handles — só o que a UI precisa para remontar o modal.
 */
export function listPendingPermissions(threadId: string): PermissionRequestInfo[] {
  const out: PermissionRequestInfo[] = []
  for (const [requestId, entry] of pending) {
    if (entry.threadId !== threadId) continue
    out.push({
      requestId,
      threadId: entry.threadId,
      toolName: entry.toolName,
      params: entry.params,
      createdAt: entry.createdAt,
    })
  }
  return out
}

/**
 * Servidor HTTP loopback efêmero por turno — recebe o `POST /permission` do hook `PreToolUse`
 * (spawnado pelo CLI via `--settings`, ver `cli-driver.ts`), segura a resposta até
 * `resolvePermissionRequest` ser chamado por um request externo (`threads-handler.ts`), e devolve
 * `{allow}` pro hook decidir `permissionDecision: allow|deny`.
 *
 * Auto-allow quando: (1) `permission-policy.ts` já decide `allow` para (nível, tool) — full-access
 * inteiro, leitura/edição em auto-accept-edits — ou (2) tool já está na allowlist da thread
 * ("Permitir todos" / don't ask again).
 *
 * Fail-closed: sem decisão em `timeoutMs`, auto-deny + `permission.resolved` + volta a `running`
 * se a thread estiver em `waiting_permission`.
 */
export function createPermissionServer(
  threadId: string,
  onRequest: (info: PermissionRequestInfo) => void,
  options?: PermissionServerOptions
): Promise<PermissionServerHandle> {
  const token = randomBytes(24).toString('hex')
  const timeoutMs = options?.timeoutMs ?? PERMISSION_TIMEOUT_MS

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
    let bodyBytes = 0
    let overCap = false
    // Derrubar a conexão emite 'error' (ECONNRESET) no request; sem listener o stream lançaria.
    req.on('error', () => {
      /* corpo abortado pelo cap ou conexão morta — nada pendente a resolver */
    })
    req.on('data', (chunk: Buffer) => {
      if (overCap) return
      bodyBytes += chunk.length
      if (bodyBytes > PERMISSION_BODY_MAX_BYTES) {
        overCap = true
        // Fail-closed: seguir com body parcial daria JSON inválido → toolName 'unknown' no modal.
        res.writeHead(413, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ allow: false, error: 'payload_too_large' }), () => {
          req.destroy()
        })
        return
      }
      body += chunk.toString()
    })
    req.on('end', () => {
      if (overCap) return
      let parsed: { toolName?: unknown; toolInput?: unknown } = {}
      try {
        parsed = JSON.parse(body || '{}')
      } catch {
        parsed = {}
      }

      const toolName = typeof parsed.toolName === 'string' ? parsed.toolName : 'unknown'

      const current = getThread(threadId)
      // Sem thread (apagada mid-turn) cai no mais restrito — nunca libera por omissão.
      const accessLevel = current?.accessLevel ?? 'supervised'
      if (permissionPolicyDecision(accessLevel, toolName) === 'allow') {
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
      const params = parsed.toolInput
      // pending.set roda no executor síncrono de waitForDecision — registrar antes do emit
      // evita 409 se algum consumidor no mesmo processo resolvesse no callback de onRequest.
      const decision = waitForDecision(requestId, threadId, toolName, params, timeoutMs)
      onRequest({ requestId, threadId, toolName, params, createdAt: Date.now() })
      decision.then((allow) => {
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

export type PermissionScope = 'thread' | 'project'

/** `not_found`: requestId inexistente. `thread_mismatch`: existe, mas pertence a outra thread. */
export type PermissionResolveFailureCode = 'not_found' | 'thread_mismatch'

export type PermissionResolveResult =
  | { ok: true; toolName: string }
  | { ok: false; code: PermissionResolveFailureCode }

/**
 * Resolve um pedido pendente **da thread informada**. Com `always=true` e allow, grava a ferramenta
 * na allowlist da thread (Claude Code "Yes, don't ask again").
 *
 * `threadId` vem primeiro de propósito: o handler HTTP recebe o id no path e o requestId no corpo,
 * e trocar a ordem em silêncio deixaria um requestId de outra thread resolver a permissão errada.
 * Sem match a entrada **não** é consumida — continua pendente para a thread dona.
 */
export function resolvePermissionRequest(
  threadId: string,
  requestId: string,
  allow: boolean,
  always = false,
  scope: PermissionScope = 'thread'
): PermissionResolveResult {
  const candidate = pending.get(requestId)
  if (!candidate) return { ok: false, code: 'not_found' }
  if (candidate.threadId !== threadId) return { ok: false, code: 'thread_mismatch' }

  const entry = clearPendingEntry(requestId)
  if (!entry) return { ok: false, code: 'not_found' }
  if (allow && always) {
    rememberAllowedTool(entry.threadId, entry.toolName)
    if (scope === 'project') {
      const thread = getThread(entry.threadId)
      if (thread !== null) allowToolForProject(thread.projectId, entry.toolName)
    }
  }
  entry.resolve(allow)
  maybeRestoreRunningAfterPermission(entry.threadId)
  return { ok: true, toolName: entry.toolName }
}

/** Nega toda permissão pendente de uma thread (cancel/erro/fim de turno) — mesmo contrato do
 * legado: "permission pendente no cancel → deny" (`_reversa_sdd/runner/requirements.md`).
 * Não restaura `running`: o chamador assenta o estado final (cancelled/error/idle). */
export function denyPendingPermissionsForThread(threadId: string): void {
  for (const [requestId, entry] of pending) {
    if (entry.threadId !== threadId) continue
    clearPendingEntry(requestId)
    entry.resolve(false)
  }
}

/**
 * Libera permissões pendentes com allow (upgrade de nível mid-turn).
 * Com `accessLevel`, libera só o que o novo nível auto-aprova — `auto-accept-edits` solta a edição
 * de arquivo e mantém o modal do `Bash`, senão o upgrade viraria full-access disfarçado.
 * Retorna os `requestId` resolvidos para o handler emitir `permission.resolved`.
 */
export function allowPendingPermissionsForThread(
  threadId: string,
  accessLevel?: ThreadAccessLevel
): string[] {
  const resolvedIds: string[] = []
  for (const [requestId, entry] of pending) {
    if (entry.threadId !== threadId) continue
    if (accessLevel !== undefined && permissionPolicyDecision(accessLevel, entry.toolName) !== 'allow') {
      continue
    }
    clearPendingEntry(requestId)
    entry.resolve(true)
    resolvedIds.push(requestId)
  }
  maybeRestoreRunningAfterPermission(threadId)
  return resolvedIds
}

export function hasPendingPermission(threadId: string): boolean {
  for (const entry of pending.values()) {
    if (entry.threadId === threadId) return true
  }
  return false
}

/** Apenas para testes: limpa mapa + timers entre specs. */
export function clearAllPendingPermissionsForTesting(): void {
  for (const [requestId, entry] of [...pending.entries()]) {
    clearPendingEntry(requestId)
    entry.resolve(false)
  }
}
