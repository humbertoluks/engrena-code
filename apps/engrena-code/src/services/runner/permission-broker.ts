import { randomBytes } from 'crypto'
import http from 'http'
import { getThread } from '../db/repositories/threads.js'
import { allowToolForProject, isToolAllowedForProject } from '../db/repositories/tool-allowlist.js'
import { PERMISSION_BODY_MAX_BYTES } from './buffer-cap.js'
import {
  GATE_REASON_USER_DECISION,
  openPermissionGate,
  PERMISSION_TIMEOUT_MS,
  type PermissionGateDecision,
  type PermissionRequestInfo,
} from './gate.js'
import { permissionPolicyDecision } from './permission-policy.js'
import type { BrokerPermissionOutcome } from './providers/permission-contract.js'

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

/** Tudo menos `never-requested`, que é ausência de registro e por isso nunca é gravado. */
type RecordedBrokerOutcome = Exclude<BrokerPermissionOutcome, 'never-requested'>

/**
 * O que **este** broker respondeu ao hook, por tool, no turno corrente. É o único lugar do processo
 * que sabe o fato, e sem ele o diagnóstico da negação nativa mente:
 *
 * - `granted` — os três caminhos de `allow` do servidor: política do nível, allowlist ("Permitir
 *   todos") e decisão do usuário no card. O card apareceu (ou nem precisou), e quem negou depois
 *   foi outro hook da cadeia `PreToolUse`, sobre o qual o nível de acesso não tem efeito nenhum;
 * - `denied` — o usuário negou no card;
 * - `expired` — o gate fechou sem resposta do usuário (timeout fail-closed, cancel do turno) e a
 *   tool foi negada por omissão;
 * - `unavailable` — o EngrenaCode nem conseguiu abrir o pedido (`gate_not_persisted`) e negou por
 *   falha interna, sem chegar a perguntar;
 * - sem entrada: o CLI negou sem nunca consultar o broker e nenhum card apareceu.
 *
 * Distinguir `denied` de "sem entrada" é o defeito R09: as duas superfícies acusavam o CLI de ter
 * negado por conta própria uma tool que o próprio usuário tinha acabado de recusar no card.
 *
 * Escopo de turno: `createPermissionServer` roda uma vez por turno e zera o mapa, porque decisão de
 * turno anterior não explica a negação do turno atual.
 *
 * Granularidade é o `toolName`, não a chamada: o `POST /permission` do hook manda `toolName` e
 * `toolInput`, nunca o `tool_use_id` com que a negação chega no stream. Duas chamadas da mesma
 * tool no mesmo turno, uma concedida e outra que nem passa pelo hook (o caso `run_in_background`
 * da matriz Sprint 1), ficam indistinguíveis aqui — a última decisão registrada vence.
 */
const brokerOutcomesByThread = new Map<string, Map<string, RecordedBrokerOutcome>>()

function recordBrokerOutcome(threadId: string, toolName: string, outcome: RecordedBrokerOutcome): void {
  let byTool = brokerOutcomesByThread.get(threadId)
  if (!byTool) {
    byTool = new Map()
    brokerOutcomesByThread.set(threadId, byTool)
  }
  byTool.set(toolName, outcome)
}

/**
 * Só `user_decision` é resposta do usuário; timeout, cancel de turno e abandono fecham o gate sem
 * ele — todos negam por omissão e todos são `expired` para quem lê o diagnóstico.
 */
function outcomeForGateDecision(decision: PermissionGateDecision): RecordedBrokerOutcome {
  if (decision.allow) return 'granted'
  return decision.reason === GATE_REASON_USER_DECISION ? 'denied' : 'expired'
}

/** Consumido por `dispatch.ts` ao diagnosticar `permission-native-denial`. */
export function brokerOutcomeForTool(threadId: string, toolName: string): BrokerPermissionOutcome {
  return brokerOutcomesByThread.get(threadId)?.get(toolName) ?? 'never-requested'
}

export function clearBrokerOutcomesForThread(threadId: string): void {
  brokerOutcomesByThread.delete(threadId)
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
  // Um servidor por turno: zerar aqui é o que dá escopo de turno às decisões.
  clearBrokerOutcomesForThread(threadId)

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
        recordBrokerOutcome(threadId, toolName, 'granted')
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ allow: true }))
        return
      }

      if (isToolAllowedForThread(threadId, toolName)) {
        recordBrokerOutcome(threadId, toolName, 'granted')
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ allow: true }))
        return
      }

      const opened = openPermissionGate({ threadId, toolName, params: parsed.toolInput, timeoutMs })
      if (!opened.ok) {
        // Negado sem nunca chegar ao usuário: registrar como `unavailable` é o que impede o
        // diagnóstico de culpar o CLI (ou o usuário) por uma falha nossa.
        recordBrokerOutcome(threadId, toolName, 'unavailable')
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ allow: false }))
        return
      }

      onRequest?.(opened.gate)
      opened.decision.then((decision) => {
        recordBrokerOutcome(threadId, toolName, outcomeForGateDecision(decision))
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ allow: decision.allow }))
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
