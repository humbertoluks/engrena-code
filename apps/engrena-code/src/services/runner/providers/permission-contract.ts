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
 * O que o broker do EngrenaCode fez com uma tool **neste turno**.
 *
 * Mora neste módulo, e não em `permission-broker.ts` que o produz, pelo mesmo motivo dos nomes do
 * hook logo acima: aqui é puro (não importa `http`, SQLite nem `electron`) e é o único ponto que
 * as três superfícies conseguem compartilhar — o log do runner, o wire e a copy da faixa âmbar
 * precisam da mesma partição de casos, e re-declará-la em cada uma foi como o R08 nasceu.
 *
 * `never-requested` não é gravado por ninguém: é o que a consulta responde quando não há registro,
 * ou seja, o hook nunca perguntou por essa tool neste turno.
 *
 * `ambiguous` existe porque a chave aqui é o `toolName`, não a chamada: o hook manda `toolName` e
 * `toolInput`, nunca o `tool_use_id` com que a negação chega no stream. Quando a mesma tool recebe
 * decisões de sentidos opostos no mesmo turno (concedida numa chamada, negada em outra), não há
 * como saber qual delas o CLI está reportando — e afirmar uma das duas seria voltar a mentir com
 * outra roupa. Registrar a ambiguidade é o mais honesto que este dado permite.
 */
export type BrokerPermissionOutcome =
  | 'granted'
  | 'denied'
  | 'expired'
  | 'cancelled'
  | 'unavailable'
  | 'ambiguous'
  | 'never-requested'

/**
 * Contexto de uma negação nativa. O parser do stream não consegue preencher `brokerOutcome`
 * (não conhece a thread), então quem diagnostica é `dispatch.ts`, único ponto que tem as duas
 * metades: o metadado do CLI e o que o broker fez com aquela tool no turno.
 */
export interface NativeDenialContext {
  toolName: string
  /** Código do CLI (`mode`, `hook`, …). */
  decisionReasonType?: string | null
  /** Frase do CLI/hook que explica a negação (`decision_reason`), quando vem. */
  decisionReason?: string | null
  /** O que o broker do EngrenaCode fez com esta tool neste turno. */
  brokerOutcome: BrokerPermissionOutcome
  /**
   * `true` quando algum `POST /permission` deste turno foi rejeitado por estourar
   * `PERMISSION_BODY_MAX_BYTES`. Esse caminho responde 413 **antes** de parsear o corpo, então não
   * há `toolName` para registrar e a tool aparece como `never-requested` — exatamente a mesma
   * assinatura de "o CLI nunca consultou o broker". Sem esta ressalva a frase afirmaria com
   * certeza algo que pode ser falso; com ela, o log admite a dúvida em vez de escolher um culpado.
   */
  oversizedRequestInTurn?: boolean
}

/**
 * Os casos que a negação nativa cobre. Tratá-los como um só era o defeito R08 (a copy afirmava
 * sempre `never-brokered` mesmo quando o card apareceu e o usuário concedeu); tratá-los como dois,
 * derivados de um booleano, era o R09 — a negação **do usuário** no card era indistinguível de
 * "o broker nunca viu a tool", e a frase mandava revisar o nível de acesso por uma decisão dele.
 */
export type NativeDenialCase =
  | 'never-brokered'
  | 'after-broker-grant'
  | 'after-user-denial'
  | 'after-gate-expiry'
  | 'after-turn-cancel'
  | 'broker-unavailable'
  | 'conflicting-decisions'

const NATIVE_DENIAL_CASE_BY_OUTCOME: Record<BrokerPermissionOutcome, NativeDenialCase> = {
  granted: 'after-broker-grant',
  denied: 'after-user-denial',
  expired: 'after-gate-expiry',
  cancelled: 'after-turn-cancel',
  unavailable: 'broker-unavailable',
  ambiguous: 'conflicting-decisions',
  'never-requested': 'never-brokered',
}

export function nativeDenialCase(outcome: BrokerPermissionOutcome): NativeDenialCase {
  return NATIVE_DENIAL_CASE_BY_OUTCOME[outcome]
}

/** Teto do texto vindo do CLI: é frase de hook de terceiro, não pode virar parede de log. */
export const NATIVE_DENIAL_REASON_MAX_CHARS = 300

