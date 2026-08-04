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

let port: number
let server: ReturnType<typeof createUnlockServer>

beforeEach(() => {
  vaultService.lock()
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
})
