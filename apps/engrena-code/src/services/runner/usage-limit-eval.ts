import { getGlobalUsageLimit, getProjectUsageLimit, type UsageLimit } from '../db/repositories/usage-limits.js'
import { sumCostUsdInPeriod } from '../db/repositories/usage-events.js'

export type UsageLimitLevel = 'none' | 'ok' | 'warn80' | 'at100'
export type UsageLimitItemLevel = 'ok' | 'warn80' | 'at100'

export interface UsageLimitStatusItem {
  scope: UsageLimit['scope']
  projectId: string | null
  mode: UsageLimit['mode']
  limitUsd: number
  spentUsd: number
  pct: number
  level: UsageLimitItemLevel
}

export interface UsageLimitStatus {
  period: { fromMs: number; toMs: number }
  level: UsageLimitLevel
  blocked: boolean
  failOpen: boolean
  items: UsageLimitStatusItem[]
}

/** 409 do gate de dispatch (spec §5.4) — mensagem alinhada a `limits.dest.blockedTurn` (provisória até `copy.md` fechar, spec §3.3). */
export class UsageLimitExceededError extends Error {
  code = 'usage_limit_exceeded'
  details: { spentUsd: number; limitUsd: number; scope: UsageLimit['scope']; projectId: string | null; adjustHash: string }

  constructor(item: UsageLimitStatusItem) {
    super('Limite de consumo atingido. Ajuste o limite em Consumo para continuar.')
    this.details = {
      spentUsd: item.spentUsd,
      limitUsd: item.limitUsd,
      scope: item.scope,
      projectId: item.projectId,
      adjustHash: '#consumo',
    }
  }
}

/** Mês civil no fuso do processo Node/SO (spec §3.2): `[dia 1 00:00:00, agora)`. */
export function resolveMonthlyPeriod(now = new Date()): { fromMs: number; toMs: number } {
  const from = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0)
  return { fromMs: from.getTime(), toMs: now.getTime() }
}

function levelFor(pct: number): UsageLimitItemLevel {
  if (pct >= 100) return 'at100'
  if (pct >= 80) return 'warn80'
  return 'ok'
}

const LEVEL_RANK: Record<UsageLimitLevel, number> = { none: 0, ok: 1, warn80: 2, at100: 3 }

function evaluateItem(limit: UsageLimit, period: { fromMs: number; toMs: number }): UsageLimitStatusItem {
  const spentUsd = sumCostUsdInPeriod({
    fromMs: period.fromMs,
    toMs: period.toMs,
    projectId: limit.scope === 'project' ? (limit.projectId ?? undefined) : undefined,
  })
  const pct = Math.floor((spentUsd / limit.limitUsd) * 100)
  return { scope: limit.scope, projectId: limit.projectId, mode: limit.mode, limitUsd: limit.limitUsd, spentUsd, pct, level: levelFor(pct) }
}

/**
 * Avalia todos os limites aplicáveis ao projeto (global + o do próprio projeto, se configurados) — spec §3.2:
 * estado efetivo é o pior entre eles, `blocked` só quando algum aplicável está ≥100% em modo Bloquear.
 * Fail-open (spec §3.2): qualquer erro na agregação vira `level='none'`/`blocked=false`/`failOpen=true`, nunca trava o usuário.
 */
export function evaluateUsageLimits(projectId: string | null): UsageLimitStatus {
  const period = resolveMonthlyPeriod()
  try {
    const applicable: UsageLimit[] = []
    const global = getGlobalUsageLimit()
    if (global) applicable.push(global)
    if (projectId !== null) {
      const project = getProjectUsageLimit(projectId)
      if (project) applicable.push(project)
    }

    if (applicable.length === 0) {
      return { period, level: 'none', blocked: false, failOpen: false, items: [] }
    }

    const items = applicable.map((limit) => evaluateItem(limit, period))
    let level: UsageLimitLevel = 'ok'
    let blocked = false
    for (const item of items) {
      if (LEVEL_RANK[item.level] > LEVEL_RANK[level]) level = item.level
      if (item.level === 'at100' && item.mode === 'block') blocked = true
    }

    return { period, level, blocked, failOpen: false, items }
  } catch (err) {
    console.error('[usage-limit-eval] Falha ao avaliar limites de consumo, seguindo fail-open:', err)
    return { period, level: 'none', blocked: false, failOpen: true, items: [] }
  }
}

/** Gate de dispatch (spec §5.4, chamado antes de `acquireLease`): lança se algum limite aplicável bloqueia o turno. */
export function assertUsageLimitNotExceeded(projectId: string): void {
  const status = evaluateUsageLimits(projectId)
  if (!status.blocked) return
  const blockingItem = status.items.find((item) => item.level === 'at100' && item.mode === 'block')
  if (blockingItem) throw new UsageLimitExceededError(blockingItem)
}
