import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { projectsService, type Project, type VcsStatus } from '../services/projects-service'
import {
  threadsService,
  type ComposerCatalog,
  type ComposerImagePayload,
  type Diff,
  type Message,
  type ThreadAccessLevel,
  type ThreadExecutionMode,
  type ThreadProvider,
  type Thread,
  type ToolCall,
} from '../services/threads-service'
import { connectThreadStream, type StreamEvent } from '../services/ws-client'
import { configuracaoService, type ConfigStatus } from '../services/configuracao-service'
import type { SubagentRun } from '../../services/db/repositories/subagents.js'

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

  const [messages, setMessages] = useState<Message[]>([])
  const [toolCalls, setToolCalls] = useState<ToolCall[]>([])
  const [subagentRuns, setSubagentRuns] = useState<SubagentRun[]>([])
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
    accessLevel: 'supervised',
    executionMode: 'main',
    text: '',
    images: [],
  })
  const [queue, setQueue] = useState<QueueItem[]>([])
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

  const queueKey = selectedThreadId ?? `project:${selectedProjectId ?? 'none'}`

  useEffect(() => {
    setQueue(loadQueue(queueKey))
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

  const loadHistory = useCallback(async (threadId: string) => {
    setHistoryLoading(true)
    setHistoryError(null)
    try {
      const res = await threadsService.history(threadId)
      if (!mountedRef.current) return
      if (res.error) {
        setHistoryError(res.error.message)
        return
      }
      setMessages(res.messages)
      setToolCalls(res.toolCalls)
      setSubagentRuns(res.subagentRuns)
    } catch {
      if (mountedRef.current) setHistoryError('Falha ao carregar o histórico da thread.')
    } finally {
      if (mountedRef.current) setHistoryLoading(false)
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
      .catch(() => {})
    threadsService
      .composerCatalog()
      .then((res) => {
        if (mountedRef.current && !res.error) setComposerCatalog(res)
      })
      .catch(() => {})
  }, [loadProjects])

  useEffect(() => {
    if (selectedProjectId && !threadsByProject[selectedProjectId] && !threadsLoading[selectedProjectId]) {
      void loadThreads(selectedProjectId)
    }
    if (selectedProjectId) void loadVcsStatus(selectedProjectId)
    else setVcsStatus(null)
  }, [selectedProjectId, threadsByProject, threadsLoading, loadThreads, loadVcsStatus])

  // Rehidrata model/reasoning atuais da thread selecionada nos controles do composer (spec F16 plan §10).
  useEffect(() => {
    if (!selectedThread) return
    setComposer((prev) => ({
      ...prev,
      provider: selectedThread.provider,
      model: selectedThread.model,
      reasoningLevel: selectedThread.reasoningLevel,
    }))
  }, [selectedThread?.id, selectedThread?.model, selectedThread?.reasoningLevel, selectedThread?.provider])

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
      if (event.state === 'idle' || event.state === 'committed' || event.state === 'error') {
        setStreamingText('')
        void loadHistory(event.threadId)
        void loadDiffs(event.threadId)
        void processQueueIfIdle()
      }
      return
    }
    if (event.type === 'diff.ready') {
      void loadDiffs(event.threadId)
      return
    }
    if (event.type === 'tool_call.start' || event.type === 'tool_call.result') {
      void loadHistory(event.threadId)
      return
    }
    if (event.type === 'subagent.start' || event.type === 'subagent.result') {
      // Refetch traz `subagentRuns` (e `toolCalls` correlacionados) sem exigir refresh manual (spec F15 §5.3).
      void loadHistory(event.threadId)
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

  const selectProject = useCallback((projectId: string | null) => {
    setSelectedProjectId(projectId)
    setSelectedThreadId(null)
    setSendError(null)
  }, [])

  const selectThread = useCallback((threadId: string | null) => {
    setSelectedThreadId(threadId)
    setSendError(null)
    setActiveTab('history')
  }, [])

  const newThread = useCallback(() => {
    setSelectedThreadId(null)
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

  async function processQueueIfIdle(): Promise<void> {
    setQueue((prev) => {
      if (prev.length === 0 || !selectedThreadId) return prev
      const [head, ...rest] = prev
      void sendFollowUp(head.text, head.images, head.model, head.reasoningLevel)
      saveQueue(queueKey, rest)
      return rest
    })
  }

  const sendFollowUp = useCallback(
    async (text: string, images: ComposerImage[] = [], model: string | null = null, reasoningLevel: string | null = null) => {
      if (!selectedThreadId) return
      const res = await threadsService.followUp(selectedThreadId, {
        prompt: text,
        model,
        reasoningLevel,
        accessLevel: composer.accessLevel,
        images: images.length > 0 ? toImagePayloads(images) : undefined,
      })
      if (res.error) {
        setSendError(res.error.message)
        return
      }
      if (selectedProjectId) upsertThreadLocal(selectedProjectId, res.thread)
    },
    [selectedThreadId, selectedProjectId, composer.accessLevel, upsertThreadLocal]
  )

  const send = useCallback(async () => {
    const text = composer.text.trim()
    if (text === '') return
    setSendError(null)

    if (selectedThread && selectedThread.state === 'running') {
      enqueue(text, composer.images, composer.model, composer.reasoningLevel)
      setComposer((prev) => ({ ...prev, text: '', images: [] }))
      return
    }

    if (!selectedProjectId) return

    if (!selectedThreadId) {
      const res = await threadsService.create(selectedProjectId, {
        prompt: text,
        provider: composer.provider,
        model: composer.model,
        reasoningLevel: composer.reasoningLevel,
        accessLevel: composer.accessLevel,
        executionMode: composer.executionMode,
        images: composer.images.length > 0 ? toImagePayloads(composer.images) : undefined,
      })
      if (res.error) {
        setSendError(res.error.message)
        return
      }
      upsertThreadLocal(selectedProjectId, res.thread)
      setSelectedThreadId(res.thread.id)
      setComposer((prev) => ({ ...prev, text: '', images: [] }))
      return
    }

    await sendFollowUp(text, composer.images, composer.model, composer.reasoningLevel)
    setComposer((prev) => ({ ...prev, text: '', images: [] }))
  }, [composer, selectedThread, selectedThreadId, selectedProjectId, enqueue, sendFollowUp, upsertThreadLocal])

  const cancel = useCallback(async () => {
    if (!selectedThreadId) return
    await threadsService.cancel(selectedThreadId)
  }, [selectedThreadId])

  const dismissMcpNotices = useCallback(() => {
    setMcpNotices([])
  }, [])

  const resolvePermission = useCallback(async (requestId: string, allow: boolean) => {
    const entry = permissionQueue.find((p) => p.requestId === requestId)
    if (!entry) return
    await threadsService.permission(entry.threadId, { requestId, allow })
    setPermissionQueue((prev) => prev.filter((p) => p.requestId !== requestId))
  }, [permissionQueue])

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

  const openSubagentRun = useCallback((run: SubagentRun) => setActiveSubagentRun(run), [])
  const closeSubagentRun = useCallback(() => setActiveSubagentRun(null), [])

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
    messages,
    toolCalls,
    subagentRuns,
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
    queue,
    dequeue,
    sendError,
    send,
    cancel,
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
    gitCommit,
    gitPush,
    openPr,
    gitTextgen,
  }
}

export type PrincipalWorkspace = ReturnType<typeof usePrincipalWorkspace>
