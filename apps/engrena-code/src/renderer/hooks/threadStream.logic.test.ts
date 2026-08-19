import { describe, expect, it } from 'vitest'
import {
  ACTIVE_THREAD_STATES,
  decideThreadStateResync,
  isActiveThreadState,
  isEventForThread,
  isExecutionStreamEvent,
  isSettledThreadState,
  planReconnect,
  reconcilesTurnEnd,
  refetchesHistory,
  reconnectDelayMs,
  RECONNECT_BASE_DELAY_MS,
  RECONNECT_MAX_DELAY_MS,
  SETTLED_THREAD_STATES,
  shouldRefetchHistoryOnResync,
  TURN_RECONCILED_STATES,
} from './threadStream.logic'
import type { StreamEvent } from '../services/ws-client'
import type { ThreadState } from '../services/threads-service'

/** Fonte de aleatoriedade determinística: consome a lista e repete o último valor. */
function rolls(...values: number[]): () => number {
  let i = 0
  return () => values[Math.min(i++, values.length - 1)] ?? 0
}

describe('reconnectDelayMs', () => {
  it('começa em 1s e dobra a cada tentativa (jitter no piso)', () => {
    const zero = rolls(0)
    expect(reconnectDelayMs(1, zero)).toBe(500)
    expect(reconnectDelayMs(2, zero)).toBe(1_000)
    expect(reconnectDelayMs(3, zero)).toBe(2_000)
    expect(reconnectDelayMs(4, zero)).toBe(4_000)
  })

  it('jitter mantém o delay dentro de [base/2, base]', () => {
    // Tentativa 3 → base 4s.
    expect(reconnectDelayMs(3, rolls(0))).toBe(2_000)
    expect(reconnectDelayMs(3, rolls(0.5))).toBe(3_000)
    expect(reconnectDelayMs(3, rolls(1))).toBe(4_000)
  })

  it('jitter varia de fato entre duas tentativas iguais', () => {
    expect(reconnectDelayMs(2, rolls(0.1))).not.toBe(reconnectDelayMs(2, rolls(0.9)))
  })

  it('satura no teto de 30s e nunca ultrapassa, por maior que seja a tentativa', () => {
    expect(reconnectDelayMs(10, rolls(1))).toBe(RECONNECT_MAX_DELAY_MS)
    expect(reconnectDelayMs(50, rolls(1))).toBe(RECONNECT_MAX_DELAY_MS)
    // `2 ** 5000` é Infinity — o teto tem que resolver sem virar NaN.
    expect(reconnectDelayMs(5_000, rolls(1))).toBe(RECONNECT_MAX_DELAY_MS)
    expect(reconnectDelayMs(5_000, rolls(0))).toBe(RECONNECT_MAX_DELAY_MS / 2)
  })

  it('é monótono não-decrescente com o mesmo sorteio', () => {
    const previous = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => reconnectDelayMs(n, rolls(0.7)))
    for (let i = 1; i < previous.length; i += 1) {
      expect(previous[i]).toBeGreaterThanOrEqual(previous[i - 1])
    }
  })

  it('trata tentativa 0 ou negativa como a primeira, nunca abaixo do piso', () => {
    expect(reconnectDelayMs(0, rolls(0))).toBe(RECONNECT_BASE_DELAY_MS / 2)
    expect(reconnectDelayMs(-3, rolls(0))).toBe(RECONNECT_BASE_DELAY_MS / 2)
  })

  it('sorteio fora de [0,1] não escapa da faixa', () => {
    expect(reconnectDelayMs(1, rolls(-5))).toBe(500)
    expect(reconnectDelayMs(1, rolls(5))).toBe(1_000)
  })
})

describe('planReconnect', () => {
  it('conexão abandonada não reconecta — nem na primeira queda', () => {
    expect(planReconnect({ previousAttempt: 0, abandoned: true, random: rolls(0) })).toBeNull()
    expect(planReconnect({ previousAttempt: 7, abandoned: true, random: rolls(0) })).toBeNull()
  })

  it('incrementa a tentativa e cresce o delay a cada queda seguida', () => {
    const random = rolls(1)
    const first = planReconnect({ previousAttempt: 0, abandoned: false, random })
    expect(first).toEqual({ attempt: 1, delayMs: 1_000 })
    const second = planReconnect({ previousAttempt: first?.attempt ?? 0, abandoned: false, random })
    expect(second).toEqual({ attempt: 2, delayMs: 2_000 })
    const third = planReconnect({ previousAttempt: second?.attempt ?? 0, abandoned: false, random })
    expect(third).toEqual({ attempt: 3, delayMs: 4_000 })
  })

  it('falha imediata de handshake não reconecta na hora: sempre há espera', () => {
    // Recusa por sessão inválida/cofre trancado cai aqui em rajada; o delay > 0 é o que impede
    // o loop apertado contra o servidor local.
    let attempt = 0
    for (let i = 0; i < 5; i += 1) {
      const plan = planReconnect({ previousAttempt: attempt, abandoned: false, random: rolls(0) })
      expect(plan).not.toBeNull()
      expect(plan?.delayMs).toBeGreaterThan(0)
      attempt = plan?.attempt ?? attempt
    }
    expect(attempt).toBe(5)
  })

  it('backoff reseta ao voltar do zero (open bem-sucedido)', () => {
    const late = planReconnect({ previousAttempt: 0, abandoned: false, random: rolls(1) })
    expect(late?.delayMs).toBe(1_000)
  })

  it('satura no teto sem estourar', () => {
    const plan = planReconnect({ previousAttempt: 99, abandoned: false, random: rolls(1) })
    expect(plan).toEqual({ attempt: 100, delayMs: RECONNECT_MAX_DELAY_MS })
  })
})

