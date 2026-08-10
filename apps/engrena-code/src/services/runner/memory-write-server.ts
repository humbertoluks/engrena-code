// Servidor HTTP loopback efêmero por turno (F20 spec §3.2 — mesmo padrão de
// delegate.ts:createDelegationServer) chamado pela tool MCP `write_memory` dentro do turno.
// Escreve e responde de imediato (sem pausar o turno, diferente de ask-user-question.ts).
import { randomBytes } from 'crypto'
import http from 'http'
import { appendEntry } from '../vault/memory-service.js'
import { createLogEntry } from '../db/repositories/log-entries.js'

export interface MemoryWriteContext {
  projectId: string
  threadId: string
}

export interface MemoryWriteServerHandle {
  port: number
  token: string
  close: () => void
}

/** Falha ao escrever a entrada não falha o turno (spec 3.2) — sempre 200, `isError` sinaliza o resultado ao provider. */
export function createMemoryWriteServer(
  ctx: MemoryWriteContext,
  onEntryWritten?: () => void
): Promise<MemoryWriteServerHandle> {
  const token = randomBytes(24).toString('hex')

  const server = http.createServer((req, res) => {
    if (req.method !== 'POST' || req.url !== '/memory-entry') {
      res.writeHead(404)
      res.end()
      return
    }
    if (req.headers['x-memory-token'] !== token) {
      res.writeHead(403)
      res.end()
      return
    }

    let body = ''
    req.on('data', (chunk: Buffer) => {
      body += chunk.toString()
    })
    req.on('end', () => {
      try {
        const parsed = JSON.parse(body) as { summary?: unknown }
        const summary = typeof parsed.summary === 'string' ? parsed.summary : ''
        appendEntry({ projectId: ctx.projectId, threadId: ctx.threadId, summary })
        onEntryWritten?.()
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(
          JSON.stringify({
            content: [{ type: 'text', text: 'Entrada de memória registrada.' }],
            isError: false,
          })
        )
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro desconhecido ao gravar memória.'
        createLogEntry({
          threadId: ctx.threadId,
          kind: 'task',
          event: `memory: falha ao escrever entrada (${message})`,
        })
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(
          JSON.stringify({
            content: [{ type: 'text', text: 'Falha ao registrar memória; turno segue normalmente.' }],
            isError: true,
          })
        )
      }
    })
  })

  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      const port = typeof address === 'object' && address ? address.port : 0
      resolve({ port, token, close: () => server.close() })
    })
  })
}
