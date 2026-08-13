import { CALL_SUBAGENT_TOOL_NAME, correlateSubagentRuns } from '../chatHistory.logic'
import type { PipelineHistory, Thread, ThreadState, ToolCall } from '../../../services/threads-service'
import type { SubagentRun, SubagentRunStatus } from '../../../services/subagents-service'
import type { StreamEvent } from '../../../services/ws-client'

// ── Domain types (projeção; React Flow consome depois do layout) ─────────────

export type ExecutionNodeKind = 'root' | 'subagent' | 'stage' | 'batch'

export type ExecutionNodeStatus =
  | 'running'
  | 'completed'
  | 'error'
  | 'timeout'
  | 'idle'
  | 'waiting_user'
  | 'cancelled'
  | 'pending'
  | 'failed'
  | 'skipped'

export type ExecutionEdgeKind = 'delegate' | 'stage' | 'batch-member' | 'return'

export interface ExecutionNode {
  id: string
  kind: ExecutionNodeKind
  label: string
  status: ExecutionNodeStatus
  /** Contador de tools no root; actionCount no subagent; childCount no batch. */
  count: number
  durationMs: number | null
  /** stageId (pipeline) ou parallelBatchId. */
  meta: string | null
  /** childThreadId / pipeline stage row id / batch id — chave estável de domínio. */
  refId: string
}

export interface ExecutionEdge {
  id: string
  source: string
  target: string
  kind: ExecutionEdgeKind
  label: string
  status: ExecutionNodeStatus
  startedAt: number | null
  endedAt: number | null
  task: string
  returnText: string | null
  /** true enquanto o alvo está running — anima a aresta. */
  animated: boolean
}

export interface ExecutionGraph {
  nodes: ExecutionNode[]
  edges: ExecutionEdge[]
}

export interface LayoutPosition {
  x: number
  y: number
}

export interface LaidOutNode extends ExecutionNode {
  position: LayoutPosition
  width: number
  height: number
}

export interface LaidOutGraph {
  nodes: LaidOutNode[]
  edges: ExecutionEdge[]
}

export interface BuildExecutionGraphInput {
  thread: Pick<Thread, 'id' | 'provider' | 'model' | 'state'> | null
  toolCalls: ToolCall[]
  subagentRuns: SubagentRun[]
  pipeline: PipelineHistory | null
  /** Overlay otimista ainda não refletido no history. */
  liveOverlay?: LiveGraphOverlay | null
  nowMs?: number
}

/** Estado derivado só de eventos WS até o refetch de history assentar. */
export interface LiveGraphOverlay {
  rootState: ExecutionNodeStatus | null
  rootToolDelta: number
  /** Runs ainda não presentes (ou desatualizados) em subagentRuns. */
  optimisticRuns: OptimisticSubagentRun[]
  /** Stages otimistas indexados por stageId de domínio. */
  optimisticStages: OptimisticStage[]
}

export interface OptimisticSubagentRun {
  childThreadId: string
  name: string
  status: SubagentRunStatus
  parallelBatchId: string | null
  startedAt: number
  endedAt: number | null
  text: string | null
}

export interface OptimisticStage {
  stageId: string
  index: number
  subagentName: string
  status: ExecutionNodeStatus
  pipelineId: string
}

export const NODE_WIDTH = 220
export const NODE_HEIGHT = 72
const LAYER_GAP_X = 280
const NODE_GAP_Y = 96
const ORIGIN_X = 40
const ORIGIN_Y = 40

export function emptyLiveOverlay(): LiveGraphOverlay {
  return {
    rootState: null,
    rootToolDelta: 0,
    optimisticRuns: [],
    optimisticStages: [],
  }
}

export function rootNodeId(threadId: string): string {
  return `root:${threadId}`
}

export function subagentNodeId(childThreadId: string): string {
  return `subagent:${childThreadId}`
}

export function stageNodeId(stageRowId: string): string {
  return `stage:${stageRowId}`
}

export function batchNodeId(parallelBatchId: string): string {
  return `batch:${parallelBatchId}`
}

function mapThreadState(state: ThreadState | string | null | undefined): ExecutionNodeStatus {
  switch (state) {
    case 'running':
    case 'stopping':
      return 'running'
    case 'waiting_user':
    case 'waiting_permission':
      return 'waiting_user'
    case 'error':
      return 'error'
    case 'cancelled':
      return 'cancelled'
    case 'idle':
    case 'committed':
      return 'idle'
    default:
      return 'idle'
  }
}

