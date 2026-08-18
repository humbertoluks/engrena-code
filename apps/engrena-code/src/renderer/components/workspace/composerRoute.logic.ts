import type { ThreadState } from '../../services/threads-service'
import type { ThreadGate } from '../../hooks/threadGate.logic'
import {
  interpretPermissionChatReply,
  PERMISSION_PENDING_HINT,
  type PermissionDecisionKind,
} from './permissionComposer.logic'

export type ComposerRouteDecision =
  | {
      action: 'resolve_permission'
      /** O mesmo `kind` que o chip do card produz — daqui para a frente a resolução é uma só. */
      decision: { kind: PermissionDecisionKind }
    }
  | { action: 'permission_blocked'; message: string }
  | { action: 'answer_question' }
  | { action: 'enqueue' }
  | { action: 'send_new' }
  | { action: 'send_follow_up' }
  | { action: 'noop' }

export interface ComposerRouteInput {
  text: string
  threadState: ThreadState | null | undefined
  /**
   * O gate aberto da thread (`useThreadGate`) — fonte única de "algo espera decisão humana".
   * Substituiu o par `hasPendingPermission`/`hasPendingQuestion`, que eram duas representações
   * paralelas do mesmo fato (uma vinda do WS, outra inferida de `toolCalls`).
   */
  gate: ThreadGate | null
  /**
   * Itens já esperando na fila do composer. Entra na decisão porque a ordem é do usuário: com
   * alguém na frente, o texto novo vai para trás dele mesmo com a thread parada.
   */
  queueLength: number
  hasSelectedThread: boolean
  hasSelectedProject: boolean
}

/**
 * Decide o destino do texto do composer sem efeitos colaterais.
 *
 * Prioridade:
 * 1. waiting_permission OU fila de permissão não-vazia → allow/deny/allow-all ou bloqueio (nunca enqueue)
 * 2. waiting_user + pergunta pendente → answer
 * 3. running / waiting_user / waiting_permission (sem permissão resolvível) → enqueue
 * 4. thread parada **com fila não-vazia** → enqueue (a ordem do usuário manda, não o estado)
 * 5. sem thread → send_new; com thread idle e fila vazia → send_follow_up
 */
export function routeComposerSend(input: ComposerRouteInput): ComposerRouteDecision {
  const text = input.text.trim()
  if (text === '') return { action: 'noop' }

  const hasPendingPermission = input.gate?.kind === 'permission'
  const permissionGate = hasPendingPermission || input.threadState === 'waiting_permission'

  if (permissionGate) {
    const reply = interpretPermissionChatReply(text)
    if (reply.kind !== 'blocked') {
      // Estado DB diz waiting_permission mas o gate local não chegou (WS perdido): não há o que
      // resolver, e tratar "sim" como decisão aqui concederia no vazio. A UI refetch antes.
      if (!hasPendingPermission) {
        return { action: 'permission_blocked', message: PERMISSION_PENDING_HINT }
      }
      return { action: 'resolve_permission', decision: reply }
    }
    // Texto comum com card aberto é mensagem, não decisão: vai para a fila como em qualquer outro
    // estado ocupado. Antes era recusado — e recusar é o único destino que perde o que o usuário
    // escreveu. O card segue respondido pelo chip (que concede direto, sem passar por aqui) e as
    // palavras de decisão seguem sendo lidas como decisão.
    return { action: 'enqueue' }
  }

  if (input.threadState === 'waiting_user' && input.gate?.kind === 'question') {
    return { action: 'answer_question' }
  }

  if (
    input.threadState === 'running' ||
    input.threadState === 'waiting_user' ||
    input.threadState === 'waiting_permission'
  ) {
    return { action: 'enqueue' }
  }

  // Thread parada mas com gente na fila: o texto novo entra **atrás**. Sem isto a rota caía em
  // `send_follow_up` e a mensagem recém-digitada furava a fila — o item antigo só rodava no fim
  // desse turno novo, exatamente ao contrário do que o usuário pediu. Acontece sempre que um
  // turno é cancelado com fila cheia: `cancelled` não despacha a fila (decisão de
  // `TURN_RECONCILED_STATES`), então ela fica esperando um empurrão explícito.
  //
  // Só com thread selecionada: a fila é despachada por `sendFollowUp`, e sem thread não há para
  // onde despachar — enfileirar ali prenderia o usuário sem nunca abrir a conversa.
  if (input.queueLength > 0 && input.hasSelectedThread) {
    return { action: 'enqueue' }
  }

  if (!input.hasSelectedProject) return { action: 'noop' }
  if (!input.hasSelectedThread) return { action: 'send_new' }
  return { action: 'send_follow_up' }
}
