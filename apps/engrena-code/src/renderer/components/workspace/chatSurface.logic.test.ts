import { describe, expect, it } from 'vitest'
import type { ThreadState } from '../../services/threads-service'
import type { ThreadGate } from '../../hooks/threadGate.logic'
import { routeComposerSend } from './composerRoute.logic'
import { CHAT_SURFACE_COPY, deriveChatSurface, type ChatSurfaceInput } from './chatSurface.logic'

function gateOf(kind: 'permission' | 'question'): ThreadGate {
  return {
    gateId: `gate_${kind}`,
    threadId: 'thr_1',
    kind,
    toolName: kind === 'permission' ? 'Bash' : null,
    payload: null,
    createdAt: 1,
    expiresAt: null,
  }
}

const PERMISSION_GATE = gateOf('permission')
const QUESTION_GATE = gateOf('question')

const ALL_STATES: Array<ThreadState | null> = [
  'running',
  'idle',
  'committed',
  'error',
  'stopping',
  'waiting_user',
  'waiting_permission',
  'cancelled',
  null,
]

const base: ChatSurfaceInput = {
  threadState: 'idle',
  gate: null,
  hasActivePending: false,
  queueLength: 0,
  hasSelectedThread: true,
  hasSelectedProject: true,
  draftText: 'oi',
}

const BOOLS = [false, true]
const GATES: Array<ThreadGate | null> = [null, PERMISSION_GATE, QUESTION_GATE]
const TEXTS = ['', '   ', 'oi', 'Sim', 'Permitir todos', 'Negar', 'talvez depois']
/** Fila vazia e fila com gente: a segunda muda a rota com a thread parada. */
const QUEUE_LENGTHS = [0, 1]

function allInputs(): ChatSurfaceInput[] {
  const out: ChatSurfaceInput[] = []
  for (const threadState of ALL_STATES) {
    for (const gate of GATES) {
      for (const queueLength of QUEUE_LENGTHS) {
        for (const hasSelectedThread of BOOLS) {
          for (const hasSelectedProject of BOOLS) {
            for (const draftText of TEXTS) {
              out.push({
                ...base,
                threadState,
                gate,
                queueLength,
                hasSelectedThread,
                hasSelectedProject,
                draftText,
              })
            }
          }
        }
      }
    }
  }
  return out
}

describe('deriveChatSurface — rota é a de routeComposerSend, nunca reimplementada', () => {
  it('devolve exatamente a mesma action para toda a matriz estado × gate × texto', () => {
    const cases = allInputs()
    // Guarda contra a matriz encolher em silêncio.
    expect(cases.length).toBe(
      ALL_STATES.length * GATES.length * QUEUE_LENGTHS.length * 2 * 2 * TEXTS.length
    )

    for (const input of cases) {
      const expected = routeComposerSend({
        text: input.draftText,
        threadState: input.threadState,
        gate: input.gate,
        queueLength: input.queueLength,
        hasSelectedThread: input.hasSelectedThread,
        hasSelectedProject: input.hasSelectedProject,
      }).action
      expect({ input, route: deriveChatSurface(input).route }).toEqual({ input, route: expected })
    }
  })
})

describe('deriveChatSurface — modo', () => {
  it('stopping vence tudo', () => {
    expect(
      deriveChatSurface({ ...base, threadState: 'stopping', gate: PERMISSION_GATE }).composerMode
    ).toBe('stopping')
  })

  it('permissão pendente vence running e waiting_user', () => {
    expect(
      deriveChatSurface({ ...base, threadState: 'running', gate: PERMISSION_GATE }).composerMode
    ).toBe('permission')
    expect(
      deriveChatSurface({ ...base, threadState: 'waiting_user', gate: PERMISSION_GATE }).composerMode
    ).toBe('permission')
  })

  it('waiting_permission é modo permissão mesmo com a fila local vazia (WS perdido)', () => {
    expect(deriveChatSurface({ ...base, threadState: 'waiting_permission' }).composerMode).toBe('permission')
  })

  it('waiting_user vira question e running vira busy', () => {
    expect(deriveChatSurface({ ...base, threadState: 'waiting_user' }).composerMode).toBe('question')
    expect(deriveChatSurface({ ...base, threadState: 'running' }).composerMode).toBe('busy')
  })

  it('estados assentados são idle', () => {
    for (const state of ['idle', 'committed', 'error', 'cancelled', null] as const) {
      expect(deriveChatSurface({ ...base, threadState: state }).composerMode).toBe('idle')
    }
  })
})

