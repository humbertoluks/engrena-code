import { describe, expect, it } from 'vitest'
import { formatRunDuration, isActiveRunStatus } from './subagentRun.format.js'

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
})
