import { afterAll, afterEach, describe, expect, it } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

process.env.ENGRENACODE_USER_DATA = mkdtempSync(join(tmpdir(), 'engrenacode_claude_turnstate_'))

const { closeDb } = await import('../db/client.js')
const { createProject } = await import('../db/repositories/projects.js')
const { createThread, deleteThread, getThread } = await import('../db/repositories/threads.js')
type ThreadState = import('../db/repositories/threads.js').ThreadState
const { clearAllSubscriptions, subscribe } = await import('./ws-hub.js')
const { applyTransition, nextThreadState, INITIAL_TURN_STATE } = await import('./turn-state.js')
type TurnEvent = import('./turn-state.js').TurnEvent

const fixtures: string[] = []

function seedThread(state: ThreadState): string {
  const dir = mkdtempSync(join(tmpdir(), 'engrenacode_claude_turnstate_proj_'))
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
  state?: string
}

function listen(threadId: string): Captured[] {
  const received: Captured[] = []
  const socket = { readyState: 1, OPEN: 1, send: (data: string) => received.push(JSON.parse(data) as Captured) }
  subscribe(threadId, socket as unknown as Parameters<typeof subscribe>[1])
  return received
}

afterEach(() => {
  clearAllSubscriptions()
})

afterAll(() => {
  closeDb()
  for (const dir of fixtures) rmSync(dir, { recursive: true, force: true })
  rmSync(process.env.ENGRENACODE_USER_DATA as string, { recursive: true, force: true })
})

const ALL_STATES: ThreadState[] = [
  'running',
  'idle',
  'committed',
  'error',
  'stopping',
  'waiting_user',
  'waiting_permission',
  'cancelled',
]

/** Estados de onde cada evento é legal, e para onde levam. O resto da matriz é ilegal por omissão. */
const LEGAL: Record<TurnEvent, Partial<Record<ThreadState, ThreadState>>> = {
  follow_up: { idle: 'running', committed: 'running', error: 'running', cancelled: 'running' },
  gate_opened_permission: {
    running: 'waiting_permission',
    waiting_user: 'waiting_permission',
    waiting_permission: 'waiting_permission',
  },
  gate_opened_question: {
    running: 'waiting_user',
    waiting_permission: 'waiting_user',
    waiting_user: 'waiting_user',
  },
  gates_closed: { waiting_permission: 'running', waiting_user: 'running' },
  cancel_requested: {
    running: 'stopping',
    waiting_user: 'stopping',
    waiting_permission: 'stopping',
    stopping: 'stopping',
  },
  cancel_settled: {
    running: 'cancelled',
    waiting_user: 'cancelled',
    waiting_permission: 'cancelled',
    stopping: 'cancelled',
    cancelled: 'cancelled',
  },
  turn_failed: {
    running: 'error',
    waiting_user: 'error',
    waiting_permission: 'error',
    stopping: 'error',
    error: 'error',
  },
  turn_finished: {
    running: 'idle',
    waiting_user: 'idle',
    waiting_permission: 'idle',
    idle: 'idle',
    // Fim de turno com cancel já pedido assenta em `cancelled`, nunca `idle`.
    stopping: 'cancelled',
  },
  diffs_committed: { idle: 'committed', committed: 'committed', error: 'committed', cancelled: 'committed' },
  diffs_settled: { idle: 'idle', committed: 'idle', error: 'idle', cancelled: 'idle' },
}

describe('nextThreadState — matriz completa', () => {
  for (const event of Object.keys(LEGAL) as TurnEvent[]) {
    for (const current of ALL_STATES) {
      const expected = LEGAL[event][current] ?? null
      it(`${current} --${event}--> ${expected ?? 'ILEGAL'}`, () => {
        expect(nextThreadState(current, event)).toBe(expected)
      })
    }
  }
})

