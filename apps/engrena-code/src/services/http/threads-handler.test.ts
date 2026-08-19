import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest'
import { execFileSync } from 'child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import type { IncomingMessage, ServerResponse } from 'http'

process.env.ENGRENACODE_USER_DATA = mkdtempSync(join(tmpdir(), 'engrenacode_claude_f03_threads_http_'))

const { getDb, closeDb } = await import('../db/client.js')
const { vaultService } = await import('../vault/vault-service.js')
const { createProject } = await import('../db/repositories/projects.js')
const { createThread, getThread, updateThread } = await import('../db/repositories/threads.js')
// `updateToolCall` entrou com F33: a listagem passa a mandar preview e o corpo sai sob demanda.
const { createToolCall, appendMessage, updateToolCall } = await import('../db/repositories/messages.js')
const { createAskUserQuestionServer } = await import('../runner/ask-user-question.js')
const { createPermissionServer } = await import('../runner/permission-broker.js')
const {
  hasOpenPermissionGate: hasPendingPermission,
  listOpenPermissionGates: listPendingPermissions,
  resolvePermissionGate: resolvePermissionRequest,
  expireOpenPermissionGates,
  expireOpenQuestionGates,
  openPermissionGate,
  openQuestionGate,
  hasOpenQuestionGate,
  listOpenQuestionGates,
} = await import('../runner/gate.js')
const { setRunCliTurnForTesting, resetRunCliTurnForTesting } = await import('../runner/dispatch.js')
const { subscribe } = await import('../runner/ws-hub.js')
const {
  setRunCliTurnForTesting: setFollowupRunCliTurnForTesting,
  resetRunCliTurnForTesting: resetFollowupRunCliTurnForTesting,
} = await import('../threads/followups.js')
const { clearAllFollowupsForTesting, getCachedFollowups, resolveFollowups } = await import(
  '../threads/followups-cache.js'
)
const {
  setRunCliTurnForTesting: setDelegateRunCliTurnForTesting,
  resetRunCliTurnForTesting: resetDelegateRunCliTurnForTesting,
} = await import('../runner/delegate.js')
const { clearAllLeases } = await import('../runner/project-execution.js')
const { handleThreadsRequest } = await import('./threads-handler.js')
const { createSubagent, createSubagentRun, upsertProjectSubagentLink } = await import('../db/repositories/subagents.js')
const { createDiff, getDiff } = await import('../db/repositories/diffs.js')
const { createUsageEvent } = await import('../db/repositories/usage-events.js')
const { upsertUsageLimit } = await import('../db/repositories/usage-limits.js')

function initGitRepo(path: string): void {
  execFileSync('git', ['init'], { cwd: path })
  execFileSync(
    'git',
    ['-c', 'user.name=Test', '-c', 'user.email=test@local', 'commit', '--allow-empty', '-m', 'init'],
    { cwd: path }
  )
}

function makeProjectDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'engrenacode_claude_f03_threads_http_fixture_'))
  initGitRepo(dir)
  return dir
}

interface FakeResult {
  status: number
  body: unknown
}

function fakeReq(method: string, url: string, body?: unknown, session?: string): IncomingMessage {
  const raw = body !== undefined ? JSON.stringify(body) : ''
  const listeners: Record<string, Array<(...args: unknown[]) => void>> = {}
  const req = {
    method,
    url,
    headers: session !== undefined ? { 'x-engrenacode-session': session } : {},
    on(event: string, cb: (...args: unknown[]) => void) {
      listeners[event] = listeners[event] ?? []
      listeners[event].push(cb)
      if (event === 'end') {
        queueMicrotask(() => {
          for (const dataCb of listeners['data'] ?? []) dataCb(raw)
          for (const endCb of listeners['end'] ?? []) endCb()
        })
      }
      return req
    },
  }
  return req as unknown as IncomingMessage
}

function fakeRes(): ServerResponse & { result: () => Promise<FakeResult> } {
  let resolveDone: (r: FakeResult) => void
  const done = new Promise<FakeResult>((resolve) => {
    resolveDone = resolve
  })
  let status = 0
  const res = {
    headersSent: false,
    writeHead(code: number) {
      status = code
      res.headersSent = true
      return res
    },
    end(chunk?: string) {
      resolveDone({ status, body: chunk ? JSON.parse(chunk) : undefined })
    },
    result: () => done,
  }
  return res as unknown as ServerResponse & { result: () => Promise<FakeResult> }
}

let session: string

beforeEach(() => {
  // Sugestões são geradas por um processo de provider próprio (fora do stub do dispatch): sem este
  // stub o fim de turno de qualquer teste com assinante do stream spawna o CLI real.
  setFollowupRunCliTurnForTesting(async () => ({ text: '[]' }))
  clearAllFollowupsForTesting()
  getDb().exec('DELETE FROM diffs')
  getDb().exec('DELETE FROM tool_calls')
  getDb().exec('DELETE FROM messages')
  getDb().exec('DELETE FROM usage_events')
  getDb().exec('DELETE FROM usage_limits')
  getDb().exec('DELETE FROM threads')
  getDb().exec('DELETE FROM projects')
  clearAllLeases()
  vaultService.lock()
  vaultService.unlock('workspace-teste', 'senha-forte-123')
  session = vaultService.getSessionToken() as string
})

afterEach(() => {
  resetRunCliTurnForTesting()
  resetDelegateRunCliTurnForTesting()
})

afterAll(() => {
  closeDb()
  rmSync(process.env.ENGRENACODE_USER_DATA as string, { recursive: true, force: true })
})

function waitFor(predicate: () => boolean, timeoutMs = 3000): Promise<void> {
  return new Promise((resolve, reject) => {
    const start = Date.now()
    const interval = setInterval(() => {
      if (predicate()) {
        clearInterval(interval)
        resolve()
      } else if (Date.now() - start > timeoutMs) {
        clearInterval(interval)
        reject(new Error('timeout'))
      }
    }, 10)
  })
}

