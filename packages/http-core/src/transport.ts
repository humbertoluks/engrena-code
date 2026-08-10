import type { IncomingMessage, ServerResponse } from 'http'
import { DEFAULT_SESSION_HEADER } from './session.js'

export function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(body === undefined ? undefined : JSON.stringify(body))
}

export function sendError(
  res: ServerResponse,
  status: number,
  code: string,
  message: string,
  details?: object
): void {
  sendJson(res, status, { error: { code, message, ...(details ? { details } : {}) } })
}

/** 32 MiB — above the largest legitimate payload (composer: up to 5 images × 4 MiB base64 + JSON). */
export const MAX_BODY_BYTES = 32 * 1024 * 1024

export class PayloadTooLargeError extends Error {
  constructor() {
    super('Corpo da requisição excede o limite permitido.')
    this.name = 'PayloadTooLargeError'
  }
}

export async function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = ''
    let bytes = 0
    let settled = false
    req.on('data', (chunk) => {
      if (settled) return
      bytes += chunk.length
      if (bytes > MAX_BODY_BYTES) {
        settled = true
        // Pause (don't destroy) so the handler can still write 413 payload_too_large.
        req.pause()
        reject(new PayloadTooLargeError())
        return
      }
      body += chunk.toString()
    })
    req.on('end', () => {
      if (!settled) resolve(body)
    })
    req.on('error', (err) => {
      if (!settled) reject(err)
    })
  })
}

/** Handles shared transport errors (e.g. oversized body) before each handler's generic catch-all. */
export function sendTransportError(res: ServerResponse, err: unknown): boolean {
  if (err instanceof PayloadTooLargeError) {
    if (!res.headersSent) sendError(res, 413, 'payload_too_large', err.message)
    return true
  }
  return false
}

export function parseBody<T>(raw: string): T | null {
  if (raw.trim() === '') return {} as T
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

export interface SessionAuth {
  isLocked: () => boolean
  getSessionToken: () => string | null | undefined
}

export interface GuardOptions {
  /** HTTP header carrying the session token (default: x-engrenacode-session). */
  sessionHeader?: string
}

/**
 * Factory for the shared HTTP guard.
 * Order is invariant: vault locked → 423 BEFORE session token → 401.
 */
export function createGuard(auth: SessionAuth, options?: GuardOptions) {
  const sessionHeader = options?.sessionHeader ?? DEFAULT_SESSION_HEADER

  return function guard(req: IncomingMessage, res: ServerResponse): boolean {
    if (auth.isLocked()) {
      sendError(res, 423, 'vault_locked', 'Cofre local travado. Desbloqueie antes de continuar.')
      return false
    }

    const token = req.headers[sessionHeader]
    const valid = auth.getSessionToken()
    if (typeof token !== 'string' || !token || token !== valid) {
      sendError(res, 401, 'unauthorized', 'Sessão inválida.')
      return false
    }

    return true
  }
}
