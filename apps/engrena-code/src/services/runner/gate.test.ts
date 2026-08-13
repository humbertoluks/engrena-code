import { afterAll, afterEach, describe, expect, it } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

process.env.ENGRENACODE_USER_DATA = mkdtempSync(join(tmpdir(), 'engrenacode_claude_gate_'))

const { closeDb } = await import('../db/client.js')
const { createProject } = await import('../db/repositories/projects.js')
const { createThread, getThread, updateThread } = await import('../db/repositories/threads.js')
const { createThreadGate, getThreadGate, listOpenThreadGates } = await import(
  '../db/repositories/thread-gates.js'
)
const { clearAllSubscriptions, subscribe } = await import('./ws-hub.js')
const {
  allowOpenPermissionGates,
  clearAllGatesForTesting,
  expireOpenPermissionGates,
  expireOrphanGates,
  hasOpenPermissionGate,
  listOpenPermissionGates,
  openPermissionGate,
  resolvePermissionGate,
} = await import('./gate.js')

const fixtures: string[] = []

function seedThread(state: 'running' | 'idle' = 'running'): string {
  const dir = mkdtempSync(join(tmpdir(), 'engrenacode_claude_gate_proj_'))
  fixtures.push(dir)
  const project = createProject({ path: dir })
  return createThread({
    projectId: project.id,
    provider: 'claude',
    accessLevel: 'supervised',
    executionMode: 'main',
    state,
  }).id
}

interface Captured {
  type: string
  [key: string]: unknown
}

/** Socket falso do ws-hub: só coleta o que foi emitido para a thread. */
function listen(threadId: string): Captured[] {
  const received: Captured[] = []
  const socket = { readyState: 1, OPEN: 1, send: (data: string) => received.push(JSON.parse(data) as Captured) }
  subscribe(threadId, socket as unknown as Parameters<typeof subscribe>[1])
  return received
}

afterEach(() => {
  clearAllGatesForTesting()
  clearAllSubscriptions()
})

afterAll(() => {
  closeDb()
  for (const dir of fixtures) rmSync(dir, { recursive: true, force: true })
  rmSync(process.env.ENGRENACODE_USER_DATA as string, { recursive: true, force: true })
})

describe('openPermissionGate', () => {
  it('persiste o gate, põe a thread em waiting_permission e emite gate.opened + permission.request', () => {
    const threadId = seedThread()
    const received = listen(threadId)

    const opened = openPermissionGate({ threadId, toolName: 'Bash', params: { command: 'ls' } })
    expect(opened.ok).toBe(true)
    if (!opened.ok) return

    const row = getThreadGate(opened.gate.requestId)
    expect(row?.state).toBe('open')
    expect(row?.kind).toBe('permission')
    expect(row?.toolName).toBe('Bash')
    expect(row?.payload).toEqual({ command: 'ls' })
    expect(typeof row?.expiresAt).toBe('number')

    expect(getThread(threadId)?.state).toBe('waiting_permission')
    expect(received.map((e) => e.type)).toEqual(['state.change', 'gate.opened', 'permission.request'])
    expect(received[1]).toMatchObject({ type: 'gate.opened', gateId: opened.gate.requestId, kind: 'permission' })
    // Contrato de wire legado: `requestId` é o gateId, `params` é o payload.
    expect(received[2]).toMatchObject({
      type: 'permission.request',
      threadId,
      requestId: opened.gate.requestId,
      toolName: 'Bash',
      params: { command: 'ls' },
    })
  })

  it('fail-closed quando o gate não persiste (thread apagada mid-turn)', () => {
    const opened = openPermissionGate({ threadId: 'thr_inexistente', toolName: 'Bash', params: {} })
    expect(opened).toEqual({ ok: false, code: 'gate_not_persisted' })
  })
})

/**
 * Decisão desta fatia: dois gates abertos na mesma thread **coexistem**. Nada é sobrescrito
 * (ao contrário de `ask-user-question.ts`, que hoje troca o `pending` da thread em silêncio e
 * deixa o `POST /ask` anterior preso), cada um resolve a sua própria continuação, e a thread só
 * volta a `running` quando o último fecha.
 */