describe('shouldRefetchHistoryOnResync', () => {
  it('reconnect sempre relê, mesmo com fetch em voo', () => {
    // O GET que partiu antes da queda devolve o estado de antes dela, e o hub não reemite.
    expect(shouldRefetchHistoryOnResync({ reconnect: true, historyFetchInflight: true })).toBe(true)
    expect(shouldRefetchHistoryOnResync({ reconnect: true, historyFetchInflight: false })).toBe(true)
  })

  it('primeiro open não duplica o fetch de abertura da thread', () => {
    expect(shouldRefetchHistoryOnResync({ reconnect: false, historyFetchInflight: true })).toBe(false)
  })

  it('primeiro open sem nada em voo relê', () => {
    expect(shouldRefetchHistoryOnResync({ reconnect: false, historyFetchInflight: false })).toBe(true)
  })
})

describe('isEventForThread', () => {
  it('aceita só o evento da thread conectada', () => {
    expect(isEventForThread({ threadId: 'thr_1' }, 'thr_1')).toBe(true)
    expect(isEventForThread({ threadId: 'thr_2' }, 'thr_1')).toBe(false)
  })

  it('sem thread selecionada nada entra', () => {
    expect(isEventForThread({ threadId: 'thr_1' }, null)).toBe(false)
  })
})

/** Todo estado do wire, para as matrizes abaixo não deixarem par de fora em silêncio. */
const ALL_STATES: readonly ThreadState[] = [
  'running',
  'stopping',
  'waiting_user',
  'waiting_permission',
  'idle',
  'committed',
  'error',
  'cancelled',
  'interrupted',
]

describe('predicados de estado da thread', () => {
  it('ativo e assentado particionam o universo de estados, sem sobra nem sobreposição', () => {
    expect([...ACTIVE_THREAD_STATES, ...SETTLED_THREAD_STATES].sort()).toEqual([...ALL_STATES].sort())
    for (const state of ALL_STATES) {
      expect(isActiveThreadState(state)).toBe(!isSettledThreadState(state))
    }
  })

  it('todo assentamento reconcilia, cancelled inclusive: a fila anda sozinha ao fim da execução', () => {
    expect(isSettledThreadState('cancelled')).toBe(true)
    expect(reconcilesTurnEnd('cancelled')).toBe(true)
    expect(TURN_RECONCILED_STATES).toEqual(SETTLED_THREAD_STATES)
    for (const state of TURN_RECONCILED_STATES) {
      expect(reconcilesTurnEnd(state)).toBe(true)
      expect(isSettledThreadState(state)).toBe(true)
    }
    // Estado ativo nunca reconcilia: o turno ainda está em andamento.
    for (const state of ACTIVE_THREAD_STATES) expect(reconcilesTurnEnd(state)).toBe(false)
  })

  it('string desconhecida ou ausente não é nem ativa nem assentada (o wire manda `state: string` cru)', () => {
    for (const value of [null, undefined, '', 'zumbi']) {
      expect(isActiveThreadState(value)).toBe(false)
      expect(isSettledThreadState(value)).toBe(false)
      expect(reconcilesTurnEnd(value)).toBe(false)
    }
  })
})

