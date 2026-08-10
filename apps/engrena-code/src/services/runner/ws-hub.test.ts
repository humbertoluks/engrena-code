import { beforeEach, describe, expect, it } from 'vitest'
import { clearAllSubscriptions, emit, subscribe, subscriberCount, unsubscribe } from './ws-hub.js'
import type { WebSocket } from 'ws'

function fakeSocket(): WebSocket & { sent: string[] } {
  const sent: string[] = []
  const socket = {
    readyState: 1,
    OPEN: 1,
    sent,
    send(data: string) {
      sent.push(data)
    },
  }
  return socket as unknown as WebSocket & { sent: string[] }
}

beforeEach(() => {
  clearAllSubscriptions()
})

describe('ws-hub', () => {
  it('fans out an event to every subscriber of a thread', () => {
    const a = fakeSocket()
    const b = fakeSocket()
    subscribe('thr_1', a)
    subscribe('thr_1', b)

    emit('thr_1', { type: 'message.delta', threadId: 'thr_1', text: 'oi' })

    expect(a.sent).toHaveLength(1)
    expect(b.sent).toHaveLength(1)
    expect(JSON.parse(a.sent[0])).toEqual({ type: 'message.delta', threadId: 'thr_1', text: 'oi' })
  })

  it('does not deliver to subscribers of a different thread', () => {
    const a = fakeSocket()
    subscribe('thr_1', a)

    emit('thr_2', { type: 'state.change', threadId: 'thr_2', state: 'idle' })

    expect(a.sent).toHaveLength(0)
  })

  it('stops delivering after unsubscribe', () => {
    const a = fakeSocket()
    subscribe('thr_1', a)
    unsubscribe('thr_1', a)

    emit('thr_1', { type: 'state.change', threadId: 'thr_1', state: 'idle' })

    expect(a.sent).toHaveLength(0)
    expect(subscriberCount('thr_1')).toBe(0)
  })

  it('skips sockets that are not open', () => {
    const a = fakeSocket()
    ;(a as unknown as { readyState: number }).readyState = 3
    subscribe('thr_1', a)

    emit('thr_1', { type: 'state.change', threadId: 'thr_1', state: 'idle' })

    expect(a.sent).toHaveLength(0)
  })
})
