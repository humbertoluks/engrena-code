import type { IncomingMessage, ServerResponse } from 'http'
import { vaultService } from '../vault/vault-service.js'

export const SESSION_HEADER = 'x-engrenacode-session'

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

/** 32 MiB — acima do maior payload legítimo (composer: até 5 imagens x 4 MiB em base64 + overhead JSON). */
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

/** Trata erros do transport compartilhado (ex.: body grande demais) antes do catch-all genérico de cada handler. */
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

/** Returns true when the vault is unlocked and the session header matches. */
export function guard(req: IncomingMessage, res: ServerResponse): boolean {
  if (vaultService.isLocked()) {
    sendError(res, 423, 'vault_locked', 'Cofre local travado. Desbloqueie antes de continuar.')
    return false
  }

  const token = req.headers[SESSION_HEADER]
  const valid = vaultService.getSessionToken()
  if (typeof token !== 'string' || !token || token !== valid) {
    sendError(res, 401, 'unauthorized', 'Sessão inválida.')
    return false
  }

  return true
}
