import type http from 'http'
import {
  createLoopbackServer,
  isAllowedLoopbackOrigin,
  readBody,
  sendTransportError,
} from '@engrena/http-core'
import { vaultService } from '../vault/vault-service.js'
import { handleConfigRequest } from './config-handler.js'
import { handleVoiceRequest } from './voice-handler.js'
import { handleSubagentsRequest } from './subagents-handler.js'
import { handleSkillsRequest } from './skills-handler.js'
import { handleRulesRequest } from './rules-handler.js'
import { handleProjectsRequest } from './projects-handler.js'
import { handleThreadsRequest } from './threads-handler.js'
import { handleProjectFilesRequest } from './project-files-handler.js'
import { handleGitRequest } from './git-handler.js'
import { handleDashboardRequest } from './dashboard-handler.js'
import { handleMcpsRequest } from './mcps-handler.js'
import { handleLogsRequest } from './logs-handler.js'
import { handleConsumoRequest } from './consumo-handler.js'
import { handleCodegraphRequest } from './codegraph-handler.js'
import { handleCodesearchRequest } from './codesearch-handler.js'
import { handlePromptLibraryRequest } from './prompt-library-handler.js'
import { handleMemoryRequest } from './memory-handler.js'
import { handleWorkspaceUpgrade } from './ws-upgrade.js'
import { recoverRunningThreads } from '../db/repositories/threads.js'
import { expireOrphanGates } from '../runner/gate.js'
import { createLogEntry } from '../db/repositories/log-entries.js'
import { applySeedCatalog } from '../seeds/apply-catalog.js'
import { SESSION_HEADER } from './_transport.js'

export { isAllowedLoopbackOrigin }

const BOOT_RESTART_REASON = 'Aplicação reiniciada durante a execução.'

/** Qual espera a thread perdeu quando o app fechou. Diagnóstico, não copy de produto. */
const BOOT_ORIGIN_LABEL: Record<string, string> = {
  running: 'executando',
  waiting_user: 'esperando resposta a uma pergunta',
  waiting_permission: 'esperando decisão de permissão',
  stopping: 'sendo cancelada',
}
const BOOT_GATE_REASON = 'Pedido de permissão expirado: a aplicação reiniciou antes da sua resposta.'

/**
 * Reconciliação de boot (spec.md F08 §3.2; estado próprio em F35): threads presas em execução viram
 * `interrupted` + log_entries kind='task' com o estado de origem.
 *
 * A ordem importa e não é preferência: gate órfão é expirado **antes** de a thread mudar de estado.
 * Ao contrário, sobra gate `open` apontando para thread já assentada — exatamente o resíduo que a
 * varredura existe para limpar. Gate órfão é fail-closed: expira negando, nunca liberando.
 *
 * Falha ao gravar o log não impede o assentamento: registro perdido é diagnóstico perdido, thread
 * presa em `running` é o app quebrado.
 */
function recoverInterruptedThreads(): void {
  for (const gate of expireOrphanGates()) {
    try {
      createLogEntry({ threadId: gate.threadId, kind: 'task', event: BOOT_GATE_REASON })
    } catch {
      // Ver doc acima: o gate já está fechado, e é isso que corrige a thread.
    }
  }
  for (const { thread, recoveredFrom } of recoverRunningThreads()) {
    const origem = BOOT_ORIGIN_LABEL[recoveredFrom] ?? recoveredFrom
    try {
      createLogEntry({
        threadId: thread.id,
        kind: 'task',
        event: `${BOOT_RESTART_REASON} A thread estava ${origem}.`,
      })
    } catch {
      // Idem: o estado já assentou.
    }
  }
}

interface VaultUnlockResponse {
  unlocked: boolean
  sessionToken?: string
  retryAfterMs?: number
}