describe('deriveChatSurface — Parar e Enviar', () => {
  it('running mostra Parar e Enviar (o Enviar enfileira)', () => {
    const surface = deriveChatSurface({ ...base, threadState: 'running' })
    expect(surface.showStop).toBe(true)
    expect(surface.showSend).toBe(true)
    expect(surface.route).toBe('enqueue')
    expect(surface.sendLabel).toBe(CHAT_SURFACE_COPY.sendEnqueue)
  })

  it('stopping mostra só Parar', () => {
    const surface = deriveChatSurface({ ...base, threadState: 'stopping' })
    expect(surface.showStop).toBe(true)
    expect(surface.showSend).toBe(false)
  })

  it('permissão pendente com a thread já parada ainda mostra Parar', () => {
    expect(deriveChatSurface({ ...base, threadState: 'idle', gate: PERMISSION_GATE }).showStop).toBe(true)
  })

  it('thread parada sem permissão não mostra Parar', () => {
    expect(deriveChatSurface({ ...base, threadState: 'idle' }).showStop).toBe(false)
    expect(deriveChatSurface({ ...base, threadState: null }).showStop).toBe(false)
  })
})

describe('deriveChatSurface — rótulo acompanha a rota', () => {
  it('waiting_user sem pergunta pendente rotula enfileirar, não "Enviar resposta"', () => {
    const surface = deriveChatSurface({ ...base, threadState: 'waiting_user', gate: null })
    expect(surface.route).toBe('enqueue')
    expect(surface.sendLabel).toBe(CHAT_SURFACE_COPY.sendEnqueue)
  })

  it('waiting_user com pergunta pendente rotula resposta', () => {
    const surface = deriveChatSurface({ ...base, threadState: 'waiting_user', gate: QUESTION_GATE })
    expect(surface.route).toBe('answer_question')
    expect(surface.sendLabel).toBe(CHAT_SURFACE_COPY.sendQuestion)
  })

  it('decisão de permissão e bloqueio rotulam permissão', () => {
    expect(
      deriveChatSurface({
        ...base,
        threadState: 'waiting_permission',
        gate: PERMISSION_GATE,
        draftText: 'Sim',
      }).sendLabel
    ).toBe(CHAT_SURFACE_COPY.sendPermission)
    // Sem gate em maos (WS perdido), so texto de decisao e bloqueado: mensagem comum vai para a fila.
    expect(
      deriveChatSurface({ ...base, threadState: 'waiting_permission', draftText: 'Sim' }).sendLabel
    ).toBe(CHAT_SURFACE_COPY.sendPermission)
    expect(
      deriveChatSurface({ ...base, threadState: 'waiting_permission', draftText: 'qualquer coisa' }).route
    ).toBe('enqueue')
  })

  it('composer vazio cai no rótulo do modo', () => {
    expect(deriveChatSurface({ ...base, threadState: 'running', draftText: '' }).route).toBe('noop')
    expect(deriveChatSurface({ ...base, threadState: 'running', draftText: '' }).sendLabel).toBe(
      CHAT_SURFACE_COPY.sendEnqueue
    )
    expect(deriveChatSurface({ ...base, threadState: 'idle', draftText: '   ' }).sendLabel).toBe(
      CHAT_SURFACE_COPY.send
    )
    expect(
      deriveChatSurface({ ...base, threadState: 'waiting_permission', draftText: '' }).sendLabel
    ).toBe(CHAT_SURFACE_COPY.sendPermission)
  })

  it('thread nova rotula Enviar', () => {
    const surface = deriveChatSurface({ ...base, threadState: null, hasSelectedThread: false })
    expect(surface.route).toBe('send_new')
    expect(surface.sendLabel).toBe(CHAT_SURFACE_COPY.send)
  })
})

describe('deriveChatSurface — placeholder', () => {
  it('mapeia cada modo para a sua chave', () => {
    expect(deriveChatSurface({ ...base, threadState: 'stopping' }).placeholderKey).toBe('stopping')
    expect(deriveChatSurface({ ...base, threadState: 'waiting_permission' }).placeholderKey).toBe('permission')
    expect(deriveChatSurface({ ...base, threadState: 'waiting_user' }).placeholderKey).toBe('question')
    expect(deriveChatSurface({ ...base, threadState: 'running' }).placeholderKey).toBe('running')
    expect(deriveChatSurface({ ...base, threadState: 'idle' }).placeholderKey).toBe('follow_up')
    expect(
      deriveChatSurface({ ...base, threadState: null, hasSelectedThread: false }).placeholderKey
    ).toBe('new')
  })
})

describe('deriveChatSurface — indicador de atividade', () => {
  it('fica visível o turno inteiro em running', () => {
    expect(deriveChatSurface({ ...base, threadState: 'running' }).showActivity).toBe(true)
  })

  it('some quando a bola passa para o usuário', () => {
    expect(
      deriveChatSurface({ ...base, threadState: 'running', gate: PERMISSION_GATE }).showActivity
    ).toBe(false)
    expect(
      deriveChatSurface({ ...base, threadState: 'running', gate: QUESTION_GATE }).showActivity
    ).toBe(false)
    expect(deriveChatSurface({ ...base, threadState: 'waiting_user' }).showActivity).toBe(false)
    expect(deriveChatSurface({ ...base, threadState: 'waiting_permission' }).showActivity).toBe(false)
  })

  it('some com a thread parada ou cancelando', () => {
    expect(deriveChatSurface({ ...base, threadState: 'idle' }).showActivity).toBe(false)
    expect(deriveChatSurface({ ...base, threadState: 'stopping' }).showActivity).toBe(false)
  })
})

