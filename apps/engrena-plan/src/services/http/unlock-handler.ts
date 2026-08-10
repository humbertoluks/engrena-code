import type http from 'http'
import { createLoopbackServer, readBody, sendTransportError } from '@engrena/http-core'
import { vaultService } from '../vault/vault-service.js'
import { getDb } from '../db/client.js'
import { SESSION_HEADER } from './_transport.js'

interface VaultUnlockResponse {
  unlocked: boolean
  sessionToken?: string
  retryAfterMs?: number
}

async function handleUnlockRequest(
  req: http.IncomingMessage,
  res: http.ServerResponse,
): Promise<boolean> {
  if (req.method !== 'POST' || req.url !== '/api/vault/unlock') return false

  let body: string
  try {
    body = await readBody(req)
  } catch (err) {
    if (sendTransportError(res, err)) return true
    console.error('Unlock body read error:', err)
    res.writeHead(500)
    res.end(
      JSON.stringify({
        error: {
          code: 'internal_error',
          message: 'Erro ao desbloquear cofre',
        },
      }),
    )
    return true
  }

  let data: unknown
  try {
    data = JSON.parse(body)
  } catch {
    res.writeHead(400)
    res.end(
      JSON.stringify({
        error: {
          code: 'invalid_json',
          message: 'Corpo inválido.',
        },
      }),
    )
    return true
  }

  try {
    const workspace =
      typeof data === 'object' && data !== null && 'workspace' in data
        ? (data as { workspace: unknown }).workspace
        : undefined
    const password =
      typeof data === 'object' && data !== null && 'password' in data
        ? (data as { password: unknown }).password
        : undefined

    if (typeof workspace !== 'string' || typeof password !== 'string' || !workspace || !password) {
      res.writeHead(400)
      res.end(
        JSON.stringify({
          error: {
            code: 'validation_error',
            message: 'workspace e password são obrigatórios',
          },
        }),
      )
      return true
    }

    const result = vaultService.unlock(workspace, password)

    if (result.corrupted) {
      res.writeHead(422)
      res.end(
        JSON.stringify({
          error: {
            code: 'vault_corrupted',
            message:
              'O cofre local está danificado ou ilegível. Restaure um backup ou recrie o workspace.',
          },
        }),
      )
      return true
    }

    const response: VaultUnlockResponse = {
      unlocked: result.unlocked,
    }

    if (result.unlocked) {
      const token = vaultService.getSessionToken()
      if (token) response.sessionToken = token
      // Ensure engrenaplan.db exists and migrations are applied after unlock.
      getDb()
    }

    if (result.retryAfterMs !== undefined) {
      response.retryAfterMs = result.retryAfterMs
    }

    res.writeHead(200)
    res.end(JSON.stringify(response))
  } catch (err) {
    console.error('Unlock error:', err)
    res.writeHead(500)
    res.end(
      JSON.stringify({
        error: {
          code: 'internal_error',
          message: 'Erro ao desbloquear cofre',
        },
      }),
    )
  }

  return true
}

/** Plan unlock loopback — porta 5184 (Code usa 5174). Sem rotas de domínio ainda. */
export function createUnlockServer(port: number = 5184): http.Server {
  return createLoopbackServer({
    port,
    sessionHeader: SESSION_HEADER,
    handleRequest: async (req, res) => {
      return handleUnlockRequest(req, res)
    },
    onListening: ({ port: bound }) => {
      console.log(`EngrenaPlan unlock server listening on http://127.0.0.1:${bound}`)
    },
  })
}
