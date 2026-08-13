import { afterEach, describe, expect, it } from 'vitest'
import { PERMISSION_BODY_MAX_BYTES } from './buffer-cap.js'
import {
  createPermissionServer,
  resolvePermissionRequest,
  denyPendingPermissionsForThread,
  hasPendingPermission,
  allowPendingPermissionsForThread,
  clearAllowedToolsForThread,
  listPendingPermissions,
  clearAllPendingPermissionsForTesting,
  type PermissionRequestInfo,
} from './permission-broker.js'

afterEach(() => {
  clearAllPendingPermissionsForTesting()
})

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

    const resolved = resolvePermissionRequest('thr_1', seen[0].requestId, true)
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

    resolvePermissionRequest('thr_3', seen[0].requestId, false)
    const res = await requestPromise
    const body = (await res.json()) as { allow: boolean }
    expect(body.allow).toBe(false)

    server.close()
  })
})

describe('resolvePermissionRequest', () => {
  it('is a silent no-op for an unknown requestId', () => {
    expect(() => resolvePermissionRequest('thr_x', 'does-not-exist', true)).not.toThrow()
    expect(resolvePermissionRequest('thr_x', 'does-not-exist', true)).toEqual({ ok: false, code: 'not_found' })
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
    expect(resolvePermissionRequest('thr_always', seen[0].requestId, true, true)).toEqual({
      ok: true,
      toolName: 'Bash',
    })
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

describe('resolvePermissionRequest (thread binding)', () => {
  it('does not resolve a requestId of another thread and keeps it pending for the owner', async () => {
    const seen: PermissionRequestInfo[] = []
    const server = await createPermissionServer('thr_owner', (info) => seen.push(info))

    const requestPromise = fetch(`http://127.0.0.1:${server.port}/permission`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-permission-token': server.token },
      body: JSON.stringify({ toolName: 'Write', toolInput: { file_path: 'a.txt' } }),
    })
    await new Promise((r) => setTimeout(r, 20))
    expect(seen).toHaveLength(1)

    // requestId válido, mas vindo do POST /api/threads/thr_intruso/permission.
    const wrong = resolvePermissionRequest('thr_intruso', seen[0].requestId, true)
    expect(wrong).toEqual({ ok: false, code: 'thread_mismatch' })
    // Nada consumido: a permissão continua pendente para a thread dona.
    expect(hasPendingPermission('thr_owner')).toBe(true)
    expect(listPendingPermissions('thr_owner')).toHaveLength(1)

    const right = resolvePermissionRequest('thr_owner', seen[0].requestId, true)
    expect(right).toEqual({ ok: true, toolName: 'Write' })
    expect((await requestPromise).status).toBe(200)
    expect(hasPendingPermission('thr_owner')).toBe(false)

    server.close()
  })
})

describe('POST /permission body cap (fail-closed)', () => {
  it(
    'never answers allow when the body blows past the cap',
    async () => {
      const seen: PermissionRequestInfo[] = []
      const server = await createPermissionServer('thr_cap', (info) => seen.push(info))

      const huge = JSON.stringify({
        toolName: 'Write',
        toolInput: { content: 'x'.repeat(PERMISSION_BODY_MAX_BYTES + 4096) },
      })

      let allow: unknown = 'sem resposta'
      try {
        const res = await fetch(`http://127.0.0.1:${server.port}/permission`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-permission-token': server.token },
          body: huge,
        })
        allow = ((await res.json()) as { allow?: unknown }).allow
      } catch {
        // Conexão derrubada pelo cap também é fail-closed (o hook cai no deny).
        allow = 'conexão derrubada'
      }

      expect(allow).not.toBe(true)
      // Nenhum pedido chega à UI — o body parcial não vira modal `unknown`.
      expect(seen).toEqual([])
      expect(hasPendingPermission('thr_cap')).toBe(false)

      server.close()
    },
    15_000
  )
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

describe('listPendingPermissions', () => {
  it('returns a snapshot of pending requests for the thread', async () => {
    const seen: PermissionRequestInfo[] = []
    const server = await createPermissionServer('thr_snap', (info) => seen.push(info))

    const req = fetch(`http://127.0.0.1:${server.port}/permission`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-permission-token': server.token },
      body: JSON.stringify({ toolName: 'Write', toolInput: { file_path: 'a.txt' } }),
    })
    await new Promise((r) => setTimeout(r, 20))

    const snap = listPendingPermissions('thr_snap')
    expect(snap).toHaveLength(1)
    expect(snap[0]).toMatchObject({
      requestId: seen[0].requestId,
      threadId: 'thr_snap',
      toolName: 'Write',
      params: { file_path: 'a.txt' },
    })
    expect(typeof snap[0].createdAt).toBe('number')
    expect(listPendingPermissions('other')).toEqual([])

    resolvePermissionRequest('thr_snap', seen[0].requestId, false)
    await req
    expect(listPendingPermissions('thr_snap')).toEqual([])
    server.close()
  })
})

describe('permission timeout (fail-closed)', () => {
  it('auto-denies and settles the hook HTTP when the user never answers', async () => {
    const seen: PermissionRequestInfo[] = []
    const server = await createPermissionServer('thr_timeout', (info) => seen.push(info), {
      timeoutMs: 40,
    })

    const requestPromise = fetch(`http://127.0.0.1:${server.port}/permission`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-permission-token': server.token },
      body: JSON.stringify({ toolName: 'Bash', toolInput: { command: 'sleep 999' } }),
    })

    await new Promise((r) => setTimeout(r, 20))
    expect(hasPendingPermission('thr_timeout')).toBe(true)
    expect(listPendingPermissions('thr_timeout')).toHaveLength(1)

    const res = await requestPromise
    const body = (await res.json()) as { allow: boolean }
    expect(body.allow).toBe(false)
    expect(hasPendingPermission('thr_timeout')).toBe(false)
    expect(listPendingPermissions('thr_timeout')).toEqual([])

    server.close()
  })

  it('clears the timeout when resolvePermissionRequest wins the race', async () => {
    const seen: PermissionRequestInfo[] = []
    const server = await createPermissionServer('thr_timeout_race', (info) => seen.push(info), {
      timeoutMs: 200,
    })

    const requestPromise = fetch(`http://127.0.0.1:${server.port}/permission`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-permission-token': server.token },
      body: JSON.stringify({ toolName: 'Write', toolInput: {} }),
    })
    await new Promise((r) => setTimeout(r, 15))
    expect(resolvePermissionRequest('thr_timeout_race', seen[0].requestId, true)).toEqual({
      ok: true,
      toolName: 'Write',
    })

    const res = await requestPromise
    expect(((await res.json()) as { allow: boolean }).allow).toBe(true)
    await new Promise((r) => setTimeout(r, 220))
    expect(hasPendingPermission('thr_timeout_race')).toBe(false)

    server.close()
  })
})