function mapRunStatus(status: string | null | undefined): ExecutionNodeStatus {
  switch (status) {
    case 'running':
      return 'running'
    case 'completed':
      return 'completed'
    case 'error':
      return 'error'
    case 'timeout':
      return 'timeout'
    case 'cancelled':
      return 'cancelled'
    case 'pending':
      return 'pending'
    case 'failed':
      return 'failed'
    case 'skipped':
      return 'skipped'
    default:
      return 'idle'
  }
}

function extractTask(params: unknown): string {
  if (params !== null && typeof params === 'object' && !Array.isArray(params)) {
    const p = params as Record<string, unknown>
    if (typeof p.task === 'string' && p.task.trim()) return p.task.trim()
    if (typeof p.prompt === 'string' && p.prompt.trim()) return p.prompt.trim()
  }
  return ''
}

function truncateLabel(text: string, max = 42): string {
  const oneLine = text.replace(/\s+/g, ' ').trim()
  if (oneLine.length <= max) return oneLine
  return `${oneLine.slice(0, max - 1)}…`
}

function rootLabel(thread: Pick<Thread, 'provider' | 'model'>): string {
  const model = thread.model?.trim()
  if (model) return `${thread.provider} · ${model}`
  return thread.provider || 'Agente'
}

function mergeRuns(persisted: SubagentRun[], optimistic: OptimisticSubagentRun[]): SubagentRun[] {
  const byId = new Map<string, SubagentRun>()
  for (const run of persisted) byId.set(run.childThreadId, run)
  for (const opt of optimistic) {
    const existing = byId.get(opt.childThreadId)
    if (!existing) {
      byId.set(opt.childThreadId, {
        childThreadId: opt.childThreadId,
        parentThreadId: '',
        parentToolCallId: null,
        subagentName: opt.name,
        provider: 'claude',
        model: null,
        status: opt.status,
        text: opt.text,
        durationMs: opt.endedAt != null ? Math.max(0, opt.endedAt - opt.startedAt) : null,
        reasoningLevel: null,
        actionCount: 0,
        parallelBatchId: opt.parallelBatchId,
        createdAt: opt.startedAt,
      })
      continue
    }
    // Overlay só sobrescreve status/text se o history ainda não fechou o run.
    if (existing.status === 'running' || opt.status !== 'running') {
      byId.set(opt.childThreadId, {
        ...existing,
        status: opt.status,
        text: opt.text ?? existing.text,
        parallelBatchId: opt.parallelBatchId ?? existing.parallelBatchId,
        durationMs:
          opt.endedAt != null
            ? Math.max(0, opt.endedAt - opt.startedAt)
            : existing.durationMs,
      })
    }
  }
  return [...byId.values()].sort((a, b) => a.createdAt - b.createdAt)
}

/**
 * Constrói o grafo de execução a partir do history + overlay live.
 * Nós = agentes/stages/batches; tools comuns viram contador no root.
 */
