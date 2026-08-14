import type { StreamEvent } from '../services/ws-client'
import type {
  FeedbackVote,
  Message,
  MessageFeedback,
  PipelineHistory,
  ToolCall,
} from '../services/threads-service'
import type { SubagentRun } from '../services/subagents-service'
import {
  applyLiveEvent,
  emptyLiveOverlay,
  type LiveGraphOverlay,
} from '../components/workspace/graph/executionGraph.logic'
import {
  mergeById,
  mergeSubagentRunsByChildId,
  sameMessageLike,
  sameSubagentRunLike,
  sameToolCallLike,
} from '../components/workspace/historyMerge.logic'
import {
  dropStalePermissionDecisionPendings,
  reconcilePendingMessages,
  type PendingMessage,
  type PendingMessageStatus,
} from '../components/workspace/pendingMessages.logic'
import { interpretPermissionChatReply } from '../components/workspace/permissionComposer.logic'
import type { ComposerImage } from './messageQueue.logic'

/**
 * Estado da timeline do chat (mensagens, tool calls, subagentes, pipeline, overlay do grafo,
 * bolhas otimistas e o texto em streaming) como **reducer puro**.
 *
 * Por que reducer e não 11 `useState`: a reposição de estado depois de um `GET /history` é uma
 * transição **atômica** — messages/toolCalls/subagentRuns/pipeline entram juntos e o overlay
 * otimista zera no mesmo instante. Espalhada em 11 setters, um resync (reconnect de WS) pinta
 * frames intermediários incoerentes: nós do overlay duplicando linhas já persistidas, pipeline
 * novo com mensagens velhas.
 *
 * Sem React e sem service: quem busca histórico, serializa refetch (`HistoryRefetchGate`) e conta
 * métrica é `usePrincipalWorkspace`; quem guarda o estado é `useChatTimeline`.
 */

export interface ChatTimelineState {
  messages: Message[]
  feedback: Record<string, FeedbackVote>
  /** Bolhas otimistas do usuário (ver pendingMessages.logic.ts). */
  pendingMessages: PendingMessage[]
  toolCalls: ToolCall[]
  subagentRuns: SubagentRun[]
  pipeline: PipelineHistory | null
  activeSubagentRun: SubagentRun | null
  /** Overlay otimista do grafo (F29) — nós aparecem em subagent.start antes do refetch. */
  liveGraphOverlay: LiveGraphOverlay
  historyLoading: boolean
  historyError: string | null
  streamingText: string
}

/** O que o `GET /history` devolve — só a parte que a timeline consome. */
export interface ChatHistorySnapshot {
  messages: Message[]
  feedback?: MessageFeedback[]
  toolCalls: ToolCall[]
  subagentRuns: SubagentRun[]
  pipeline: PipelineHistory | null
}

export type ChatTimelineAction =
  /** Abertura de thread (primeiro plano): a árvore está vazia, pode mostrar "Carregando…". */
  | { type: 'history_load_started' }
  /** Falha em primeiro plano. Refetch de fundo **nunca** passa por aqui (vai para o console). */
  | { type: 'history_load_failed'; message: string }
  /** A transição atômica: repõe a timeline inteira a partir do histórico canónico. */
  | { type: 'history_loaded'; history: ChatHistorySnapshot }
  /** Fim do fetch em primeiro plano (o de fundo não liga nem desliga `historyLoading`). */
  | { type: 'history_load_settled' }
  /** Thread selecionada com id: só o streaming do turno anterior sai de cena. */
  | { type: 'thread_opened' }
  /** Sem thread: a timeline inteira sai de cena (não há histórico a carregar). */
  | { type: 'thread_cleared' }
  /** Clique numa thread da sidebar. */
  | { type: 'thread_selected' }
  /** Troca de projeto. */
  | { type: 'project_switched' }
  /** Botão "Nova conversa". */
  | { type: 'new_thread_started' }
  | { type: 'delta_appended'; text: string }
  /** Turno assentou (idle/committed/error). */
  | { type: 'turn_settled' }
  | { type: 'turn_cancelled' }
  /** Evento de stream que move o overlay otimista do grafo. */
  | { type: 'live_event_applied'; event: StreamEvent }
  /** Abriu card de permissão novo: grant anterior não pode ficar em cena. */
  | { type: 'permission_gate_opened' }
  | { type: 'pending_added'; pending: PendingMessage }
  | { type: 'pending_status_changed'; id: string; status: PendingMessageStatus }
  | { type: 'pending_removed'; id: string }
  /** Voto otimista e o rollback dele — `null` remove o voto. */
  | { type: 'feedback_vote_set'; messageId: string; vote: FeedbackVote | null }
  | { type: 'subagent_run_opened'; run: SubagentRun }
  | { type: 'subagent_run_closed' }

export function emptyChatTimeline(): ChatTimelineState {
  return {
    messages: [],
    feedback: {},
    pendingMessages: [],
    toolCalls: [],
    subagentRuns: [],
    pipeline: null,
    activeSubagentRun: null,
    liveGraphOverlay: emptyLiveOverlay(),
    historyLoading: false,
    historyError: null,
    streamingText: '',
  }
}

