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

/**
 * Nomes dos dois arquivos do hook. Moram aqui, e não em `permission-hook.ts`, porque
 * `assertPermissionContract` cobra a forma do comando por plataforma e é fail-closed: com dois
 * donos da mesma string, renomear o launcher derrubaria todo turno supervised no gate. O caminho
 * inverso (o contrato importar do hook) não serve, porque `permission-hook.ts` importa `electron`
 * e este módulo é puro.
 */
export const PERMISSION_HOOK_SCRIPT_NAME = 'permission-hook.mjs'
export const PERMISSION_HOOK_LAUNCHER_NAME = 'permission-hook.cmd'

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

/**
 * Descrição do spawn prestes a acontecer, do ponto de vista do contrato de permissão.
 * `permissionSettingsPath` ausente significa broker não montado (full-access, provider
 * não-Claude, porta/token ausentes): nesse caso não há contrato a cobrar.
 */
export interface PermissionContractSpawnPlan {
  provider: string
  accessLevel: string
  /** Caminho já gravado de `--settings`; `undefined` quando o broker não foi montado. */
  permissionSettingsPath: string | undefined
  /** O objeto que virou o arquivo de `--settings`, validado sem reler o disco. */
  permissionSettings: unknown
  args: readonly string[]
  env: Record<string, string | undefined>
  platform: NodeJS.Platform
}

export type PermissionContractAssertion =
  | { ok: true }
  | { ok: false; message: string }

const CONTRACT_VIOLATION_PREFIX = 'Contrato de permissão do Claude CLI violado antes do turno'

/** Frase acionável para UI e log. Nunca embute command/tool_input (o command carrega o token do broker). */
function contractViolation(detail: string): PermissionContractAssertion {
  return { ok: false, message: `${CONTRACT_VIOLATION_PREFIX}: ${detail}. O turno não foi iniciado.` }
}

/**
 * Gate de produção do contrato: compõe `checkSupervisedPermissionArgs` e
 * `validatePermissionSettingsShape` no ponto onde o spawn ainda pode ser abortado.
 * Sem isto, uma regressão de contrato só aparecia como o agente pedindo aprovação em prosa
 * sobre um botão que nunca chegou à tela.
 */
export function assertPermissionContract(plan: PermissionContractSpawnPlan): PermissionContractAssertion {
  // Turno sem broker montado não tem contrato a cobrar.
  if (plan.permissionSettingsPath === undefined) return { ok: true }

  if (plan.provider !== 'claude') {
    return contractViolation(
      `o broker foi montado para o provider "${plan.provider}", e o hook PreToolUse só existe no Claude CLI`
    )
  }
  if (plan.accessLevel === 'full-access') {
    return contractViolation('o broker foi montado em full-access, nível que roda sem gate de permissão')
  }

  const argsCheck = checkSupervisedPermissionArgs(plan.args)
  if (!argsCheck.ok) {
    return contractViolation(`faltam flags obrigatórias no spawn: ${argsCheck.missing.join(', ')}`)
  }

  const settingsValue = plan.args[plan.args.indexOf('--settings') + 1]
  if (settingsValue !== plan.permissionSettingsPath) {
    return contractViolation('o valor de --settings não aponta para o arquivo de settings gravado neste turno')
  }

  const shape = validatePermissionSettingsShape(plan.permissionSettings)
  if (!shape.ok) {
    return contractViolation(
      `o arquivo de --settings está fora do contrato (${shape.message}); sem os dois grupos de hook, ` +
        'PreToolUse e PermissionRequest com o mesmo command, o CLI nega a escrita mesmo depois do broker aprovar'
    )
  }

  const hookCommand = shape.settings.hooks.PreToolUse[0].hooks[0].command
  if (plan.platform === 'win32') {
    if (!hookCommand.includes(PERMISSION_HOOK_LAUNCHER_NAME)) {
      return contractViolation(
        'no Windows o comando do hook precisa ser o launcher permission-hook.cmd, senão o stdin é engolido e o broker recebe a tool como "unknown"'
      )
    }
  } else if (!hookCommand.includes('ELECTRON_RUN_AS_NODE=1')) {
    return contractViolation(
      'fora do Windows o comando do hook precisa prefixar ELECTRON_RUN_AS_NODE=1, senão o binário do Electron abre UI em vez de interpretar o .mjs do hook'
    )
  }

  if (plan.env.ELECTRON_RUN_AS_NODE !== '1') {
    return contractViolation(
      'ELECTRON_RUN_AS_NODE=1 está ausente no env do spawn, e sem ela o processo do hook abre UI em vez de rodar como Node'
    )
  }

  return { ok: true }
}

/**
 * Contexto de uma negação nativa. O parser do stream não consegue preencher `brokerGranted`
 * (não conhece a thread), então quem diagnostica é `dispatch.ts`, único ponto que tem as duas
 * metades: o metadado do CLI e o fato de o broker ter concedido aquela tool no turno.
 */
export interface NativeDenialContext {
  toolName: string
  /** Código do CLI (`mode`, `hook`, …). */
  decisionReasonType?: string | null
  /** Frase do CLI/hook que explica a negação (`decision_reason`), quando vem. */
  decisionReason?: string | null
  /** `true` quando o broker do EngrenaCode já havia concedido esta tool neste turno. */
  brokerGranted: boolean
}

/**
 * Os dois casos que a negação nativa cobre. Tratá-los como um só era o defeito R08: a copy
 * afirmava sempre `never-brokered` e mandava revisar o nível de acesso, mesmo quando o card
 * apareceu, o usuário concedeu e outro hook `PreToolUse` negou depois.
 */
export type NativeDenialCase = 'never-brokered' | 'after-broker-grant'

export function nativeDenialCase(brokerGranted: boolean): NativeDenialCase {
  return brokerGranted ? 'after-broker-grant' : 'never-brokered'
}

/** Teto do texto vindo do CLI: é frase de hook de terceiro, não pode virar parede de log. */
export const NATIVE_DENIAL_REASON_MAX_CHARS = 300

/** Diagnóstico PT-BR persistido em log e emitido no WS. Nunca embute command/tool_input. */
export function nativeDenialDiagnosis(context: NativeDenialContext): string {
  const tool = context.toolName.trim() === '' ? 'desconhecida' : context.toolName.trim()
  const parts = [
    nativeDenialCase(context.brokerGranted) === 'after-broker-grant'
      ? `O broker do EngrenaCode concedeu a ferramenta ${tool} e outro hook PreToolUse do Claude CLI negou em seguida.`
      : `Aprovação nativa do Claude CLI negou a ferramenta ${tool} sem consultar o broker do EngrenaCode.`,
  ]
  const reasonType = (context.decisionReasonType ?? '').trim()
  if (reasonType !== '') parts.push(`Motivo: ${reasonType}.`)
  const reason = (context.decisionReason ?? '').trim()
  if (reason !== '') parts.push(`Detalhe do CLI: ${reason}`)
  return parts.join(' ')
}
