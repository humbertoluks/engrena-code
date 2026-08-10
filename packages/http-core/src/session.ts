import type { IncomingMessage } from 'http'

/** Default session header used by EngrenaCode (Plan can override). */
export const DEFAULT_SESSION_HEADER = 'x-engrenacode-session'

/** Default WS subprotocol prefix: `<prefix><token>` (Code: `engrenacode-session.`). */
export const DEFAULT_SESSION_SUBPROTOCOL_PREFIX = 'engrenacode-session.'

/**
 * Extract session token from Sec-WebSocket-Protocol.
 * Never read `?token=` from the query string — that leaks into proxy/URL history.
 */
export function extractSessionTokenFromSubprotocol(
  req: IncomingMessage,
  prefix: string = DEFAULT_SESSION_SUBPROTOCOL_PREFIX
): string | null {
  const protoHeader = req.headers['sec-websocket-protocol']
  if (typeof protoHeader === 'string') {
    const parts = protoHeader.split(',').map((p) => p.trim())
    const withPrefix = parts.find((p) => p.startsWith(prefix))
    if (withPrefix) return withPrefix.slice(prefix.length)
  }
  return null
}
