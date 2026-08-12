import { BaseEdge, EdgeLabelRenderer, getBezierPath, type Edge, type EdgeProps } from '@xyflow/react'
import type { ExecutionEdge } from './executionGraph.logic'

export type MessageEdgeData = ExecutionEdge & Record<string, unknown>
export type MessageFlowEdge = Edge<MessageEdgeData, 'message'>

export function MessageEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  markerEnd,
  style,
}: EdgeProps<MessageFlowEdge>) {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  })

  const animated = data?.animated === true && data.kind !== 'return'
  const label = data?.label?.trim() ?? ''
  const pathId = `edge-path-${id}`

  return (
    <>
      <BaseEdge id={id} path={edgePath} markerEnd={markerEnd} style={style} />
      {/* path nomeado para animateMotion — BaseEdge não expõe id estável no DOM do path */}
      <path id={pathId} d={edgePath} fill="none" stroke="transparent" strokeWidth={1} />
      {animated ? (
        <circle r={3.5} className="fill-accent motion-reduce:hidden">
          <animateMotion dur="1.4s" repeatCount="indefinite" path={edgePath} />
        </circle>
      ) : null}
      {label ? (
        <EdgeLabelRenderer>
          <div
            className="nodrag nopan pointer-events-none absolute max-w-[140px] truncate rounded bg-surface-2 px-[6px] py-[1px] text-[10px] text-muted"
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            }}
          >
            {label}
          </div>
        </EdgeLabelRenderer>
      ) : null}
    </>
  )
}