describe('dois gates abertos na mesma thread', () => {
  it('coexistem: nenhum sobrescreve o outro e cada um resolve a sua continuação', async () => {
    const threadId = seedThread()

    const first = openPermissionGate({ threadId, toolName: 'Write', params: { file_path: 'a.txt' } })
    const second = openPermissionGate({ threadId, toolName: 'Bash', params: { command: 'ls' } })
    expect(first.ok && second.ok).toBe(true)
    if (!first.ok || !second.ok) return

    expect(first.gate.requestId).not.toBe(second.gate.requestId)
    expect(listOpenThreadGates(threadId, 'permission')).toHaveLength(2)
    expect(listOpenPermissionGates(threadId).map((p) => p.toolName)).toEqual(['Write', 'Bash'])

    // Resolver o primeiro não toca no segundo, e a thread continua em waiting_permission.
    expect(resolvePermissionGate(threadId, first.gate.requestId, true)).toEqual({ ok: true, toolName: 'Write' })
    await expect(first.decision).resolves.toBe(true)
    expect(hasOpenPermissionGate(threadId)).toBe(true)
    expect(getThread(threadId)?.state).toBe('waiting_permission')

    expect(resolvePermissionGate(threadId, second.gate.requestId, false)).toEqual({ ok: true, toolName: 'Bash' })
    await expect(second.decision).resolves.toBe(false)
    expect(hasOpenPermissionGate(threadId)).toBe(false)
    expect(getThread(threadId)?.state).toBe('running')
  })
})

describe('resolvePermissionGate', () => {
  it('não resolve gate de outra thread e mantém o gate pendente para a dona (R02)', async () => {
    const owner = seedThread()
    const intruder = seedThread()

    const opened = openPermissionGate({ threadId: owner, toolName: 'Write', params: {} })
    expect(opened.ok).toBe(true)
    if (!opened.ok) return

    expect(resolvePermissionGate(intruder, opened.gate.requestId, true)).toEqual({
      ok: false,
      code: 'thread_mismatch',
    })
    // Nada consumido: a linha continua aberta e a continuação, viva.
    expect(getThreadGate(opened.gate.requestId)?.state).toBe('open')
    expect(listOpenPermissionGates(owner)).toHaveLength(1)

    expect(resolvePermissionGate(owner, opened.gate.requestId, true)).toEqual({ ok: true, toolName: 'Write' })
    await expect(opened.decision).resolves.toBe(true)
  })

  it('devolve not_found para gateId inexistente ou já consumido', () => {
    const threadId = seedThread()
    expect(resolvePermissionGate(threadId, 'gate_fantasma', true)).toEqual({ ok: false, code: 'not_found' })

    const opened = openPermissionGate({ threadId, toolName: 'Bash', params: {} })
    if (!opened.ok) throw new Error('gate não abriu')
    resolvePermissionGate(threadId, opened.gate.requestId, true)
    expect(resolvePermissionGate(threadId, opened.gate.requestId, true)).toEqual({ ok: false, code: 'not_found' })
  })

  it('emite gate.resolved + permission.resolved e grava a resolução na linha', () => {
    const threadId = seedThread()
    const opened = openPermissionGate({ threadId, toolName: 'Bash', params: {} })
    if (!opened.ok) throw new Error('gate não abriu')
    const received = listen(threadId)

    resolvePermissionGate(threadId, opened.gate.requestId, false)

    expect(received.map((e) => e.type)).toEqual(['gate.resolved', 'permission.resolved', 'state.change'])
    expect(received[0]).toMatchObject({ gateId: opened.gate.requestId, state: 'resolved', allow: false })
    expect(received[1]).toMatchObject({ requestId: opened.gate.requestId, allow: false })
    expect(getThreadGate(opened.gate.requestId)).toMatchObject({
      state: 'resolved',
      resolution: { allow: false, reason: 'user_decision' },
    })
  })

  it('roda onGranted (Permitir todos) só no allow e antes de destravar o hook', async () => {
    const threadId = seedThread()
    const denied = openPermissionGate({ threadId, toolName: 'Bash', params: {} })
    if (!denied.ok) throw new Error('gate não abriu')

    const calls: Array<{ threadId: string; toolName: string }> = []
    resolvePermissionGate(threadId, denied.gate.requestId, false, { onGranted: (info) => calls.push(info) })
    await expect(denied.decision).resolves.toBe(false)
    expect(calls).toEqual([])

    const allowed = openPermissionGate({ threadId, toolName: 'Bash', params: {} })
    if (!allowed.ok) throw new Error('gate não abriu')
    // Ordem que importa: quando o hook destrava, a allowlist já tem que estar gravada — senão o
    // tool call seguinte do CLI reabre card mesmo depois do "Permitir todos".
    let callsAtHookRelease = -1
    void allowed.decision.then(() => {
      callsAtHookRelease = calls.length
    })
    resolvePermissionGate(threadId, allowed.gate.requestId, true, { onGranted: (info) => calls.push(info) })
    await allowed.decision
    expect(calls).toEqual([{ threadId, toolName: 'Bash' }])
    expect(callsAtHookRelease).toBe(1)
  })
})

