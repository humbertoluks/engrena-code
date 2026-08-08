import type { ThreadUsageRow } from '../services/consumo-service'

/** Formata `updatedAt`/timestamps de linhas de consumo em locale pt-BR. */
export function formatTimestamp(ms: number): string {
  return new Date(ms).toLocaleString('pt-BR')
}

/** `{loaded} tokens` compactos — spec F11 ui.md (`{agentTokens}`/`{subagentTokens}` no tooltip de share, colunas Tokens). */
export function formatCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

export function formatPercent(value: number | null): string {
  return value === null ? '—' : `${value.toFixed(1)}%`
}

export interface CostTextOptions {
  approximate?: boolean
  partial?: boolean
}

/** Formatação de custo (ui.md §Formatação de custo — `CostValue`): `—`, `~$X.XXXX`, `$X.XXXX ⚠ parcial`, `$X.XXXX`. */
export function formatCostText(costUsd: number | null, opts?: CostTextOptions): string {
  if (costUsd === null) return opts?.partial ? `— ⚠ parcial` : '—'
  const base = `$${costUsd.toFixed(4)}`
  if (opts?.partial) return `${base} ⚠ parcial`
  if (opts?.approximate) return `~${base}`
  return base
}

export interface ShareResult {
  text: string
  title: string
}

/**
 * Share de custo do subagent sobre o total do turno (ui.md §Formatação de custo). Splits
 * incompletos (qualquer lado sem `pricingComplete` ou `costUsd`) nunca inventam percentual —
 * mostram `share.partial` (spec F11 §3.2/ui.md).
 */
export function shareLabel(thread: Pick<ThreadUsageRow, 'agentTokens' | 'subagentTokens' | 'agentCostUsd' | 'subagentCostUsd' | 'agentPricingComplete' | 'subagentPricingComplete'>): ShareResult {
  const title = `Agente: ${formatCompact(thread.agentTokens)} tokens; subagents: ${formatCompact(thread.subagentTokens)} tokens.`

  if (
    !thread.agentPricingComplete ||
    !thread.subagentPricingComplete ||
    thread.agentCostUsd === null ||
    thread.subagentCostUsd === null
  ) {
    return { text: '— / custo parcial', title }
  }

  const total = thread.agentCostUsd + thread.subagentCostUsd
  if (total === 0) return { text: '0%', title }
  return { text: `${((thread.subagentCostUsd / total) * 100).toFixed(1)}%`, title }
}

// ── Limites de consumo (F25) ────────────────────────────────────────────────

export function formatUsd(value: number): string {
  return `$${value.toFixed(2)}`
}

/** `${spent} / ${limit} · {pct}%` (copy.md `limits.dest.progress.value`, fixture). */
export function formatLimitProgress(spentUsd: number, limitUsd: number, pct: number): string {
  return `${formatUsd(spentUsd)} / ${formatUsd(limitUsd)} · ${pct}%`
}

export type UsageLimitBarTone = 'accent' | 'amber' | 'red'

/** ui.md §Layout: fill accent < 80%, amber >= 80%, red >= 100% (destino; fonte usa hot >= 90%). */
export function usageLimitBarTone(pct: number): UsageLimitBarTone {
  if (pct >= 100) return 'red'
  if (pct >= 80) return 'amber'
  return 'accent'
}

export interface ParsedUsdLimit {
  ok: boolean
  value: number | null
  error?: string
}

/** Campo Limite (USD) — spec §5.2: vazio = remover; senão finito > 0 e <= 1e9. */
export function parseUsdLimitInput(text: string): ParsedUsdLimit {
  const trimmed = text.trim()
  if (trimmed === '') return { ok: true, value: null }

  const n = Number.parseFloat(trimmed)
  if (!Number.isFinite(n) || n <= 0 || n > 1_000_000_000) {
    return { ok: false, value: null, error: 'Informe um valor maior que zero, ou deixe vazio para remover o limite.' }
  }
  return { ok: true, value: n }
}