async function handleUnlockRequest(
  req: http.IncomingMessage,
  res: http.ServerResponse
): Promise<boolean> {
  if (req.method !== 'POST' || req.url !== '/api/vault/unlock') return false

  let body: string
  try {
    body = await readBody(req)
  } catch (err) {
    if (sendTransportError(res, err)) return true
    console.error('Unlock body read error:', err)
    res.writeHead(500)
    res.end(
      JSON.stringify({
        error: {
          code: 'internal_error',
          message: 'Erro ao desbloquear cofre',
        },
      })
    )
    return true
  }

  let data: unknown
  try {
    data = JSON.parse(body)
  } catch {
    res.writeHead(400)
    res.end(
      JSON.stringify({
        error: {
          code: 'invalid_json',
          message: 'Corpo inválido.',
        },
      })
    )
    return true
  }

  try {
    const workspace =
      typeof data === 'object' && data !== null && 'workspace' in data
        ? (data as { workspace: unknown }).workspace
        : undefined
    const password =
      typeof data === 'object' && data !== null && 'password' in data
        ? (data as { password: unknown }).password
        : undefined

    if (typeof workspace !== 'string' || typeof password !== 'string' || !workspace || !password) {
      res.writeHead(400)
      res.end(
        JSON.stringify({
          error: {
            code: 'validation_error',
            message: 'workspace e password são obrigatórios',
          },
        })
      )
      return true
    }

    const result = vaultService.unlock(workspace, password)

    if (result.corrupted) {
      res.writeHead(422)
      res.end(
        JSON.stringify({
          error: {
            code: 'vault_corrupted',
            message:
              'O cofre local está danificado ou ilegível. Restaure um backup ou recrie o workspace.',
          },
        })
      )
      return true
    }

    const response: VaultUnlockResponse = {
      unlocked: result.unlocked,
    }

    if (result.unlocked) {
      const token = vaultService.getSessionToken()
      if (token) response.sessionToken = token

      try {
        applySeedCatalog()
      } catch (seedErr) {
        console.error('[seeds] applySeedCatalog failed, unlock proceeds anyway:', seedErr)
      }
    }

    if (result.retryAfterMs !== undefined) {
      response.retryAfterMs = result.retryAfterMs
    }

    res.writeHead(200)
    res.end(JSON.stringify(response))
  } catch (err) {
    console.error('Unlock error:', err)
    res.writeHead(500)
    res.end(
      JSON.stringify({
        error: {
          code: 'internal_error',
          message: 'Erro ao desbloquear cofre',
        },
      })
    )
  }
  return true
}

