import { describe, expect, it } from 'vitest'
import type { SubagentRun } from '../../services/subagents-service'
import { formatRunDuration, isActiveRunStatus, resolveLatestParallelBatch } from './subagentRun.format.js'

function makeRun(overrides: Partial<SubagentRun> = {}): SubagentRun {
  return {
    childThreadId: 'run-1',
    parentThreadId: 'thread-1',
    parentToolCallId: null,
    subagentName: 'a',
    provider: 'claude',
    model: null,
    status: 'running',
    text: null,
    durationMs: null,
    reasoningLevel: null,
    actionCount: 0,
    parallelBatchId: null,
    createdAt: 0,
    ...overrides,
  }
}

describe('subagentRun.format', () => {
  it('formats a finished run using durationMs', () => {
    expect(formatRunDuration(0, 65_000)).toBe('01:05')
  })

  it('formats an in-progress run using elapsed time from now', () => {
    expect(formatRunDuration(0, null, 5_000)).toBe('00:05')
  })

  it('pads minutes and seconds to two digits', () => {
    expect(formatRunDuration(0, 3_000)).toBe('00:03')
  })

  it('isActiveRunStatus is true only for running', () => {
    expect(isActiveRunStatus('running')).toBe(true)
    expect(isActiveRunStatus('completed')).toBe(false)
    expect(isActiveRunStatus('timeout')).toBe(false)
  })

  describe('resolveLatestParallelBatch (F18)', () => {
    it('returns null when no run belongs to a batch (serial F15 only)', () => {
      expect(resolveLatestParallelBatch([makeRun(), makeRun({ childThreadId: 'run-2' })])).toBeNull()
    })

    it('aggregates counts from the most recent batch, ignoring older batches and serial runs', () => {
      const runs = [
        makeRun({ childThreadId: 'old-1', parallelBatchId: 'batch-old', createdAt: 1, status: 'completed' }),
        makeRun({ childThreadId: 'serial', parallelBatchId: null, createdAt: 5, status: 'completed' }),
        makeRun({ childThreadId: 'a', parallelBatchId: 'batch-new', createdAt: 10, status: 'completed' }),
        makeRun({ childThreadId: 'b', parallelBatchId: 'batch-new', createdAt: 9, status: 'running' }),
        makeRun({ childThreadId: 'c', parallelBatchId: 'batch-new', createdAt: 8, status: 'error' }),
        makeRun({ childThreadId: 'd', parallelBatchId: 'batch-new', createdAt: 7, status: 'timeout' }),
      ]

      const aggregate = resolveLatestParallelBatch(runs)
      expect(aggregate).toEqual({ batchId: 'batch-new', total: 4, done: 1, running: 1, failed: 2 })
    })

    it('cancelled counts as failed for aggregate purposes', () => {
      const runs = [
        makeRun({ childThreadId: 'a', parallelBatchId: 'batch-1', createdAt: 1, status: 'cancelled' }),
        makeRun({ childThreadId: 'b', parallelBatchId: 'batch-1', createdAt: 2, status: 'completed' }),
      ]
      expect(resolveLatestParallelBatch(runs)).toEqual({ batchId: 'batch-1', total: 2, done: 1, running: 0, failed: 1 })
    })
  })
})
