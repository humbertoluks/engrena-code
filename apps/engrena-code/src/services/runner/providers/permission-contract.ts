/**
 * Sprint 1 — contrato de flags/settings do Claude CLI em modo supervised.
 * Fonte de verdade para o harness de compliance (unitário) e para `cli-driver.buildArgs`.
 *
 * Confirmado ao vivo (claude-code ≥2.1.226): `--permission-mode auto` + `--settings` com
 * wrapper `hooks.PreToolUse` é a única combinação em que o hook tem autoridade real.
 * `--include-hook-events` (stream-json) expõe `hook_started`/`hook_response` e permite
 * detectar quando o gate PreToolUse não disparou (ex.: Bash `run_in_background` caindo
 * em aprovação nativa).
 */

export const SUPERVISED_PERMISSION_MODE = 'auto' as const
export const HOOK_COMMAND_TIMEOUT_SEC = 600
export const INCLUDE_HOOK_EVENTS_FLAG = '--include-hook-events' as const

export type PermissionContractCheck =
  | { ok: true }
  | { ok: false; missing: string[] }

export type BashPermissionMatrixCase = 'simple' | 'compound' | 'foreground-server' | 'run-in-background'

export interface BashMatrixExpectation {
  case: BashPermissionMatrixCase
  /** Ideal: PreToolUse abre o broker antes da execução. */
  expectsPreToolUseGate: boolean
  /**
   * Se o CLI cair em aprovação nativa sem modal EngrenaCode, o driver DEVE emitir
   * `permission-native-denial` (gate Sprint 1).
   */
  requiresNativeDenialEventIfUngated: true
  notes: string
}

/** Matriz Bash do Sprint 1 — expectativas de produto, não prova de CLI ao vivo. */
export const BASH_PERMISSION_MATRIX: readonly BashMatrixExpectation[] = [
  {
    case: 'simple',
    expectsPreToolUseGate: true,
    requiresNativeDenialEventIfUngated: true,
    notes: 'Bash simples (ex.: ls) — PreToolUse + broker já confirmados em smoke F03.',
  },
  {
    case: 'compound',
    expectsPreToolUseGate: true,
    requiresNativeDenialEventIfUngated: true,
    notes: 'Bash composto (cmd && cmd) — mesmo gate PreToolUse que o simples.',
  },
  {
    case: 'foreground-server',
    expectsPreToolUseGate: true,
    requiresNativeDenialEventIfUngated: true,
    notes: 'Servidor em foreground (bloqueante) — PreToolUse deve disparar antes do spawn.',
  },
  {
    case: 'run-in-background',
    expectsPreToolUseGate: true,
    requiresNativeDenialEventIfUngated: true,
    notes:
      'Bash com run_in_background:true — se o CLI atual pular PreToolUse e cair em aprovação nativa, o mínimo Sprint 1 é emitir permission-native-denial no stream (UI em sprint posterior).',
  },
]

/** Flags obrigatórias quando supervised anexa `--settings` do PermissionBroker. */
export function shouldIncludeHookEvents(hasPermissionSettings: boolean): boolean {
  return hasPermissionSettings
}

export function checkSupervisedPermissionArgs(args: readonly string[]): PermissionContractCheck {
  const missing: string[] = []

  if (!args.includes('--output-format') || args[args.indexOf('--output-format') + 1] !== 'stream-json') {
    missing.push('--output-format stream-json')
  }

  const modeIdx = args.indexOf('--permission-mode')
  if (modeIdx === -1 || args[modeIdx + 1] !== SUPERVISED_PERMISSION_MODE) {
    missing.push(`--permission-mode ${SUPERVISED_PERMISSION_MODE}`)
  }

  if (!args.includes('--settings')) {
    missing.push('--settings')
  }

  if (!args.includes(INCLUDE_HOOK_EVENTS_FLAG)) {
    missing.push(INCLUDE_HOOK_EVENTS_FLAG)
  }

  return missing.length === 0 ? { ok: true } : { ok: false, missing }
}

