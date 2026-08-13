import { describe, expect, it } from 'vitest'
import {
  HistoryRefetchGate,
  isAbortError,
  mergeById,
  mergeSubagentRunsByChildId,
  sameMessageLike,
  sameSubagentRunLike,
  sameToolCallLike,
} from './historyMerge.logic'

describe('mergeById', () => {
  it('preserves previous object references when content is unchanged', () => {
    const a = { id: '1', threadId: 't', role: 'user', content: 'oi', blocks: null, seq: 1, createdAt: 1 }
    const b = { id: '2', threadId: 't', role: 'assistant', content: 'olá', blocks: null, seq: 2, createdAt: 2 }
    const prev = [a, b]
    const next = [
      { ...a },
      { ...b },
    ]
    const merged = mergeById(prev, next, sameMessageLike)
    expect(merged).toBe(prev)
    expect(merged[0]).toBe(a)
    expect(merged[1]).toBe(b)
  })

  it('replaces only changed rows and keeps stable ones', () => {
    const a = { id: '1', threadId: 't', role: 'user' as const, content: 'oi', blocks: null, seq: 1, createdAt: 1 }
    const b = { id: '2', threadId: 't', role: 'assistant' as const, content: 'olá', blocks: null, seq: 2, createdAt: 2 }
    const prev = [a, b]
    const b2 = { ...b, content: 'olá!' }
    const merged = mergeById(prev, [a, b2], sameMessageLike)
    expect(merged).not.toBe(prev)
    expect(merged[0]).toBe(a)
    expect(merged[1]).toBe(b2)
    expect(merged[1]).not.toBe(b)
  })

  it('appends new ids without dropping prior stable refs', () => {
    const a = { id: '1', threadId: 't', role: 'user' as const, content: 'oi', blocks: null, seq: 1, createdAt: 1 }
    const c = { id: '3', threadId: 't', role: 'assistant' as const, content: 'novo', blocks: null, seq: 3, createdAt: 3 }
    const merged = mergeById([a], [{ ...a }, c], sameMessageLike)
    expect(merged[0]).toBe(a)
    expect(merged[1]).toBe(c)
  })
})

describe('sameToolCallLike / merge tool calls', () => {
  it('detects status/result changes', () => {
    const base = {
      id: 'tc1',
      threadId: 't',
      messageId: null as string | null,
      name: 'Bash',
      params: { command: 'ls' },
      status: 'running',
      result: null as unknown,
      seq: 1,
      startedAt: 10,
      endedAt: null as number | null,
    }
    expect(sameToolCallLike(base, { ...base })).toBe(true)
    expect(sameToolCallLike(base, { ...base, status: 'completed', result: { ok: true }, endedAt: 20 })).toBe(
      false
    )
  })
})

describe('mergeSubagentRunsByChildId', () => {
  it('keeps stable childThreadId rows', () => {
    const run = {
      childThreadId: 'c1',
      parentThreadId: 'p',
      parentToolCallId: null as string | null,
      subagentName: 'reviewer',
      provider: 'claude',
      model: null as string | null,
      status: 'running',
      text: null as string | null,
      durationMs: null as number | null,
      reasoningLevel: null as string | null,
      actionCount: 0,
      parallelBatchId: null as string | null,
      createdAt: 1,
    }
    const prev = [run]
    const merged = mergeSubagentRunsByChildId(prev, [{ ...run }], sameSubagentRunLike)
    expect(merged).toBe(prev)
    expect(merged[0]).toBe(run)
  })
})

describe('HistoryRefetchGate', () => {
  it('coalesces background requests while one is in flight', () => {
    const gate = new HistoryRefetchGate()
    const first = gate.begin({ background: true })
    expect(first.kind).toBe('run')
    if (first.kind !== 'run') return

    expect(gate.begin({ background: true }).kind).toBe('coalesced')
    expect(gate.begin({ background: true }).kind).toBe('coalesced')

    const { coalesced } = gate.finish(first.signal)
    expect(coalesced).toBe(true)
    expect(gate.hasInflight).toBe(false)

    const second = gate.begin({ background: true })
    expect(second.kind).toBe('run')
  })

  it('foreground aborts in-flight and starts a new fetch', () => {
    const gate = new HistoryRefetchGate()
    const bg = gate.begin({ background: true })
    expect(bg.kind).toBe('run')
    if (bg.kind !== 'run') return

    const fg = gate.begin({ background: false })
    expect(fg.kind).toBe('run')
    if (fg.kind !== 'run') return
    expect(bg.signal.aborted).toBe(true)
    expect(fg.signal.aborted).toBe(false)

    expect(gate.finish(bg.signal).coalesced).toBe(false)
    expect(gate.finish(fg.signal).coalesced).toBe(false)
  })

  it('cancel clears inflight and coalesce flag', () => {
    const gate = new HistoryRefetchGate()
    const first = gate.begin({ background: true })
    expect(first.kind).toBe('run')
    if (first.kind !== 'run') return
    gate.begin({ background: true })
    gate.cancel()
    expect(first.signal.aborted).toBe(true)
    expect(gate.hasInflight).toBe(false)
    const next = gate.begin({ background: true })
    expect(next.kind).toBe('run')
  })
})

describe('isAbortError', () => {
  it('recognizes AbortError by name', () => {
    expect(isAbortError({ name: 'AbortError' })).toBe(true)
    expect(isAbortError(new Error('nope'))).toBe(false)
    expect(isAbortError(null)).toBe(false)
  })
})
