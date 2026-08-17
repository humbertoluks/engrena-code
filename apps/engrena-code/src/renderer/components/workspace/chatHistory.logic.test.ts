import { describe, expect, it } from 'vitest'
import {
  activityLabelForTool,
  CALL_SUBAGENT_TOOL_NAME,
  correlateSubagentRuns,
  currentActivity,
  countUserMessageLines,
  formatClock,
  DEFAULT_ACTIVITY_LABEL,
  formatDurationSeconds,
  groupTimelineItems,
  LOAD_SKILL_TOOL_NAME,
  shouldCollapseUserMessage,
  thinkingStartMs,
  toolSummary,
  turnDurationForAssistant,
} from './chatHistory.logic'
import type { Message, ToolCall } from '../../services/threads-service'
import type { SubagentRun } from '../../services/subagents-service'

function tool(partial: Partial<ToolCall> & Pick<ToolCall, 'id' | 'name' | 'seq'>): ToolCall {
  return {
    threadId: 'thr_parent',
    messageId: null,
    params: null,
    status: 'completed',
    result: null,
    startedAt: 1,
    endedAt: 2,
    ...partial,
  }
}

function message(partial: Partial<Message> & Pick<Message, 'id' | 'role' | 'seq' | 'createdAt'>): Message {
  return {
    threadId: 'thr_parent',
    content: partial.content ?? partial.role,
    blocks: null,
    ...partial,
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
      [tool({ id: 'tc_a', name: CALL_SUBAGENT_TOOL_NAME, seq: 1 }), tool({ id: 'tc_b', name: CALL_SUBAGENT_TOOL_NAME, seq: 2 })],
      [run({ childThreadId: 'c1', parentToolCallId: 'tc_b' }), run({ childThreadId: 'c2', parentToolCallId: 'tc_a' })]
    )
    expect(map.get('tc_a')?.map((r) => r.childThreadId)).toEqual(['c2'])
    expect(map.get('tc_b')?.map((r) => r.childThreadId)).toEqual(['c1'])
  })

  it('keeps every child of a parallel batch under the same call_subagent', () => {
    const map = correlateSubagentRuns(
      [tool({ id: 'tc_batch', name: CALL_SUBAGENT_TOOL_NAME, seq: 1 })],
      [
        run({ childThreadId: 'c1', parentToolCallId: 'tc_batch', parallelBatchId: 'batch-1' }),
        run({ childThreadId: 'c2', parentToolCallId: 'tc_batch', parallelBatchId: 'batch-1' }),
        run({ childThreadId: 'c3', parentToolCallId: 'tc_batch', parallelBatchId: 'batch-1' }),
      ]
    )
    expect(map.get('tc_batch')?.map((r) => r.childThreadId)).toEqual(['c1', 'c2', 'c3'])
  })

  it('falls back to FIFO for runs without parentToolCallId', () => {
    const map = correlateSubagentRuns(
      [
        tool({ id: 'tc_1', name: CALL_SUBAGENT_TOOL_NAME, seq: 1 }),
        tool({ id: 'tc_2', name: CALL_SUBAGENT_TOOL_NAME, seq: 2 }),
        tool({ id: 'other', name: 'Bash', seq: 3 }),
      ],
      [
        run({ childThreadId: 'c1', parentToolCallId: null }),
        run({ childThreadId: 'c2', parentToolCallId: null }),
      ]
    )
    expect(map.get('tc_1')?.map((r) => r.childThreadId)).toEqual(['c1'])
    expect(map.get('tc_2')?.map((r) => r.childThreadId)).toEqual(['c2'])
    expect(map.has('other')).toBe(false)
  })
})

describe('formatDurationSeconds / formatClock', () => {
  it('formats short and long durations', () => {
    expect(formatDurationSeconds(0)).toBe('0s')
    expect(formatDurationSeconds(47_000)).toBe('47s')
    expect(formatDurationSeconds(72_000)).toBe('1m 12s')
    expect(formatDurationSeconds(3_723_000)).toBe('1h 2m 3s')
  })

  it('formats clock from epoch ms', () => {
    const ms = Date.parse('2026-08-10T12:05:00')
    expect(formatClock(ms)).toMatch(/^\d{2}:\d{2}$/)
    expect(formatClock(undefined)).toBe('')
  })
})

describe('toolSummary', () => {
  it('prefers command then falls back to tool name', () => {
    expect(toolSummary({ name: 'Bash', params: { command: 'npm init -y' } })).toBe('npm init -y')
    expect(toolSummary({ name: 'Read', params: { file_path: 'a.ts' } })).toBe('a.ts')
    expect(toolSummary({ name: 'Glob', params: {} })).toBe('Glob')
  })
})

