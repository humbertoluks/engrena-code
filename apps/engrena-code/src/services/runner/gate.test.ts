import { afterAll, afterEach, describe, expect, it } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

process.env.ENGRENACODE_USER_DATA = mkdtempSync(join(tmpdir(), 'engrenacode_claude_gate_'))

const { closeDb, getDb } = await import('../db/client.js')
const { createProject } = await import('../db/repositories/projects.js')
const { createThread, getThread, updateThread } = await import('../db/repositories/threads.js')
const { createThreadGate, getThreadGate, listOpenThreadGates } = await import(
  '../db/repositories/thread-gates.js'
)
const { listLogEntries } = await import('../db/repositories/log-entries.js')
const { HOOK_COMMAND_TIMEOUT_SEC, PERMISSION_HOOK_MARGIN_SEC } = await import(
  './providers/permission-contract.js'
)
const { clearAllSubscriptions, subscribe } = await import('./ws-hub.js')
const {
  allowOpenPermissionGates,
  clearAllGatesForTesting,
  expireOpenPermissionGates,
  expireOpenQuestionGates,
  expireOrphanGates,
  hasOpenPermissionGate,
  hasOpenQuestionGate,
  listOpenGates,
  listOpenPermissionGates,
  listOpenQuestionGates,
  markThreadWaitingUser,
  openPermissionGate,
  openQuestionGate,
  PERMISSION_TIMEOUT_MS,
  resolvePermissionGate,
  resolveQuestionGate,
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
  it('persiste o gate, põe a thread em waiting_permission e emite gate.opened', () => {
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
    expect(received.map((e) => e.type)).toEqual(['state.change', 'gate.opened'])
    // Contrato de wire do gate: `gateId` identifica o card, `payload` são os params da tool.
    expect(received[1]).toMatchObject({
      type: 'gate.opened',
      threadId,
      gateId: opened.gate.requestId,
      kind: 'permission',
      toolName: 'Bash',
      payload: { command: 'ls' },
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
    await expect(first.decision).resolves.toMatchObject({ allow: true })
    expect(hasOpenPermissionGate(threadId)).toBe(true)
    expect(getThread(threadId)?.state).toBe('waiting_permission')

    expect(resolvePermissionGate(threadId, second.gate.requestId, false)).toEqual({ ok: true, toolName: 'Bash' })
    await expect(second.decision).resolves.toMatchObject({ allow: false })
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
    await expect(opened.decision).resolves.toMatchObject({ allow: true })
  })

  it('devolve not_found para gateId inexistente ou já consumido', () => {
    const threadId = seedThread()
    expect(resolvePermissionGate(threadId, 'gate_fantasma', true)).toEqual({ ok: false, code: 'not_found' })

    const opened = openPermissionGate({ threadId, toolName: 'Bash', params: {} })
    if (!opened.ok) throw new Error('gate não abriu')
    resolvePermissionGate(threadId, opened.gate.requestId, true)
    expect(resolvePermissionGate(threadId, opened.gate.requestId, true)).toEqual({ ok: false, code: 'not_found' })
  })

  it('emite gate.resolved e grava a resolução na linha', () => {
    const threadId = seedThread()
    const opened = openPermissionGate({ threadId, toolName: 'Bash', params: {} })
    if (!opened.ok) throw new Error('gate não abriu')
    const received = listen(threadId)

    resolvePermissionGate(threadId, opened.gate.requestId, false)

    expect(received.map((e) => e.type)).toEqual(['gate.resolved', 'state.change'])
    expect(received[0]).toMatchObject({
      threadId,
      gateId: opened.gate.requestId,
      kind: 'permission',
      state: 'resolved',
      allow: false,
      reason: 'user_decision',
    })
    expect(getThreadGate(opened.gate.requestId)).toMatchObject({
      state: 'resolved',
      resolution: { allow: false, reason: 'user_decision' },
    })
  })

  it('roda onGranted (Permitir todos) só no allow e antes de destravar o hook', async () => {
    const threadId = seedThread()
    const denied = openPermissionGate({ threadId, toolName: 'Bash', params: {} })
    if (!denied.ok) throw new Error('gate não abriu')

    const calls: Array<{ threadId: string; toolName: string; params: unknown }> = []
    resolvePermissionGate(threadId, denied.gate.requestId, false, { onGranted: (info) => calls.push(info) })
    await expect(denied.decision).resolves.toMatchObject({ allow: false })
    expect(calls).toEqual([])

    // `params` viaja junto: a allowlist do shell é por verbo do comando (`bash-command-scope.ts`),
    // e sem o payload o "Permitir todos" volta a conceder o Bash inteiro.
    const allowed = openPermissionGate({ threadId, toolName: 'Bash', params: { command: 'git status' } })
    if (!allowed.ok) throw new Error('gate não abriu')
    // Ordem que importa: quando o hook destrava, a allowlist já tem que estar gravada — senão o
    // tool call seguinte do CLI reabre card mesmo depois do "Permitir todos".
    let callsAtHookRelease = -1
    void allowed.decision.then(() => {
      callsAtHookRelease = calls.length
    })
    resolvePermissionGate(threadId, allowed.gate.requestId, true, { onGranted: (info) => calls.push(info) })
    await allowed.decision
    expect(calls).toEqual([{ threadId, toolName: 'Bash', params: { command: 'git status' } }])
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
    await expect(write.decision).resolves.toMatchObject({ allow: true })
    await expect(bash.decision).resolves.toMatchObject({ allow: true })
    expect(getThread(threadId)?.state).toBe('running')
  })

  it('auto-accept-edits solta Write e mantém Bash no card', async () => {
    const threadId = seedThread()
    const write = openPermissionGate({ threadId, toolName: 'Write', params: {} })
    const bash = openPermissionGate({ threadId, toolName: 'Bash', params: {} })
    if (!write.ok || !bash.ok) throw new Error('gate não abriu')

    expect(allowOpenPermissionGates(threadId, 'auto-accept-edits')).toEqual([write.gate.requestId])
    await expect(write.decision).resolves.toMatchObject({ allow: true })
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
    await expect(opened.decision).resolves.toMatchObject({ allow: false })
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
    await expect(gateA.decision).resolves.toMatchObject({ allow: false })
    expect(hasOpenPermissionGate(b)).toBe(true)

    expireOpenPermissionGates(b)
    await gateB.decision
  })
})

/**
 * R09: com `decision` resolvendo só um booleano, "o usuário negou no card" e "ninguém respondeu"
 * chegavam idênticos ao broker, e o diagnóstico da negação nativa acusava o CLI nos dois casos.
 */
describe('motivo do fechamento na continuação do hook', () => {
  it('separa a negação do usuário do fail-closed por timeout', async () => {
    const threadId = seedThread()

    const denied = openPermissionGate({ threadId, toolName: 'Read', params: {} })
    if (!denied.ok) throw new Error('gate não abriu')
    resolvePermissionGate(threadId, denied.gate.requestId, false)
    await expect(denied.decision).resolves.toEqual({ allow: false, reason: 'user_decision' })

    const timedOut = openPermissionGate({ threadId, toolName: 'Read', params: {}, timeoutMs: 40 })
    if (!timedOut.ok) throw new Error('gate não abriu')
    await expect(timedOut.decision).resolves.toEqual({ allow: false, reason: 'permission_timeout' })
  })

  it('carrega o motivo também no allow e no cancel do turno', async () => {
    const threadId = seedThread()

    const allowed = openPermissionGate({ threadId, toolName: 'Write', params: {} })
    if (!allowed.ok) throw new Error('gate não abriu')
    resolvePermissionGate(threadId, allowed.gate.requestId, true)
    await expect(allowed.decision).resolves.toEqual({ allow: true, reason: 'user_decision' })

    const cancelled = openPermissionGate({ threadId, toolName: 'Bash', params: {} })
    if (!cancelled.ok) throw new Error('gate não abriu')
    expireOpenPermissionGates(threadId, 'thread_cancelled')
    await expect(cancelled.decision).resolves.toEqual({ allow: false, reason: 'thread_cancelled' })
  })
})

describe('timeout fail-closed', () => {
  it('auto-nega, marca expired, emite gate.resolved e restaura running', async () => {
    const threadId = seedThread()
    const received = listen(threadId)
    const opened = openPermissionGate({ threadId, toolName: 'Bash', params: {}, timeoutMs: 40 })
    if (!opened.ok) throw new Error('gate não abriu')
    expect(hasOpenPermissionGate(threadId)).toBe(true)

    await expect(opened.decision).resolves.toMatchObject({ allow: false })

    expect(hasOpenPermissionGate(threadId)).toBe(false)
    expect(listOpenPermissionGates(threadId)).toEqual([])
    expect(getThreadGate(opened.gate.requestId)).toMatchObject({
      state: 'expired',
      resolution: { allow: false, reason: 'permission_timeout' },
    })
    expect(getThread(threadId)?.state).toBe('running')
    expect(
      received.some((e) => e.type === 'gate.resolved' && e.state === 'expired' && e.allow === false)
    ).toBe(true)
  })

  it('a resolução do usuário desarma o timer (sem segunda resposta ao hook)', async () => {
    const threadId = seedThread()
    const opened = openPermissionGate({ threadId, toolName: 'Write', params: {}, timeoutMs: 60 })
    if (!opened.ok) throw new Error('gate não abriu')

    expect(resolvePermissionGate(threadId, opened.gate.requestId, true).ok).toBe(true)
    await expect(opened.decision).resolves.toMatchObject({ allow: true })

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

describe('openQuestionGate', () => {
  it('persiste o gate, põe a thread em waiting_user e emite gate.opened', async () => {
    const threadId = seedThread()
    const received = listen(threadId)

    const opened = openQuestionGate({ threadId, question: { prompt: 'Qual caminho?', options: ['A', 'B'] } })
    expect(opened.ok).toBe(true)
    if (!opened.ok) return

    const row = getThreadGate(opened.gate.gateId)
    expect(row?.state).toBe('open')
    expect(row?.kind).toBe('question')
    expect(row?.toolName).toBeNull()
    expect(row?.payload).toEqual({ prompt: 'Qual caminho?', options: ['A', 'B'] })
    // Sem prazo por padrão: quem encerra a pergunta é o usuário, o cancel ou o fim do turno.
    expect(row?.expiresAt).toBeNull()

    expect(getThread(threadId)?.state).toBe('waiting_user')
    expect(received.map((e) => e.type)).toEqual(['state.change', 'gate.opened'])
    expect(received[1]).toMatchObject({ type: 'gate.opened', gateId: opened.gate.gateId, kind: 'question' })

    // `permission.resolved` é wire de permissão — pergunta não emite legado nenhum.
    expect(resolveQuestionGate(threadId, opened.gate.gateId, { selectedOptions: ['A'] })).toEqual({ ok: true })
    await expect(opened.answer).resolves.toEqual({ selectedOptions: ['A'] })
    expect(received.some((e) => e.type === 'permission.resolved')).toBe(false)
    expect(received.some((e) => e.type === 'gate.resolved')).toBe(true)
    expect(getThread(threadId)?.state).toBe('running')
  })

  it('fail-closed quando o gate não persiste (thread apagada mid-turn)', () => {
    expect(openQuestionGate({ threadId: 'thr_inexistente' })).toEqual({ ok: false, code: 'gate_not_persisted' })
  })

  /** O anti-padrão que a migração existe para matar: `pending` por thread, sobrescrito em silêncio. */
  it('duas perguntas na mesma thread coexistem e cada uma resolve a sua continuação', async () => {
    const threadId = seedThread()

    const first = openQuestionGate({ threadId, question: { prompt: 'Primeira?' } })
    const second = openQuestionGate({ threadId, question: { prompt: 'Segunda?' } })
    if (!first.ok || !second.ok) throw new Error('gate não abriu')
    expect(listOpenQuestionGates(threadId)).toHaveLength(2)

    expect(resolveQuestionGate(threadId, second.gate.gateId, { freeText: 'depois' })).toEqual({ ok: true })
    await expect(second.answer).resolves.toEqual({ freeText: 'depois' })

    // A primeira continua pendente e a thread não volta a running com gate aberto.
    expect(hasOpenQuestionGate(threadId)).toBe(true)
    expect(getThread(threadId)?.state).toBe('waiting_user')

    expect(resolveQuestionGate(threadId, first.gate.gateId, { freeText: 'antes' })).toEqual({ ok: true })
    await expect(first.answer).resolves.toEqual({ freeText: 'antes' })
    expect(getThread(threadId)?.state).toBe('running')
  })

  it('expira e rejeita quando timeoutMs é informado', async () => {
    const threadId = seedThread()
    const opened = openQuestionGate({ threadId, timeoutMs: 20 })
    if (!opened.ok) throw new Error('gate não abriu')

    await expect(opened.answer).rejects.toThrow('Tempo esgotado sem resposta do usuário.')
    expect(getThreadGate(opened.gate.gateId)).toMatchObject({
      state: 'expired',
      resolution: { allow: false, reason: 'question_timeout' },
    })
  })
})

describe('resolveQuestionGate', () => {
  it('não consome gate de outra thread (thread_mismatch) e mantém a pergunta pendente lá', async () => {
    const owner = seedThread()
    const intruder = seedThread()
    const opened = openQuestionGate({ threadId: owner, question: { prompt: 'x' } })
    if (!opened.ok) throw new Error('gate não abriu')

    expect(resolveQuestionGate(intruder, opened.gate.gateId, { freeText: 'oi' })).toEqual({
      ok: false,
      code: 'thread_mismatch',
    })
    expect(getThreadGate(opened.gate.gateId)?.state).toBe('open')
    expect(hasOpenQuestionGate(owner)).toBe(true)

    expect(resolveQuestionGate(owner, opened.gate.gateId, { freeText: 'oi' })).toEqual({ ok: true })
    await expect(opened.answer).resolves.toEqual({ freeText: 'oi' })
  })

  it('não aceita gateId de permissão (not_found) nem gate já consumido', async () => {
    const threadId = seedThread()
    const permission = openPermissionGate({ threadId, toolName: 'Bash', params: { command: 'ls' } })
    if (!permission.ok) throw new Error('gate não abriu')

    expect(resolveQuestionGate(threadId, permission.gate.requestId, { freeText: 'x' })).toEqual({
      ok: false,
      code: 'not_found',
    })
    expect(hasOpenPermissionGate(threadId)).toBe(true)

    expireOpenPermissionGates(threadId, 'turn_ended')
    await expect(permission.decision).resolves.toMatchObject({ allow: false })
  })
})

describe('expireOpenQuestionGates', () => {
  it('rejeita a pergunta com a mensagem PT-BR e não assenta o estado da thread', async () => {
    const threadId = seedThread()
    const opened = openQuestionGate({ threadId, question: { prompt: 'x' } })
    if (!opened.ok) throw new Error('gate não abriu')
    expect(getThread(threadId)?.state).toBe('waiting_user')

    const expired = expireOpenQuestionGates(threadId, 'thread_cancelled', 'thread cancelada pelo usuário')
    expect(expired).toEqual([opened.gate.gateId])
    await expect(opened.answer).rejects.toThrow('thread cancelada pelo usuário')
    expect(getThreadGate(opened.gate.gateId)).toMatchObject({
      state: 'expired',
      resolution: { allow: false, reason: 'thread_cancelled' },
    })
    // Quem assenta cancelled/error/idle é o chamador — o gate não devolve a thread para running.
    expect(getThread(threadId)?.state).toBe('waiting_user')
  })
})

describe('markThreadWaitingUser', () => {
  it('é idempotente e ignora thread inexistente', () => {
    const threadId = seedThread()
    const received = listen(threadId)

    markThreadWaitingUser(threadId)
    markThreadWaitingUser(threadId)
    markThreadWaitingUser('thr_inexistente')

    expect(getThread(threadId)?.state).toBe('waiting_user')
    expect(received.filter((e) => e.type === 'state.change')).toHaveLength(1)
  })
})

describe('listOpenGates', () => {
  it('traz os dois kinds na ordem de abertura', async () => {
    const threadId = seedThread()
    const permission = openPermissionGate({ threadId, toolName: 'Bash', params: { command: 'ls' } })
    const question = openQuestionGate({ threadId, question: { prompt: 'Segue?' } })
    if (!permission.ok || !question.ok) throw new Error('gate não abriu')

    expect(listOpenGates(threadId)).toEqual([
      expect.objectContaining({ gateId: permission.gate.requestId, kind: 'permission', toolName: 'Bash' }),
      expect.objectContaining({ gateId: question.gate.gateId, kind: 'question', toolName: null }),
    ])
    expect(listOpenPermissionGates(threadId)).toHaveLength(1)
    expect(listOpenQuestionGates(threadId)).toHaveLength(1)

    expireOpenPermissionGates(threadId, 'turn_ended')
    expireOpenQuestionGates(threadId, 'turn_ended', 'Turno encerrado.')
    await expect(permission.decision).resolves.toMatchObject({ allow: false })
    await expect(question.answer).rejects.toThrow('Turno encerrado.')
  })

  /**
   * O snapshot é lido na abertura da thread e depois de reconnect. O `setTimeout` que expira o
   * gate vive na memória deste processo e não cobre máquina que dormiu nem processo suspenso: a
   * linha fica vencida e `open`, e sem esta varredura o card morto voltava à tela com o backend
   * já sem nada pendente — o buraco da janela de backoff longo, que nunca aparece sozinho porque
   * o reconnect real leva menos de 8 s e o gate só vence aos 120 s.
   */
  it('não ressuscita gate vencido que ficou aberto (timer não rodou)', async () => {
    const threadId = seedThread()
    const permission = openPermissionGate({ threadId, toolName: 'Bash', params: { command: 'ls' } })
    if (!permission.ok) throw new Error('gate não abriu')
    expect(listOpenGates(threadId)).toHaveLength(1)

    // Vence a linha por baixo, sem deixar o timer rodar: é o estado que o processo suspenso deixa.
    getDb()
      .prepare('UPDATE thread_gates SET expires_at = ? WHERE id = ?')
      .run(Date.now() - 1000, permission.gate.requestId)

    expect(listOpenGates(threadId)).toEqual([])
    expect(listOpenThreadGates(threadId)).toEqual([])
    expect(getThreadGate(permission.gate.requestId)?.state).toBe('expired')
    // Fail-closed: a continuação presa do outro lado é liberada negando.
    await expect(permission.decision).resolves.toMatchObject({ allow: false })
  })

  it('preserva gate ainda no prazo', () => {
    const threadId = seedThread()
    const permission = openPermissionGate({ threadId, toolName: 'Bash', params: { command: 'ls' } })
    if (!permission.ok) throw new Error('gate não abriu')

    expect(listOpenGates(threadId)).toHaveLength(1)
    expect(listOpenGates(threadId)).toHaveLength(1)

    expireOpenPermissionGates(threadId, 'turn_ended')
  })
})

/**
 * F32 — prazo derivado e instrumentado. O que estes testes protegem é a ligação entre o prazo do
 * card e o teto do hook do CLI: um literal aqui volta a ser o defeito que a feature corrigiu.
 */

describe('prazo do card de permissão (F32)', () => {
  /** `listLogEntries` só filtra por `kind`; o recorte por thread é do chamador. */
  function linhasDePermissao(threadId: string, tool: string): string[] {
    return listLogEntries({ kind: 'tool' })
      .filter((entry) => entry.threadId === threadId)
      .map((entry) => entry.event)
      .filter((event) => event.startsWith(`Permissão de ${tool}:`))
  }

  it('o prazo do gate é o derivado do contrato do hook, não um literal', () => {
    expect(PERMISSION_TIMEOUT_MS).toBe((HOOK_COMMAND_TIMEOUT_SEC - PERMISSION_HOOK_MARGIN_SEC) * 1000)
    expect(PERMISSION_TIMEOUT_MS).toBe(480_000)
  })

  it('openPermissionGate usa esse prazo quando ninguém passa timeoutMs', async () => {
    const threadId = seedThread()
    const opened = openPermissionGate({ threadId, toolName: 'Bash', params: {} })
    expect(opened.ok).toBe(true)
    if (!opened.ok) return
    const gate = getThreadGate(opened.gate.requestId)
    expect(gate).not.toBeNull()
    // Medido do próprio createdAt do gate, não de um relógio do turno.
    expect((gate?.expiresAt as number) - (gate?.createdAt as number)).toBe(PERMISSION_TIMEOUT_MS)
    resolvePermissionGate(threadId, opened.gate.requestId, false)
    await opened.decision
  })

  it('nenhum caminho de gate tem prazo próprio (anti-drift)', async () => {
    const { readFileSync } = await import('node:fs')
    const fonte = readFileSync(new URL('./gate.ts', import.meta.url), 'utf-8')
    // Só a linha do derivado pode falar de prazo. Qualquer `N * 60 * 1000` novo é drift.
    expect(fonte).not.toMatch(/\d+\s*\*\s*60\s*\*\s*1000/)
    expect(fonte).toContain('permissionGateTimeoutMs()')
  })

  it('gate concedido grava desfecho granted e os segundos abertos', async () => {
    const threadId = seedThread()
    const opened = openPermissionGate({ threadId, toolName: 'Write', params: { file_path: 'x' } })
    expect(opened.ok).toBe(true)
    if (!opened.ok) return
    resolvePermissionGate(threadId, opened.gate.requestId, true)
    await opened.decision

    const linhas = linhasDePermissao(threadId, 'Write')
    expect(linhas).toHaveLength(1)
    expect(linhas[0]).toContain('granted')
    expect(linhas[0]).toMatch(/após \d+s/)
    expect(linhas[0]).toContain('prazo 480s')
  })

  it('gate negado grava denied, e o params nunca vaza para o log', async () => {
    const threadId = seedThread()
    const opened = openPermissionGate({
      threadId,
      toolName: 'Bash',
      params: { command: 'echo $SENHA_SECRETA' },
    })
    expect(opened.ok).toBe(true)
    if (!opened.ok) return
    resolvePermissionGate(threadId, opened.gate.requestId, false)
    await opened.decision

    const linhas = linhasDePermissao(threadId, 'Bash')
    expect(linhas).toHaveLength(1)
    expect(linhas[0]).toContain('denied')
    // `params` vira o payload do gate: pode conter comando e credencial. Nunca no log.
    expect(linhas[0]).not.toContain('SENHA_SECRETA')
    expect(linhas[0]).not.toContain('echo')
  })

  it('gate expirado grava expired e continua fail-closed', async () => {
    const threadId = seedThread()
    const opened = openPermissionGate({ threadId, toolName: 'WebFetch', params: {}, timeoutMs: 40 })
    expect(opened.ok).toBe(true)
    if (!opened.ok) return
    // Fail-closed: expiry nega, nunca libera.
    await expect(opened.decision).resolves.toMatchObject({ allow: false })

    const linhas = linhasDePermissao(threadId, 'WebFetch')
    expect(linhas).toHaveLength(1)
    expect(linhas[0]).toContain('expired')
  })

  it('gate de pergunta não gera linha de permissão', () => {
    const threadId = seedThread()
    markThreadWaitingUser(threadId)
    const opened = openQuestionGate({ threadId, question: { prompt: 'segue?', options: ['sim'] } })
    expect(opened.ok).toBe(true)
    if (!opened.ok) return
    resolveQuestionGate(threadId, opened.gate.gateId, { selectedOptions: ['sim'] })
    const linhas = listLogEntries({ kind: 'tool' })
      .filter((entry) => entry.threadId === threadId)
      .filter((entry) => entry.event.startsWith('Permissão de'))
    expect(linhas).toHaveLength(0)
  })

  it('dois gates no mesmo turno medem prazos independentes', async () => {
    const threadId = seedThread()
    const primeiro = openPermissionGate({ threadId, toolName: 'Read', params: {} })
    const segundo = openPermissionGate({ threadId, toolName: 'Grep', params: {} })
    expect(primeiro.ok && segundo.ok).toBe(true)
    if (!primeiro.ok || !segundo.ok) return
    const a = getThreadGate(primeiro.gate.requestId)
    const b = getThreadGate(segundo.gate.requestId)
    expect((a?.expiresAt as number) - (a?.createdAt as number)).toBe(PERMISSION_TIMEOUT_MS)
    expect((b?.expiresAt as number) - (b?.createdAt as number)).toBe(PERMISSION_TIMEOUT_MS)
    resolvePermissionGate(threadId, primeiro.gate.requestId, false)
    resolvePermissionGate(threadId, segundo.gate.requestId, false)
    await Promise.all([primeiro.decision, segundo.decision])
  })
})
