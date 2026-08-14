import { useCallback, useReducer } from 'react'
import type { FeedbackVote } from '../services/threads-service'
import type { SubagentRun } from '../services/subagents-service'
import type { StreamEvent } from '../services/ws-client'
import type { PendingMessageStatus } from '../components/workspace/pendingMessages.logic'
import {
  chatTimelineReducer,
  emptyChatTimeline,
  makePendingMessage,
  type ChatHistorySnapshot,
  type ChatTimelineState,
} from './chatTimeline.logic'
import type { ComposerImage } from './messageQueue.logic'

export interface ChatTimelineApi extends ChatTimelineState {
  /** Abertura de thread: liga `historyLoading` e limpa o erro anterior. */
  historyLoadStarted: () => void
  /** Só primeiro plano: refetch de fundo reporta no console e não pinta erro na árvore. */
  historyLoadFailed: (message: string) => void
  /** Transição atômica com o histórico canónico (merge por id + reconcile + overlay zerado). */
  historyLoaded: (history: ChatHistorySnapshot) => void
  historyLoadSettled: () => void
  threadOpened: () => void
  threadCleared: () => void
  threadSelected: () => void
  projectSwitched: () => void
  newThreadStarted: () => void
  appendDelta: (text: string) => void
  turnSettled: () => void
  turnCancelled: () => void
  /** Overlay otimista do grafo (F29). */
  applyLiveStreamEvent: (event: StreamEvent) => void
  permissionGateOpened: () => void
  /** Cria a bolha otimista e devolve o id — é o `clientMessageId` que viaja no POST. */
  addPending: (text: string, images: ComposerImage[], status: PendingMessageStatus) => string
  setPendingStatus: (id: string, status: PendingMessageStatus) => void
  removePending: (id: string) => void
  /** Voto otimista e o rollback dele — `null` remove. */
  setFeedbackVote: (messageId: string, vote: FeedbackVote | null) => void
  openSubagentRun: (run: SubagentRun) => void
  closeSubagentRun: () => void
}

/**
 * Dono da timeline do chat: mensagens, tool calls, subagentes, pipeline, overlay do grafo,
 * bolhas otimistas, streaming e o par carregando/erro do histórico.
 *
 * O hook é fino de propósito — toda regra mora em `chatTimeline.logic.ts` (reducer puro). Aqui
 * ficam só o `useReducer` e os callbacks nomeados: nenhum componente recebe `dispatch` cru, e
 * todos os callbacks são referencialmente estáveis (dependem só de `dispatch`), porque
 * `loadHistory` e os efeitos de thread em `usePrincipalWorkspace` os listam nas deps.
 */
export function useChatTimeline(): ChatTimelineApi {
  const [state, dispatch] = useReducer(chatTimelineReducer, undefined, emptyChatTimeline)

  const historyLoadStarted = useCallback(() => dispatch({ type: 'history_load_started' }), [])
  const historyLoadFailed = useCallback(
    (message: string) => dispatch({ type: 'history_load_failed', message }),
    []
  )
  const historyLoaded = useCallback(
    (history: ChatHistorySnapshot) => dispatch({ type: 'history_loaded', history }),
    []
  )
  const historyLoadSettled = useCallback(() => dispatch({ type: 'history_load_settled' }), [])
  const threadOpened = useCallback(() => dispatch({ type: 'thread_opened' }), [])
  const threadCleared = useCallback(() => dispatch({ type: 'thread_cleared' }), [])
  const threadSelected = useCallback(() => dispatch({ type: 'thread_selected' }), [])
  const projectSwitched = useCallback(() => dispatch({ type: 'project_switched' }), [])
  const newThreadStarted = useCallback(() => dispatch({ type: 'new_thread_started' }), [])
  const appendDelta = useCallback((text: string) => dispatch({ type: 'delta_appended', text }), [])
  const turnSettled = useCallback(() => dispatch({ type: 'turn_settled' }), [])
  const turnCancelled = useCallback(() => dispatch({ type: 'turn_cancelled' }), [])
  const applyLiveStreamEvent = useCallback(
    (event: StreamEvent) => dispatch({ type: 'live_event_applied', event }),
    []
  )
  const permissionGateOpened = useCallback(() => dispatch({ type: 'permission_gate_opened' }), [])

  const addPending = useCallback(
    (text: string, images: ComposerImage[], status: PendingMessageStatus): string => {
      const id = crypto.randomUUID()
      dispatch({ type: 'pending_added', pending: makePendingMessage(id, text, images, status) })
      return id
    },
    []
  )
  const setPendingStatus = useCallback(
    (id: string, status: PendingMessageStatus) =>
      dispatch({ type: 'pending_status_changed', id, status }),
    []
  )
  const removePending = useCallback(
    (id: string) => dispatch({ type: 'pending_removed', id }),
    []
  )
  const setFeedbackVote = useCallback(
    (messageId: string, vote: FeedbackVote | null) =>
      dispatch({ type: 'feedback_vote_set', messageId, vote }),
    []
  )
  const openSubagentRun = useCallback(
    (run: SubagentRun) => dispatch({ type: 'subagent_run_opened', run }),
    []
  )
  const closeSubagentRun = useCallback(() => dispatch({ type: 'subagent_run_closed' }), [])

  // Objeto novo a cada render, como nos demais hooks do workspace: quem consome desestrutura na
  // hora, e o que precisa ser estável (todos os callbacks) já é.
  return {
    ...state,
    historyLoadStarted,
    historyLoadFailed,
    historyLoaded,
    historyLoadSettled,
    threadOpened,
    threadCleared,
    threadSelected,
    projectSwitched,
    newThreadStarted,
    appendDelta,
    turnSettled,
    turnCancelled,
    applyLiveStreamEvent,
    permissionGateOpened,
    addPending,
    setPendingStatus,
    removePending,
    setFeedbackVote,
    openSubagentRun,
    closeSubagentRun,
  }
}
