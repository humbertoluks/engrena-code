import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  getRuntimeMetricsSnapshot,
  recordHistoryRefetchAborted,
  recordHistoryRefetchCoalesced,
  recordHistoryRefetchCompleted,
  recordHistoryRefetchStarted,
  recordStderrBufBytes,
  recordProviderProcessExited,
  recordProviderProcessSpawned,
  recordToolResultTruncation,
  resetRuntimeMetricsForTesting,
} from './runtime-metrics.js'

/** Desliga o gate `enabled()`: nem env flag, nem NODE_ENV dev/test, nem import.meta.env.DEV. */
function withMetricsDisabled(run: () => void): void {
  const meta = import.meta as ImportMeta & { env?: { DEV?: boolean } }
  const prevNodeEnv = process.env.NODE_ENV
  const prevFlag = process.env.ENGRENACODE_RUNTIME_METRICS
  const prevDev = meta.env?.DEV
  process.env.NODE_ENV = 'production'
  delete process.env.ENGRENACODE_RUNTIME_METRICS
  if (meta.env) meta.env.DEV = false
  try {
    run()
  } finally {
    if (prevNodeEnv === undefined) delete process.env.NODE_ENV
    else process.env.NODE_ENV = prevNodeEnv
    if (prevFlag === undefined) delete process.env.ENGRENACODE_RUNTIME_METRICS
    else process.env.ENGRENACODE_RUNTIME_METRICS = prevFlag
    if (meta.env) meta.env.DEV = prevDev
  }
}

beforeEach(() => {
  resetRuntimeMetricsForTesting()
})

afterEach(() => {
  resetRuntimeMetricsForTesting()
})

describe('runtime-metrics', () => {
  it('starts every counter at zero after reset', () => {
    expect(getRuntimeMetricsSnapshot()).toEqual({
      historyRefetchStarted: 0,
      historyRefetchCoalesced: 0,
      historyRefetchCompleted: 0,
      historyRefetchAborted: 0,
      stderrAppendBytesPeak: 0,
      toolResultTruncations: 0,
      providerProcessesSpawned: 0,
      providerProcessesLive: 0,
    })
  })

  it('counts each history refetch phase independently', () => {
    recordHistoryRefetchStarted()
    recordHistoryRefetchStarted()
    recordHistoryRefetchCoalesced()
    recordHistoryRefetchCompleted()
    recordHistoryRefetchAborted()
    recordHistoryRefetchAborted()
    recordHistoryRefetchAborted()

    const snapshot = getRuntimeMetricsSnapshot()
    expect(snapshot.historyRefetchStarted).toBe(2)
    expect(snapshot.historyRefetchCoalesced).toBe(1)
    expect(snapshot.historyRefetchCompleted).toBe(1)
    expect(snapshot.historyRefetchAborted).toBe(3)
  })

  it('counts tool result truncations cumulatively', () => {
    recordToolResultTruncation()
    recordToolResultTruncation()
    expect(getRuntimeMetricsSnapshot().toolResultTruncations).toBe(2)
  })

  it('keeps the stderr buffer peak and ignores smaller samples', () => {
    recordStderrBufBytes(1_024)
    expect(getRuntimeMetricsSnapshot().stderrAppendBytesPeak).toBe(1_024)

    recordStderrBufBytes(4_096)
    expect(getRuntimeMetricsSnapshot().stderrAppendBytesPeak).toBe(4_096)

    // buffer drenado → o pico histórico não regride
    recordStderrBufBytes(0)
    recordStderrBufBytes(512)
    expect(getRuntimeMetricsSnapshot().stderrAppendBytesPeak).toBe(4_096)
  })

  it('accumulates spawned provider processes and tracks the live gauge (R07)', () => {
    recordProviderProcessSpawned()
    recordProviderProcessSpawned()
    expect(getRuntimeMetricsSnapshot().providerProcessesSpawned).toBe(2)
    expect(getRuntimeMetricsSnapshot().providerProcessesLive).toBe(2)

    // Um turno assentou: o total nunca regride, o gauge sim — sobra = processo ainda vivo.
    recordProviderProcessExited()
    expect(getRuntimeMetricsSnapshot().providerProcessesSpawned).toBe(2)
    expect(getRuntimeMetricsSnapshot().providerProcessesLive).toBe(1)
  })

  it('never drives the live gauge below zero (exit sem spawn contado)', () => {
    recordProviderProcessExited()
    expect(getRuntimeMetricsSnapshot().providerProcessesLive).toBe(0)
  })

  it('returns a detached snapshot — mutating it does not touch the counters', () => {
    recordHistoryRefetchStarted()
    const snapshot = getRuntimeMetricsSnapshot()
    snapshot.historyRefetchStarted = 999
    expect(getRuntimeMetricsSnapshot().historyRefetchStarted).toBe(1)
  })

  it('resets every counter between specs', () => {
    recordHistoryRefetchStarted()
    recordHistoryRefetchCoalesced()
    recordHistoryRefetchCompleted()
    recordHistoryRefetchAborted()
    recordStderrBufBytes(8_192)
    recordToolResultTruncation()
    recordProviderProcessSpawned()
    expect(getRuntimeMetricsSnapshot().stderrAppendBytesPeak).toBe(8_192)

    resetRuntimeMetricsForTesting()

    expect(getRuntimeMetricsSnapshot()).toEqual({
      historyRefetchStarted: 0,
      historyRefetchCoalesced: 0,
      historyRefetchCompleted: 0,
      historyRefetchAborted: 0,
      stderrAppendBytesPeak: 0,
      toolResultTruncations: 0,
      providerProcessesSpawned: 0,
      providerProcessesLive: 0,
    })
  })

  it('records nothing while the dev-only gate is off', () => {
    withMetricsDisabled(() => {
      recordHistoryRefetchStarted()
      recordHistoryRefetchCoalesced()
      recordHistoryRefetchCompleted()
      recordHistoryRefetchAborted()
      recordStderrBufBytes(64_000)
      recordToolResultTruncation()
      recordProviderProcessSpawned()
    })

    expect(getRuntimeMetricsSnapshot()).toEqual({
      historyRefetchStarted: 0,
      historyRefetchCoalesced: 0,
      historyRefetchCompleted: 0,
      historyRefetchAborted: 0,
      stderrAppendBytesPeak: 0,
      toolResultTruncations: 0,
      providerProcessesSpawned: 0,
      providerProcessesLive: 0,
    })
  })

  it('re-enables recording via ENGRENACODE_RUNTIME_METRICS=1 outside dev', () => {
    const prevNodeEnv = process.env.NODE_ENV
    const prevFlag = process.env.ENGRENACODE_RUNTIME_METRICS
    process.env.NODE_ENV = 'production'
    process.env.ENGRENACODE_RUNTIME_METRICS = '1'
    try {
      recordToolResultTruncation()
    } finally {
      if (prevNodeEnv === undefined) delete process.env.NODE_ENV
      else process.env.NODE_ENV = prevNodeEnv
      if (prevFlag === undefined) delete process.env.ENGRENACODE_RUNTIME_METRICS
      else process.env.ENGRENACODE_RUNTIME_METRICS = prevFlag
    }
    expect(getRuntimeMetricsSnapshot().toolResultTruncations).toBe(1)
  })
})