describe('allowOpenPermissionGates (upgrade de nível mid-turn)', () => {
  it('sem accessLevel libera tudo e devolve os gateIds', async () => {
    const threadId = seedThread()
    const write = openPermissionGate({ threadId, toolName: 'Write', params: {} })
    const bash = openPermissionGate({ threadId, toolName: 'Bash', params: {} })
    if (!write.ok || !bash.ok) throw new Error('gate não abriu')

    expect(allowOpenPermissionGates(threadId)).toEqual([write.gate.requestId, bash.gate.requestId])
    await expect(write.decision).resolves.toBe(true)
    await expect(bash.decision).resolves.toBe(true)
    expect(getThread(threadId)?.state).toBe('running')
  })

  it('auto-accept-edits solta Write e mantém Bash no card', async () => {
    const threadId = seedThread()
    const write = openPermissionGate({ threadId, toolName: 'Write', params: {} })
    const bash = openPermissionGate({ threadId, toolName: 'Bash', params: {} })
    if (!write.ok || !bash.ok) throw new Error('gate não abriu')

    expect(allowOpenPermissionGates(threadId, 'auto-accept-edits')).toEqual([write.gate.requestId])
    await expect(write.decision).resolves.toBe(true)
    expect(listOpenPermissionGates(threadId).map((p) => p.toolName)).toEqual(['Bash'])
    // Ainda há gate aberto: a thread não pode voltar a running.
    expect(getThread(threadId)?.state).toBe('waiting_permission')

    resolvePermissionGate(threadId, bash.gate.requestId, false)
    await bash.decision
  })
})

describe('expireOpenPermissionGates (cancel / fim de turno)', () => {
  it('nega tudo, marca as linhas como expired e não restaura running', async () => {
    const threadId = seedThread()
    const opened = openPermissionGate({ threadId, toolName: 'Write', params: {} })
    if (!opened.ok) throw new Error('gate não abriu')
    const received = listen(threadId)

    expect(expireOpenPermissionGates(threadId, 'thread_cancelled')).toEqual([opened.gate.requestId])
    await expect(opened.decision).resolves.toBe(false)
    expect(getThreadGate(opened.gate.requestId)).toMatchObject({
      state: 'expired',
      resolution: { allow: false, reason: 'thread_cancelled' },
    })
    // Quem assenta o estado final (cancelled/error/idle) é o chamador.
    expect(getThread(threadId)?.state).toBe('waiting_permission')
    // Contrato legado: este caminho nunca emitiu `permission.resolved`.
    expect(received.map((e) => e.type)).toEqual(['gate.resolved'])
  })

  it('é no-op silencioso quando não há gate aberto', () => {
    const threadId = seedThread()
    expect(expireOpenPermissionGates(threadId)).toEqual([])
  })

  it('não toca em gate de outra thread', async () => {
    const a = seedThread()
    const b = seedThread()
    const gateA = openPermissionGate({ threadId: a, toolName: 'Write', params: {} })
    const gateB = openPermissionGate({ threadId: b, toolName: 'Write', params: {} })
    if (!gateA.ok || !gateB.ok) throw new Error('gate não abriu')

    expireOpenPermissionGates(a)
    await expect(gateA.decision).resolves.toBe(false)
    expect(hasOpenPermissionGate(b)).toBe(true)

    expireOpenPermissionGates(b)
    await gateB.decision
  })
})

