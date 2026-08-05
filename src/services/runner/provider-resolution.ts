import type { ThreadProvider } from '../db/repositories/threads.js'
import { calculateTableCost, type BillingMode, type CostSource, type TableCostInput } from '../db/repositories/usage-events.js'
import { findPricing } from '../db/repositories/pricing.js'
import { vaultService } from '../vault/vault-service.js'

/** Resolve a API key do vault para o provider — Claude só em modo api-key; Codex/Minimax quando salva. */
export function resolveProviderApiKey(provider: ThreadProvider): string | undefined {
  if (provider === 'claude') {
    const mode = vaultService.getSecret('claude:mode') ?? 'subscription'
    return mode === 'api-key' ? vaultService.getSecret('keys:claude') : undefined
  }
  if (provider === 'codex') return vaultService.getSecret('keys:codex')
  if (provider === 'minimax') return vaultService.getSecret('keys:minimax')
  return undefined
}

/**
 * Mapeia provider → billingMode do turno (spec F11 §3.2, confirmado via entrevista — sem conceito
 * `compat` no EngrenaCode, `'token-plan'` nunca é retornado neste MVP). Claude reusa `claude:mode`
 * (F10); Codex cai pra `'subscription'` sem key salva (sem toggle explícito); Kimi não tem key no F10,
 * sempre `'subscription'`; Minimax não tem CLI/login, sempre `'api-key'`.
 */
export function resolveBillingMode(provider: ThreadProvider): BillingMode {
  if (provider === 'claude') {
    const mode = vaultService.getSecret('claude:mode') ?? 'subscription'
    return mode === 'api-key' ? 'api-key' : 'subscription'
  }
  if (provider === 'codex') return vaultService.getSecret('keys:codex') ? 'api-key' : 'subscription'
  if (provider === 'minimax') return 'api-key'
  return 'subscription'
}

export interface ResolvedTurnCost {
  costUsd: number | null
  costSource: CostSource
  costApproximate: boolean
}

/**
 * `cost_source='sdk'` só quando `provider==='claude'` E o CLI reportou `costUsd` válido; caso
 * contrário calcula via `model_pricing` (`cost_source='table'`), ou `cost_usd=null` quando não
 * há preço cadastrado pro par (spec F11 §3.2/§6). Compartilhado entre `dispatch.ts` (source=agent)
 * e `delegate.ts` (source=subagent) para não duplicar a regra de congelamento de custo.
 */
export function resolveTurnCost(
  provider: ThreadProvider,
  model: string | null,
  usage: TableCostInput,
  sdkCostUsd: number | null | undefined
): ResolvedTurnCost {
  if (provider === 'claude' && typeof sdkCostUsd === 'number') {
    return { costUsd: sdkCostUsd, costSource: 'sdk', costApproximate: false }
  }

  const pricing = model ? findPricing(provider, model) : null
  if (pricing) {
    const { costUsd } = calculateTableCost(usage, pricing)
    return { costUsd, costSource: 'table', costApproximate: pricing.approximate }
  }

  return { costUsd: null, costSource: 'table', costApproximate: false }
}