describe('handleThreadsRequest', () => {
  it('dispatches a new thread with a stream path (201)', async () => {
    const dir = makeProjectDir()
    const project = createProject({ path: dir })
    setRunCliTurnForTesting(async () => ({ text: 'ok' }))

    const req = fakeReq(
      'POST',
      `/api/projects/${project.id}/threads`,
      { prompt: 'oi', provider: 'claude', accessLevel: 'supervised', executionMode: 'main' },
      session
    )
    const res = fakeRes()
    await handleThreadsRequest(req, res)
    const { status, body } = await res.result()
    expect(status).toBe(201)
    const parsed = body as { thread: { id: string; state: string }; stream: { ws: string } }
    expect(parsed.thread.state).toBe('running')
    expect(parsed.stream.ws).toBe(`/?threadId=${parsed.thread.id}`)

    await waitFor(() => getThread(parsed.thread.id)?.state === 'idle')
    rmSync(dir, { recursive: true, force: true })
  })

  it('carrega clientMessageId até a mensagem persistida e o devolve no histórico', async () => {
    const dir = makeProjectDir()
    const project = createProject({ path: dir })
    setRunCliTurnForTesting(async () => ({ text: 'ok' }))

    const createReq = fakeReq(
      'POST',
      `/api/projects/${project.id}/threads`,
      {
        prompt: 'primeiro',
        provider: 'claude',
        accessLevel: 'supervised',
        executionMode: 'main',
        clientMessageId: 'bolha-1',
      },
      session
    )
    const createRes = fakeRes()
    await handleThreadsRequest(createReq, createRes)
    const created = (await createRes.result()).body as { thread: { id: string } }
    await waitFor(() => getThread(created.thread.id)?.state === 'idle')

    const followReq = fakeReq(
      'POST',
      `/api/threads/${created.thread.id}/messages`,
      { prompt: 'segundo', clientMessageId: 'bolha-2' },
      session
    )
    await handleThreadsRequest(followReq, fakeRes())
    await waitFor(() => getThread(created.thread.id)?.state === 'idle')

    const historyReq = fakeReq('GET', `/api/threads/${created.thread.id}/history`, undefined, session)
    const historyRes = fakeRes()
    await handleThreadsRequest(historyReq, historyRes)
    const { status, body } = await historyRes.result()
    expect(status).toBe(200)
    const messages = (body as { messages: Array<{ role: string; content: string; clientId: string | null }> }).messages
    expect(messages.filter((m) => m.role === 'user').map((m) => m.clientId)).toEqual(['bolha-1', 'bolha-2'])
    // Resposta do agente nasce no servidor: nunca carrega id de bolha.
    expect(messages.filter((m) => m.role === 'assistant').every((m) => m.clientId === null)).toBe(true)

    rmSync(dir, { recursive: true, force: true })
  })

  it('mantém o contrato antigo: sem clientMessageId a mensagem persiste com clientId null', async () => {
    const dir = makeProjectDir()
    const project = createProject({ path: dir })
    setRunCliTurnForTesting(async () => ({ text: 'ok' }))

    const req = fakeReq(
      'POST',
      `/api/projects/${project.id}/threads`,
      { prompt: 'oi', provider: 'claude', accessLevel: 'supervised', executionMode: 'main' },
      session
    )
    const res = fakeRes()
    await handleThreadsRequest(req, res)
    const { status, body } = await res.result()
    expect(status).toBe(201)
    const created = body as { thread: { id: string } }
    await waitFor(() => getThread(created.thread.id)?.state === 'idle')

    const historyRes = fakeRes()
    await handleThreadsRequest(
      fakeReq('GET', `/api/threads/${created.thread.id}/history`, undefined, session),
      historyRes
    )
    const messages = ((await historyRes.result()).body as { messages: Array<{ role: string; clientId: string | null }> })
      .messages
    expect(messages.find((m) => m.role === 'user')?.clientId).toBeNull()

    rmSync(dir, { recursive: true, force: true })
  })

  it('rejeita clientMessageId que não seja texto curto não vazio (400 validation_error)', async () => {
    const dir = makeProjectDir()
    const project = createProject({ path: dir })

    for (const clientMessageId of [42, '', 'x'.repeat(129)]) {
      const req = fakeReq(
        'POST',
        `/api/projects/${project.id}/threads`,
        { prompt: 'oi', provider: 'claude', accessLevel: 'supervised', executionMode: 'main', clientMessageId },
        session
      )
      const res = fakeRes()
      await handleThreadsRequest(req, res)
      const { status, body } = await res.result()
      expect(status).toBe(400)
      expect((body as { error: { code: string } }).error.code).toBe('validation_error')
    }

    rmSync(dir, { recursive: true, force: true })
  })

  it('lists threads for a project (GET)', async () => {
    const dir = makeProjectDir()
    const project = createProject({ path: dir })
    setRunCliTurnForTesting(async () => ({ text: 'ok' }))

    const createReq = fakeReq(
      'POST',
      `/api/projects/${project.id}/threads`,
      { prompt: 'oi', provider: 'claude', accessLevel: 'supervised', executionMode: 'main' },
      session
    )
    const createRes = fakeRes()
    await handleThreadsRequest(createReq, createRes)
    const created = (await createRes.result()).body as { thread: { id: string } }
    await waitFor(() => getThread(created.thread.id)?.state === 'idle')

    const req = fakeReq('GET', `/api/projects/${project.id}/threads`, undefined, session)
    const res = fakeRes()
    await handleThreadsRequest(req, res)
    const { status, body } = await res.result()
    expect(status).toBe(200)
    expect((body as { threads: Array<{ id: string }> }).threads.some((t) => t.id === created.thread.id)).toBe(true)

    rmSync(dir, { recursive: true, force: true })
  })

  it('rejects invalid provider with 400 validation_error', async () => {
    const dir = makeProjectDir()
    const project = createProject({ path: dir })

    const req = fakeReq(
      'POST',
      `/api/projects/${project.id}/threads`,
      { prompt: 'oi', provider: 'gpt4', accessLevel: 'supervised', executionMode: 'main' },
      session
    )
    const res = fakeRes()
    await handleThreadsRequest(req, res)
    const { status, body } = await res.result()
    expect(status).toBe(400)
    expect((body as { error: { code: string } }).error.code).toBe('validation_error')
    rmSync(dir, { recursive: true, force: true })
  })

  it('test_threads_accept_glm_grok_providers (F23) — accepts glm and grok', async () => {
    setRunCliTurnForTesting(async () => ({ text: 'ok' }))

    for (const provider of ['glm', 'grok']) {
      const dir = makeProjectDir()
      const project = createProject({ path: dir })
      const req = fakeReq(
        'POST',
        `/api/projects/${project.id}/threads`,
        { prompt: 'oi', provider, accessLevel: 'supervised', executionMode: 'main' },
        session
      )
      const res = fakeRes()
      await handleThreadsRequest(req, res)
      const { status, body } = await res.result()
      expect(status).toBe(201)
      const thread = (body as { thread: { id: string; provider: string } }).thread
      expect(thread.provider).toBe(provider)
      await waitFor(() => getThread(thread.id)?.state === 'idle')
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('returns 409 thread_busy on a second dispatch while the project is leased', async () => {
    const dir = makeProjectDir()
    const project = createProject({ path: dir })
    setRunCliTurnForTesting(() => new Promise(() => {}))

    const req1 = fakeReq(
      'POST',
      `/api/projects/${project.id}/threads`,
      { prompt: 'primeira', provider: 'claude', accessLevel: 'supervised', executionMode: 'main' },
      session
    )
    await handleThreadsRequest(req1, fakeRes())

    const req2 = fakeReq(
      'POST',
      `/api/projects/${project.id}/threads`,
      { prompt: 'segunda', provider: 'claude', accessLevel: 'supervised', executionMode: 'main' },
      session
    )
    const res2 = fakeRes()
    await handleThreadsRequest(req2, res2)
    const { status, body } = await res2.result()
    expect(status).toBe(409)
    expect((body as { error: { code: string } }).error.code).toBe('thread_busy')

    clearAllLeases()
    rmSync(dir, { recursive: true, force: true })
  })

  it('returns 409 usage_limit_exceeded when the project is over a blocking limit (F25)', async () => {
    const dir = makeProjectDir()
    const project = createProject({ path: dir })
    const seedThread = createThread({ projectId: project.id, provider: 'claude', accessLevel: 'supervised', executionMode: 'main' })
    createUsageEvent({
      turnId: 't1',
      projectId: project.id,
      threadId: seedThread.id,
      source: 'agent',
      provider: 'claude',
      billingMode: 'subscription',
      inputTokens: 1,
      outputTokens: 1,
      costUsd: 10,
      costSource: 'sdk',
    })
    upsertUsageLimit({ scope: 'project', projectId: project.id, limitUsd: 10, mode: 'block' })

    const req = fakeReq(
      'POST',
      `/api/projects/${project.id}/threads`,
      { prompt: 'oi', provider: 'claude', accessLevel: 'supervised', executionMode: 'main' },
      session
    )
    const res = fakeRes()
    await handleThreadsRequest(req, res)
    const { status, body } = await res.result()
    expect(status).toBe(409)
    const parsed = body as { error: { code: string; details: { adjustHash: string } } }
    expect(parsed.error.code).toBe('usage_limit_exceeded')
    expect(parsed.error.details.adjustHash).toBe('#consumo')

    rmSync(dir, { recursive: true, force: true })
  })

  it('rejects a follow-up body carrying provider with 400', async () => {
    const dir = makeProjectDir()
    const project = createProject({ path: dir })
    setRunCliTurnForTesting(async () => ({ text: 'ok' }))

    const createReq = fakeReq(
      'POST',
      `/api/projects/${project.id}/threads`,
      { prompt: 'oi', provider: 'claude', accessLevel: 'supervised', executionMode: 'main' },
      session
    )
    const createRes = fakeRes()
    await handleThreadsRequest(createReq, createRes)
    const created = (await createRes.result()).body as { thread: { id: string } }
    await waitFor(() => getThread(created.thread.id)?.state === 'idle')

    const req = fakeReq(
      'POST',
      `/api/threads/${created.thread.id}/messages`,
      { prompt: 'de novo', provider: 'codex' },
      session
    )
    const res = fakeRes()
    await handleThreadsRequest(req, res)
    const { status, body } = await res.result()
    expect(status).toBe(400)
    expect((body as { error: { code: string } }).error.code).toBe('validation_error')
    rmSync(dir, { recursive: true, force: true })
  })

  it('rejects a follow-up body carrying executionMode with 400 (execution mode locked after first send)', async () => {
    const dir = makeProjectDir()
    const project = createProject({ path: dir })
    setRunCliTurnForTesting(async () => ({ text: 'ok' }))

    const createReq = fakeReq(
      'POST',
      `/api/projects/${project.id}/threads`,
      { prompt: 'oi', provider: 'claude', accessLevel: 'supervised', executionMode: 'main' },
      session
    )
    const createRes = fakeRes()
    await handleThreadsRequest(createReq, createRes)
    const created = (await createRes.result()).body as { thread: { id: string } }
    await waitFor(() => getThread(created.thread.id)?.state === 'idle')

    const req = fakeReq(
      'POST',
      `/api/threads/${created.thread.id}/messages`,
      { prompt: 'de novo', executionMode: 'worktree' },
      session
    )
    const res = fakeRes()
    await handleThreadsRequest(req, res)
    const { status, body } = await res.result()
    expect(status).toBe(400)
    expect((body as { error: { code: string } }).error.code).toBe('validation_error')
    rmSync(dir, { recursive: true, force: true })
  })

  it('returns history and diffs for a thread', async () => {
    const dir = makeProjectDir()
    const project = createProject({ path: dir })
    setRunCliTurnForTesting(async () => ({ text: 'resposta final' }))

    const createReq = fakeReq(
      'POST',
      `/api/projects/${project.id}/threads`,
      { prompt: 'oi', provider: 'claude', accessLevel: 'supervised', executionMode: 'main' },
      session
    )
    const createRes = fakeRes()
    await handleThreadsRequest(createReq, createRes)
    const created = (await createRes.result()).body as { thread: { id: string } }

    await waitFor(() => getThread(created.thread.id)?.state === 'idle')

    const historyReq = fakeReq('GET', `/api/threads/${created.thread.id}/history`, undefined, session)
    const historyRes = fakeRes()
    await handleThreadsRequest(historyReq, historyRes)
    const historyBody = (await historyRes.result()).body as {
      messages: unknown[]
      subagentRuns: unknown[]
      pipeline: unknown
    }
    expect(historyBody.messages.length).toBeGreaterThanOrEqual(1)
    expect(historyBody.subagentRuns).toEqual([])
    expect(historyBody.pipeline).toBeNull()

    const diffsReq = fakeReq('GET', `/api/threads/${created.thread.id}/diffs`, undefined, session)
    const diffsRes = fakeRes()
    await handleThreadsRequest(diffsReq, diffsRes)
    const diffsBody = (await diffsRes.result()).body as { diffs: unknown[] }
    expect(Array.isArray(diffsBody.diffs)).toBe(true)
    rmSync(dir, { recursive: true, force: true })
  })

  it('history includes subagentRuns ordered by created_at ASC (F15)', async () => {
    const dir = makeProjectDir()
    const project = createProject({ path: dir })
    setRunCliTurnForTesting(async () => ({ text: 'ok' }))

    const createReq = fakeReq(
      'POST',
      `/api/projects/${project.id}/threads`,
      { prompt: 'oi', provider: 'claude', accessLevel: 'supervised', executionMode: 'main' },
      session
    )
    const createRes = fakeRes()
    await handleThreadsRequest(createReq, createRes)
    const created = (await createRes.result()).body as { thread: { id: string } }
    await waitFor(() => getThread(created.thread.id)?.state === 'idle')

    const subagent = createSubagent({
      name: 'revisor',
      description: 'revisa',
      prompt: 'revise com cuidado',
      provider: 'claude',
    })
    createSubagentRun({
      childThreadId: 'child-1',
      parentThreadId: created.thread.id,
      subagentName: subagent.name,
      provider: 'claude',
      status: 'completed',
    })

    const historyReq = fakeReq('GET', `/api/threads/${created.thread.id}/history`, undefined, session)
    const historyRes = fakeRes()
    await handleThreadsRequest(historyReq, historyRes)
    const historyBody = (await historyRes.result()).body as {
      subagentRuns: Array<{ childThreadId: string; subagentName: string; status: string }>
    }
    expect(historyBody.subagentRuns).toHaveLength(1)
    expect(historyBody.subagentRuns[0]?.childThreadId).toBe('child-1')
    expect(historyBody.subagentRuns[0]?.subagentName).toBe('revisor')
    expect(historyBody.subagentRuns[0]?.status).toBe('completed')

    rmSync(dir, { recursive: true, force: true })
  })

  it('cancel returns false when there is no active turn', async () => {
    const dir = makeProjectDir()
    const project = createProject({ path: dir })
    setRunCliTurnForTesting(async () => ({ text: 'ok' }))

    const createReq = fakeReq(
      'POST',
      `/api/projects/${project.id}/threads`,
      { prompt: 'oi', provider: 'claude', accessLevel: 'supervised', executionMode: 'main' },
      session
    )
    const createRes = fakeRes()
    await handleThreadsRequest(createReq, createRes)
    const created = (await createRes.result()).body as { thread: { id: string } }
    await waitFor(() => getThread(created.thread.id)?.state === 'idle')

    const req = fakeReq('POST', `/api/threads/${created.thread.id}/cancel`, undefined, session)
    const res = fakeRes()
    await handleThreadsRequest(req, res)
    const { status, body } = await res.result()
    expect(status).toBe(200)
    expect((body as { cancelled: boolean }).cancelled).toBe(false)
    rmSync(dir, { recursive: true, force: true })
  })

  it('gate resolve accepts an allow decision (200) and unblocks the pending PreToolUse hook', async () => {
    const dir = makeProjectDir()
    const project = createProject({ path: dir })

    let capturedAllow: boolean | undefined
    setRunCliTurnForTesting(async (input) => {
      const permRes = await fetch(`http://127.0.0.1:${input.permissionPort}/permission`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-permission-token': input.permissionToken ?? '' },
        body: JSON.stringify({ toolName: 'Write', toolInput: { file_path: 'x.txt' } }),
      })
      const permBody = (await permRes.json()) as { allow: boolean }
      capturedAllow = permBody.allow
      return { text: 'ok' }
    })

    const createReq = fakeReq(
      'POST',
      `/api/projects/${project.id}/threads`,
      { prompt: 'oi', provider: 'claude', accessLevel: 'supervised', executionMode: 'main' },
      session
    )
    const createRes = fakeRes()
    await handleThreadsRequest(createReq, createRes)
    const created = (await createRes.result()).body as { thread: { id: string } }

    const received: Array<Record<string, unknown>> = []
    const fakeSocket = { readyState: 1, OPEN: 1, send: (data: string) => received.push(JSON.parse(data)) }
    subscribe(created.thread.id, fakeSocket as unknown as Parameters<typeof subscribe>[1])

    await waitFor(() => received.some((e) => e.type === 'gate.opened'))
    const gateOpened = received.find((e) => e.type === 'gate.opened') as {
      gateId: string
      kind: string
      toolName: string
    }
    expect(gateOpened.kind).toBe('permission')
    expect(gateOpened.toolName).toBe('Write')

    const req = fakeReq(
      'POST',
      `/api/threads/${created.thread.id}/gate/${gateOpened.gateId}/resolve`,
      { kind: 'permission', allow: true },
      session
    )
    const res = fakeRes()
    await handleThreadsRequest(req, res)
    const { status, body } = await res.result()
    expect(status).toBe(200)
    expect((body as { resolved: boolean }).resolved).toBe(true)

    await waitFor(() => getThread(created.thread.id)?.state === 'idle')
    expect(capturedAllow).toBe(true)
    expect(
      received.some((e) => e.type === 'gate.resolved' && e.gateId === gateOpened.gateId && e.allow === true)
    ).toBe(true)
    rmSync(dir, { recursive: true, force: true })
  })

  it('gate resolve returns 409 gate_thread_mismatch for a gateId of another thread', async () => {
    const dir = makeProjectDir()
    const project = createProject({ path: dir })

    // Thread vizinha (turno trivial) — só para ter um :id diferente no path.
    setRunCliTurnForTesting(async () => ({ text: 'ok' }))
    const otherReq = fakeReq(
      'POST',
      `/api/projects/${project.id}/threads`,
      { prompt: 'outra', provider: 'claude', accessLevel: 'supervised', executionMode: 'main' },
      session
    )
    const otherRes = fakeRes()
    await handleThreadsRequest(otherReq, otherRes)
    const other = (await otherRes.result()).body as { thread: { id: string } }
    await waitFor(() => getThread(other.thread.id)?.state === 'idle')

    let capturedAllow: boolean | undefined
    setRunCliTurnForTesting(async (input) => {
      const permRes = await fetch(`http://127.0.0.1:${input.permissionPort}/permission`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-permission-token': input.permissionToken ?? '' },
        body: JSON.stringify({ toolName: 'Write', toolInput: { file_path: 'x.txt' } }),
      })
      capturedAllow = ((await permRes.json()) as { allow: boolean }).allow
      return { text: 'ok' }
    })

    const createReq = fakeReq(
      'POST',
      `/api/projects/${project.id}/threads`,
      { prompt: 'oi', provider: 'claude', accessLevel: 'supervised', executionMode: 'main' },
      session
    )
    const createRes = fakeRes()
    await handleThreadsRequest(createReq, createRes)
    const owner = (await createRes.result()).body as { thread: { id: string } }

    await waitFor(() => listPendingPermissions(owner.thread.id).length === 1)
    const gateId = listPendingPermissions(owner.thread.id)[0].requestId

    // gateId da thread dona chegando pelo path da vizinha: não resolve.
    const wrongReq = fakeReq(
      'POST',
      `/api/threads/${other.thread.id}/gate/${gateId}/resolve`,
      { kind: 'permission', allow: true },
      session
    )
    const wrongRes = fakeRes()
    await handleThreadsRequest(wrongReq, wrongRes)
    const wrong = await wrongRes.result()
    expect(wrong.status).toBe(409)
    expect((wrong.body as { error: { code: string } }).error.code).toBe('gate_thread_mismatch')
    expect(listPendingPermissions(owner.thread.id)).toHaveLength(1)

    // A thread dona continua conseguindo resolver depois da tentativa cruzada.
    const rightReq = fakeReq(
      'POST',
      `/api/threads/${owner.thread.id}/gate/${gateId}/resolve`,
      { kind: 'permission', allow: true },
      session
    )
    const rightRes = fakeRes()
    await handleThreadsRequest(rightReq, rightRes)
    expect((await rightRes.result()).status).toBe(200)

    await waitFor(() => getThread(owner.thread.id)?.state === 'idle')
    expect(capturedAllow).toBe(true)
    rmSync(dir, { recursive: true, force: true })
  })

  it('accepts a pending diff via POST /api/threads/:id/accept and moves the thread to committed', async () => {
    const dir = makeProjectDir()
    const project = createProject({ path: dir })
    setRunCliTurnForTesting(async (input) => {
      writeFileSync(join(input.cwd, 'gerado.txt'), 'conteudo\n')
      return { text: 'ok' }
    })

    const createReq = fakeReq(
      'POST',
      `/api/projects/${project.id}/threads`,
      {
        prompt: 'crie um arquivo',
        provider: 'claude',
        accessLevel: 'full-access',
        executionMode: 'main',
      },
      session
    )
    const createRes = fakeRes()
    await handleThreadsRequest(createReq, createRes)
    const created = (await createRes.result()).body as { thread: { id: string } }
    await waitFor(() => getThread(created.thread.id)?.state === 'idle')

    const req = fakeReq('POST', `/api/threads/${created.thread.id}/accept`, {}, session)
    const res = fakeRes()
    await handleThreadsRequest(req, res)
    const { status, body } = await res.result()
    expect(status).toBe(200)
    expect((body as { applied: boolean; acceptedIds: string[] }).acceptedIds).toHaveLength(1)
    expect(getThread(created.thread.id)?.state).toBe('committed')

    rmSync(dir, { recursive: true, force: true })
  })

  it('rejects accept body with both ids and paths (400 validation_error)', async () => {
    const dir = makeProjectDir()
    const project = createProject({ path: dir })
    setRunCliTurnForTesting(async () => ({ text: 'ok' }))

    const createReq = fakeReq(
      'POST',
      `/api/projects/${project.id}/threads`,
      { prompt: 'oi', provider: 'claude', accessLevel: 'supervised', executionMode: 'main' },
      session
    )
    const createRes = fakeRes()
    await handleThreadsRequest(createReq, createRes)
    const created = (await createRes.result()).body as { thread: { id: string } }
    await waitFor(() => getThread(created.thread.id)?.state === 'idle')

    const req = fakeReq(
      'POST',
      `/api/threads/${created.thread.id}/accept`,
      { ids: ['diff_x'], paths: ['a.txt'] },
      session
    )
    const res = fakeRes()
    await handleThreadsRequest(req, res)
    const { status, body } = await res.result()
    expect(status).toBe(400)
    expect((body as { error: { code: string } }).error.code).toBe('validation_error')

    rmSync(dir, { recursive: true, force: true })
  })

  it('rejects accept with non-array ids (400 validation_error)', async () => {
    const dir = makeProjectDir()
    const project = createProject({ path: dir })
    setRunCliTurnForTesting(async () => ({ text: 'ok' }))

    const createReq = fakeReq(
      'POST',
      `/api/projects/${project.id}/threads`,
      { prompt: 'oi', provider: 'claude', accessLevel: 'supervised', executionMode: 'main' },
      session
    )
    const createRes = fakeRes()
    await handleThreadsRequest(createReq, createRes)
    const created = (await createRes.result()).body as { thread: { id: string } }
    await waitFor(() => getThread(created.thread.id)?.state === 'idle')

    const req = fakeReq('POST', `/api/threads/${created.thread.id}/accept`, { ids: 5 }, session)
    const res = fakeRes()
    await handleThreadsRequest(req, res)
    const { status, body } = await res.result()
    expect(status).toBe(400)
    expect((body as { error: { code: string } }).error.code).toBe('validation_error')

    rmSync(dir, { recursive: true, force: true })
  })

  it('rejects accept with non-string paths elements (400 validation_error)', async () => {
    const dir = makeProjectDir()
    const project = createProject({ path: dir })
    setRunCliTurnForTesting(async () => ({ text: 'ok' }))

    const createReq = fakeReq(
      'POST',
      `/api/projects/${project.id}/threads`,
      { prompt: 'oi', provider: 'claude', accessLevel: 'supervised', executionMode: 'main' },
      session
    )
    const createRes = fakeRes()
    await handleThreadsRequest(createReq, createRes)
    const created = (await createRes.result()).body as { thread: { id: string } }
    await waitFor(() => getThread(created.thread.id)?.state === 'idle')

    const req = fakeReq(
      'POST',
      `/api/threads/${created.thread.id}/accept`,
      { paths: ['a.txt', 42] },
      session
    )
    const res = fakeRes()
    await handleThreadsRequest(req, res)
    const { status, body } = await res.result()
    expect(status).toBe(400)
    expect((body as { error: { code: string } }).error.code).toBe('validation_error')

    rmSync(dir, { recursive: true, force: true })
  })

  it('dispatches a worktree thread: 201 with worktreePath set, cwd isolated from project.path', async () => {
    const dir = makeProjectDir()
    const project = createProject({ path: dir })
    setRunCliTurnForTesting(async () => ({ text: 'ok' }))

    const req = fakeReq(
      'POST',
      `/api/projects/${project.id}/threads`,
      { prompt: 'oi', provider: 'claude', accessLevel: 'supervised', executionMode: 'worktree' },
      session
    )
    const res = fakeRes()
    await handleThreadsRequest(req, res)
    const { status, body } = await res.result()
    expect(status).toBe(201)
    const parsed = body as { thread: { id: string; worktreePath: string | null } }
    expect(parsed.thread.worktreePath).toBeTruthy()
    expect(parsed.thread.worktreePath).not.toBe(dir)

    await waitFor(() => getThread(parsed.thread.id)?.state === 'idle')
    rmSync(dir, { recursive: true, force: true })
    rmSync(parsed.thread.worktreePath as string, { recursive: true, force: true })
  })

  it('returns 400 worktree_git_required for a worktree dispatch when the project has no git HEAD', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'engrenacode_claude_f03_threads_http_nogit_'))
    const project = createProject({ path: dir })

    const req = fakeReq(
      'POST',
      `/api/projects/${project.id}/threads`,
      { prompt: 'oi', provider: 'claude', accessLevel: 'supervised', executionMode: 'worktree' },
      session
    )
    const res = fakeRes()
    await handleThreadsRequest(req, res)
    const { status, body } = await res.result()
    expect(status).toBe(400)
    expect((body as { error: { code: string; message: string } }).error.code).toBe('worktree_git_required')
    expect((body as { error: { message: string } }).error.message).toBe('Inicialize o Git antes de usar Worktree.')

    rmSync(dir, { recursive: true, force: true })
  })

  it('DELETE /api/threads/:id clears the followups cache of the thread', async () => {
    const dir = makeProjectDir()
    const project = createProject({ path: dir })
    setRunCliTurnForTesting(async () => ({ text: 'ok' }))

    const createReq = fakeReq(
      'POST',
      `/api/projects/${project.id}/threads`,
      { prompt: 'oi', provider: 'claude', accessLevel: 'supervised', executionMode: 'main' },
      session
    )
    const createRes = fakeRes()
    await handleThreadsRequest(createReq, createRes)
    const created = (await createRes.result()).body as { thread: { id: string } }
    await waitFor(() => getThread(created.thread.id)?.state === 'idle')

    // Gerador injetado: popular o cache não depende de rodar provider nenhum.
    await resolveFollowups(created.thread.id, 'msg_1', async () => ['e agora?'])
    expect(getCachedFollowups(created.thread.id, 'msg_1')).toEqual(['e agora?'])

    const req = fakeReq('DELETE', `/api/threads/${created.thread.id}`, undefined, session)
    const res = fakeRes()
    await handleThreadsRequest(req, res)
    expect((await res.result()).status).toBe(200)
    // Sem o clear no DELETE, a entrada sobrevivia à thread e só morria com o processo.
    expect(getCachedFollowups(created.thread.id, 'msg_1')).toBeNull()

    rmSync(dir, { recursive: true, force: true })
  })

  it('DELETE /api/threads/:id removes a main-mode thread (worktreeCleanup=none)', async () => {
    const dir = makeProjectDir()
    const project = createProject({ path: dir })
    setRunCliTurnForTesting(async () => ({ text: 'ok' }))

    const createReq = fakeReq(
      'POST',
      `/api/projects/${project.id}/threads`,
      { prompt: 'oi', provider: 'claude', accessLevel: 'supervised', executionMode: 'main' },
      session
    )
    const createRes = fakeRes()
    await handleThreadsRequest(createReq, createRes)
    const created = (await createRes.result()).body as { thread: { id: string } }
    await waitFor(() => getThread(created.thread.id)?.state === 'idle')

    const req = fakeReq('DELETE', `/api/threads/${created.thread.id}`, undefined, session)
    const res = fakeRes()
    await handleThreadsRequest(req, res)
    const { status, body } = await res.result()
    expect(status).toBe(200)
    expect(body).toEqual({ deleted: true, worktreeCleanup: 'none', warning: null })
    expect(getThread(created.thread.id)).toBeNull()

    rmSync(dir, { recursive: true, force: true })
  })

  it('DELETE /api/threads/:id removes a clean worktree and its branch (worktreeCleanup=removed)', async () => {
    const dir = makeProjectDir()
    const project = createProject({ path: dir })
    setRunCliTurnForTesting(async () => ({ text: 'ok' }))

    const createReq = fakeReq(
      'POST',
      `/api/projects/${project.id}/threads`,
      { prompt: 'oi', provider: 'claude', accessLevel: 'supervised', executionMode: 'worktree' },
      session
    )
    const createRes = fakeRes()
    await handleThreadsRequest(createReq, createRes)
    const created = (await createRes.result()).body as {
      thread: { id: string; worktreePath: string }
    }
    await waitFor(() => getThread(created.thread.id)?.state === 'idle')

    const req = fakeReq('DELETE', `/api/threads/${created.thread.id}`, undefined, session)
    const res = fakeRes()
    await handleThreadsRequest(req, res)
    const { status, body } = await res.result()
    expect(status).toBe(200)
    expect(body).toEqual({ deleted: true, worktreeCleanup: 'removed', warning: null })
    expect(getThread(created.thread.id)).toBeNull()

    rmSync(dir, { recursive: true, force: true })
  })

  it('DELETE /api/threads/:id returns 404 thread_not_found for an unknown id', async () => {
    const req = fakeReq('DELETE', '/api/threads/thr_nao_existe', undefined, session)
    const res = fakeRes()
    await handleThreadsRequest(req, res)
    const { status, body } = await res.result()
    expect(status).toBe(404)
    expect((body as { error: { code: string } }).error.code).toBe('thread_not_found')
  })

  describe('PATCH /api/threads/:id (accessLevel)', () => {
    it('persists accessLevel without a follow-up prompt', async () => {
      const dir = makeProjectDir()
      const project = createProject({ path: dir })
      const thread = createThread({
        projectId: project.id,
        provider: 'claude',
        accessLevel: 'supervised',
        executionMode: 'main',
        state: 'running',
      })

      const req = fakeReq('PATCH', `/api/threads/${thread.id}`, { accessLevel: 'auto-accept-edits' }, session)
      const res = fakeRes()
      await handleThreadsRequest(req, res)
      const { status, body } = await res.result()
      expect(status).toBe(200)
      expect((body as { thread: { accessLevel: string } }).thread.accessLevel).toBe('auto-accept-edits')
      expect(getThread(thread.id)?.accessLevel).toBe('auto-accept-edits')

      rmSync(dir, { recursive: true, force: true })
    })

    it('rejects an invalid accessLevel', async () => {
      const dir = makeProjectDir()
      const project = createProject({ path: dir })
      const thread = createThread({
        projectId: project.id,
        provider: 'claude',
        accessLevel: 'supervised',
        executionMode: 'main',
      })

      const req = fakeReq('PATCH', `/api/threads/${thread.id}`, { accessLevel: 'god-mode' }, session)
      const res = fakeRes()
      await handleThreadsRequest(req, res)
      const { status, body } = await res.result()
      expect(status).toBe(400)
      expect((body as { error: { code: string } }).error.code).toBe('validation_error')

      rmSync(dir, { recursive: true, force: true })
    })

    it('upgrade to auto-accept-edits allows a pending Write and keeps a pending Bash no modal', async () => {
      const dir = makeProjectDir()
      const project = createProject({ path: dir })
      const thread = createThread({
        projectId: project.id,
        provider: 'claude',
        accessLevel: 'supervised',
        executionMode: 'main',
        state: 'running',
      })

      const server = await createPermissionServer(thread.id, () => {})
      const ask = (toolName: string, toolInput: unknown): Promise<Response> =>
        fetch(`http://127.0.0.1:${server.port}/permission`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-permission-token': server.token },
          body: JSON.stringify({ toolName, toolInput }),
        })

      const writeFetch = ask('Write', { file_path: 'a.txt' })
      const bashFetch = ask('Bash', { command: 'echo hi' })
      await waitFor(() => listPendingPermissions(thread.id).length === 2)

      const req = fakeReq('PATCH', `/api/threads/${thread.id}`, { accessLevel: 'auto-accept-edits' }, session)
      const res = fakeRes()
      await handleThreadsRequest(req, res)
      expect((await res.result()).status).toBe(200)

      expect(((await (await writeFetch).json()) as { allow: boolean }).allow).toBe(true)
      const stillPending = listPendingPermissions(thread.id)
      expect(stillPending).toHaveLength(1)
      expect(stillPending[0].toolName).toBe('Bash')

      resolvePermissionRequest(thread.id, stillPending[0].requestId, true)
      expect(((await (await bashFetch).json()) as { allow: boolean }).allow).toBe(true)

      server.close()
      rmSync(dir, { recursive: true, force: true })
    })

    it('upgrade to full-access allows every pending permission', async () => {
      const dir = makeProjectDir()
      const project = createProject({ path: dir })
      const thread = createThread({
        projectId: project.id,
        provider: 'claude',
        accessLevel: 'supervised',
        executionMode: 'main',
        state: 'running',
      })

      const server = await createPermissionServer(thread.id, () => {})
      const pendingFetch = fetch(`http://127.0.0.1:${server.port}/permission`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-permission-token': server.token },
        body: JSON.stringify({ toolName: 'Bash', toolInput: { command: 'echo hi' } }),
      })
      await waitFor(() => hasPendingPermission(thread.id))

      const req = fakeReq('PATCH', `/api/threads/${thread.id}`, { accessLevel: 'full-access' }, session)
      const res = fakeRes()
      await handleThreadsRequest(req, res)
      expect((await res.result()).status).toBe(200)

      const body = (await (await pendingFetch).json()) as { allow: boolean }
      expect(body.allow).toBe(true)
      expect(hasPendingPermission(thread.id)).toBe(false)

      server.close()
      rmSync(dir, { recursive: true, force: true })
    })
  })

  describe('GET /api/threads/:id/gate', () => {
    function seedGatedThread(): { dir: string; threadId: string } {
      const dir = makeProjectDir()
      const project = createProject({ path: dir })
      const thread = createThread({
        projectId: project.id,
        provider: 'claude',
        accessLevel: 'supervised',
        executionMode: 'main',
        state: 'running',
      })
      return { dir, threadId: thread.id }
    }

    it('devolve os dois kinds abertos na ordem de abertura', async () => {
      const { dir, threadId } = seedGatedThread()
      const permission = openPermissionGate({ threadId, toolName: 'Bash', params: { command: 'ls' } })
      const question = openQuestionGate({ threadId, question: { prompt: 'Segue?', options: ['A'] } })
      if (!permission.ok || !question.ok) throw new Error('gate não abriu')
      void permission.decision
      void question.answer.catch(() => {})

      const req = fakeReq('GET', `/api/threads/${threadId}/gate`, undefined, session)
      const res = fakeRes()
      await handleThreadsRequest(req, res)
      const { status, body } = await res.result()
      expect(status).toBe(200)
      expect((body as { gates: Array<{ gateId: string; kind: string; toolName: string | null }> }).gates).toEqual([
        expect.objectContaining({ gateId: permission.gate.requestId, kind: 'permission', toolName: 'Bash' }),
        expect.objectContaining({ gateId: question.gate.gateId, kind: 'question', toolName: null }),
      ])

      expireOpenPermissionGates(threadId, 'turn_ended')
      expireOpenQuestionGates(threadId, 'turn_ended', 'Turno encerrado.')
      rmSync(dir, { recursive: true, force: true })
    })

    /**
     * Snapshot de um gate aberto pelo broker de verdade (não por `openPermissionGate` direto): é
     * assim que o card remonta depois de um reconnect, com `toolName`/`payload` intactos.
     */
    it('devolve o snapshot do gate aberto pelo broker e reivindica a rota', async () => {
      const dir = makeProjectDir()
      const project = createProject({ path: dir })
      const thread = createThread({
        projectId: project.id,
        provider: 'claude',
        accessLevel: 'supervised',
        executionMode: 'main',
        state: 'waiting_permission',
      })

      const seen: Array<{ requestId: string; toolName: string }> = []
      const server = await createPermissionServer(thread.id, (info) => seen.push(info))
      const pendingFetch = fetch(`http://127.0.0.1:${server.port}/permission`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-permission-token': server.token },
        body: JSON.stringify({ toolName: 'Write', toolInput: { file_path: 'x.ts' } }),
      })
      await waitFor(() => hasPendingPermission(thread.id))

      const claimed = await handleThreadsRequest(
        fakeReq('GET', `/api/threads/${thread.id}/gate`, undefined, session),
        fakeRes()
      )
      expect(claimed).toBe(true)

      const req = fakeReq('GET', `/api/threads/${thread.id}/gate`, undefined, session)
      const res = fakeRes()
      await handleThreadsRequest(req, res)
      const { status, body } = await res.result()
      expect(status).toBe(200)
      const gates = (body as { gates: Array<{ gateId: string; kind: string; toolName: string; payload: unknown }> })
        .gates
      expect(gates).toHaveLength(1)
      expect(gates[0].gateId).toBe(seen[0].requestId)
      expect(gates[0].kind).toBe('permission')
      expect(gates[0].toolName).toBe('Write')
      expect(gates[0].payload).toEqual({ file_path: 'x.ts' })
      expect(listPendingPermissions(thread.id)).toHaveLength(1)

      // limpa para o fetch do hook não ficar pendurado no afterEach
      resolvePermissionRequest(thread.id, seen[0].requestId, false)
      await pendingFetch
      server.close()
      rmSync(dir, { recursive: true, force: true })
    })

    it('returns 404 for an unknown thread', async () => {
      const req = fakeReq('GET', '/api/threads/thr_missing/gate', undefined, session)
      const res = fakeRes()
      await handleThreadsRequest(req, res)
      const { status, body } = await res.result()
      expect(status).toBe(404)
      expect((body as { error: { code: string } }).error.code).toBe('thread_not_found')
    })

    it('rejects unauthorized requests with 401 unauthorized (vault unlocked, bad session)', async () => {
      const { dir, threadId } = seedGatedThread()

      const req = fakeReq('GET', `/api/threads/${threadId}/gate`, undefined, 'invalid-token')
      const res = fakeRes()
      const claimed = await handleThreadsRequest(req, res)
      expect(claimed).toBe(true)
      const { status, body } = await res.result()
      expect(status).toBe(401)
      expect((body as { error: { code: string } }).error.code).toBe('unauthorized')

      rmSync(dir, { recursive: true, force: true })
    })

    it('returns 423 vault_locked before 401 when the vault is locked', async () => {
      const { dir, threadId } = seedGatedThread()
      vaultService.lock()

      const req = fakeReq('GET', `/api/threads/${threadId}/gate`, undefined, session)
      const res = fakeRes()
      await handleThreadsRequest(req, res)
      const { status, body } = await res.result()
      expect(status).toBe(423)
      expect((body as { error: { code: string } }).error.code).toBe('vault_locked')

      // e com token inválido o cofre trancado ainda vence o 401 (ordem 423 → 401)
      const req2 = fakeReq('GET', `/api/threads/${threadId}/gate`, undefined, 'invalid-token')
      const res2 = fakeRes()
      await handleThreadsRequest(req2, res2)
      const second = await res2.result()
      expect(second.status).toBe(423)
      expect((second.body as { error: { code: string } }).error.code).toBe('vault_locked')

      rmSync(dir, { recursive: true, force: true })
    })
  })

  describe('POST /api/threads/:id/gate/:gateId/resolve', () => {
    function seedGatedThread(state: 'running' | 'waiting_user' = 'running'): { dir: string; threadId: string } {
      const dir = makeProjectDir()
      const project = createProject({ path: dir })
      const thread = createThread({
        projectId: project.id,
        provider: 'claude',
        accessLevel: 'supervised',
        executionMode: 'main',
        state,
      })
      return { dir, threadId: thread.id }
    }

    it('resolve um gate de permissão pelo gateId (kind=permission)', async () => {
      const { dir, threadId } = seedGatedThread()
      const opened = openPermissionGate({ threadId, toolName: 'Bash', params: { command: 'ls' } })
      if (!opened.ok) throw new Error('gate não abriu')

      const req = fakeReq(
        'POST',
        `/api/threads/${threadId}/gate/${opened.gate.requestId}/resolve`,
        { kind: 'permission', allow: true },
        session
      )
      const res = fakeRes()
      await handleThreadsRequest(req, res)
      const { status, body } = await res.result()
      expect(status).toBe(200)
      expect(body).toMatchObject({ resolved: true, kind: 'permission', toolName: 'Bash' })
      await expect(opened.decision).resolves.toMatchObject({ allow: true })
      expect(hasPendingPermission(threadId)).toBe(false)

      rmSync(dir, { recursive: true, force: true })
    })

    it('resolve a segunda pergunta da thread sem tocar na primeira (kind=question)', async () => {
      const { dir, threadId } = seedGatedThread()
      const first = openQuestionGate({ threadId, question: { prompt: 'Primeira?' } })
      const second = openQuestionGate({ threadId, question: { prompt: 'Segunda?' } })
      if (!first.ok || !second.ok) throw new Error('gate não abriu')
      void first.answer.catch(() => {})

      const req = fakeReq(
        'POST',
        `/api/threads/${threadId}/gate/${second.gate.gateId}/resolve`,
        { kind: 'question', selectedOptions: ['B'] },
        session
      )
      const res = fakeRes()
      await handleThreadsRequest(req, res)
      const { status, body } = await res.result()
      expect(status).toBe(200)
      expect(body).toMatchObject({ resolved: true, kind: 'question' })
      await expect(second.answer).resolves.toEqual({ selectedOptions: ['B'], freeText: null })
      // A pergunta mais antiga (a que o wire legado `/answer` alcançaria) continua pendente.
      expect(getThread(threadId)?.state).toBe('waiting_user')

      expireOpenQuestionGates(threadId, 'turn_ended', 'Turno encerrado.')
      rmSync(dir, { recursive: true, force: true })
    })

    it('rejeita selectedOptions fora das opções do gate (400 validation_error)', async () => {
      const { dir, threadId } = seedGatedThread()
      const opened = openQuestionGate({ threadId, question: { prompt: 'Qual?', options: ['A', 'B'] } })
      if (!opened.ok) throw new Error('gate não abriu')
      void opened.answer.catch(() => {})

      const req = fakeReq(
        'POST',
        `/api/threads/${threadId}/gate/${opened.gate.gateId}/resolve`,
        { kind: 'question', selectedOptions: ['Opção inexistente'] },
        session
      )
      const res = fakeRes()
      await handleThreadsRequest(req, res)
      const { status, body } = await res.result()
      expect(status).toBe(400)
      expect((body as { error: { code: string } }).error.code).toBe('validation_error')
      // Gate segue aberto: validação não consome a pergunta.
      expect(getThread(threadId)?.state).toBe('waiting_user')

      expireOpenQuestionGates(threadId, 'turn_ended', 'Turno encerrado.')
      rmSync(dir, { recursive: true, force: true })
    })

    it('devolve 409 gate_thread_mismatch e mantém o gate pendente na thread dona', async () => {
      const owner = seedGatedThread()
      const intruder = seedGatedThread()
      const opened = openQuestionGate({ threadId: owner.threadId, question: { prompt: 'x' } })
      if (!opened.ok) throw new Error('gate não abriu')
      void opened.answer.catch(() => {})

      const req = fakeReq(
        'POST',
        `/api/threads/${intruder.threadId}/gate/${opened.gate.gateId}/resolve`,
        { kind: 'question', freeText: 'oi' },
        session
      )
      const res = fakeRes()
      await handleThreadsRequest(req, res)
      const { status, body } = await res.result()
      expect(status).toBe(409)
      expect((body as { error: { code: string } }).error.code).toBe('gate_thread_mismatch')
      expect(getThread(owner.threadId)?.state).toBe('waiting_user')

      expireOpenQuestionGates(owner.threadId, 'turn_ended', 'Turno encerrado.')
      rmSync(owner.dir, { recursive: true, force: true })
      rmSync(intruder.dir, { recursive: true, force: true })
    })

    it('devolve 409 gate_not_found para gateId inexistente e 400 para kind inválido', async () => {
      const { dir, threadId } = seedGatedThread()

      const req = fakeReq(
        'POST',
        `/api/threads/${threadId}/gate/gate_inexistente/resolve`,
        { kind: 'permission', allow: false },
        session
      )
      const res = fakeRes()
      await handleThreadsRequest(req, res)
      const { status, body } = await res.result()
      expect(status).toBe(409)
      expect((body as { error: { code: string } }).error.code).toBe('gate_not_found')

      const req2 = fakeReq('POST', `/api/threads/${threadId}/gate/gate_x/resolve`, { kind: 'outro' }, session)
      const res2 = fakeRes()
      await handleThreadsRequest(req2, res2)
      const second = await res2.result()
      expect(second.status).toBe(400)
      expect((second.body as { error: { code: string } }).error.code).toBe('validation_error')

      rmSync(dir, { recursive: true, force: true })
    })

    it('returns 404 for an unknown thread', async () => {
      const req = fakeReq(
        'POST',
        '/api/threads/thr_missing/gate/gate_x/resolve',
        { kind: 'permission', allow: true },
        session
      )
      const res = fakeRes()
      await handleThreadsRequest(req, res)
      const { status, body } = await res.result()
      expect(status).toBe(404)
      expect((body as { error: { code: string } }).error.code).toBe('thread_not_found')
    })

    it('rejects unauthorized requests with 401 unauthorized (vault unlocked, bad session)', async () => {
      const { dir, threadId } = seedGatedThread()

      const req = fakeReq(
        'POST',
        `/api/threads/${threadId}/gate/gate_x/resolve`,
        { kind: 'permission', allow: true },
        'invalid-token'
      )
      const res = fakeRes()
      const claimed = await handleThreadsRequest(req, res)
      expect(claimed).toBe(true)
      const { status, body } = await res.result()
      expect(status).toBe(401)
      expect((body as { error: { code: string } }).error.code).toBe('unauthorized')

      rmSync(dir, { recursive: true, force: true })
    })

    it('returns 423 vault_locked before 401 when the vault is locked', async () => {
      const { dir, threadId } = seedGatedThread()
      vaultService.lock()

      const req = fakeReq(
        'POST',
        `/api/threads/${threadId}/gate/gate_x/resolve`,
        { kind: 'permission', allow: true },
        session
      )
      const res = fakeRes()
      await handleThreadsRequest(req, res)
      const { status, body } = await res.result()
      expect(status).toBe(423)
      expect((body as { error: { code: string } }).error.code).toBe('vault_locked')

      // e com token inválido o cofre trancado ainda vence o 401 (ordem 423 → 401)
      const req2 = fakeReq(
        'POST',
        `/api/threads/${threadId}/gate/gate_x/resolve`,
        { kind: 'permission', allow: true },
        'invalid-token'
      )
      const res2 = fakeRes()
      await handleThreadsRequest(req2, res2)
      const second = await res2.result()
      expect(second.status).toBe(423)
      expect((second.body as { error: { code: string } }).error.code).toBe('vault_locked')

      rmSync(dir, { recursive: true, force: true })
    })

    /**
     * Ponta a ponta do `ask_user_question` (F21): o `POST /ask` do MCP fica preso até a resolução
     * do gate pelo `gateId` do card — o wire legado `POST /answer`, sem gateId, saiu com a rota.
     */
    it('test_answer_happy_path resolves the pending /ask request with selectedOptions', async () => {
      const { dir, threadId } = seedGatedThread('waiting_user')

      const askServer = await createAskUserQuestionServer(threadId)
      const askPromise = fetch(`http://127.0.0.1:${askServer.port}/ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-ask-token': askServer.token },
        body: JSON.stringify({ prompt: 'Qual caminho seguir?', options: ['Big bang', 'Incremental'] }),
      })
      await waitFor(() => hasOpenQuestionGate(threadId))
      const [gate] = listOpenQuestionGates(threadId)

      const req = fakeReq(
        'POST',
        `/api/threads/${threadId}/gate/${gate.gateId}/resolve`,
        { kind: 'question', selectedOptions: ['Incremental'] },
        session
      )
      const res = fakeRes()
      await handleThreadsRequest(req, res)
      const { status, body } = await res.result()
      expect(status).toBe(200)
      expect(body).toMatchObject({ resolved: true, kind: 'question' })

      const askResponse = await askPromise
      const askBody = (await askResponse.json()) as { content: Array<{ text: string }>; isError: boolean }
      expect(askBody.isError).toBe(false)
      expect(askBody.content[0]?.text).toBe('Incremental')

      askServer.close()
      rmSync(dir, { recursive: true, force: true })
    })

    it('test_answer_validation_error_empty_body rejects an answer with no options and no freeText', async () => {
      const { dir, threadId } = seedGatedThread()
      const opened = openQuestionGate({ threadId, question: { prompt: 'Qual?' } })
      if (!opened.ok) throw new Error('gate não abriu')
      void opened.answer.catch(() => {})

      const req = fakeReq(
        'POST',
        `/api/threads/${threadId}/gate/${opened.gate.gateId}/resolve`,
        { kind: 'question' },
        session
      )
      const res = fakeRes()
      await handleThreadsRequest(req, res)
      const { status, body } = await res.result()
      expect(status).toBe(400)
      expect((body as { error: { code: string } }).error.code).toBe('validation_error')
      // Corpo vazio não consome a pergunta.
      expect(hasOpenQuestionGate(threadId)).toBe(true)

      expireOpenQuestionGates(threadId, 'turn_ended', 'Turno encerrado.')
      rmSync(dir, { recursive: true, force: true })
    })

    it('accepts freeText alone without selectedOptions', async () => {
      const { dir, threadId } = seedGatedThread('waiting_user')
      const askServer = await createAskUserQuestionServer(threadId)
      const askPromise = fetch(`http://127.0.0.1:${askServer.port}/ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-ask-token': askServer.token },
        body: JSON.stringify({ prompt: 'Outra?' }),
      })
      await waitFor(() => hasOpenQuestionGate(threadId))
      const [gate] = listOpenQuestionGates(threadId)

      const req = fakeReq(
        'POST',
        `/api/threads/${threadId}/gate/${gate.gateId}/resolve`,
        { kind: 'question', freeText: 'texto livre do usuário' },
        session
      )
      const res = fakeRes()
      await handleThreadsRequest(req, res)
      const { status, body } = await res.result()
      expect(status).toBe(200)
      expect(body).toMatchObject({ resolved: true, kind: 'question' })

      const askResponse = await askPromise
      const askBody = (await askResponse.json()) as { content: Array<{ text: string }> }
      expect(askBody.content[0]?.text).toBe('texto livre do usuário')

      askServer.close()
      rmSync(dir, { recursive: true, force: true })
    })
  })

  describe('GET /api/composer/catalog (F16 §5.1)', () => {
    it('returns the static provider catalog', async () => {
      const req = fakeReq('GET', '/api/composer/catalog', undefined, session)
      const res = fakeRes()
      await handleThreadsRequest(req, res)
      const { status, body } = await res.result()
      expect(status).toBe(200)
      const parsed = body as {
        providers: Record<string, { models: string[]; defaultModel: string; multimodal: boolean }>
      }
      expect(parsed.providers.claude.multimodal).toBe(true)
      expect(parsed.providers.claude.models).toContain(parsed.providers.claude.defaultModel)
      expect(parsed.providers.minimax.multimodal).toBe(false)
    })

    it('rejects unauthorized requests with 401', async () => {
      const req = fakeReq('GET', '/api/composer/catalog', undefined, 'invalid-token')
      const res = fakeRes()
      await handleThreadsRequest(req, res)
      expect((await res.result()).status).toBe(401)
    })

    it('returns 423 vault_locked when vault is locked', async () => {
      vaultService.lock()
      const req = fakeReq('GET', '/api/composer/catalog', undefined, session)
      const res = fakeRes()
      await handleThreadsRequest(req, res)
      const { status, body } = await res.result()
      expect(status).toBe(423)
      expect((body as { error: { code: string } }).error.code).toBe('vault_locked')
    })
  })

  describe('F16 composer avançado — create/follow-up validation', () => {
    it('rejects an out-of-catalog model with 400 validation_error', async () => {
      const dir = makeProjectDir()
      const project = createProject({ path: dir })
      const req = fakeReq(
        'POST',
        `/api/projects/${project.id}/threads`,
        {
          prompt: 'oi',
          provider: 'claude',
          model: 'gpt-unknown',
          accessLevel: 'supervised',
          executionMode: 'main',
        },
        session
      )
      const res = fakeRes()
      await handleThreadsRequest(req, res)
      const { status, body } = await res.result()
      expect(status).toBe(400)
      expect((body as { error: { code: string } }).error.code).toBe('validation_error')
      rmSync(dir, { recursive: true, force: true })
    })

    it('rejects an out-of-catalog reasoningLevel with 400 validation_error', async () => {
      const dir = makeProjectDir()
      const project = createProject({ path: dir })
      const req = fakeReq(
        'POST',
        `/api/projects/${project.id}/threads`,
        {
          prompt: 'oi',
          provider: 'minimax',
          reasoningLevel: 'high',
          accessLevel: 'supervised',
          executionMode: 'main',
        },
        session
      )
      const res = fakeRes()
      await handleThreadsRequest(req, res)
      const { status, body } = await res.result()
      expect(status).toBe(400)
      expect((body as { error: { code: string } }).error.code).toBe('validation_error')
      rmSync(dir, { recursive: true, force: true })
    })

    describe('contextAttachments', () => {
      it('rejeita anexo de contexto malformado no create', async () => {
        const dir = makeProjectDir()
        const project = createProject({ path: dir })
        const req = fakeReq(
          'POST',
          `/api/projects/${project.id}/threads`,
          {
            prompt: 'oi',
            provider: 'claude',
            accessLevel: 'supervised',
            executionMode: 'main',
            contextAttachments: [{ kind: 'pasta', path: 'src' }],
          },
          session
        )
        const res = fakeRes()
        await handleThreadsRequest(req, res)
        const { status, body } = await res.result()
        expect(status).toBe(400)
        expect((body as { error: { code: string } }).error.code).toBe('attachment_invalid')
        rmSync(dir, { recursive: true, force: true })
      })

      it('rejeita anexo de contexto malformado no follow-up', async () => {
        const dir = makeProjectDir()
        const project = createProject({ path: dir })
        const thread = createThread({
          projectId: project.id,
          provider: 'claude',
          accessLevel: 'supervised',
          executionMode: 'main',
          state: 'idle',
        })
        const req = fakeReq(
          'POST',
          `/api/threads/${thread.id}/messages`,
          { prompt: 'segue', contextAttachments: [{ kind: 'selection', path: 'a.ts', text: '' }] },
          session
        )
        const res = fakeRes()
        await handleThreadsRequest(req, res)
        const { status, body } = await res.result()
        expect(status).toBe(400)
        expect((body as { error: { code: string } }).error.code).toBe('attachment_invalid')
        rmSync(dir, { recursive: true, force: true })
      })

      it('aceita anexo válido no create e persiste os blocks de contexto', async () => {
        const dir = makeProjectDir()
        writeFileSync(join(dir, 'alvo.ts'), 'const alvo = 1')
        const project = createProject({ path: dir })
        setRunCliTurnForTesting(async () => ({ text: 'ok' }))
        const req = fakeReq(
          'POST',
          `/api/projects/${project.id}/threads`,
          {
            prompt: 'explique',
            provider: 'claude',
            accessLevel: 'auto-accept-edits',
            executionMode: 'main',
            contextAttachments: [{ kind: 'file', path: 'alvo.ts' }],
          },
          session
        )
        const res = fakeRes()
        await handleThreadsRequest(req, res)
        const { status } = await res.result()
        expect(status).toBe(201)
        rmSync(dir, { recursive: true, force: true })
      })
    })

    describe('test_images_rejected_when_not_multimodal', () => {
      it('rejects images on create for a non-multimodal provider (minimax)', async () => {
        const dir = makeProjectDir()
        const project = createProject({ path: dir })
        const req = fakeReq(
          'POST',
          `/api/projects/${project.id}/threads`,
          {
            prompt: 'oi',
            provider: 'minimax',
            accessLevel: 'supervised',
            executionMode: 'main',
            images: [{ mimeType: 'image/png', name: 'a.png', dataBase64: 'aGVsbG8=' }],
          },
          session
        )
        const res = fakeRes()
        await handleThreadsRequest(req, res)
        const { status, body } = await res.result()
        expect(status).toBe(400)
        expect((body as { error: { code: string } }).error.code).toBe('image_not_supported')
        rmSync(dir, { recursive: true, force: true })
      })
    })

    it('accepts images on create for a multimodal provider (claude) and persists blocks', async () => {
      const dir = makeProjectDir()
      const project = createProject({ path: dir })
      setRunCliTurnForTesting(async () => ({ text: 'ok' }))

      const req = fakeReq(
        'POST',
        `/api/projects/${project.id}/threads`,
        {
          prompt: 'veja este print',
          provider: 'claude',
          accessLevel: 'supervised',
          executionMode: 'main',
          images: [{ mimeType: 'image/png', name: 'a.png', dataBase64: 'aGVsbG8=' }],
        },
        session
      )
      const res = fakeRes()
      await handleThreadsRequest(req, res)
      const { status, body } = await res.result()
      expect(status).toBe(201)
      const parsed = body as { thread: { id: string } }
      await waitFor(() => getThread(parsed.thread.id)?.state === 'idle')
      rmSync(dir, { recursive: true, force: true })
    })

    it('test_follow_up_rejects_provider_field', async () => {
      const dir = makeProjectDir()
      const project = createProject({ path: dir })
      setRunCliTurnForTesting(async () => ({ text: 'ok' }))

      const createReq = fakeReq(
        'POST',
        `/api/projects/${project.id}/threads`,
        { prompt: 'oi', provider: 'claude', accessLevel: 'supervised', executionMode: 'main' },
        session
      )
      const created = (
        await (async () => {
          const res = fakeRes()
          await handleThreadsRequest(createReq, res)
          return res.result()
        })()
      ).body as { thread: { id: string } }
      await waitFor(() => getThread(created.thread.id)?.state === 'idle')

      const req = fakeReq(
        'POST',
        `/api/threads/${created.thread.id}/messages`,
        { prompt: 'de novo', provider: 'codex' },
        session
      )
      const res = fakeRes()
      await handleThreadsRequest(req, res)
      const { status, body } = await res.result()
      expect(status).toBe(400)
      expect((body as { error: { code: string } }).error.code).toBe('validation_error')
      rmSync(dir, { recursive: true, force: true })
    })

    it('follow-up updates model + reasoningLevel and rejects images for a non-multimodal thread', async () => {
      const dir = makeProjectDir()
      const project = createProject({ path: dir })
      setRunCliTurnForTesting(async () => ({ text: 'ok' }))

      const createReq = fakeReq(
        'POST',
        `/api/projects/${project.id}/threads`,
        { prompt: 'oi', provider: 'kimi', accessLevel: 'supervised', executionMode: 'main' },
        session
      )
      const createRes = fakeRes()
      await handleThreadsRequest(createReq, createRes)
      const created = (await createRes.result()).body as { thread: { id: string } }
      await waitFor(() => getThread(created.thread.id)?.state === 'idle')

      const okReq = fakeReq(
        'POST',
        `/api/threads/${created.thread.id}/messages`,
        { prompt: 'de novo', model: 'kimi-latest', reasoningLevel: 'high' },
        session
      )
      const okRes = fakeRes()
      await handleThreadsRequest(okReq, okRes)
      const okResult = await okRes.result()
      expect(okResult.status).toBe(201)
      expect(getThread(created.thread.id)?.reasoningLevel).toBe('high')
      await waitFor(() => getThread(created.thread.id)?.state === 'idle')

      const imgReq = fakeReq(
        'POST',
        `/api/threads/${created.thread.id}/messages`,
        {
          prompt: 'com imagem',
          images: [{ mimeType: 'image/png', name: 'a.png', dataBase64: 'aGVsbG8=' }],
        },
        session
      )
      const imgRes = fakeRes()
      await handleThreadsRequest(imgReq, imgRes)
      const imgResult = await imgRes.result()
      expect(imgResult.status).toBe(400)
      expect((imgResult.body as { error: { code: string } }).error.code).toBe('image_not_supported')

      rmSync(dir, { recursive: true, force: true })
    })
  })

  describe('resolve-conflict (F18)', () => {
    it('POST /api/threads/:id/diffs/:diffId/resolve-conflict promotes the winner and materializes it', async () => {
      const dir = makeProjectDir()
      const project = createProject({ path: dir })
      const thread = createThread({ projectId: project.id, provider: 'claude', accessLevel: 'supervised', executionMode: 'main' })

      const childA = mkdtempSync(join(tmpdir(), 'engrenacode_claude_f18_conflict_child_'))
      writeFileSync(join(childA, 'shared.ts'), 'versao vencedora\n')

      const diff = createDiff({
        threadId: thread.id,
        file: 'shared.ts',
        additions: 1,
        deletions: 0,
        hunks: [],
        provider: 'claude',
        status: 'conflict',
        conflictCandidates: [
          { childThreadId: 'child-a', subagentName: 'implementer-a', hunks: [], additions: 1, deletions: 0, worktreePath: childA },
        ],
      })

      const req = fakeReq(
        'POST',
        `/api/threads/${thread.id}/diffs/${diff.id}/resolve-conflict`,
        { winningChildThreadId: 'child-a' },
        session
      )
      const res = fakeRes()
      await handleThreadsRequest(req, res)
      const { status, body } = await res.result()

      expect(status).toBe(200)
      expect((body as { diff: { status: string } }).diff.status).toBe('pending')
      expect(getDiff(diff.id)?.status).toBe('pending')
      expect(readFileSync(join(dir, 'shared.ts'), 'utf-8')).toBe('versao vencedora\n')

      rmSync(dir, { recursive: true, force: true })
      rmSync(childA, { recursive: true, force: true })
    })

    it('devolve 409 worktree_missing quando o worktree do vencedor sumiu, sem tocar no arquivo do pai', async () => {
      const dir = makeProjectDir()
      const project = createProject({ path: dir })
      const thread = createThread({ projectId: project.id, provider: 'claude', accessLevel: 'supervised', executionMode: 'main' })
      writeFileSync(join(dir, 'shared.ts'), 'conteudo original\n')

      const sumido = mkdtempSync(join(tmpdir(), 'engrenacode_claude_f18_conflict_gone_'))
      const diff = createDiff({
        threadId: thread.id,
        file: 'shared.ts',
        additions: 1,
        deletions: 1,
        hunks: [],
        provider: 'claude',
        status: 'conflict',
        conflictCandidates: [
          { childThreadId: 'child-a', subagentName: 'writer-a', hunks: [], additions: 1, deletions: 1, worktreePath: sumido },
        ],
      })
      rmSync(sumido, { recursive: true, force: true })

      const req = fakeReq(
        'POST',
        `/api/threads/${thread.id}/diffs/${diff.id}/resolve-conflict`,
        { winningChildThreadId: 'child-a' },
        session
      )
      const res = fakeRes()
      await handleThreadsRequest(req, res)
      const { status, body } = await res.result()

      expect(status).toBe(409)
      const err = (body as { error: { code: string; message: string } }).error
      expect(err.code).toBe('worktree_missing')
      // A mensagem nomeia o filho: é ela que chega na faixa de erro do DiffViewer.
      expect(err.message).toContain('writer-a')
      // Estado sobrevive ao erro — arquivo intacto e conflito ainda resolvível pelo outro candidato.
      expect(readFileSync(join(dir, 'shared.ts'), 'utf-8')).toBe('conteudo original\n')
      expect(getDiff(diff.id)?.status).toBe('conflict')

      rmSync(dir, { recursive: true, force: true })
    })

    it('rejects a non-conflict diffId with 409 diff_not_conflict', async () => {
      const dir = makeProjectDir()
      const project = createProject({ path: dir })
      const thread = createThread({ projectId: project.id, provider: 'claude', accessLevel: 'supervised', executionMode: 'main' })
      const diff = createDiff({ threadId: thread.id, file: 'a.ts', additions: 1, deletions: 0, hunks: [], provider: 'claude' })

      const req = fakeReq(
        'POST',
        `/api/threads/${thread.id}/diffs/${diff.id}/resolve-conflict`,
        { winningChildThreadId: 'child-a' },
        session
      )
      const res = fakeRes()
      await handleThreadsRequest(req, res)
      const { status, body } = await res.result()

      expect(status).toBe(409)
      expect((body as { error: { code: string } }).error.code).toBe('diff_not_conflict')
      rmSync(dir, { recursive: true, force: true })
    })

    it('accept on a conflict diff returns 409 diff_conflict instead of silently dropping it', async () => {
      const dir = makeProjectDir()
      const project = createProject({ path: dir })
      const thread = createThread({ projectId: project.id, provider: 'claude', accessLevel: 'supervised', executionMode: 'main' })
      const childA = mkdtempSync(join(tmpdir(), 'engrenacode_claude_f18_conflict_accept_'))
      const diff = createDiff({
        threadId: thread.id,
        file: 'shared.ts',
        additions: 1,
        deletions: 0,
        hunks: [],
        provider: 'claude',
        status: 'conflict',
        conflictCandidates: [
          { childThreadId: 'child-a', subagentName: 'implementer-a', hunks: [], additions: 1, deletions: 0, worktreePath: childA },
        ],
      })

      const req = fakeReq('POST', `/api/threads/${thread.id}/accept`, { ids: [diff.id] }, session)
      const res = fakeRes()
      await handleThreadsRequest(req, res)
      const { status, body } = await res.result()

      expect(status).toBe(409)
      expect((body as { error: { code: string } }).error.code).toBe('diff_conflict')
      rmSync(dir, { recursive: true, force: true })
      rmSync(childA, { recursive: true, force: true })
    })
  })

  describe('slash pipeline history (F22)', () => {
    it('rejects an unknown slash command with 400 before creating a thread', async () => {
      const dir = makeProjectDir()
      const project = createProject({ path: dir })

      const req = fakeReq(
        'POST',
        `/api/projects/${project.id}/threads`,
        { prompt: '/foo bar', provider: 'claude', accessLevel: 'full-access', executionMode: 'main' },
        session
      )
      const res = fakeRes()
      await handleThreadsRequest(req, res)
      const { status, body } = await res.result()

      expect(status).toBe(400)
      expect((body as { error: { code: string } }).error.code).toBe('slash_unknown')
    })

    it('history exposes the pipeline + stages for a dispatched /spec', async () => {
      const dir = makeProjectDir()
      const project = createProject({ path: dir })
      const planner = createSubagent({ name: 'planner', description: 'planeja', prompt: 'Você é o planner.', provider: 'inherit' })
      upsertProjectSubagentLink(project.id, planner.id, { enabled: true })
      setDelegateRunCliTurnForTesting(async () => ({ text: '## spec.md\nx\n\n## plan.md\ny' }))

      const createReq = fakeReq(
        'POST',
        `/api/projects/${project.id}/threads`,
        { prompt: '/spec Adicionar login', provider: 'claude', accessLevel: 'full-access', executionMode: 'main' },
        session
      )
      const createRes = fakeRes()
      await handleThreadsRequest(createReq, createRes)
      const created = (await createRes.result()).body as { thread: { id: string } }
      await waitFor(() => getThread(created.thread.id)?.state === 'idle')

      const historyReq = fakeReq('GET', `/api/threads/${created.thread.id}/history`, undefined, session)
      const historyRes = fakeRes()
      await handleThreadsRequest(historyReq, historyRes)
      const body = (await historyRes.result()).body as {
        pipeline: { pipeline: { command: string; status: string }; stages: Array<{ stageId: string; status: string }> } | null
      }

      expect(body.pipeline?.pipeline.command).toBe('spec')
      expect(body.pipeline?.pipeline.status).toBe('completed')
      expect(body.pipeline?.stages).toEqual([expect.objectContaining({ stageId: 'planner', status: 'completed' })])

      rmSync(dir, { recursive: true, force: true })
    })
  })
})

