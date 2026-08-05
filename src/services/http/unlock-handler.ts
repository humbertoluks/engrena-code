import http from 'http'
import { vaultService } from '../vault/vault-service.js'
import { handleConfigRequest } from './config-handler.js'
import { handleSubagentsRequest } from './subagents-handler.js'
import { handleSkillsRequest } from './skills-handler.js'
import { handleRulesRequest } from './rules-handler.js'
import { handleProjectsRequest } from './projects-handler.js'
import { handleThreadsRequest } from './threads-handler.js'
import { handleGitRequest } from './git-handler.js'
import { handleDashboardRequest } from './dashboard-handler.js'
import { handleMcpsRequest } from './mcps-handler.js'
import { handleLogsRequest } from './logs-handler.js'
import { handleConsumoRequest } from './consumo-handler.js'
import { handleWorkspaceUpgrade } from './ws-upgrade.js'
import { recoverRunningThreads } from '../db/repositories/threads.js'
import { createLogEntry } from '../db/repositories/log-entries.js'

const BOOT_RESTART_REASON = 'Aplicação reiniciada durante a execução.'

/** Reconciliação de boot (spec.md F08 §3.2): threads presas em `running` viram `error` + log_entries kind='task'. */
function recoverInterruptedThreads(): void {
  const recovered = recoverRunningThreads()
  for (const thread of recovered) {
    createLogEntry({ threadId: thread.id, kind: 'task', event: BOOT_RESTART_REASON })
  }
}

interface VaultUnlockRequest {
  workspace: string
  password: string
}

interface VaultUnlockResponse {
  unlocked: boolean
  sessionToken?: string
  retryAfterMs?: number
}

export function createUnlockServer(port: number = 5174): http.Server {
  recoverInterruptedThreads()

  const server = http.createServer(async (req, res) => {
    res.setHeader('Content-Type', 'application/json')
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-engrenacode-session')

    // CORS preflight
    if (req.method === 'OPTIONS') {
      res.writeHead(200)
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
        try {
          const data = JSON.parse(body) as VaultUnlockRequest

          if (!data.workspace || !data.password) {
            res.writeHead(400)
            res.end(
              JSON.stringify({
                error: {
                  code: 'validation_error',
                  message: 'workspace e password são obrigatórios'
                }
              })
            )
            return
          }

          const result = vaultService.unlock(data.workspace, data.password)
          const response: VaultUnlockResponse = {
            unlocked: result.unlocked
          }

          if (result.unlocked) {
            const token = vaultService.getSessionToken()
            if (token) response.sessionToken = token
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
    res.end(JSON.stringify({ error: 'Not found' }))
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
