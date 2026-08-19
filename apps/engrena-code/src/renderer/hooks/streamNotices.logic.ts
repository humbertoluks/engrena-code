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
import { PERMISSION_COMPOSER_ALLOW_ALL } from '../components/workspace/permissionComposer.logic'
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
   * Vem do runner (`permission.native_denial`): o que o broker do EngrenaCode fez com esta tool no
   * turno. Opcional porque o evento chega do socket como JSON, e ausência cai em `never-requested`
   * — o caso mais conservador, que não atribui a negação a ninguém do lado de cá.
   */
  brokerOutcome?: BrokerPermissionOutcome
  /**
   * Versão do Claude CLI desta máquina, quando ela **já** estava lida no instante da negação.
   * Só o subconjunto de alerta chega aqui: `in-range`, cache frio e binário mudo são omitidos pelo
   * runner. Acrescenta uma frase, e só no caso em que a permissão já quebrou sem card aparecer.
   */
  cliVersionStatus?: 'below-min' | 'above-max' | 'unparseable'
}

/**
 * O motivo cru do CLI e a ressalva de pedido grande demais chegam no wire e **não** são lidos aqui
 * (F30). São diagnóstico de runtime: continuam compostos por `nativeDenialDiagnosis` e gravados em
 * `log_entries`, onde quem investiga vai olhar. Na tarja eles transformavam um evento de produto
 * ("a permissão expirou") num parágrafo sobre hook de terceiro.
 */

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
 * Abertura da faixa: uma frase, o que aconteceu com a tool. Sem citar `PreToolUse`, faixa de versão
 * nem "contrato de permissão" — a tarja é onde o usuário descobre o que ficou por fazer, não onde
 * ele aprende como o EngrenaCode conversa com o CLI.
 */
function denialLead(denialCase: NativeDenialCase, tool: string): string {
  switch (denialCase) {
    case 'after-broker-grant':
      return `${tool} foi liberada aqui, mas um hook do Claude CLI negou em seguida.`
    case 'after-user-denial':
      return `Você negou ${tool}.`
    case 'after-gate-expiry':
      return `A permissão de ${tool} expirou.`
    case 'after-turn-cancel':
      return `O turno parou com a permissão de ${tool} ainda aberta.`
    case 'broker-unavailable':
      return `Não deu para pedir permissão de ${tool}.`
    case 'conflicting-decisions':
      return `${tool} teve decisões diferentes neste turno.`
    case 'never-brokered':
      return `${tool} foi recusada sem aparecer um card.`
  }
}

/** Fecho da faixa: o próximo passo, sem mandar caçar problema no lugar errado. */
function denialAdvice(denialCase: NativeDenialCase): string {
  switch (denialCase) {
    case 'after-broker-grant':
      return 'Ajuste esse hook nos settings do Claude CLI, ou peça outro caminho ao agente.'
    case 'after-user-denial':
      // Nada de "revise o nível de acesso": a decisão foi do usuário, e nada quebrou.
      return `Peça de novo e conceda no card, ou use "${PERMISSION_COMPOSER_ALLOW_ALL}".`
    case 'after-gate-expiry':
      return 'Peça de novo ao agente.'
    case 'after-turn-cancel':
      return 'Peça de novo quando quiser retomar.'
    case 'conflicting-decisions':
      return 'Peça de novo e responda ao card que aparecer.'
    case 'broker-unavailable':
      return 'Peça de novo ao agente.'
    case 'never-brokered':
      return 'Peça de novo. Se repetir, revise o nível de acesso da thread.'
  }
}

/**
 * Única frase da tarja que fala de versão de CLI, e só quando a permissão **já** quebrou sem card
 * aparecer. Fora daqui, versão vive em `#configuracao` e no log (F30): citá-la num turno que correu
 * normal era transformar um dado de diagnóstico em alarme.
 */
const DENIAL_CLI_CAUSE = 'A versão do Claude CLI nesta máquina ainda não foi conferida.'

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
  if (denialCase === 'never-brokered' && event.cliVersionStatus !== undefined) {
    parts.push(DENIAL_CLI_CAUSE)
  }
  parts.push(denialAdvice(denialCase))
  return parts.join(' ')
}
