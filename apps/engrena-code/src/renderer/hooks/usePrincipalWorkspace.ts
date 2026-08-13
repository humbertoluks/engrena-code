import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { projectsService, type Project, type VcsStatus } from '../services/projects-service'
import {
  threadsService,
  type ComposerCatalog,
  type ComposerImagePayload,
  type Diff,
  type Message,
  type PipelineHistory,
  type ThreadAccessLevel,
  type ThreadExecutionMode,
  type ThreadProvider,
  type Thread,
  type ToolCall,
  type FeedbackVote,
  type MessageFeedback,
} from '../services/threads-service'
import { connectThreadStream, type StreamEvent } from '../services/ws-client'
import { configuracaoService, isConfigStatus, type ConfigStatus } from '../services/configuracao-service'
import {
  promptLibraryService,
  type ChatModeItem,
  type SavedPromptItem,
} from '../services/prompt-library-service'
import { memoryService, type MemoryStatus } from '../services/memory-service'
import { consumoService, type UsageLimitStatusResponse } from '../services/consumo-service'
import type { SubagentRun } from '../services/subagents-service'
import { findPendingAskUserQuestion, answerErrorMessage, composerAnswerForQuestion } from '../components/workspace/askUserQuestion.logic'
import { routeComposerSend } from '../components/workspace/composerRoute.logic'
import {
  appendWorkspaceNotice,
  mcpNotice,
  nativeDenialNotice,
  type WorkspaceNotice,
} from './streamNotices.logic'
import {
  addAttachment,
  makeSelectionAttachment,
  removeAttachment as removeAttachmentFromList,
  toWirePayload,
  withImplicitContext,
  type ComposerAttachment,
} from '../components/workspace/composerAttachments.logic'
import { slugifyPromptName } from '../../services/prompts/prompt-spec.js'
import {
  dropStalePermissionDecisionPendings,
  reconcilePendingMessages,
  type PendingMessage,
  type PendingMessageStatus,
} from '../components/workspace/pendingMessages.logic'
import {
  interpretPermissionChatReply,
  PERMISSION_PENDING_HINT,
} from '../components/workspace/permissionComposer.logic'
import {
  applyLiveEvent,
  emptyLiveOverlay,
  type LiveGraphOverlay,
} from '../components/workspace/graph/executionGraph.logic'
import {
  EXPORT_COPY,
  exportFetchErrorMessage,
  mimeTypeForExportFormat,
  triggerBrowserDownload,
} from '../components/workspace/threadExportDownload.logic'
import {
  HistoryRefetchGate,
  isAbortError,
  mergeById,
  mergeSubagentRunsByChildId,
  sameMessageLike,
  sameSubagentRunLike,
  sameToolCallLike,
} from '../components/workspace/historyMerge.logic'
import {
  recordHistoryRefetchAborted,
  recordHistoryRefetchCoalesced,
  recordHistoryRefetchCompleted,
  recordHistoryRefetchStarted,
} from '../../services/runtime-metrics'


const QUEUE_STORAGE_PREFIX = 'engrenacode.message-queue.v1.'

const PROVIDERS: readonly ThreadProvider[] = ['claude', 'codex', 'kimi', 'minimax', 'glm', 'grok']
const ACCESS_LEVELS: readonly ThreadAccessLevel[] = ['supervised', 'auto-accept-edits', 'full-access']
const EXECUTION_MODES: readonly ThreadExecutionMode[] = ['main', 'worktree']

function asProvider(value: string | null): ThreadProvider | null {
  return value !== null && (PROVIDERS as readonly string[]).includes(value) ? (value as ThreadProvider) : null
}

function asAccessLevel(value: string | null): ThreadAccessLevel | null {
  return value !== null && (ACCESS_LEVELS as readonly string[]).includes(value)
    ? (value as ThreadAccessLevel)
    : null
}

function asExecutionMode(value: string | null): ThreadExecutionMode | null {
  return value !== null && (EXECUTION_MODES as readonly string[]).includes(value)
    ? (value as ThreadExecutionMode)
    : null
}

export type ThreadTab = 'history' | 'diff' | 'graph'

export interface ComposerImage {
  id: string
  mimeType: 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif'
  name: string
  dataBase64: string
  byteLength: number
}

export interface QueueItem {
  id: string
  text: string
  images: ComposerImage[]
  /** Contexto anexado quando a mensagem entrou na fila — sem isto o turno enfileirado perde os chips. */
  attachments?: ComposerAttachment[]
  model: string | null
  reasoningLevel: string | null
}

export interface ComposerDraft {
  provider: ThreadProvider
  model: string | null
  reasoningLevel: string | null
  accessLevel: ThreadAccessLevel
  executionMode: ThreadExecutionMode
  text: string
  images: ComposerImage[]
  attachments: ComposerAttachment[]
  /** Nome do modo de chat aplicado (F28 §3.4); null = sem modo. */
  chatMode: string | null
}

function toImagePayloads(images: ComposerImage[]): ComposerImagePayload[] {
  return images.map((img) => ({ mimeType: img.mimeType, name: img.name, dataBase64: img.dataBase64 }))
}

function loadQueue(threadKey: string): QueueItem[] {
  try {
    const raw = localStorage.getItem(QUEUE_STORAGE_PREFIX + threadKey)
    if (!raw) return []
    return JSON.parse(raw) as QueueItem[]
  } catch {
    return []
  }
}

function saveQueue(threadKey: string, queue: QueueItem[]): void {
  try {
    if (queue.length === 0) localStorage.removeItem(QUEUE_STORAGE_PREFIX + threadKey)
    else localStorage.setItem(QUEUE_STORAGE_PREFIX + threadKey, JSON.stringify(queue))
  } catch {
    // localStorage indisponível — fila só em memória nesta sessão
  }
}

