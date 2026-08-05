import type { IncomingMessage, ServerResponse } from 'http'
import { vaultService } from '../vault/vault-service.js'
import { computeConfigStatus } from './config-handler.js'
import { listProjects } from '../db/repositories/projects.js'
import { getDashboardMetrics, listDashboardInbox, listRecentActivity } from '../db/repositories/dashboard.js'
import { skillsRepository } from '../db/repositories/skills.js'
import { getCounts as getRulesCounts } from '../db/repositories/rules.js'
import { createSubagentsRepository } from '../db/repositories/subagents.js'
import { getDb } from '../db/client.js'
import type { DashboardInboxItem } from '../db/repositories/dashboard.js'
import type { ConfigStatus } from './config-handler.js'

const SESSION_HEADER = 'x-engrenacode-session'
const INBOX_LIMIT = 20
const RECENT_LIMIT = 10

// ── Helpers ────────────────────────────────────────────────────────────────

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

type HealthDot = 'ok' | 'warn'
type PromptDot = 'ok' | 'off'

export interface DashboardHealth {
  claude: HealthDot
  clis: HealthDot
  github: HealthDot
  prompt: PromptDot
  setupIncomplete: boolean
}

/** Deriva a strip de 4 dots + flag setupIncomplete a partir do ConfigStatus (F02). Puro — sem I/O. */
export function computeDashboardHealth(config: ConfigStatus): DashboardHealth {
  const claude: HealthDot = config.providers.claude.available ? 'ok' : 'warn'
  const clis: HealthDot = config.providers.codex.available || config.providers.kimi.available ? 'ok' : 'warn'
  const github: HealthDot = config.github.tokenPresent ? 'ok' : 'warn'
  const prompt: PromptDot = config.prompt.isEmpty ? 'off' : 'ok'

  const noProviderAvailable =
    !config.providers.claude.available && !config.providers.codex.available && !config.providers.kimi.available
  const setupIncomplete = noProviderAvailable || !config.github.tokenPresent

  return { claude, clis, github, prompt, setupIncomplete }
}

// ── Handler ────────────────────────────────────────────────────────────────

async function handleGetDashboard(_req: IncomingMessage, res: ServerResponse): Promise<void> {
  const config = await computeConfigStatus()
  const health = computeDashboardHealth(config)

  const metrics = getDashboardMetrics()
  const inboxFromDb = listDashboardInbox(INBOX_LIMIT)
  const recent = listRecentActivity(RECENT_LIMIT)
  const projects = listProjects()

  const rulesCounts = getRulesCounts()
  const subagentsCounts = createSubagentsRepository(getDb()).getCounts()

  const inbox: Array<DashboardInboxItem | { kind: 'setupIncomplete'; threadId: null; projectId: null; projectName: null; title: null; provider: null; updatedAt: null }> = []
  if (health.setupIncomplete) {
    inbox.push({
      kind: 'setupIncomplete',
      threadId: null,
      projectId: null,
      projectName: null,
      title: null,
      provider: null,
      updatedAt: null,
    })
  }
  inbox.push(...inboxFromDb)

  sendJson(res, 200, {
    health,
    metrics,
    inbox: inbox.slice(0, INBOX_LIMIT),
    projects,
    catalog: {
      skills: skillsRepository.getCounts().global,
      rules: rulesCounts.global,
      subagents: subagentsCounts.global,
    },
    recent,
  })
}

// ── Router ──────────────────────────────────────────────────────────────────

export async function handleDashboardRequest(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  const url = (req.url ?? '').split('?')[0]
  const method = req.method ?? ''

  if (url !== '/api/dashboard') return false
  if (!guard(req, res)) return true

  try {
    if (method === 'GET') {
      await handleGetDashboard(req, res)
      return true
    }
  } catch (err) {
    console.error('[dashboard-handler] Unhandled error:', err)
    if (!res.headersSent) sendError(res, 500, 'internal_error', 'Erro interno.')
    return true
  }

  return false
}
