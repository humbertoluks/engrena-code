import { describe, expect, it } from 'vitest'
import { CALL_SUBAGENT_TOOL_NAME } from '../chatHistory.logic'
import {
  applyLiveEvent,
  batchNodeId,
  buildExecutionGraph,
  emptyLiveOverlay,
  layoutExecutionGraph,
  rootNodeId,
  stageNodeId,
  subagentNodeId,
  type LiveGraphOverlay,
} from './executionGraph.logic'
import type { PipelineHistory, ToolCall, Thread } from '../../../services/threads-service'
import type { SubagentRun } from '../../../services/subagents-service'
import type { StreamEvent } from '../../../services/ws-client'

function thread(partial: Partial<Thread> = {}): Pick<Thread, 'id' | 'provider' | 'model' | 'state'> {
  return {
    id: 'thr_1',
    provider: 'claude',
    model: 'claude-sonnet-4-6',
    state: 'idle',
    ...partial,
  }
}

function tool(partial: Partial<ToolCall> & Pick<ToolCall, 'id' | 'name' | 'seq'>): ToolCall {
  return {
    threadId: 'thr_1',
    messageId: null,
    params: null,
    status: 'completed',
    result: null,
    startedAt: 1000,
    endedAt: 2000,
    ...partial,
  }
}

function run(partial: Partial<SubagentRun> & Pick<SubagentRun, 'childThreadId'>): SubagentRun {
  return {
    parentThreadId: 'thr_1',
    parentToolCallId: null,
    subagentName: 'reviewer',
    provider: 'claude',
    model: null,
    status: 'completed',
    text: 'ok',
    durationMs: 500,
    reasoningLevel: null,
    actionCount: 3,
    parallelBatchId: null,
    createdAt: 1000,
    ...partial,
  }
}

describe('buildExecutionGraph', () => {
  it('returns empty graph without thread', () => {
    const g = buildExecutionGraph({ thread: null, toolCalls: [], subagentRuns: [], pipeline: null })
    expect(g.nodes).toEqual([])
    expect(g.edges).toEqual([])
  })

  it('builds root-only graph and counts non-delegate tools', () => {
    const g = buildExecutionGraph({
      thread: thread({ state: 'running' }),
      toolCalls: [
        tool({ id: 't1', name: 'Bash', seq: 1 }),
        tool({ id: 't2', name: 'Read', seq: 2 }),
        tool({ id: 't3', name: CALL_SUBAGENT_TOOL_NAME, seq: 3, params: { task: 'revisar' } }),
      ],
      subagentRuns: [],
      pipeline: null,
    })
    expect(g.nodes).toHaveLength(1)
    expect(g.nodes[0].id).toBe(rootNodeId('thr_1'))
    expect(g.nodes[0].status).toBe('running')
    expect(g.nodes[0].count).toBe(2)
    expect(g.nodes[0].label).toContain('claude')
  })

  it('maps thread state waiting_permission to the waiting_user root status', () => {
    const g = buildExecutionGraph({
      thread: thread({ state: 'waiting_permission' }),
      toolCalls: [tool({ id: 't1', name: 'Bash', seq: 1, status: 'running', endedAt: null })],
      subagentRuns: [],
      pipeline: null,
    })
    expect(g.nodes).toHaveLength(1)
    expect(g.nodes[0].id).toBe(rootNodeId('thr_1'))
    expect(g.nodes[0].status).toBe('waiting_user')
  })

  it('links root → subagent via correlateSubagentRuns and task label', () => {
    const g = buildExecutionGraph({
      thread: thread(),
      toolCalls: [
        tool({
          id: 'tc_a',
          name: CALL_SUBAGENT_TOOL_NAME,
          seq: 1,
          params: { name: 'reviewer', task: 'Revisar o diff do login' },
          status: 'completed',
        }),
      ],
      subagentRuns: [run({ childThreadId: 'child_1', parentToolCallId: 'tc_a', status: 'completed' })],
      pipeline: null,
    })
    expect(g.nodes.map((n) => n.kind).sort()).toEqual(['root', 'subagent'])
    const edge = g.edges.find((e) => e.kind === 'delegate')
    expect(edge?.source).toBe(rootNodeId('thr_1'))
    expect(edge?.target).toBe(subagentNodeId('child_1'))
    expect(edge?.task).toContain('login')
    expect(edge?.animated).toBe(false)
    expect(g.edges.some((e) => e.kind === 'return')).toBe(true)
  })

  it('animates delegate edge while subagent is running', () => {
    const g = buildExecutionGraph({
      thread: thread({ state: 'running' }),
      toolCalls: [tool({ id: 'tc_a', name: CALL_SUBAGENT_TOOL_NAME, seq: 1, params: { task: 'go' }, status: 'running', endedAt: null })],
      subagentRuns: [run({ childThreadId: 'child_1', parentToolCallId: 'tc_a', status: 'running', text: null, durationMs: null })],
      pipeline: null,
    })
    const edge = g.edges.find((e) => e.kind === 'delegate')
    expect(edge?.animated).toBe(true)
  })

  it('groups parallel batch members under a batch node', () => {
    const batchId = 'batch-uuid'
    const g = buildExecutionGraph({
      thread: thread({ state: 'running' }),
      toolCalls: [],
      subagentRuns: [
        run({ childThreadId: 'c1', subagentName: 'impl-a', parallelBatchId: batchId, status: 'running', text: null }),
        run({ childThreadId: 'c2', subagentName: 'impl-b', parallelBatchId: batchId, status: 'running', text: null }),
      ],
      pipeline: null,
    })
    expect(g.nodes.some((n) => n.id === batchNodeId(batchId))).toBe(true)
    expect(g.edges.some((e) => e.target === batchNodeId(batchId))).toBe(true)
    expect(g.edges.filter((e) => e.kind === 'batch-member')).toHaveLength(2)
  })

  it('builds pipeline stage nodes and links stage → run when subagentRunId set', () => {
    const pipeline: PipelineHistory = {
      pipeline: {
        id: 'pipe_1',
        threadId: 'thr_1',
        projectId: 'proj_1',
        command: 'spec',
        status: 'completed',
        argsText: 'X',
        startedAt: 1,
        finishedAt: 2,
        errorCode: null,
        errorMessage: null,
      },
      stages: [
        {
          id: 'row_1',
          pipelineId: 'pipe_1',
          stageId: 'planner',
          stageIndex: 0,
          subagentName: 'planner',
          status: 'completed',
          subagentRunId: 'child_p',
          startedAt: 1,
          finishedAt: 2,
        },
      ],
    }
    const g = buildExecutionGraph({
      thread: thread(),
      toolCalls: [],
      subagentRuns: [run({ childThreadId: 'child_p', subagentName: 'planner', parentToolCallId: null })],
      pipeline,
    })
    expect(g.nodes.some((n) => n.id === stageNodeId('row_1'))).toBe(true)
    expect(g.edges.some((e) => e.source === stageNodeId('row_1') && e.target === subagentNodeId('child_p'))).toBe(true)
  })

  it('merges optimistic overlay runs before history settles', () => {
    const overlay: LiveGraphOverlay = {
      ...emptyLiveOverlay(),
      optimisticRuns: [
        {
          childThreadId: 'opt_1',
          name: 'explorer',
          status: 'running',
          parallelBatchId: null,
          startedAt: 50,
          endedAt: null,
          text: null,
        },
      ],
    }
    const g = buildExecutionGraph({
      thread: thread({ state: 'running' }),
      toolCalls: [],
      subagentRuns: [],
      pipeline: null,
      liveOverlay: overlay,
    })
    expect(g.nodes.some((n) => n.id === subagentNodeId('opt_1'))).toBe(true)
    expect(g.edges.some((e) => e.animated && e.target === subagentNodeId('opt_1'))).toBe(true)
  })
})

