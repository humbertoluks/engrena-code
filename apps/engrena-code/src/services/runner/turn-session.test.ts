import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  addTurnCloser,
  clearAllTurnSessionsForTesting,
  clearStoppingDeadline,
  closeTurnServers,
  endTurnSession,
  getCancellableTurnSession,
  getTurnSession,
  markTurnSettled,
  scheduleStoppingDeadline,
  startTurnSession,
} from './turn-session.js'

afterEach(() => {
  clearAllTurnSessionsForTesting()
  vi.useRealTimers()
})

function start(threadId: string, releaseLease: () => void = () => {}) {
  return startTurnSession({ threadId, projectId: 'prj_1', releaseLease })
}

describe('ciclo de vida da sessão', () => {
  it('registra a sessão por threadId com controller próprio e nada pendente', () => {
    const session = start('thr_1')

    expect(getTurnSession('thr_1')).toBe(session)
    expect(session.projectId).toBe('prj_1')
    expect(session.controller.signal.aborted).toBe(false)
    expect(session.cancelRequested).toBe(false)
    expect(session.settled).toBe(false)
  })

  it('thread sem turno vivo não tem sessão', () => {
    expect(getTurnSession('thr_inexistente')).toBeUndefined()
    expect(getCancellableTurnSession('thr_inexistente')).toBeUndefined()
  })

  it('encerrar fecha closers, limpa deadline e solta a lease de uma vez só', () => {
    vi.useFakeTimers()
    let released = 0
    const closed: string[] = []
    start('thr_2', () => {
      released += 1
    })
    addTurnCloser('thr_2', () => closed.push('permission'))
    addTurnCloser('thr_2', () => closed.push('ask'))
    scheduleStoppingDeadline('thr_2', 8_000, () => closed.push('deadline'))

    endTurnSession('thr_2')
    vi.advanceTimersByTime(20_000)

    expect(closed).toEqual(['permission', 'ask'])
    expect(released).toBe(1)
    expect(getTurnSession('thr_2')).toBeUndefined()
  })

  it('encerrar duas vezes não solta a lease de novo (turno seguinte não perde a dele)', () => {
    let released = 0
    start('thr_3', () => {
      released += 1
    })

    endTurnSession('thr_3')
    endTurnSession('thr_3')

    expect(released).toBe(1)
  })

  it('encerrar thread desconhecida é no-op silencioso', () => {
    expect(() => endTurnSession('thr_nunca')).not.toThrow()
  })
})

describe('cancelRequested', () => {
  it('vive na sessão e morre com ela — cancelar não deixa marca eterna', () => {
    const session = start('thr_4')
    session.cancelRequested = true

    endTurnSession('thr_4')
    const next = start('thr_4')

    // Turno novo na mesma thread nasce limpo: a `Set` global antiga marcava a thread para sempre
    // quando o turno terminava sem lançar (cancel no fim do turno).
    expect(next.cancelRequested).toBe(false)
  })
})

describe('closers', () => {
  it('roda cada closer uma única vez, mesmo com closeTurnServers repetido', () => {
    let closes = 0
    start('thr_5')
    addTurnCloser('thr_5', () => {
      closes += 1
    })

    closeTurnServers('thr_5')
    closeTurnServers('thr_5')

    expect(closes).toBe(1)
  })

  it('closer que lança não impede os seguintes (server já morto)', () => {
    const closed: string[] = []
    start('thr_6')
    addTurnCloser('thr_6', () => {
      throw new Error('server já fechado')
    })
    addTurnCloser('thr_6', () => closed.push('memory'))

    expect(() => closeTurnServers('thr_6')).not.toThrow()
    expect(closed).toEqual(['memory'])
  })

  it('closeTurnServers sem sessão é no-op', () => {
    expect(() => closeTurnServers('thr_nunca')).not.toThrow()
  })

  it('closer registrado sem sessão viva é descartado', () => {
    let closes = 0
    addTurnCloser('thr_nunca', () => {
      closes += 1
    })
    closeTurnServers('thr_nunca')
    expect(closes).toBe(0)
  })
})

describe('deadline de stopping', () => {
  it('dispara o callback depois do prazo', () => {
    vi.useFakeTimers()
    let fired = 0
    start('thr_7')
    scheduleStoppingDeadline('thr_7', 8_000, () => {
      fired += 1
    })

    vi.advanceTimersByTime(8_000)
    expect(fired).toBe(1)
  })

  it('reagendar cancela o timer anterior (um só deadline por sessão)', () => {
    vi.useFakeTimers()
    const fired: string[] = []
    start('thr_8')
    scheduleStoppingDeadline('thr_8', 8_000, () => fired.push('primeiro'))
    scheduleStoppingDeadline('thr_8', 8_000, () => fired.push('segundo'))

    vi.advanceTimersByTime(20_000)
    expect(fired).toEqual(['segundo'])
  })

  it('clearStoppingDeadline impede o disparo', () => {
    vi.useFakeTimers()
    let fired = 0
    start('thr_9')
    scheduleStoppingDeadline('thr_9', 8_000, () => {
      fired += 1
    })

    clearStoppingDeadline('thr_9')
    vi.advanceTimersByTime(20_000)
    expect(fired).toBe(0)
  })

  it('agendar sem sessão viva não deixa timer solto', () => {
    vi.useFakeTimers()
    let fired = 0
    scheduleStoppingDeadline('thr_nunca', 8_000, () => {
      fired += 1
    })

    vi.advanceTimersByTime(20_000)
    expect(fired).toBe(0)
  })
})

describe('sessão assentada pelo deadline', () => {
  it('deixa de ser cancelável mas continua legível para o turno em curso', () => {
    const session = start('thr_10')
    expect(getCancellableTurnSession('thr_10')).toBe(session)

    markTurnSettled('thr_10')

    expect(getCancellableTurnSession('thr_10')).toBeUndefined()
    expect(getTurnSession('thr_10')).toBe(session)
    // A lease continua com o turno: o processo pode não ter assentado ainda.
    expect(session.settled).toBe(true)
  })

  it('markTurnSettled sem sessão é no-op', () => {
    expect(() => markTurnSettled('thr_nunca')).not.toThrow()
  })
})

describe('sessão duplicada na mesma thread', () => {
  it('fecha o que sobrou do registro anterior sem soltar a lease do turno novo', () => {
    vi.useFakeTimers()
    let released = 0
    let closedStale = 0
    let staleDeadline = 0
    start('thr_11', () => {
      released += 1
    })
    addTurnCloser('thr_11', () => {
      closedStale += 1
    })
    scheduleStoppingDeadline('thr_11', 8_000, () => {
      staleDeadline += 1
    })

    const fresh = start('thr_11', () => {
      released += 1
    })
    vi.advanceTimersByTime(20_000)

    expect(closedStale).toBe(1)
    expect(staleDeadline).toBe(0)
    expect(released).toBe(0)
    expect(getTurnSession('thr_11')).toBe(fresh)
  })
})
