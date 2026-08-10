import { beforeEach, describe, expect, it } from 'vitest'
import { acquireLease, clearAllLeases, getLease, isLeased, LeaseBusyError, releaseLease } from './project-execution.js'

beforeEach(() => {
  clearAllLeases()
})

describe('acquireLease / releaseLease', () => {
  it('acquires a lease when the project is free', () => {
    const lease = acquireLease('proj-1', 'agent', 'dispatch', 'thr_1')
    expect(lease.projectId).toBe('proj-1')
    expect(isLeased('proj-1')).toBe(true)
  })

  it('throws LeaseBusyError with the existing owner info when already leased', () => {
    acquireLease('proj-1', 'agent', 'dispatch', 'thr_1')
    try {
      acquireLease('proj-1', 'git', 'git-push', 'thr_1')
      expect.unreachable()
    } catch (err) {
      expect(err).toBeInstanceOf(LeaseBusyError)
      expect((err as LeaseBusyError).code).toBe('thread_busy')
      expect((err as LeaseBusyError).info.operation).toBe('dispatch')
    }
  })

  it('releases and allows re-acquiring', () => {
    acquireLease('proj-1', 'agent', 'dispatch', 'thr_1')
    releaseLease('proj-1')
    expect(isLeased('proj-1')).toBe(false)
    expect(() => acquireLease('proj-1', 'git', 'git-commit', 'thr_2')).not.toThrow()
  })

  it('does not affect leases of other projects', () => {
    acquireLease('proj-1', 'agent', 'dispatch', 'thr_1')
    expect(() => acquireLease('proj-2', 'agent', 'dispatch', 'thr_2')).not.toThrow()
    expect(getLease('proj-2')?.projectId).toBe('proj-2')
  })
})
