import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { projectsService, type Project, type VcsStatus } from '../services/projects-service'
import {
  threadsService,
  type ComposerImagePayload,
  type Diff,
  type ThreadAccessLevel,
  type Thread,
  type FeedbackVote,
} from '../services/threads-service'
import type { StreamEvent } from '../services/ws-client'
import { configuracaoService, isConfigStatus, type ConfigStatus } from '../services/configuracao-service'
import { memoryService, type MemoryStatus } from '../services/memory-service'
import { consumoService, type UsageLimitStatusResponse } from '../services/consumo-service'
import { composerAnswerForQuestion } from '../components/workspace/askUserQuestion.logic'
import { routeComposerSend } from '../components/workspace/composerRoute.logic'
import { useThreadGate } from './useThreadGate'
import { questionFromGate, type ThreadGate } from './threadGate.logic'
import {
  appendWorkspaceNotice,
  cliVersionNotice,
  mcpNotice,
  nativeDenialNotice,
  type WorkspaceNotice,
} from './streamNotices.logic'
import {
  toWirePayload,
  type ComposerAttachment,
} from '../components/workspace/composerAttachments.logic'
import type { PendingMessage } from '../components/workspace/pendingMessages.logic'
import { PERMISSION_PENDING_HINT } from '../components/workspace/permissionComposer.logic'
import {
  EXPORT_COPY,
  exportFetchErrorMessage,
  mimeTypeForExportFormat,
  triggerBrowserDownload,
} from '../components/workspace/threadExportDownload.logic'
import { HistoryRefetchGate, isAbortError } from '../components/workspace/historyMerge.logic'
import {
  recordHistoryRefetchAborted,
  recordHistoryRefetchCoalesced,
  recordHistoryRefetchCompleted,
  recordHistoryRefetchStarted,
} from '../../services/runtime-metrics'
import { useChatTimeline } from './useChatTimeline'
import { useThreadStream } from './useThreadStream'
import {
  decideThreadStateResync,
  isSettledThreadState,
  reconcilesTurnEnd,
  shouldRefetchHistoryOnResync,
} from './threadStream.logic'
import { useComposerDraft } from './useComposerDraft'
import { useMessageQueue } from './useMessageQueue'
import { usePromptLibrary } from './usePromptLibrary'
import type { ComposerImage, QueueItem } from './messageQueue.logic'

// A fila de mensagens (estado, persistência e despacho) mora em `useMessageQueue`; o rascunho do
// composer e seus anexos moram em `useComposerDraft`. Os tipos seguem exportados daqui porque é
// por este módulo que os componentes do workspace os importam.
export type { ComposerImage, QueueItem }
export type { ComposerDraft } from './composerDraft.logic'


export type ThreadTab = 'history' | 'diff' | 'graph'