/** Primeira frase do log, por caso. Nunca embute command/tool_input. */
function nativeDenialLead(denialCase: NativeDenialCase, tool: string): string {
  switch (denialCase) {
    case 'after-broker-grant':
      return `O broker do EngrenaCode concedeu a ferramenta ${tool} e outro hook PreToolUse do Claude CLI negou em seguida.`
    case 'after-user-denial':
      return `O usuário negou a ferramenta ${tool} no card de permissão do EngrenaCode, e o Claude CLI registrou a negação.`
    case 'after-gate-expiry':
      return `O pedido de permissão da ferramenta ${tool} ficou sem resposta no card do EngrenaCode e o fail-closed negou.`
    case 'after-turn-cancel':
      return `O turno foi cancelado com o pedido de permissão da ferramenta ${tool} ainda aberto, e o gate fechou negando.`
    case 'broker-unavailable':
      return `O EngrenaCode não conseguiu abrir o pedido de permissão da ferramenta ${tool} e negou por falha interna, sem decisão do usuário nem do Claude CLI.`
    case 'conflicting-decisions':
      return `A ferramenta ${tool} teve decisões opostas neste turno (uma liberada, outra negada) e o CLI não informa a qual chamada esta negação pertence.`
    case 'never-brokered':
      return `Aprovação nativa do Claude CLI negou a ferramenta ${tool} sem consultar o broker do EngrenaCode.`
  }
}

/** Diagnóstico PT-BR persistido em log e emitido no WS. Nunca embute command/tool_input. */
export function nativeDenialDiagnosis(context: NativeDenialContext): string {
  const tool = context.toolName.trim() === '' ? 'desconhecida' : context.toolName.trim()
  const denialCase = nativeDenialCase(context.brokerOutcome)
  const parts = [nativeDenialLead(denialCase, tool)]
  if (denialCase === 'never-brokered' && context.oversizedRequestInTurn === true) {
    parts.push(
      'Ressalva: um pedido de permissão deste turno foi rejeitado por exceder o limite de tamanho, e esse caminho responde antes de ler o nome da ferramenta — pode ter sido este.'
    )
  }
  const reasonType = (context.decisionReasonType ?? '').trim()
  if (reasonType !== '') parts.push(`Motivo: ${reasonType}.`)
  const reason = (context.decisionReason ?? '').trim()
  if (reason !== '') parts.push(`Detalhe do CLI: ${reason}`)
  return parts.join(' ')
}

// ── Faixa de versão do Claude CLI (D3) ───────────────────────────────────────
//
// A versão do CLI não entra em `assertPermissionContract`: contrato violado é erro fail-closed,
// versão divergente é aviso. Bloquear o turno numa versão nova custa mais que avisar, porque o
// contrato provavelmente continua valendo e o usuário ficaria sem app por uma suspeita.

/** Uma versão em que o contrato desta pasta foi conferido, com a evidência que sustenta isso. */
export interface ValidatedClaudeCliVersion {
  version: string
  evidence: string
}

/**
 * O que a história do projeto registra como conferido. Ordenado, mas quem manda nos limites são
 * as duas constantes abaixo (teste cobre que elas continuam batendo com esta lista).
 */
export const PERMISSION_CONTRACT_VALIDATED_VERSIONS: readonly ValidatedClaudeCliVersion[] = [
  {
    version: '2.1.226',
    evidence: 'autoridade real do hook PreToolUse sob --permission-mode auto, confirmada ao vivo',
  },
  {
    version: '2.1.228',
    evidence: 'fixtures stream-json de providers/__fixtures__/permission-stream/ escritas contra ela',
  },
  {
    version: '2.1.231',
    evidence: 'smoke ao vivo de 2026-08-13 (apps/engrena-code/docs/F03-workspace/smoke-results.md)',
  },
]

export const PERMISSION_CONTRACT_MIN_VALIDATED_VERSION = '2.1.226'
export const PERMISSION_CONTRACT_MAX_VALIDATED_VERSION = '2.1.231'

export interface ParsedCliVersion {
  major: number
  minor: number
  patch: number
}

/**
 * Primeiro trio `x.y.z` da saída. `claude --version` hoje responde `2.1.233 (Claude Code)`, mas o
 * formato é do CLI, não nosso: quando ele mudar, o parse devolve `null` e o caso vira
 * indeterminado, nunca uma comparação inventada.
 */
const CLI_VERSION_TRIPLE = /(\d{1,9})\.(\d{1,9})\.(\d{1,9})/

/** Teto do texto que vai para a faixa âmbar: é saída de binário de terceiro, não pode virar parede. */
export const OBSERVED_CLI_VERSION_MAX_CHARS = 60

