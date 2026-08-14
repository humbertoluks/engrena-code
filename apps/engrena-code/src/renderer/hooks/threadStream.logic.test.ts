import { describe, expect, it } from 'vitest'
import {
  isEventForThread,
  planReconnect,
  reconnectDelayMs,
  RECONNECT_BASE_DELAY_MS,
  RECONNECT_MAX_DELAY_MS,
  shouldRefetchHistoryOnResync,
} from './threadStream.logic'

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