async function routeDomainHandlers(
  req: http.IncomingMessage,
  res: http.ServerResponse
): Promise<boolean> {
  // Dashboard routes (async — must not mix with data event listeners)
  if (req.url?.startsWith('/api/dashboard')) {
    const handled = await handleDashboardRequest(req, res)
    if (handled) return true
  }

  // Config routes (async — must not mix with data event listeners)
  if (req.url?.startsWith('/api/config/')) {
    const handled = await handleConfigRequest(req, res)
    if (handled) return true
  }

  // Voice / STT transcription routes (F27) — atenção: prefixo próprio, precisa de linha aqui
  // ou o roteador de nível superior nunca chega no guard (mesmo bug real de rota do F25).
  if (req.url?.startsWith('/api/voice/')) {
    const handled = await handleVoiceRequest(req, res)
    if (handled) return true
  }

  // Projects routes (async — must not mix with data event listeners)
  if (req.url?.startsWith('/api/projects')) {
    const handled = await handleProjectsRequest(req, res)
    if (handled) return true
  }

  // Composer routes — catálogo model/reasoning/multimodal (F16 §5.1)
  if (req.url?.startsWith('/api/composer/')) {
    const handled = await handleThreadsRequest(req, res)
    if (handled) return true
  }

  // Project files routes — menu `@file` (F16) + FileExplorer list/read
  if (req.url?.startsWith('/api/projects/') && req.url.includes('/file')) {
    const handled = await handleProjectFilesRequest(req, res)
    if (handled) return true
  }

  // Busca de trechos para o `#codebase` (F28) — antes dos handlers amplos de /api/projects/
  if (req.url?.startsWith('/api/projects/') && req.url.includes('/codesearch')) {
    const handled = await handleCodesearchRequest(req, res)
    if (handled) return true
  }

  // Prompts salvos e modos de chat (F28 §3.4) — antes dos handlers amplos de /api/projects/
  if (
    req.url?.startsWith('/api/prompts') ||
    req.url?.startsWith('/api/modes') ||
    req.url?.startsWith('/api/projects/')
  ) {
    const handled = await handlePromptLibraryRequest(req, res)
    if (handled) return true
  }

  // CodeGraph status / reindex (F19) — before broad /api/projects/ handlers
  if (req.url?.startsWith('/api/projects/') && req.url.includes('/codegraph/')) {
    const handled = await handleCodegraphRequest(req, res)
    if (handled) return true
  }

  // Memory status/journal (F20) — before broad /api/projects/ handlers
  if (req.url?.startsWith('/api/projects/') && req.url.includes('/memory/')) {
    const handled = await handleMemoryRequest(req, res)
    if (handled) return true
  }

  // Threads routes (async — must not mix with data event listeners).
  // `/api/tool-calls/` mora aqui porque o corpo de resultado (F33) é servido pelo mesmo handler,
  // com o mesmo `guard()` de cofre e sessão.
  if (
    req.url?.startsWith('/api/threads') ||
    req.url?.startsWith('/api/tool-calls/') ||
    req.url?.startsWith('/api/projects/')
  ) {
    const handled = await handleThreadsRequest(req, res)
    if (handled) return true
  }

  // Git mutable routes (async — must not mix with data event listeners)
  if (req.url?.startsWith('/api/threads/')) {
    const handled = await handleGitRequest(req, res)
    if (handled) return true
  }

  // SubAgents routes (async — must not mix with data event listeners)
  if (
    req.url?.startsWith('/api/subagents') ||
    (req.url?.startsWith('/api/projects/') &&
      (req.url.includes('/subagents') ||
        (req.url.endsWith('/catalog-order') && !req.url.includes('/skills/'))))
  ) {
    const handled = await handleSubagentsRequest(req, res)
    if (handled) return true
  }

  // Rules routes (async — must not mix with data event listeners)
  if (req.url?.startsWith('/api/rules') || req.url?.startsWith('/api/projects/')) {
    const handled = await handleRulesRequest(req, res)
    if (handled) return true
  }

  // Skills routes (async — must not mix with data event listeners)
  if (req.url?.startsWith('/api/skills') || req.url?.startsWith('/api/projects/')) {
    const handled = await handleSkillsRequest(req, res)
    if (handled) return true
  }

  // MCPs routes (async — must not mix with data event listeners)
  if (
    req.url?.startsWith('/api/mcps') ||
    req.url?.startsWith('/api/mcp-catalog') ||
    req.url?.startsWith('/api/mcp-secrets') ||
    req.url?.startsWith('/api/projects/')
  ) {
    const handled = await handleMcpsRequest(req, res)
    if (handled) return true
  }

  // Logs routes (sync — safe to await like the others)
  if (req.url?.startsWith('/api/logs')) {
    const handled = handleLogsRequest(req, res)
    if (handled) return true
  }

  // Consumo routes (async — must not mix with data event listeners)
  if (
    req.url?.startsWith('/api/metrics/') ||
    req.url?.startsWith('/api/pricing') ||
    req.url?.startsWith('/api/usage-limits')
  ) {
    const handled = await handleConsumoRequest(req, res)
    if (handled) return true
  }

  return false
}

export function createUnlockServer(port: number = 5174): http.Server {
  recoverInterruptedThreads()

  return createLoopbackServer({
    port,
    sessionHeader: SESSION_HEADER,
    handleRequest: async (req, res) => {
      if (await handleUnlockRequest(req, res)) return true
      return routeDomainHandlers(req, res)
    },
    handleUpgrade: handleWorkspaceUpgrade,
    onListening: ({ port: bound }) => {
      console.log(`Unlock server listening on http://127.0.0.1:${bound}`)
    },
  })
}
