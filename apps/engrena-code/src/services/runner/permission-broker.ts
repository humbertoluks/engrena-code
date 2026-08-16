import { randomBytes } from 'crypto'
import http from 'http'
import { getThread } from '../db/repositories/threads.js'
import { allowToolForProject, isToolAllowedForProject } from '../db/repositories/tool-allowlist.js'
import { PERMISSION_BODY_MAX_BYTES } from './buffer-cap.js'
import { openPermissionGate, PERMISSION_TIMEOUT_MS, type PermissionRequestInfo } from './gate.js'
import { permissionPolicyDecision } from './permission-policy.js'

/**
 * Transporte do gate de permissão, nada mais: servidor HTTP loopback efêmero por turno + política
 * de auto-allow + allowlist da thread. O estado "há um gate aberto" (fila, timeout, resolução,
 * `threads.state`) é do `gate.ts`, dono único desse fato.
 */
export { PERMISSION_TIMEOUT_MS }
export type { PermissionRequestInfo }

/**
 * Allowlist por thread + toolName — equivalente Claude Code "Yes, don't ask again" para aquela
 * ferramenta pelo resto da sessão do processo (file edits no CC: até o fim da sessão).
 * Bash no CC persiste no repo; aqui a sessão da thread cobre o caso sem settings.local.json.
 */
const allowedToolsByThread = new Map<string, Set<string>>()

/**
 * Tools que **este** broker liberou no turno corrente, por qualquer um dos três caminhos de
 * `allow` do servidor: política do nível, allowlist ("Permitir todos") e decisão do usuário no
 * card. É o único lugar do processo que sabe o fato, e sem ele o diagnóstico da negação nativa
 * não distingue os dois casos que ela cobre:
 *
 * - o CLI negou sem nunca consultar o broker (não há entrada aqui) e nenhum card apareceu;
 * - o broker concedeu e **outro** hook da mesma cadeia `PreToolUse` negou depois (há entrada):
 *   o card apareceu, o usuário decidiu, e o nível de acesso da thread não tem efeito nenhum
 *   sobre quem negou.
 *
 * Escopo de turno: `createPermissionServer` roda uma vez por turno e zera o conjunto, porque um
 * grant de turno anterior não explica a negação do turno atual.
 *
 * Granularidade é o `toolName`, não a chamada: o `POST /permission` do hook manda `toolName` e
 * `toolInput`, nunca o `tool_use_id` com que a negação chega no stream. Duas chamadas da mesma
 * tool no mesmo turno, uma concedida e outra que nem passa pelo hook (o caso `run_in_background`
 * da matriz Sprint 1), ficam indistinguíveis aqui.
 */
const brokerGrantsByThread = new Map<string, Set<string>>()

function recordBrokerGrant(threadId: string, toolName: string): void {
  let set = brokerGrantsByThread.get(threadId)
  if (!set) {
    set = new Set()
    brokerGrantsByThread.set(threadId, set)
  }
  set.add(toolName)
}

/** Consumido por `dispatch.ts` ao diagnosticar `permission-native-denial`. */
export function wasToolGrantedByBroker(threadId: string, toolName: string): boolean {
  return brokerGrantsByThread.get(threadId)?.has(toolName) === true
}

export function clearBrokerGrantsForThread(threadId: string): void {
  brokerGrantsByThread.delete(threadId)
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
 * (spawnado pelo CLI via `--settings`, ver `providers/claude/permission-settings.ts`), abre um gate em `gate.ts` e segura a
 * resposta até o gate ser resolvido/expirado, devolvendo `{allow}` pro hook decidir
 * `permissionDecision: allow|deny`.
 *
 * Auto-allow sem gate quando: (1) `permission-policy.ts` já decide `allow` para (nível, tool) —
 * full-access inteiro, leitura/edição em auto-accept-edits — ou (2) tool já está na allowlist da
 * thread ("Permitir todos" / don't ask again).
 *
 * Fail-closed em todo caminho de erro: body acima do cap, gate que não persiste (thread apagada
 * mid-turn) e timeout respondem `allow:false`.
 *
 * `onRequest` é só notificação para o chamador; `waiting_permission`, `gate.opened` e
 * `permission.request` já saem de dentro de `openPermissionGate`.
 */
export function createPermissionServer(
  threadId: string,
  onRequest?: (info: PermissionRequestInfo) => void,
  options?: PermissionServerOptions
): Promise<PermissionServerHandle> {
  const token = randomBytes(24).toString('hex')
  const timeoutMs = options?.timeoutMs ?? PERMISSION_TIMEOUT_MS
  // Um servidor por turno: zerar aqui é o que dá escopo de turno aos grants.
  clearBrokerGrantsForThread(threadId)

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
        recordBrokerGrant(threadId, toolName)
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ allow: true }))
        return
      }

      if (isToolAllowedForThread(threadId, toolName)) {
        recordBrokerGrant(threadId, toolName)
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ allow: true }))
        return
      }

      const opened = openPermissionGate({ threadId, toolName, params: parsed.toolInput, timeoutMs })
      if (!opened.ok) {
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ allow: false }))
        return
      }

      onRequest?.(opened.gate)
      opened.decision.then((allow) => {
        if (allow) recordBrokerGrant(threadId, toolName)
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

/** `thread` grava só na sessão da thread; `project` também persiste em `tool_allowlist`. */
export type PermissionScope = 'thread' | 'project'

/**
 * "Permitir todos" — efeito do `always=true` no `POST /permission`. Fica aqui, e não no `gate.ts`,
 * porque allowlist é assunto do broker; o gate só chama isto pelo hook `onGranted` (o que também
 * evita ciclo de import entre os dois módulos).
 */
export function grantAlwaysAllowedTool(threadId: string, toolName: string, scope: PermissionScope): void {
  rememberAllowedTool(threadId, toolName)
  if (scope !== 'project') return
  const thread = getThread(threadId)
  if (thread !== null) allowToolForProject(thread.projectId, toolName)
}
