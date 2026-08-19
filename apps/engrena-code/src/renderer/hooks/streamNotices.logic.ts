/**
 * Avisos de faixa do workspace (a tarja âmbar acima da conversa).
 *
 * Dois emissores: `mcp.notice` (MCP indisponível/degradado) e `permission.native_denial`. O segundo
 * chegava tipado no `StreamEvent` e sumia sem branch — o sintoma para o usuário era o agente dizendo
 * que precisava de aprovação sem card nenhum na tela, porque o CLI negou a tool nativamente, sem
 * consultar o broker do EngrenaCode. É contrato quebrado, precisa ser visível.
 *
 * O que **não** entra mais aqui (F30): versão do Claude CLI fora da faixa validada. Era um terceiro
 * kind e uma parede de texto sobre `PreToolUse` e faixa de versão em cima de um turno que correu
 * normal — a tarja é lida como falha do que acabou de rodar. Esse diagnóstico foi para `log_entries`
 * (já era gravado) e para a caption da row Claude em `#configuracao`.
 *
 * A negação nativa tem causas diferentes e só o runner sabe qual foi (`brokerOutcome`); a decisão
 * de copy fica em `nativeDenialMessage`, que é puro e coberto por teste em cada caso.
 */
import {
  PERMISSION_COMPOSER_ALLOW_ALL,
  PERMISSION_COMPOSER_ALLOW_PROJECT,
} from '../components/workspace/permissionComposer.logic'
import {
  nativeDenialCase,
  type BrokerPermissionOutcome,
  type NativeDenialCase,
} from '../../services/runner/providers/permission-contract.js'

/** Faixa cresce só até aqui; avisos antigos saem pela frente (a tarja não é histórico). */
export const MAX_WORKSPACE_NOTICES = 20

export type WorkspaceNotice =
  | { kind: 'mcp'; mcpName: string; reason: string; message: string }
  | { kind: 'native_denial'; toolName: string; code: string; message: string }

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
  /**
   * Houve rejeição de pedido por tamanho neste turno. Só qualifica o caso "o broker nunca foi
   * consultado": é o único em que uma rejeição sem `toolName` pode estar se passando por ele.
   */
  oversizedRequestInTurn?: boolean
  /**
   * Vem do runner (`permission.native_denial`): o que o broker do EngrenaCode fez com esta tool no
   * turno. Opcional porque o evento chega do socket como JSON, e ausência cai em `never-requested`
   * — o caso mais conservador, que não atribui a negação a ninguém do lado de cá.
   */
  brokerOutcome?: BrokerPermissionOutcome
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

/** Abertura da faixa: quem negou, e se houve card na tela. */
function denialLead(denialCase: NativeDenialCase, tool: string): string {
  switch (denialCase) {
    case 'after-broker-grant':
      return `O EngrenaCode concedeu a ferramenta ${tool}, mas outro hook PreToolUse do Claude CLI negou em seguida.`
    case 'after-user-denial':
      return `Você negou a ferramenta ${tool} no card de permissão, e o Claude CLI encerrou a chamada.`
    case 'after-gate-expiry':
      return `O card de permissão da ferramenta ${tool} ficou sem resposta e expirou, então o EngrenaCode negou por segurança.`
    case 'after-turn-cancel':
      return `Você parou o turno com o card de permissão da ferramenta ${tool} ainda aberto, então ele fechou negando.`
    case 'broker-unavailable':
      return `O EngrenaCode não conseguiu abrir o pedido de permissão da ferramenta ${tool} e negou por segurança, sem chegar a te perguntar.`
    case 'conflicting-decisions':
      return `A ferramenta ${tool} foi liberada numa chamada e negada em outra neste mesmo turno, e o CLI não diz a qual delas esta negação pertence.`
    case 'never-brokered':
      return `O CLI negou a ferramenta ${tool} por conta própria, sem pedir permissão ao EngrenaCode, por isso nenhum card apareceu no chat.`
  }
}

/** Fecho da faixa: o que fazer a seguir, sem mandar caçar problema no lugar errado. */
function denialAdvice(denialCase: NativeDenialCase): string {
  switch (denialCase) {
    case 'after-broker-grant':
      return 'O nível de acesso da thread não muda isso: quem negou foi um hook do próprio Claude CLI, configurado fora do EngrenaCode (nos settings do usuário ou do projeto). Ajuste esse hook ou peça ao agente um caminho que ele aceite.'
    case 'after-user-denial':
      return (
        'Nada quebrou: foi a sua decisão. Para liberar, peça a ação de novo ao agente e conceda no card; ' +
        `se não quiser ser perguntado outra vez por essa ferramenta, responda "${PERMISSION_COMPOSER_ALLOW_ALL}" ou "${PERMISSION_COMPOSER_ALLOW_PROJECT}".`
      )
    case 'after-gate-expiry':
      return 'Peça a ação de novo ao agente e responda ao card enquanto ele estiver na tela.'
    case 'after-turn-cancel':
      return 'Nada quebrou: o turno foi cancelado por você. Peça a ação de novo quando quiser retomar.'
    case 'conflicting-decisions':
      return 'Se a ação que você queria não aconteceu, peça de novo ao agente e responda ao card que aparecer.'
    case 'broker-unavailable':
      return 'Não foi decisão sua nem do Claude CLI: foi uma falha interna do EngrenaCode ao registrar o pedido. Peça a ação de novo ao agente.'
    case 'never-brokered':
      return 'Peça de novo ao agente; se repetir, revise o nível de acesso da thread.'
  }
}

/**
 * Uma copy por causa. A versão original tinha uma só e afirmava, sempre, que o CLI negou sem
 * consultar o EngrenaCode e que nenhum card apareceu. Dois smokes ao vivo de 2026-08-16 mostraram
 * a frase mentindo: no R08 o card apareceu, o usuário concedeu, o broker liberou e um hook
 * `PreToolUse` global negou depois; no R09 quem negou no card foi o próprio usuário. Nos dois a
 * conclusão ("revise o nível de acesso") mandava mexer onde não havia problema.
 *
 * A partição de casos é importada de `permission-contract` em vez de reescrita aqui: o log do
 * runner e esta faixa precisam falar da mesma causa, e duas cópias da regra foi como o R08 nasceu.
 *
 * O `message` que vem no wire não entra aqui de propósito: é o mesmo diagnóstico composto no
 * runner a partir destes campos, e concatená-lo repetia a frase inteira dentro da própria faixa.
 */
export function nativeDenialMessage(event: NativeDenialEvent): string {
  const tool = event.toolName.trim() === '' ? 'desconhecida' : event.toolName.trim()
  const denialCase = nativeDenialCase(event.brokerOutcome ?? 'never-requested')
  const parts = [denialLead(denialCase, tool)]
  if (denialCase === 'never-brokered' && event.oversizedRequestInTurn === true) {
    parts.push(
      'Ressalva: um pedido de permissão deste turno foi recusado por ser grande demais, e esse caminho responde antes de ler o nome da ferramenta — pode ter sido este.'
    )
  }
  const reasonType = (event.decisionReasonType ?? '').trim()
  if (reasonType !== '') parts.push(`Motivo do CLI: ${reasonType}.`)
  const reason = (event.decisionReason ?? '').trim()
  if (reason !== '') parts.push(`O CLI explicou: ${reason}`)
  parts.push(denialAdvice(denialCase))
  return parts.join(' ')
}