describe('F28 Onda 2 — busca, renomear, exportar e voto', () => {
  it('GET /threads?q= filtra por título e por conteúdo de mensagem', async () => {
    const dir = makeProjectDir()
    const project = createProject({ path: dir })
    const alvo = createThread({
      projectId: project.id,
      provider: 'claude',
      accessLevel: 'supervised',
      executionMode: 'main',
      title: 'Ajustar o composer',
    })
    const outra = createThread({
      projectId: project.id,
      provider: 'claude',
      accessLevel: 'supervised',
      executionMode: 'main',
      title: 'Outro assunto',
    })
    appendMessage({ threadId: outra.id, role: 'user', content: 'falar sobre telemetria', blocks: null })

    const byTitle = fakeRes()
    await handleThreadsRequest(fakeReq('GET', `/api/projects/${project.id}/threads?q=composer`, undefined, session), byTitle)
    const titleBody = (await byTitle.result()).body as { threads: Array<{ id: string }> }
    expect(titleBody.threads.map((t) => t.id)).toEqual([alvo.id])

    const byContent = fakeRes()
    await handleThreadsRequest(fakeReq('GET', `/api/projects/${project.id}/threads?q=telemetria`, undefined, session), byContent)
    const contentBody = (await byContent.result()).body as { threads: Array<{ id: string }> }
    expect(contentBody.threads.map((t) => t.id)).toEqual([outra.id])

    rmSync(dir, { recursive: true, force: true })
  }), 20000

  it('PATCH /threads/:id/title renomeia e volta ao automático com título vazio', async () => {
    const dir = makeProjectDir()
    const project = createProject({ path: dir })
    const thread = createThread({
      projectId: project.id,
      provider: 'claude',
      accessLevel: 'supervised',
      executionMode: 'main',
      title: 'antigo',
    })

    const renamed = fakeRes()
    await handleThreadsRequest(fakeReq('PATCH', `/api/threads/${thread.id}/title`, { title: '  Novo nome  ' }, session), renamed)
    expect((await renamed.result()).status).toBe(200)
    expect(getThread(thread.id)?.title).toBe('Novo nome')

    const cleared = fakeRes()
    await handleThreadsRequest(fakeReq('PATCH', `/api/threads/${thread.id}/title`, { title: '' }, session), cleared)
    expect(getThread(thread.id)?.title).toBeNull()

    const tooLong = fakeRes()
    await handleThreadsRequest(
      fakeReq('PATCH', `/api/threads/${thread.id}/title`, { title: 'x'.repeat(121) }, session),
      tooLong
    )
    expect((await tooLong.result()).status).toBe(400)

    rmSync(dir, { recursive: true, force: true })
  }), 20000

  it('GET /threads/:id/export devolve markdown com nome de arquivo e recusa formato inválido', async () => {
    const dir = makeProjectDir()
    const project = createProject({ path: dir })
    const thread = createThread({
      projectId: project.id,
      provider: 'claude',
      accessLevel: 'supervised',
      executionMode: 'main',
      title: 'Conversa exportada',
    })
    appendMessage({ threadId: thread.id, role: 'user', content: 'oi', blocks: null })

    const md = fakeRes()
    await handleThreadsRequest(fakeReq('GET', `/api/threads/${thread.id}/export?format=md`, undefined, session), md)
    const body = (await md.result()).body as { fileName: string; content: string; format: string }
    expect(body.format).toBe('md')
    expect(body.fileName.endsWith('.md')).toBe(true)
    expect(body.content).toContain('# Conversa exportada')

    const bad = fakeRes()
    await handleThreadsRequest(fakeReq('GET', `/api/threads/${thread.id}/export?format=pdf`, undefined, session), bad)
    expect((await bad.result()).status).toBe(400)

    rmSync(dir, { recursive: true, force: true })
  }), 20000

  it('GET /threads/:id/export funciona em running, waiting_permission e cancelled com settlement', async () => {
    const dir = makeProjectDir()
    const project = createProject({ path: dir })
    const thread = createThread({
      projectId: project.id,
      provider: 'claude',
      accessLevel: 'supervised',
      executionMode: 'main',
      title: 'Export mid-turn',
    })
    appendMessage({ threadId: thread.id, role: 'user', content: 'faz algo', blocks: null })
    createToolCall({
      threadId: thread.id,
      name: 'Write',
      params: { path: 'a.ts' },
      status: 'running',
    })

    updateThread(thread.id, { state: 'running' })
    const running = fakeRes()
    await handleThreadsRequest(
      fakeReq('GET', `/api/threads/${thread.id}/export?format=md`, undefined, session),
      running
    )
    const runningResult = await running.result()
    const runningBody = runningResult.body as { content: string }
    expect(runningResult.status).toBe(200)
    expect(runningBody.content).toContain('Estado: running')
    expect(runningBody.content).toContain('`Write` — running')

    updateThread(thread.id, { state: 'waiting_permission' })
    const waiting = fakeRes()
    await handleThreadsRequest(
      fakeReq('GET', `/api/threads/${thread.id}/export?format=json`, undefined, session),
      waiting
    )
    const waitingBody = (await waiting.result()).body as { content: string; format: string; fileName: string }
    expect(waitingBody.format).toBe('json')
    expect(waitingBody.fileName.endsWith('.json')).toBe(true)
    const waitingParsed = JSON.parse(waitingBody.content) as {
      thread: { state: string }
      toolCalls: Array<{ status: string }>
    }
    expect(waitingParsed.thread.state).toBe('waiting_permission')
    expect(waitingParsed.toolCalls[0]?.status).toBe('running')

    updateThread(thread.id, { state: 'cancelled' })
    const cancelled = fakeRes()
    await handleThreadsRequest(
      fakeReq('GET', `/api/threads/${thread.id}/export?format=md`, undefined, session),
      cancelled
    )
    const cancelledBody = (await cancelled.result()).body as { content: string }
    expect(cancelledBody.content).toContain('Estado: cancelled')
    expect(cancelledBody.content).toContain('`Write` — cancelled')
    expect(cancelledBody.content).not.toContain('`Write` — running')

    rmSync(dir, { recursive: true, force: true })
  }), 20000

  it('POST feedback grava voto na resposta e recusa voto em mensagem do usuário', async () => {
    const dir = makeProjectDir()
    const project = createProject({ path: dir })
    const thread = createThread({
      projectId: project.id,
      provider: 'claude',
      accessLevel: 'supervised',
      executionMode: 'main',
    })
    const userMessage = appendMessage({ threadId: thread.id, role: 'user', content: 'oi', blocks: null })
    const answer = appendMessage({ threadId: thread.id, role: 'assistant', content: 'resposta', blocks: null })

    const up = fakeRes()
    await handleThreadsRequest(
      fakeReq('POST', `/api/threads/${thread.id}/messages/${answer.id}/feedback`, { vote: 'up' }, session),
      up
    )
    const upBody = (await up.result()).body as { feedback: { vote: string } }
    expect(upBody.feedback.vote).toBe('up')

    const cleared = fakeRes()
    await handleThreadsRequest(
      fakeReq('POST', `/api/threads/${thread.id}/messages/${answer.id}/feedback`, { vote: null }, session),
      cleared
    )
    expect((await cleared.result()).body).toEqual({ feedback: null })

    const onUser = fakeRes()
    await handleThreadsRequest(
      fakeReq('POST', `/api/threads/${thread.id}/messages/${userMessage.id}/feedback`, { vote: 'up' }, session),
      onUser
    )
    expect((await onUser.result()).status).toBe(400)

    const invalid = fakeRes()
    await handleThreadsRequest(
      fakeReq('POST', `/api/threads/${thread.id}/messages/${answer.id}/feedback`, { vote: 'meh' }, session),
      invalid
    )
    expect((await invalid.result()).status).toBe(400)

    rmSync(dir, { recursive: true, force: true })
  }), 20000
})