describe('applyLiveEvent', () => {
  it('adds optimistic run on subagent.start', () => {
    const next = applyLiveEvent(emptyLiveOverlay(), {
      type: 'subagent.start',
      threadId: 'thr_1',
      childThreadId: 'c1',
      name: 'reviewer',
      parallelBatchId: 'b1',
    } as StreamEvent)
    expect(next.optimisticRuns).toHaveLength(1)
    expect(next.optimisticRuns[0].status).toBe('running')
    expect(next.optimisticRuns[0].parallelBatchId).toBe('b1')
  })

  it('updates status on subagent.result', () => {
    const base = applyLiveEvent(emptyLiveOverlay(), {
      type: 'subagent.start',
      threadId: 'thr_1',
      childThreadId: 'c1',
      name: 'reviewer',
    } as StreamEvent)
    const next = applyLiveEvent(base, {
      type: 'subagent.result',
      threadId: 'thr_1',
      childThreadId: 'c1',
      status: 'completed',
    } as StreamEvent)
    expect(next.optimisticRuns[0].status).toBe('completed')
    expect(next.optimisticRuns[0].endedAt).not.toBeNull()
  })

  it('increments root tool delta for non-delegate tools', () => {
    const next = applyLiveEvent(emptyLiveOverlay(), {
      type: 'tool_call.start',
      threadId: 'thr_1',
      id: 't1',
      name: 'Bash',
      params: {},
    })
    expect(next.rootToolDelta).toBe(1)
  })

  it('overlays rootState as waiting_user on state.change waiting_permission', () => {
    const next = applyLiveEvent(emptyLiveOverlay(), {
      type: 'state.change',
      threadId: 'thr_1',
      state: 'waiting_permission',
    } as StreamEvent)
    expect(next.rootState).toBe('waiting_user')

    const g = buildExecutionGraph({
      thread: thread({ state: 'running' }),
      toolCalls: [],
      subagentRuns: [],
      pipeline: null,
      liveOverlay: next,
    })
    expect(g.nodes[0].status).toBe('waiting_user')
  })

  it('records optimistic pipeline stage', () => {
    const next = applyLiveEvent(emptyLiveOverlay(), {
      type: 'pipeline.stage',
      threadId: 'thr_1',
      pipelineId: 'p1',
      stageId: 'implementer',
      index: 1,
      total: 4,
      phase: 'start',
      subagentName: 'implementer',
      status: 'running',
    })
    expect(next.optimisticStages[0].stageId).toBe('implementer')
    expect(next.optimisticStages[0].status).toBe('running')
  })
})

describe('layoutExecutionGraph', () => {
  it('places root at column 0 and child at column 1', () => {
    const g = buildExecutionGraph({
      thread: thread(),
      toolCalls: [tool({ id: 'tc_a', name: CALL_SUBAGENT_TOOL_NAME, seq: 1, params: { task: 'x' } })],
      subagentRuns: [run({ childThreadId: 'child_1', parentToolCallId: 'tc_a' })],
      pipeline: null,
    })
    const laid = layoutExecutionGraph(g)
    const root = laid.nodes.find((n) => n.kind === 'root')!
    const child = laid.nodes.find((n) => n.kind === 'subagent')!
    expect(root.position.x).toBeLessThan(child.position.x)
    expect(child.position.y).toBeGreaterThanOrEqual(0)
  })
})
