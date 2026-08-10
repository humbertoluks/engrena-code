import { describe, expect, it } from 'vitest'
import type { IncomingMessage, ServerResponse } from 'http'
import { EventEmitter } from 'events'
import {
  createGuard,
  parseBody,
  readBody,
  sendError,
  sendJson,
  sendTransportError,
  MAX_BODY_BYTES,
  PayloadTooLargeError,
  DEFAULT_SESSION_HEADER,
  extractSessionTokenFromSubprotocol,
  DEFAULT_SESSION_SUBPROTOCOL_PREFIX,
} from './index.js'

const SESSION_TOKEN = 'test-session-token'
const authState = { locked: false, token: SESSION_TOKEN as string | null }

const guard = createGuard({
  isLocked: () => authState.locked,
  getSessionToken: () => authState.token,
})

function fakeResponse(): ServerResponse & { statusCode: number; body: string; headersSent: boolean } {
  const res = {
    statusCode: 0,
    body: '',
    headersSent: false,
    writeHead(status: number) {
      res.statusCode = status
      res.headersSent = true
      return res
    },
    end(chunk?: string) {
      if (chunk !== undefined) res.body = chunk
    },
  } as unknown as ServerResponse & { statusCode: number; body: string; headersSent: boolean }
  return res
}

function fakeRequest(): IncomingMessage & {
  destroy: () => void
  destroyed: boolean
  paused: boolean
  pause: () => void
} {
  const req = new EventEmitter() as IncomingMessage & {
    destroy: () => void
    destroyed: boolean
    paused: boolean
    pause: () => void
  }
  req.destroyed = false
  req.paused = false
  req.destroy = () => {
    req.destroyed = true
  }
  req.pause = () => {
    req.paused = true
  }
  return req
}

describe('sendJson / sendError', () => {
  it('writes status + JSON content-type header and serializes the body', () => {
    const res = fakeResponse()
    sendJson(res, 200, { ok: true })
    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.body)).toEqual({ ok: true })
  })

  it('omits the body entirely when undefined (e.g. 204)', () => {
    const res = fakeResponse()
    sendJson(res, 204, undefined)
    expect(res.body).toBe('')
  })

  it('wraps code/message (and optional details) in the { error } envelope', () => {
    const res = fakeResponse()
    sendError(res, 400, 'invalid_request', 'Corpo inválido.', { field: 'name' })
    expect(res.statusCode).toBe(400)
    expect(JSON.parse(res.body)).toEqual({
      error: { code: 'invalid_request', message: 'Corpo inválido.', details: { field: 'name' } },
    })
  })
})

describe('parseBody', () => {
  it('returns an empty object for a blank body', () => {
    expect(parseBody('')).toEqual({})
    expect(parseBody('   ')).toEqual({})
  })

  it('parses valid JSON', () => {
    expect(parseBody('{"a":1}')).toEqual({ a: 1 })
  })

  it('returns null for malformed JSON', () => {
    expect(parseBody('{not-json')).toBeNull()
  })
})

describe('readBody', () => {
  it('concatenates chunks and resolves with the full string', async () => {
    const req = fakeRequest()
    const promise = readBody(req)
    req.emit('data', Buffer.from('{"a":'))
    req.emit('data', Buffer.from('1}'))
    req.emit('end')
    expect(await promise).toBe('{"a":1}')
  })

  it('rejects with the underlying stream error', async () => {
    const req = fakeRequest()
    const promise = readBody(req)
    req.emit('error', new Error('boom'))
    await expect(promise).rejects.toThrow('boom')
  })

  it('pauses the request and rejects with PayloadTooLargeError above MAX_BODY_BYTES', async () => {
    const req = fakeRequest()
    const promise = readBody(req)
    req.emit('data', Buffer.alloc(MAX_BODY_BYTES + 1))
    await expect(promise).rejects.toBeInstanceOf(PayloadTooLargeError)
    expect(req.paused).toBe(true)
    expect(req.destroyed).toBe(false)
  })
})

