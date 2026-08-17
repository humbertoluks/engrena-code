import type { Node, NodeProps } from '@xyflow/react'
import { Handle, Position } from '@xyflow/react'
import { StatusDot, type DotVariant } from '@engrena/ui'
import { activityLabelForTool, formatDurationSeconds } from '../chatHistory.logic'
import type { ExecutionNode, ExecutionNodeKind, ExecutionNodeStatus } from './executionGraph.logic'
import { GRAPH_COPY } from './graphCopy'

export type AgentNodeData = ExecutionNode & Record<string, unknown>
export type AgentFlowNode = Node<AgentNodeData, 'agent'>

function statusDot(status: ExecutionNodeStatus): DotVariant {
  switch (status) {
    case 'running':
      return 'ok' // accent-like; StatusDot ok = green — running usa ring CSS abaixo
    case 'completed':
      return 'ok'
    case 'timeout':
    case 'waiting_user':
    case 'pending':
      return 'warn'
    case 'error':
    case 'failed':
    case 'cancelled':
      return 'error'
    default:
      return 'unknown'
  }
}

function kindBadge(kind: ExecutionNodeKind): string | null {
  if (kind === 'stage') return GRAPH_COPY.nodeStage
  if (kind === 'batch') return GRAPH_COPY.nodeBatch
  return null
}

function metaLine(data: AgentNodeData): string {
  if (data.kind === 'root') return GRAPH_COPY.metaTools(data.count)
  if (data.kind === 'batch') return `${data.count} filhos`
  if (data.kind === 'subagent') return GRAPH_COPY.metaActions(data.count)
  if (data.meta) return data.meta
  return ''
}

export function AgentNode({ data, selected }: NodeProps<AgentFlowNode>) {
  const badge = kindBadge(data.kind)
  const meta = metaLine(data)
  const duration =
    data.durationMs != null && data.durationMs >= 0 ? formatDurationSeconds(data.durationMs) : null
  const running = data.status === 'running'
  // F29: enquanto o filho roda, o status genérico dá lugar ao que ele faz agora. Rótulo derivado
  // (`activityLabelForTool`), como no shimmer do pai — o nome cru da tool não é copy de UI.
  const activeLabel = running && data.activeTool ? `${activityLabelForTool(data.activeTool)}…` : null

  return (
    <div
      className={`min-w-[200px] max-w-[220px] rounded-lg border bg-surface px-sm py-xs shadow-sm ${
        selected ? 'border-accent' : 'border-border'
      } ${running ? 'ring-1 ring-accent/40' : ''}`}
    >
      <Handle type="target" position={Position.Left} className="!h-2 !w-2 !border-border !bg-surface-2" />
      <div className="flex items-start gap-xs">
        <span className="mt-[3px]">
          {running ? (
            <span
              className="inline-block h-[9px] w-[9px] flex-shrink-0 animate-pulse rounded-[3px] bg-accent motion-reduce:animate-none"
              aria-hidden
            />
          ) : (
            <StatusDot variant={statusDot(data.status)} />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-xs">
            {badge ? (
              <span className="rounded bg-accent/15 px-[5px] text-[10px] font-medium text-accent">{badge}</span>
            ) : null}
            <span className="truncate text-[12.5px] font-medium text-fg" title={data.label}>
              {data.label || GRAPH_COPY.nodeRoot}
            </span>
          </div>
          <div className="mt-[2px] flex items-center gap-sm text-[11px] text-muted">
            <span>{activeLabel ?? GRAPH_COPY.status[data.status] ?? data.status}</span>
            {meta ? <span className="truncate">{meta}</span> : null}
            {duration ? <span className="font-mono tabular-nums">{duration}</span> : null}
          </div>
        </div>
      </div>
      <Handle type="source" position={Position.Right} className="!h-2 !w-2 !border-border !bg-surface-2" />
    </div>
  )
}
