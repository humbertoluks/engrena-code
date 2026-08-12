import { formatClock, formatDurationSeconds } from '../chatHistory.logic'
import type { ExecutionEdge, ExecutionNode } from './executionGraph.logic'
import { GRAPH_COPY } from './graphCopy'

export interface MessageInspectorProps {
  edge: ExecutionEdge
  nodesById: Map<string, ExecutionNode>
  onClose: () => void
}

export function MessageInspector({ edge, nodesById, onClose }: MessageInspectorProps) {
  const from = nodesById.get(edge.source)
  const to = nodesById.get(edge.target)
  const durationMs =
    edge.startedAt != null && edge.endedAt != null ? Math.max(0, edge.endedAt - edge.startedAt) : null

  return (
    <aside
      className="flex h-full w-[min(20rem,100%)] flex-col border-l border-border bg-surface"
      aria-label={GRAPH_COPY.inspectorTitle}
    >
      <div className="flex items-center justify-between border-b border-border px-md py-sm">
        <h2 className="text-[13px] font-medium text-fg">{GRAPH_COPY.inspectorTitle}</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label={GRAPH_COPY.inspectorClose}
          className="rounded-md px-sm py-[2px] text-[12px] text-muted hover:bg-surface-2 hover:text-fg focus-visible:ring-2 focus-visible:ring-accent"
        >
          {GRAPH_COPY.inspectorClose}
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-md py-sm text-[12.5px]">
        <dl className="flex flex-col gap-sm">
          <div>
            <dt className="text-[11px] text-muted">{GRAPH_COPY.inspectorFrom}</dt>
            <dd className="text-fg">{from?.label ?? edge.source}</dd>
          </div>
          <div>
            <dt className="text-[11px] text-muted">{GRAPH_COPY.inspectorTo}</dt>
            <dd className="text-fg">{to?.label ?? edge.target}</dd>
          </div>
          <div>
            <dt className="text-[11px] text-muted">{GRAPH_COPY.inspectorStatus}</dt>
            <dd className="text-fg">{GRAPH_COPY.status[edge.status] ?? edge.status}</dd>
          </div>
          <div>
            <dt className="text-[11px] text-muted">{GRAPH_COPY.inspectorStarted}</dt>
            <dd className="font-mono tabular-nums text-fg">{formatClock(edge.startedAt) || '—'}</dd>
          </div>
          <div>
            <dt className="text-[11px] text-muted">{GRAPH_COPY.inspectorDuration}</dt>
            <dd className="font-mono tabular-nums text-fg">
              {durationMs != null ? formatDurationSeconds(durationMs) : '—'}
            </dd>
          </div>
          <div>
            <dt className="text-[11px] text-muted">{GRAPH_COPY.inspectorTask}</dt>
            <dd className="mt-[2px] whitespace-pre-wrap break-words rounded-md border border-border bg-surface-2 px-sm py-xs font-mono text-[11.5px] text-fg">
              {edge.task || '—'}
            </dd>
          </div>
          <div>
            <dt className="text-[11px] text-muted">{GRAPH_COPY.inspectorReturn}</dt>
            <dd className="mt-[2px] whitespace-pre-wrap break-words rounded-md border border-border bg-surface-2 px-sm py-xs font-mono text-[11.5px] text-fg">
              {edge.returnText?.trim() ? edge.returnText : GRAPH_COPY.inspectorEmptyReturn}
            </dd>
          </div>
        </dl>
      </div>
    </aside>
  )
}