describe('deriveChatSurface — followups', () => {
  it('some com a thread ocupada', () => {
    for (const state of ['running', 'stopping', 'waiting_user', 'waiting_permission'] as const) {
      expect(deriveChatSurface({ ...base, threadState: state }).showFollowups).toBe(false)
    }
  })

  it('some com permissão ou pergunta pendente mesmo com a thread parada', () => {
    expect(deriveChatSurface({ ...base, gate: PERMISSION_GATE }).showFollowups).toBe(false)
    expect(deriveChatSurface({ ...base, gate: QUESTION_GATE }).showFollowups).toBe(false)
  })

  it('some com bolha otimista em voo', () => {
    expect(deriveChatSurface({ ...base, hasActivePending: true }).showFollowups).toBe(false)
  })

  it('aparece com a thread parada e nada em voo', () => {
    expect(deriveChatSurface({ ...base, threadState: 'idle' }).showFollowups).toBe(true)
    expect(deriveChatSurface({ ...base, threadState: 'committed' }).showFollowups).toBe(true)
  })
})

describe('deriveChatSurface — sendStartsTurn', () => {
  it('decisão de permissão, resposta e enfileiramento passam por cima dos gates do projeto', () => {
    expect(deriveChatSurface({ ...base, gate: PERMISSION_GATE }).sendStartsTurn).toBe(false)
    expect(deriveChatSurface({ ...base, threadState: 'waiting_permission' }).sendStartsTurn).toBe(false)
    expect(deriveChatSurface({ ...base, threadState: 'waiting_user' }).sendStartsTurn).toBe(false)
    expect(deriveChatSurface({ ...base, threadState: 'running' }).sendStartsTurn).toBe(false)
  })

  it('thread parada abre turno novo e respeita os gates', () => {
    expect(deriveChatSurface({ ...base, threadState: 'idle' }).sendStartsTurn).toBe(true)
    expect(deriveChatSurface({ ...base, threadState: null, hasSelectedThread: false }).sendStartsTurn).toBe(
      true
    )
  })
})

describe('deriveChatSurface — runtimeLocked', () => {
  it('trava com turno em andamento', () => {
    for (const state of ['running', 'stopping', 'waiting_user', 'waiting_permission'] as const) {
      expect(deriveChatSurface({ ...base, threadState: state }).runtimeLocked).toBe(true)
    }
  })

  it('trava com fila não-vazia mesmo parada', () => {
    expect(deriveChatSurface({ ...base, threadState: 'idle', queueLength: 1 }).runtimeLocked).toBe(true)
  })

  it('permissão pendente sozinha não trava provider/anexos', () => {
    expect(deriveChatSurface({ ...base, threadState: 'idle', gate: PERMISSION_GATE }).runtimeLocked).toBe(
      false
    )
  })

  it('livre com thread parada e fila vazia', () => {
    expect(deriveChatSurface({ ...base, threadState: 'idle' }).runtimeLocked).toBe(false)
  })
})

describe('deriveChatSurface — fila pausada (pós-cancelamento)', () => {
  it('thread assentada com item na fila é fila pausada', () => {
    for (const state of ['cancelled', 'idle', 'committed', 'error'] as const) {
      expect(deriveChatSurface({ ...base, threadState: state, queueLength: 1 }).queuePaused).toBe(true)
    }
  })

  it('não é pausa com turno vivo, com gate aberto nem em stopping', () => {
    for (const state of ['running', 'stopping', 'waiting_user', 'waiting_permission'] as const) {
      expect(deriveChatSurface({ ...base, threadState: state, queueLength: 1 }).queuePaused).toBe(false)
    }
    expect(
      deriveChatSurface({ ...base, threadState: 'idle', gate: PERMISSION_GATE, queueLength: 1 }).queuePaused
    ).toBe(false)
    expect(
      deriveChatSurface({ ...base, threadState: 'waiting_user', gate: QUESTION_GATE, queueLength: 1 })
        .queuePaused
    ).toBe(false)
  })

  it('fila vazia nunca é pausa', () => {
    expect(deriveChatSurface({ ...base, threadState: 'cancelled', queueLength: 0 }).queuePaused).toBe(false)
  })

  it('com fila cheia o Enviar enfileira e não abre turno, mesmo com a thread parada', () => {
    const surface = deriveChatSurface({ ...base, threadState: 'cancelled', queueLength: 1 })
    expect(surface.route).toBe('enqueue')
    expect(surface.sendLabel).toBe(CHAT_SURFACE_COPY.sendEnqueue)
    expect(surface.sendStartsTurn).toBe(false)
  })
})
