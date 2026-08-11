/**
 * Regras puras da rolagem do chat (ver useChatScroll).
 *
 * O chat cola no fim só enquanto o usuário já estava perto do fim: quem subiu para reler não
 * tem a rolagem sequestrada quando o agente responde. Nesse caso a resposta nova vira um CTA
 * ("Ver mensagem") em vez de um salto.
 */

/** Distância do fim (px) que ainda conta como "no fim". */
export const NEAR_BOTTOM_THRESHOLD_PX = 80

export interface ScrollMetrics {
  scrollHeight: number
  scrollTop: number
  clientHeight: number
}

export function distanceFromBottom(m: ScrollMetrics): number {
  return m.scrollHeight - m.scrollTop - m.clientHeight
}

export function isNearBottom(m: ScrollMetrics, threshold: number = NEAR_BOTTOM_THRESHOLD_PX): boolean {
  return distanceFromBottom(m) <= threshold
}

/**
 * Visibilidade do CTA de resposta nova. Colado no fim nunca mostra (a mensagem já está à
 * vista); longe do fim, uma resposta nova acende e o CTA fica até o usuário ir até lá.
 */
export function shouldShowJump(input: { latestChanged: boolean; pinned: boolean; current: boolean }): boolean {
  if (input.pinned) return false
  if (input.latestChanged) return true
  return input.current
}

/** Atalho do CTA: Ctrl+End (sem Alt/Shift; Meta não conta, para não roubar o atalho do SO). */
export function isJumpShortcut(event: {
  key: string
  ctrlKey: boolean
  metaKey: boolean
  altKey: boolean
  shiftKey: boolean
}): boolean {
  if (event.key !== 'End') return false
  if (!event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return false
  return true
}

/**
 * Campo de texto em foco continua recebendo o Ctrl+End nativo (cursor para o fim do texto):
 * a conversa desce junto, mas sem `preventDefault` roubando o comportamento do composer.
 */
export function shouldPreventJumpDefault(target: { tagName?: string; isContentEditable?: boolean } | null): boolean {
  if (!target) return true
  if (target.isContentEditable === true) return false
  const tag = (target.tagName ?? '').toLowerCase()
  return tag !== 'textarea' && tag !== 'input'
}