export function usePrincipalWorkspace() {
  const mountedRef = useRef(true)
  const historyGateRef = useRef(new HistoryRefetchGate())
  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      historyGateRef.current.cancel()
    }
  }, [])

  const [projects, setProjects] = useState<Project[] | null>(null)
  const [projectsError, setProjectsError] = useState<string | null>(null)
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)

  const [threadsByProject, setThreadsByProject] = useState<Record<string, Thread[]>>({})
  const [threadsLoading, setThreadsLoading] = useState<Record<string, boolean>>({})
  const [threadsError, setThreadsError] = useState<Record<string, boolean>>({})
  const threadsByProjectRef = useRef(threadsByProject)
  threadsByProjectRef.current = threadsByProject

  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null)
  const [vcsStatus, setVcsStatus] = useState<VcsStatus | null>(null)
  const [memoryStatus, setMemoryStatus] = useState<MemoryStatus | null>(null)
  const [usageLimitStatus, setUsageLimitStatus] = useState<UsageLimitStatusResponse | null>(null)

  const [messages, setMessages] = useState<Message[]>([])
  const [feedback, setFeedback] = useState<Record<string, FeedbackVote>>({})
  const [followups, setFollowups] = useState<string[]>([])
  // Âncora + estado de espera: o turno adianta a geração no servidor, mas quando ela demora a UI
  // precisa dizer "vem sugestão aí" em vez de deixar o espaço vazio até depois da resposta.
  const [followupsMessageId, setFollowupsMessageId] = useState<string | null>(null)
  const [followupsPending, setFollowupsPending] = useState(false)
  const [toolCalls, setToolCalls] = useState<ToolCall[]>([])
  const [subagentRuns, setSubagentRuns] = useState<SubagentRun[]>([])
  const [pipeline, setPipeline] = useState<PipelineHistory | null>(null)
  const [activeSubagentRun, setActiveSubagentRun] = useState<SubagentRun | null>(null)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyError, setHistoryError] = useState<string | null>(null)
  const [streamingText, setStreamingText] = useState('')

  const [diffs, setDiffs] = useState<Diff[]>([])
  const [activeTab, setActiveTab] = useState<ThreadTab>('history')
  /** Overlay otimista do grafo (F29) — nós aparecem em subagent.start antes do refetch. */
  const [liveGraphOverlay, setLiveGraphOverlay] = useState<LiveGraphOverlay>(() => emptyLiveOverlay())

  const [configStatus, setConfigStatus] = useState<ConfigStatus | null>(null)
  const [composerCatalog, setComposerCatalog] = useState<ComposerCatalog | null>(null)

  const [composer, setComposer] = useState<ComposerDraft>({
    provider: 'claude',
    model: null,
    reasoningLevel: null,
    // Default cotidiano: edição de arquivo passa direto e Bash/MCP abrem o PermissionPrompt
    // (permission-policy.ts). 'supervised' pede aprovação até para leitura.
    accessLevel: 'auto-accept-edits',
    executionMode: 'main',
    text: '',
    images: [],
    attachments: [],
    chatMode: null,
  })
  const [queue, setQueue] = useState<QueueItem[]>([])
  // Bolhas otimistas: a mensagem do usuário aparece no envio, não só quando o próximo
  // `GET /history` chega (ver pendingMessages.logic.ts).
  const [pendingMessages, setPendingMessages] = useState<PendingMessage[]>([])
  const [sendError, setSendError] = useState<string | null>(null)
  /** Erro/progresso de export ficam fora do composer, ao lado da ação que os dispara. */
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)
  const [addProjectModalOpen, setAddProjectModalOpen] = useState(false)

  const [permissionQueue, setPermissionQueue] = useState<
    Array<{ requestId: string; threadId: string; toolName: string; params: unknown }>
  >([])

  // Faixa âmbar do workspace: MCP degradado + negação nativa do CLI (ver streamNotices.logic).
  const [mcpNotices, setMcpNotices] = useState<WorkspaceNotice[]>([])

  const selectedProject = useMemo(
    () => projects?.find((p) => p.id === selectedProjectId) ?? null,
    [projects, selectedProjectId]
  )
  const selectedThread = useMemo(() => {
    if (!selectedProjectId || !selectedThreadId) return null
    return (threadsByProject[selectedProjectId] ?? []).find((t) => t.id === selectedThreadId) ?? null
  }, [threadsByProject, selectedProjectId, selectedThreadId])

  // F21: pergunta pendente do turno atual — só relevante com a thread pausada em waiting_user;
  // deriva do tool_call ask_user_question mais recente ainda `running` (mesmo padrão de
  // correlateSubagentRuns em chatHistory.logic.ts, sem estado próprio).
  const [answerBusy, setAnswerBusy] = useState(false)
  const [answerError, setAnswerError] = useState<string | null>(null)

  const pendingQuestion = useMemo(() => {
    if (selectedThread?.state !== 'waiting_user') return null
    return findPendingAskUserQuestion(toolCalls)
  }, [selectedThread, toolCalls])

  // Envio da resposta precisa de estado próprio: sem `answerBusy` o duplo clique manda
  // duas respostas, e sem `answerError` a falha do POST (ex.: 409 `thread_not_waiting`
  // quando o turno já foi cancelado) ficava invisível para o usuário (F21 ui.md §Estados).
  const answerQuestion = useCallback(
    async (input: { selectedOptions: string[]; freeText: string | null }) => {
      if (!selectedThreadId || answerBusy) return
      setAnswerBusy(true)
      setAnswerError(null)
      try {
        const res = await threadsService.answerQuestion(selectedThreadId, input)
        if (res.error) setAnswerError(answerErrorMessage(res.error.code))
      } catch {
        setAnswerError(answerErrorMessage(undefined))
      } finally {
        if (mountedRef.current) setAnswerBusy(false)
      }
    },
    [selectedThreadId, answerBusy]
  )

  const queueKey = selectedThreadId ?? `project:${selectedProjectId ?? 'none'}`

  // A fila é lida pelo handler de WS, que roda com o closure do render em que a conexão subiu —
  // o ref mantém o valor corrente sem reconectar o stream a cada mudança de fila.
  const queueRef = useRef<QueueItem[]>([])
  useEffect(() => {
    queueRef.current = queue
  }, [queue])

  useEffect(() => {
    const restored = loadQueue(queueKey)
    queueRef.current = restored
    setQueue(restored)
  }, [queueKey])

  const upsertThreadLocal = useCallback((projectId: string, thread: Thread) => {
    setThreadsByProject((prev) => {
      const list = prev[projectId] ?? []
      const idx = list.findIndex((t) => t.id === thread.id)
      const nextList = idx === -1 ? [thread, ...list] : list.map((t, i) => (i === idx ? thread : t))
      return { ...prev, [projectId]: nextList }
    })
  }, [])

  // ── Loaders ──────────────────────────────────────────────────────────────

  const loadProjects = useCallback(async () => {
    try {
      const res = await projectsService.list()
      if (!mountedRef.current) return
      if (res.error) {
        setProjectsError(res.error.message)
        return
      }
      setProjects(res.projects)
      setProjectsError(null)
    } catch {
      if (mountedRef.current) setProjectsError('Não foi possível contatar o servidor local.')
    }
  }, [])

  const loadThreads = useCallback(async (projectId: string) => {
    // Só mostra "Carregando…" na 1ª carga. Reload com cache (busca vazia / refetch)
    // não pode desmontar ThreadRow — isso fechava o rename no meio da edição.
    const hasCache = Object.hasOwn(threadsByProjectRef.current, projectId)
    if (!hasCache) {
      setThreadsLoading((prev) => ({ ...prev, [projectId]: true }))
    }
    setThreadsError((prev) => ({ ...prev, [projectId]: false }))
    try {
      const res = await threadsService.listForProject(projectId)
      if (!mountedRef.current) return
      if (res.error) {
        setThreadsError((prev) => ({ ...prev, [projectId]: true }))
        return
      }
      setThreadsByProject((prev) => ({ ...prev, [projectId]: res.threads }))
    } catch {
      if (mountedRef.current) setThreadsError((prev) => ({ ...prev, [projectId]: true }))
    } finally {
      if (mountedRef.current) setThreadsLoading((prev) => ({ ...prev, [projectId]: false }))
    }
  }, [])

  const loadVcsStatus = useCallback(async (projectId: string) => {
    try {
      const res = await projectsService.vcsStatus(projectId)
      if (!mountedRef.current) return
      if (!res.error) setVcsStatus(res)
    } catch {
      // status git é best-effort na sidebar
    }
  }, [])

  const loadMemoryStatus = useCallback(async (projectId: string) => {
    try {
      const res = await memoryService.getStatus(projectId)
      if (!mountedRef.current) return
      if (!res.error) setMemoryStatus(res)
    } catch {
      // status de memória é best-effort na sidebar
    }
  }, [])

  const loadUsageLimitStatus = useCallback(async (projectId: string) => {
    try {
      const res = await consumoService.getUsageLimitsStatus(projectId)
      if (!mountedRef.current) return
      if (!('error' in res)) setUsageLimitStatus(res)
    } catch {
      // banner de limite é best-effort no composer (spec F25 §3.2 fail-open)
    }
  }, [])

  /**
   * `background: true` (todo refetch disparado pelo stream) nunca liga `historyLoading` nem
   * grava `historyError`: trocar a árvore do chat por "Carregando…"/erro desmonta a conversa,
   * o container volta ao topo e todo `<details>` de Work log fecha no meio da leitura. Só a
   * abertura da thread — quando não há nada em tela — mostra estado de carregamento.
   *
   * Single-flight + coalesce por gate: tool_call.start/result em rajada não abre N GETs;
   * um follow-up único roda depois do fetch ativo. AbortController cancela stale (troca de
   * thread / foreground). Merge incremental por id preserva referências de bolhas estáveis.
   */
  const loadHistory = useCallback(async (threadId: string, options?: { background?: boolean }) => {
    const background = options?.background === true
    const decision = historyGateRef.current.begin({ background })
    if (decision.kind === 'coalesced') {
      recordHistoryRefetchCoalesced()
      return
    }
    const { signal } = decision
    recordHistoryRefetchStarted()
    if (!background) {
      setHistoryLoading(true)
      setHistoryError(null)
    }
    try {
      const res = await threadsService.history(threadId, { signal })
      if (signal.aborted || !mountedRef.current) {
        recordHistoryRefetchAborted()
        return
      }
      if (res.error) {
        if (background) console.error('[workspace] history refetch:', res.error.message)
        else setHistoryError(res.error.message)
        return
      }
      setMessages((prev) => mergeById(prev, res.messages, sameMessageLike))
      setFeedback(Object.fromEntries((res.feedback ?? []).map((f: MessageFeedback) => [f.messageId, f.vote])))
      setPendingMessages((prev) => reconcilePendingMessages(prev, res.messages))
      setToolCalls((prev) => mergeById(prev, res.toolCalls, sameToolCallLike))
      setSubagentRuns((prev) => mergeSubagentRunsByChildId(prev, res.subagentRuns, sameSubagentRunLike))
      setPipeline(res.pipeline)
      // History canónico: zera o overlay otimista (os nós já estão nos arrays persistidos).
      setLiveGraphOverlay(emptyLiveOverlay())
      recordHistoryRefetchCompleted()
    } catch (err: unknown) {
      if (isAbortError(err) || signal.aborted) {
        recordHistoryRefetchAborted()
        return
      }
      if (!mountedRef.current) return
      if (background) console.error('[workspace] history refetch:', err)
      else setHistoryError('Falha ao carregar o histórico da thread.')
    } finally {
      if (mountedRef.current && !background) setHistoryLoading(false)
      const { coalesced } = historyGateRef.current.finish(signal)
      if (coalesced && mountedRef.current) {
        void loadHistory(threadId, { background: true })
      }
    }
  }, [])

  /** Sugestões de próximo passo: best-effort, nunca bloqueia nem mostra erro. */
  const loadFollowups = useCallback(async (threadId: string) => {
    setFollowupsPending(true)
    try {
      const res = await threadsService.followups(threadId)
      if (!mountedRef.current || res.error) return
      setFollowups(res.followups)
      setFollowupsMessageId(res.messageId ?? null)
    } catch {
      // sugestão é conforto — silêncio é melhor que ruído
    } finally {
      if (mountedRef.current) setFollowupsPending(false)
    }
  }, [])

  const loadDiffs = useCallback(async (threadId: string) => {
    try {
      const res = await threadsService.diffs(threadId)
      if (!mountedRef.current) return
      if (!res.error) setDiffs(res.diffs)
    } catch {
      // aba Diff pode ficar vazia até o próximo evento diff.ready
    }
  }, [])

  useEffect(() => {
    void loadProjects()
    configuracaoService
      .getStatus()
      .then((status) => {
        if (!mountedRef.current) return
        if (!isConfigStatus(status)) {
          console.error('[workspace] config status:', status.error?.message ?? 'resposta inesperada')
          return
        }
        setConfigStatus(status)
      })
      .catch((err: unknown) => {
        console.error('[workspace] config status:', err)
      })
    threadsService
      .composerCatalog()
      .then((res) => {
        if (!mountedRef.current) return
        if (res.error) {
          console.error('[workspace] composer catalog:', res.error.message)
          return
        }
        setComposerCatalog(res)
      })
      .catch((err: unknown) => {
        console.error('[workspace] composer catalog:', err)
      })
  }, [loadProjects])

  useEffect(() => {
    if (selectedProjectId && !threadsByProject[selectedProjectId] && !threadsLoading[selectedProjectId]) {
      void loadThreads(selectedProjectId)
    }
    if (selectedProjectId) {
      void loadVcsStatus(selectedProjectId)
      void loadMemoryStatus(selectedProjectId)
      void loadUsageLimitStatus(selectedProjectId)
    } else {
      setVcsStatus(null)
      setMemoryStatus(null)
      setUsageLimitStatus(null)
    }
  }, [selectedProjectId, threadsByProject, threadsLoading, loadThreads, loadVcsStatus, loadMemoryStatus, loadUsageLimitStatus])

  // Rehidrata model/reasoning/access da thread selecionada nos controles do composer (spec F16 + Access mid-thread).
  useEffect(() => {
    if (!selectedThread) return
    setComposer((prev) => ({
      ...prev,
      provider: selectedThread.provider,
      model: selectedThread.model,
      reasoningLevel: selectedThread.reasoningLevel,
      accessLevel: selectedThread.accessLevel,
      executionMode: selectedThread.executionMode,
      chatMode: selectedThread.chatMode ?? null,
    }))
  }, [
    selectedThread?.id,
    selectedThread?.model,
    selectedThread?.reasoningLevel,
    selectedThread?.provider,
    selectedThread?.accessLevel,
    selectedThread?.executionMode,
    selectedThread?.chatMode,
  ])

  useEffect(() => {
    setStreamingText('')
    setFollowups([])
    setFollowupsMessageId(null)
    setFollowupsPending(false)
    setMcpNotices([])
    historyGateRef.current.cancel()
    if (selectedThreadId) {
      void loadHistory(selectedThreadId)
      void loadDiffs(selectedThreadId)
    } else {
      setMessages([])
      setToolCalls([])
      setSubagentRuns([])
      setPipeline(null)
      setDiffs([])
    }
  }, [selectedThreadId, loadHistory, loadDiffs])

  // ── WS stream ────────────────────────────────────────────────────────────

  const refillPermissionQueue = useCallback(async (threadId: string) => {
    try {
      const res = await threadsService.pendingPermissions(threadId)
      if (res.error || !mountedRef.current) return
      const permissions = res.permissions ?? []
      setPermissionQueue((prev) => {
        const others = prev.filter((p) => p.threadId !== threadId)
        return [
          ...others,
          ...permissions.map((p) => ({
            requestId: p.requestId,
            threadId: p.threadId,
            toolName: p.toolName,
            params: p.params,
          })),
        ]
      })
    } catch {
      // Snapshot é best-effort no reconnect; o próximo envio tenta de novo.
    }
  }, [])

  useEffect(() => {
    if (!selectedThreadId) return
    const threadId = selectedThreadId

    const disconnect = connectThreadStream(threadId, (event: StreamEvent) => {
      if (!mountedRef.current || event.threadId !== threadId) return
      handleStreamEvent(event)
    })

    // Reconnect / troca de thread: reenche a fila a partir do broker (além do replay WS).
    void refillPermissionQueue(threadId)

    return () => disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedThreadId, refillPermissionQueue])

  function handleStreamEvent(event: StreamEvent): void {
    if (event.type === 'message.delta') {
      setStreamingText((prev) => prev + event.text)
      return
    }
    if (event.type === 'state.change') {
      setLiveGraphOverlay((prev) => applyLiveEvent(prev, event))
      if (event.state === 'running') {
        setFollowups([])
        setFollowupsMessageId(null)
        setFollowupsPending(false)
      }
      setThreadsByProject((prev) => {
        const projectId = selectedProjectId
        if (!projectId) return prev
        const list = prev[projectId] ?? []
        const idx = list.findIndex((t) => t.id === event.threadId)
        if (idx === -1) return prev
        const nextList = list.slice()
        nextList[idx] = { ...nextList[idx], state: event.state as Thread['state'] }
        return { ...prev, [projectId]: nextList }
      })
      // Turno assentou (idle/committed/error/cancelled) — o backend já negou qualquer permissão
      // pendente no `finally` do dispatch; limpa o banner de Allow/Deny órfão que sobraria se o
      // usuário cancelou o turno em vez de responder.
      if (event.state === 'idle' || event.state === 'committed' || event.state === 'error' || event.state === 'cancelled') {
        setPermissionQueue((prev) => prev.filter((p) => p.threadId !== event.threadId))
      }
      if (event.state === 'idle' || event.state === 'committed' || event.state === 'error') {
        setStreamingText('')
        void loadHistory(event.threadId, { background: true })
        void loadDiffs(event.threadId)
        void loadFollowups(event.threadId)
        processQueueIfIdle()
        // Turno concluído grava usage_events novos — reavalia o teto para o banner do composer (spec F25 §3.2).
        if (selectedProjectId) void loadUsageLimitStatus(selectedProjectId)
      }
      return
    }
    if (event.type === 'diff.ready') {
      void loadDiffs(event.threadId)
      return
    }
    if (event.type === 'memory.entry') {
      void loadMemoryStatus(event.projectId)
      return
    }
    if (event.type === 'tool_call.start' || event.type === 'tool_call.result') {
      setLiveGraphOverlay((prev) => applyLiveEvent(prev, event))
      void loadHistory(event.threadId, { background: true })
      return
    }
    if (event.type === 'subagent.start' || event.type === 'subagent.result') {
      // Overlay imediato (F29) + refetch F15 que traz subagentRuns canónicos.
      setLiveGraphOverlay((prev) => applyLiveEvent(prev, event))
      void loadHistory(event.threadId, { background: true })
      return
    }
    if (event.type === 'pipeline.state' || event.type === 'pipeline.stage') {
      setLiveGraphOverlay((prev) => applyLiveEvent(prev, event))
      void loadHistory(event.threadId, { background: true })
      return
    }
    if (event.type === 'permission.request') {
      // O pedido virou card na timeline: fora da aba Histórico ele não seria visto. Como o overlay
      // antigo flutuava sobre qualquer aba, trazer o usuário de volta ao chat preserva a garantia
      // de que a permissão pendente é sempre alcançável.
      setActiveTab('history')
      // Grant anterior não pode ficar como "Permitir / Executando…" sob o card novo.
      setPendingMessages((prev) =>
        dropStalePermissionDecisionPendings(
          prev,
          (text) => interpretPermissionChatReply(text).kind !== 'blocked'
        )
      )
      setPermissionQueue((prev) => {
        if (prev.some((p) => p.requestId === event.requestId)) return prev
        return [
          ...prev,
          {
            requestId: event.requestId,
            threadId: event.threadId,
            toolName: event.toolName,
            params: event.params,
          },
        ]
      })
      return
    }
    if (event.type === 'permission.resolved') {
      setPermissionQueue((prev) => prev.filter((p) => p.requestId !== event.requestId))
      return
    }
    if (event.type === 'error') {
      setSendError(event.message)
      return
    }
    if (event.type === 'mcp.notice') {
      setMcpNotices((prev) => appendWorkspaceNotice(prev, mcpNotice(event)))
      return
    }
    // Tool negada pelo próprio CLI, sem passar pelo broker: o usuário só via o agente pedindo
    // aprovação em prosa, sem card nenhum. Vai para a mesma faixa do mcp.notice.
    if (event.type === 'permission.native_denial') {
      setMcpNotices((prev) => appendWorkspaceNotice(prev, nativeDenialNotice(event)))
    }
  }

  // ── Actions ──────────────────────────────────────────────────────────────

  // Bolha otimista pertence à thread onde foi digitada — trocar de thread/projeto descarta as
  // pendentes (a fila persiste em localStorage por thread e se rehidrata sozinha).
  // O id da bolha é o `clientMessageId` que viaja no POST e volta em `Message.clientId`: é por ele
  // que a reconciliação casa, e não pelo texto (o servidor reescreve o prompt antes de persistir).
  const addPending = useCallback((text: string, images: ComposerImage[], status: PendingMessageStatus): string => {
    const id = crypto.randomUUID()
    setPendingMessages((prev) => [
      ...prev,
      {
        id,
        text,
        images: images.map((img) => ({ id: img.id, mimeType: img.mimeType, name: img.name, dataBase64: img.dataBase64 })),
        status,
        createdAt: Date.now(),
      },
    ])
    return id
  }, [])

  const setPendingStatus = useCallback((id: string, status: PendingMessageStatus) => {
    setPendingMessages((prev) => prev.map((p) => (p.id === id ? { ...p, status } : p)))
  }, [])

  const removePending = useCallback((id: string) => {
    setPendingMessages((prev) => prev.filter((p) => p.id !== id))
  }, [])

  // Contexto implícito: arquivo aberto no viewer (+ seleção), espelhando `chatImplicitContext.ts`
  // do VS Code. Vira chip removível e pode ser desligado — nunca entra escondido no turno.
  const [activeFile, setActiveFile] = useState<{ path: string; selection?: { text: string; startLine?: number; endLine?: number } } | null>(null)
  const [implicitContextEnabled, setImplicitContextEnabled] = useState(true)
  const [attachError, setAttachError] = useState<string | null>(null)

  const composerAttachments = useMemo(
    () => withImplicitContext(composer.attachments, activeFile, implicitContextEnabled),
    [composer.attachments, activeFile, implicitContextEnabled]
  )

  const [codebaseBusy, setCodebaseBusy] = useState(false)

  const attach = useCallback((attachment: ComposerAttachment) => {
    setComposer((prev) => {
      const result = addAttachment(prev.attachments, attachment)
      if (!result.ok) {
        setAttachError(result.message)
        return prev
      }
      setAttachError(null)
      return { ...prev, attachments: result.attachments }
    })
  }, [])

  /** Chip implícito não sai da lista explícita — remover significa desligar o implícito. */
  const detach = useCallback((id: string) => {
    setAttachError(null)
    setComposer((prev) => {
      const next = removeAttachmentFromList(prev.attachments, id)
      if (next.length !== prev.attachments.length) return { ...prev, attachments: next }
      setImplicitContextEnabled(false)
      return prev
    })
  }, [])

  /**
   * `#codebase`: busca trechos pelo texto que já está no composer e anexa os melhores como chips
   * de seleção — o usuário vê exatamente o que vai junto e pode remover.
   */
  const attachCodebase = useCallback(async () => {
    if (!selectedProjectId || codebaseBusy) return
    const query = composer.text.trim()
    if (query === '') {
      setAttachError('Escreva o pedido antes de buscar no codebase.')
      return
    }
    setCodebaseBusy(true)
    setAttachError(null)
    try {
      const res = await projectsService.codesearch(selectedProjectId, query, 3)
      if (res.error) {
        setAttachError(res.error.message)
        return
      }
      if (res.hits.length === 0) {
        setAttachError('Nenhum trecho do projeto casou com esse pedido.')
        return
      }
      for (const hit of res.hits) {
        attach(
          makeSelectionAttachment(hit.path, hit.snippet, { startLine: hit.startLine, endLine: hit.endLine })
        )
      }
    } catch {
      setAttachError('Não foi possível buscar no codebase.')
    } finally {
      if (mountedRef.current) setCodebaseBusy(false)
    }
  }, [selectedProjectId, composer.text, codebaseBusy, attach])

  const selectProject = useCallback((projectId: string | null) => {
    setSelectedProjectId(projectId)
    setSelectedThreadId(null)
    setPendingMessages([])
    setSendError(null)
  }, [])

  const selectThread = useCallback((threadId: string | null) => {
    setSelectedThreadId(threadId)
    setPendingMessages([])
    setAttachError(null)
    setSendError(null)
    setActiveTab('history')
    setLiveGraphOverlay(emptyLiveOverlay())
  }, [])

  const newThread = useCallback(() => {
    setSelectedThreadId(null)
    setPendingMessages([])
    setSendError(null)
    setComposer((prev) => ({ ...prev, text: '', images: [] }))
  }, [])

  const addProject = useCallback(
    async (path: string, name: string | undefined) => {
      const res = await projectsService.create({ path, name: name || undefined })
      if (res.error) return { ok: false as const, error: res.error }
      setProjects((prev) => [...(prev ?? []), res.project])
      setSelectedProjectId(res.project.id)
      setAddProjectModalOpen(false)
      return { ok: true as const, project: res.project }
    },
    []
  )

  const removeProject = useCallback(
    async (projectId: string) => {
      await projectsService.remove(projectId)
      setProjects((prev) => (prev ?? []).filter((p) => p.id !== projectId))
      if (selectedProjectId === projectId) {
        setSelectedProjectId(null)
        setSelectedThreadId(null)
      }
    },
    [selectedProjectId]
  )

  // ── Prompts salvos e modos de chat (F28 §3.4) ────────────────────────────

  const [savedPrompts, setSavedPrompts] = useState<SavedPromptItem[]>([])
  const [chatModes, setChatModes] = useState<ChatModeItem[]>([])
  const [libraryError, setLibraryError] = useState<string | null>(null)

  const loadPromptLibrary = useCallback(async (projectId: string) => {
    const [prompts, modes] = await Promise.all([
      promptLibraryService.listPrompts(projectId),
      promptLibraryService.listModes(projectId),
    ])
    if (!mountedRef.current) return
    if (!prompts.error) setSavedPrompts(prompts.prompts)
    if (!modes.error) setChatModes(modes.modes)
  }, [])

  useEffect(() => {
    if (!selectedProjectId) {
      setSavedPrompts([])
      setChatModes([])
      return
    }
    void loadPromptLibrary(selectedProjectId)
  }, [selectedProjectId, loadPromptLibrary])

  /**
   * Aplica o preset do modo no rascunho. Provider e execution só mudam em thread nova: na thread
   * existente os dois são imutáveis (mesma regra das pills do composer).
   */
  const applyChatMode = useCallback(
    (name: string | null) => {
      setLibraryError(null)
      if (name === null) {
        setComposer((prev) => ({ ...prev, chatMode: null }))
        return
      }
      const mode = chatModes.find((m) => m.name === name)
      if (mode === undefined) return
      const provider = asProvider(mode.provider)
      const accessLevel = asAccessLevel(mode.accessLevel)
      const executionMode = asExecutionMode(mode.executionMode)
      const isNewThread = selectedThreadId === null
      setComposer((prev) => ({
        ...prev,
        chatMode: mode.name,
        provider: isNewThread && provider !== null ? provider : prev.provider,
        model: mode.model ?? prev.model,
        reasoningLevel: mode.reasoningLevel ?? prev.reasoningLevel,
        accessLevel: accessLevel ?? prev.accessLevel,
        executionMode: isNewThread && executionMode !== null ? executionMode : prev.executionMode,
      }))
    },
    [chatModes, selectedThreadId]
  )

  const savePromptFromComposer = useCallback(
    async (rawName: string): Promise<boolean> => {
      if (!selectedProjectId) return false
      const name = slugifyPromptName(rawName)
      const body = composer.text.trim()
      if (name === '' || body === '') {
        setLibraryError('Dê um nome ao prompt e escreva o texto antes de salvar.')
        return false
      }
      const res = await promptLibraryService.createPrompt(selectedProjectId, { name, body })
      if (res.error) {
        setLibraryError(res.error.message)
        return false
      }
      setLibraryError(null)
      await loadPromptLibrary(selectedProjectId)
      return true
    },
    [selectedProjectId, composer.text, loadPromptLibrary]
  )

  /** O modo nasce do que já está no composer — é o preset que o usuário acabou de montar na mão. */
  const saveChatModeFromComposer = useCallback(
    async (rawName: string, instructions = ''): Promise<boolean> => {
      if (!selectedProjectId) return false
      const name = slugifyPromptName(rawName)
      if (name === '') {
        setLibraryError('Dê um nome ao modo antes de salvar.')
        return false
      }
      const res = await promptLibraryService.createMode(selectedProjectId, {
        name,
        provider: composer.provider,
        model: composer.model,
        reasoningLevel: composer.reasoningLevel,
        accessLevel: composer.accessLevel,
        executionMode: composer.executionMode,
        instructions,
      })
      if (res.error) {
        setLibraryError(res.error.message)
        return false
      }
      setLibraryError(null)
      // Marca o modo direto: `applyChatMode` leria a lista do render anterior, ainda sem o modo
      // recém-criado, e a pill ficaria no modo antigo. O preset já é o estado atual do composer.
      setComposer((prev) => ({ ...prev, chatMode: name }))
      await loadPromptLibrary(selectedProjectId)
      return true
    },
    [
      selectedProjectId,
      composer.provider,
      composer.model,
      composer.reasoningLevel,
      composer.accessLevel,
      composer.executionMode,
      loadPromptLibrary,
    ]
  )

  const deleteSavedPrompt = useCallback(
    async (id: string) => {
      const res = await promptLibraryService.deletePrompt(id)
      if (res.error) {
        setLibraryError(res.error.message)
        return
      }
      if (selectedProjectId) await loadPromptLibrary(selectedProjectId)
    },
    [selectedProjectId, loadPromptLibrary]
  )

  const deleteChatMode = useCallback(
    async (id: string, name: string) => {
      const res = await promptLibraryService.deleteMode(id)
      if (res.error) {
        setLibraryError(res.error.message)
        return
      }
      setComposer((prev) => (prev.chatMode === name ? { ...prev, chatMode: null } : prev))
      if (selectedProjectId) await loadPromptLibrary(selectedProjectId)
    },
    [selectedProjectId, loadPromptLibrary]
  )

  const gitInitProject = useCallback(async (projectId: string) => {
    const res = await projectsService.gitInit(projectId)
    if (!res.error) void loadVcsStatus(projectId)
    return res
  }, [loadVcsStatus])

  const updateComposer = useCallback((patch: Partial<ComposerDraft>) => {
    setComposer((prev) => ({ ...prev, ...patch }))
  }, [])

  /** Persiste Access na thread imediatamente (não espera o próximo follow-up). */
  const setAccessLevel = useCallback(
    async (accessLevel: ThreadAccessLevel) => {
      setComposer((prev) => ({ ...prev, accessLevel }))
      if (!selectedThreadId) return
      const res = await threadsService.patchAccess(selectedThreadId, accessLevel)
      if (res.error) {
        setSendError(res.error.message)
        return
      }
      if (selectedProjectId && res.thread) upsertThreadLocal(selectedProjectId, res.thread)
    },
    [selectedThreadId, selectedProjectId, upsertThreadLocal]
  )

  const enqueue = useCallback(
    (
      text: string,
      images: ComposerImage[],
      model: string | null,
      reasoningLevel: string | null,
      attachments: ComposerAttachment[] = []
    ) => {
      setQueue((prev) => {
        const next = [
          ...prev,
          {
            id: `q_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            text,
            images,
            attachments,
            model,
            reasoningLevel,
          },
        ]
        saveQueue(queueKey, next)
        return next
      })
    },
    [queueKey]
  )

  const dequeue = useCallback(
    (id: string) => {
      setQueue((prev) => {
        const next = prev.filter((q) => q.id !== id)
        saveQueue(queueKey, next)
        return next
      })
    },
    [queueKey]
  )

  const updateQueueItem = useCallback(
    (id: string, text: string) => {
      const trimmed = text.trim()
      if (trimmed === '') return
      setQueue((prev) => {
        const next = prev.map((q) => (q.id === id ? { ...q, text: trimmed } : q))
        saveQueue(queueKey, next)
        return next
      })
    },
    [queueKey]
  )

  /** Move item to the front so it runs next when the turn ends. */
  const promoteQueueItem = useCallback(
    (id: string) => {
      setQueue((prev) => {
        const idx = prev.findIndex((q) => q.id === id)
        if (idx <= 0) return prev
        const item = prev[idx]
        if (!item) return prev
        const next = [item, ...prev.slice(0, idx), ...prev.slice(idx + 1)]
        saveQueue(queueKey, next)
        return next
      })
    },
    [queueKey]
  )

  // O despacho da fila roda fora do updater do `setQueue`: updater com efeito colateral é
  // chamado duas vezes sob StrictMode e mandava o mesmo follow-up em dobro.
  function processQueueIfIdle(): void {
    const current = queueRef.current
    const [head, ...rest] = current
    if (!head || !selectedThreadId) return
    queueRef.current = rest
    setQueue(rest)
    saveQueue(queueKey, rest)
    void sendFollowUpRef.current(head.text, head.images, head.model, head.reasoningLevel, head.attachments ?? []).then((ok) => {
      // O item sai da fila antes do POST (evita despacho duplo se outro `state.change` chegar
      // no meio). Falhou — ex.: outra thread do projeto pegou a lease primeiro —, volta para a
      // frente da fila; sem isso a mensagem enfileirada some sem nunca ter rodado.
      if (ok) return
      const restored = [head, ...queueRef.current]
      queueRef.current = restored
      setQueue(restored)
      saveQueue(queueKey, restored)
    })
  }

  const sendFollowUp = useCallback(
    async (
      text: string,
      images: ComposerImage[] = [],
      model: string | null = null,
      reasoningLevel: string | null = null,
      attachments: ComposerAttachment[] = []
    ): Promise<boolean> => {
      if (!selectedThreadId) return false
      setFollowups([])
      setFollowupsMessageId(null)
      setFollowupsPending(false)
      const pendingId = addPending(text, images, 'sending')
      try {
        const res = await threadsService.followUp(selectedThreadId, {
          prompt: text,
          clientMessageId: pendingId,
          model,
          reasoningLevel,
          accessLevel: composer.accessLevel,
          images: images.length > 0 ? toImagePayloads(images) : undefined,
          contextAttachments: attachments.length > 0 ? toWirePayload(attachments) : undefined,
          chatMode: composer.chatMode,
        })
        if (res.error) {
          removePending(pendingId)
          setSendError(res.error.message)
          return false
        }
        setPendingStatus(pendingId, 'sent')
        if (selectedProjectId) upsertThreadLocal(selectedProjectId, res.thread)
        return true
      } catch {
        removePending(pendingId)
        setSendError('Falha ao enviar a mensagem.')
        return false
      }
    },
    [
      selectedThreadId,
      selectedProjectId,
      composer.accessLevel,
      composer.chatMode,
      upsertThreadLocal,
      addPending,
      setPendingStatus,
      removePending,
    ]
  )

  // Mesma razão do `queueRef`: o handler de WS chamaria uma versão antiga de `sendFollowUp`
  // (com `composer.accessLevel` congelado no render da conexão).
  const sendFollowUpRef = useRef(sendFollowUp)
  useEffect(() => {
    sendFollowUpRef.current = sendFollowUp
  }, [sendFollowUp])

  const resolvePermission = useCallback(
    async (
      requestId: string,
      allow: boolean,
      always = false,
      scope: 'thread' | 'project' = 'thread',
      threadIdOverride?: string
    ): Promise<boolean> => {
      const entry = permissionQueue.find((p) => p.requestId === requestId)
      const threadId = entry?.threadId ?? threadIdOverride
      if (!threadId) return false
      try {
        const res = await threadsService.permission(threadId, {
          requestId,
          allow,
          always: always || undefined,
          scope: scope === 'project' ? 'project' : undefined,
        })
        if (res.error) {
          // Não remove da fila: o broker ainda espera. Card some sem grant era o sintoma
          // "clique aceito mas permissão não concedida".
          setSendError(res.error.message)
          return false
        }
        setPermissionQueue((prev) => prev.filter((p) => p.requestId !== requestId))
        return true
      } catch {
        setSendError('Falha ao enviar a decisão de permissão.')
        return false
      }
    },
    [permissionQueue]
  )

  /**
   * Clique numa resposta da pergunta do agente: preenche o composer — o envio é o Enviar
   * (resolve permissão / ask_user_question / follow-up conforme o estado).
   */
  const sendDecision = useCallback((text: string) => {
    const value = text.trim()
    if (value === '') return
    setComposer((prev) => ({ ...prev, text: value }))
  }, [])

  const send = useCallback(async () => {
    const text = composer.text.trim()
    if (text === '') return
    setSendError(null)

    let pendingPermission =
      selectedThreadId !== null
        ? permissionQueue.find((p) => p.threadId === selectedThreadId)
        : undefined

    // waiting_permission com fila local vazia (WS perdido): snapshot do broker antes de decidir.
    if (
      selectedThreadId &&
      !pendingPermission &&
      selectedThread?.state === 'waiting_permission'
    ) {
      try {
        const snap = await threadsService.pendingPermissions(selectedThreadId)
        const first = snap.permissions?.[0]
        if (first && !snap.error) {
          // Const local (não o `let` acima): sem ela o `setPermissionQueue` precisaria de `!`
          // e mascararia o caso em que o snapshot volta vazio — aí a rota abaixo é que decide.
          const recovered = {
            requestId: first.requestId,
            threadId: first.threadId,
            toolName: first.toolName,
            params: first.params,
          }
          pendingPermission = recovered
          setPermissionQueue((prev) => {
            if (prev.some((p) => p.requestId === recovered.requestId)) return prev
            return [...prev, recovered]
          })
        }
      } catch {
        // cai no route blocked abaixo
      }
    }

    const route = routeComposerSend({
      text,
      threadState: selectedThread?.state,
      hasPendingPermission: pendingPermission !== undefined,
      hasPendingQuestion: pendingQuestion !== null,
      hasSelectedThread: selectedThreadId !== null,
      hasSelectedProject: selectedProjectId !== null,
    })

    if (route.action === 'noop') return

    if (route.action === 'permission_blocked') {
      setSendError(route.message)
      return
    }

    if (route.action === 'resolve_permission') {
      // Sem a permissão em mãos o `if` antigo caía nos branches de baixo e o texto virava turno
      // novo em silêncio. Ausência aqui é o mesmo caso do snapshot vazio: erro visível.
      if (!pendingPermission) {
        setSendError(PERMISSION_PENDING_HINT)
        return
      }
      // Eco local só enquanto o POST voa: a decisão não vira mensagem no banco. Depois do
      // grant a bolha some — promover para `sent` deixava "Executando…" fantasma e o próximo
      // pedido de permissão parecia sobrepor trabalho ainda em curso.
      const pendingId = addPending(text, [], 'permission')
      setComposer((prev) => ({ ...prev, text: '', images: [] }))
      const allow =
        route.decision.kind === 'allow' ||
        route.decision.kind === 'allow_always' ||
        route.decision.kind === 'allow_project'
      const always =
        route.decision.kind === 'allow_always' || route.decision.kind === 'allow_project'
      const scope = route.decision.kind === 'allow_project' ? 'project' : 'thread'
      const ok = await resolvePermission(
        pendingPermission.requestId,
        allow,
        always,
        scope,
        pendingPermission.threadId
      )
      removePending(pendingId)
      if (!ok) return
      return
    }

    // F21: texto no composer (digitado ou opção clicada) responde a ask_user_question —
    // antes caía na fila de follow-up e a pergunta ficava presa.
    if (route.action === 'answer_question') {
      const answer = composerAnswerForQuestion(
        text,
        pendingQuestion!.options,
        pendingQuestion!.multiSelect
      )
      const pendingId = addPending(text, [], 'permission')
      setComposer((prev) => ({ ...prev, text: '', images: [], attachments: [] }))
      try {
        const res = await threadsService.answerQuestion(selectedThreadId!, answer)
        removePending(pendingId)
        if (res.error) {
          setSendError(answerErrorMessage(res.error.code))
          return
        }
      } catch {
        removePending(pendingId)
        setSendError(answerErrorMessage(undefined))
      }
      return
    }

    // running / waiting_user / waiting_permission (sem gate resolvível) — enfileira.
    if (route.action === 'enqueue') {
      // Sugestões do turno anterior somem na hora: senão ficam sobre "Na fila…" / "Executando…".
      setFollowups([])
      setFollowupsMessageId(null)
      setFollowupsPending(false)
      enqueue(text, composer.images, composer.model, composer.reasoningLevel, composerAttachments)
      setComposer((prev) => ({ ...prev, text: '', images: [], attachments: [] }))
      return
    }

    if (!selectedProjectId) return

    if (route.action === 'send_new') {
      const images = composer.images
      const attachments = composerAttachments
      const pendingId = addPending(text, images, 'sending')
      setComposer((prev) => ({ ...prev, text: '', images: [], attachments: [] }))
      try {
        const res = await threadsService.create(selectedProjectId, {
          prompt: text,
          clientMessageId: pendingId,
          provider: composer.provider,
          model: composer.model,
          reasoningLevel: composer.reasoningLevel,
          accessLevel: composer.accessLevel,
          executionMode: composer.executionMode,
          images: images.length > 0 ? toImagePayloads(images) : undefined,
          contextAttachments: attachments.length > 0 ? toWirePayload(attachments) : undefined,
          chatMode: composer.chatMode,
        })
        if (res.error) {
          removePending(pendingId)
          setSendError(res.error.message)
          return
        }
        setPendingStatus(pendingId, 'sent')
        upsertThreadLocal(selectedProjectId, res.thread)
        setSelectedThreadId(res.thread.id)
      } catch {
        removePending(pendingId)
        setSendError('Falha ao enviar a mensagem.')
      }
      return
    }

    const images = composer.images
    const attachments = composerAttachments
    setComposer((prev) => ({ ...prev, text: '', images: [], attachments: [] }))
    await sendFollowUp(text, images, composer.model, composer.reasoningLevel, attachments)
  }, [
    composer,
    selectedThread,
    selectedThreadId,
    selectedProjectId,
    permissionQueue,
    pendingQuestion,
    enqueue,
    sendFollowUp,
    resolvePermission,
    upsertThreadLocal,
    addPending,
    setPendingStatus,
    removePending,
    composerAttachments,
    refillPermissionQueue,
  ])

  const cancel = useCallback(async () => {
    if (!selectedThreadId) return
    setStreamingText('')
    setPendingMessages([])
    setSendError(null)
    const res = await threadsService.cancel(selectedThreadId)
    if (res.error) {
      setSendError(res.error.message)
    } else if (res.cancelled === false) {
      setSendError('Não foi possível cancelar a execução.')
    }
    void loadHistory(selectedThreadId, { background: true })
  }, [selectedThreadId, loadHistory])

  const dismissMcpNotices = useCallback(() => {
    setMcpNotices([])
  }, [])

  const acceptDiffs = useCallback(
    async (input: { action?: 'accept' | 'reject'; ids?: string[]; paths?: string[] }) => {
      if (!selectedThreadId) return { ok: false as const, error: 'Nenhuma thread selecionada.' }
      const res = await threadsService.accept(selectedThreadId, input)
      if (res.error) return { ok: false as const, error: res.error.message }
      void loadDiffs(selectedThreadId)
      return { ok: true as const }
    },
    [selectedThreadId, loadDiffs]
  )

  /** Escolhe o vencedor de um diff `conflict` de merge paralelo (F18) — sem CTA na UI até `ui.md` existir. */
  const resolveDiffConflict = useCallback(
    async (diffId: string, winningChildThreadId: string) => {
      if (!selectedThreadId) return { ok: false as const, error: 'Nenhuma thread selecionada.' }
      const res = await threadsService.resolveConflict(selectedThreadId, diffId, { winningChildThreadId })
      if (res.error) return { ok: false as const, error: res.error.message }
      void loadDiffs(selectedThreadId)
      return { ok: true as const }
    },
    [selectedThreadId, loadDiffs]
  )

  const gitCommit = useCallback(
    async (subject: string, body?: string) => {
      if (!selectedThreadId) return { ok: false as const, error: 'Nenhuma thread selecionada.' }
      const res = await threadsService.gitCommit(selectedThreadId, { subject, body })
      if (res.error) return { ok: false as const, error: res.error.message }
      if (selectedProjectId) void loadVcsStatus(selectedProjectId)
      return { ok: true as const, sha: res.sha }
    },
    [selectedThreadId, selectedProjectId, loadVcsStatus]
  )

  const gitPush = useCallback(async () => {
    if (!selectedThreadId) return { ok: false as const, error: 'Nenhuma thread selecionada.' }
    const res = await threadsService.gitPush(selectedThreadId)
    if (res.error) return { ok: false as const, error: res.error.message }
    if (selectedProjectId) void loadVcsStatus(selectedProjectId)
    return { ok: true as const, branch: res.branch }
  }, [selectedThreadId, selectedProjectId, loadVcsStatus])

  const openPr = useCallback(
    async (input?: { title?: string; body?: string }) => {
      if (!selectedThreadId) return { ok: false as const, error: 'Nenhuma thread selecionada.' }
      const res = await threadsService.pr(selectedThreadId, input)
      if (res.error) return { ok: false as const, error: res.error.message }
      return { ok: true as const, url: res.url, existing: res.existing }
    },
    [selectedThreadId]
  )

  const gitTextgen = useCallback(
    async (mode: 'commit' | 'pr') => {
      if (!selectedThreadId) return { ok: false as const, error: 'Nenhuma thread selecionada.' }
      const res = await threadsService.gitTextgen(selectedThreadId, { mode })
      if (res.error) return { ok: false as const, error: res.error.message }
      return { ok: true as const, subject: res.subject, body: res.body, title: res.title }
    },
    [selectedThreadId]
  )

  /**
   * O que o chat mostra abaixo do histórico: primeiro o que já foi despachado (`sending`/`sent`
   * /`permission`), depois a fila na ordem em que será executada.
   */
  const chatPendingMessages = useMemo<PendingMessage[]>(
    () => [
      ...pendingMessages,
      ...queue.map((item) => ({
        id: item.id,
        text: item.text,
        images: item.images.map((img) => ({ id: img.id, mimeType: img.mimeType, name: img.name, dataBase64: img.dataBase64 })),
        status: 'queued' as const,
        createdAt: 0,
      })),
    ],
    [pendingMessages, queue]
  )

  /** Voto otimista: clicar no mesmo voto desfaz (toggle), igual ao chat do VS Code. */
  const voteMessage = useCallback(
    async (messageId: string, vote: FeedbackVote) => {
      if (!selectedThreadId) return
      const current = feedback[messageId]
      const next = current === vote ? null : vote
      setFeedback((prev) => {
        const copy = { ...prev }
        if (next === null) delete copy[messageId]
        else copy[messageId] = next
        return copy
      })
      const res = await threadsService.feedback(selectedThreadId, messageId, next)
      if (res.error) {
        setFeedback((prev) => {
          const copy = { ...prev }
          if (current === undefined) delete copy[messageId]
          else copy[messageId] = current
          return copy
        })
      }
    },
    [selectedThreadId, feedback]
  )

  const renameThread = useCallback(
    async (threadId: string, title: string | null) => {
      const res = await threadsService.rename(threadId, title)
      if (res.error) {
        setSendError(res.error.message)
        return
      }
      if (selectedProjectId && res.thread) upsertThreadLocal(selectedProjectId, res.thread)
    },
    [selectedProjectId, upsertThreadLocal]
  )

  /** Exporta baixando pelo próprio renderer — sem IPC novo nem diálogo nativo. */
  const exportThread = useCallback(async (threadId: string, format: 'md' | 'json') => {
    setExportError(null)
    setExporting(true)
    try {
      const res = await threadsService.exportThread(threadId, format)
      if (res.error) {
        setExportError(exportFetchErrorMessage(res.error.message))
        return
      }
      try {
        triggerBrowserDownload(res.content, res.fileName, mimeTypeForExportFormat(format))
      } catch (err) {
        console.error('[export]', err)
        setExportError(EXPORT_COPY.downloadFailed)
      }
    } catch (err) {
      console.error('[export]', err)
      setExportError(EXPORT_COPY.fetchFailed)
    } finally {
      setExporting(false)
    }
  }, [])

  const clearExportError = useCallback(() => setExportError(null), [])

  /** Busca de conversas (título + conteúdo). Termo vazio recarrega a lista completa. */
  const searchThreads = useCallback(
    async (projectId: string, query: string) => {
      if (query.trim() === '') {
        await loadThreads(projectId)
        return
      }
      const res = await threadsService.search(projectId, query)
      if (res.error || !mountedRef.current) return
      setThreadsByProject((prev) => ({ ...prev, [projectId]: res.threads }))
    },
    [loadThreads]
  )

  const openSubagentRun = useCallback((run: SubagentRun) => setActiveSubagentRun(run), [])
  const closeSubagentRun = useCallback(() => setActiveSubagentRun(null), [])

  // Refetch manual do status de memória — o painel de Memória (F20) alterna o toggle
  // por fora do fluxo de turno, então o evento `memory.entry` não cobre esse caso.
  const refreshMemoryStatus = useCallback(() => {
    if (selectedProjectId) void loadMemoryStatus(selectedProjectId)
  }, [selectedProjectId, loadMemoryStatus])

  return {
    projects,
    projectsError,
    selectedProjectId,
    selectedProject,
    selectProject,
    threadsByProject,
    threadsLoading,
    threadsError,
    selectedThreadId,
    selectedThread,
    selectThread,
    newThread,
    vcsStatus,
    memoryStatus,
    refreshMemoryStatus,
    usageLimitStatus,
    messages,
    feedback,
    followups,
    followupsMessageId,
    followupsPending,
    sendDecision,
    voteMessage,
    renameThread,
    exportThread,
    exporting,
    exportError,
    clearExportError,
    searchThreads,
    chatPendingMessages,
    toolCalls,
    subagentRuns,
    pipeline,
    liveGraphOverlay,
    activeSubagentRun,
    openSubagentRun,
    closeSubagentRun,
    historyLoading,
    historyError,
    streamingText,
    diffs,
    activeTab,
    setActiveTab,
    configStatus,
    composerCatalog,
    composer,
    composerAttachments,
    attach,
    attachCodebase,
    codebaseBusy,
    detach,
    attachError,
    activeFile,
    setActiveFile,
    implicitContextEnabled,
    setImplicitContextEnabled,
    updateComposer,
    setAccessLevel,
    savedPrompts,
    chatModes,
    libraryError,
    applyChatMode,
    savePromptFromComposer,
    saveChatModeFromComposer,
    deleteSavedPrompt,
    deleteChatMode,
    queue,
    dequeue,
    updateQueueItem,
    promoteQueueItem,
    sendError,
    send,
    cancel,
    pendingQuestion,
    answerQuestion,
    answerBusy,
    answerError,
    addProjectModalOpen,
    setAddProjectModalOpen,
    addProject,
    removeProject,
    gitInitProject,
    permissionQueue,
    resolvePermission,
    mcpNotices,
    dismissMcpNotices,
    acceptDiffs,
    resolveDiffConflict,
    gitCommit,
    gitPush,
    openPr,
    gitTextgen,
  }
}

export type PrincipalWorkspace = ReturnType<typeof usePrincipalWorkspace>
