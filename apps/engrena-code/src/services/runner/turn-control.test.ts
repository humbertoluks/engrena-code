import { describe, expect, it } from 'vitest'
import {
  closeTurnServers,
  consumeThreadCancelled,
  getActiveController,
  markThreadCancelled,
  registerActiveController,
  registerTurnServerClosers,
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

describe('turn server closers', () => {
  it('closeTurnServers runs the registered closer once (idempotent)', () => {
    let closes = 0
    registerTurnServerClosers('thr_close', () => {
      closes += 1
    })
    closeTurnServers('thr_close')
    closeTurnServers('thr_close')
    expect(closes).toBe(1)
  })

  it('closeTurnServers is a no-op when nothing was registered', () => {
    expect(() => closeTurnServers('thr_never')).not.toThrow()
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