// ── Janela paginada e rotas novas (F33) ──────────────────────────────────────

describe('GET /history paginado (F33)', () => {
  function seedThread(): string {
    const project = createProject({ path: makeProjectDir() })
    return createThread({
      projectId: project.id,
      provider: 'claude',
      accessLevel: 'supervised',
      executionMode: 'main',
      state: 'idle',
    }).id
  }

  async function get(url: string): Promise<{ status: number; body: unknown }> {
    const res = fakeRes()
    await handleThreadsRequest(fakeReq('GET', url, undefined, session), res)
    return res.result()
  }

  it('sem parâmetro devolve no máximo 60 mensagens, com hasMore e cursor', async () => {
    const id = seedThread()
    for (let i = 0; i < 70; i += 1) appendMessage({ threadId: id, role: 'user', content: `m${i}` })

    const { status, body } = await get(`/api/threads/${id}/history`)
    const parsed = body as { messages: unknown[]; hasMore: boolean; cursor: number | null }
    expect(status).toBe(200)
    expect(parsed.messages).toHaveLength(60)
    expect(parsed.hasMore).toBe(true)
    expect(typeof parsed.cursor).toBe('number')
  })

  it('before pagina para trás e termina com hasMore falso', async () => {
    const id = seedThread()
    for (let i = 0; i < 15; i += 1) appendMessage({ threadId: id, role: 'user', content: `m${i}` })

    const primeira = (await get(`/api/threads/${id}/history?limit=10`)).body as {
      cursor: number
      hasMore: boolean
    }
    expect(primeira.hasMore).toBe(true)
    const segunda = (await get(`/api/threads/${id}/history?limit=10&before=${primeira.cursor}`)).body as {
      messages: unknown[]
      hasMore: boolean
    }
    expect(segunda.messages).toHaveLength(5)
    expect(segunda.hasMore).toBe(false)
  })

  it('limit e before inválidos respondem 400, nunca a thread inteira', async () => {
    const id = seedThread()
    for (let i = 0; i < 5; i += 1) appendMessage({ threadId: id, role: 'user', content: `m${i}` })

    for (const query of ['limit=0', 'limit=abc', 'limit=9999', 'limit=-3']) {
      const { status, body } = await get(`/api/threads/${id}/history?${query}`)
      expect(status).toBe(400)
      expect((body as { error: { code: string } }).error.code).toBe('invalid_limit')
    }
    for (const query of ['before=abc', 'before=0', 'before=-1', 'before=999999']) {
      const { status, body } = await get(`/api/threads/${id}/history?${query}`)
      expect(status).toBe(400)
      expect((body as { error: { code: string } }).error.code).toBe('invalid_cursor')
    }
  })

  it('resultado grande vem como preview, com tamanho e marca de truncado', async () => {
    const id = seedThread()
    const grande = 'x'.repeat(50_000)
    const call = createToolCall({ threadId: id, name: 'Bash', params: {}, status: 'running' })
    updateToolCall(call.id, { status: 'completed', result: grande })
    appendMessage({ threadId: id, role: 'assistant', content: 'pronto' })

    const { body } = await get(`/api/threads/${id}/history`)
    const toolCalls = (body as {
      toolCalls: Array<{ resultPreview: string | null; resultTruncated: boolean; resultBytes: number; result?: unknown }>
    }).toolCalls
    expect(toolCalls).toHaveLength(1)
    expect(toolCalls[0].resultPreview).toHaveLength(2 * 1024)
    expect(toolCalls[0].resultTruncated).toBe(true)
    expect(toolCalls[0].resultBytes).toBeGreaterThan(2 * 1024)
    // O corpo inteiro não pode viajar na listagem: é metade do custo que a feature corta.
    expect(toolCalls[0].result).toBeUndefined()
  })

  it('thread inexistente continua 404', async () => {
    const { status } = await get('/api/threads/thr_inexistente/history')
    expect(status).toBe(404)
  })
})

