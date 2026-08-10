import http from 'http'
import type { Duplex } from 'stream'
import { applyCors } from './cors.js'
import { DEFAULT_SESSION_HEADER } from './session.js'

export type LoopbackRequestHandler = (
  req: http.IncomingMessage,
  res: http.ServerResponse
) => boolean | Promise<boolean>

export type LoopbackUpgradeHandler = (
  req: http.IncomingMessage,
  socket: Duplex,
  head: Buffer
) => boolean

export interface CreateLoopbackServerOptions {
  port?: number
  host?: string
  /** Included in Access-Control-Allow-Headers (default: x-engrenacode-session). */
  sessionHeader?: string
  /** Return true when the request was handled (including error responses). */
  handleRequest: LoopbackRequestHandler
  /** Optional WebSocket upgrade; return true when handled. */
  handleUpgrade?: LoopbackUpgradeHandler
  onListening?: (info: { host: string; port: number }) => void
}

/**
 * Shared loopback HTTP server: CORS, OPTIONS preflight, JSON default Content-Type,
 * injectable request/upgrade handlers, and a 404 fallback.
 */
export function createLoopbackServer(options: CreateLoopbackServerOptions): http.Server {
  const host = options.host ?? '127.0.0.1'
  const port = options.port ?? 0
  const sessionHeader = options.sessionHeader ?? DEFAULT_SESSION_HEADER

  const server = http.createServer(async (req, res) => {
    res.setHeader('Content-Type', 'application/json')

    if (!applyCors(req, res, { sessionHeader })) return

    if (req.method === 'OPTIONS') {
      res.writeHead(204)
      res.end()
      return
    }

    try {
      const handled = await options.handleRequest(req, res)
      if (handled) return
    } catch (err) {
      console.error('[createLoopbackServer] Unhandled error:', err)
      if (!res.headersSent) {
        res.writeHead(500)
        res.end(JSON.stringify({ error: { code: 'internal_error', message: 'Erro interno.' } }))
      }
      return
    }

    if (!res.headersSent) {
      res.writeHead(404)
      res.end(JSON.stringify({ error: { code: 'not_found', message: 'Rota não encontrada.' } }))
    }
  })

  if (options.handleUpgrade) {
    const handleUpgrade = options.handleUpgrade
    server.on('upgrade', (req, socket, head) => {
      const handled = handleUpgrade(req, socket, head)
      if (!handled) {
        socket.destroy()
      }
    })
  }

  server.listen(port, host, () => {
    const address = server.address()
    const boundPort =
      typeof address === 'object' && address !== null ? address.port : typeof port === 'number' ? port : 0
    options.onListening?.({ host, port: boundPort })
  })

  return server
}