export function parseCliVersion(raw: string): ParsedCliVersion | null {
  const match = CLI_VERSION_TRIPLE.exec(raw ?? '')
  if (match === null) return null
  const major = Number(match[1])
  const minor = Number(match[2])
  const patch = Number(match[3])
  if (!Number.isSafeInteger(major) || !Number.isSafeInteger(minor) || !Number.isSafeInteger(patch)) {
    return null
  }
  return { major, minor, patch }
}

export function formatCliVersion(version: ParsedCliVersion): string {
  return `${version.major}.${version.minor}.${version.patch}`
}

/** Comparação numérica campo a campo. `2.1.9 < 2.1.10`, que a comparação de string erra. */
export function compareCliVersions(a: ParsedCliVersion, b: ParsedCliVersion): number {
  if (a.major !== b.major) return a.major < b.major ? -1 : 1
  if (a.minor !== b.minor) return a.minor < b.minor ? -1 : 1
  if (a.patch !== b.patch) return a.patch < b.patch ? -1 : 1
  return 0
}

/**
 * Três casos honestos: `below-min` (mais velha que a mais antiga conferida), `above-max` (mais
 * nova que a última validada) e `unparseable` (o `--version` respondeu algo que não tem versão
 * dentro, inclusive vazio). `in-range` cobre o intervalo fechado, não só as três versões da lista:
 * uma 2.1.229 está entre duas conferidas e não merece alarme.
 */
export type ClaudeCliVersionStatus = 'in-range' | 'below-min' | 'above-max' | 'unparseable'

/** Subconjunto que vira aviso; `in-range` nunca chega ao wire. */
export type ClaudeCliVersionWarning = Exclude<ClaudeCliVersionStatus, 'in-range'>

export interface ClaudeCliVersionCheck {
  status: ClaudeCliVersionStatus
  /** Versão formatada quando deu para ler; a saída crua aparada quando não deu. */
  observed: string
  parsed: ParsedCliVersion | null
  minValidated: string
  maxValidated: string
}

/** Primeira linha não vazia, aparada e limitada: o resto da saída não interessa ao usuário. */
function firstMeaningfulLine(rawOutput: string): string {
  const line = (rawOutput ?? '')
    .split('\n')
    .map((part) => part.trim())
    .find((part) => part !== '')
  return (line ?? '').slice(0, OBSERVED_CLI_VERSION_MAX_CHARS)
}

export function checkClaudeCliVersion(rawOutput: string): ClaudeCliVersionCheck {
  const observedRaw = firstMeaningfulLine(rawOutput)
  const parsed = parseCliVersion(observedRaw)
  const min = parseCliVersion(PERMISSION_CONTRACT_MIN_VALIDATED_VERSION)
  const max = parseCliVersion(PERMISSION_CONTRACT_MAX_VALIDATED_VERSION)
  const base = {
    observed: observedRaw,
    parsed,
    minValidated: PERMISSION_CONTRACT_MIN_VALIDATED_VERSION,
    maxValidated: PERMISSION_CONTRACT_MAX_VALIDATED_VERSION,
  }

  // `min`/`max` só seriam nulos com literal quebrado neste arquivo; sem versão de referência não
  // há faixa a cobrar, e inventar um veredito seria pior que assumir indeterminado.
  if (parsed === null || min === null || max === null) {
    return { ...base, status: 'unparseable' }
  }
  if (compareCliVersions(parsed, min) < 0) {
    return { ...base, observed: formatCliVersion(parsed), status: 'below-min' }
  }
  if (compareCliVersions(parsed, max) > 0) {
    return { ...base, observed: formatCliVersion(parsed), status: 'above-max' }
  }
  return { ...base, observed: formatCliVersion(parsed), status: 'in-range' }
}

export function claudeCliVersionWarrantsNotice(
  status: ClaudeCliVersionStatus
): status is ClaudeCliVersionWarning {
  return status !== 'in-range'
}

/** Linha curta de log (kind `task`). A copy da faixa âmbar é do renderer, e é outra frase. */
export function claudeCliVersionLogLine(check: ClaudeCliVersionCheck): string {
  const faixa = `${check.minValidated} a ${check.maxValidated}`
  if (check.status === 'unparseable') {
    const saida = check.observed === '' ? 'saída vazia' : `saída "${check.observed}"`
    return `Não foi possível ler a versão do Claude CLI (${saida}); contrato de permissão validado na faixa ${faixa}. Aviso apenas, o turno não foi bloqueado.`
  }
  const lado = check.status === 'below-min' ? 'abaixo' : 'acima'
  return `Claude CLI ${check.observed} está ${lado} da faixa ${faixa} em que o contrato de permissão foi validado. Aviso apenas, o turno não foi bloqueado.`
}
