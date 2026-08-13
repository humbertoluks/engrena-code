import type { ThreadState } from '../../services/threads-service'
import {
  interpretPermissionChatReply,
  PERMISSION_PENDING_HINT,
  type PermissionChatReply,
} from './permissionComposer.logic'

export type ComposerRouteDecision =
  | {
      action: 'resolve_permission'
      decision: Extract<PermissionChatReply, { kind: 'allow' | 'allow_always' | 'allow_project' | 'deny' }>
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
  hasPendingPermission: boolean
  hasPendingQuestion: boolean
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
 * 4. sem thread → send_new; com thread idle → send_follow_up
 */
export function routeComposerSend(input: ComposerRouteInput): ComposerRouteDecision {
  const text = input.text.trim()
  if (text === '') return { action: 'noop' }

  const permissionGate =
    input.hasPendingPermission || input.threadState === 'waiting_permission'

  if (permissionGate) {
    if (!input.hasPendingPermission) {
      // Estado DB diz waiting_permission mas a fila local está vazia (WS perdido) —
      // nunca enfileira; a UI deve refetch do snapshot antes de resolver.
      return { action: 'permission_blocked', message: PERMISSION_PENDING_HINT }
    }
    const reply = interpretPermissionChatReply(text)
    if (reply.kind === 'blocked') {
      return { action: 'permission_blocked', message: reply.message }
    }
    return { action: 'resolve_permission', decision: reply }
  }

  if (input.threadState === 'waiting_user' && input.hasPendingQuestion) {
    return { action: 'answer_question' }
  }

  if (
    input.threadState === 'running' ||
    input.threadState === 'waiting_user' ||
    input.threadState === 'waiting_permission'
  ) {
    return { action: 'enqueue' }
  }

  if (!input.hasSelectedProject) return { action: 'noop' }
  if (!input.hasSelectedThread) return { action: 'send_new' }
  return { action: 'send_follow_up' }
}