export interface PermissionSettingsHookCommand {
  type: 'command'
  command: string
  timeout: number
}

export interface PermissionSettingsShape {
  hooks: {
    PreToolUse: Array<{
      matcher: string
      hooks: PermissionSettingsHookCommand[]
    }>
    PermissionRequest: Array<{
      matcher: string
      hooks: PermissionSettingsHookCommand[]
    }>
  }
}

export type PermissionSettingsValidation =
  | { ok: true; settings: PermissionSettingsShape }
  | { ok: false; message: string }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function validateHookGroup(
  hooks: Record<string, unknown>,
  eventName: string
): { ok: true; matcher: string; command: string } | { ok: false; message: string } {
  const group = hooks[eventName]
  if (!Array.isArray(group) || group.length === 0) {
    return { ok: false, message: `hooks.${eventName} ausente ou vazio` }
  }
  const first = group[0]
  if (!isRecord(first)) return { ok: false, message: `${eventName}[0] inválido` }
  if (typeof first.matcher !== 'string') return { ok: false, message: `${eventName} matcher ausente` }
  const inner = first.hooks
  if (!Array.isArray(inner) || inner.length === 0) {
    return { ok: false, message: `${eventName} hooks[] vazio` }
  }
  const cmd = inner[0]
  if (!isRecord(cmd)) return { ok: false, message: `${eventName} hook command inválido` }
  if (cmd.type !== 'command') return { ok: false, message: `${eventName} hook.type deve ser command` }
  if (typeof cmd.command !== 'string' || cmd.command.length === 0) {
    return { ok: false, message: `${eventName} hook.command ausente` }
  }
  if (cmd.timeout !== HOOK_COMMAND_TIMEOUT_SEC) {
    return { ok: false, message: `${eventName} hook.timeout deve ser ${HOOK_COMMAND_TIMEOUT_SEC}` }
  }
  // Unix embute a var no comando; Windows usa permission-hook.cmd que seta a var e preserva stdin.
  const embedsEnv =
    cmd.command.includes('ELECTRON_RUN_AS_NODE=1') || cmd.command.includes('permission-hook.cmd')
  if (!embedsEnv) {
    return {
      ok: false,
      message: `${eventName} hook.command deve embutir ELECTRON_RUN_AS_NODE=1 ou permission-hook.cmd`,
    }
  }
  return { ok: true, matcher: first.matcher, command: cmd.command }
}

/** Valida o shape de `--settings` (PreToolUse + PermissionRequest) do broker. */
export function validatePermissionSettingsShape(value: unknown): PermissionSettingsValidation {
  if (!isRecord(value)) return { ok: false, message: 'settings não é objeto' }
  const hooks = value.hooks
  if (!isRecord(hooks)) return { ok: false, message: 'hooks ausente' }

  const pre = validateHookGroup(hooks, 'PreToolUse')
  if (!pre.ok) return pre
  const perm = validateHookGroup(hooks, 'PermissionRequest')
  if (!perm.ok) return perm
  if (pre.command !== perm.command) {
    return { ok: false, message: 'PreToolUse e PermissionRequest devem usar o mesmo command' }
  }

  const entry = {
    matcher: pre.matcher,
    hooks: [{ type: 'command' as const, command: pre.command, timeout: HOOK_COMMAND_TIMEOUT_SEC }],
  }
  return {
    ok: true,
    settings: {
      hooks: {
        PreToolUse: [entry],
        PermissionRequest: [entry],
      },
    },
  }
}

/** Diagnóstico PT-BR para negação nativa do CLI (sem modal EngrenaCode). */
export function nativeDenialDiagnosis(toolName: string, decisionReasonType: string | null): string {
  const base = `Aprovação nativa do Claude CLI negou a ferramenta ${toolName} (sem modal EngrenaCode).`
  if (decisionReasonType && decisionReasonType.length > 0) {
    return `${base} Motivo: ${decisionReasonType}.`
  }
  return base
}
