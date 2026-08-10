import type { IncomingMessage, ServerResponse } from 'http'
import { DEFAULT_SESSION_HEADER } from './session.js'

/**
 * Loopback API is only callable from the Vite/Electron renderer on this machine.
 * Missing Origin = non-browser client (axios/curl/tests). `null` = file:// in production.
 */
export function isAllowedLoopbackOrigin(origin: string | undefined): boolean {
  if (origin === undefined || origin === '') return true
  if (origin === 'null') return true
  try {
    const url = new URL(origin)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return false
    return url.hostname === '127.0.0.1' || url.hostname === 'localhost'
  } catch {
    return false
  }
}

export interface ApplyCorsOptions {
  sessionHeader?: string
}

/** Returns false when the origin was denied (response already written). */
export function applyCors(
  req: IncomingMessage,
  res: ServerResponse,
  options?: ApplyCorsOptions
): boolean {
  const sessionHeader = options?.sessionHeader ?? DEFAULT_SESSION_HEADER
  const raw = req.headers.origin
  const origin = Array.isArray(raw) ? raw[0] : raw

  if (typeof origin === 'string' && origin !== '' && !isAllowedLoopbackOrigin(origin)) {
    res.writeHead(403, { 'Content-Type': 'application/json' })
    res.end(
      JSON.stringify({
        error: { code: 'cors_denied', message: 'Origem não permitida.' },
      })
    )
    return false
  }

  if (typeof origin === 'string' && origin !== '' && isAllowedLoopbackOrigin(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin)
    res.setHeader('Vary', 'Origin')
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', `Content-Type, ${sessionHeader}`)
  }

  return true
}