describe('GET /graph e GET /tool-calls/:id/result (F33)', () => {
  function seedThread(): string {
    const project = createProject({ path: makeProjectDir() })
    return createThread({
      projectId: project.id,
      provider: 'claude',
      accessLevel: 'supervised',
      executionMode: 'main',
      state: 'idle',
    }).id
  }

  async function get(url: string): Promise<{ status: number; body: unknown }> {
    const res = fakeRes()
    await handleThreadsRequest(fakeReq('GET', url, undefined, session), res)
    return res.result()
  }

  it('a rota de grafo responde — está registrada nas DUAS listas', async () => {
    // Sem o prefixo no guarda, o request fica pendurado e o teste estoura sem erro nenhum.
    const id = seedThread()
    const { status } = await get(`/api/threads/${id}/graph`)
    expect(status).toBe(200)
  })

  it('o grafo traz a execução inteira mesmo com o chat paginado, e sem corpo de resultado', async () => {
    const id = seedThread()
    for (let i = 0; i < 70; i += 1) {
      const call = createToolCall({ threadId: id, name: `T${i}`, params: {}, status: 'running' })
      updateToolCall(call.id, { status: 'completed', result: 'z'.repeat(3_000) })
      appendMessage({ threadId: id, role: 'assistant', content: `r${i}` })
    }

    const history = (await get(`/api/threads/${id}/history`)).body as { messages: unknown[]; hasMore: boolean }
    expect(history.hasMore).toBe(true)

    const { body } = await get(`/api/threads/${id}/graph`)
    const nodes = (body as { nodes: unknown[] }).nodes
    expect(nodes).toHaveLength(70)
    expect(JSON.stringify(nodes)).not.toContain('zzzz')
  })

  it('o corpo integral sai pela rota própria', async () => {
    const id = seedThread()
    const grande = 'y'.repeat(30_000)
    const call = createToolCall({ threadId: id, name: 'Bash', params: {}, status: 'running' })
    updateToolCall(call.id, { status: 'completed', result: grande })

    const { status, body } = await get(`/api/tool-calls/${call.id}/result`)
    expect(status).toBe(200)
    expect((body as { result: string }).result).toBe(grande)
    expect((body as { bytes: number }).bytes).toBeGreaterThan(30_000 - 1)
  })

  it('tool call inexistente devolve 404', async () => {
    const { status, body } = await get('/api/tool-calls/tc_nao_existe/result')
    expect(status).toBe(404)
    expect((body as { error: { code: string } }).error.code).toBe('tool_call_not_found')
  })

  it('as rotas novas exigem sessão como as demais', async () => {
    const id = seedThread()
    for (const url of [`/api/threads/${id}/graph`, '/api/tool-calls/tc_x/result']) {
      const res = fakeRes()
      await handleThreadsRequest(fakeReq('GET', url), res)
      const { status } = await res.result()
      expect(status).toBe(401)
    }
  })
})