describe('timeout fail-closed', () => {
  it('auto-nega, marca expired, emite os dois eventos e restaura running', async () => {
    const threadId = seedThread()
    const received = listen(threadId)
    const opened = openPermissionGate({ threadId, toolName: 'Bash', params: {}, timeoutMs: 40 })
    if (!opened.ok) throw new Error('gate não abriu')
    expect(hasOpenPermissionGate(threadId)).toBe(true)

    await expect(opened.decision).resolves.toBe(false)

    expect(hasOpenPermissionGate(threadId)).toBe(false)
    expect(listOpenPermissionGates(threadId)).toEqual([])
    expect(getThreadGate(opened.gate.requestId)).toMatchObject({
      state: 'expired',
      resolution: { allow: false, reason: 'permission_timeout' },
    })
    expect(getThread(threadId)?.state).toBe('running')
    expect(received.some((e) => e.type === 'permission.resolved' && e.allow === false)).toBe(true)
    expect(received.some((e) => e.type === 'gate.resolved' && e.state === 'expired')).toBe(true)
  })

  it('a resolução do usuário desarma o timer (sem segunda resposta ao hook)', async () => {
    const threadId = seedThread()
    const opened = openPermissionGate({ threadId, toolName: 'Write', params: {}, timeoutMs: 60 })
    if (!opened.ok) throw new Error('gate não abriu')

    expect(resolvePermissionGate(threadId, opened.gate.requestId, true).ok).toBe(true)
    await expect(opened.decision).resolves.toBe(true)

    await new Promise((r) => setTimeout(r, 90))
    // O timer não pode ter reaberto/reescrito a linha já resolvida.
    expect(getThreadGate(opened.gate.requestId)).toMatchObject({
      state: 'resolved',
      resolution: { allow: true, reason: 'user_decision' },
    })
    expect(hasOpenPermissionGate(threadId)).toBe(false)
  })
})

describe('expireOrphanGates (boot)', () => {
  it('expira só gate sem continuação neste processo', () => {
    const orphanThread = seedThread()
    const liveThread = seedThread()

    // Gate "do processo anterior": a linha sobreviveu ao crash, a continuação não.
    const orphan = createThreadGate({
      threadId: orphanThread,
      kind: 'permission',
      toolName: 'Bash',
      payload: { command: 'ls' },
    })
    updateThread(orphanThread, { state: 'waiting_permission' })

    const live = openPermissionGate({ threadId: liveThread, toolName: 'Write', params: {} })
    if (!live.ok) throw new Error('gate não abriu')

    const expired = expireOrphanGates()
    expect(expired.map((g) => g.id)).toEqual([orphan.id])
    expect(getThreadGate(orphan.id)).toMatchObject({
      state: 'expired',
      resolution: { allow: false, reason: 'app_restarted' },
    })
    // Gate vivo (unlock repetido com um turno em andamento) não é tocado.
    expect(hasOpenPermissionGate(liveThread)).toBe(true)
    // Não mexe em `threads.state`: quem assenta a thread interrompida é `recoverRunningThreads()`.
    expect(getThread(orphanThread)?.state).toBe('waiting_permission')

    expireOpenPermissionGates(liveThread)
  })
})
