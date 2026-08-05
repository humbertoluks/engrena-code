import { describe, expect, it } from 'vitest'
import { formatCompact, formatCostText, formatPercent, shareLabel } from './consumoScreen.logic'

describe('formatCompact', () => {
  it('formats millions and thousands with 1 decimal, keeps small numbers as-is', () => {
    expect(formatCompact(2_450_000)).toBe('2.5M')
    expect(formatCompact(3_200)).toBe('3.2K')
    expect(formatCompact(42)).toBe('42')
  })
})

describe('formatPercent', () => {
  it('returns — for null, one decimal otherwise', () => {
    expect(formatPercent(null)).toBe('—')
    expect(formatPercent(42.345)).toBe('42.3%')
  })
})

describe('formatCostText (ui.md §Formatação de custo)', () => {
  it('renders — when costUsd is null and not partial', () => {
    expect(formatCostText(null)).toBe('—')
  })
  it('renders — ⚠ parcial when costUsd is null and partial', () => {
    expect(formatCostText(null, { partial: true })).toBe('— ⚠ parcial')
  })
  it('renders ~$X.XXXX for an approximate value', () => {
    expect(formatCostText(1.23456, { approximate: true })).toBe('~$1.2346')
  })
  it('renders $X.XXXX ⚠ parcial for a partial value (takes precedence over approximate)', () => {
    expect(formatCostText(0.5, { partial: true, approximate: true })).toBe('$0.5000 ⚠ parcial')
  })
  it('renders a plain $X.XXXX for a complete, non-approximate value', () => {
    expect(formatCostText(3)).toBe('$3.0000')
  })
})

describe('shareLabel (spec F11 §3.2 — split incompleto nunca inventa percentual)', () => {
  const base = {
    agentTokens: 100,
    subagentTokens: 50,
    agentCostUsd: 1,
    subagentCostUsd: 0.5,
    agentPricingComplete: true,
    subagentPricingComplete: true,
  }

  it('computes subagent share of the combined cost when both sides are complete', () => {
    expect(shareLabel(base).text).toBe('33.3%')
  })

  it('falls back to "— / custo parcial" when the agent side is incomplete', () => {
    expect(shareLabel({ ...base, agentPricingComplete: false }).text).toBe('— / custo parcial')
  })

  it('falls back to "— / custo parcial" when the subagent side is incomplete', () => {
    expect(shareLabel({ ...base, subagentPricingComplete: false }).text).toBe('— / custo parcial')
  })

  it('falls back to "— / custo parcial" when either cost is null even if *PricingComplete is true', () => {
    expect(shareLabel({ ...base, agentCostUsd: null }).text).toBe('— / custo parcial')
  })

  it('returns 0% when both sides cost nothing', () => {
    expect(shareLabel({ ...base, agentCostUsd: 0, subagentCostUsd: 0 }).text).toBe('0%')
  })

  it('includes compact token counts in the title tooltip', () => {
    expect(shareLabel(base).title).toBe('Agente: 100 tokens; subagents: 50 tokens.')
  })
})
