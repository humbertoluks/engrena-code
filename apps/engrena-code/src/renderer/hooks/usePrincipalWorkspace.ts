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
import { configuracaoService, type ConfigStatus } from '../services/configuracao-service'
import {
  promptLibraryService,
  type ChatModeItem,
  type SavedPromptItem,
} from '../services/prompt-library-service'
import { memoryService, type MemoryStatus } from '../services/memory-service'
import { consumoService, type UsageLimitStatusResponse } from '../services/consumo-service'
import type { SubagentRun } from '../services/subagents-service'
import { findPendingAskUserQuestion, answerErrorMessage } from '../components/workspace/askUserQuestion.logic'
import { interpretPermissionChatReply } from '../components/workspace/permissionComposer.logic'
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
  reconcilePendingMessages,
  type PendingMessage,
  type PendingMessageStatus,
} from '../components/workspace/pendingMessages.logic'


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

export type ThreadTab = 'history' | 'diff'

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
  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
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

  const [configStatus, setConfigStatus] = useState<ConfigStatus | null>(null)
  const [composerCatalog, setComposerCatalog] = useState<ComposerCatalog | null>(null)

  const [composer, setComposer] = useState<ComposerDraft>({
    provider: 'claude',
    model: null,
    reasoningLevel: null,
    // 'supervised' manda --permission-mode default pro CLI, que exige aprovação interativa via
    // stdin — inexistente no spawn headless (-p). Toda tool falha em loop até o PermissionBroker
    // real ser construído (ver docs/AUDIT-CODE-REVIEW.md). 'auto-accept-edits' é o único nível
    // funcional por default hoje.
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
  const [addProjectModalOpen, setAddProjectModalOpen] = useState(false)

  const [permissionQueue, setPermissionQueue] = useState<
    Array<{ requestId: string; threadId: string; toolName: string; params: unknown }>
  >([])

  const [mcpNotices, setMcpNotices] = useState<Array<{ mcpName: string; reason: string; message: string }>>([])

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
   */
  const loadHistory = useCallback(async (threadId: string, options?: { background?: boolean }) => {
    const background = options?.background === true
    if (!background) {
      setHistoryLoading(true)
      setHistoryError(null)
    }
    try {
      const res = await threadsService.history(threadId)
      if (!mountedRef.current) return
      if (res.error) {
        if (background) console.error('[workspace] history refetch:', res.error.message)
        else setHistoryError(res.error.message)
        return
      }
      setMessages(res.messages)
      setFeedback(Object.fromEntries((res.feedback ?? []).map((f: MessageFeedback) => [f.messageId, f.vote])))
      setPendingMessages((prev) => reconcilePendingMessages(prev, res.messages))
      setToolCalls(res.toolCalls)
      setSubagentRuns(res.subagentRuns)
      setPipeline(res.pipeline)
    } catch (err: unknown) {
      if (!mountedRef.current) return
      if (background) console.error('[workspace] history refetch:', err)
      else setHistoryError('Falha ao carregar o histórico da thread.')
    } finally {
      if (mountedRef.current && !background) setHistoryLoading(false)
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
        if (mountedRef.current) setConfigStatus(status)
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

  useEffect(() => {
    if (!selectedThreadId) return
    const threadId = selectedThreadId

    const disconnect = connectThreadStream(threadId, (event: StreamEvent) => {
      if (!mountedRef.current || event.threadId !== threadId) return
      handleStreamEvent(event)
    })

    return () => disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedThreadId])

  function handleStreamEvent(event: StreamEvent): void {
    if (event.type === 'message.delta') {
      setStreamingText((prev) => prev + event.text)
      return
    }
    if (event.type === 'state.change') {
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
      void loadHistory(event.threadId, { background: true })
      return
    }
    if (event.type === 'subagent.start' || event.type === 'subagent.result') {
      // Refetch traz `subagentRuns` (e `toolCalls` correlacionados) sem exigir refresh manual (spec F15 §5.3).
      void loadHistory(event.threadId, { background: true })
      return
    }
    if (event.type === 'pipeline.state' || event.type === 'pipeline.stage') {
      // Mesmo padrão de F15 — refetch traz `pipeline` (estado + estágios) sem refresh manual (spec F22 §5.3).
      void loadHistory(event.threadId, { background: true })
      return
    }
    if (event.type === 'permission.request') {
      setPermissionQueue((prev) => [...prev, { requestId: event.requestId, threadId: event.threadId, toolName: event.toolName, params: event.params }])
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
      setMcpNotices((prev) => [...prev, { mcpName: event.mcpName, reason: event.reason, message: event.message }])
    }
  }

  // ── Actions ──────────────────────────────────────────────────────────────

  // Bolha otimista pertence à thread onde foi digitada — trocar de thread/projeto descarta as
  // pendentes (a fila persiste em localStorage por thread e se rehidrata sozinha).
  const addPending = useCallback((text: string, images: ComposerImage[], status: PendingMessageStatus): string => {
    const id = `p_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
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
      const pendingId = addPending(text, images, 'sending')
      try {
        const res = await threadsService.followUp(selectedThreadId, {
          prompt: text,
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
    async (requestId: string, allow: boolean, always = false, scope: 'thread' | 'project' = 'thread') => {
    const entry = permissionQueue.find((p) => p.requestId === requestId)
    if (!entry) return
    await threadsService.permission(entry.threadId, {
      requestId,
      allow,
      always: always || undefined,
      scope: scope === 'project' ? 'project' : undefined,
    })
    setPermissionQueue((prev) => prev.filter((p) => p.requestId !== requestId))
    },
    [permissionQueue]
  )

  /**
   * Clique numa resposta da pergunta do agente: envia direto, sem passar pelo composer — é uma
   * decisão, não um rascunho. Com o turno ocupado vai para a fila, como qualquer follow-up.
   */
  const sendDecision = useCallback(
    async (text: string) => {
      const value = text.trim()
      if (value === '' || !selectedThreadId) return
      setSendError(null)
      if (selectedThread && (selectedThread.state === 'running' || selectedThread.state === 'waiting_user')) {
        enqueue(value, [], composer.model, composer.reasoningLevel, [])
        return
      }
      await sendFollowUp(value, [], composer.model, composer.reasoningLevel, [])
    },
    [selectedThreadId, selectedThread, composer.model, composer.reasoningLevel, enqueue, sendFollowUp]
  )

  const send = useCallback(async () => {
    const text = composer.text.trim()
    if (text === '') return
    setSendError(null)

    // PermissionPrompt aberto: chat "sim"/"não"/"permitir todos" resolve o PreToolUse;
    // qualquer outro texto NÃO entra na fila (senão vira follow-up `-p "Sim"` sem contexto).
    const pendingPermission =
      selectedThreadId !== null
        ? permissionQueue.find((p) => p.threadId === selectedThreadId)
        : undefined
    if (pendingPermission) {
      const reply = interpretPermissionChatReply(text)
      if (reply.kind === 'blocked') {
        setSendError(reply.message)
        return
      }
      // Eco local: a resposta resolve o PreToolUse e nunca vira mensagem no banco — sem a bolha
      // o usuário não vê que o "sim" foi registrado e responde de novo.
      addPending(text, [], 'permission')
      setComposer((prev) => ({ ...prev, text: '', images: [] }))
      await resolvePermission(
        pendingPermission.requestId,
        reply.kind === 'allow' || reply.kind === 'allow_always',
        reply.kind === 'allow_always'
      )
      return
    }

    // F21: thread pausada em waiting_user segura a mesma lease de projeto de uma thread
    // running — um follow-up imediato bateria em LeaseBusyError; enfileira como em running.
    if (selectedThread && (selectedThread.state === 'running' || selectedThread.state === 'waiting_user')) {
      enqueue(text, composer.images, composer.model, composer.reasoningLevel, composerAttachments)
      setComposer((prev) => ({ ...prev, text: '', images: [], attachments: [] }))
      return
    }

    if (!selectedProjectId) return

    if (!selectedThreadId) {
      const images = composer.images
      const attachments = composerAttachments
      const pendingId = addPending(text, images, 'sending')
      setComposer((prev) => ({ ...prev, text: '', images: [], attachments: [] }))
      try {
        const res = await threadsService.create(selectedProjectId, {
          prompt: text,
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
    enqueue,
    sendFollowUp,
    resolvePermission,
    upsertThreadLocal,
    addPending,
    setPendingStatus,
    removePending,
    composerAttachments,
  ])

  const cancel = useCallback(async () => {
    if (!selectedThreadId) return
    await threadsService.cancel(selectedThreadId)
  }, [selectedThreadId])

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
    const res = await threadsService.exportThread(threadId, format)
    if (res.error) {
      setSendError(res.error.message)
      return
    }
    const blob = new Blob([res.content], { type: format === 'md' ? 'text/markdown' : 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchorEl = document.createElement('a')
    anchorEl.href = url
    anchorEl.download = res.fileName
    anchorEl.click()
    URL.revokeObjectURL(url)
  }, [])

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
    searchThreads,
    chatPendingMessages,
    toolCalls,
    subagentRuns,
    pipeline,
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