describe('groupTimelineItems', () => {
  it('interleaves by seq and collapses adjacent tools into a work log', () => {
    const messages = [
      message({ id: 'm1', role: 'user', seq: 0, createdAt: 100, content: 'oi' }),
      message({ id: 'm2', role: 'assistant', seq: 3, createdAt: 400, content: 'feito' }),
    ]
    const tools = [
      tool({ id: 't1', name: 'Bash', seq: 1, params: { command: 'ls' } }),
      tool({ id: 't2', name: 'Write', seq: 2, params: { file_path: 'a.js' } }),
      tool({ id: 't3', name: 'Bash', seq: 4, params: { command: 'node a.js' } }),
    ]
    const groups = groupTimelineItems(messages, tools, new Map())
    expect(groups.map((g) => g.kind)).toEqual(['message', 'tools', 'message', 'tools'])
    expect(groups[1]).toMatchObject({ kind: 'tools', tools: [{ id: 't1' }, { id: 't2' }] })
    expect(groups[3]).toMatchObject({ kind: 'tools', tools: [{ id: 't3' }] })
  })

  it('lifts correlated call_subagent out of the work log into a subagent group', () => {
    const tools = [
      tool({ id: 't1', name: 'Bash', seq: 1 }),
      tool({ id: 'tc', name: CALL_SUBAGENT_TOOL_NAME, seq: 2 }),
      tool({ id: 't2', name: 'Bash', seq: 3 }),
    ]
    const map = new Map([['tc', [run({ childThreadId: 'c1', parentToolCallId: 'tc' })]]])
    const groups = groupTimelineItems([], tools, map)
    expect(groups.map((g) => g.kind)).toEqual(['tools', 'subagent', 'tools'])
    expect(groups[0]).toMatchObject({ kind: 'tools', tools: [{ id: 't1' }] })
    expect(groups[2]).toMatchObject({ kind: 'tools', tools: [{ id: 't2' }] })
  })

  it('carries all batch children in the single subagent group', () => {
    const tools = [tool({ id: 'tc', name: CALL_SUBAGENT_TOOL_NAME, seq: 1 })]
    const map = new Map([
      [
        'tc',
        [
          run({ childThreadId: 'c1', parentToolCallId: 'tc', subagentName: 'explorer' }),
          run({ childThreadId: 'c2', parentToolCallId: 'tc', subagentName: 'implementer' }),
        ],
      ],
    ])
    const groups = groupTimelineItems([], tools, map)
    expect(groups).toHaveLength(1)
    expect(groups[0]).toMatchObject({
      kind: 'subagent',
      runs: [{ childThreadId: 'c1' }, { childThreadId: 'c2' }],
    })
  })
})

describe('turnDurationForAssistant / thinkingStartMs', () => {
  it('measures from previous user message', () => {
    const messages = [
      message({ id: 'u', role: 'user', seq: 0, createdAt: 1000, content: 'x' }),
      message({ id: 'a', role: 'assistant', seq: 1, createdAt: 4500, content: 'y' }),
    ]
    expect(turnDurationForAssistant(messages, messages[1])).toBe(3500)
    expect(thinkingStartMs(messages, 9999)).toBe(1000)
  })
})

describe('shouldCollapseUserMessage', () => {
  it('counts soft lines and collapses only above max', () => {
    expect(countUserMessageLines('')).toBe(0)
    expect(countUserMessageLines('one')).toBe(1)
    expect(countUserMessageLines('a\nb\nc')).toBe(3)
    expect(countUserMessageLines('a\r\nb\r\nc\r\nd')).toBe(4)

    expect(shouldCollapseUserMessage('short')).toBe(false)
    expect(shouldCollapseUserMessage('a\nb\nc')).toBe(false)
    expect(shouldCollapseUserMessage('a\nb\nc\nd')).toBe(true)
    expect(shouldCollapseUserMessage('a\nb\nc\nd', 4)).toBe(false)
    expect(shouldCollapseUserMessage(null)).toBe(false)
  })
})

describe('currentActivity', () => {
  it('falls back to "Pensando" from the last user message when no tool is running', () => {
    const messages = [
      message({ id: 'u', role: 'user', seq: 0, createdAt: 1000, content: 'x' }),
      message({ id: 'a', role: 'assistant', seq: 1, createdAt: 2000, content: 'y' }),
    ]
    expect(currentActivity(messages, [tool({ id: 't1', name: 'Read', seq: 2 })], 9999)).toEqual({
      label: DEFAULT_ACTIVITY_LABEL,
      startMs: 1000,
    })
  })

  it('uses the latest running tool label and its startedAt', () => {
    const tools = [
      tool({ id: 't1', name: 'Read', seq: 1, status: 'running', startedAt: 5000, endedAt: null }),
      tool({ id: 't2', name: 'Grep', seq: 2, status: 'running', startedAt: 7000, endedAt: null }),
      tool({ id: 't3', name: 'Bash', seq: 3, status: 'completed', startedAt: 8000 }),
    ]
    expect(currentActivity([], tools, 9999)).toEqual({ label: 'Buscando', startMs: 7000 })
  })

  it('never leaks a raw tool name for unknown or MCP tools', () => {
    expect(activityLabelForTool('Grep')).toBe('Buscando')
    expect(activityLabelForTool(CALL_SUBAGENT_TOOL_NAME)).toBe('Delegando')
    expect(activityLabelForTool(LOAD_SKILL_TOOL_NAME)).toBe('Carregando skill')
    expect(activityLabelForTool('mcp__context7__query-docs')).toBe('Trabalhando')
    expect(activityLabelForTool('WhateverNewTool')).toBe('Trabalhando')
  })

  it('counts from the optimistic bubble on a follow-up, not from the previous turn', () => {
    const messages = [
      message({ id: 'u1', role: 'user', seq: 0, createdAt: 1000, content: 'primeiro' }),
      message({ id: 'a1', role: 'assistant', seq: 1, createdAt: 2000, content: 'resposta' }),
    ]
    const pending = [
      { status: 'sent', createdAt: 30000 },
      { status: 'queued', createdAt: 90000 },
    ]
    expect(currentActivity(messages, [], 31000, pending).startMs).toBe(30000)
    expect(currentActivity(messages, [], 31000, []).startMs).toBe(1000)
  })
})
