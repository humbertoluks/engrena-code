import { describe, expect, it } from 'vitest'
import { CALL_SUBAGENT_TOOL_NAME, correlateSubagentRuns } from './chatHistory.logic'
import type { ToolCall } from '../../services/threads-service'
import type { SubagentRun } from '../../../services/db/repositories/subagents.js'

function tool(id: string, name = CALL_SUBAGENT_TOOL_NAME): ToolCall {
  return {
    id,
    threadId: 'thr_parent',
    messageId: null,
    name,
    params: null,
    status: 'completed',
    result: null,
    seq: 1,
    startedAt: 1,
    endedAt: 2,
  }
}

function run(partial: Partial<SubagentRun> & Pick<SubagentRun, 'childThreadId' | 'parentToolCallId'>): SubagentRun {
  return {
    parentThreadId: 'thr_parent',
    subagentName: 'reviewer',
    provider: 'claude',
    model: null,
    status: 'completed',
    text: null,
    durationMs: 10,
    reasoningLevel: null,
    actionCount: 0,
    createdAt: 1,
    ...partial,
  }
}

describe('correlateSubagentRuns', () => {
  it('matches by parentToolCallId first', () => {
    const map = correlateSubagentRuns(
      [tool('tc_a'), tool('tc_b')],
      [run({ childThreadId: 'c1', parentToolCallId: 'tc_b' }), run({ childThreadId: 'c2', parentToolCallId: 'tc_a' })]
    )
    expect(map.get('tc_a')?.childThreadId).toBe('c2')
    expect(map.get('tc_b')?.childThreadId).toBe('c1')
  })

  it('falls back to FIFO for runs without parentToolCallId', () => {
    const map = correlateSubagentRuns(
      [tool('tc_1'), tool('tc_2'), tool('other', 'Bash')],
      [
        run({ childThreadId: 'c1', parentToolCallId: null }),
        run({ childThreadId: 'c2', parentToolCallId: null }),
      ]
    )
    expect(map.get('tc_1')?.childThreadId).toBe('c1')
    expect(map.get('tc_2')?.childThreadId).toBe('c2')
    expect(map.has('other')).toBe(false)
  })
})
