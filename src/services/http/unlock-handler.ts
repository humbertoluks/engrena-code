import http from 'http'
import { vaultService } from '../vault/vault-service.js'
import { handleConfigRequest } from './config-handler.js'
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
import { handleWorkspaceUpgrade } from './ws-upgrade.js'
import { recoverRunningThreads } from '../db/repositories/threads.js'
import { createLogEntry } from '../db/repositories/log-entries.js'
import { applySeedCatalog } from '../seeds/apply-catalog.js'

const BOOT_RESTART_REASON = 'Aplicação reiniciada durante a execução.'

/** Reconciliação de boot (spec.md F08 §3.2): threads presas em `running` viram `error` + log_entries kind='task'. */
function recoverInterruptedThreads(): void {
  const recovered = recoverRunningThreads()
  for (const thread of recovered) {
    createLogEntry({ threadId: thread.id, kind: 'task', event: BOOT_RESTART_REASON })
  }
}

interface VaultUnlockResponse {
  unlocked: boolean
  sessionToken?: string
  retryAfterMs?: number
}

/**
 * Loopback API is only callable from the Vite/Electron renderer on this machine.
 * Missing Origin = non-browser client (axios/curl/tests). `null` = file:// in production.
 */
export function isAllowedLoopbackOrigin(origin: string | undefined): boolean {
  if (origin === undefined || origin === '') return true
  if (origin === 'null') return true
  try {
    const url = new URL(origin)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return false
    return url.hostname === '127.0.0.1' || url.hostname === 'localhost'
  } catch {
    return false
  }
}

function applyCors(req: http.IncomingMessage, res: http.ServerResponse): boolean {
  const raw = req.headers.origin
  const origin = Array.isArray(raw) ? raw[0] : raw

  if (typeof origin === 'string' && origin !== '' && !isAllowedLoopbackOrigin(origin)) {
    res.writeHead(403, { 'Content-Type': 'application/json' })
    res.end(
      JSON.stringify({
        error: { code: 'cors_denied', message: 'Origin not allowed.' },
      })
    )
    return false
  }

  if (typeof origin === 'string' && origin !== '' && isAllowedLoopbackOrigin(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin)
    res.setHeader('Vary', 'Origin')
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-engrenacode-session')
  }

  return true
}

export function createUnlockServer(port: number = 5174): http.Server {
  recoverInterruptedThreads()

  const server = http.createServer(async (req, res) => {
    res.setHeader('Content-Type', 'application/json')

    if (!applyCors(req, res)) return

    // CORS preflight
    if (req.method === 'OPTIONS') {
      res.writeHead(204)
      res.end()
      return
    }

    // POST /api/vault/unlock
    if (req.method === 'POST' && req.url === '/api/vault/unlock') {
      let body = ''
      req.on('data', (chunk) => {
        body += chunk.toString()
      })

      req.on('end', () => {
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
          return
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
            return
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
            return
          }

          const response: VaultUnlockResponse = {
            unlocked: result.unlocked
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
                message: 'Erro ao desbloquear cofre'
              }
            })
          )
        }
      })
      return
    }

    // Dashboard routes (async — must not mix with data event listeners)
    if (req.url?.startsWith('/api/dashboard')) {
      const handled = await handleDashboardRequest(req, res)
      if (handled) return
    }

    // Config routes (async — must not mix with data event listeners)
    if (req.url?.startsWith('/api/config/')) {
      const handled = await handleConfigRequest(req, res)
      if (handled) return
    }

    // Projects routes (async — must not mix with data event listeners)
    if (req.url?.startsWith('/api/projects')) {
      const handled = await handleProjectsRequest(req, res)
      if (handled) return
    }

    // Composer routes — catálogo model/reasoning/multimodal (F16 §5.1)
    if (req.url?.startsWith('/api/composer/')) {
      const handled = await handleThreadsRequest(req, res)
      if (handled) return
    }

    // Project files routes — menu `@file` (F16 §5.2)
    if (req.url?.startsWith('/api/projects/') && req.url.includes('/files')) {
      const handled = await handleProjectFilesRequest(req, res)
      if (handled) return
    }

    // Threads routes (async — must not mix with data event listeners)
    if (req.url?.startsWith('/api/threads') || req.url?.startsWith('/api/projects/')) {
      const handled = await handleThreadsRequest(req, res)
      if (handled) return
    }

    // Git mutable routes (async — must not mix with data event listeners)
    if (req.url?.startsWith('/api/threads/')) {
      const handled = await handleGitRequest(req, res)
      if (handled) return
    }

    // SubAgents routes (async — must not mix with data event listeners)
    if (
      req.url?.startsWith('/api/subagents') ||
      (req.url?.startsWith('/api/projects/') &&
        (req.url.includes('/subagents') || req.url.endsWith('/catalog-order')))
    ) {
      const handled = await handleSubagentsRequest(req, res)
      if (handled) return
    }

    // Rules routes (async — must not mix with data event listeners)
    if (req.url?.startsWith('/api/rules') || req.url?.startsWith('/api/projects/')) {
      const handled = await handleRulesRequest(req, res)
      if (handled) return
    }

    // Skills routes (async — must not mix with data event listeners)
    if (req.url?.startsWith('/api/skills') || req.url?.startsWith('/api/projects/')) {
      const handled = await handleSkillsRequest(req, res)
      if (handled) return
    }

    // MCPs routes (async — must not mix with data event listeners)
    if (
      req.url?.startsWith('/api/mcps') ||
      req.url?.startsWith('/api/mcp-catalog') ||
      req.url?.startsWith('/api/mcp-secrets') ||
      req.url?.startsWith('/api/projects/')
    ) {
      const handled = await handleMcpsRequest(req, res)
      if (handled) return
    }

    // Logs routes (sync — safe to await like the others)
    if (req.url?.startsWith('/api/logs')) {
      const handled = handleLogsRequest(req, res)
      if (handled) return
    }

    // Consumo routes (async — must not mix with data event listeners)
    if (req.url?.startsWith('/api/metrics/') || req.url?.startsWith('/api/pricing')) {
      const handled = await handleConsumoRequest(req, res)
      if (handled) return
    }

    // 404
    res.writeHead(404)
    res.end(JSON.stringify({ error: { code: 'not_found', message: 'Not found' } }))
  })

  server.on('upgrade', (req, socket, head) => {
    const handled = handleWorkspaceUpgrade(req, socket, head)
    if (!handled) {
      socket.destroy()
    }
  })

  server.listen(port, '127.0.0.1', () => {
    console.log(`Unlock server listening on http://127.0.0.1:${port}`)
  })

  return server
}