function toImagePayloads(images: ComposerImage[]): ComposerImagePayload[] {
  return images.map((img) => ({ mimeType: img.mimeType, name: img.name, dataBase64: img.dataBase64 }))
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

  /**
   * Timeline do chat: mensagens, tool calls, subagentes, pipeline, overlay otimista do grafo
   * (F29), bolhas otimistas do usuário (a mensagem aparece no envio, não só quando o próximo
   * `GET /history` chega) e o par carregando/erro do histórico.
   *
   * Estado único num reducer puro (`chatTimeline.logic.ts`) porque repor a timeline com o
   * histórico canónico é uma transição **atômica** — espalhada em setters soltos ela pinta
   * frames incoerentes (overlay otimista sobre linhas já persistidas, pipeline novo com
   * mensagens velhas). Este hook só orquestra rede: quem decide o estado é o reducer.
   */
  const {
    messages,
    feedback,
    pendingMessages,
    toolCalls,
    subagentRuns,
    pipeline,
    activeSubagentRun,
    liveGraphOverlay,
    historyLoading,
    historyError,
    streamingText,
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
  } = useChatTimeline()

  const [followups, setFollowups] = useState<string[]>([])
  // Âncora + estado de espera: o turno adianta a geração no servidor, mas quando ela demora a UI
  // precisa dizer "vem sugestão aí" em vez de deixar o espaço vazio até depois da resposta.
  const [followupsMessageId, setFollowupsMessageId] = useState<string | null>(null)
  const [followupsPending, setFollowupsPending] = useState(false)

  const [diffs, setDiffs] = useState<Diff[]>([])
  const [activeTab, setActiveTab] = useState<ThreadTab>('history')

  const [configStatus, setConfigStatus] = useState<ConfigStatus | null>(null)

  const [sendError, setSendError] = useState<string | null>(null)
  /** Erro/progresso de export ficam fora do composer, ao lado da ação que os dispara. */
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)
  const [addProjectModalOpen, setAddProjectModalOpen] = useState(false)

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

  // Rascunho do composer: draft + catálogo + anexos de contexto (explícitos e implícito) e as
  // ações que os mexem. O hook não envia nada — quem despacha o rascunho é o `send` daqui, que
  // chama a limpeza certa (`clearTextAndImages` mantém os chips; `clearDraftAfterSend` não).
  const {
    composerCatalog,
    composer,
    updateComposer,
    updateDraft,
    clearTextAndImages,
    clearDraftAfterSend,
    composerAttachments,
    attach,
    detach,
    attachCodebase,
    codebaseBusy,
    attachError,
    clearAttachError,
    activeFile,
    setActiveFile,
    implicitContextEnabled,
    setImplicitContextEnabled,
  } = useComposerDraft({
    projectId: selectedProjectId,
    selectedThread,
    mountedRef,
  })

  /**
   * Fonte única de "algo espera decisão humana" (permissão **e** pergunta), vinda do dono do fato
   * (`services/runner/gate.ts`) por snapshot `GET /gate` + `gate.opened`/`gate.resolved`.
   * Substituiu `permissionQueue` (fila local alimentada por `permission.request`) e
   * `pendingQuestion` (inferido de `toolCalls`, ou seja, de um refetch abortável).
   */
  const gateApi = useThreadGate(selectedThreadId)
  const { gate } = gateApi

  /**
   * Resposta a um gate de pergunta pelo caminho que não passa pelo composer: o checkpoint do
   * pipeline (F22), cujo CTA fica no `PipelinePanel`. Vai por `gateId` do gate em tela — a mesma
   * regra do card, sem heurística de "pergunta mais recente".
   */
  const answerQuestion = useCallback(
    async (input: { selectedOptions: string[]; freeText: string | null }) => {
      if (gate === null || gate.kind !== 'question') return
      await gateApi.resolve(gate, { kind: 'question', ...input })
    },
    [gate, gateApi]
  )

  const queueKey = selectedThreadId ?? `project:${selectedProjectId ?? 'none'}`

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
    if (!background) historyLoadStarted()
    try {
      const res = await threadsService.history(threadId, { signal })
      if (signal.aborted || !mountedRef.current) {
        recordHistoryRefetchAborted()
        return
      }
      if (res.error) {
        if (background) console.error('[workspace] history refetch:', res.error.message)
        else historyLoadFailed(res.error.message)
        return
      }
      // Uma transição só: merge por id das listas, reconcile das bolhas e overlay zerado.
      historyLoaded(res)
      recordHistoryRefetchCompleted()
    } catch (err: unknown) {
      if (isAbortError(err) || signal.aborted) {
        recordHistoryRefetchAborted()
        return
      }
      if (!mountedRef.current) return
      if (background) console.error('[workspace] history refetch:', err)
      else historyLoadFailed('Falha ao carregar o histórico da thread.')
    } finally {
      if (mountedRef.current && !background) historyLoadSettled()
      const { coalesced } = historyGateRef.current.finish(signal)
      if (coalesced && mountedRef.current) {
        void loadHistory(threadId, { background: true })
      }
    }
  }, [historyLoadStarted, historyLoadFailed, historyLoaded, historyLoadSettled])

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

  useEffect(() => {
    setFollowups([])
    setFollowupsMessageId(null)
    setFollowupsPending(false)
    setMcpNotices([])
    historyGateRef.current.cancel()
    if (selectedThreadId) {
      // Só o streaming do turno anterior sai de cena; as listas ficam até o histórico chegar.
      threadOpened()
      void loadHistory(selectedThreadId)
      void loadDiffs(selectedThreadId)
    } else {
      threadCleared()
      setDiffs([])
    }
  }, [selectedThreadId, loadHistory, loadDiffs, threadOpened, threadCleared])

  // ── WS stream ────────────────────────────────────────────────────────────

  useThreadStream({
    threadId: selectedThreadId,
    onEvent: handleStreamEvent,
    onResync: resyncThread,
  })

  /**
   * Resync a cada open do socket (o primeiro inclusive).
   *
   * O hub não bufferiza — `emit` é no-op quando ninguém está inscrito —, então o que passou
   * durante uma queda **está perdido**, não atrasado. Reconectar não pode replicar eventos: a
   * única recuperação correta é reler estado. Os três caminhos são idempotentes: o histórico
   * entra por `history_loaded` (merge por id, nunca append), o gate é snapshot por `gateId` e o
   * estado da thread é comparação contra a fonte de verdade.
   *
   * Declaração de função, não `useCallback`, pelo mesmo motivo de `handleStreamEvent`:
   * `useThreadStream` guarda o handler num ref a cada render e só o chama no open, então o
   * closure é sempre o do render corrente — e sem lista de deps não há como reler
   * `selectedProjectId` velho nem esquecer `reconcileSettledTurn` (recriada a cada render).
   */
  function resyncThread(threadId: string, info: { reconnect: boolean }): void {
    // `streamingText` é efêmero e a resposta final já está persistida (o `dispatch.ts` grava
    // antes de assentar o turno). Sem zerar, o parcial da queda ficaria duplicado na frente do
    // texto que volta do histórico. `thread_opened` é exatamente essa transição — só o
    // streaming do turno anterior sai de cena, as listas ficam.
    threadOpened()
    if (
      shouldRefetchHistoryOnResync({
        reconnect: info.reconnect,
        historyFetchInflight: historyGateRef.current.hasInflight,
      })
    ) {
      // `background: true`: refetch disparado por stream nunca liga `historyLoading` nem pinta
      // erro — trocar a árvore por "Carregando…" joga o scroll ao topo. O `HistoryRefetchGate`
      // dentro de `loadHistory` serializa (single-flight + coalesce).
      void loadHistory(threadId, { background: true })
    }
    // Gate perdido na queda: sem o snapshot o card de permissão/pergunta some da tela enquanto
    // o broker segue preso do outro lado.
    void gateApi.refresh(threadId)
    // Estado perdido na queda: sem isto o composer fica em modo ocupado para sempre.
    if (selectedProjectId) void resyncThreadState(threadId, selectedProjectId)
  }

  /**
   * Relê o estado da thread e aplica a decisão de `decideThreadStateResync`.
   *
   * Roda em **todo** open, não só no reconnect: reabrir a thread pela sidebar caía no mesmo
   * buraco, porque a reabertura só dispara `GET /history`, `GET /diffs` e `GET /gate`, e o
   * usuário ficava sem saída além do F5.
   *
   * A leitura vai pela lista do projeto (`GET /api/projects/:id/threads`), a mesma de
   * `loadThreads`: não existe `GET /api/threads/:id`. Best-effort como os outros loaders da
   * sidebar — falha aqui só significa que o próximo evento resolve.
   */
  async function resyncThreadState(threadId: string, projectId: string): Promise<void> {
    const findLocal = (): Thread | undefined =>
      (threadsByProjectRef.current[projectId] ?? []).find((t) => t.id === threadId)
    const stateAtRequest = findLocal()?.state
    try {
      const res = await threadsService.listForProject(projectId)
      if (!mountedRef.current || res.error) return
      const server = res.threads.find((t) => t.id === threadId)
      // Local lido **depois** do GET: o `state.change` (ou a resposta do POST de envio) pode ter
      // chegado com a listagem em voo. Nesse caso a fonte fresca ganha e a listagem é passado —
      // sem esta trava, um turno recém-despachado seria "assentado" por um snapshot pré-envio.
      const local = findLocal()
      if (local?.state !== stateAtRequest) return
      const decision = decideThreadStateResync({
        localState: local?.state,
        serverState: server?.state,
      })
      if (decision.adoptState === null || local === undefined) return
      // Só o `state` entra: a linha local pode carregar edição otimista (accessLevel, título em
      // rename) que a lista do servidor ainda não conhece.
      upsertThreadLocal(projectId, { ...local, state: decision.adoptState })
      if (decision.reconcileSettled) reconcileSettledTurn(threadId)
    } catch {
      // Sem rede o resync é no-op; o reconnect seguinte tenta de novo.
    }
  }

  /**
   * Reconciliação de fim de turno: histórico, diffs, sugestões, fila e teto de consumo.
   *
   * Uma função só porque dois caminhos precisam dela — o `state.change` ao vivo e o resync, que
   * descobre o assentamento relendo o estado quando o evento se perdeu. Duplicar o bloco era
   * garantir que só um dos dois receberia a próxima correção.
   */
  function reconcileSettledTurn(threadId: string): void {
    turnSettled()
    void loadHistory(threadId, { background: true })
    void loadDiffs(threadId)
    void loadFollowups(threadId)
    processQueueIfIdle()
    // Turno concluído grava usage_events novos — reavalia o teto para o banner do composer (spec F25 §3.2).
    if (selectedProjectId) void loadUsageLimitStatus(selectedProjectId)
  }

  function handleStreamEvent(event: StreamEvent): void {
    if (event.type === 'message.delta') {
      appendDelta(event.text)
      return
    }
    if (event.type === 'state.change') {
      applyLiveStreamEvent(event)
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
      if (isSettledThreadState(event.state)) {
        gateApi.clear()
      }
      // Mesmo bloco que o resync roda quando o `state.change` se perde numa queda de socket.
      if (reconcilesTurnEnd(event.state)) {
        reconcileSettledTurn(event.threadId)
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
      applyLiveStreamEvent(event)
      void loadHistory(event.threadId, { background: true })
      return
    }
    if (event.type === 'subagent.start' || event.type === 'subagent.result') {
      // Overlay imediato (F29) + refetch F15 que traz subagentRuns canónicos.
      applyLiveStreamEvent(event)
      void loadHistory(event.threadId, { background: true })
      return
    }
    if (event.type === 'pipeline.state' || event.type === 'pipeline.stage') {
      applyLiveStreamEvent(event)
      void loadHistory(event.threadId, { background: true })
      return
    }
    if (event.type === 'gate.opened') {
      gateApi.applyStreamEvent(event)
      // O gate virou card na timeline: fora da aba Histórico ele não seria visto. Como o overlay
      // antigo flutuava sobre qualquer aba, trazer o usuário de volta ao chat preserva a garantia
      // de que a decisão pendente é sempre alcançável.
      setActiveTab('history')
      // Grant anterior não pode ficar como "Permitir / Executando…" sob o card novo.
      if (event.kind === 'permission') permissionGateOpened()
      return
    }
    if (event.type === 'gate.resolved') {
      gateApi.applyStreamEvent(event)
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
    // Tool negada pela aprovação nativa do CLI: ou sem passar pelo broker (o usuário só via o
    // agente pedindo aprovação em prosa, sem card nenhum), ou depois de o broker conceder, quando
    // outro hook `PreToolUse` nega. `brokerGranted` no evento é quem separa os dois na copy.
    // Vai para a mesma faixa do mcp.notice.
    if (event.type === 'permission.native_denial') {
      setMcpNotices((prev) => appendWorkspaceNotice(prev, nativeDenialNotice(event)))
      return
    }
    // Versão do Claude CLI fora da faixa em que o contrato de permissão foi validado. Chega no
    // máximo uma vez por processo e é só aviso: o turno correu normalmente.
    if (event.type === 'cli.version_notice') {
      setMcpNotices((prev) => appendWorkspaceNotice(prev, cliVersionNotice(event)))
    }
  }

  // ── Actions ──────────────────────────────────────────────────────────────

  // Bolha otimista pertence à thread onde foi digitada — trocar de thread/projeto descarta as
  // pendentes (a fila persiste em localStorage por thread e se rehidrata sozinha). O id da bolha
  // (`addPending`, em `useChatTimeline`) é o `clientMessageId` que viaja no POST e volta em
  // `Message.clientId`: é por ele que a reconciliação casa, e não pelo texto (o servidor reescreve
  // o prompt antes de persistir).
  const selectProject = useCallback((projectId: string | null) => {
    setSelectedProjectId(projectId)
    setSelectedThreadId(null)
    projectSwitched()
    setSendError(null)
  }, [projectSwitched])

  const selectThread = useCallback((threadId: string | null) => {
    setSelectedThreadId(threadId)
    threadSelected()
    clearAttachError()
    setSendError(null)
    setActiveTab('history')
  }, [clearAttachError, threadSelected])

  // Nada foi enviado: os chips de contexto ficam (só texto e imagens saem). `newThread`, ao
  // contrário de `selectThread`, também não zera `attachError` — a assimetria é intencional.
  const newThread = useCallback(() => {
    setSelectedThreadId(null)
    newThreadStarted()
    setSendError(null)
    clearTextAndImages()
  }, [clearTextAndImages, newThreadStarted])

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

  const {
    savedPrompts,
    chatModes,
    libraryError,
    applyChatMode,
    savePromptFromComposer,
    saveChatModeFromComposer,
    deleteSavedPrompt,
    deleteChatMode,
  } = usePromptLibrary({
    projectId: selectedProjectId,
    isNewThread: selectedThreadId === null,
    draft: composer,
    updateDraft,
    mountedRef,
  })

  const gitInitProject = useCallback(async (projectId: string) => {
    const res = await projectsService.gitInit(projectId)
    if (!res.error) void loadVcsStatus(projectId)
    return res
  }, [loadVcsStatus])

  /** Persiste Access na thread imediatamente (não espera o próximo follow-up). */
  const setAccessLevel = useCallback(
    async (accessLevel: ThreadAccessLevel) => {
      updateComposer({ accessLevel })
      if (!selectedThreadId) return
      const res = await threadsService.patchAccess(selectedThreadId, accessLevel)
      if (res.error) {
        setSendError(res.error.message)
        return
      }
      if (selectedProjectId && res.thread) upsertThreadLocal(selectedProjectId, res.thread)
    },
    [selectedThreadId, selectedProjectId, upsertThreadLocal, updateComposer]
  )

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

  // Fila de mensagens do composer (estado + persistência por `queueKey` + despacho no fim do
  // turno). O hook guarda internamente os refs de fila e de envio — o handler de WS roda com o
  // closure do render em que a conexão subiu e leria valores velhos sem eles.
  const { queue, enqueue, dequeue, updateQueueItem, promoteQueueItem, processQueueIfIdle } =
    useMessageQueue({
      queueKey,
      canDispatch: selectedThreadId !== null,
      followUp: sendFollowUp,
    })

  /**
   * Resolve o gate de permissão **em tela**, por `gateId`. Falhou (`res.error` ou throw): o card
   * fica — o broker continua esperando do outro lado, e sumir com o pedido aqui era o sintoma
   * "clique aceito mas permissão não concedida".
   *
   * A falha é do card, e só dele: `gateApi.error` já a mostra no `role="alert"` do
   * `PermissionPrompt`, que é onde a decisão vive e onde o usuário tenta de novo. Copiar a mesma
   * frase para `sendError` pintava dois alertas idênticos na tela, um no card e outro no composer.
   */
  const resolvePermission = useCallback(
    async (
      target: ThreadGate,
      allow: boolean,
      always = false,
      scope: 'thread' | 'project' = 'thread'
    ): Promise<boolean> => {
      const res = await gateApi.resolve(target, {
        kind: 'permission',
        allow,
        always: always || undefined,
        scope: scope === 'project' ? 'project' : undefined,
      })
      return res.ok
    },
    [gateApi]
  )

  /**
   * Clique numa resposta da pergunta do agente: preenche o composer — o envio é o Enviar
   * (resolve permissão / ask_user_question / follow-up conforme o estado).
   */
  const sendDecision = useCallback(
    (text: string) => {
      const value = text.trim()
      if (value === '') return
      updateComposer({ text: value })
    },
    [updateComposer]
  )

  const send = useCallback(async () => {
    const text = composer.text.trim()
    if (text === '') return
    setSendError(null)

    let currentGate = gate

    // waiting_permission sem gate conhecido localmente (WS perdido): snapshot antes de decidir.
    if (selectedThreadId && currentGate === null && selectedThread?.state === 'waiting_permission') {
      const recovered = await gateApi.refresh(selectedThreadId)
      // Snapshot vazio não vira `!`: sem gate a rota abaixo é que decide (permission_blocked).
      currentGate = recovered?.[0] ?? null
    }

    const route = routeComposerSend({
      text,
      threadState: selectedThread?.state,
      gate: currentGate,
      hasSelectedThread: selectedThreadId !== null,
      hasSelectedProject: selectedProjectId !== null,
    })

    if (route.action === 'noop') return

    if (route.action === 'permission_blocked') {
      setSendError(route.message)
      return
    }

    if (route.action === 'resolve_permission') {
      // Sem o gate em mãos o `if` antigo caía nos branches de baixo e o texto virava turno novo
      // em silêncio. Ausência aqui é o mesmo caso do snapshot vazio: erro visível.
      if (currentGate === null || currentGate.kind !== 'permission') {
        setSendError(PERMISSION_PENDING_HINT)
        return
      }
      // Eco local só enquanto o POST voa: a decisão não vira mensagem no banco. Depois do
      // grant a bolha some — promover para `sent` deixava "Executando…" fantasma e o próximo
      // pedido de permissão parecia sobrepor trabalho ainda em curso.
      const pendingId = addPending(text, [], 'permission')
      // Decisão de permissão não é turno: os anexos ficam para a mensagem que vem depois.
      clearTextAndImages()
      const allow =
        route.decision.kind === 'allow' ||
        route.decision.kind === 'allow_always' ||
        route.decision.kind === 'allow_project'
      const always =
        route.decision.kind === 'allow_always' || route.decision.kind === 'allow_project'
      const scope = route.decision.kind === 'allow_project' ? 'project' : 'thread'
      const ok = await resolvePermission(currentGate, allow, always, scope)
      removePending(pendingId)
      if (!ok) return
      return
    }

    // F21: texto no composer (digitado ou opção clicada) responde a ask_user_question —
    // antes caía na fila de follow-up e a pergunta ficava presa.
    if (route.action === 'answer_question') {
      // A rota só existe com gate de pergunta aberto — o `kind` reconfirma para estreitar o tipo.
      if (currentGate === null || currentGate.kind !== 'question') return
      const question = questionFromGate(currentGate)
      const answer = composerAnswerForQuestion(text, question?.options ?? [], question?.multiSelect ?? false)
      const pendingId = addPending(text, [], 'permission')
      clearDraftAfterSend()
      await gateApi.resolve(currentGate, { kind: 'question', ...answer })
      removePending(pendingId)
      // Mesma regra da permissão: a falha aparece no `AskUserQuestionCard` (`gateApi.error`), que
      // continua em tela, e não é repetida no composer.
      return
    }

    // running / waiting_user / waiting_permission (sem gate resolvível) — enfileira.
    if (route.action === 'enqueue') {
      // Sugestões do turno anterior somem na hora: senão ficam sobre "Na fila…" / "Executando…".
      setFollowups([])
      setFollowupsMessageId(null)
      setFollowupsPending(false)
      enqueue(text, composer.images, composer.model, composer.reasoningLevel, composerAttachments)
      clearDraftAfterSend()
      return
    }

    if (!selectedProjectId) return

    if (route.action === 'send_new') {
      const images = composer.images
      const attachments = composerAttachments
      const pendingId = addPending(text, images, 'sending')
      clearDraftAfterSend()
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
    clearDraftAfterSend()
    await sendFollowUp(text, images, composer.model, composer.reasoningLevel, attachments)
  }, [
    composer,
    selectedThread,
    selectedThreadId,
    selectedProjectId,
    gate,
    gateApi,
    enqueue,
    sendFollowUp,
    resolvePermission,
    upsertThreadLocal,
    addPending,
    setPendingStatus,
    removePending,
    composerAttachments,
    clearTextAndImages,
    clearDraftAfterSend,
  ])

  const cancel = useCallback(async () => {
    if (!selectedThreadId) return
    turnCancelled()
    setSendError(null)
    const res = await threadsService.cancel(selectedThreadId)
    if (res.error) {
      setSendError(res.error.message)
    } else if (res.cancelled === false) {
      setSendError('Não foi possível cancelar a execução.')
    }
    void loadHistory(selectedThreadId, { background: true })
  }, [selectedThreadId, loadHistory, turnCancelled])

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
      setFeedbackVote(messageId, next)
      const res = await threadsService.feedback(selectedThreadId, messageId, next)
      if (res.error) setFeedbackVote(messageId, current ?? null)
    },
    [selectedThreadId, feedback, setFeedbackVote]
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
    answerQuestion,
    addProjectModalOpen,
    setAddProjectModalOpen,
    addProject,
    removeProject,
    gitInitProject,
    gate,
    gateQueuedCount: gateApi.queuedCount,
    gateBusy: gateApi.busy,
    gateError: gateApi.error,
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
