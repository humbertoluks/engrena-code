/**
 * Derivação única da superfície de chat (composer + timeline).
 *
 * Antes, a mesma decisão vivia em três lugares: `routeComposerSend` (destino do envio),
 * `TaskComposer.tsx` (runtimeLocked/showStop/showSend/rótulo) e `ChatHistory.tsx`
 * (threadBusy/showFollowups). As duas cópias em `.tsx` re-derivavam o predicado a partir do
 * estado cru da thread — e o rótulo do botão divergia da rota real do envio (ex.: `waiting_user`
 * sem pergunta pendente mostrava "Enviar resposta" enquanto o envio enfileirava).
 *
 * Aqui há uma decisão só: `route` vem de `routeComposerSend` (a autoridade, não reimplementada)
 * e rótulo/visibilidade derivam dela e do modo. Regra de negócio fora de `.tsx` também é o que
 * torna isto testável: `vitest.config.ts` só inclui `src/**\/*.test.ts`.
 */

import type { ThreadState } from '../../services/threads-service'
import type { ThreadGate } from '../../hooks/threadGate.logic'
import { routeComposerSend, type ComposerRouteDecision } from './composerRoute.logic'

/** Modo da superfície — governa placeholder, rótulo e visibilidade dos botões. */
export type ComposerMode = 'idle' | 'busy' | 'stopping' | 'permission' | 'question'

/** Chave de copy do placeholder; o texto em si mora no componente. */
export type ComposerPlaceholderKey =
  | 'new'
  | 'follow_up'
  | 'running'
  | 'permission'
  | 'question'
  | 'stopping'

export interface ChatSurfaceInput {
  threadState: ThreadState | null | undefined
  /**
   * O gate aberto da thread (`useThreadGate`): permissão e pergunta são um conceito só, persistido
   * em `thread_gates` e servido por `GET /gate` + `gate.opened`/`gate.resolved`. Substituiu o par
   * `hasPendingPermission`/`hasPendingQuestion`.
   */
  gate: ThreadGate | null
  /** Bolha otimista do usuário ainda em voo (sending/sent/queued). */
  hasActivePending: boolean
  queueLength: number
  hasSelectedThread: boolean
  hasSelectedProject: boolean
  draftText: string
}

export interface ChatSurface {
  composerMode: ComposerMode
  /** Exatamente o que `routeComposerSend` decidiria para este texto — nunca reimplementado. */
  route: ComposerRouteDecision['action']
  sendLabel: string
  placeholderKey: ComposerPlaceholderKey
  showStop: boolean
  showSend: boolean
  /**
   * A thread permite chips de sugestão/decisão. O componente ainda checa se há sugestões e se
   * elas estão ancoradas na última resposta — isso é disponibilidade de dado, não regra de estado.
   */
  showFollowups: boolean
  /**
   * Indicador shimmer do que o agente faz agora. Fica visível o turno inteiro (nunca condicionado
   * a texto já em tela) e some quando a bola passa para o usuário — pergunta ou permissão.
   */
  showActivity: boolean
  /** Turno em andamento ou fila não-vazia: trava troca de provider/anexos/voz. */
  runtimeLocked: boolean
  /**
   * O envio abre um turno novo (não é decisão de permissão, resposta nem enfileiramento) e por
   * isso ainda passa pelos gates de projeto/git/limite de consumo do componente.
   */
  sendStartsTurn: boolean
}

/** Rótulos do botão de envio — a rota decide qual aparece. */
export const CHAT_SURFACE_COPY = {
  send: 'Enviar',
  sendEnqueue: 'Enfileirar para o próximo turno',
  sendPermission: 'Enviar decisão de permissão',
  sendQuestion: 'Enviar resposta',
} as const

const LABEL_BY_MODE: Record<ComposerMode, string> = {
  idle: CHAT_SURFACE_COPY.send,
  busy: CHAT_SURFACE_COPY.sendEnqueue,
  stopping: CHAT_SURFACE_COPY.send,
  permission: CHAT_SURFACE_COPY.sendPermission,
  question: CHAT_SURFACE_COPY.sendQuestion,
}

const LABEL_BY_ROUTE: Record<ComposerRouteDecision['action'], string | null> = {
  resolve_permission: CHAT_SURFACE_COPY.sendPermission,
  permission_blocked: CHAT_SURFACE_COPY.sendPermission,
  answer_question: CHAT_SURFACE_COPY.sendQuestion,
  enqueue: CHAT_SURFACE_COPY.sendEnqueue,
  send_new: CHAT_SURFACE_COPY.send,
  send_follow_up: CHAT_SURFACE_COPY.send,
  // Composer vazio (ou sem projeto): não há rota para rotular — cai no modo.
  noop: null,
}

export function deriveChatSurface(input: ChatSurfaceInput): ChatSurface {
  // Leitura única do gate por kind — o resto do corpo não volta a olhar `input.gate`.
  const gate = {
    permission: input.gate?.kind === 'permission',
    question: input.gate?.kind === 'question',
  }

  const state = input.threadState
  // Turno em andamento pelo estado da thread (sem contar permissão pendente): é o que trava
  // provider/anexos e o que mantém o Parar visível.
  const stateBusy =
    state === 'running' ||
    state === 'stopping' ||
    state === 'waiting_user' ||
    state === 'waiting_permission'

  const composerMode: ComposerMode =
    state === 'stopping'
      ? 'stopping'
      : gate.permission || state === 'waiting_permission'
        ? 'permission'
        : state === 'waiting_user'
          ? 'question'
          : state === 'running'
            ? 'busy'
            : 'idle'

  const route = routeComposerSend({
    text: input.draftText,
    threadState: state,
    gate: input.gate,
    hasSelectedThread: input.hasSelectedThread,
    hasSelectedProject: input.hasSelectedProject,
  }).action

  return {
    composerMode,
    route,
    sendLabel: LABEL_BY_ROUTE[route] ?? LABEL_BY_MODE[composerMode],
    placeholderKey: placeholderKeyFor(composerMode, input.hasSelectedThread),
    // Em waiting_user/waiting_permission o turno continua cancelável; em running o Parar
    // convive com o Enviar (que enfileira). Esconder o Enviar durante running quebrava a fila.
    showStop: stateBusy || gate.permission,
    // Só Parar durante stopping.
    showSend: composerMode !== 'stopping',
    // Chips de "próximo passo" em cima de "Executando…" (ou de uma resposta ainda em voo) eram
    // lidos como pedido de permissão duplicado.
    showFollowups: !stateBusy && !gate.permission && !gate.question && !input.hasActivePending,
    showActivity: composerMode === 'busy' && !gate.question,
    runtimeLocked: stateBusy || input.queueLength > 0,
    sendStartsTurn: composerMode === 'idle' || composerMode === 'stopping',
  }
}

function placeholderKeyFor(mode: ComposerMode, hasSelectedThread: boolean): ComposerPlaceholderKey {
  if (mode === 'stopping') return 'stopping'
  if (mode === 'permission') return 'permission'
  if (mode === 'question') return 'question'
  if (mode === 'busy') return 'running'
  return hasSelectedThread ? 'follow_up' : 'new'
}