/**
 * Texto do composer que ainda conta como decisão de permissão (Permitir/Negar/…). É a mesma
 * regra do card; `blocked` significa "não é decisão nenhuma", então segue na timeline.
 */
function isPermissionDecisionText(text: string): boolean {
  return interpretPermissionChatReply(text).kind !== 'blocked'
}

/** Monta a bolha otimista; o id é o `clientMessageId` que viaja no POST (gerado fora, no hook). */
export function makePendingMessage(
  id: string,
  text: string,
  images: readonly ComposerImage[],
  status: PendingMessageStatus,
  createdAt: number = Date.now()
): PendingMessage {
  return {
    id,
    text,
    images: images.map((img) => ({
      id: img.id,
      mimeType: img.mimeType,
      name: img.name,
      dataBase64: img.dataBase64,
    })),
    status,
    createdAt,
  }
}

function feedbackMapFrom(entries: readonly MessageFeedback[]): Record<string, FeedbackVote> {
  return Object.fromEntries(entries.map((f): [string, FeedbackVote] => [f.messageId, f.vote]))
}

export function chatTimelineReducer(
  state: ChatTimelineState,
  action: ChatTimelineAction
): ChatTimelineState {
  switch (action.type) {
    case 'history_load_started':
      return { ...state, historyLoading: true, historyError: null }

    case 'history_load_failed':
      return { ...state, historyError: action.message }

    case 'history_loaded': {
      const { history } = action
      return {
        ...state,
        // Merge por id, nunca append: o refetch traz o histórico inteiro e append duplicaria a
        // timeline a cada evento de stream. O merge ainda preserva a referência das linhas que
        // não mudaram (Work log aberto não remonta).
        messages: mergeById(state.messages, history.messages, sameMessageLike),
        feedback: feedbackMapFrom(history.feedback ?? []),
        // Bolha otimista reconcilia por `clientMessageId`, nunca por conteúdo: o servidor
        // reescreve o prompt antes de persistir.
        pendingMessages: reconcilePendingMessages(state.pendingMessages, history.messages),
        toolCalls: mergeById(state.toolCalls, history.toolCalls, sameToolCallLike),
        subagentRuns: mergeSubagentRunsByChildId(
          state.subagentRuns,
          history.subagentRuns,
          sameSubagentRunLike
        ),
        pipeline: history.pipeline,
        // History canónico: zera o overlay otimista (os nós já estão nos arrays persistidos).
        liveGraphOverlay: emptyLiveOverlay(),
      }
    }

    case 'history_load_settled':
      return state.historyLoading ? { ...state, historyLoading: false } : state

    case 'thread_opened':
      return { ...state, streamingText: '' }

    case 'thread_cleared':
      return {
        ...state,
        streamingText: '',
        messages: [],
        toolCalls: [],
        subagentRuns: [],
        pipeline: null,
      }

    // Bolha otimista pertence à thread onde foi digitada — trocar de thread/projeto descarta as
    // pendentes (a fila persiste em localStorage por thread e se rehidrata sozinha).
    case 'thread_selected':
      return { ...state, pendingMessages: [], liveGraphOverlay: emptyLiveOverlay() }

    case 'project_switched':
      return { ...state, pendingMessages: [] }

    case 'new_thread_started':
      return { ...state, pendingMessages: [] }

    case 'delta_appended':
      return { ...state, streamingText: state.streamingText + action.text }

    case 'turn_settled':
      return { ...state, streamingText: '' }

    case 'turn_cancelled':
      return { ...state, streamingText: '', pendingMessages: [] }

    case 'live_event_applied': {
      const liveGraphOverlay = applyLiveEvent(state.liveGraphOverlay, action.event)
      return liveGraphOverlay === state.liveGraphOverlay ? state : { ...state, liveGraphOverlay }
    }

    // Grant anterior não pode ficar como "Permitir / Executando…" sob o card novo.
    case 'permission_gate_opened': {
      const pendingMessages = dropStalePermissionDecisionPendings(
        state.pendingMessages,
        isPermissionDecisionText
      )
      return pendingMessages.length === state.pendingMessages.length
        ? state
        : { ...state, pendingMessages }
    }

    case 'pending_added':
      return { ...state, pendingMessages: [...state.pendingMessages, action.pending] }

    case 'pending_status_changed':
      return {
        ...state,
        pendingMessages: state.pendingMessages.map((p) =>
          p.id === action.id ? { ...p, status: action.status } : p
        ),
      }

    case 'pending_removed':
      return {
        ...state,
        pendingMessages: state.pendingMessages.filter((p) => p.id !== action.id),
      }

    case 'feedback_vote_set': {
      const feedback = { ...state.feedback }
      if (action.vote === null) delete feedback[action.messageId]
      else feedback[action.messageId] = action.vote
      return { ...state, feedback }
    }

    case 'subagent_run_opened':
      return { ...state, activeSubagentRun: action.run }

    case 'subagent_run_closed':
      return { ...state, activeSubagentRun: null }
  }
}
