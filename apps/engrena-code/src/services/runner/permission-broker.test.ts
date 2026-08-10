import { describe, expect, it } from 'vitest'
import {
  createPermissionServer,
  resolvePermissionRequest,
  denyPendingPermissionsForThread,
  hasPendingPermission,
  allowPendingPermissionsForThread,
  clearAllowedToolsForThread,
  type PermissionRequestInfo,
} from './permission-broker.js'

describe('createPermissionServer', () => {
  it('holds the /permission response open until resolvePermissionRequest is called', async () => {
    const seen: PermissionRequestInfo[] = []
    const server = await createPermissionServer('thr_1', (info) => seen.push(info))

    const requestPromise = fetch(`http://127.0.0.1:${server.port}/permission`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-permission-token': server.token },
      body: JSON.stringify({ toolName: 'Write', toolInput: { file_path: 'a.txt' } }),
    })

    let settled = false
    void requestPromise.then(() => {
      settled = true
    })

    await new Promise((r) => setTimeout(r, 30))
    expect(settled).toBe(false)
    expect(seen).toHaveLength(1)
    expect(seen[0].toolName).toBe('Write')
    expect(seen[0].threadId).toBe('thr_1')
    expect(hasPendingPermission('thr_1')).toBe(true)

    const resolved = resolvePermissionRequest(seen[0].requestId, true)
    expect(resolved).toEqual({ ok: true, toolName: 'Write' })

    const res = await requestPromise
    const body = (await res.json()) as { allow: boolean }
    expect(body.allow).toBe(true)
    expect(hasPendingPermission('thr_1')).toBe(false)

    server.close()
  })

  it('rejects requests with a wrong token', async () => {
    const server = await createPermissionServer('thr_2', () => {})

    const res = await fetch(`http://127.0.0.1:${server.port}/permission`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-permission-token': 'token-errado' },
      body: JSON.stringify({ toolName: 'Bash', toolInput: {} }),
    })

    expect(res.status).toBe(403)
    server.close()
  })

  it('responds allow:false when resolvePermissionRequest is called with allow=false', async () => {
    const seen: PermissionRequestInfo[] = []
    const server = await createPermissionServer('thr_3', (info) => seen.push(info))

    const requestPromise = fetch(`http://127.0.0.1:${server.port}/permission`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-permission-token': server.token },
      body: JSON.stringify({ toolName: 'Bash', toolInput: { command: 'rm -rf /' } }),
    })
    await new Promise((r) => setTimeout(r, 20))

    resolvePermissionRequest(seen[0].requestId, false)
    const res = await requestPromise
    const body = (await res.json()) as { allow: boolean }
    expect(body.allow).toBe(false)

    server.close()
  })
})

describe('resolvePermissionRequest', () => {
  it('is a silent no-op for an unknown requestId', () => {
    expect(() => resolvePermissionRequest('does-not-exist', true)).not.toThrow()
    expect(resolvePermissionRequest('does-not-exist', true)).toEqual({ ok: false })
  })

  it('rememberAllowedTool skips UI on the next matching tool call (Permitir todos)', async () => {
    const seen: PermissionRequestInfo[] = []
    const server = await createPermissionServer('thr_always', (info) => seen.push(info))

    const first = fetch(`http://127.0.0.1:${server.port}/permission`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-permission-token': server.token },
      body: JSON.stringify({ toolName: 'Bash', toolInput: { command: 'ls' } }),
    })
    await new Promise((r) => setTimeout(r, 20))
    expect(seen).toHaveLength(1)
    expect(resolvePermissionRequest(seen[0].requestId, true, true)).toEqual({ ok: true, toolName: 'Bash' })
    await first

    const second = await fetch(`http://127.0.0.1:${server.port}/permission`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-permission-token': server.token },
      body: JSON.stringify({ toolName: 'Bash', toolInput: { command: 'pwd' } }),
    })
    expect(((await second.json()) as { allow: boolean }).allow).toBe(true)
    expect(seen).toHaveLength(1)

    clearAllowedToolsForThread('thr_always')
    server.close()
  })
})

describe('allowPendingPermissionsForThread', () => {
  it('resolves every pending request for the thread with allow:true', async () => {
    const seen: PermissionRequestInfo[] = []
    const server = await createPermissionServer('thr_allow', (info) => seen.push(info))

    const req = fetch(`http://127.0.0.1:${server.port}/permission`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-permission-token': server.token },
      body: JSON.stringify({ toolName: 'Write', toolInput: {} }),
    })
    await new Promise((r) => setTimeout(r, 20))

    const ids = allowPendingPermissionsForThread('thr_allow')
    expect(ids).toEqual([seen[0].requestId])

    const res = await req
    expect(((await res.json()) as { allow: boolean }).allow).toBe(true)
    expect(hasPendingPermission('thr_allow')).toBe(false)

    server.close()
  })
})

describe('denyPendingPermissionsForThread', () => {
  it('resolves every pending request for the thread with allow:false, leaves other threads untouched', async () => {
    const seenA: PermissionRequestInfo[] = []
    const seenB: PermissionRequestInfo[] = []
    const serverA = await createPermissionServer('thr_a', (info) => seenA.push(info))
    const serverB = await createPermissionServer('thr_b', (info) => seenB.push(info))

    const reqA = fetch(`http://127.0.0.1:${serverA.port}/permission`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-permission-token': serverA.token },
      body: JSON.stringify({ toolName: 'Write', toolInput: {} }),
    })
    const reqB = fetch(`http://127.0.0.1:${serverB.port}/permission`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-permission-token': serverB.token },
      body: JSON.stringify({ toolName: 'Write', toolInput: {} }),
    })
    await new Promise((r) => setTimeout(r, 20))

    denyPendingPermissionsForThread('thr_a')

    const resA = await reqA
    expect(((await resA.json()) as { allow: boolean }).allow).toBe(false)
    expect(hasPendingPermission('thr_a')).toBe(false)
    expect(hasPendingPermission('thr_b')).toBe(true)

    denyPendingPermissionsForThread('thr_b')
    const resB = await reqB
    expect(((await resB.json()) as { allow: boolean }).allow).toBe(false)

    serverA.close()
    serverB.close()
  })

  it('is a silent no-op when there is nothing pending for the thread', () => {
    expect(() => denyPendingPermissionsForThread('thr_desconhecida')).not.toThrow()
  })
})
