import { describe, expect, it } from 'vitest'
import {
  consumeThreadCancelled,
  getActiveController,
  markThreadCancelled,
  registerActiveController,
  unregisterActiveController,
} from './turn-control.js'

describe('active controller registry', () => {
  it('registers, retrieves and unregisters a controller by threadId', () => {
    const controller = new AbortController()
    registerActiveController('thr_1', controller)
    expect(getActiveController('thr_1')).toBe(controller)

    unregisterActiveController('thr_1')
    expect(getActiveController('thr_1')).toBeUndefined()
  })

  it('returns undefined for a threadId that was never registered', () => {
    expect(getActiveController('thr_never_registered')).toBeUndefined()
  })

  it('unregistering an unknown threadId is a silent no-op', () => {
    expect(() => unregisterActiveController('thr_unknown')).not.toThrow()
  })
})

describe('cancelled thread marks', () => {
  it('consumeThreadCancelled returns true exactly once for a marked thread (idempotent delete)', () => {
    markThreadCancelled('thr_2')
    expect(consumeThreadCancelled('thr_2')).toBe(true)
    expect(consumeThreadCancelled('thr_2')).toBe(false)
  })

  it('consumeThreadCancelled returns false for a thread that was never marked', () => {
    expect(consumeThreadCancelled('thr_never_marked')).toBe(false)
  })
})
