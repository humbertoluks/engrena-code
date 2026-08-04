import type { IncomingMessage } from 'http'
import type { Duplex } from 'stream'
import { WebSocketServer, type WebSocket } from 'ws'
import { vaultService } from '../vault/vault-service.js'
import { subscribe, unsubscribe } from '../runner/ws-hub.js'

const SESSION_SUBPROTOCOL_PREFIX = 'engrenacode-session.'

const wss = new WebSocketServer({ noServer: true })

function extractToken(req: IncomingMessage, url: URL): string | null {
  const protoHeader = req.headers['sec-websocket-protocol']
  if (typeof protoHeader === 'string') {
    const parts = protoHeader.split(',').map((p) => p.trim())
    const withPrefix = parts.find((p) => p.startsWith(SESSION_SUBPROTOCOL_PREFIX))
    if (withPrefix) return withPrefix.slice(SESSION_SUBPROTOCOL_PREFIX.length)
  }
  return url.searchParams.get('token')
}

/** Upgrade WS no mesmo loopback 5174. Inscrição via `?threadId=`; auth via subprotocol `engrenacode-session.<token>` ou `?token=`. */
export function handleWorkspaceUpgrade(req: IncomingMessage, socket: Duplex, head: Buffer): boolean {
  const url = new URL(req.url ?? '', 'http://127.0.0.1')
  const threadId = url.searchParams.get('threadId')
  if (threadId === null) return false

  const token = extractToken(req, url)
  const valid = vaultService.getSessionToken()

  if (vaultService.isLocked() || typeof token !== 'string' || !token || token !== valid) {
    socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n')
    socket.destroy()
    return true
  }

  wss.handleUpgrade(req, socket, head, (ws: WebSocket) => {
    subscribe(threadId, ws)
    ws.on('close', () => unsubscribe(threadId, ws))
    ws.on('error', () => unsubscribe(threadId, ws))
  })

  return true
}
