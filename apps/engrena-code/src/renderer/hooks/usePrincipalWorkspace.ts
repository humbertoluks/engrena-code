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
} from '../services/threads-service'
import { connectThreadStream, type StreamEvent } from '../services/ws-client'
import { configuracaoService, type ConfigStatus } from '../services/configuracao-service'
import { memoryService, type MemoryStatus } from '../services/memory-service'
import { consumoService, type UsageLimitStatusResponse } from '../services/consumo-service'
import type { SubagentRun } from '../services/subagents-service'
import { findPendingAskUserQuestion, answerErrorMessage } from '../components/workspace/askUserQuestion.logic'
import { interpretPermissionChatReply } from '../components/workspace/permissionComposer.logic'
import {
  reconcilePendingMessages,
  type PendingMessage,
  type PendingMessageStatus,
} from '../components/workspace/pendingMessages.logic'


const QUEUE_STORAGE_PREFIX = 'engrenacode.message-queue.v1.'

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

  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null)
  const [vcsStatus, setVcsStatus] = useState<VcsStatus | null>(null)
  const [memoryStatus, setMemoryStatus] = useState<MemoryStatus | null>(null)
  const [usageLimitStatus, setUsageLimitStatus] = useState<UsageLimitStatusResponse | null>(null)

  const [messages, setMessages] = useState<Message[]>([])
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
    setThreadsLoading((prev) => ({ ...prev, [projectId]: true }))
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
    }))
  }, [
    selectedThread?.id,
    selectedThread?.model,
    selectedThread?.reasoningLevel,
    selectedThread?.provider,
    selectedThread?.accessLevel,
    selectedThread?.executionMode,
  ])

  useEffect(() => {
    setStreamingText('')
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

  const selectProject = useCallback((projectId: string | null) => {
    setSelectedProjectId(projectId)
    setSelectedThreadId(null)
    setPendingMessages([])
    setSendError(null)
  }, [])

  const selectThread = useCallback((threadId: string | null) => {
    setSelectedThreadId(threadId)
    setPendingMessages([])
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
    (text: string, images: ComposerImage[], model: string | null, reasoningLevel: string | null) => {
      setQueue((prev) => {
        const next = [
          ...prev,
          { id: `q_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`, text, images, model, reasoningLevel },
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
    void sendFollowUpRef.current(head.text, head.images, head.model, head.reasoningLevel).then((ok) => {
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
      reasoningLevel: string | null = null
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

  const resolvePermission = useCallback(async (requestId: string, allow: boolean, always = false) => {
    const entry = permissionQueue.find((p) => p.requestId === requestId)
    if (!entry) return
    await threadsService.permission(entry.threadId, { requestId, allow, always: always || undefined })
    setPermissionQueue((prev) => prev.filter((p) => p.requestId !== requestId))
  }, [permissionQueue])

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
      enqueue(text, composer.images, composer.model, composer.reasoningLevel)
      setComposer((prev) => ({ ...prev, text: '', images: [] }))
      return
    }

    if (!selectedProjectId) return

    if (!selectedThreadId) {
      const images = composer.images
      const pendingId = addPending(text, images, 'sending')
      setComposer((prev) => ({ ...prev, text: '', images: [] }))
      try {
        const res = await threadsService.create(selectedProjectId, {
          prompt: text,
          provider: composer.provider,
          model: composer.model,
          reasoningLevel: composer.reasoningLevel,
          accessLevel: composer.accessLevel,
          executionMode: composer.executionMode,
          images: images.length > 0 ? toImagePayloads(images) : undefined,
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
    setComposer((prev) => ({ ...prev, text: '', images: [] }))
    await sendFollowUp(text, images, composer.model, composer.reasoningLevel)
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
    updateComposer,
    setAccessLevel,
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
