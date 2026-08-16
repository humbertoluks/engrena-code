/**
 * Avisos de faixa do workspace (a tarja âmbar acima da conversa).
 *
 * Três emissores hoje: `mcp.notice` (MCP indisponível/degradado), `permission.native_denial` e
 * `cli.version_notice` (versão do Claude CLI fora da faixa validada do contrato de permissão).
 * O segundo chegava tipado no `StreamEvent` e sumia sem branch — o sintoma para o usuário era o
 * agente dizendo que precisava de aprovação sem card nenhum na tela, porque o CLI negou a tool
 * nativamente, sem consultar o broker do EngrenaCode. É contrato quebrado, precisa ser visível.
 *
 * A negação nativa tem duas causas diferentes e só o runner sabe qual foi (`brokerGranted`); a
 * decisão de copy fica em `nativeDenialMessage`, que é puro e coberto por teste nos dois casos.
 */

/** Faixa cresce só até aqui; avisos antigos saem pela frente (a tarja não é histórico). */
export const MAX_WORKSPACE_NOTICES = 20

export type WorkspaceNotice =
  | { kind: 'mcp'; mcpName: string; reason: string; message: string }
  | { kind: 'native_denial'; toolName: string; code: string; message: string }
  | { kind: 'cli_version'; code: string; message: string }

/**
 * Acrescenta mantendo o teto. Antes a lista crescia sem limite e só era limpa na troca de
 * thread: um turno com MCP em loop enchia a tarja e empurrava a conversa para fora da tela.
 */
export function appendWorkspaceNotice(
  notices: readonly WorkspaceNotice[],
  notice: WorkspaceNotice
): WorkspaceNotice[] {
  const next = [...notices, notice]
  return next.length > MAX_WORKSPACE_NOTICES ? next.slice(next.length - MAX_WORKSPACE_NOTICES) : next
}

export function mcpNotice(event: {
  mcpName: string
  reason: string
  message: string
}): WorkspaceNotice {
  return { kind: 'mcp', mcpName: event.mcpName, reason: event.reason, message: event.message }
}

export interface NativeDenialEvent {
  toolName: string
  /** Vem do runner (`permission.native_denial`); `false` legado é o caso "broker nunca viu". */
  brokerGranted?: boolean
  /** Código do CLI (`mode`, `hook`, …). */
  decisionReasonType?: string | null
  /** Frase de quem negou, quando o CLI manda (`decision_reason`). */
  decisionReason?: string | null
}

/** Nome cru da tool na mensagem: é o que o usuário precisa para saber o que ficou por fazer. */
export function nativeDenialNotice(event: NativeDenialEvent & { code: string }): WorkspaceNotice {
  return {
    kind: 'native_denial',
    toolName: event.toolName,
    code: event.code,
    message: nativeDenialMessage(event),
  }
}

/**
 * Duas causas, duas mensagens. A versão anterior tinha uma só e afirmava, sempre, que o CLI negou
 * sem consultar o EngrenaCode e que nenhum card apareceu. No smoke ao vivo de 2026-08-16 os dois
 * fatos eram falsos: o card apareceu, o usuário concedeu, o broker liberou e um hook `PreToolUse`
 * global do usuário negou depois. A conclusão da frase antiga ("revise o nível de acesso") também
 * não ajudava, porque nível nenhum manda no hook de outra pessoa.
 *
 * O `message` que vem no wire não entra aqui de propósito: é o mesmo diagnóstico composto no
 * runner a partir destes campos, e concatená-lo repetia a frase inteira dentro da própria faixa.
 */
export function nativeDenialMessage(event: NativeDenialEvent): string {
  const tool = event.toolName.trim() === '' ? 'desconhecida' : event.toolName.trim()
  const afterGrant = event.brokerGranted === true
  const parts = [
    afterGrant
      ? `O EngrenaCode concedeu a ferramenta ${tool}, mas outro hook PreToolUse do Claude CLI negou em seguida.`
      : `O CLI negou a ferramenta ${tool} por conta própria, sem pedir permissão ao EngrenaCode, por isso nenhum card apareceu no chat.`,
  ]
  const reasonType = (event.decisionReasonType ?? '').trim()
  if (reasonType !== '') parts.push(`Motivo do CLI: ${reasonType}.`)
  const reason = (event.decisionReason ?? '').trim()
  if (reason !== '') parts.push(`O CLI explicou: ${reason}`)
  parts.push(
    afterGrant
      ? 'O nível de acesso da thread não muda isso: quem negou foi um hook do próprio Claude CLI, configurado fora do EngrenaCode (nos settings do usuário ou do projeto). Ajuste esse hook ou peça ao agente um caminho que ele aceite.'
      : 'Peça de novo ao agente; se repetir, revise o nível de acesso da thread.'
  )
  return parts.join(' ')
}

export interface CliVersionNoticeEvent {
  /** Sempre um dos três casos de alerta; `in-range` nunca é emitido pelo runner. */
  status: 'below-min' | 'above-max' | 'unparseable'
  /** Versão lida, ou a saída crua aparada quando ela não pôde ser interpretada (pode ser vazia). */
  observedVersion: string
  minValidated: string
  maxValidated: string
}

/**
 * Copy da faixa âmbar para versão do Claude CLI fora da faixa validada.
 *
 * Três coisas precisam estar na frase: qual versão está instalada, contra qual faixa o contrato
 * de permissão foi validado e que o turno **não** foi bloqueado. O que ela não faz é mandar o
 * usuário voltar de versão: o contrato provavelmente continua valendo, e o objetivo é ele saber
 * por que algo pode se comportar diferente, não abrir um chamado de downgrade.
 */
export function cliVersionNoticeMessage(event: CliVersionNoticeEvent): string {
  const faixa = `${event.minValidated} a ${event.maxValidated}`
  const validada = 'contra a qual o contrato de permissão do EngrenaCode foi validado'

  if (event.status === 'unparseable') {
    const saida =
      event.observedVersion.trim() === ''
        ? 'o comando `claude --version` não respondeu nada legível'
        : `o comando \`claude --version\` respondeu "${event.observedVersion}"`
    return (
      `Não consegui ler a versão do Claude CLI: ${saida}. ` +
      `O contrato de permissão do EngrenaCode foi validado na faixa ${faixa} e não dá para conferir se a versão instalada está dentro dela. ` +
      'O turno não foi bloqueado.'
    )
  }

  if (event.status === 'below-min') {
    return (
      `O Claude CLI instalado é a versão ${event.observedVersion}, abaixo da faixa ${faixa} ${validada}. ` +
      'O turno não foi bloqueado. Nessa versão o hook PreToolUse pode não ter autoridade de allow/deny, ' +
      'então os cards de permissão podem não aparecer.'
    )
  }

  return (
    `O Claude CLI instalado é a versão ${event.observedVersion}, acima da faixa ${faixa} ${validada}. ` +
    'O turno não foi bloqueado. Se um card de permissão deixar de aparecer ou uma ferramenta for negada ' +
    'sem passar pelo EngrenaCode, a diferença de versão é a primeira suspeita.'
  )
}

export function cliVersionNotice(event: CliVersionNoticeEvent & { code: string }): WorkspaceNotice {
  return { kind: 'cli_version', code: event.code, message: cliVersionNoticeMessage(event) }
}