export function buildExecutionGraph(input: BuildExecutionGraphInput): ExecutionGraph {
  const { thread, toolCalls, pipeline, liveOverlay } = input
  if (!thread) return { nodes: [], edges: [] }

  const overlay = liveOverlay ?? emptyLiveOverlay()
  const nowMs = input.nowMs ?? Date.now()
  const runs = mergeRuns(input.subagentRuns, overlay.optimisticRuns)
  const runByToolCallId = correlateSubagentRuns(toolCalls, runs)
  const toolById = new Map(toolCalls.map((t) => [t.id, t]))

  const regularToolCount =
    toolCalls.filter((t) => t.name !== CALL_SUBAGENT_TOOL_NAME).length + overlay.rootToolDelta

  const nodes: ExecutionNode[] = []
  const edges: ExecutionEdge[] = []
  const nodeIds = new Set<string>()

  const rootId = rootNodeId(thread.id)
  nodes.push({
    id: rootId,
    kind: 'root',
    label: rootLabel(thread),
    status: overlay.rootState ?? mapThreadState(thread.state),
    count: Math.max(0, regularToolCount),
    durationMs: null,
    meta: null,
    refId: thread.id,
  })
  nodeIds.add(rootId)

  // Batches (F18): um nó por parallelBatchId com ≥2 filhos (ou 1 ainda running no batch).
  const batchMembers = new Map<string, SubagentRun[]>()
  for (const run of runs) {
    if (!run.parallelBatchId) continue
    const list = batchMembers.get(run.parallelBatchId) ?? []
    list.push(run)
    batchMembers.set(run.parallelBatchId, list)
  }

  const runIdsInBatchEdge = new Set<string>()

  for (const [batchId, members] of batchMembers) {
    if (members.length < 1) continue
    const bId = batchNodeId(batchId)
    const anyRunning = members.some((m) => m.status === 'running')
    const anyError = members.some((m) => m.status === 'error' || m.status === 'timeout')
    const allDone = members.every((m) => m.status !== 'running')
    const status: ExecutionNodeStatus = anyRunning
      ? 'running'
      : anyError
        ? members.some((m) => m.status === 'timeout')
          ? 'timeout'
          : 'error'
        : allDone
          ? 'completed'
          : 'idle'
    nodes.push({
      id: bId,
      kind: 'batch',
      label: 'Batch',
      status,
      count: members.length,
      durationMs: null,
      meta: batchId,
      refId: batchId,
    })
    nodeIds.add(bId)
    edges.push({
      id: `edge:root-batch:${batchId}`,
      source: rootId,
      target: bId,
      kind: 'delegate',
      label: `${members.length} tasks`,
      status,
      startedAt: Math.min(...members.map((m) => m.createdAt)),
      endedAt: allDone
        ? Math.max(...members.map((m) => (m.durationMs != null ? m.createdAt + m.durationMs : m.createdAt)))
        : null,
      task: `${members.length} tasks em paralelo`,
      returnText: null,
      animated: anyRunning,
    })
    for (const member of members) {
      const sId = subagentNodeId(member.childThreadId)
      if (!nodeIds.has(sId)) {
        nodes.push(subagentNodeFromRun(member))
        nodeIds.add(sId)
      }
      edges.push({
        id: `edge:batch-member:${member.childThreadId}`,
        source: bId,
        target: sId,
        kind: 'batch-member',
        label: member.subagentName,
        status: mapRunStatus(member.status),
        startedAt: member.createdAt,
        endedAt: member.durationMs != null ? member.createdAt + member.durationMs : null,
        task: member.subagentName,
        returnText: member.text,
        animated: member.status === 'running',
      })
      runIdsInBatchEdge.add(member.childThreadId)
    }
  }

  // Pipeline stages (F22)
  const stages = pipeline?.stages ?? []
  const optimisticStages = overlay.optimisticStages
  const stageByDomainId = new Map<string, { rowId: string; stageId: string; subagentName: string; status: ExecutionNodeStatus; subagentRunId: string | null; startedAt: number | null; finishedAt: number | null; index: number }>()

  for (const stage of stages) {
    stageByDomainId.set(stage.stageId, {
      rowId: stage.id,
      stageId: stage.stageId,
      subagentName: stage.subagentName,
      status: mapRunStatus(stage.status),
      subagentRunId: stage.subagentRunId,
      startedAt: stage.startedAt,
      finishedAt: stage.finishedAt,
      index: stage.stageIndex,
    })
  }
  for (const opt of optimisticStages) {
    const existing = stageByDomainId.get(opt.stageId)
    if (existing) {
      stageByDomainId.set(opt.stageId, { ...existing, status: opt.status, subagentName: opt.subagentName })
    } else {
      stageByDomainId.set(opt.stageId, {
        rowId: `opt:${opt.stageId}`,
        stageId: opt.stageId,
        subagentName: opt.subagentName,
        status: opt.status,
        subagentRunId: null,
        startedAt: nowMs,
        finishedAt: null,
        index: opt.index,
      })
    }
  }

  const sortedStages = [...stageByDomainId.values()].sort((a, b) => a.index - b.index)
  for (const stage of sortedStages) {
    const sId = stageNodeId(stage.rowId)
    if (!nodeIds.has(sId)) {
      nodes.push({
        id: sId,
        kind: 'stage',
        label: stage.subagentName,
        status: stage.status,
        count: 0,
        durationMs:
          stage.startedAt != null && stage.finishedAt != null
            ? Math.max(0, stage.finishedAt - stage.startedAt)
            : null,
        meta: stage.stageId,
        refId: stage.rowId,
      })
      nodeIds.add(sId)
    }
    edges.push({
      id: `edge:root-stage:${stage.rowId}`,
      source: rootId,
      target: sId,
      kind: 'stage',
      label: stage.stageId,
      status: stage.status,
      startedAt: stage.startedAt,
      endedAt: stage.finishedAt,
      task: stage.stageId,
      returnText: null,
      animated: stage.status === 'running',
    })

    if (stage.subagentRunId) {
      const linked = runs.find((r) => r.childThreadId === stage.subagentRunId)
      if (linked) {
        const childId = subagentNodeId(linked.childThreadId)
        if (!nodeIds.has(childId)) {
          nodes.push(subagentNodeFromRun(linked))
          nodeIds.add(childId)
        }
        edges.push({
          id: `edge:stage-run:${stage.rowId}:${linked.childThreadId}`,
          source: sId,
          target: childId,
          kind: 'delegate',
          label: truncateLabel(linked.subagentName),
          status: mapRunStatus(linked.status),
          startedAt: linked.createdAt,
          endedAt: linked.durationMs != null ? linked.createdAt + linked.durationMs : null,
          task: linked.subagentName,
          returnText: linked.text,
          animated: linked.status === 'running',
        })
        runIdsInBatchEdge.add(linked.childThreadId)
      }
    }
  }

  // Subagents seriais (F15) — não ligados a batch nem já renderizados via stage.
  const callTools = toolCalls.filter((t) => t.name === CALL_SUBAGENT_TOOL_NAME)
  const matchedRunIds = new Set<string>()

  for (const tool of callTools) {
    const run = runByToolCallId.get(tool.id)
    if (!run) continue
    matchedRunIds.add(run.childThreadId)
    if (runIdsInBatchEdge.has(run.childThreadId)) continue
    if (run.parallelBatchId && batchMembers.has(run.parallelBatchId)) continue

    const sId = subagentNodeId(run.childThreadId)
    if (!nodeIds.has(sId)) {
      nodes.push(subagentNodeFromRun(run))
      nodeIds.add(sId)
    }
    const task = extractTask(tool.params) || run.subagentName
    edges.push({
      id: `edge:delegate:${tool.id}:${run.childThreadId}`,
      source: rootId,
      target: sId,
      kind: 'delegate',
      label: truncateLabel(task),
      status: mapRunStatus(run.status),
      startedAt: tool.startedAt,
      endedAt: tool.endedAt ?? (run.durationMs != null ? run.createdAt + run.durationMs : null),
      task,
      returnText: run.text,
      animated: run.status === 'running',
    })
    if (run.status !== 'running' && run.text) {
      edges.push({
        id: `edge:return:${run.childThreadId}`,
        source: sId,
        target: rootId,
        kind: 'return',
        label: '',
        status: mapRunStatus(run.status),
        startedAt: tool.endedAt,
        endedAt: tool.endedAt,
        task,
        returnText: run.text,
        animated: false,
      })
    }
  }

  // Runs órfãos (sem tool call correlacionada — típico overlay ou pipeline sem parentToolCallId)
  for (const run of runs) {
    if (matchedRunIds.has(run.childThreadId)) continue
    if (runIdsInBatchEdge.has(run.childThreadId)) continue
    if (run.parallelBatchId && batchMembers.has(run.parallelBatchId)) continue

    const sId = subagentNodeId(run.childThreadId)
    if (!nodeIds.has(sId)) {
      nodes.push(subagentNodeFromRun(run))
      nodeIds.add(sId)
    }
    edges.push({
      id: `edge:delegate-orphan:${run.childThreadId}`,
      source: rootId,
      target: sId,
      kind: 'delegate',
      label: truncateLabel(run.subagentName),
      status: mapRunStatus(run.status),
      startedAt: run.createdAt,
      endedAt: run.durationMs != null ? run.createdAt + run.durationMs : null,
      task: run.subagentName,
      returnText: run.text,
      animated: run.status === 'running',
    })
  }

  // Silencia unused — toolById reservado se quisermos enriquecer depois
  void toolById

  return { nodes, edges }
}

