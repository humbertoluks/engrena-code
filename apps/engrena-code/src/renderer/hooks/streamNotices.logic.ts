/**
 * Avisos de faixa do workspace (a tarja âmbar acima da conversa).
 *
 * Dois emissores hoje: `mcp.notice` (MCP indisponível/degradado) e `permission.native_denial`.
 * O segundo chegava tipado no `StreamEvent` e sumia sem branch — o sintoma para o usuário era o
 * agente dizendo que precisava de aprovação sem card nenhum na tela, porque o CLI negou a tool
 * nativamente, sem consultar o broker do EngrenaCode. É contrato quebrado, precisa ser visível.
 */

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

/** Nome cru da tool na mensagem: é o que o usuário precisa para saber o que ficou por fazer. */
export function nativeDenialNotice(event: {
  toolName: string
  code: string
  message: string
  decisionReasonType?: string | null
}): WorkspaceNotice {
  return {
    kind: 'native_denial',
    toolName: event.toolName,
    code: event.code,
    message: nativeDenialMessage(event),
  }
}

export function nativeDenialMessage(event: {
  toolName: string
  message?: string | null
  decisionReasonType?: string | null
}): string {
  const tool = event.toolName.trim() === '' ? 'desconhecida' : event.toolName.trim()
  const parts = [
    `O CLI negou a ferramenta ${tool} por conta própria, sem pedir permissão ao EngrenaCode — por isso nenhum card apareceu no chat.`,
  ]
  const detail = (event.message ?? '').trim()
  if (detail !== '') parts.push(detail)
  const reason = (event.decisionReasonType ?? '').trim()
  if (reason !== '') parts.push(`Motivo do CLI: ${reason}.`)
  parts.push('Peça de novo ao agente; se repetir, revise o nível de acesso da thread.')
  return parts.join(' ')
}
