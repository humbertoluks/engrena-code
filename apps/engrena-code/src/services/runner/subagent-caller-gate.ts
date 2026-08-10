export type ParentProvider = 'claude' | 'codex' | 'kimi'
export type ParentAccessLevel = 'supervised' | 'auto-accept-edits' | 'full-access'

export interface ParentContext {
  provider: ParentProvider
  accessLevel: ParentAccessLevel
}

export interface GateResult {
  allowed: boolean
  reason?: string
}

const CODEX_BLOCK_REASON =
  'Codex só delega subagents com access level full-access. Ajuste o access level da thread para habilitar call_subagent.'

/**
 * Codex pai só delega com full-access explícito (spec F07 §3.2). Outros providers não têm essa
 * restrição — o gate degrada silenciosamente para "permitido" fora do caso Codex.
 */
export function canDelegateSubagent(parent: ParentContext): GateResult {
  if (parent.provider === 'codex' && parent.accessLevel !== 'full-access') {
    return { allowed: false, reason: CODEX_BLOCK_REASON }
  }
  return { allowed: true }
}