function subagentNodeFromRun(run: SubagentRun): ExecutionNode {
  return {
    id: subagentNodeId(run.childThreadId),
    kind: 'subagent',
    label: run.subagentName,
    status: mapRunStatus(run.status),
    count: run.actionCount,
    durationMs: run.durationMs,
    meta: run.parallelBatchId,
    refId: run.childThreadId,
  }
}

/**
 * Reducer puro do overlay otimista a partir de um StreamEvent.
 * Devolve o mesmo objeto se o evento não afeta o grafo.
 */
export function applyLiveEvent(overlay: LiveGraphOverlay, event: StreamEvent, nowMs = Date.now()): LiveGraphOverlay {
  switch (event.type) {
    case 'state.change':
      return { ...overlay, rootState: mapThreadState(event.state) }

    case 'tool_call.start': {
      if (event.name === CALL_SUBAGENT_TOOL_NAME) return overlay
      return { ...overlay, rootToolDelta: overlay.rootToolDelta + 1 }
    }

    case 'subagent.start': {
      const existing = overlay.optimisticRuns.filter((r) => r.childThreadId !== event.childThreadId)
      return {
        ...overlay,
        optimisticRuns: [
          ...existing,
          {
            childThreadId: event.childThreadId,
            name: event.name,
            status: 'running',
            parallelBatchId: event.parallelBatchId ?? null,
            startedAt: nowMs,
            endedAt: null,
            text: null,
          },
        ],
      }
    }

    case 'subagent.result': {
      const mapped = mapRunStatus(event.status)
      const status: SubagentRunStatus =
        mapped === 'running' ||
        mapped === 'completed' ||
        mapped === 'error' ||
        mapped === 'timeout' ||
        mapped === 'cancelled'
          ? mapped
          : 'completed'
      const existing = overlay.optimisticRuns.find((r) => r.childThreadId === event.childThreadId)
      const others = overlay.optimisticRuns.filter((r) => r.childThreadId !== event.childThreadId)
      return {
        ...overlay,
        optimisticRuns: [
          ...others,
          {
            childThreadId: event.childThreadId,
            name: existing?.name ?? 'subagent',
            status,
            parallelBatchId: event.parallelBatchId ?? existing?.parallelBatchId ?? null,
            startedAt: existing?.startedAt ?? nowMs,
            endedAt: nowMs,
            text: existing?.text ?? null,
          },
        ],
      }
    }

    case 'pipeline.stage': {
      const status = mapRunStatus(event.status)
      const others = overlay.optimisticStages.filter((s) => s.stageId !== event.stageId)
      return {
        ...overlay,
        optimisticStages: [
          ...others,
          {
            stageId: event.stageId,
            index: event.index,
            subagentName: event.subagentName,
            status,
            pipelineId: event.pipelineId,
          },
        ],
      }
    }

    case 'pipeline.state':
      return overlay

    default:
      return overlay
  }
}

