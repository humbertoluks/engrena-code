import type { IncomingMessage } from 'http'
import type { Duplex } from 'stream'
import { WebSocketServer, type WebSocket } from 'ws'
import {
  DEFAULT_SESSION_SUBPROTOCOL_PREFIX,
  extractSessionTokenFromSubprotocol,
} from '@engrena/http-core'
import { vaultService } from '../vault/vault-service.js'
import { listPendingPermissions } from '../runner/permission-broker.js'
import { subscribe, unsubscribe } from '../runner/ws-hub.js'

/** Code session subprotocol prefix (package default; Plan can override). */
export const SESSION_SUBPROTOCOL_PREFIX = DEFAULT_SESSION_SUBPROTOCOL_PREFIX

const wss = new WebSocketServer({ noServer: true })

/** Upgrade WS no mesmo loopback 5174. Inscrição via `?threadId=`; auth só via subprotocol `engrenacode-session.<token>` — nunca `?token=` na query string, que vazaria em logs de proxy/histórico de URL. */
export function handleWorkspaceUpgrade(req: IncomingMessage, socket: Duplex, head: Buffer): boolean {
  const url = new URL(req.url ?? '', 'http://127.0.0.1')
  const threadId = url.searchParams.get('threadId')
  if (threadId === null) return false

  if (vaultService.isLocked()) {
    socket.write('HTTP/1.1 423 Locked\r\n\r\n')
    socket.destroy()
    return true
  }

  const token = extractSessionTokenFromSubprotocol(req, SESSION_SUBPROTOCOL_PREFIX)
  const valid = vaultService.getSessionToken()

  if (typeof token !== 'string' || !token || token !== valid) {
    socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n')
    socket.destroy()
    return true
  }

  wss.handleUpgrade(req, socket, head, (ws: WebSocket) => {
    subscribe(threadId, ws)

    const replayPending = (): void => {
      for (const pending of listPendingPermissions(threadId)) {
        if (ws.readyState === ws.OPEN) {
          ws.send(
            JSON.stringify({
              type: 'permission.request',
              threadId: pending.threadId,
              requestId: pending.requestId,
              toolName: pending.toolName,
              params: pending.params,
            })
          )
        }
      }
    }

    // Após handleUpgrade o socket costuma já estar OPEN; se ainda CONNECTING, espera o open.
    if (ws.readyState === ws.OPEN) replayPending()
    else ws.once('open', replayPending)

    ws.on('close', () => unsubscribe(threadId, ws))
    ws.on('error', () => unsubscribe(threadId, ws))
  })

  return true
}