describe('sendTransportError', () => {
  it('sends 413 payload_too_large for a PayloadTooLargeError and returns true', () => {
    const res = fakeResponse()
    const handled = sendTransportError(res, new PayloadTooLargeError())
    expect(handled).toBe(true)
    expect(res.statusCode).toBe(413)
    expect(JSON.parse(res.body).error.code).toBe('payload_too_large')
  })

  it('does not resend if headers were already sent', () => {
    const res = fakeResponse()
    res.headersSent = true
    const handled = sendTransportError(res, new PayloadTooLargeError())
    expect(handled).toBe(true)
    expect(res.body).toBe('')
  })

  it('returns false for any other error, leaving the response untouched', () => {
    const res = fakeResponse()
    const handled = sendTransportError(res, new Error('generic'))
    expect(handled).toBe(false)
    expect(res.statusCode).toBe(0)
  })
})

describe('createGuard (423 before 401)', () => {
  it('returns 423 vault_locked and false when the vault is locked', () => {
    authState.locked = true
    const req = { headers: {} } as IncomingMessage
    const res = fakeResponse()
    expect(guard(req, res)).toBe(false)
    expect(res.statusCode).toBe(423)
    expect(JSON.parse(res.body).error.code).toBe('vault_locked')
    authState.locked = false
  })

  it('returns 401 unauthorized and false when the session token is missing or wrong', () => {
    authState.locked = false
    const req = { headers: {} } as IncomingMessage
    const res = fakeResponse()
    expect(guard(req, res)).toBe(false)
    expect(res.statusCode).toBe(401)
    expect(JSON.parse(res.body).error.code).toBe('unauthorized')
  })

  it('prefers 423 over 401 when locked even if the token header is present', () => {
    authState.locked = true
    const req = {
      headers: { [DEFAULT_SESSION_HEADER]: SESSION_TOKEN },
    } as unknown as IncomingMessage
    const res = fakeResponse()
    expect(guard(req, res)).toBe(false)
    expect(res.statusCode).toBe(423)
    authState.locked = false
  })

  it('returns true without touching the response when the session token matches', () => {
    authState.locked = false
    const req = {
      headers: { [DEFAULT_SESSION_HEADER]: SESSION_TOKEN },
    } as unknown as IncomingMessage
    const res = fakeResponse()
    expect(guard(req, res)).toBe(true)
    expect(res.statusCode).toBe(0)
  })

  it('respects a custom session header name', () => {
    const customGuard = createGuard(
      {
        isLocked: () => false,
        getSessionToken: () => 'tok',
      },
      { sessionHeader: 'x-custom-session' }
    )
    const ok = fakeResponse()
    expect(
      customGuard({ headers: { 'x-custom-session': 'tok' } } as unknown as IncomingMessage, ok)
    ).toBe(true)
    const bad = fakeResponse()
    expect(
      customGuard(
        { headers: { [DEFAULT_SESSION_HEADER]: 'tok' } } as unknown as IncomingMessage,
        bad
      )
    ).toBe(false)
    expect(bad.statusCode).toBe(401)
  })
})

describe('extractSessionTokenFromSubprotocol', () => {
  it('extracts the token after the default prefix', () => {
    const req = {
      headers: { 'sec-websocket-protocol': `${DEFAULT_SESSION_SUBPROTOCOL_PREFIX}abc123` },
    } as unknown as IncomingMessage
    expect(extractSessionTokenFromSubprotocol(req)).toBe('abc123')
  })

  it('returns null when the prefix is absent', () => {
    const req = {
      headers: { 'sec-websocket-protocol': 'other.abc123' },
    } as unknown as IncomingMessage
    expect(extractSessionTokenFromSubprotocol(req)).toBeNull()
  })

  it('respects a custom prefix', () => {
    const req = {
      headers: { 'sec-websocket-protocol': 'plan-session.xyz' },
    } as unknown as IncomingMessage
    expect(extractSessionTokenFromSubprotocol(req, 'plan-session.')).toBe('xyz')
  })
})
