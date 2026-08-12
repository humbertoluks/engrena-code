import { useEffect, useMemo, useState } from 'react'
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  type EdgeTypes,
  type NodeTypes,
} from '@xyflow/react'
import { useTheme } from '@engrena/ui'
import type { PipelineHistory, Thread, ToolCall } from '../../../services/threads-service'
import type { SubagentRun } from '../../../services/subagents-service'
import {
  buildExecutionGraph,
  layoutExecutionGraph,
  type ExecutionEdge,
  type ExecutionNode,
  type LiveGraphOverlay,
} from './executionGraph.logic'
import { AgentNode, type AgentFlowNode } from './AgentNode'
import { MessageEdge, type MessageFlowEdge } from './MessageEdge'
import { MessageInspector } from './MessageInspector'
import { GRAPH_COPY } from './graphCopy'

const nodeTypes = { agent: AgentNode } as NodeTypes
const edgeTypes = { message: MessageEdge } as EdgeTypes

export interface ExecutionGraphPanelProps {
  thread: Pick<Thread, 'id' | 'provider' | 'model' | 'state'> | null
  toolCalls: ToolCall[]
  subagentRuns: SubagentRun[]
  pipeline: PipelineHistory | null
  liveOverlay: LiveGraphOverlay
}

function ExecutionGraphCanvas({
  thread,
  toolCalls,
  subagentRuns,
  pipeline,
  liveOverlay,
}: ExecutionGraphPanelProps) {
  const { resolvedTheme } = useTheme()
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null)

  const laid = useMemo(() => {
    const graph = buildExecutionGraph({
      thread,
      toolCalls,
      subagentRuns,
      pipeline,
      liveOverlay,
    })
    return layoutExecutionGraph(graph)
  }, [thread, toolCalls, subagentRuns, pipeline, liveOverlay])

  const nodesById = useMemo(() => {
    const map = new Map<string, ExecutionNode>()
    for (const n of laid.nodes) map.set(n.id, n)
    return map
  }, [laid.nodes])

  const edgesById = useMemo(() => {
    const map = new Map<string, ExecutionEdge>()
    for (const e of laid.edges) map.set(e.id, e)
    return map
  }, [laid.edges])

  const flowNodes: AgentFlowNode[] = useMemo(
    () =>
      laid.nodes.map((n) => ({
        id: n.id,
        type: 'agent',
        position: n.position,
        data: { ...n },
        draggable: false,
        selectable: true,
      })),
    [laid.nodes]
  )

  const flowEdges: MessageFlowEdge[] = useMemo(
    () =>
      laid.edges
        .filter((e) => e.kind !== 'return')
        .map((e) => ({
          id: e.id,
          type: 'message',
          source: e.source,
          target: e.target,
          data: { ...e },
          selectable: true,
          focusable: true,
        })),
    [laid.edges]
  )

  useEffect(() => {
    if (selectedEdgeId && !edgesById.has(selectedEdgeId)) setSelectedEdgeId(null)
  }, [selectedEdgeId, edgesById])

  if (!thread) {
    return (
      <div className="flex h-full items-center justify-center px-md text-[13px] text-muted">
        {GRAPH_COPY.emptyNoThread}
      </div>
    )
  }

  const onlyRoot = laid.nodes.length <= 1
  const selectedEdge = selectedEdgeId ? (edgesById.get(selectedEdgeId) ?? null) : null

  return (
    <div className="flex h-full min-h-0">
      <div className="relative min-h-0 min-w-0 flex-1">
        {onlyRoot ? (
          <p className="pointer-events-none absolute inset-x-0 top-md z-10 text-center text-[13px] text-muted">
            {GRAPH_COPY.emptyIdle}
          </p>
        ) : null}
        <ReactFlow
          nodes={flowNodes}
          edges={flowEdges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          colorMode={resolvedTheme}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          minZoom={0.4}
          maxZoom={1.6}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable
          proOptions={{ hideAttribution: true }}
          onEdgeClick={(_event, edge) => setSelectedEdgeId(edge.id)}
          onPaneClick={() => setSelectedEdgeId(null)}
        >
          <Background gap={18} size={1} />
          <Controls showInteractive={false} />
          <MiniMap pannable zoomable className="!bg-surface-2" />
        </ReactFlow>
      </div>
      {selectedEdge ? (
        <MessageInspector edge={selectedEdge} nodesById={nodesById} onClose={() => setSelectedEdgeId(null)} />
      ) : null}
    </div>
  )
}

/** Painel da aba Grafo — exige ReactFlowProvider no boundary do lazy load. */
export function ExecutionGraphPanel(props: ExecutionGraphPanelProps) {
  return (
    <ReactFlowProvider>
      <ExecutionGraphCanvas {...props} />
    </ReactFlowProvider>
  )
}

export default ExecutionGraphPanel
