import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import WebSocket from 'ws'

process.env.ENGRENACODE_USER_DATA = mkdtempSync(join(tmpdir(), 'engrenacode_claude_f03_ws_'))

const { closeDb } = await import('../db/client.js')
const { vaultService } = await import('../vault/vault-service.js')
const { createUnlockServer } = await import('./unlock-handler.js')
const { emit } = await import('../runner/ws-hub.js')
const { createPermissionServer, resolvePermissionRequest, clearAllPendingPermissionsForTesting } =
  await import('../runner/permission-broker.js')

let port: number
let server: ReturnType<typeof createUnlockServer>

beforeEach(() => {
  vaultService.lock()
  clearAllPendingPermissionsForTesting()
})

afterAll(() => {
  server?.close()
  closeDb()
  rmSync(process.env.ENGRENACODE_USER_DATA as string, { recursive: true, force: true })
})

function openSocket(threadId: string, token: string): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/?threadId=${threadId}`, [`engrenacode-session.${token}`])
    ws.once('open', () => resolve(ws))
    ws.once('error', reject)
  })
}

describe('workspace WebSocket upgrade', () => {
  it('accepts a handshake with a valid session subprotocol and delivers ws-hub events', async () => {
    vaultService.unlock('workspace-teste', 'senha-forte-123')
    const token = vaultService.getSessionToken() as string

    server = createUnlockServer(0)
    await new Promise<void>((resolve) => server.once('listening', resolve))
    const address = server.address()
    port = typeof address === 'object' && address !== null ? address.port : 0

    const ws = await openSocket('thr_test_1', token)

    const received = new Promise((resolve) => {
      ws.once('message', (data) => resolve(JSON.parse(data.toString())))
    })

    emit('thr_test_1', { type: 'state.change', threadId: 'thr_test_1', state: 'idle' })

    const event = await received
    expect(event).toEqual({ type: 'state.change', threadId: 'thr_test_1', state: 'idle' })

    ws.close()
    server.close()
  })

  it('rejects the upgrade with 401 when the session token is wrong', async () => {
    vaultService.unlock('workspace-teste', 'senha-forte-123')

    server = createUnlockServer(0)
    await new Promise<void>((resolve) => server.once('listening', resolve))
    const address = server.address()
    port = typeof address === 'object' && address !== null ? address.port : 0

    await expect(openSocket('thr_test_2', 'token-invalido')).rejects.toBeTruthy()
    server.close()
  })

  it('rejects the upgrade when the token is only present as a ?token= query param, no subprotocol (R04)', async () => {
    vaultService.unlock('workspace-teste', 'senha-forte-123')
    const token = vaultService.getSessionToken() as string

    server = createUnlockServer(0)
    await new Promise<void>((resolve) => server.once('listening', resolve))
    const address = server.address()
    port = typeof address === 'object' && address !== null ? address.port : 0

    const ws = new WebSocket(`ws://127.0.0.1:${port}/?threadId=thr_test_3&token=${token}`)
    await new Promise<void>((resolve, reject) => {
      ws.once('open', () => reject(new Error('expected the handshake to be rejected')))
      ws.once('error', () => resolve())
    })
    server.close()
  })

  it('replays pending permission.request events on subscribe (Sprint 2 reconnect)', async () => {
    vaultService.unlock('workspace-teste', 'senha-forte-123')
    const token = vaultService.getSessionToken() as string

    const seen: Array<{ requestId: string }> = []
    const permServer = await createPermissionServer('thr_replay', (info) => seen.push(info))
    const pendingFetch = fetch(`http://127.0.0.1:${permServer.port}/permission`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-permission-token': permServer.token },
      body: JSON.stringify({ toolName: 'Bash', toolInput: { command: 'ls' } }),
    })
    await new Promise<void>((resolve, reject) => {
      const start = Date.now()
      const tick = setInterval(() => {
        if (seen.length > 0) {
          clearInterval(tick)
          resolve()
        } else if (Date.now() - start > 2000) {
          clearInterval(tick)
          reject(new Error('permission never pending'))
        }
      }, 10)
    })

    server = createUnlockServer(0)
    await new Promise<void>((resolve) => server.once('listening', resolve))
    const address = server.address()
    port = typeof address === 'object' && address !== null ? address.port : 0

    // Listener antes do open: o replay pode chegar no mesmo tick da conexão.
    const ws = new WebSocket(`ws://127.0.0.1:${port}/?threadId=thr_replay`, [
      `engrenacode-session.${token}`,
    ])
    const eventPromise = new Promise<Record<string, unknown>>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('no replay message')), 3000)
      ws.once('message', (data) => {
        clearTimeout(timer)
        resolve(JSON.parse(data.toString()) as Record<string, unknown>)
      })
      ws.once('error', (err) => {
        clearTimeout(timer)
        reject(err)
      })
    })
    await new Promise<void>((resolve, reject) => {
      ws.once('open', () => resolve())
      ws.once('error', reject)
    })

    const event = await eventPromise
    expect(event).toMatchObject({
      type: 'permission.request',
      threadId: 'thr_replay',
      requestId: seen[0].requestId,
      toolName: 'Bash',
    })

    resolvePermissionRequest('thr_replay', seen[0].requestId, false)
    await pendingFetch
    ws.close()
    permServer.close()
    server.close()
  }, 15_000)
})