/**
 * Layout em camadas LTR: root (col 0) → batch/stage (col 1) → subagent (col 2).
 * Subagents ligados direto ao root ficam na coluna 1.
 */
export function layoutExecutionGraph(graph: ExecutionGraph): LaidOutGraph {
  if (graph.nodes.length === 0) return { nodes: [], edges: graph.edges }

  const byId = new Map(graph.nodes.map((n) => [n.id, n]))
  const column = new Map<string, number>()

  for (const n of graph.nodes) {
    if (n.kind === 'root') column.set(n.id, 0)
  }

  // Propagação simples pelas arestas (exceto return)
  let changed = true
  let guard = 0
  while (changed && guard < 20) {
    changed = false
    guard++
    for (const e of graph.edges) {
      if (e.kind === 'return') continue
      const srcCol = column.get(e.source)
      if (srcCol === undefined) continue
      const next = srcCol + 1
      const cur = column.get(e.target)
      if (cur === undefined || next > cur) {
        column.set(e.target, next)
        changed = true
      }
    }
  }

  for (const n of graph.nodes) {
    if (!column.has(n.id)) column.set(n.id, n.kind === 'root' ? 0 : 1)
  }

  const columns = new Map<number, string[]>()
  for (const [id, col] of column) {
    const list = columns.get(col) ?? []
    list.push(id)
    columns.set(col, list)
  }

  // Ordena cada coluna por kind (batch/stage antes de subagent) e label
  const kindOrder: Record<ExecutionNodeKind, number> = { root: 0, batch: 1, stage: 2, subagent: 3 }
  for (const [col, ids] of columns) {
    ids.sort((a, b) => {
      const na = byId.get(a)!
      const nb = byId.get(b)!
      const ko = kindOrder[na.kind] - kindOrder[nb.kind]
      if (ko !== 0) return ko
      return na.label.localeCompare(nb.label)
    })
    columns.set(col, ids)
  }

  const laid: LaidOutNode[] = []
  for (const [col, ids] of [...columns.entries()].sort((a, b) => a[0] - b[0])) {
    ids.forEach((id, row) => {
      const n = byId.get(id)!
      laid.push({
        ...n,
        width: NODE_WIDTH,
        height: NODE_HEIGHT,
        position: {
          x: ORIGIN_X + col * LAYER_GAP_X,
          y: ORIGIN_Y + row * NODE_GAP_Y,
        },
      })
    })
  }

  return { nodes: laid, edges: graph.edges }
}