describe('nextThreadState — invariantes documentadas', () => {
  it('stopping é absorvente: só sai para cancelled ou error', () => {
    const reachable = (Object.keys(LEGAL) as TurnEvent[])
      .map((event) => nextThreadState('stopping', event))
      .filter((state): state is ThreadState => state !== null && state !== 'stopping')
    expect([...new Set(reachable)].sort()).toEqual(['cancelled', 'error'])
  })

  it('tool-result atrasado não ressuscita running durante stopping (bug do cancel sobrescrito)', () => {
    expect(nextThreadState('stopping', 'gates_closed')).toBeNull()
    expect(nextThreadState('stopping', 'gate_opened_permission')).toBeNull()
    expect(nextThreadState('stopping', 'gate_opened_question')).toBeNull()
  })

  it('fim de turno durante stopping assenta em cancelled — nunca idle, nunca preso em stopping', () => {
    expect(nextThreadState('stopping', 'turn_finished')).toBe('cancelled')
  })

  it('voltar de gate para running só vem de waiting_permission/waiting_user', () => {
    const origins = ALL_STATES.filter((state) => nextThreadState(state, 'gates_closed') === 'running')
    expect(origins.sort()).toEqual(['waiting_permission', 'waiting_user'])
  })

  it('entrar em waiting_* só é legal com turno vivo — nunca de thread assentada', () => {
    for (const state of ['idle', 'committed', 'error', 'cancelled'] as ThreadState[]) {
      expect(nextThreadState(state, 'gate_opened_permission')).toBeNull()
      expect(nextThreadState(state, 'gate_opened_question')).toBeNull()
    }
  })

  it('follow-up ressuscita thread assentada (H2) e nunca thread com turno vivo', () => {
    // Terminais NÃO são becos sem saída: `idle`/`committed`/`error`/`cancelled` voltam a `running`
    // pelo follow-up (H2 do produto) e aceitam accept/reject de diff. O que não se faz a partir
    // deles é entrar em `waiting_*`, pedir cancel ou fechar gate — não há turno nem gate.
    for (const state of ['idle', 'committed', 'error', 'cancelled'] as ThreadState[]) {
      expect(nextThreadState(state, 'follow_up')).toBe('running')
      expect(nextThreadState(state, 'cancel_requested')).toBeNull()
      expect(nextThreadState(state, 'gates_closed')).toBeNull()
    }
    for (const state of ['running', 'stopping', 'waiting_user', 'waiting_permission'] as ThreadState[]) {
      expect(nextThreadState(state, 'follow_up')).toBeNull()
    }
  })

  it('turno já cancelado não é reaberto por fim de turno nem por falha tardia', () => {
    expect(nextThreadState('cancelled', 'turn_finished')).toBeNull()
    expect(nextThreadState('cancelled', 'turn_failed')).toBeNull()
  })

  it('accept/reject de diff nunca sobrescreve o estado de um turno vivo', () => {
    for (const state of ['running', 'stopping', 'waiting_user', 'waiting_permission'] as ThreadState[]) {
      expect(nextThreadState(state, 'diffs_committed')).toBeNull()
      expect(nextThreadState(state, 'diffs_settled')).toBeNull()
    }
  })

  it('thread nova nasce em running', () => {
    expect(INITIAL_TURN_STATE).toBe('running')
  })
})

describe('applyTransition', () => {
  it('grava o estado e emite state.change — nessa ordem', () => {
    const threadId = seedThread('running')
    const received: Array<{ type: string; stateAtEmit?: string }> = []
    const socket = {
      readyState: 1,
      OPEN: 1,
      send: (data: string) => {
        const event = JSON.parse(data) as Captured
        // Quem reage ao evento e relê a thread já tem que ver o estado novo.
        received.push({ type: event.type, stateAtEmit: getThread(threadId)?.state })
      },
    }
    subscribe(threadId, socket as unknown as Parameters<typeof subscribe>[1])

    const result = applyTransition(threadId, 'turn_finished')

    expect(result).toMatchObject({ ok: true, state: 'idle', changed: true })
    expect(getThread(threadId)?.state).toBe('idle')
    expect(received).toEqual([{ type: 'state.change', stateAtEmit: 'idle' }])
  })

  it('transição ilegal não escreve, não emite e devolve o estado atual sem lançar', () => {
    const threadId = seedThread('stopping')
    const received = listen(threadId)

    const result = applyTransition(threadId, 'gates_closed')

    expect(result).toEqual({ ok: false, code: 'illegal_transition', from: 'stopping', state: 'stopping' })
    expect(getThread(threadId)?.state).toBe('stopping')
    expect(received).toHaveLength(0)
  })

  it('transição legal para o mesmo estado é no-op: sem UPDATE redundante e sem emit duplicado', () => {
    const threadId = seedThread('waiting_user')
    const before = getThread(threadId)?.updatedAt
    const received = listen(threadId)

    const result = applyTransition(threadId, 'gate_opened_question')

    expect(result).toMatchObject({ ok: true, state: 'waiting_user', changed: false })
    expect(getThread(threadId)?.updatedAt).toBe(before)
    expect(received).toHaveLength(0)
  })

  it('grava o patch junto do estado no mesmo UPDATE (follow-up troca modelo e volta a running)', () => {
    const threadId = seedThread('idle')

    const result = applyTransition(threadId, 'follow_up', {
      patch: { model: 'gpt-5.1-codex', accessLevel: 'full-access' },
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.thread.state).toBe('running')
    expect(result.thread.model).toBe('gpt-5.1-codex')
    expect(result.thread.accessLevel).toBe('full-access')
  })

  it('thread inexistente devolve thread_not_found sem lançar', () => {
    const threadId = seedThread('running')
    deleteThread(threadId)
    expect(applyTransition(threadId, 'turn_finished')).toEqual({ ok: false, code: 'thread_not_found' })
    expect(applyTransition('thr_inexistente', 'cancel_settled')).toEqual({ ok: false, code: 'thread_not_found' })
  })

  it('cancel completo: running → stopping → cancelled, com um state.change por passo', () => {
    const threadId = seedThread('running')
    const received = listen(threadId)

    expect(applyTransition(threadId, 'cancel_requested')).toMatchObject({ ok: true, state: 'stopping' })
    // Clique duplo em Parar não duplica o evento.
    expect(applyTransition(threadId, 'cancel_requested')).toMatchObject({ ok: true, changed: false })
    // `tool-result` atrasado tentando voltar a running: rejeitado.
    expect(applyTransition(threadId, 'gates_closed')).toMatchObject({ ok: false, code: 'illegal_transition' })
    expect(applyTransition(threadId, 'cancel_settled')).toMatchObject({ ok: true, state: 'cancelled' })

    expect(received.map((e) => e.state)).toEqual(['stopping', 'cancelled'])
    expect(getThread(threadId)?.state).toBe('cancelled')
  })
})