describe('decideThreadStateResync', () => {
  const NOTHING = { adoptState: null, reconcileSettled: false }

  it('estados iguais não mexem em nada — o caso comum não pode custar re-render', () => {
    for (const state of ALL_STATES) {
      expect(decideThreadStateResync({ localState: state, serverState: state })).toEqual(NOTHING)
    }
  })

  it('lado desconhecido não adota nada', () => {
    expect(decideThreadStateResync({ localState: null, serverState: 'idle' })).toEqual(NOTHING)
    expect(decideThreadStateResync({ localState: undefined, serverState: 'idle' })).toEqual(NOTHING)
    // Thread sumiu da lista do servidor (apagada em outra janela): manter o que está em tela.
    expect(decideThreadStateResync({ localState: 'running', serverState: null })).toEqual(NOTHING)
    expect(decideThreadStateResync({ localState: 'running', serverState: undefined })).toEqual(NOTHING)
  })

  it('o bug: servidor assentou com resultado enquanto o local seguia ativo → adota e reconcilia', () => {
    for (const localState of ACTIVE_THREAD_STATES) {
      for (const serverState of TURN_RECONCILED_STATES) {
        expect(decideThreadStateResync({ localState, serverState })).toEqual({
          adoptState: serverState,
          reconcileSettled: true,
        })
      }
    }
  })

  it('cancelamento perdido destrava o composer e despacha a fila, como qualquer fim de execução', () => {
    for (const localState of ACTIVE_THREAD_STATES) {
      expect(decideThreadStateResync({ localState, serverState: 'cancelled' })).toEqual({
        adoptState: 'cancelled',
        reconcileSettled: true,
      })
    }
  })

  it('servidor ativo com local assentado só adota (turno novo começou durante a queda)', () => {
    for (const localState of SETTLED_THREAD_STATES) {
      for (const serverState of ACTIVE_THREAD_STATES) {
        expect(decideThreadStateResync({ localState, serverState })).toEqual({
          adoptState: serverState,
          reconcileSettled: false,
        })
      }
    }
  })

  it('dois assentamentos diferentes só adotam — histórico e gate do resync já cobriram o resto', () => {
    expect(decideThreadStateResync({ localState: 'idle', serverState: 'committed' })).toEqual({
      adoptState: 'committed',
      reconcileSettled: false,
    })
    expect(decideThreadStateResync({ localState: 'cancelled', serverState: 'error' })).toEqual({
      adoptState: 'error',
      reconcileSettled: false,
    })
  })

  it('troca entre dois estados ativos só adota (running → waiting_permission na queda)', () => {
    expect(
      decideThreadStateResync({ localState: 'running', serverState: 'waiting_permission' })
    ).toEqual({ adoptState: 'waiting_permission', reconcileSettled: false })
    expect(decideThreadStateResync({ localState: 'stopping', serverState: 'running' })).toEqual({
      adoptState: 'running',
      reconcileSettled: false,
    })
  })

  it('cobre a matriz inteira: reconcilia se e só se saiu de ativo para assentamento com resultado', () => {
    for (const localState of ALL_STATES) {
      for (const serverState of ALL_STATES) {
        const decision = decideThreadStateResync({ localState, serverState })
        const changed = localState !== serverState
        expect(decision.adoptState).toBe(changed ? serverState : null)
        expect(decision.reconcileSettled).toBe(
          changed && isActiveThreadState(localState) && reconcilesTurnEnd(serverState)
        )
      }
    }
  })
})

describe('roteamento de eventos de execução (F29)', () => {
  const execEvents = [
    { type: 'tool_call.start', threadId: 't', id: 'x', name: 'Bash', params: {} },
    { type: 'tool_call.result', threadId: 't', id: 'x', status: 'completed', result: null },
    { type: 'subagent.start', threadId: 't', childThreadId: 'c1', name: 'reviewer' },
    { type: 'subagent.result', threadId: 't', childThreadId: 'c1', status: 'completed' },
    { type: 'subagent.tool_call.start', threadId: 't', childThreadId: 'c1', id: 'tu', name: 'Read' },
    { type: 'subagent.tool_call.result', threadId: 't', childThreadId: 'c1', id: 'tu', status: 'completed' },
  ] as unknown as StreamEvent[]

  it('reconhece os eventos que alimentam o overlay do grafo', () => {
    for (const event of execEvents) expect(isExecutionStreamEvent(event)).toBe(true)
    expect(isExecutionStreamEvent({ type: 'message.delta', threadId: 't', text: 'x' })).toBe(false)
    expect(isExecutionStreamEvent({ type: 'diff.ready', threadId: 't', diffId: 'd', file: 'a.ts' })).toBe(false)
  })

  it('não refetcha o histórico só por atividade de tool do filho', () => {
    for (const event of execEvents) {
      const isChildTool = event.type.startsWith('subagent.tool_call.')
      expect(refetchesHistory(event)).toBe(!isChildTool)
    }
  })
})

/**
 * F35 — `interrupted` é terminal. Ficar fora de `TURN_RECONCILED_STATES` é o defeito que já
 * congelou a fila do composer uma vez com `cancelled`: nada movia a fila e o item só saía quando
 * outra mensagem qualquer terminasse, fora de ordem.
 */
describe('interrupted é estado assentado (F35)', () => {
  it('entra nos dois conjuntos terminais', () => {
    expect(SETTLED_THREAD_STATES).toContain('interrupted')
    expect(TURN_RECONCILED_STATES).toContain('interrupted')
  })

  it('não é estado ativo', () => {
    expect(isActiveThreadState('interrupted')).toBe(false)
    expect(isSettledThreadState('interrupted')).toBe(true)
  })

  it('os dois conjuntos continuam idênticos', () => {
    // A fila drena em todo fim de execução, qualquer que tenha sido o desfecho.
    expect([...TURN_RECONCILED_STATES].sort()).toEqual([...SETTLED_THREAD_STATES].sort())
  })
})
